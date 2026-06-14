import { Router } from "express";
import { db } from "@workspace/db";
import { linePlansTable, productionLinesTable, usersTable, notificationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, isMaintenance, isInventory, isAdmin } from "../lib/current-user.js";
import { sendPushToUser } from "../lib/push.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

function notInventory(user: any) {
  return user && user.role !== "inventory";
}

async function getTeamUserIds(team: string | null): Promise<number[]> {
  if (!team) return [];
  const members = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.team, team));
  return members.map(m => m.id);
}

async function formatHandover(lp: any) {
  const line = lp.lineId ? (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, lp.lineId)))[0] : null;
  const submittedBy = lp.createdById ? (await db.select().from(usersTable).where(eq(usersTable.id, lp.createdById)))[0] : null;
  const assignedTo = lp.assignedToId ? (await db.select().from(usersTable).where(eq(usersTable.id, lp.assignedToId)))[0] : null;
  const acknowledgedBy = lp.acknowledgedById ? (await db.select().from(usersTable).where(eq(usersTable.id, lp.acknowledgedById)))[0] : null;

  return {
    id: lp.id,
    date: lp.date,
    shift: lp.shift,
    lineId: lp.lineId,
    lineName: line?.name ?? null,
    submittedById: lp.createdById,
    submittedByName: submittedBy?.fullName ?? null,
    submittedByTeam: submittedBy?.team ?? null,
    assignedToId: lp.assignedToId,
    assignedToName: assignedTo?.fullName ?? null,
    assignedToTeam: assignedTo?.team ?? null,
    completedWork: lp.completedWork ?? null,
    tasks: lp.tasks ?? null,
    equipmentStatus: lp.equipmentStatus ?? null,
    notes: lp.notes ?? null,
    acknowledgedById: lp.acknowledgedById ?? null,
    acknowledgedByName: acknowledgedBy?.fullName ?? null,
    acknowledgedAt: lp.acknowledgedAt?.toISOString() ?? null,
    acknowledgeNotes: lp.acknowledgeNotes ?? null,
    status: lp.status,
    createdAt: lp.createdAt?.toISOString(),
    createdById: lp.createdById,
    createdByName: submittedBy?.fullName ?? null,
    createdByTeam: submittedBy?.team ?? null,
  };
}

// GET all handovers — open to all non-inventory
router.get("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || !notInventory(currentUser)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  let plans = await db.select().from(linePlansTable).orderBy(linePlansTable.date);

  // Maintenance workers only see their own handovers
  if (isMaintenance(currentUser)) {
    plans = plans.filter((p: any) => p.createdById === currentUser.id || p.assignedToId === currentUser.id);
  }

  const formatted = await Promise.all(plans.map(formatHandover));
  res.json(formatted);
});

// POST create handover — open to all non-inventory
router.post("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || !notInventory(currentUser)) {
    return res.status(403).json({ error: "Only non-inventory users can submit handovers" });
  }

  const { date, shift, lineId, assignedToId, completedWork, tasks, equipmentStatus, notes } = req.body;
  if (!date || !shift || !lineId) {
    return res.status(400).json({ error: "Date, shift, and line are required" });
  }

  const targetAssignedToId = assignedToId ?? currentUser.id;

  const [plan] = await db.insert(linePlansTable).values({
    date, shift, lineId, assignedToId: targetAssignedToId, createdById: currentUser.id,
    completedWork, tasks, equipmentStatus, notes,
    status: "draft",
  } as any).returning();

  const line = lineId ? (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, lineId)))[0] : null;
  await logAudit(currentUser, "create", "Handover", plan.id, `${line?.name ?? `Line ${lineId}`} — ${date} (${shift})`, {
    date, shift, lineName: line?.name, status: "submitted",
  });

  return res.status(201).json(await formatHandover(plan));
});

// PATCH acknowledge — records name + optional notes
router.patch("/:id/acknowledge", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || !notInventory(currentUser)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const id = parseInt(req.params.id);
  const { acknowledgeNotes } = req.body;

  const [existing] = await db.select().from(linePlansTable).where(eq(linePlansTable.id, id));
  if (!existing) return res.status(404).json({ error: "Handover not found" });
  if (existing.status !== "draft") return res.status(400).json({ error: "Handover already acknowledged" });

  const [plan] = await db.update(linePlansTable).set({
    status: "published",
    acknowledgedById: currentUser.id,
    acknowledgedAt: new Date(),
    acknowledgeNotes: acknowledgeNotes ?? null,
  } as any).where(eq(linePlansTable.id, id)).returning();

  if (!plan) return res.status(404).json({ error: "Not found" });

  // Notify the outgoing shift submitter
  if (plan.createdById && plan.createdById !== currentUser.id) {
    const line = plan.lineId ? (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, plan.lineId)))[0] : null;
    const msg = `${currentUser.fullName} acknowledged your handover for ${line?.name ?? "a line"} on ${plan.date} (${plan.shift} shift)`;
    await db.insert(notificationsTable).values({
      userId: plan.createdById,
      title: "Handover Acknowledged",
      message: msg,
      type: "general",
      isRead: false,
      relatedId: plan.id,
    });
    await sendPushToUser(plan.createdById, "Handover Acknowledged", msg);
  }

  await logAudit(currentUser, "update", "Handover", id, `Handover #${id}`, { action: "acknowledged", acknowledgeNotes });
  return res.json(await formatHandover(plan));
});

// PUT update / add more items — open to all non-inventory
router.put("/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || !notInventory(currentUser)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const id = parseInt(req.params.id);
  const { date, shift, lineId, assignedToId, completedWork, tasks, equipmentStatus, notes, status } = req.body;

  const [existing] = await db.select().from(linePlansTable).where(eq(linePlansTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  const updates: any = {};
  if (date !== undefined) updates.date = date;
  if (shift !== undefined) updates.shift = shift;
  if (lineId !== undefined) updates.lineId = lineId;
  if (assignedToId !== undefined) updates.assignedToId = assignedToId;
  if (completedWork !== undefined) updates.completedWork = completedWork;
  if (tasks !== undefined) updates.tasks = tasks;
  if (equipmentStatus !== undefined) updates.equipmentStatus = equipmentStatus;
  if (notes !== undefined) updates.notes = notes;
  if (status !== undefined) updates.status = status;

  const [plan] = await db.update(linePlansTable).set(updates).where(eq(linePlansTable.id, id)).returning();
  if (!plan) return res.status(404).json({ error: "Not found" });

  const line = plan.lineId ? (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, plan.lineId)))[0] : null;
  await logAudit(currentUser, "update", "Handover", id, `${line?.name ?? `Line ${id}`} — ${plan.date}`, {
    updatedBy: currentUser.fullName,
  });

  return res.json(await formatHandover(plan));
});

// DELETE — only the original submitter can delete their own handover
router.delete("/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || !notInventory(currentUser)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(linePlansTable).where(eq(linePlansTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  if (existing.createdById !== currentUser.id) {
    return res.status(403).json({ error: "Only the person who submitted this handover can delete it" });
  }

  await db.delete(linePlansTable).where(eq(linePlansTable.id, id));
  await logAudit(currentUser, "delete", "Handover", id, `Handover #${id}`, {});
  return res.json({ success: true });
});

export default router;
