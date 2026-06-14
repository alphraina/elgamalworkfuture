import { Router } from "express";
import { db } from "@workspace/db";
import {
  trainingExamsTable,
  trainingExamResultsTable,
  trainingParticipantsTable,
  trainingPlansTable,
  usersTable,
  notificationsTable,
} from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getCurrentUser, canCreatePlans, isAdmin, isStrictTeamLeader } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";
import { sendPushToUser } from "../lib/push.js";

const router = Router();

async function getTeamUserIds(team: string | null): Promise<number[]> {
  if (!team) return [];
  const members = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.team, team));
  return members.map(m => m.id);
}

async function enrichExam(exam: typeof trainingExamsTable.$inferSelect) {
  const [training] = await db.select().from(trainingPlansTable).where(eq(trainingPlansTable.id, exam.trainingId));
  const [creator] = exam.createdById
    ? await db.select().from(usersTable).where(eq(usersTable.id, exam.createdById))
    : [null];

  const results = await db.select().from(trainingExamResultsTable).where(eq(trainingExamResultsTable.examId, exam.id));
  const participants = await db.select().from(trainingParticipantsTable).where(eq(trainingParticipantsTable.trainingId, exam.trainingId));

  const participantUsers = participants.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, participants.map(p => p.userId)))
    : [];

  const enrichedResults = results.map(r => {
    const u = participantUsers.find(u => u.id === r.userId);
    return {
      ...r,
      userName: u?.fullName ?? null,
      userWorkId: u?.username ?? null,
      gradedAt: r.gradedAt?.toISOString() ?? null,
    };
  });

  const participantList = participantUsers.map(u => {
    const result = results.find(r => r.userId === u.id);
    return {
      userId: u.id,
      userName: u.fullName,
      userWorkId: u.username,
      role: u.role,
      team: u.team ?? null,
      department: u.department,
      result: result ? {
        id: result.id,
        score: result.score,
        passed: result.passed,
        notes: result.notes,
        gradedAt: result.gradedAt?.toISOString() ?? null,
      } : null,
    };
  });

  const graded = results.filter(r => r.score !== null).length;
  const passed = results.filter(r => r.passed).length;
  const avgScore = graded > 0
    ? Math.round(results.filter(r => r.score !== null).reduce((s, r) => s + (r.score ?? 0), 0) / graded)
    : null;

  return {
    id: exam.id,
    trainingId: exam.trainingId,
    trainingTitle: training?.title ?? null,
    title: exam.title,
    description: exam.description,
    examDate: exam.examDate,
    examTime: exam.examTime,
    location: exam.location,
    passingScore: exam.passingScore,
    team: exam.team ?? null,
    createdById: exam.createdById,
    createdByName: creator?.fullName ?? null,
    createdAt: exam.createdAt.toISOString(),
    participants: participantList,
    results: enrichedResults,
    stats: {
      totalParticipants: participantUsers.length,
      graded,
      passed,
      failed: graded - passed,
      avgScore,
    },
  };
}

// GET all exams
router.get("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ error: "Unauthorized" });

  let exams = await db.select().from(trainingExamsTable).orderBy(trainingExamsTable.examDate);

  if (isStrictTeamLeader(currentUser)) {
    exams = exams.filter(e => !e.team || e.team === currentUser.team);
  }

  if (!canCreatePlans(currentUser)) {
    const myParticipations = await db.select().from(trainingParticipantsTable)
      .where(eq(trainingParticipantsTable.userId, currentUser.id));
    const myTrainingIds = myParticipations.map(p => p.trainingId);
    const filtered = exams.filter(e => myTrainingIds.includes(e.trainingId));
    const enriched = await Promise.all(filtered.map(enrichExam));
    return res.json(enriched);
  }

  const enriched = await Promise.all(exams.map(enrichExam));
  res.json(enriched);
});

// POST create exam
router.post("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || !canCreatePlans(currentUser)) return res.status(403).json({ error: "Forbidden" });

  const { trainingId, title, description, examDate, examTime, location, passingScore, team, participantIds } = req.body;
  if (!trainingId || !title || !examDate || !examTime) {
    return res.status(400).json({ error: "trainingId, title, examDate, and examTime are required" });
  }

  const resolvedTeam = isStrictTeamLeader(currentUser)
    ? (currentUser.team ?? team ?? null)
    : (team || null);

  const [exam] = await db.insert(trainingExamsTable).values({
    trainingId: Number(trainingId),
    title,
    description,
    examDate,
    examTime,
    location,
    passingScore: passingScore ?? 60,
    team: resolvedTeam,
    createdById: currentUser.id,
  }).returning();

  // Use manually selected participants if provided, otherwise fall back to training participants
  let participantUserIds: number[] = [];
  if (Array.isArray(participantIds) && participantIds.length > 0) {
    participantUserIds = participantIds.map(Number);
  } else {
    const trainingParticipants = await db.select().from(trainingParticipantsTable)
      .where(eq(trainingParticipantsTable.trainingId, Number(trainingId)));
    participantUserIds = trainingParticipants.map(p => p.userId);
  }

  if (participantUserIds.length > 0) {
    await db.insert(trainingExamResultsTable).values(
      participantUserIds.map(uid => ({ examId: exam.id, userId: uid, gradedById: null }))
    );

    const [training] = await db.select().from(trainingPlansTable).where(eq(trainingPlansTable.id, Number(trainingId)));
    const examMsg = `You have an exam scheduled on ${examDate} at ${examTime}${location ? ` — Location: ${location}` : ""}. Related training: ${training?.title ?? "N/A"}. Passing score: ${passingScore ?? 60}%.`;
    await db.insert(notificationsTable).values(participantUserIds.map(uid => ({
      userId: uid,
      title: `Exam Scheduled: ${title}`,
      message: examMsg,
      type: "training" as const,
      relatedId: exam.id,
    })));
    for (const uid of participantUserIds) {
      await sendPushToUser(uid, `Exam Scheduled: ${title}`, examMsg);
    }
  }

  await logAudit(currentUser, "create", "Training Exam", exam.id, title, {
    trainingId, examDate, examTime, location, passingScore: passingScore ?? 60,
    team: resolvedTeam, participantCount: participantUserIds.length,
  });

  const enriched = await enrichExam(exam);
  res.status(201).json(enriched);
});

// PUT update exam
router.put("/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || !canCreatePlans(currentUser)) return res.status(403).json({ error: "Forbidden" });

  const id = parseInt(req.params.id);
  const { title, description, examDate, examTime, location, passingScore, team } = req.body;

  const [existing] = await db.select().from(trainingExamsTable).where(eq(trainingExamsTable.id, id));

  const updates: Partial<typeof trainingExamsTable.$inferInsert> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (examDate !== undefined) updates.examDate = examDate;
  if (examTime !== undefined) updates.examTime = examTime;
  if (location !== undefined) updates.location = location;
  if (passingScore !== undefined) updates.passingScore = passingScore;
  if (team !== undefined) updates.team = team || null;

  const [exam] = await db.update(trainingExamsTable).set(updates).where(eq(trainingExamsTable.id, id)).returning();
  if (!exam) return res.status(404).json({ error: "Exam not found" });

  if (examDate || examTime || location) {
    const participants = await db.select().from(trainingParticipantsTable)
      .where(eq(trainingParticipantsTable.trainingId, exam.trainingId));
    if (participants.length > 0) {
      const updMsg = `Exam details have been updated. New date: ${exam.examDate} at ${exam.examTime}${exam.location ? ` — Location: ${exam.location}` : ""}.`;
      await db.insert(notificationsTable).values(
        participants.map(p => ({
          userId: p.userId,
          title: `Exam Updated: ${exam.title}`,
          message: updMsg,
          type: "training" as const,
          relatedId: exam.id,
        }))
      );
      for (const p of participants) {
        await sendPushToUser(p.userId, `Exam Updated: ${exam.title}`, updMsg);
      }
    }
  }

  await logAudit(currentUser, "update", "Training Exam", id, exam.title, {
    previousDate: existing?.examDate, examDate, examTime, location, passingScore, team,
  });

  const enriched = await enrichExam(exam);
  res.json(enriched);
});

// DELETE exam
router.delete("/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || !canCreatePlans(currentUser)) return res.status(403).json({ error: "Forbidden" });

  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(trainingExamsTable).where(eq(trainingExamsTable.id, id));
  await db.delete(trainingExamResultsTable).where(eq(trainingExamResultsTable.examId, id));
  await db.delete(trainingExamsTable).where(eq(trainingExamsTable.id, id));

  await logAudit(currentUser, "delete", "Training Exam", id, existing?.title ?? String(id), {
    trainingId: existing?.trainingId, examDate: existing?.examDate,
  });

  res.json({ success: true });
});

// POST enter/update result for a participant
router.post("/:id/results", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser || !canCreatePlans(currentUser)) return res.status(403).json({ error: "Forbidden" });

  const examId = parseInt(req.params.id);
  const { userId, score, notes } = req.body;

  if (!userId || score === undefined || score === null) {
    return res.status(400).json({ error: "userId and score are required" });
  }

  const [exam] = await db.select().from(trainingExamsTable).where(eq(trainingExamsTable.id, examId));
  if (!exam) return res.status(404).json({ error: "Exam not found" });

  const passed = Number(score) >= exam.passingScore;

  const existing = await db.select().from(trainingExamResultsTable).where(
    and(eq(trainingExamResultsTable.examId, examId), eq(trainingExamResultsTable.userId, Number(userId)))
  );

  let result;
  if (existing.length > 0) {
    [result] = await db.update(trainingExamResultsTable)
      .set({ score: Number(score), passed, notes, gradedById: currentUser.id, gradedAt: new Date() })
      .where(and(eq(trainingExamResultsTable.examId, examId), eq(trainingExamResultsTable.userId, Number(userId))))
      .returning();
  } else {
    [result] = await db.insert(trainingExamResultsTable).values({
      examId,
      userId: Number(userId),
      score: Number(score),
      passed,
      notes,
      gradedById: currentUser.id,
      gradedAt: new Date(),
    }).returning();
  }

  const [gradedUser] = await db.select().from(usersTable).where(eq(usersTable.id, Number(userId)));
  if (gradedUser) {
    await db.insert(notificationsTable).values({
      userId: Number(userId),
      title: `Exam Result: ${exam.title}`,
      message: `Your result for "${exam.title}" has been recorded. Score: ${score}/100. Status: ${passed ? "PASSED ✓" : "FAILED ✗"} (Passing: ${exam.passingScore}%).${notes ? ` Notes: ${notes}` : ""}`,
      type: "training" as const,
      relatedId: examId,
    });
  }

  await logAudit(currentUser, "update", "Training Exam", examId, `Result — ${gradedUser?.fullName ?? String(userId)} in "${exam.title}"`, {
    student: gradedUser?.fullName, score, passed, passingScore: exam.passingScore, notes,
  });

  const enriched = await enrichExam(exam);
  res.json(enriched);
});

export default router;
