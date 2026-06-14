import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { productionLinesTable } from "./production-lines";

export const severityEnum = pgEnum("severity", ["low", "medium", "high", "critical"]);
export const brokenMachineStatusEnum = pgEnum("broken_machine_status", ["reported", "in_progress", "resolved", "closed"]);

export const brokenMachinesTable = pgTable("broken_machines", {
  id: serial("id").primaryKey(),
  machineName: text("machine_name").notNull(),
  machineCode: text("machine_code"),
  lineId: integer("line_id").references(() => productionLinesTable.id).notNull(),
  reportedById: integer("reported_by_id").references(() => usersTable.id).notNull(),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id),
  problemDescription: text("problem_description").notNull(),
  severity: severityEnum("severity").notNull(),
  status: brokenMachineStatusEnum("status").notNull().default("reported"),
  reportedAt: timestamp("reported_at").notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  partsUsed: text("parts_used"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBrokenMachineSchema = createInsertSchema(brokenMachinesTable).omit({ id: true, createdAt: true });
export type InsertBrokenMachine = z.infer<typeof insertBrokenMachineSchema>;
export type BrokenMachine = typeof brokenMachinesTable.$inferSelect;
