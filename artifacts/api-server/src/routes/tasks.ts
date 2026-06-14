import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, productionLinesTable, usersTable, notificationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, isMaintenance, isTeamLeader, canCreatePlans } from "../lib/current-user.js";
import { sendPushToUser } from "../lib/push.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

async function formatTask(t: typeof tasksTable.$inferSelect) {
  const assignedTo = t.assignedToId ? (await db.select().from(usersTable).where(eq(usersTable.id, t.assignedToId)))[0] : null;
  const assignedBy = t.assignedById ? (await db.select().from(usersTable).where(eq(usersTable.id, t.assignedById)))[0] : null;
  const line = t.lineId ? (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, t.lineId)))[0] : null;

  return {
    id: t.id,
    title: t.title,
    description: t.description,
    assignedToId: t.assignedToId,
    assignedToName: assignedTo?.fullName ?? null,
    assignedToTeam: assignedTo?.team ?? null,
    assignedById: t.assignedById,
    assignedByName: assignedBy?.fullName ?? null,
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    completionNote: t.completionNote ?? null,
    type: t.type,
    relatedMachine: t.relatedMachine,
    lineId: t.lineId,
    lineName: line?.name ?? null,
    createdAt: t.createdAt?.toISOString(),
  };
}

function isStrictTeamLeader(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return false;
  const all = [user.role, ...(user.extraRoles ?? [])];
  return all.includes("teamleader") && !all.includes("admin") && !all.includes("manager");
}

async function getTeamUserIds(team: string | null): Promise<number[]> {
  if (!team) return [];
  const members = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.team, team));
  return members.map(m => m.id);
}

router.get("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  let tasks = await db.select().from(tasksTable).orderBy(tasksTable.createdAt);

  if (isMaintenance(currentUser)) {
    tasks = tasks.filter((t) => t.assignedToId === currentUser!.id);
  } else if (isStrictTeamLeader(currentUser)) {
    const teamIds = await getTeamUserIds(currentUser!.team ?? null);
    tasks = tasks.filter((t) => teamIds.includes(t.assignedToId));
  }

  const formatted = await Promise.all(tasks.map(formatTask));
  res.json(formatted);
});

router.post("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!canCreatePlans(currentUser)) {
    return res.status(403).json({ error: "Only team leaders and managers can create tasks" });
  }
  const { title, description, assignedToId, priority, dueDate, type, relatedMachine, lineId } = req.body;
  const assignedById = req.session.userId;

  if (!title || !assignedToId || !priority || !type || !assignedById) {
    return res.status(400).json({ error: "Required fields missing" });
  }

  if (isStrictTeamLeader(currentUser)) {
    const teamIds = await getTeamUserIds(currentUser!.team ?? null);
    if (!teamIds.includes(Number(assignedToId))) {
      return res.status(403).json({ error: "You can only assign tasks to members of your team" });
    }
  }

  const [task] = await db.insert(tasksTable).values({
    title, description, assignedToId, assignedById, priority,
    status: "pending",
    dueDate: dueDate ? new Date(dueDate) : undefined,
    type, relatedMachine, lineId,
  }).returning();

  const assigner = (await db.select().from(usersTable).where(eq(usersTable.id, assignedById)))[0];
  const taskMsg = `You have been assigned a new task: "${title}" by ${assigner?.fullName ?? "Team Leader"}`;
  await db.insert(notificationsTable).values({
    userId: assignedToId,
    title: "New Task Assigned",
    message: taskMsg,
    type: "task",
    isRead: false,
    relatedId: task.id,
  });
  await sendPushToUser(assignedToId, "New Task Assigned", taskMsg);

  await logAudit(currentUser, "create", "Task", task.id, title, {
    title, priority, type, assignedToId, relatedMachine, lineId,
  });
  return res.status(201).json(await formatTask(task));
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const currentUser = await getCurrentUser(req);
  const { title, description, assignedToId, priority, status, dueDate, completedAt, completionNote } = req.body;

  if (currentUser) {
    const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
    if (existing && existing.assignedToId === currentUser.id) {
      const updates: Partial<typeof tasksTable.$inferInsert> = {};
      if (status !== undefined) updates.status = status;
      if (status === "completed") updates.completedAt = new Date();
      if (completionNote !== undefined) updates.completionNote = completionNote;
      const [task] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, id)).returning();
      await logAudit(currentUser, "update", "Task", id, existing.title ?? String(id), { status, completionNote });
      return res.json(await formatTask(task));
    }
  }

  if (!canCreatePlans(currentUser)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const updates: Partial<typeof tasksTable.$inferInsert> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (assignedToId !== undefined) updates.assignedToId = assignedToId;
  if (priority !== undefined) updates.priority = priority;
  if (status !== undefined) updates.status = status;
  if (dueDate !== undefined) updates.dueDate = new Date(dueDate);
  if (completedAt !== undefined) updates.completedAt = new Date(completedAt);
  if (status === "completed" && !completedAt) updates.completedAt = new Date();

  const [task] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, id)).returning();
  if (!task) return res.status(404).json({ error: "Not found" });
  await logAudit(currentUser, "update", "Task", id, task.title ?? String(id), { title, priority, status, assignedToId });
  return res.json(await formatTask(task));
});

router.delete("/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!canCreatePlans(currentUser)) {
    return res.status(403).json({ error: "Only team leaders and managers can delete tasks" });
  }
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  await db.delete(tasksTable).where(eq(tasksTable.id, id));
  await logAudit(currentUser, "delete", "Task", id, existing?.title ?? String(id), existing ? { title: existing.title, priority: existing.priority, status: existing.status } : null);
  return res.json({ success: true, message: "Deleted" });
});

export default router;
