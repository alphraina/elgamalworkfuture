import { Router } from "express";
import { db } from "@workspace/db";
import { shiftSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, isAdmin } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

const DEFAULTS = [
  { shift: "day",   startTime: "08:00", endTime: "16:00", maxCheckInTime: "08:30" },
  { shift: "night", startTime: "23:00", endTime: "07:00", maxCheckInTime: "23:30" },
];

export async function getShiftSettings(): Promise<Record<string, { startTime: string; endTime: string; maxCheckInTime: string }>> {
  const rows = await db.select().from(shiftSettingsTable);
  const map: Record<string, { startTime: string; endTime: string; maxCheckInTime: string }> = {};
  for (const d of DEFAULTS) {
    const row = rows.find(r => r.shift === d.shift);
    map[d.shift] = {
      startTime:        row?.startTime        ?? d.startTime,
      endTime:          (row as any)?.endTime ?? d.endTime,
      maxCheckInTime:   row?.maxCheckInTime   ?? d.maxCheckInTime,
    };
  }
  return map;
}

/**
 * Returns the current active shift and the "shift date" (the date the shift started).
 * Night shift workers checking in between 00:00–06:59 are still on the previous day's night shift.
 *
 * Day shift:   08:00 – 15:59  → date = today
 * Night shift: 23:00 – 06:59  → date = today if hour ≥ 23, yesterday if hour < 7
 * Between shifts → nearest shift
 */
export function getCurrentShiftInfo(): { shift: "day" | "night"; shiftDate: string } {
  const now = new Date();
  const hour = now.getHours();

  const todayStr = now.toISOString().split("T")[0];
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().split("T")[0];

  // Night shift: 23:00–23:59 or 00:00–06:59
  if (hour >= 23 || hour < 7) {
    return { shift: "night", shiftDate: hour < 7 ? yesterday : todayStr };
  }

  // Day shift: 08:00–22:59 (covers the day + transition gap before night)
  return { shift: "day", shiftDate: todayStr };
}

router.get("/", async (_req, res) => {
  const settings = await getShiftSettings();
  res.json(settings);
});

router.get("/current", async (_req, res) => {
  res.json(getCurrentShiftInfo());
});

router.put("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || !isAdmin(currentUser)) {
    return res.status(403).json({ error: "Admin only" });
  }

  const { shift, startTime, endTime, maxCheckInTime } = req.body;

  if (!shift || !["day", "night"].includes(shift)) {
    return res.status(400).json({ error: "shift must be 'day' or 'night'" });
  }

  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timePattern.test(startTime) || !timePattern.test(maxCheckInTime)) {
    return res.status(400).json({ error: "Times must be in HH:MM format (24h)" });
  }
  if (endTime && !timePattern.test(endTime)) {
    return res.status(400).json({ error: "End time must be in HH:MM format (24h)" });
  }

  const existing = await db.select().from(shiftSettingsTable).where(eq(shiftSettingsTable.shift, shift));

  const payload: any = { startTime, maxCheckInTime, updatedById: currentUser.id, updatedAt: new Date() };
  if (endTime) payload.endTime = endTime;

  if (existing.length > 0) {
    await db.update(shiftSettingsTable).set(payload).where(eq(shiftSettingsTable.shift, shift));
  } else {
    await db.insert(shiftSettingsTable).values({ shift, ...payload });
  }

  await logAudit(currentUser, "update", "Shift Settings", null, `${shift} shift`, { shift, startTime, endTime, maxCheckInTime });

  const settings = await getShiftSettings();
  res.json(settings);
});

export default router;
