import { Router } from "express";
import { db } from "@workspace/db";
import { brokenMachinesTable, productionLinesTable, usersTable, notificationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, isMaintenance, isStrictTeamLeader } from "../lib/current-user.js";
import { sendPushToUser } from "../lib/push.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

async function getTeamUserIds(team: string | null): Promise<number[]> {
  if (!team) return [];
  const members = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.team, team));
  return members.map(m => m.id);
}

async function formatBrokenMachine(bm: typeof brokenMachinesTable.$inferSelect) {
  const line = bm.lineId ? (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, bm.lineId)))[0] : null;
  const reportedBy = bm.reportedById ? (await db.select().from(usersTable).where(eq(usersTable.id, bm.reportedById)))[0] : null;
  const assignedTo = bm.assignedToId ? (await db.select().from(usersTable).where(eq(usersTable.id, bm.assignedToId)))[0] : null;

  return {
    id: bm.id,
    machineName: bm.machineName,
    machineCode: bm.machineCode,
    lineId: bm.lineId,
    lineName: line?.name ?? null,
    reportedById: bm.reportedById,
    reportedByName: reportedBy?.fullName ?? null,
    reportedByTeam: reportedBy?.team ?? null,
    assignedToId: bm.assignedToId,
    assignedToName: assignedTo?.fullName ?? null,
    assignedToTeam: assignedTo?.team ?? null,
    problemDescription: bm.problemDescription,
    severity: bm.severity,
    status: bm.status,
    reportedAt: bm.reportedAt?.toISOString(),
    resolvedAt: bm.resolvedAt?.toISOString() ?? null,
    resolutionNotes: bm.resolutionNotes,
    partsUsed: bm.partsUsed,
    createdAt: bm.createdAt?.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  let records = await db.select().from(brokenMachinesTable).orderBy(brokenMachinesTable.reportedAt);

  if (isStrictTeamLeader(currentUser)) {
    const teamIds = await getTeamUserIds(currentUser!.team ?? null);
    records = records.filter(r => teamIds.includes(r.reportedById));
  }

  const formatted = await Promise.all(records.map(formatBrokenMachine));
  res.json(formatted);
});

router.post("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const { machineName, machineCode, lineId, problemDescription, severity, reportedAt, assignedToId } = req.body;
  const reportedById = req.session.userId;

  if (!machineName || !machineCode || !lineId || !problemDescription || !severity || !reportedById) {
    return res.status(400).json({ error: "Machine name, QR code, line, description and severity are all required" });
  }

  const [record] = await db.insert(brokenMachinesTable).values({
    machineName,
    machineCode,
    lineId,
    reportedById,
    assignedToId,
    problemDescription,
    severity,
    status: "reported",
    reportedAt: reportedAt ? new Date(reportedAt) : new Date(),
  }).returning();

  if (assignedToId) {
    const bmMsg = `You have been assigned to repair ${machineName}: ${problemDescription}`;
    await db.insert(notificationsTable).values({
      userId: assignedToId,
      title: "Machine Breakdown Assigned",
      message: bmMsg,
      type: "general",
      isRead: false,
      relatedId: record.id,
    });
    await sendPushToUser(assignedToId, "Machine Breakdown Assigned", bmMsg);
  }

  await logAudit(currentUser, "create", "Broken Machine", record.id, `${machineName} [${machineCode}]`, {
    machineName, machineCode, severity, problemDescription, status: "reported",
  });

  return res.status(201).json(await formatBrokenMachine(record));
});

router.put("/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const id = parseInt(req.params.id);

  const [existing] = await db.select().from(brokenMachinesTable).where(eq(brokenMachinesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  if (isMaintenance(currentUser)) {
    if (existing.reportedById !== currentUser!.id) {
      return res.status(403).json({ error: "You can only update records you reported" });
    }
    const { resolutionNotes, partsUsed } = req.body;
    if (!resolutionNotes) {
      return res.status(400).json({ error: "Root cause / resolution notes are required" });
    }
    const [record] = await db.update(brokenMachinesTable).set({
      status: "resolved",
      resolutionNotes,
      partsUsed,
      resolvedAt: new Date(),
    }).where(eq(brokenMachinesTable.id, id)).returning();

    await logAudit(currentUser, "update", "Broken Machine", id, `${existing.machineName} [${existing.machineCode}]`, {
      action: "Marked as repaired", resolutionNotes, partsUsed, status: "resolved",
    });

    return res.json(await formatBrokenMachine(record));
  }

  const { assignedToId, status, resolutionNotes, resolvedAt, partsUsed } = req.body;
  const updates: Partial<typeof brokenMachinesTable.$inferInsert> = {};
  if (assignedToId !== undefined) updates.assignedToId = assignedToId;
  if (status !== undefined) updates.status = status;
  if (resolutionNotes !== undefined) updates.resolutionNotes = resolutionNotes;
  if (resolvedAt !== undefined) updates.resolvedAt = new Date(resolvedAt);
  if (partsUsed !== undefined) updates.partsUsed = partsUsed;
  if (status === "resolved" && !resolvedAt) updates.resolvedAt = new Date();

  const [record] = await db.update(brokenMachinesTable).set(updates).where(eq(brokenMachinesTable.id, id)).returning();

  await logAudit(currentUser, "update", "Broken Machine", id, `${existing.machineName} [${existing.machineCode}]`, {
    status: record.status, assignedToId, resolutionNotes, partsUsed,
  });

  return res.json(await formatBrokenMachine(record));
});

export default router;
