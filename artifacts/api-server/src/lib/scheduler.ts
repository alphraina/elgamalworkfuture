import { db, pool } from "@workspace/db";
import { attendanceTable, usersTable, vacationRequestsTable } from "@workspace/db/schema";
import { eq, and, lte, gte, lt } from "drizzle-orm";
import { getShiftSettings } from "../routes/shift-settings.js";
import { logAudit } from "./audit.js";
import { generateBackupJson } from "./backup-util.js";

const processedKeys = new Set<string>(); // "YYYY-MM-DD:shift"

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function currentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

async function autoMarkAbsentForShift(date: string, shift: string, maxCheckInTime: string) {
  const key = `${date}:${shift}`;
  if (processedKeys.has(key)) return;

  const [maxH, maxM] = maxCheckInTime.split(":").map(Number);
  const triggerAt = maxH * 60 + maxM + 30;

  if (currentMinutes() < triggerAt) return;

  processedKeys.add(key);

  const [allUsers, existingRecords, approvedVacations] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.isActive, true)),
    db.select().from(attendanceTable).where(
      and(
        eq(attendanceTable.date, date),
        eq(attendanceTable.shift, shift as "day" | "night" | "morning" | "afternoon"),
      )
    ),
    db.select().from(vacationRequestsTable).where(
      and(
        eq(vacationRequestsTable.status, "approved"),
        lte(vacationRequestsTable.startDate, date),
        gte(vacationRequestsTable.endDate, date),
      )
    ),
  ]);

  const recordedUserIds = new Set(existingRecords.map(r => r.userId));
  const vacationUserIds = new Set(approvedVacations.map(v => v.userId));

  let markedAbsent = 0;
  let markedLeave = 0;

  for (const u of allUsers) {
    if (recordedUserIds.has(u.id)) continue;
    const status = vacationUserIds.has(u.id) ? "leave" : "absent";
    await db.insert(attendanceTable).values({
      userId: u.id,
      date,
      shift: shift as "day" | "night" | "morning" | "afternoon",
      status,
      notes: status === "absent"
        ? "Auto-marked absent (system)"
        : "Auto-leave (approved vacation)",
    });
    if (status === "absent") markedAbsent++;
    else markedLeave++;
  }

  if (markedAbsent + markedLeave > 0) {
    await logAudit(
      null,
      "create",
      "Attendance",
      null,
      `[Auto] ${date} · ${shift} shift — ${markedAbsent} absent, ${markedLeave} on leave`,
      { date, shift, markedAbsent, markedLeave, auto: true }
    );
    console.log(`[Scheduler] Auto-attendance ${date} ${shift}: ${markedAbsent} absent, ${markedLeave} leave`);
  }
}

async function runAutoAttendance() {
  try {
    const date = todayStr();
    const settings = await getShiftSettings();
    for (const [shift, cfg] of Object.entries(settings)) {
      await autoMarkAbsentForShift(date, shift, cfg.maxCheckInTime);
    }
  } catch (err) {
    console.error("[Scheduler] Auto-attendance error:", err);
  }
}

async function runCleanup() {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 3);
    const cutoffDate = cutoff.toISOString().split("T")[0];
    const deleted = await db.delete(attendanceTable).where(lt(attendanceTable.date, cutoffDate));
    console.log(`[Scheduler] Cleaned up attendance records older than ${cutoffDate}`, deleted);
  } catch (err) {
    console.error("[Scheduler] Cleanup error:", err);
  }
}

/* ── Daily auto-backup at midnight ── */
async function runAutoBackup() {
  try {
    console.log("[Scheduler] Starting daily auto-backup...");
    const json = await generateBackupJson();
    const sizeBytes = Buffer.byteLength(json, "utf-8");

    await pool.query(`DELETE FROM auto_backups`);
    await pool.query(
      `INSERT INTO auto_backups (data, size_bytes) VALUES ($1, $2)`,
      [json, String(sizeBytes)],
    );

    console.log(`[Scheduler] Auto-backup saved — ${(sizeBytes / 1024).toFixed(1)} KB`);
    await logAudit(
      null,
      "create",
      "AutoBackup",
      null,
      `[Auto] Daily backup saved (${(sizeBytes / 1024).toFixed(1)} KB)`,
      { auto: true, sizeBytes },
    );
  } catch (err) {
    console.error("[Scheduler] Auto-backup error:", err);
  }
}

/* ── Daily machine log reset at midnight ── */
async function runMachineLogReset() {
  try {
    const deleted = await pool.query(`DELETE FROM machine_data_logs`);
    console.log(`[Scheduler] Daily machine log reset — ${deleted.rowCount} records cleared`);
    await logAudit(
      null,
      "delete",
      "MachineDataLogs",
      null,
      "[Auto] Daily machine log reset at midnight",
      { auto: true, rowsDeleted: deleted.rowCount }
    );
  } catch (err) {
    console.error("[Scheduler] Machine log reset error:", err);
  }
}

function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

export function startScheduler() {
  console.log("[Scheduler] Starting — auto-attendance every 15 min, cleanup every 24 h, machine log reset + auto-backup daily at midnight");

  runAutoAttendance();
  runCleanup();
  runAutoBackup(); // Take an initial backup on startup

  setInterval(runAutoAttendance, 15 * 60 * 1000);
  setInterval(runCleanup, 24 * 60 * 60 * 1000);

  /* Schedule machine log reset + auto-backup to fire at midnight, then every 24 h */
  setTimeout(() => {
    runMachineLogReset();
    runAutoBackup();
    setInterval(() => {
      runMachineLogReset();
      runAutoBackup();
    }, 24 * 60 * 60 * 1000);
  }, msUntilMidnight());

  console.log(`[Scheduler] Machine log reset + auto-backup scheduled in ${Math.round(msUntilMidnight() / 60000)} min`);
}
