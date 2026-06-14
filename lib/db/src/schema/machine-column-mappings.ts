import { pgTable, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const machineColumnMappingsTable = pgTable("machine_column_mappings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  mappings: jsonb("mappings").notNull().default({}),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type MachineColumnMappings = typeof machineColumnMappingsTable.$inferSelect;
