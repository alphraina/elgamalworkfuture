import { Router } from "express";
import { db } from "@workspace/db";
import { trainingPlansTable, trainingParticipantsTable, usersTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getCurrentUser, isMaintenance, canCreatePlans } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

async function formatTraining(t: typeof trainingPlansTable.$inferSelect) {
  const participants = await db.select().from(trainingParticipantsTable).where(eq(trainingParticipantsTable.trainingId, t.id));
  const participantIds = participants.map((p) => p.userId);
  let participantNames: string[] = [];

  if (participantIds.length > 0) {
    const users = await db.select().from(usersTable).where(inArray(usersTable.id, participantIds));
    participantNames = users.map((u) => u.fullName);
  }

  const createdBy = t.createdById ? (await db.select().from(usersTable).where(eq(usersTable.id, t.createdById)))[0] : null;

  return {
    id: t.id,
    title: t.title,
    description: t.description,
    category: t.category,
    trainerName: t.trainerName,
    scheduledDate: t.scheduledDate?.toISOString(),
    scheduledTime: t.scheduledTime,
    durationMinutes: t.durationMinutes,
    location: t.location,
    team: t.team ?? null,
    status: t.status,
    participants: participantIds,
    participantNames,
    createdById: t.createdById,
    createdByName: createdBy?.fullName ?? null,
    createdAt: t.createdAt?.toISOString(),
  };
}

function isStrictTeamLeader(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return false;
  const all = [user.role, ...(user.extraRoles ?? [])];
  return all.includes("teamleader") && !all.includes("admin") && !all.includes("manager");
}

router.get("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  let plans = await db.select().from(trainingPlansTable).orderBy(trainingPlansTable.scheduledDate);

  if (isMaintenance(currentUser)) {
    const myParticipations = await db.select().from(trainingParticipantsTable)
      .where(eq(trainingParticipantsTable.userId, currentUser!.id));
    const myTrainingIds = new Set(myParticipations.map((p) => p.trainingId));
    plans = plans.filter((p) => myTrainingIds.has(p.id));
  } else if (isStrictTeamLeader(currentUser)) {
    const team = currentUser!.team;
    if (team) {
      plans = plans.filter(p => p.team === team || !p.team);
    }
  }

  const formatted = await Promise.all(plans.map(formatTraining));
  res.json(formatted);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const plans = await db.select().from(trainingPlansTable).where(eq(trainingPlansTable.id, id));
  if (!plans[0]) return res.status(404).json({ error: "Not found" });
  res.json(await formatTraining(plans[0]));
});

router.post("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!canCreatePlans(currentUser)) {
    return res.status(403).json({ error: "Only team leaders and managers can create training plans" });
  }
  const { title, description, category, trainerName, scheduledDate, scheduledTime, durationMinutes, location, team, participants } = req.body;

  if (!title || !scheduledDate) {
    return res.status(400).json({ error: "Required fields missing" });
  }

  // Team leaders auto-assign their team
  const resolvedTeam = isStrictTeamLeader(currentUser) ? (currentUser!.team ?? team ?? null) : (team ?? null);

  const [plan] = await db.insert(trainingPlansTable).values({
    title, description, category, trainerName,
    scheduledDate: new Date(scheduledDate),
    scheduledTime, durationMinutes, location,
    team: resolvedTeam,
    status: "scheduled",
    createdById: currentUser!.id,
  }).returning();

  if (participants && Array.isArray(participants) && participants.length > 0) {
    await db.insert(trainingParticipantsTable).values(
      participants.map((userId: number) => ({ trainingId: plan.id, userId }))
    );
  }

  await logAudit(currentUser, "create", "Training Plan", plan.id, title, {
    title, category, trainerName, scheduledDate, location, team: resolvedTeam,
    participantCount: participants?.length ?? 0,
  });

  return res.status(201).json(await formatTraining(plan));
});

router.put("/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!canCreatePlans(currentUser)) {
    return res.status(403).json({ error: "Only team leaders and managers can edit training plans" });
  }
  const id = parseInt(req.params.id);
  const { title, description, category, trainerName, scheduledDate, scheduledTime, durationMinutes, location, team, status, participants } = req.body;

  const [existing] = await db.select().from(trainingPlansTable).where(eq(trainingPlansTable.id, id));

  const updates: Partial<typeof trainingPlansTable.$inferInsert> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (category !== undefined) updates.category = category;
  if (trainerName !== undefined) updates.trainerName = trainerName;
  if (scheduledDate !== undefined) updates.scheduledDate = new Date(scheduledDate);
  if (scheduledTime !== undefined) updates.scheduledTime = scheduledTime;
  if (durationMinutes !== undefined) updates.durationMinutes = durationMinutes;
  if (location !== undefined) updates.location = location;
  if (team !== undefined && !isStrictTeamLeader(currentUser)) updates.team = team || null;
  if (status !== undefined) updates.status = status;

  const [plan] = await db.update(trainingPlansTable).set(updates).where(eq(trainingPlansTable.id, id)).returning();
  if (!plan) return res.status(404).json({ error: "Not found" });

  if (participants !== undefined && Array.isArray(participants)) {
    await db.delete(trainingParticipantsTable).where(eq(trainingParticipantsTable.trainingId, id));
    if (participants.length > 0) {
      await db.insert(trainingParticipantsTable).values(
        participants.map((userId: number) => ({ trainingId: id, userId }))
      );
    }
  }

  await logAudit(currentUser, "update", "Training Plan", id, plan.title, {
    previousStatus: existing?.status, status, title, scheduledDate, location, team,
    participantCount: participants?.length,
  });

  return res.json(await formatTraining(plan));
});

router.delete("/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!canCreatePlans(currentUser)) {
    return res.status(403).json({ error: "Only team leaders and managers can delete training plans" });
  }
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(trainingPlansTable).where(eq(trainingPlansTable.id, id));
  await db.delete(trainingParticipantsTable).where(eq(trainingParticipantsTable.trainingId, id));
  await db.delete(trainingPlansTable).where(eq(trainingPlansTable.id, id));

  await logAudit(currentUser, "delete", "Training Plan", id, existing?.title ?? String(id), {
    title: existing?.title, category: existing?.category, scheduledDate: existing?.scheduledDate,
  });

  return res.json({ success: true, message: "Deleted" });
});

export default router;
