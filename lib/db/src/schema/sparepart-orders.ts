import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { inventoryTable } from "./inventory";

export const orderStatusEnum = pgEnum("order_status", ["pending", "approved", "rejected", "fulfilled"]);

export const sparepartOrdersTable = pgTable("sparepart_orders", {
  id: serial("id").primaryKey(),
  inventoryItemId: integer("inventory_item_id").references(() => inventoryTable.id).notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(),
  status: orderStatusEnum("status").notNull().default("pending"),
  orderedById: integer("ordered_by_id").references(() => usersTable.id).notNull(),
  approvedById: integer("approved_by_id").references(() => usersTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSparepartOrderSchema = createInsertSchema(sparepartOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSparepartOrder = z.infer<typeof insertSparepartOrderSchema>;
export type SparepartOrder = typeof sparepartOrdersTable.$inferSelect;
