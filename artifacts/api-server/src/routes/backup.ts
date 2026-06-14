import { Router } from "express";
import { pool } from "@workspace/db";
import express from "express";
import { getCurrentUser } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";
import { BACKUP_TABLES, generateBackupJson } from "../lib/backup-util.js";

const router = Router();

// ── GET /api/backup — download full JSON backup ───────────────────────────────
router.get("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  try {
    const json = await generateBackupJson();
    const buf = Buffer.from(json, "utf-8");
    const date = new Date().toISOString().slice(0, 10);

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="cmms-backup-${date}.json"`);
    res.setHeader("Content-Length", buf.length);
    res.end(buf);

    try {
      logAudit(user, "backup_created", "system", "backup", "Full system backup downloaded", { tables: BACKUP_TABLES.length });
    } catch { /* non-fatal */ }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Backup failed", detail: msg });
  }
});

// ── GET /api/backup/meta — row counts only (fast, for UI) ────────────────────
router.get("/meta", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  const counts: Record<string, number> = {};
  for (const table of BACKUP_TABLES) {
    try {
      const r = await pool.query(`SELECT COUNT(*) AS c FROM "${table}"`);
      counts[table] = Number(r.rows[0]?.c ?? 0);
    } catch {
      counts[table] = 0;
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  res.json({ tables: counts, totalRows: total });
});

// ── GET /api/backup/auto/info — info about latest auto-backup ────────────────
router.get("/auto/info", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, created_at, size_bytes FROM auto_backups ORDER BY created_at DESC LIMIT 1`
    );
    if (!rows.length) {
      return res.json({ exists: false });
    }
    const row = rows[0];
    res.json({
      exists: true,
      createdAt: row.created_at,
      sizeBytes: Number(row.size_bytes),
      id: row.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed to fetch auto-backup info", detail: msg });
  }
});

// ── GET /api/backup/auto/download — download latest auto-backup ───────────────
router.get("/auto/download", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT created_at, data FROM auto_backups ORDER BY created_at DESC LIMIT 1`
    );
    if (!rows.length) {
      return res.status(404).json({ error: "No auto-backup found yet" });
    }
    const row = rows[0];
    const buf = Buffer.from(row.data, "utf-8");
    const date = new Date(row.created_at).toISOString().slice(0, 10);

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="cmms-auto-backup-${date}.json"`);
    res.setHeader("Content-Length", buf.length);
    res.end(buf);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed to download auto-backup", detail: msg });
  }
});

// ── POST /api/backup/restore — restore from uploaded backup JSON ──────────────
router.post(
  "/restore",
  express.json({ limit: "500mb" }),
  async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }

    const backup = req.body as Record<string, unknown>;

    if (!backup?.__meta) {
      return res.status(400).json({ error: "Invalid backup file — missing __meta block. Make sure you upload a file created by this system's backup feature." });
    }

    const meta = backup.__meta as Record<string, unknown>;
    if (meta.version !== "1") {
      return res.status(400).json({ error: `Unsupported backup version: ${meta.version}` });
    }

    await runRestore(backup, res, user);
  }
);

// ── POST /api/backup/auto/restore — restore from latest auto-backup ───────────
router.post("/auto/restore", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT data FROM auto_backups ORDER BY created_at DESC LIMIT 1`
    );
    if (!rows.length) {
      return res.status(404).json({ error: "No auto-backup found yet" });
    }
    const backup = JSON.parse(rows[0].data) as Record<string, unknown>;
    await runRestore(backup, res, user);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed to load auto-backup for restore", detail: msg });
  }
});

// ── Shared restore logic ──────────────────────────────────────────────────────
async function runRestore(
  backup: Record<string, unknown>,
  res: import("express").Response,
  user: { id: number; role: string } | null,
) {
  // Backward-compat aliases: old backups used wrong table names
  const TABLE_ALIASES: Record<string, string> = {
    "inventory_items": "inventory",
    "attendance_records": "attendance",
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("SET LOCAL session_replication_role = replica");

    const quotedNames = BACKUP_TABLES.map(t => `"${t}"`).join(", ");
    await client.query(`TRUNCATE TABLE ${quotedNames} RESTART IDENTITY CASCADE`);

    // Build a set of "table.column" keys for jsonb columns
    const { rows: colMeta } = await client.query<{ table_name: string; column_name: string; udt_name: string }>(
      `SELECT table_name, column_name, udt_name
       FROM information_schema.columns
       WHERE table_name = ANY($1)`,
      [BACKUP_TABLES],
    );
    const jsonbCols = new Set(
      colMeta.filter(r => r.udt_name === "jsonb").map(r => `${r.table_name}.${r.column_name}`),
    );

    function pgVal(v: unknown, tableColKey: string): unknown {
      if (v === null || v === undefined) return v;
      if (typeof v !== "object") return v;
      if (Array.isArray(v)) {
        return jsonbCols.has(tableColKey) ? JSON.stringify(v) : v;
      }
      return JSON.stringify(v);
    }

    let totalInserted = 0;
    for (const table of BACKUP_TABLES) {
      const rows = backup[table] ?? backup[TABLE_ALIASES[table] ?? ""];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const CHUNK = 300;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK) as Record<string, unknown>[];
        if (!chunk.length) continue;

        const cols = Object.keys(chunk[0]).map(c => `"${c}"`).join(", ");
        const colKeys = Object.keys(chunk[0]);
        const valueSets: string[] = [];
        const params: unknown[] = [];
        let p = 1;

        for (const row of chunk) {
          const vals = Object.values(row).map((v, i) => pgVal(v, `${table}.${colKeys[i]}`));
          valueSets.push(`(${vals.map(() => `$${p++}`).join(", ")})`);
          params.push(...vals);
        }

        try {
          await client.query(
            `INSERT INTO "${table}" (${cols}) VALUES ${valueSets.join(", ")}`,
            params,
          );
        } catch (insertErr) {
          const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
          throw new Error(`Table "${table}" (chunk ${i}–${i + chunk.length}): ${msg}`);
        }
        totalInserted += chunk.length;
      }
    }

    await client.query("COMMIT");

    for (const table of BACKUP_TABLES) {
      try {
        await pool.query(
          `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
        );
      } catch { /* no serial id */ }
    }

    try {
      logAudit(user, "backup_restored", "system", "backup", "Full system restore completed", { tables: BACKUP_TABLES.length, rows: totalInserted });
    } catch { /* non-fatal */ }

    res.json({ ok: true, tables: BACKUP_TABLES.length, rowsRestored: totalInserted });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Restore failed — all changes rolled back", detail: msg });
  } finally {
    client.release();
  }
}

export default router;
