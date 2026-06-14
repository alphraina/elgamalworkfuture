import { pool } from "@workspace/db";

export const BACKUP_TABLES = [
  "users",
  "production_lines",
  "site_settings",
  "factory_config",
  "shift_settings",
  "kpi_settings",
  "inventory_items",
  "machine_registry",
  "machine_column_mappings",
  "work_phones",
  "announcements",
  "downtime_records",
  "attendance_records",
  "broken_machines",
  "vacation_requests",
  "tasks",
  "pm_plans",
  "sparepart_orders",
  "production_records",
  "production_shift_setups",
  "line_plans",
  "machine_notes",
  "machine_data_logs",
  "machine_temp_assignments",
  "training_plans",
  "training_participants",
  "training_exams",
  "training_exam_results",
  "defects",
  "changeover_tasks",
  "audit_logs",
  "notifications",
];

export async function generateBackupJson(): Promise<string> {
  const data: Record<string, unknown> = {
    __meta: {
      version: "1",
      createdAt: new Date().toISOString(),
      tables: BACKUP_TABLES,
      generator: "OPPO CMMS Backup v1",
    },
  };

  for (const table of BACKUP_TABLES) {
    try {
      const result = await pool.query(`SELECT * FROM "${table}" ORDER BY id`);
      data[table] = result.rows;
    } catch {
      data[table] = [];
    }
  }

  return JSON.stringify(data, null, 2);
}
