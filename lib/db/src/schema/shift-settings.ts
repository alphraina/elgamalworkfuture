import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const shiftSettingsTable = pgTable("shift_settings", {
  id: serial("id").primaryKey(),
  shift: text("shift").notNull(),
  startTime: text("start_time").notNull().default("08:00"),
  endTime: text("end_time").notNull().default("16:00"),
  maxCheckInTime: text("max_check_in_time").notNull().default("09:00"),
  updatedById: integer("updated_by_id").references(() => usersTable.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ShiftSetting = typeof shiftSettingsTable.$inferSelect;
