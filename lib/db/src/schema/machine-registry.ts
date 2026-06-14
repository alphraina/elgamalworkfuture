import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { productionLinesTable } from "./production-lines";

export const machineRegistryTable = pgTable("machine_registry", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  model: text("model"),
  location: text("location"),
  team: text("team"),
  lineId: integer("line_id").references(() => productionLinesTable.id),
  stationNumber: integer("station_number"),
  stationName: text("station_name"),
  machineType: text("machine_type"),
  machineToken: text("machine_token").unique(),
  machineIp: text("machine_ip"),
  heartbeatAt: timestamp("heartbeat_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const machineNotesTable = pgTable("machine_notes", {
  id: serial("id").primaryKey(),
  machineId: integer("machine_id").references(() => machineRegistryTable.id).notNull(),
  content: text("content").notNull(),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MachineRegistry = typeof machineRegistryTable.$inferSelect;
export type InsertMachineRegistry = typeof machineRegistryTable.$inferInsert;
export type MachineNote = typeof machineNotesTable.$inferSelect;
