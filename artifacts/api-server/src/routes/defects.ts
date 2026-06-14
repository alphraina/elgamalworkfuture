import { Router } from "express";
import { db } from "@workspace/db";
import { defectsTable, productionLinesTable, usersTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUser } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function formatDefect(d: typeof defectsTable.$inferSelect) {
  const line = d.lineId
    ? (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, d.lineId)))[0]
    : null;
  const reporter = d.reportedById
    ? (await db.select().from(usersTable).where(eq(usersTable.id, d.reportedById)))[0]
    : null;
  return {
    id: d.id,
    lineId: d.lineId,
    lineName: line?.name ?? null,
    date: d.date,
    shift: d.shift,
    reason: d.reason,
    quantity: d.quantity,
    details: d.details,
    reportedById: d.reportedById,
    reportedByName: reporter?.fullName ?? null,
    createdAt: d.createdAt?.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { date, lineId } = req.query as Record<string, string>;
  const conditions: any[] = [];
  if (date) conditions.push(eq(defectsTable.date, date));
  if (lineId) conditions.push(eq(defectsTable.lineId, parseInt(lineId)));

  const rows = conditions.length
    ? await db.select().from(defectsTable).where(and(...conditions)).orderBy(desc(defectsTable.createdAt))
    : await db.select().from(defectsTable).orderBy(desc(defectsTable.createdAt));

  const formatted = await Promise.all(rows.map(formatDefect));
  res.json(formatted);
});

router.post("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { lineId, date, shift, reason, quantity, details } = req.body;
  if (!reason || quantity === undefined || quantity === null) {
    return res.status(400).json({ error: "reason and quantity are required" });
  }

  const [row] = await db.insert(defectsTable).values({
    lineId: lineId ? parseInt(lineId) : null,
    date: date ?? today(),
    shift: shift ?? null,
    reason: String(reason).trim(),
    quantity: parseInt(quantity),
    details: details ? String(details).trim() : null,
    reportedById: user.id,
  }).returning();

  await logAudit(user, "create", "Defect", row.id, String(reason), { lineId, quantity, date });
  res.status(201).json(await formatDefect(row));
});

router.patch("/:id", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id);
  const existing = (await db.select().from(defectsTable).where(eq(defectsTable.id, id)))[0];
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { lineId, date, shift, reason, quantity, details } = req.body;
  const [updated] = await db.update(defectsTable).set({
    ...(lineId !== undefined ? { lineId: lineId ? parseInt(lineId) : null } : {}),
    ...(date !== undefined ? { date } : {}),
    ...(shift !== undefined ? { shift } : {}),
    ...(reason !== undefined ? { reason: String(reason).trim() } : {}),
    ...(quantity !== undefined ? { quantity: parseInt(quantity) } : {}),
    ...(details !== undefined ? { details: details ? String(details).trim() : null } : {}),
  }).where(eq(defectsTable.id, id)).returning();

  await logAudit(user, "update", "Defect", id, reason ?? existing.reason, null);
  res.json(await formatDefect(updated));
});

router.delete("/:id", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !["admin", "manager"].includes(user.role ?? "")) {
    return res.status(403).json({ error: "Not allowed" });
  }

  const id = parseInt(req.params.id);
  await db.delete(defectsTable).where(eq(defectsTable.id, id));
  await logAudit(user, "delete", "Defect", id, "deleted", null);
  res.json({ ok: true });
});

export default router;
