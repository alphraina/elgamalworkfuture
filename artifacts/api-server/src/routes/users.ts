import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../lib/auth.js";
import { getCurrentUser } from "../lib/current-user.js";
import { logAudit, diffObjects } from "../lib/audit.js";

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    extraRoles: user.extraRoles ?? [],
    team: user.team ?? null,
    department: user.department,
    phone: user.phone,
    isActive: user.isActive,
    registrationStatus: user.registrationStatus,
    createdAt: user.createdAt?.toISOString(),
  };
}

router.get("/", async (_req, res) => {
  const users = await db.select().from(usersTable).where(eq(usersTable.registrationStatus, "approved"));
  res.json(users.map(formatUser));
});

router.get("/pending", async (req, res) => {
  const actor = await getCurrentUser(req);
  if (!actor || actor.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  const users = await db.select().from(usersTable).where(eq(usersTable.registrationStatus, "pending"));
  res.json(users.map(formatUser));
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const users = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!users[0]) return res.status(404).json({ error: "User not found" });
  res.json(formatUser(users[0]));
});

router.post("/", async (req, res) => {
  const actor = await getCurrentUser(req);
  const { username, password, fullName, email, role, extraRoles, team, department, phone } = req.body;
  if (!username || !password || !fullName || !role) {
    return res.status(400).json({ error: "Username, password, fullName, and role are required" });
  }

  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    username,
    passwordHash,
    fullName,
    email,
    role,
    extraRoles: Array.isArray(extraRoles) ? extraRoles : [],
    team: team || null,
    department,
    phone,
    isActive: true,
    registrationStatus: "approved",
  }).returning();

  await logAudit(actor, "create", "User", user.id, `${fullName} (${username})`, {
    username, fullName, email, role, team, department, phone,
  });

  return res.status(201).json(formatUser(user));
});

router.post("/:id/approve", async (req, res) => {
  const actor = await getCurrentUser(req);
  if (!actor || actor.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  const id = parseInt(req.params.id);
  const { role, team } = req.body;
  if (!role) {
    return res.status(400).json({ error: "A role must be assigned before approving." });
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!existing) return res.status(404).json({ error: "User not found" });
  if (existing.registrationStatus !== "pending") {
    return res.status(400).json({ error: "User is not pending approval." });
  }

  const [user] = await db.update(usersTable).set({
    registrationStatus: "approved",
    isActive: true,
    role,
    team: team || null,
  }).where(eq(usersTable.id, id)).returning();

  await logAudit(actor, "update", "User", id, `${existing.fullName} (${existing.username})`, [
    { field: "registrationStatus", old: "pending", new: "approved" },
    { field: "role", old: existing.role, new: role },
    { field: "team", old: existing.team, new: team },
    { field: "isActive", old: false, new: true },
  ]);

  return res.json(formatUser(user));
});

router.post("/:id/reject", async (req, res) => {
  const actor = await getCurrentUser(req);
  if (!actor || actor.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  const id = parseInt(req.params.id);

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!existing) return res.status(404).json({ error: "User not found" });

  const [user] = await db.update(usersTable).set({
    registrationStatus: "rejected",
    isActive: false,
  }).where(eq(usersTable.id, id)).returning();

  await logAudit(actor, "update", "User", id, `${existing.fullName} (${existing.username})`, [
    { field: "registrationStatus", old: existing.registrationStatus, new: "rejected" },
  ]);

  return res.json(formatUser(user));
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const actor = await getCurrentUser(req);
  const currentUserId = (req.session as Record<string, unknown>).userId as number | undefined;
  const isSelf = currentUserId === id;

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!targetUser) return res.status(404).json({ error: "User not found" });
  const isSystemAdmin = targetUser.username === "admin";

  const { fullName, email, role, extraRoles, team, department, phone, isActive, password } = req.body;

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (fullName !== undefined) updates.fullName = fullName;
  if (email !== undefined) updates.email = email;
  if (team !== undefined) updates.team = team || null;
  if (department !== undefined) updates.department = department;
  if (phone !== undefined) updates.phone = phone;
  if (password) updates.passwordHash = hashPassword(password);

  const blockRoleChange = isSelf || isSystemAdmin;
  if (!blockRoleChange) {
    if (role !== undefined) updates.role = role;
    if (extraRoles !== undefined) updates.extraRoles = Array.isArray(extraRoles) ? extraRoles : [];
    if (isActive !== undefined) updates.isActive = isActive;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  const oldData = formatUser(targetUser) as Record<string, unknown>;
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!user) return res.status(404).json({ error: "User not found" });

  const newData = formatUser(user) as Record<string, unknown>;
  const changes = diffObjects(oldData, newData);
  if (password) changes.push({ field: "password", old: "(hidden)", new: "(changed)" });
  await logAudit(actor, "update", "User", id, `${targetUser.fullName} (${targetUser.username})`, changes);

  return res.json(formatUser(user));
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const actor = await getCurrentUser(req);
  const currentUserId = (req.session as Record<string, unknown>).userId as number | undefined;

  if (currentUserId === id) {
    return res.status(403).json({ error: "You cannot delete your own account" });
  }

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  await db.delete(usersTable).where(eq(usersTable.id, id));
  await logAudit(actor, "delete", "User", id, targetUser ? `${targetUser.fullName} (${targetUser.username})` : String(id), targetUser ? formatUser(targetUser) as Record<string, unknown> : null);

  return res.json({ success: true, message: "User deleted" });
});

export default router;
