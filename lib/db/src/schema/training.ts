import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const trainingStatusEnum = pgEnum("training_status", ["scheduled", "completed", "cancelled"]);

export const trainingPlansTable = pgTable("training_plans", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  trainerName: text("trainer_name"),
  scheduledDate: timestamp("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time"),
  durationMinutes: integer("duration_minutes"),
  location: text("location"),
  team: text("team"),
  status: trainingStatusEnum("status").notNull().default("scheduled"),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const trainingParticipantsTable = pgTable("training_participants", {
  id: serial("id").primaryKey(),
  trainingId: integer("training_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTrainingPlanSchema = createInsertSchema(trainingPlansTable).omit({ id: true, createdAt: true });
export type InsertTrainingPlan = z.infer<typeof insertTrainingPlanSchema>;
export type TrainingPlan = typeof trainingPlansTable.$inferSelect;
