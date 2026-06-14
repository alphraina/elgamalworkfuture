import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { trainingPlansTable } from "./training";

export const trainingExamsTable = pgTable("training_exams", {
  id: serial("id").primaryKey(),
  trainingId: integer("training_id").references(() => trainingPlansTable.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  examDate: text("exam_date").notNull(),
  examTime: text("exam_time").notNull(),
  location: text("location"),
  passingScore: integer("passing_score").notNull().default(60),
  team: text("team"),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const trainingExamResultsTable = pgTable("training_exam_results", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").references(() => trainingExamsTable.id).notNull(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  score: integer("score"),
  passed: boolean("passed"),
  notes: text("notes"),
  gradedById: integer("graded_by_id").references(() => usersTable.id),
  gradedAt: timestamp("graded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TrainingExam = typeof trainingExamsTable.$inferSelect;
export type TrainingExamResult = typeof trainingExamResultsTable.$inferSelect;
