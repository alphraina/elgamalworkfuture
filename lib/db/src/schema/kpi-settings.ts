import { pgTable, serial, real, integer, timestamp, text } from "drizzle-orm/pg-core";

export const kpiSettingsTable = pgTable("kpi_settings", {
  id: serial("id").primaryKey(),
  attWithExams: real("att_with_exams").notNull().default(0.30),
  punctualityWeight: real("punctuality_weight").notNull().default(0.15),
  tasksWithExams: real("tasks_with_exams").notNull().default(0.40),
  examsWeight: real("exams_weight").notNull().default(0.15),
  attWithoutExams: real("att_without_exams").notNull().default(0.35),
  tasksWithoutExams: real("tasks_without_exams").notNull().default(0.50),
  repairWeight: real("repair_weight").notNull().default(0.10),
  pmWeight: real("pm_weight").notNull().default(0),
  linePlanWeight: real("line_plan_weight").notNull().default(0),
  greenThreshold: integer("green_threshold").notNull().default(90),
  yellowThreshold: integer("yellow_threshold").notNull().default(70),
  machineRegistryRoles: text("machine_registry_roles").array().default(["admin", "manager"]),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type KpiSettings = typeof kpiSettingsTable.$inferSelect;
