import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const vacationStatusEnum = pgEnum("vacation_status", ["pending", "approved", "rejected", "cancelled"]);

export const vacationRequestsTable = pgTable("vacation_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  reason: text("reason").notNull(),
  status: vacationStatusEnum("status").notNull().default("pending"),
  managerApproved: boolean("manager_approved"),
  managerApprovedById: integer("manager_approved_by_id").references(() => usersTable.id),
  managerApprovedAt: timestamp("manager_approved_at"),
  teamLeaderApproved: boolean("team_leader_approved"),
  teamLeaderApprovedById: integer("team_leader_approved_by_id").references(() => usersTable.id),
  teamLeaderApprovedAt: timestamp("team_leader_approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVacationRequestSchema = createInsertSchema(vacationRequestsTable).omit({ id: true, createdAt: true });
export type InsertVacationRequest = z.infer<typeof insertVacationRequestSchema>;
export type VacationRequest = typeof vacationRequestsTable.$inferSelect;
