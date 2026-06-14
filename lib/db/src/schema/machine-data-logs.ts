import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const machineDataLogsTable = pgTable("machine_data_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id"),
  machineRegistryId: integer("machine_registry_id"),
  lineId: integer("line_id"),
  stationNumber: integer("station_number"),
  machineName: text("machine_name").notNull(),
  machineCode: text("machine_code"),
  machineType: text("machine_type"),
  status: text("status").notNull(),
  passCount: integer("pass_count").default(0),
  failCount: integer("fail_count").default(0),
  totalCount: integer("total_count"),
  notes: text("notes"),
  sourceFile: text("source_file"),
  pushedAt: timestamp("pushed_at").defaultNow().notNull(),
  lotId: text("lot_id"),
  testTime: timestamp("test_time"),
  resultMsg: text("result_msg"),
  cycleTimeMs: integer("cycle_time_ms"),
  lineIdRaw: text("line_id_raw"),
});

export type MachineDataLog = typeof machineDataLogsTable.$inferSelect;
