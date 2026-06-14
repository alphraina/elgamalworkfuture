import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { productionLinesTable } from "./production-lines";
import { shiftEnum } from "./preventive-maintenance";

export const linePlanStatusEnum = pgEnum("line_plan_status", ["draft", "published", "completed"]);

export const linePlansTable = pgTable("line_plans", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  shift: shiftEnum("shift").notNull(),
  lineId: integer("line_id").references(() => productionLinesTable.id).notNull(),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id).notNull(),
  createdById: integer("created_by_id").references(() => usersTable.id).notNull(),
  completedWork: text("completed_work"),
  tasks: text("tasks"),
  equipmentStatus: text("equipment_status"),
  notes: text("notes"),
  acknowledgedById: integer("acknowledged_by_id").references(() => usersTable.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgeNotes: text("acknowledge_notes"),
  status: linePlanStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLinePlanSchema = createInsertSchema(linePlansTable).omit({ id: true, createdAt: true });
export type InsertLinePlan = z.infer<typeof insertLinePlanSchema>;
export type LinePlan = typeof linePlansTable.$inferSelect;
