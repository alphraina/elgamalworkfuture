import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { productionLinesTable } from "./production-lines";

export const defectsTable = pgTable("defects", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  lineId: integer("line_id").references(() => productionLinesTable.id),
  date: text("date").notNull(),
  shift: text("shift"),
  reason: text("reason").notNull(),
  quantity: integer("quantity").notNull(),
  details: text("details"),
  reportedById: integer("reported_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Defect = typeof defectsTable.$inferSelect;
export type InsertDefect = typeof defectsTable.$inferInsert;
