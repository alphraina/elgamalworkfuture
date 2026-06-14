import { pgTable, serial, integer, boolean, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { productionLinesTable } from "./production-lines";
import { shiftEnum } from "./preventive-maintenance";

export const productionRecordsTable = pgTable("production_records", {
  id: serial("id").primaryKey(),
  lineId: integer("line_id").references(() => productionLinesTable.id).notNull(),
  recordedAt: timestamp("recorded_at").notNull(),
  hour: integer("hour"),
  actualCapacity: integer("actual_capacity").notNull(),
  targetCapacity: integer("target_capacity"),
  belowLimit: boolean("below_limit").notNull().default(false),
  reason: text("reason"),
  recordedById: integer("recorded_by_id").references(() => usersTable.id).notNull(),
  shift: shiftEnum("shift").notNull(),
  date: text("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductionRecordSchema = createInsertSchema(productionRecordsTable).omit({ id: true, createdAt: true });
export type InsertProductionRecord = z.infer<typeof insertProductionRecordSchema>;
export type ProductionRecord = typeof productionRecordsTable.$inferSelect;
