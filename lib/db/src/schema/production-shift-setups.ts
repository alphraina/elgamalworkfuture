import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { productionLinesTable } from "./production-lines";
import { shiftEnum } from "./preventive-maintenance";

export const productionShiftSetupsTable = pgTable("production_shift_setups", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  shift: shiftEnum("shift").notNull(),
  lineId: integer("line_id").references(() => productionLinesTable.id).notNull(),
  assignedUserId: integer("assigned_user_id").references(() => usersTable.id),
  totalCapacityTarget: integer("total_capacity_target"),
  productModel: text("product_model"),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductionShiftSetupSchema = createInsertSchema(productionShiftSetupsTable).omit({ id: true, createdAt: true });
export type InsertProductionShiftSetup = z.infer<typeof insertProductionShiftSetupSchema>;
export type ProductionShiftSetup = typeof productionShiftSetupsTable.$inferSelect;
