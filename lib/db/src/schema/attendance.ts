import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { shiftEnum } from "./preventive-maintenance";

export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "late", "leave", "halfday"]);

export const attendanceTable = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  date: text("date").notNull(),
  checkIn: timestamp("check_in"),
  checkOut: timestamp("check_out"),
  shift: shiftEnum("shift").notNull(),
  status: attendanceStatusEnum("status").notNull().default("present"),
  notes: text("notes"),
  recordedById: integer("recorded_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type AttendanceRecord = typeof attendanceTable.$inferSelect;
