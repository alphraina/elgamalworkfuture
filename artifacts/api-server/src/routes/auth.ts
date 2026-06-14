import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, siteSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../lib/auth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

function getClientIp(req: any): string {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.username, username));
  const user = users[0];

  if (!user || !verifyPassword(password, user.passwordHash)) {
    await logAudit(
      user ? { id: user.id, fullName: user.fullName, role: user.role } : null,
      "login_failed",
      "Auth",
      null,
      `Failed login attempt: ${username}`,
      { username, ip: getClientIp(req), reason: "Invalid credentials" }
    );
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (user.registrationStatus === "pending") {
    return res.status(403).json({ error: "Your account is pending admin approval." });
  }

  if (user.registrationStatus === "rejected") {
    return res.status(403).json({ error: "Your registration has been rejected." });
  }

  if (!user.isActive) {
    await logAudit(
      { id: user.id, fullName: user.fullName, role: user.role },
      "login_failed",
      "Auth",
      user.id,
      `${user.fullName} (${user.username})`,
      { username, ip: getClientIp(req), reason: "Account inactive" }
    );
    return res.status(401).json({ error: "Account is inactive" });
  }

  req.session.userId = user.id;

  await logAudit(
    { id: user.id, fullName: user.fullName, role: user.role },
    "login",
    "Auth",
    user.id,
    `${user.fullName} (${user.username})`,
    { username, ip: getClientIp(req), role: user.role }
  );

  return res.json({
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      department: user.department,
      phone: user.phone,
      isActive: user.isActive,
      createdAt: user.createdAt?.toISOString(),
    },
    message: "Login successful",
  });
});

router.post("/logout", async (req, res) => {
  const userId = req.session.userId;
  if (userId) {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const user = users[0];
    if (user) {
      await logAudit(
        { id: user.id, fullName: user.fullName, role: user.role },
        "logout",
        "Auth",
        user.id,
        `${user.fullName} (${user.username})`,
        { ip: getClientIp(req) }
      );
    }
  }
  req.session.destroy(() => {
    res.json({ success: true, message: "Logged out" });
  });
});

router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const users = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  const user = users[0];

  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  return res.json({
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
    createdAt: user.createdAt?.toISOString(),
  });
});

router.get("/signup-status", async (_req, res) => {
  const rows = await db.select().from(siteSettingsTable);
  const signupEnabled = rows[0]?.signupEnabled ?? false;
  res.json({ signupEnabled });
});

router.post("/signup", async (req, res) => {
  const rows = await db.select().from(siteSettingsTable);
  const signupEnabled = rows[0]?.signupEnabled ?? false;
  if (!signupEnabled) {
    return res.status(403).json({ error: "Registration is currently closed." });
  }

  const { username, password, fullName, email, department, phone } = req.body;
  if (!username?.trim() || !password?.trim() || !fullName?.trim()) {
    return res.status(400).json({ error: "Work ID, password, and full name are required." });
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username.trim()));
  if (existing.length > 0) {
    return res.status(409).json({ error: "This Work ID is already taken." });
  }

  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    username: username.trim(),
    passwordHash,
    fullName: fullName.trim(),
    email: email?.trim() || null,
    role: "maintenance",
    extraRoles: [],
    department: department?.trim() || null,
    phone: phone?.trim() || null,
    isActive: false,
    registrationStatus: "pending",
  }).returning();

  await logAudit(null, "create", "User", user.id, `${fullName} (${username}) — self-registration`, {
    username, fullName, email, department, phone, registrationStatus: "pending",
  });

  return res.status(201).json({ message: "Registration submitted. Please wait for admin approval." });
});

export { hashPassword };
export default router;
