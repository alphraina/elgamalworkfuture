import { pool } from "@workspace/db";

export interface TrackedError {
  method?: string;
  url?: string;
  statusCode?: number;
  errorType?: string;
  errorMessage: string;
  stackTrace?: string;
  requestBody?: string;
}

export async function trackError(e: TrackedError): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO system_errors (method, url, status_code, error_type, error_message, stack_trace, request_body)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        e.method ?? null,
        e.url ?? null,
        e.statusCode ?? 500,
        e.errorType ?? "Error",
        e.errorMessage.slice(0, 2000),
        e.stackTrace ? e.stackTrace.slice(0, 5000) : null,
        e.requestBody ? e.requestBody.slice(0, 1000) : null,
      ]
    );
  } catch {
    /* never let error tracking crash the app */
  }
}

export async function getRecentErrors(limitHours = 24, limitCount = 20) {
  try {
    const res = await pool.query(
      `SELECT id, created_at, method, url, status_code, error_type, error_message, stack_trace, resolved, auto_fixed, fix_description
       FROM system_errors
       WHERE created_at > NOW() - ($1 || ' hours')::INTERVAL
       ORDER BY created_at DESC
       LIMIT $2`,
      [limitHours, limitCount]
    );
    return res.rows;
  } catch {
    return [];
  }
}

export async function markErrorFixed(id: number, fixDescription: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE system_errors SET resolved = true, auto_fixed = true, fix_description = $2 WHERE id = $1`,
      [id, fixDescription]
    );
  } catch { /* non-fatal */ }
}

export async function markErrorResolved(id: number): Promise<void> {
  try {
    await pool.query(`UPDATE system_errors SET resolved = true WHERE id = $1`, [id]);
  } catch { /* non-fatal */ }
}
