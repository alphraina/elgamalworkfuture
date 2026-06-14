import { Router } from "express";
import { db } from "@workspace/db";
import { changeoverTasksTable, productionLinesTable, usersTable, notificationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, canCreatePlans, isTeamLeader, isInventory, isAdmin } from "../lib/current-user.js";
import { sendPushToUser } from "../lib/push.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

function canView(user: any) {
  return user && user.role !== "inventory";
}

function canManage(user: any) {
  return user && (user.role === "admin" || user.role === "manager");
}

async function formatChangeover(ct: any) {
  const line = ct.lineId
    ? (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, ct.lineId)))[0]
    : null;
  const assignedTo = ct.assignedToId
    ? (await db.select().from(usersTable).where(eq(usersTable.id, ct.assignedToId)))[0]
    : null;
  const createdBy = ct.createdById
    ? (await db.select().from(usersTable).where(eq(usersTable.id, ct.createdById)))[0]
    : null;

  return {
    id: ct.id,
    date: ct.date,
    lineId: ct.lineId,
    lineName: line?.name ?? null,
    fromModel: ct.fromModel,
    toModel: ct.toModel,
    assignedToId: ct.assignedToId,
    assignedToName: assignedTo?.fullName ?? null,
    scheduledStart: ct.scheduledStart ?? null,
    scheduledEnd: ct.scheduledEnd ?? null,
    actualStart: ct.actualStart?.toISOString() ?? null,
    actualEnd: ct.actualEnd?.toISOString() ?? null,
    progress: ct.progress ?? 0,
    status: ct.status,
    notes: ct.notes ?? null,
    createdById: ct.createdById,
    createdByName: createdBy?.fullName ?? null,
    createdAt: ct.createdAt?.toISOString(),
  };
}

// GET all — all non-inventory
router.get("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || !canView(currentUser)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const rows = await db.select().from(changeoverTasksTable).orderBy(changeoverTasksTable.date);
  const formatted = await Promise.all(rows.map(formatChangeover));
  res.json(formatted);
});

// POST create — admin/manager only
router.post("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || !canManage(currentUser)) {
    return res.status(403).json({ error: "Only admin or manager can create changeover tasks" });
  }

  const { date, lineId, fromModel, toModel, assignedToId, scheduledStart, scheduledEnd, notes } = req.body;
  if (!date || !lineId || !fromModel || !toModel || !assignedToId) {
    return res.status(400).json({ error: "date, lineId, fromModel, toModel, assignedToId are required" });
  }

  // Verify assignedTo is a team leader
  const [assignee] = await db.select().from(usersTable).where(eq(usersTable.id, assignedToId));
  if (!assignee || assignee.role !== "teamleader") {
    return res.status(400).json({ error: "Changeover tasks can only be assigned to team leaders" });
  }

  const [row] = await db.insert(changeoverTasksTable).values({
    date, lineId, fromModel, toModel, assignedToId, scheduledStart, scheduledEnd, notes,
    progress: 0, status: "pending", createdById: currentUser.id,
  } as any).returning();

  const line = lineId ? (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, lineId)))[0] : null;

  // Notify the team leader
  const msg = `New changeover task on ${line?.name ?? `Line ${lineId}`}: ${fromModel} → ${toModel} on ${date}`;
  await db.insert(notificationsTable).values({
    userId: assignedToId,
    title: "New Changeover Task",
    message: msg,
    type: "general",
    isRead: false,
    relatedId: row.id,
  });
  await sendPushToUser(assignedToId, "New Changeover Task", msg);

  await logAudit(currentUser, "create", "ChangeoverTask", row.id, `${line?.name ?? `Line ${lineId}`} — ${fromModel} → ${toModel}`, {
    date, fromModel, toModel, lineName: line?.name,
  });

  return res.status(201).json(await formatChangeover(row));
});

// PATCH /:id/start — team leader starts
router.patch("/:id/start", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(changeoverTasksTable).where(eq(changeoverTasksTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  if (currentUser.id !== existing.assignedToId && !canManage(currentUser)) {
    return res.status(403).json({ error: "Only the assigned team leader can start this changeover" });
  }
  if (existing.status !== "pending") {
    return res.status(400).json({ error: "Changeover already started or completed" });
  }

  const [row] = await db.update(changeoverTasksTable).set({
    status: "in_progress",
    actualStart: new Date(),
    progress: 0,
  } as any).where(eq(changeoverTasksTable.id, id)).returning();

  await logAudit(currentUser, "update", "ChangeoverTask", id, `Changeover #${id}`, { action: "started" });
  return res.json(await formatChangeover(row));
});

// PATCH /:id/progress — update progress 0-100
router.patch("/:id/progress", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(changeoverTasksTable).where(eq(changeoverTasksTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  if (currentUser.id !== existing.assignedToId && !canManage(currentUser)) {
    return res.status(403).json({ error: "Only the assigned team leader can update progress" });
  }

  const progress = Math.max(0, Math.min(100, parseInt(req.body.progress ?? 0)));
  const notes = req.body.notes;

  const updates: any = { progress };
  if (notes !== undefined) updates.notes = notes;

  const [row] = await db.update(changeoverTasksTable).set(updates).where(eq(changeoverTasksTable.id, id)).returning();
  await logAudit(currentUser, "update", "ChangeoverTask", id, `Changeover #${id}`, { progress });
  return res.json(await formatChangeover(row));
});

// PATCH /:id/complete — mark complete
router.patch("/:id/complete", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(changeoverTasksTable).where(eq(changeoverTasksTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  if (currentUser.id !== existing.assignedToId && !canManage(currentUser)) {
    return res.status(403).json({ error: "Only the assigned team leader can complete this changeover" });
  }

  const [row] = await db.update(changeoverTasksTable).set({
    status: "completed",
    actualEnd: new Date(),
    progress: 100,
  } as any).where(eq(changeoverTasksTable.id, id)).returning();

  await logAudit(currentUser, "update", "ChangeoverTask", id, `Changeover #${id}`, { action: "completed" });
  return res.json(await formatChangeover(row));
});

// PATCH /:id/cancel — admin/manager or assignee can cancel
router.patch("/:id/cancel", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(changeoverTasksTable).where(eq(changeoverTasksTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  if (!canManage(currentUser)) {
    return res.status(403).json({ error: "Only admin/manager can cancel a changeover" });
  }

  const [row] = await db.update(changeoverTasksTable).set({ status: "cancelled" } as any).where(eq(changeoverTasksTable.id, id)).returning();
  await logAudit(currentUser, "update", "ChangeoverTask", id, `Changeover #${id}`, { action: "cancelled" });
  return res.json(await formatChangeover(row));
});

// DELETE — admin/manager only
router.delete("/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || !canManage(currentUser)) {
    return res.status(403).json({ error: "Only admin/manager can delete changeover tasks" });
  }
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(changeoverTasksTable).where(eq(changeoverTasksTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  await db.delete(changeoverTasksTable).where(eq(changeoverTasksTable.id, id));
  await logAudit(currentUser, "delete", "ChangeoverTask", id, `Changeover #${id}`, {});
  return res.json({ success: true });
});

export default router;
