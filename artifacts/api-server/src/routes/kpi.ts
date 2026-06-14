import { Router } from "express";
import { db } from "@workspace/db";
import { logAudit } from "../lib/audit.js";
import {
  usersTable,
  attendanceTable,
  tasksTable,
  downtimeTable,
  trainingPlansTable,
  trainingParticipantsTable,
  trainingExamsTable,
  trainingExamResultsTable,
  vacationRequestsTable,
  brokenMachinesTable,
  pmPlansTable,
  linePlansTable,
  kpiSettingsTable,
} from "@workspace/db/schema";
import { and, gte, lte, eq, or } from "drizzle-orm";
import { getCurrentUser, canCreatePlans } from "../lib/current-user.js";

const router = Router();

const DEFAULT_SETTINGS = {
  attWithExams: 0.30,
  tasksWithExams: 0.40,
  examsWeight: 0.15,
  attWithoutExams: 0.40,
  tasksWithoutExams: 0.60,
  repairWeight: 0.10,
  pmWeight: 0.10,
  linePlanWeight: 0.10,
  greenThreshold: 90,
  yellowThreshold: 70,
};

async function getSettings() {
  const rows = await db.select().from(kpiSettingsTable).limit(1);
  if (rows[0]) return rows[0];
  const [created] = await db.insert(kpiSettingsTable).values({}).returning();
  return created;
}

function getMonthRange(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const startStr = `${year}-${String(mon).padStart(2, "0")}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const endStr = `${year}-${String(mon).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const start = new Date(`${startStr}T00:00:00.000Z`);
  const end = new Date(`${endStr}T23:59:59.999Z`);
  return { start, end, startStr, endStr, lastDay };
}

function calcVacationDaysInMonth(startDate: string, endDate: string, monthStart: string, monthEnd: string): number {
  const s = new Date(Math.max(new Date(startDate).getTime(), new Date(monthStart).getTime()));
  const e = new Date(Math.min(new Date(endDate).getTime(), new Date(monthEnd).getTime()));
  if (s > e) return 0;
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function scoreColor(score: number | null, green: number, yellow: number): string {
  if (score === null) return "none";
  if (score >= green) return "green";
  if (score >= yellow) return "yellow";
  return "red";
}

/* ─── Settings routes ─── */

router.get("/settings", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
  if (!canCreatePlans(currentUser)) return res.status(403).json({ error: "Forbidden" });
  const settings = await getSettings();
  return res.json(settings);
});

router.put("/settings", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
  if (currentUser.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const {
    attWithExams, tasksWithExams, examsWeight,
    attWithoutExams, tasksWithoutExams,
    repairWeight, pmWeight, linePlanWeight,
    greenThreshold, yellowThreshold,
  } = req.body;

  const validate = (v: any, min: number, max: number) => {
    const n = Number(v);
    return !isNaN(n) && n >= min && n <= max ? n : null;
  };

  const updates: Partial<typeof kpiSettingsTable.$inferInsert> = {};
  if (attWithExams !== undefined) { const v = validate(attWithExams, 0, 1); if (v === null) return res.status(400).json({ error: "attWithExams must be 0-1" }); updates.attWithExams = v; }
  if (tasksWithExams !== undefined) { const v = validate(tasksWithExams, 0, 1); if (v === null) return res.status(400).json({ error: "tasksWithExams must be 0-1" }); updates.tasksWithExams = v; }
  if (examsWeight !== undefined) { const v = validate(examsWeight, 0, 1); if (v === null) return res.status(400).json({ error: "examsWeight must be 0-1" }); updates.examsWeight = v; }
  if (attWithoutExams !== undefined) { const v = validate(attWithoutExams, 0, 1); if (v === null) return res.status(400).json({ error: "attWithoutExams must be 0-1" }); updates.attWithoutExams = v; }
  if (tasksWithoutExams !== undefined) { const v = validate(tasksWithoutExams, 0, 1); if (v === null) return res.status(400).json({ error: "tasksWithoutExams must be 0-1" }); updates.tasksWithoutExams = v; }
  if (repairWeight !== undefined) { const v = validate(repairWeight, 0, 1); if (v === null) return res.status(400).json({ error: "repairWeight must be 0-1" }); updates.repairWeight = v; }
  if (pmWeight !== undefined) { const v = validate(pmWeight, 0, 1); if (v === null) return res.status(400).json({ error: "pmWeight must be 0-1" }); updates.pmWeight = v; }
  if (linePlanWeight !== undefined) { const v = validate(linePlanWeight, 0, 1); if (v === null) return res.status(400).json({ error: "linePlanWeight must be 0-1" }); updates.linePlanWeight = v; }
  if (greenThreshold !== undefined) { const v = validate(greenThreshold, 0, 100); if (v === null) return res.status(400).json({ error: "greenThreshold must be 0-100" }); updates.greenThreshold = Math.round(v); }
  if (yellowThreshold !== undefined) { const v = validate(yellowThreshold, 0, 100); if (v === null) return res.status(400).json({ error: "yellowThreshold must be 0-100" }); updates.yellowThreshold = Math.round(v); }

  updates.updatedAt = new Date();

  const existing = await db.select().from(kpiSettingsTable).limit(1);
  let result;
  if (existing[0]) {
    [result] = await db.update(kpiSettingsTable).set(updates).where(eq(kpiSettingsTable.id, existing[0].id)).returning();
  } else {
    [result] = await db.insert(kpiSettingsTable).values({ ...DEFAULT_SETTINGS, ...updates }).returning();
  }

  await logAudit(currentUser, "update", "KPI Settings", result.id, "KPI Weight & Threshold Settings", updates as Record<string, unknown>);

  return res.json(result);
});

/* ─── Main KPI report ─── */

router.get("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ error: "Unauthorized" });
  if (!canCreatePlans(currentUser)) return res.status(403).json({ error: "Forbidden" });

  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const { start, end, startStr, endStr } = getMonthRange(month);

  const settings = await getSettings();
  const W = {
    attWithExams: settings.attWithExams ?? DEFAULT_SETTINGS.attWithExams,
    tasksWithExams: settings.tasksWithExams ?? DEFAULT_SETTINGS.tasksWithExams,
    examsWeight: settings.examsWeight ?? DEFAULT_SETTINGS.examsWeight,
    attWithoutExams: settings.attWithoutExams ?? DEFAULT_SETTINGS.attWithoutExams,
    tasksWithoutExams: settings.tasksWithoutExams ?? DEFAULT_SETTINGS.tasksWithoutExams,
    repairWeight: settings.repairWeight ?? DEFAULT_SETTINGS.repairWeight,
    pmWeight: settings.pmWeight ?? DEFAULT_SETTINGS.pmWeight,
    linePlanWeight: settings.linePlanWeight ?? DEFAULT_SETTINGS.linePlanWeight,
    greenThreshold: settings.greenThreshold ?? DEFAULT_SETTINGS.greenThreshold,
    yellowThreshold: settings.yellowThreshold ?? DEFAULT_SETTINGS.yellowThreshold,
  };

  const [
    users, attendanceRecords, allTasks, downtimeRecords,
    trainings, trainingParts, vacations,
    brokenMachines, exams, examResults,
    pmPlans, linePlans,
  ] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.isActive, true)),
    db.select().from(attendanceTable).where(and(gte(attendanceTable.date, startStr), lte(attendanceTable.date, endStr))),
    db.select().from(tasksTable).where(and(gte(tasksTable.dueDate, start), lte(tasksTable.dueDate, end))),
    db.select().from(downtimeTable).where(and(gte(downtimeTable.startTime, start), lte(downtimeTable.startTime, end))),
    db.select().from(trainingPlansTable).where(and(gte(trainingPlansTable.scheduledDate, start), lte(trainingPlansTable.scheduledDate, end))),
    db.select().from(trainingParticipantsTable),
    db.select().from(vacationRequestsTable).where(
      and(
        eq(vacationRequestsTable.status, "approved"),
        lte(vacationRequestsTable.startDate, endStr),
        gte(vacationRequestsTable.endDate, startStr)
      )
    ),
    db.select().from(brokenMachinesTable).where(and(gte(brokenMachinesTable.reportedAt, start), lte(brokenMachinesTable.reportedAt, end))),
    db.select().from(trainingExamsTable).where(and(gte(trainingExamsTable.examDate, startStr), lte(trainingExamsTable.examDate, endStr))),
    db.select().from(trainingExamResultsTable),
    // PM plans: assigned to user in the month window (nextDueDate in range)
    db.select().from(pmPlansTable).where(and(gte(pmPlansTable.nextDueDate, start), lte(pmPlansTable.nextDueDate, end))),
    // Line plans in the month
    db.select().from(linePlansTable).where(and(gte(linePlansTable.date, startStr), lte(linePlansTable.date, endStr))),
  ]);

  const trainingIds = trainings.map(t => t.id);
  const relevantParts = trainingIds.length > 0 ? trainingParts.filter(p => trainingIds.includes(p.trainingId)) : [];

  const examIds = exams.map(e => e.id);
  const relevantExamResults = examIds.length > 0
    ? examResults.filter(r => examIds.includes(r.examId) && r.score !== null)
    : [];

  const now = new Date();

  const members = users.map(u => {
    const att = attendanceRecords.filter(a => a.userId === u.id);
    const present = att.filter(a => a.status === "present").length;
    const absent = att.filter(a => a.status === "absent").length;
    const late = att.filter(a => a.status === "late").length;
    const leave = att.filter(a => a.status === "leave").length;
    const halfday = att.filter(a => a.status === "halfday").length;
    const totalAtt = att.length;
    const workingDays = present + absent + late + halfday;
    const effectivePresent = present + halfday * 0.5;
    const attendanceScore = workingDays > 0 ? Math.round((effectivePresent / workingDays) * 100) : null;
    const punctualityScore = present + late > 0 ? Math.round((present / (present + late)) * 100) : null;

    const userTasks = allTasks.filter(t => t.assignedToId === u.id);
    const completedTasks = userTasks.filter(t => t.status === "completed").length;
    const pendingTasks = userTasks.filter(t => t.status === "pending").length;
    const inProgressTasks = userTasks.filter(t => t.status === "in_progress").length;
    const cancelledTasks = userTasks.filter(t => t.status === "cancelled").length;
    const overdueTasks = userTasks.filter(t =>
      t.dueDate && new Date(t.dueDate) < now && t.status !== "completed" && t.status !== "cancelled"
    ).length;
    const activeTasks = completedTasks + pendingTasks + inProgressTasks;
    const taskScore = activeTasks > 0 ? Math.round((completedTasks / activeTasks) * 100) : null;

    const userDowntime = downtimeRecords.filter(d => d.recordedById === u.id);
    const downtimeIncidents = userDowntime.length;
    const totalDowntimeMinutes = userDowntime.reduce((s, d) => s + (d.durationMinutes ?? 0), 0);

    const myTrainingIds = relevantParts.filter(p => p.userId === u.id).map(p => p.trainingId);
    const myTrainings = trainings.filter(t => myTrainingIds.includes(t.id));
    const trainingsCompleted = myTrainings.filter(t => t.status === "completed").length;
    const trainingsScheduled = myTrainings.filter(t => t.status === "scheduled").length;

    const myVacations = vacations.filter(v => v.userId === u.id);
    const vacationDays = myVacations.reduce(
      (s, v) => s + calcVacationDaysInMonth(v.startDate, v.endDate, startStr, endStr),
      0
    );

    // Broken machines: reported by user
    const reportedByMe = brokenMachines.filter(b => b.reportedById === u.id);
    const brokenReported = reportedByMe.length;
    const brokenResolved = reportedByMe.filter(b => b.status === "resolved" || b.status === "closed").length;
    const brokenInProgress = reportedByMe.filter(b => b.status === "in_progress").length;

    // Broken machines: assigned to user for repair
    const assignedToMe = brokenMachines.filter(b => b.assignedToId === u.id);
    const repairAssigned = assignedToMe.length;
    const repairCompleted = assignedToMe.filter(b => b.status === "resolved" || b.status === "closed").length;
    const repairInProgress = assignedToMe.filter(b => b.status === "in_progress").length;

    // Preventive maintenance assigned to user
    const myPM = pmPlans.filter(p => p.assignedToId === u.id);
    const pmTotal = myPM.length;
    const pmCompleted = myPM.filter(p => p.status === "completed").length;
    const pmOverdue = myPM.filter(p => p.status === "overdue").length;
    const pmActive = myPM.filter(p => p.status === "active").length;

    // Line plans assigned to user
    const myLinePlans = linePlans.filter(lp => lp.assignedToId === u.id);
    const linePlanTotal = myLinePlans.length;
    const linePlanCompleted = myLinePlans.filter(lp => lp.status === "completed").length;
    const linePlanPublished = myLinePlans.filter(lp => lp.status === "published").length;
    const linePlanDraft = myLinePlans.filter(lp => lp.status === "draft").length;

    // Exam performance
    const myExamResults = relevantExamResults.filter(r => r.userId === u.id);
    const examsTaken = myExamResults.length;
    const examsPassed = myExamResults.filter(r => r.passed).length;
    const examAvgScore = examsTaken > 0
      ? Math.round(myExamResults.reduce((s, r) => s + (r.score ?? 0), 0) / examsTaken)
      : null;

    // Derived rates for operational metrics (0-100)
    const repairRate = repairAssigned > 0 ? Math.round((repairCompleted / repairAssigned) * 100) : null;
    const pmRate = pmTotal > 0 ? Math.round((pmCompleted / pmTotal) * 100) : null;
    const linePlanRate = linePlanTotal > 0 ? Math.round((linePlanCompleted / linePlanTotal) * 100) : null;

    // Proportional normalisation: each component contributes weight/totalWeight to the score.
    // Operational metrics are part of the MAIN equation — not separate — but only apply
    // when the person has relevant data for them that month.
    const hasExams = examAvgScore !== null;
    const parts: { score: number; weight: number }[] = [];

    if (attendanceScore !== null) {
      parts.push({ score: attendanceScore, weight: hasExams ? W.attWithExams : W.attWithoutExams });
    }
    if (taskScore !== null) {
      parts.push({ score: taskScore, weight: hasExams ? W.tasksWithExams : W.tasksWithoutExams });
    }
    if (examAvgScore !== null) {
      parts.push({ score: examAvgScore, weight: W.examsWeight });
    }
    // Operational metrics — included in main equation whenever the person has data
    if (repairRate !== null && W.repairWeight > 0) {
      parts.push({ score: repairRate, weight: W.repairWeight });
    }
    if (pmRate !== null && W.pmWeight > 0) {
      parts.push({ score: pmRate, weight: W.pmWeight });
    }
    if (linePlanRate !== null && W.linePlanWeight > 0) {
      parts.push({ score: linePlanRate, weight: W.linePlanWeight });
    }

    const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
    const overallScore = parts.length > 0 && totalWeight > 0
      ? Math.round(parts.reduce((s, p) => s + p.score * p.weight, 0) / totalWeight)
      : null;

    return {
      userId: u.id,
      userName: u.fullName,
      workId: u.username,
      role: u.role,
      department: u.department ?? null,
      attendance: { present, absent, late, leave, halfday, totalDays: totalAtt, attendanceScore, punctualityScore },
      tasks: { completed: completedTasks, pending: pendingTasks, inProgress: inProgressTasks, cancelled: cancelledTasks, overdue: overdueTasks, total: userTasks.length, taskScore },
      downtime: { incidents: downtimeIncidents, totalMinutes: totalDowntimeMinutes },
      training: { completed: trainingsCompleted, scheduled: trainingsScheduled, total: myTrainings.length },
      vacation: { days: vacationDays, requests: myVacations.length },
      brokenMachines: {
        reported: brokenReported,
        resolved: brokenResolved,
        inProgress: brokenInProgress,
        repairAssigned,
        repairCompleted,
        repairInProgress,
      },
      pm: { total: pmTotal, completed: pmCompleted, overdue: pmOverdue, active: pmActive },
      linePlans: { total: linePlanTotal, completed: linePlanCompleted, published: linePlanPublished, draft: linePlanDraft },
      exams: { taken: examsTaken, passed: examsPassed, avgScore: examAvgScore },
      overallScore,
      scoreColor: scoreColor(overallScore, W.greenThreshold, W.yellowThreshold),
    };
  });

  const withScore = members.filter(m => m.overallScore !== null);
  const avgScore = withScore.length > 0
    ? Math.round(withScore.reduce((s, m) => s + (m.overallScore ?? 0), 0) / withScore.length)
    : null;

  res.json({ month, members, settings: W, summary: { totalMembers: members.length, avgScore } });
});

export default router;
