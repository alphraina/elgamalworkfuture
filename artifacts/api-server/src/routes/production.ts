import { Router } from "express";
import { db } from "@workspace/db";
import {
  productionRecordsTable,
  productionLinesTable,
  productionShiftSetupsTable,
  usersTable,
  notificationsTable,
  downtimeTable,
} from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCurrentUser } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";
import { sendPushToUser } from "../lib/push.js";

const router = Router();

const HOUR_TARGET = 200;

const LINE_DEFS = [
  ...([1,2,3,4,5,6,7,8].map(n => ({ name: `Line ${n}`, team: "assembly" }))),
  ...([1,2,3,4,5,6,7,8].map(n => ({ name: `Line ${n}`, team: "test" }))),
  ...([1,2,3,4,5,6,7,8].map(n => ({ name: `Line ${n}`, team: "packaging" }))),
];

async function ensureLines() {
  const existing = await db.select().from(productionLinesTable).orderBy(productionLinesTable.id);
  // Only seed the default lines when the table is completely empty (first-time setup).
  // Never auto-refill after lines have been manually deleted.
  if (existing.length > 0) return existing;
  await db.insert(productionLinesTable).values(
    LINE_DEFS.map(def => ({
      name: def.name,
      team: def.team,
      targetCapacityPerHour: HOUR_TARGET,
      minimumCapacityPerHour: HOUR_TARGET,
      isActive: true,
    }))
  );
  return db.select().from(productionLinesTable).orderBy(productionLinesTable.id);
}

async function formatRecord(r: typeof productionRecordsTable.$inferSelect) {
  const line = r.lineId ? (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, r.lineId)))[0] : null;
  const user = r.recordedById ? (await db.select().from(usersTable).where(eq(usersTable.id, r.recordedById)))[0] : null;
  return {
    id: r.id,
    lineId: r.lineId,
    lineName: line?.name ?? null,
    recordedAt: r.recordedAt?.toISOString(),
    hour: r.hour,
    actualCapacity: r.actualCapacity,
    targetCapacity: r.targetCapacity ?? line?.targetCapacityPerHour ?? null,
    belowLimit: r.belowLimit,
    reason: r.reason,
    recordedById: r.recordedById,
    recordedByName: user?.fullName ?? null,
    shift: r.shift,
    date: r.date,
    createdAt: r.createdAt?.toISOString(),
  };
}

function formatLine(l: typeof productionLinesTable.$inferSelect, responsibleUser?: typeof usersTable.$inferSelect | null) {
  return {
    id: l.id,
    name: l.name,
    description: l.description,
    targetCapacityPerHour: l.targetCapacityPerHour,
    minimumCapacityPerHour: l.minimumCapacityPerHour,
    responsibleUserId: l.responsibleUserId,
    responsibleUserName: responsibleUser?.fullName ?? null,
    isActive: l.isActive,
    team: l.team ?? null,
    createdAt: l.createdAt?.toISOString(),
  };
}

router.get("/lines", async (_req, res) => {
  const lines = await ensureLines();
  const formatted = await Promise.all(lines.map(async (l) => {
    const user = l.responsibleUserId ? (await db.select().from(usersTable).where(eq(usersTable.id, l.responsibleUserId)))[0] : null;
    return formatLine(l, user);
  }));
  res.json(formatted);
});

router.post("/lines", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const { name, description, targetCapacityPerHour, minimumCapacityPerHour, responsibleUserId } = req.body;
  if (!name || targetCapacityPerHour === undefined || minimumCapacityPerHour === undefined) {
    return res.status(400).json({ error: "Required fields missing" });
  }
  const [line] = await db.insert(productionLinesTable).values({
    name, description, targetCapacityPerHour, minimumCapacityPerHour, responsibleUserId, isActive: true,
  }).returning();

  await logAudit(currentUser, "create", "Production Line", line.id, name, {
    name, targetCapacityPerHour, minimumCapacityPerHour,
  });

  return res.status(201).json(formatLine(line));
});

router.put("/lines/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const id = parseInt(req.params.id);
  const { name, description, targetCapacityPerHour, minimumCapacityPerHour, responsibleUserId, isActive } = req.body;
  const updates: Partial<typeof productionLinesTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (targetCapacityPerHour !== undefined) updates.targetCapacityPerHour = targetCapacityPerHour;
  if (minimumCapacityPerHour !== undefined) updates.minimumCapacityPerHour = minimumCapacityPerHour;
  if (responsibleUserId !== undefined) updates.responsibleUserId = responsibleUserId;
  if (isActive !== undefined) updates.isActive = isActive;
  const [line] = await db.update(productionLinesTable).set(updates).where(eq(productionLinesTable.id, id)).returning();
  if (!line) return res.status(404).json({ error: "Not found" });

  await logAudit(currentUser, "update", "Production Line", id, line.name, {
    targetCapacityPerHour, minimumCapacityPerHour, isActive,
  });

  const user = line.responsibleUserId ? (await db.select().from(usersTable).where(eq(usersTable.id, line.responsibleUserId)))[0] : null;
  return res.json(formatLine(line, user));
});

router.delete("/lines/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const id = parseInt(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [line] = await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, id));
  if (!line) return res.status(404).json({ error: "Not found" });

  // Null-out references in production records so historical data is preserved
  await db.update(productionRecordsTable)
    .set({ lineId: null } as any)
    .where(eq(productionRecordsTable.lineId, id));

  await db.delete(productionLinesTable).where(eq(productionLinesTable.id, id));

  await logAudit(currentUser, "delete", "Production Line", id, line.name, { name: line.name });

  return res.json({ ok: true });
});

/* ───── Shift Setups ───── */

router.get("/shift-setups", async (req, res) => {
  const { date, shift } = req.query as { date?: string; shift?: string };
  const conditions = [];
  if (date) conditions.push(eq(productionShiftSetupsTable.date, date));
  if (shift) conditions.push(eq(productionShiftSetupsTable.shift, shift as any));

  const setups = conditions.length > 0
    ? await db.select().from(productionShiftSetupsTable).where(and(...conditions))
    : await db.select().from(productionShiftSetupsTable);

  const result = await Promise.all(setups.map(async (s) => {
    const assignedUser = s.assignedUserId
      ? (await db.select().from(usersTable).where(eq(usersTable.id, s.assignedUserId)))[0]
      : null;
    const line = s.lineId
      ? (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, s.lineId)))[0]
      : null;
    return {
      id: s.id,
      date: s.date,
      shift: s.shift,
      lineId: s.lineId,
      lineName: line?.name ?? null,
      assignedUserId: s.assignedUserId,
      assignedUserName: assignedUser?.fullName ?? null,
      assignedUserTeam: assignedUser?.team ?? null,
      totalCapacityTarget: s.totalCapacityTarget,
      productModel: s.productModel ?? null,
      createdById: s.createdById,
      createdAt: s.createdAt?.toISOString(),
    };
  }));
  return res.json(result);
});

router.post("/shift-setups", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const { date, shift, lineId, assignedUserId, totalCapacityTarget, productModel } = req.body;

  if (!date || !shift || !lineId) {
    return res.status(400).json({ error: "date, shift, lineId are required" });
  }

  const existing = await db.select().from(productionShiftSetupsTable)
    .where(and(
      eq(productionShiftSetupsTable.date, date),
      eq(productionShiftSetupsTable.shift, shift),
      eq(productionShiftSetupsTable.lineId, lineId),
    ));

  let setup;
  const action = existing[0] ? "update" : "create";
  if (existing[0]) {
    [setup] = await db.update(productionShiftSetupsTable)
      .set({ assignedUserId, totalCapacityTarget, productModel: productModel || null })
      .where(eq(productionShiftSetupsTable.id, existing[0].id))
      .returning();
  } else {
    [setup] = await db.insert(productionShiftSetupsTable).values({
      date, shift, lineId, assignedUserId, totalCapacityTarget, productModel: productModel || null, createdById: currentUser?.id,
    }).returning();
  }

  const assignedUser = setup.assignedUserId
    ? (await db.select().from(usersTable).where(eq(usersTable.id, setup.assignedUserId)))[0]
    : null;
  const line = (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, setup.lineId)))[0];

  await logAudit(currentUser, action, "Shift Setup", setup.id, `${line?.name ?? `Line ${lineId}`} — ${date} (${shift})`, {
    date, shift, lineName: line?.name, assignedTo: assignedUser?.fullName, totalCapacityTarget,
  });

  return res.status(201).json({
    id: setup.id,
    date: setup.date,
    shift: setup.shift,
    lineId: setup.lineId,
    lineName: line?.name ?? null,
    assignedUserId: setup.assignedUserId,
    assignedUserName: assignedUser?.fullName ?? null,
    totalCapacityTarget: setup.totalCapacityTarget,
    productModel: setup.productModel ?? null,
    createdById: setup.createdById,
    createdAt: setup.createdAt?.toISOString(),
  });
});

/* ───── Production Records ───── */

router.get("/report", async (req, res) => {
  const { date, shift } = req.query as { date?: string; shift?: string };
  const lines = await ensureLines();

  const report = await Promise.all(lines.map(async (line) => {
    const conditions = [eq(productionRecordsTable.lineId, line.id)];
    if (date) conditions.push(eq(productionRecordsTable.date, date));
    if (shift) conditions.push(eq(productionRecordsTable.shift, shift as any));

    const [totals] = await db.select({
      total: sql<number>`coalesce(sum(${productionRecordsTable.actualCapacity}),0)`,
      count: sql<number>`count(*)`,
    }).from(productionRecordsTable).where(and(...conditions));

    const dtConditions: any[] = [eq(downtimeTable.lineId, line.id)];
    if (date) dtConditions.push(sql`date(${downtimeTable.startTime}) = ${date}`);
    const [dtTotals] = await db.select({
      totalMinutes: sql<number>`coalesce(sum(${downtimeTable.durationMinutes}),0)`,
      incidents: sql<number>`count(*)`,
    }).from(downtimeTable).where(and(...dtConditions));

    return {
      lineId: line.id,
      lineName: line.name,
      totalPhones: Number(totals?.total ?? 0),
      hoursRecorded: Number(totals?.count ?? 0),
      totalDowntimeMinutes: Number(dtTotals?.totalMinutes ?? 0),
      downtimeIncidents: Number(dtTotals?.incidents ?? 0),
    };
  }));

  return res.json(report);
});

router.get("/", async (req, res) => {
  const { date, shift } = req.query as { date?: string; shift?: string };
  const conditions: any[] = [];
  if (date) conditions.push(eq(productionRecordsTable.date, date));
  if (shift) conditions.push(eq(productionRecordsTable.shift, shift as any));
  const records = conditions.length > 0
    ? await db.select().from(productionRecordsTable).where(and(...conditions)).orderBy(productionRecordsTable.recordedAt)
    : await db.select().from(productionRecordsTable).orderBy(productionRecordsTable.recordedAt);
  const formatted = await Promise.all(records.map(formatRecord));
  res.json(formatted);
});

router.post("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const { lineId, hour, actualCapacity, shift, reason, date } = req.body;

  if (!lineId || actualCapacity === undefined || !shift || !date || !currentUser || hour === undefined) {
    return res.status(400).json({ error: "Required fields missing" });
  }

  const [line] = await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, lineId));
  const belowLimit = actualCapacity < HOUR_TARGET;

  const [record] = await db.insert(productionRecordsTable).values({
    lineId,
    recordedAt: new Date(),
    hour,
    actualCapacity,
    targetCapacity: line?.targetCapacityPerHour ?? HOUR_TARGET,
    belowLimit,
    reason: reason || null,
    recordedById: currentUser.id,
    shift,
    date,
  }).returning();

  if (belowLimit) {
    const [setup] = await db.select().from(productionShiftSetupsTable).where(and(
      eq(productionShiftSetupsTable.date, date),
      eq(productionShiftSetupsTable.shift, shift),
      eq(productionShiftSetupsTable.lineId, lineId),
    ));
    const notifyUserId = setup?.assignedUserId ?? null;
    if (notifyUserId) {
      const prodTitle = `Below Target — ${line?.name ?? `Line ${lineId}`}`;
      const prodMsg = `Hour ${hour}: only ${actualCapacity} phones produced (target: ${HOUR_TARGET}). Please provide a reason.`;
      await db.insert(notificationsTable).values({
        userId: notifyUserId,
        title: prodTitle,
        message: prodMsg,
        type: "production",
        isRead: false,
        relatedId: record.id,
      });
      await sendPushToUser(notifyUserId, prodTitle, prodMsg);
    }
  }

  await logAudit(currentUser, "create", "Production Record", record.id, `${line?.name ?? `Line ${lineId}`} — Hour ${hour} (${date})`, {
    lineName: line?.name, date, shift, hour, actualCapacity,
    target: line?.targetCapacityPerHour ?? HOUR_TARGET, belowLimit, reason,
  });

  return res.status(201).json(await formatRecord(record));
});

router.put("/:id/reason", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const id = parseInt(req.params.id);
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: "Reason required" });
  const [record] = await db.update(productionRecordsTable)
    .set({ reason })
    .where(eq(productionRecordsTable.id, id))
    .returning();
  if (!record) return res.status(404).json({ error: "Not found" });

  const line = record.lineId ? (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, record.lineId)))[0] : null;
  await logAudit(currentUser, "update", "Production Record", id, `${line?.name ?? `Line ${id}`} — Hour ${record.hour} (${record.date})`, {
    reason, belowLimit: record.belowLimit, actualCapacity: record.actualCapacity,
  });

  return res.json(await formatRecord(record));
});

export default router;
