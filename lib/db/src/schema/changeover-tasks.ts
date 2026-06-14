import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { productionLinesTable } from "./production-lines";

export const changeoverStatusEnum = pgEnum("changeover_status", ["pending", "in_progress", "completed", "cancelled"]);

export const changeoverTasksTable = pgTable("changeover_tasks", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  lineId: integer("line_id").references(() => productionLinesTable.id).notNull(),
  fromModel: text("from_model").notNull(),
  toModel: text("to_model").notNull(),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id).notNull(),
  scheduledStart: text("scheduled_start"),
  scheduledEnd: text("scheduled_end"),
  actualStart: timestamp("actual_start"),
  actualEnd: timestamp("actual_end"),
  progress: integer("progress").default(0).notNull(),
  status: changeoverStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => usersTable.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChangeoverTaskSchema = createInsertSchema(changeoverTasksTable).omit({ id: true, createdAt: true });
export type InsertChangeoverTask = z.infer<typeof insertChangeoverTaskSchema>;
export type ChangeoverTask = typeof changeoverTasksTable.$inferSelect;
