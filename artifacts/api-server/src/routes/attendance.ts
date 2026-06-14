import { Router } from "express";
import { db } from "@workspace/db";
import { attendanceTable, usersTable, vacationRequestsTable } from "@workspace/db/schema";
import { eq, and, lte, gte } from "drizzle-orm";
import { getCurrentUser, isMaintenance, isInventory, isManager, isTeamLeader, isAdmin } from "../lib/current-user.js";
import { getShiftSettings } from "./shift-settings.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

async function formatAttendance(a: typeof attendanceTable.$inferSelect) {
  const user = a.userId ? (await db.select().from(usersTable).where(eq(usersTable.id, a.userId)))[0] : null;
  return {
    id: a.id,
    userId: a.userId,
    userName: user?.fullName ?? null,
    userWorkId: user?.username ?? null,
    date: a.date,
    checkIn: a.checkIn?.toISOString() ?? null,
    checkOut: a.checkOut?.toISOString() ?? null,
    shift: a.shift,
    status: a.status,
    notes: a.notes,
    recordedById: a.recordedById,
    createdAt: a.createdAt?.toISOString(),
  };
}

function compareTime(checkInDate: Date, maxTimeStr: string): boolean {
  const [h, m] = maxTimeStr.split(":").map(Number);
  const maxMinutes = h * 60 + m;
  const checkInMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes();
  return checkInMinutes > maxMinutes;
}

async function hasApprovedVacation(userId: number, date: string): Promise<boolean> {
  const vacations = await db.select().from(vacationRequestsTable).where(
    and(
      eq(vacationRequestsTable.userId, userId),
      eq(vacationRequestsTable.status, "approved"),
      lte(vacationRequestsTable.startDate, date),
      gte(vacationRequestsTable.endDate, date),
    )
  );
  return vacations.length > 0;
}

router.get("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  let records = await db.select().from(attendanceTable).orderBy(attendanceTable.date);
  if (!isManager(currentUser) && !isTeamLeader(currentUser)) {
    records = records.filter((r) => r.userId === currentUser!.id);
  }
  const formatted = await Promise.all(records.map(formatAttendance));
  res.json(formatted);
});

router.post("/mark-absent", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || (!isAdmin(currentUser) && !isManager(currentUser) && !isTeamLeader(currentUser))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { date, shift } = req.body;
  if (!date || !shift) return res.status(400).json({ error: "date and shift are required" });

  const [allUsers, existingRecords, allVacations] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.isActive, true)),
    db.select().from(attendanceTable).where(eq(attendanceTable.date, date)),
    db.select().from(vacationRequestsTable).where(
      and(
        eq(vacationRequestsTable.status, "approved"),
        lte(vacationRequestsTable.startDate, date),
        gte(vacationRequestsTable.endDate, date),
      )
    ),
  ]);

  const recordedUserIds = new Set(existingRecords.map(r => r.userId));
  const vacationUserIds = new Set(allVacations.map(v => v.userId));

  let markedAbsent = 0;
  let markedLeave = 0;

  for (const u of allUsers) {
    if (recordedUserIds.has(u.id)) continue;
    const status = vacationUserIds.has(u.id) ? "leave" : "absent";
    await db.insert(attendanceTable).values({
      userId: u.id,
      date,
      shift: shift as "day" | "night",
      status,
      recordedById: currentUser.id,
      notes: status === "absent" ? "Auto-marked absent" : "On approved vacation",
    });
    if (status === "absent") markedAbsent++;
    else markedLeave++;
  }

  await logAudit(currentUser, "create", "Attendance", null, `Auto-mark absent — ${date} (${shift} shift)`, {
    date, shift, markedAbsent, markedLeave,
  });

  res.json({ success: true, markedAbsent, markedLeave });
});

router.post("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const canManage = isManager(currentUser) || isTeamLeader(currentUser) || isAdmin(currentUser);
  const isSelfOnly = !canManage;

  let { userId, date, checkIn, shift, status, notes } = req.body;

  if (isSelfOnly) {
    userId = currentUser!.id;
    status = "present";
    date = date || new Date().toISOString().split("T")[0];
  }

  if (!userId || !date || !shift) {
    return res.status(400).json({ error: "Required fields missing" });
  }

  // Prevent duplicates
  const [duplicate] = await db.select().from(attendanceTable)
    .where(and(eq(attendanceTable.userId, Number(userId)), eq(attendanceTable.date, date)));
  if (duplicate) {
    return res.status(409).json({ error: "Attendance already recorded for this date" });
  }

  // Block check-in if approved vacation exists for this date
  const onVacation = await hasApprovedVacation(Number(userId), date);
  if (onVacation) {
    if (isSelfOnly) {
      return res.status(403).json({
        error: "You have an approved vacation on this date. Check-in is not allowed.",
        code: "ON_VACATION",
      });
    }
    status = "leave";
    notes = (notes ? notes + " | " : "") + "On approved vacation";
  }

  // Determine check-in time
  const checkInDate = checkIn ? new Date(checkIn) : new Date();

  // Auto-detect "late"
  if (!onVacation && (status === "present" || (!isSelfOnly && !status))) {
    const settings = await getShiftSettings();
    const shiftSetting = settings[shift as string];
    if (shiftSetting && compareTime(checkInDate, shiftSetting.maxCheckInTime)) {
      status = "late";
    } else {
      status = status || "present";
    }
  }

  const [record] = await db.insert(attendanceTable).values({
    userId: Number(userId),
    date,
    checkIn: checkInDate,
    shift: shift as "day" | "night",
    status: status || "present",
    notes,
    recordedById: currentUser?.id,
  }).returning();

  // Resolve the employee name for the audit label
  const targetUser = Number(userId) === currentUser?.id
    ? currentUser
    : (await db.select().from(usersTable).where(eq(usersTable.id, Number(userId))))[0];

  const isSelfCheckIn = Number(userId) === currentUser?.id;
  await logAudit(
    currentUser,
    "create",
    "Attendance",
    record.id,
    `${(targetUser as any)?.fullName ?? String(userId)} — ${date} (${shift})`,
    {
      employee: (targetUser as any)?.fullName,
      date,
      shift,
      status: record.status,
      checkIn: checkInDate.toISOString(),
      selfCheckIn: isSelfCheckIn,
    }
  );

  return res.status(201).json(await formatAttendance(record));
});

router.put("/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!isManager(currentUser) && !isTeamLeader(currentUser) && !isAdmin(currentUser)) {
    return res.status(403).json({ error: "You cannot edit attendance records" });
  }
  const id = parseInt(req.params.id);
  const { checkIn, checkOut, status, notes } = req.body;

  const [existing] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, id));

  const updates: Partial<typeof attendanceTable.$inferInsert> = {};
  if (checkIn !== undefined) updates.checkIn = checkIn ? new Date(checkIn) : undefined;
  if (checkOut !== undefined) updates.checkOut = checkOut ? new Date(checkOut) : undefined;
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;

  const [record] = await db.update(attendanceTable).set(updates).where(eq(attendanceTable.id, id)).returning();
  if (!record) return res.status(404).json({ error: "Not found" });

  const targetUser = existing?.userId ? (await db.select().from(usersTable).where(eq(usersTable.id, existing.userId)))[0] : null;
  await logAudit(
    currentUser,
    "update",
    "Attendance",
    id,
    `${targetUser?.fullName ?? String(id)} — ${existing?.date ?? ""}`,
    { status, checkIn, checkOut, notes }
  );

  return res.json(await formatAttendance(record));
});

export default router;
