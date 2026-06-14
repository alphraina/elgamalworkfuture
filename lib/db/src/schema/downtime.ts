import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { productionLinesTable } from "./production-lines";

export const downtimeCategoryEnum = pgEnum("downtime_category", ["mechanical", "electrical", "software", "material", "other"]);
export const downtimeStatusEnum = pgEnum("downtime_status", ["ongoing", "resolved"]);

export const downtimeTable = pgTable("downtime_records", {
  id: serial("id").primaryKey(),
  machineName: text("machine_name").notNull(),
  machineCode: text("machine_code"),
  lineId: integer("line_id").references(() => productionLinesTable.id).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  durationMinutes: integer("duration_minutes"),
  reason: text("reason").notNull(),
  category: downtimeCategoryEnum("category").notNull(),
  recordedById: integer("recorded_by_id").references(() => usersTable.id),
  reporterName: text("reporter_name"),
  isPublicReport: boolean("is_public_report").notNull().default(false),
  status: downtimeStatusEnum("status").notNull().default("ongoing"),
  rootCause: text("root_cause"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDowntimeSchema = createInsertSchema(downtimeTable).omit({ id: true, createdAt: true });
export type InsertDowntime = z.infer<typeof insertDowntimeSchema>;
export type DowntimeRecord = typeof downtimeTable.$inferSelect;
