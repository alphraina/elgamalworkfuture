import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { productionLinesTable } from "./production-lines";

export const pmFrequencyEnum = pgEnum("pm_frequency", ["daily", "weekly", "monthly", "quarterly"]);
export const pmStatusEnum = pgEnum("pm_status", ["active", "completed", "overdue", "paused"]);
export const shiftEnum = pgEnum("shift", ["day", "night", "morning", "afternoon"]);

export const pmPlansTable = pgTable("pm_plans", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  machineName: text("machine_name").notNull(),
  lineId: integer("line_id").references(() => productionLinesTable.id),
  frequency: pmFrequencyEnum("frequency").notNull(),
  nextDueDate: timestamp("next_due_date").notNull(),
  lastCompletedDate: timestamp("last_completed_date"),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id),
  estimatedDurationMinutes: integer("estimated_duration_minutes"),
  status: pmStatusEnum("status").notNull().default("active"),
  shift: shiftEnum("shift"),
  emailNotification: boolean("email_notification").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPMPlanSchema = createInsertSchema(pmPlansTable).omit({ id: true, createdAt: true });
export type InsertPMPlan = z.infer<typeof insertPMPlanSchema>;
export type PMPlan = typeof pmPlansTable.$inferSelect;
