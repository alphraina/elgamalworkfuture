import { Router } from "express";
import { db } from "@workspace/db";
import { announcementsTable } from "@workspace/db/schema";
import { eq, and, or, isNull, gte } from "drizzle-orm";
import { getCurrentUser, canCreatePlans } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

router.get("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  try {
    const now = new Date();
    const rows = await db
      .select()
      .from(announcementsTable)
      .where(
        and(
          eq(announcementsTable.isActive, true),
          or(isNull(announcementsTable.expiresAt), gte(announcementsTable.expiresAt, now))
        )
      )
      .orderBy(announcementsTable.createdAt);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

router.post("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!canCreatePlans(user)) return res.status(403).json({ error: "Forbidden" });
  const { title, message, priority, expiresAt } = req.body;
  if (!title || !message) return res.status(400).json({ error: "title and message are required" });
  try {
    const [row] = await db.insert(announcementsTable).values({
      title, message, priority: priority ?? "info",
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdById: user.id,
    }).returning();
    await logAudit(user, "create", "Announcement", row.id, title, { title, message, priority: priority ?? "info" });
    res.status(201).json(row);
  } catch {
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

router.put("/:id", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!canCreatePlans(user)) return res.status(403).json({ error: "Forbidden" });
  const id = parseInt(req.params.id);
  const { title, message, priority, expiresAt, isActive } = req.body;
  try {
    const [row] = await db
      .update(announcementsTable)
      .set({
        ...(title !== undefined && { title }),
        ...(message !== undefined && { message }),
        ...(priority !== undefined && { priority }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      })
      .where(eq(announcementsTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    await logAudit(user, "update", "Announcement", id, row.title, { title, message, priority, isActive });
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to update announcement" });
  }
});

router.delete("/:id", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!canCreatePlans(user)) return res.status(403).json({ error: "Forbidden" });
  const id = parseInt(req.params.id);
  try {
    const [existing] = await db.select().from(announcementsTable).where(eq(announcementsTable.id, id));
    await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
    await logAudit(user, "delete", "Announcement", id, existing?.title ?? String(id), existing ? { title: existing.title, message: existing.message } : null);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete announcement" });
  }
});

export default router;
