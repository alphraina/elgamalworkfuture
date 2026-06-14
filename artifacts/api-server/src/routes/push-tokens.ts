import { Router } from "express";
import { db } from "@workspace/db";
import { pushTokensTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

router.post("/", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { token, platform } = req.body;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "token is required" });
  }

  await db
    .insert(pushTokensTable)
    .values({
      userId: req.session.userId,
      token,
      platform: platform ?? "android",
    })
    .onConflictDoUpdate({
      target: pushTokensTable.token,
      set: {
        userId: req.session.userId,
        platform: platform ?? "android",
        updatedAt: new Date(),
      },
    });

  return res.json({ ok: true });
});

router.delete("/", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: "token is required" });
  }

  await db
    .delete(pushTokensTable)
    .where(
      and(
        eq(pushTokensTable.token, token),
        eq(pushTokensTable.userId, req.session.userId)
      )
    );

  return res.json({ ok: true });
});

export default router;
