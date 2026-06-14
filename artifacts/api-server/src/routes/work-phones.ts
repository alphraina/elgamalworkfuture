import { Router } from "express";
import { db } from "@workspace/db";
import { workPhonesTable, usersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

const CAN_MANAGE = ["admin", "manager", "teamleader", "inventory"];

function canManage(user: Awaited<ReturnType<typeof getCurrentUser>>): boolean {
  if (!user) return false;
  const all = [user.role, ...(user.extraRoles ?? [])];
  return CAN_MANAGE.some(r => all.includes(r));
}

async function format(wp: typeof workPhonesTable.$inferSelect) {
  const createdBy = wp.createdById
    ? (await db.select().from(usersTable).where(eq(usersTable.id, wp.createdById)))[0]
    : null;
  return {
    id: wp.id,
    workId: wp.workId,
    name: wp.name,
    phoneColor: wp.phoneColor ?? null,
    phoneNumber: wp.phoneNumber ?? null,
    pcbaNumber: wp.pcbaNumber ?? null,
    createdById: wp.createdById ?? null,
    createdByName: createdBy?.fullName ?? null,
    createdAt: wp.createdAt?.toISOString(),
    updatedAt: wp.updatedAt?.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const rows = await db.select().from(workPhonesTable).orderBy(desc(workPhonesTable.createdAt));
  const formatted = await Promise.all(rows.map(format));
  return res.json(formatted);
});

router.post("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!canManage(user)) return res.status(403).json({ error: "Forbidden" });

  const { workId, name, phoneColor, phoneNumber, pcbaNumber } = req.body;
  if (!workId || !name) return res.status(400).json({ error: "Work ID and Name are required" });

  const [record] = await db.insert(workPhonesTable).values({
    workId,
    name,
    phoneColor: phoneColor || null,
    phoneNumber: phoneNumber || null,
    pcbaNumber: pcbaNumber || null,
    createdById: user.id,
    updatedAt: new Date(),
  }).returning();

  await logAudit(user, "create", "Work Phone", record.id, `${name} [${workId}]`, { workId, name, phoneColor, phoneNumber, pcbaNumber });

  return res.status(201).json(await format(record));
});

router.put("/:id", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!canManage(user)) return res.status(403).json({ error: "Forbidden" });

  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(workPhonesTable).where(eq(workPhonesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { workId, name, phoneColor, phoneNumber, pcbaNumber } = req.body;
  if (!workId || !name) return res.status(400).json({ error: "Work ID and Name are required" });

  const [record] = await db.update(workPhonesTable).set({
    workId,
    name,
    phoneColor: phoneColor || null,
    phoneNumber: phoneNumber || null,
    pcbaNumber: pcbaNumber || null,
    updatedAt: new Date(),
  }).where(eq(workPhonesTable.id, id)).returning();

  await logAudit(user, "update", "Work Phone", id, `${name} [${workId}]`, { workId, name, phoneColor, phoneNumber, pcbaNumber });

  return res.json(await format(record));
});

router.post("/import", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!canManage(user)) return res.status(403).json({ error: "Forbidden" });

  const rows: { workId: string; name: string; phoneColor?: string; phoneNumber?: string; pcbaNumber?: string }[] = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "No rows provided" });

  const inserted: number[] = [];
  const skipped: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.workId?.trim() || !r.name?.trim()) { skipped.push(i + 1); continue; }
    await db.insert(workPhonesTable).values({
      workId: r.workId.trim(),
      name: r.name.trim(),
      phoneColor: r.phoneColor?.trim() || null,
      phoneNumber: r.phoneNumber?.trim() || null,
      pcbaNumber: r.pcbaNumber?.trim() || null,
      createdById: user.id,
      updatedAt: new Date(),
    });
    inserted.push(i + 1);
  }

  await logAudit(user, "create", "Work Phone", null, `Bulk import: ${inserted.length} records`, { inserted: inserted.length, skipped: skipped.length });

  return res.json({ inserted: inserted.length, skipped: skipped.length });
});

router.delete("/:id", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const all = [user.role, ...(user.extraRoles ?? [])];
  if (!["admin", "manager"].some(r => all.includes(r))) return res.status(403).json({ error: "Only admin or manager can delete" });

  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(workPhonesTable).where(eq(workPhonesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  await db.delete(workPhonesTable).where(eq(workPhonesTable.id, id));
  await logAudit(user, "delete", "Work Phone", id, `${existing.name} [${existing.workId}]`, {});

  return res.json({ success: true });
});

export default router;
