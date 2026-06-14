import { Router } from "express";
import { db } from "@workspace/db";
import { siteSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

async function getSettings() {
  const rows = await db.select().from(siteSettingsTable);
  if (rows.length === 0) {
    const [created] = await db.insert(siteSettingsTable).values({ signupEnabled: false }).returning();
    return created;
  }
  return rows[0];
}

router.get("/", async (_req, res) => {
  const settings = await getSettings();
  res.json({
    signupEnabled: settings.signupEnabled,
    publicDowntimeEnabled: settings.publicDowntimeEnabled,
  });
});

router.put("/", async (req, res) => {
  const actor = await getCurrentUser(req);
  if (!actor || actor.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  const { signupEnabled, publicDowntimeEnabled } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof signupEnabled === "boolean") updates.signupEnabled = signupEnabled;
  if (typeof publicDowntimeEnabled === "boolean") updates.publicDowntimeEnabled = publicDowntimeEnabled;
  if (Object.keys(updates).length === 1) {
    return res.status(400).json({ error: "No valid fields to update" });
  }
  const settings = await getSettings();
  const [updated] = await db
    .update(siteSettingsTable)
    .set(updates as any)
    .where(eq(siteSettingsTable.id, settings.id))
    .returning();
  await logAudit(actor, "update", "Site Settings", null, "Global Site Settings", updates);
  res.json({
    signupEnabled: updated.signupEnabled,
    publicDowntimeEnabled: updated.publicDowntimeEnabled,
  });
});

export default router;
