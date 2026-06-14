import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.session.userId))
    .orderBy(notificationsTable.createdAt);

  return res.json(notifications.map((n) => ({
    id: n.id,
    userId: n.userId,
    title: n.title,
    message: n.message,
    type: n.type,
    isRead: n.isRead,
    relatedId: n.relatedId,
    createdAt: n.createdAt?.toISOString(),
  })));
});

router.put("/:id/read", async (req, res) => {
  const id = parseInt(req.params.id);

  const [notification] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.session.userId!)))
    .returning();

  if (!notification) return res.status(404).json({ error: "Not found" });

  return res.json({
    id: notification.id,
    userId: notification.userId,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    isRead: notification.isRead,
    relatedId: notification.relatedId,
    createdAt: notification.createdAt?.toISOString(),
  });
});

export default router;
