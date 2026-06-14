import { Router } from "express";
import { db } from "@workspace/db";
import { pmPlansTable, productionLinesTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, isMaintenance, canCreatePlans, isStrictTeamLeader } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

function advanceNextDueDate(current: Date, frequency: string): Date {
  const d = new Date(current);
  switch (frequency) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
  }
  return d;
}

async function getTeamUserIds(team: string | null): Promise<number[]> {
  if (!team) return [];
  const members = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.team, team));
  return members.map(m => m.id);
}

async function formatPM(p: typeof pmPlansTable.$inferSelect) {
  const line = p.lineId ? (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, p.lineId)))[0] : null;
  const assignedTo = p.assignedToId ? (await db.select().from(usersTable).where(eq(usersTable.id, p.assignedToId)))[0] : null;

  return {
    id: p.id,
    title: p.title,
    description: p.description,
    machineName: p.machineName,
    lineId: p.lineId,
    lineName: line?.name ?? null,
    frequency: p.frequency,
    nextDueDate: p.nextDueDate?.toISOString(),
    lastCompletedDate: p.lastCompletedDate?.toISOString() ?? null,
    assignedToId: p.assignedToId,
    assignedToName: assignedTo?.fullName ?? null,
    assignedToTeam: assignedTo?.team ?? null,
    estimatedDurationMinutes: p.estimatedDurationMinutes,
    status: p.status,
    shift: p.shift,
    emailNotification: p.emailNotification,
    createdAt: p.createdAt?.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  let plans = await db.select().from(pmPlansTable).orderBy(pmPlansTable.nextDueDate);

  if (isMaintenance(currentUser)) {
    plans = plans.filter((p) => p.assignedToId === currentUser!.id);
  } else if (isStrictTeamLeader(currentUser)) {
    const teamIds = await getTeamUserIds(currentUser!.team ?? null);
    plans = plans.filter(p => !p.assignedToId || teamIds.includes(p.assignedToId));
  }

  const formatted = await Promise.all(plans.map(formatPM));
  res.json(formatted);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const plans = await db.select().from(pmPlansTable).where(eq(pmPlansTable.id, id));
  if (!plans[0]) return res.status(404).json({ error: "Not found" });
  res.json(await formatPM(plans[0]));
});

router.post("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!canCreatePlans(currentUser)) {
    return res.status(403).json({ error: "Only team leaders and managers can create PM plans" });
  }
  const { title, description, machineName, lineId, frequency, nextDueDate, assignedToId, estimatedDurationMinutes, shift, emailNotification } = req.body;

  if (!title || !machineName || !frequency || !nextDueDate) {
    return res.status(400).json({ error: "Required fields missing" });
  }

  const [plan] = await db.insert(pmPlansTable).values({
    title, description, machineName, lineId, frequency,
    nextDueDate: new Date(nextDueDate),
    assignedToId, estimatedDurationMinutes, shift,
    emailNotification: emailNotification ?? true,
    status: "active",
  }).returning();

  await logAudit(currentUser, "create", "PM Plan", plan.id, `${title} — ${machineName}`, {
    title, machineName, frequency, nextDueDate, shift, assignedToId,
  });

  return res.status(201).json(await formatPM(plan));
});

router.put("/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const id = parseInt(req.params.id);
  const { title, description, machineName, lineId, frequency, nextDueDate, assignedToId, estimatedDurationMinutes, status, shift, emailNotification, lastCompletedDate } = req.body;

  const [existing] = await db.select().from(pmPlansTable).where(eq(pmPlansTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  // Maintenance workers may only mark their own assigned task as complete/paused
  const isMarkingComplete = status === "completed" || status === "paused";
  const isAssigned = existing.assignedToId === currentUser?.id;
  if (!canCreatePlans(currentUser)) {
    if (isMaintenance(currentUser) && isMarkingComplete && isAssigned) {
      // allowed — they can only set status
    } else {
      return res.status(403).json({ error: "Only team leaders and managers can edit PM plans" });
    }
  }

  const updates: Partial<typeof pmPlansTable.$inferInsert> = {};

  if (!isMaintenance(currentUser) || !isMarkingComplete) {
    // Full edits for managers/team leaders
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (machineName !== undefined) updates.machineName = machineName;
    if (lineId !== undefined) updates.lineId = lineId;
    if (frequency !== undefined) updates.frequency = frequency;
    if (nextDueDate !== undefined) updates.nextDueDate = new Date(nextDueDate);
    if (assignedToId !== undefined) updates.assignedToId = assignedToId;
    if (estimatedDurationMinutes !== undefined) updates.estimatedDurationMinutes = estimatedDurationMinutes;
    if (shift !== undefined) updates.shift = shift;
    if (emailNotification !== undefined) updates.emailNotification = emailNotification;
    if (lastCompletedDate !== undefined) updates.lastCompletedDate = new Date(lastCompletedDate);
  }

  if (status !== undefined) {
    if (status === "completed") {
      // Auto-advance: record completion date and calculate next occurrence
      updates.lastCompletedDate = new Date();
      updates.nextDueDate = advanceNextDueDate(existing.nextDueDate, existing.frequency);
      updates.status = "active"; // reset to active for the next occurrence
    } else {
      updates.status = status;
      if (lastCompletedDate !== undefined) updates.lastCompletedDate = new Date(lastCompletedDate);
    }
  }

  const [plan] = await db.update(pmPlansTable).set(updates).where(eq(pmPlansTable.id, id)).returning();
  if (!plan) return res.status(404).json({ error: "Not found" });

  await logAudit(currentUser, "update", "PM Plan", id, `${plan.title} — ${plan.machineName}`, {
    previousStatus: existing?.status, status, frequency: plan.frequency,
    previousNextDue: existing.nextDueDate, newNextDue: plan.nextDueDate, assignedToId,
  });

  return res.json(await formatPM(plan));
});

router.delete("/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!canCreatePlans(currentUser)) {
    return res.status(403).json({ error: "Only team leaders and managers can delete PM plans" });
  }
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(pmPlansTable).where(eq(pmPlansTable.id, id));
  await db.delete(pmPlansTable).where(eq(pmPlansTable.id, id));

  await logAudit(currentUser, "delete", "PM Plan", id, existing ? `${existing.title} — ${existing.machineName}` : String(id), {
    title: existing?.title, machineName: existing?.machineName, frequency: existing?.frequency,
  });

  return res.json({ success: true, message: "Deleted" });
});

export default router;
