import { Router } from "express";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";
import { desc, and, gte, lte, eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "../lib/current-user.js";

const router = Router();

router.get("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role !== "admin") return res.status(403).json({ error: "Forbidden" });

  const { action, entity, userId, from, to, limit = "200", offset = "0" } = req.query as Record<string, string>;

  const conditions = [];
  if (action) conditions.push(eq(auditLogsTable.action, action));
  if (entity) conditions.push(eq(auditLogsTable.entity, entity));
  if (userId) conditions.push(eq(auditLogsTable.userId, Number(userId)));
  if (from) conditions.push(gte(auditLogsTable.createdAt, new Date(from)));
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(auditLogsTable.createdAt, toDate));
  }

  const rows = await db
    .select()
    .from(auditLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(Number(limit))
    .offset(Number(offset));

  res.json(rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userFullName: r.userFullName,
    userRole: r.userRole,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    entityLabel: r.entityLabel,
    changes: r.changes,
    createdAt: r.createdAt?.toISOString(),
  })));
});

// DELETE selected logs (admin only)
// Body: { ids: number[] } — specific IDs
// Body: { all: true }    — wipe entire table
router.delete("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role !== "admin") return res.status(403).json({ error: "Forbidden" });

  const { ids, all } = req.body as { ids?: number[]; all?: boolean };

  if (all === true) {
    await db.delete(auditLogsTable);
    return res.json({ success: true, deleted: "all" });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Provide ids array or all:true" });
  }

  await db.delete(auditLogsTable).where(inArray(auditLogsTable.id, ids));
  return res.json({ success: true, deleted: ids.length });
});

export default router;
