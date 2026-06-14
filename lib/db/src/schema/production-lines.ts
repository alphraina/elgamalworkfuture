import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const productionLinesTable = pgTable("production_lines", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  targetCapacityPerHour: integer("target_capacity_per_hour").notNull(),
  minimumCapacityPerHour: integer("minimum_capacity_per_hour").notNull(),
  responsibleUserId: integer("responsible_user_id").references(() => usersTable.id),
  isActive: boolean("is_active").notNull().default(true),
  team: text("team"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductionLineSchema = createInsertSchema(productionLinesTable).omit({ id: true, createdAt: true });
export type InsertProductionLine = z.infer<typeof insertProductionLineSchema>;
export type ProductionLine = typeof productionLinesTable.$inferSelect;
