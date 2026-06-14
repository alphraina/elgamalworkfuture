import { Router } from "express";
import { db } from "@workspace/db";
import { downtimeTable, productionLinesTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, isMaintenance, isStrictTeamLeader } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

async function getTeamUserIds(team: string | null): Promise<number[]> {
  if (!team) return [];
  const members = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.team, team));
  return members.map(m => m.id);
}

async function formatDowntime(d: typeof downtimeTable.$inferSelect) {
  const line = d.lineId ? (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, d.lineId)))[0] : null;
  const user = d.recordedById ? (await db.select().from(usersTable).where(eq(usersTable.id, d.recordedById)))[0] : null;

  let durationMinutes = d.durationMinutes;
  if (!durationMinutes && d.endTime && d.startTime) {
    durationMinutes = Math.round((d.endTime.getTime() - d.startTime.getTime()) / 60000);
  }

  return {
    id: d.id,
    machineName: d.machineName,
    machineCode: d.machineCode ?? null,
    lineId: d.lineId,
    lineName: line?.name ?? null,
    startTime: d.startTime?.toISOString(),
    endTime: d.endTime?.toISOString() ?? null,
    durationMinutes,
    reason: d.reason,
    rootCause: d.rootCause ?? null,
    category: d.category,
    recordedById: d.recordedById,
    recordedByName: user?.fullName ?? null,
    recordedByTeam: user?.team ?? null,
    isPublicReport: d.isPublicReport ?? false,
    reporterName: d.reporterName ?? null,
    status: d.status,
    notes: d.notes,
    createdAt: d.createdAt?.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  let records = await db.select().from(downtimeTable).orderBy(downtimeTable.createdAt);

  if (isStrictTeamLeader(currentUser)) {
    const teamIds = await getTeamUserIds(currentUser!.team ?? null);
    records = records.filter(r => r.isPublicReport || (r.recordedById != null && teamIds.includes(r.recordedById)));
  }

  const formatted = await Promise.all(records.map(formatDowntime));
  res.json(formatted);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const records = await db.select().from(downtimeTable).where(eq(downtimeTable.id, id));
  if (!records[0]) return res.status(404).json({ error: "Not found" });
  res.json(await formatDowntime(records[0]));
});

router.post("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const { machineName, machineCode, lineId, startTime, endTime, reason, rootCause, category, notes } = req.body;
  const recordedById = req.session.userId;

  if (!machineName || !machineCode || !lineId || !startTime || !reason || !rootCause || !category || !recordedById) {
    return res.status(400).json({ error: "Machine name, QR code, line, start time, description, root cause and category are all required" });
  }

  const isResolved = !!endTime;
  let durationMinutes: number | undefined;
  if (isResolved) {
    durationMinutes = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000);
  }

  const [record] = await db.insert(downtimeTable).values({
    machineName,
    machineCode: machineCode || null,
    lineId,
    startTime: new Date(startTime),
    endTime: isResolved ? new Date(endTime) : undefined,
    durationMinutes,
    reason,
    rootCause,
    category,
    notes,
    recordedById,
    status: isResolved ? "resolved" : "ongoing",
  }).returning();

  await logAudit(currentUser, "create", "Downtime", record.id, `${machineName} [${machineCode}]`, {
    machineName, machineCode, category, reason, rootCause, status: record.status,
  });

  return res.status(201).json(await formatDowntime(record));
});

router.put("/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (isMaintenance(currentUser)) {
    return res.status(403).json({ error: "Maintenance staff cannot edit downtime records" });
  }
  const id = parseInt(req.params.id);
  const { endTime, status, notes, reason, rootCause } = req.body;

  const [existing] = await db.select().from(downtimeTable).where(eq(downtimeTable.id, id));

  const updates: Partial<typeof downtimeTable.$inferInsert> = {};
  if (endTime) updates.endTime = new Date(endTime);
  if (status) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  if (reason !== undefined) updates.reason = reason;
  if (rootCause !== undefined) updates.rootCause = rootCause;

  if (endTime && existing?.startTime) {
    updates.durationMinutes = Math.round((new Date(endTime).getTime() - existing.startTime.getTime()) / 60000);
  }

  const [record] = await db.update(downtimeTable).set(updates).where(eq(downtimeTable.id, id)).returning();
  if (!record) return res.status(404).json({ error: "Not found" });

  const action = status === "resolved" ? "Resolved downtime" : "Updated downtime";
  await logAudit(currentUser, "update", "Downtime", id, `${record.machineName} [${(record as any).machineCode ?? ""}]`, {
    action, status: record.status, endTime: record.endTime?.toISOString(), notes,
  });

  return res.json(await formatDowntime(record));
});

export default router;
