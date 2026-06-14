import { Router } from "express";
import { db, pool } from "@workspace/db";
import {
  machineDataLogsTable,
  machineRegistryTable,
  machineColumnMappingsTable,
  productionLinesTable,
  productionShiftSetupsTable,
  downtimeTable,
  notificationsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getCurrentUser } from "../lib/current-user.js";
import { getMachineApiKey, getDowntimeFailThreshold } from "./factory-config.js";
import * as XLSX from "xlsx";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

/* ── CMMS target field names ── */
export const TARGET_FIELDS = [
  { key: "machineIp",  label: "Machine IP (matched to machine registry)" },
  { key: "status",     label: "Test Result (PASS / FAIL)" },
  { key: "lotId",      label: "Device / Lot Serial (LOT_ID)" },
  { key: "lineIdRaw",  label: "Line ID (raw, e.g. TAM30202)" },
  { key: "testTime",   label: "Test Date/Time" },
  { key: "resultMsg",  label: "Error / Result Message" },
  { key: "cycleTime",  label: "Cycle Time (ms or s)" },
  { key: "notes",      label: "Notes" },
];

/* ── Get column mapping ── */
async function getColumnMapping(): Promise<Record<string, string>> {
  const rows = await db.select().from(machineColumnMappingsTable).limit(1);
  return (rows[0]?.mappings as Record<string, string>) ?? {};
}

/* ── Apply column mapping to a raw row ── */
function applyMapping(rawRow: Record<string, any>, mapping: Record<string, string>): Record<string, any> {
  if (!mapping || Object.keys(mapping).length === 0) return rawRow;
  const mapped: Record<string, any> = { ...rawRow };
  for (const [targetField, sourceColumn] of Object.entries(mapping)) {
    if (sourceColumn && rawRow[sourceColumn] !== undefined) {
      mapped[targetField] = rawRow[sourceColumn];
    }
  }
  return mapped;
}

/* ── Normalize status ── */
function normalizeStatus(v: any): string {
  if (!v) return "unknown";
  const s = String(v).trim().toLowerCase();
  if (s === "pass" || s === "passed" || s === "ok" || s === "good") return "pass";
  if (s === "fail" || s === "failed" || s === "ng" || s === "bad") return "fail";
  if (s === "running" || s === "run") return "running";
  if (s === "stopped" || s === "stop") return "stopped";
  if (s === "idle") return "idle";
  return s;
}

function _int(v: any): number | null {
  if (v == null || v === "") return null;
  const n = parseInt(String(v));
  return isNaN(n) ? null : n;
}
function _float(v: any): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}
function _ts(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/* ── Auto-downtime: trigger if N consecutive same-error fails (N from factory config) ── */
async function checkAutoDowntime(
  machineRegistryId: number,
  resultMsg: string | null,
  lineId: number | null,
  machineName: string,
  threshold: number
): Promise<void> {
  if (!resultMsg || !machineRegistryId || !lineId) return;

  const lastN = await pool.query(
    `SELECT result_msg FROM machine_data_logs
     WHERE machine_registry_id = $1 AND status = 'fail'
       AND result_msg IS NOT NULL AND result_msg != ''
     ORDER BY pushed_at DESC LIMIT $2`,
    [machineRegistryId, threshold]
  );
  if (lastN.rows.length < threshold) return;

  const allSame = lastN.rows.every(
    (r: any) => r.result_msg?.trim().toLowerCase() === resultMsg.trim().toLowerCase()
  );
  if (!allSame) return;

  const recentDowntime = await pool.query(
    `SELECT id FROM downtime_records
     WHERE machine_name = $1 AND notes LIKE $2
       AND status = 'ongoing' AND start_time > NOW() - INTERVAL '2 hours' LIMIT 1`,
    [machineName, `%AUTO-DOWNTIME%`]
  );
  if (recentDowntime.rows.length > 0) return;

  const errorSnippet = resultMsg.trim().substring(0, 80);
  await pool.query(
    `INSERT INTO downtime_records
      (machine_name, line_id, start_time, reason, category, status, notes, is_public_report)
     VALUES ($1, $2, NOW(), $3, 'other', 'ongoing', $4, false)`,
    [machineName, lineId, `Repeated failure: ${errorSnippet}`, `AUTO-DOWNTIME | Error repeated ${threshold}× in a row: ${resultMsg}`]
  );

  const admins = await pool.query(`SELECT id FROM users WHERE role IN ('admin','manager') LIMIT 50`);
  if (admins.rows.length === 0) return;

  const vals = admins.rows.map((_: any, i: number) =>
    `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
  ).join(", ");
  await pool.query(
    `INSERT INTO notifications (user_id, title, message, type, is_read) VALUES ${vals}`,
    admins.rows.flatMap((r: any) => [
      r.id,
      `⚠️ Auto-Downtime: ${machineName}`,
      `Machine "${machineName}" failed ${threshold}× in a row: "${errorSnippet}". Downtime recorded automatically.`,
      "production",
      false,
    ])
  );
}

/* ═══════════════════════════════════════════════
   POST /api/machine-data
   Push machine readings (JSON or array).
   Auth: X-API-Key header OR session cookie.
   ═══════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════
   GET /api/machine-data/identify?ip=192.168.1.105
   Called by the OMTP pusher on startup.
   Looks up the PC's IP in machine_registry → gets lineId + lineName.
   Then fetches today's shift setup model for that line.
   Returns { found, lineId, lineName, model, machineName, machineCode }
   Auth: X-API-Key header (same machine API key)
   ══════════════════════════════════════════════════════════════════ */
router.get("/identify", async (req, res) => {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (apiKey) {
    const storedKey = await getMachineApiKey();
    if (!storedKey || apiKey !== storedKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }
  } else {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: "Missing X-API-Key or session" });
  }

  const ip    = (req.query.ip    as string | undefined)?.trim();
  const token = (req.query.token as string | undefined)?.trim();
  if (!ip && !token) return res.status(400).json({ error: "Missing ?token= or ?ip= parameter" });

  try {
    // 1. Look up machine — token takes priority over IP (more stable)
    const machines = await db
      .select({
        id: machineRegistryTable.id,
        code: machineRegistryTable.code,
        stationName: machineRegistryTable.stationName,
        lineId: machineRegistryTable.lineId,
        machineToken: machineRegistryTable.machineToken,
        machineIp: machineRegistryTable.machineIp,
      })
      .from(machineRegistryTable)
      .where(
        token
          ? and(eq(machineRegistryTable.machineToken, token), eq(machineRegistryTable.isActive, true))
          : and(eq(machineRegistryTable.machineIp, ip!),    eq(machineRegistryTable.isActive, true))
      )
      .limit(1);

    if (!machines.length) {
      const lookup = token ? `token ${token}` : `IP ${ip}`;
      return res.json({ found: false, token, ip, message: `No active machine with ${lookup} found in registry` });
    }

    const machine = machines[0];
    const lineId = machine.lineId;

    // 2. Get line name
    let lineName: string | null = null;
    if (lineId) {
      const lines = await db
        .select({ name: productionLinesTable.name })
        .from(productionLinesTable)
        .where(eq(productionLinesTable.id, lineId))
        .limit(1);
      lineName = lines[0]?.name ?? null;
    }

    // 3. Get latest product model for this line (last 48 h)
    let model: string | null = null;
    let modelShift: string | null = null;
    let modelDate: string | null = null;
    if (lineId) {
      const result = await pool.query<{ product_model: string; shift: string; date: string }>(
        `SELECT product_model, shift, date
         FROM production_shift_setups
         WHERE line_id = $1
           AND product_model IS NOT NULL
           AND product_model <> ''
           AND created_at >= NOW() - INTERVAL '48 hours'
         ORDER BY created_at DESC
         LIMIT 1`,
        [lineId]
      );
      if (result.rows.length) {
        model      = result.rows[0].product_model;
        modelShift = result.rows[0].shift;
        modelDate  = result.rows[0].date;
      }
    }

    return res.json({
      found: true,
      token: machine.machineToken,
      ip,
      lineId,
      lineName,
      model,
      modelShift,
      modelDate,
      machineName: machine.stationName,
      machineCode: machine.code,
    });
  } catch (err: any) {
    console.error("[identify]", err);
    return res.status(500).json({ error: "Internal error", detail: err?.message });
  }
});

/* ═══════════════════════════════════════════════
   POST /api/machine-data/heartbeat
   Python pusher calls this every 4 minutes to prove it is alive.
   Updates machine_registry.heartbeat_at without inserting any log rows.
   ═══════════════════════════════════════════════ */
router.post("/heartbeat", async (req, res) => {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (apiKey) {
    const storedKey = await getMachineApiKey();
    if (!storedKey || apiKey !== storedKey) return res.status(401).json({ error: "Invalid API key" });
  } else {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: "Missing X-API-Key or session" });
  }

  const { machineToken, machineIp } = req.body ?? {};
  if (!machineToken && !machineIp) return res.status(400).json({ error: "machineToken or machineIp required" });

  if (machineToken) {
    await pool.query(
      `UPDATE machine_registry SET heartbeat_at = NOW() WHERE machine_token = $1`,
      [String(machineToken).trim()]
    );
  } else {
    await pool.query(
      `UPDATE machine_registry SET heartbeat_at = NOW() WHERE machine_ip = $1`,
      [String(machineIp).trim()]
    );
  }

  return res.json({ ok: true });
});

router.post("/", async (req, res) => {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (apiKey) {
    const storedKey = await getMachineApiKey();
    if (!storedKey || apiKey !== storedKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }
  } else {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: "Missing X-API-Key or session" });
  }

  const payload = Array.isArray(req.body) ? req.body : [req.body];
  if (payload.length === 0) return res.status(400).json({ error: "Empty payload" });

  const mapping = await getColumnMapping();
  const rows: typeof machineDataLogsTable.$inferInsert[] = [];
  const autoDowntimeTargets: Array<{
    machineRegistryId: number; resultMsg: string | null; lineId: number | null; machineName: string;
  }> = [];

  for (const rawItem of payload) {
    const item = applyMapping(rawItem, mapping);

    let registeredMachine: typeof machineRegistryTable.$inferSelect | null = null;

    // 1. Prefer machine token (QR code) — stable across IP changes
    const machineToken = item.machineToken ?? item.machine_token;
    if (machineToken) {
      const rows2 = await db.select().from(machineRegistryTable)
        .where(and(eq(machineRegistryTable.machineToken, String(machineToken).trim()), eq(machineRegistryTable.isActive, true))).limit(1);
      registeredMachine = rows2[0] ?? null;
    }

    // 2. Fallback: match by IP
    if (!registeredMachine) {
      const machineIp = item.machineIp ?? item.machine_ip;
      if (machineIp) {
        const rows2 = await db.select().from(machineRegistryTable)
          .where(eq(machineRegistryTable.machineIp, String(machineIp).trim())).limit(1);
        registeredMachine = rows2[0] ?? null;
      }
    }

    const status = normalizeStatus(item.status ?? item.test_result ?? item.testResult ?? item.TEST_RESULT);
    const passCount = status === "pass" ? 1 : (status === "fail" ? 0 : (_int(item.pass_count ?? item.passCount) ?? 0));
    const failCount = status === "fail" ? 1 : (status === "pass" ? 0 : (_int(item.fail_count ?? item.failCount) ?? 0));

    const rawCycle = _float(item.cycleTime ?? item.cycle_time ?? item.CYCLETIME);
    const cycleTimeMs = rawCycle != null
      ? (rawCycle < 10000 ? Math.round(rawCycle * 1000) : Math.round(rawCycle))
      : null;

    const resultMsg = item.resultMsg ?? item.result_msg ?? item.RESULT_MSG ?? item.notes ?? null;

    // 3. Last resort: match by lineId + stationNumber from payload
    if (!registeredMachine) {
      const payloadLineId = _int(item.lineId ?? item.line_id);
      const payloadStation = _int(item.stationNumber ?? item.station_number);
      if (payloadLineId) {
        const fallbackRows = await db.select().from(machineRegistryTable)
          .where(
            and(
              eq(machineRegistryTable.lineId, payloadLineId),
              eq(machineRegistryTable.isActive, true),
              ...(payloadStation != null ? [eq(machineRegistryTable.stationNumber, payloadStation)] : [])
            )
          ).limit(1);
        registeredMachine = fallbackRows[0] ?? null;
      }
    }

    const row: typeof machineDataLogsTable.$inferInsert = {
      machineRegistryId: registeredMachine?.id ?? null,
      lineId: registeredMachine?.lineId ?? _int(item.lineId ?? item.line_id),
      stationNumber: registeredMachine?.stationNumber ?? _int(item.stationNumber ?? item.station_number),
      machineName: registeredMachine?.name ?? String(item.machine_name ?? item.machineName ?? item.MACHINE_NAME ?? "Unknown"),
      machineCode: registeredMachine?.code ?? item.machine_code ?? item.machineCode ?? null,
      machineType: registeredMachine?.machineType ?? item.machine_type ?? item.machineType ?? null,
      status,
      passCount,
      failCount,
      totalCount: _int(item.total_count ?? item.totalCount),
      notes: typeof resultMsg === "string" ? resultMsg : null,
      sourceFile: item.source_file ?? item.sourceFile ?? null,
      lotId: item.lotId ?? item.lot_id ?? item.LOT_ID ?? null,
      testTime: _ts(item.testTime ?? item.test_time ?? item.TEST_TIME),
      resultMsg: typeof resultMsg === "string" ? resultMsg : null,
      cycleTimeMs,
      lineIdRaw: item.lineIdRaw ?? item.line_id_raw ?? item.LINE_ID ?? null,
    };
    rows.push(row);

    if (registeredMachine && status === "fail") {
      autoDowntimeTargets.push({
        machineRegistryId: registeredMachine.id,
        resultMsg: row.resultMsg ?? null,
        lineId: row.lineId ?? null,
        machineName: row.machineName,
      });
    }
  }

  await db.insert(machineDataLogsTable).values(rows);

  /* ── Detect cross-line machines → create temp assignment ── */
  for (const item of payload) {
    const payloadLineId = _int((applyMapping(item, await getColumnMapping())).lineId ?? item.lineId ?? item.line_id);
    if (!payloadLineId) continue;

    const machineToken2 = item.machineToken ?? item.machine_token;
    const machineIp2    = item.machineIp   ?? item.machine_ip;

    let regId: number | null = null;
    let regLineId: number | null = null;

    if (machineToken2) {
      const r = await pool.query(
        `SELECT id, line_id FROM machine_registry WHERE machine_token = $1 AND is_active = true LIMIT 1`,
        [String(machineToken2).trim()]
      );
      if (r.rows.length) { regId = r.rows[0].id; regLineId = r.rows[0].line_id; }
    } else if (machineIp2) {
      const r = await pool.query(
        `SELECT id, line_id FROM machine_registry WHERE machine_ip = $1 AND is_active = true LIMIT 1`,
        [String(machineIp2).trim()]
      );
      if (r.rows.length) { regId = r.rows[0].id; regLineId = r.rows[0].line_id; }
    }

    if (regId && regLineId && payloadLineId !== regLineId) {
      const lineExists = await pool.query(
        `SELECT id FROM production_lines WHERE id = $1 AND is_active = true LIMIT 1`,
        [payloadLineId]
      );
      if (lineExists.rows.length) {
        await pool.query(
          `INSERT INTO machine_temp_assignments (machine_registry_id, temp_line_id)
           VALUES ($1, $2)
           ON CONFLICT (machine_registry_id, temp_line_id) DO NOTHING`,
          [regId, payloadLineId]
        );
        console.log(`[TempMachine] Machine #${regId} detected on temp line ${payloadLineId} (registered: ${regLineId})`);
      }
    }
  }

  if (autoDowntimeTargets.length > 0) {
    const threshold = await getDowntimeFailThreshold();
    const seen = new Set<number>();
    for (const t of autoDowntimeTargets) {
      if (!seen.has(t.machineRegistryId)) {
        seen.add(t.machineRegistryId);
        await checkAutoDowntime(t.machineRegistryId, t.resultMsg, t.lineId, t.machineName, threshold);
      }
    }
  }

  return res.json({ ok: true, inserted: rows.length });
});

/* ═══════════════════════════════════════════════
   GET /api/machine-data
   Latest snapshot per machine with line/station info.
   ═══════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const lineId = req.query.lineId ? Number(req.query.lineId) : null;
  const lineFilter = lineId ? `AND m.line_id = ${lineId}` : "";

  const rows = await pool.query(`
    SELECT DISTINCT ON (COALESCE(m.machine_registry_id::text, 'unreg_' || m.machine_name || '_' || COALESCE(m.line_id::text,'0')))
      m.id, m.machine_registry_id,
      COALESCE(mr.name, m.machine_name) AS machine_name,
      m.machine_code, m.machine_type,
      m.status, m.pass_count, m.fail_count, m.total_count, m.notes, m.source_file,
      m.pushed_at, m.line_id, m.station_number, m.lot_id, m.test_time,
      m.result_msg, m.cycle_time_ms, m.line_id_raw,
      pl.name AS line_name, mr.station_name
    FROM machine_data_logs m
    LEFT JOIN production_lines pl ON pl.id = m.line_id
    LEFT JOIN machine_registry mr ON mr.id = m.machine_registry_id
    WHERE 1=1 ${lineFilter}
    ORDER BY COALESCE(m.machine_registry_id::text, 'unreg_' || m.machine_name || '_' || COALESCE(m.line_id::text,'0')), m.pushed_at DESC
  `);

  return res.json(rows.rows.map((r: any) => ({
    id: r.id,
    machineRegistryId: r.machine_registry_id,
    machineName: r.machine_name,
    machineCode: r.machine_code,
    machineType: r.machine_type,
    status: r.status,
    passCount: r.pass_count ?? 0,
    failCount: r.fail_count ?? 0,
    totalCount: r.total_count,
    notes: r.notes,
    sourceFile: r.source_file,
    pushedAt: r.pushed_at?.toISOString(),
    lineId: r.line_id,
    lineName: r.line_name,
    stationNumber: r.station_number,
    stationName: r.station_name,
    lotId: r.lot_id,
    testTime: r.test_time?.toISOString(),
    resultMsg: r.result_msg,
    cycleTimeMs: r.cycle_time_ms,
    lineIdRaw: r.line_id_raw,
  })));
});

/* ═══════════════════════════════════════════════
   GET /api/machine-data/by-line
   Machines grouped by line → station with rich stats.
   ═══════════════════════════════════════════════ */
router.get("/by-line", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const windowHours = 24;

  const lines = await pool.query(
    `SELECT DISTINCT pl.id, pl.name
     FROM production_lines pl
     INNER JOIN machine_registry mr ON mr.line_id = pl.id AND mr.is_active = true
     WHERE pl.is_active = true
     ORDER BY pl.name`
  );

  // Group by registry ID only (not by machine_name) so renaming a machine
  // does not create a phantom duplicate in the monitor.
  // For registered machines: always show the current name from the registry (mr.name).
  // For unregistered: fall back to the logged name.
  const latestData = await pool.query(`
    SELECT DISTINCT ON (COALESCE(mdl.machine_registry_id::text, 'unreg_' || mdl.machine_name))
      mdl.id, mdl.machine_registry_id,
      COALESCE(mr.name, mdl.machine_name) AS machine_name,
      mdl.machine_code,
      mdl.machine_type, mdl.status, mdl.pass_count, mdl.fail_count,
      mdl.total_count, mdl.notes, mdl.pushed_at, mdl.line_id, mdl.station_number,
      mdl.result_msg, mdl.lot_id, mdl.cycle_time_ms,
      mr.station_name, mr.model, mr.heartbeat_at
    FROM machine_data_logs mdl
    LEFT JOIN machine_registry mr ON mr.id = mdl.machine_registry_id
    ORDER BY COALESCE(mdl.machine_registry_id::text, 'unreg_' || mdl.machine_name), mdl.pushed_at DESC
  `);

  const stationStats = await pool.query(`
    SELECT
      line_id, station_number,
      COUNT(*) AS total_tests,
      COUNT(*) FILTER (WHERE status = 'pass') AS pass_tests,
      COUNT(*) FILTER (WHERE status = 'fail') AS fail_tests,
      COUNT(DISTINCT lot_id) FILTER (WHERE lot_id IS NOT NULL) AS total_devices,
      AVG(cycle_time_ms) FILTER (WHERE cycle_time_ms IS NOT NULL) AS avg_cycle_ms
    FROM machine_data_logs
    WHERE pushed_at > NOW() - INTERVAL '${windowHours} hours'
      AND line_id IS NOT NULL
    GROUP BY line_id, station_number
  `);

  const deviceStats = await pool.query(`
    SELECT
      line_id, station_number,
      COUNT(DISTINCT lot_id) FILTER (WHERE lot_id IS NOT NULL AND fail_tests = 0) AS devices_pass,
      COUNT(DISTINCT lot_id) FILTER (WHERE lot_id IS NOT NULL AND fail_tests > 0) AS devices_fail
    FROM (
      SELECT line_id, station_number, lot_id,
             COUNT(*) FILTER (WHERE status = 'fail') AS fail_tests
      FROM machine_data_logs
      WHERE pushed_at > NOW() - INTERVAL '${windowHours} hours'
        AND line_id IS NOT NULL AND lot_id IS NOT NULL
      GROUP BY line_id, station_number, lot_id
    ) sub
    GROUP BY line_id, station_number
  `);

  const errorStats = await pool.query(`
    SELECT line_id, station_number, result_msg,
           COUNT(*) AS error_count, MAX(pushed_at) AS last_seen
    FROM machine_data_logs
    WHERE pushed_at > NOW() - INTERVAL '${windowHours} hours'
      AND status = 'fail' AND result_msg IS NOT NULL AND result_msg != ''
      AND line_id IS NOT NULL
    GROUP BY line_id, station_number, result_msg
    ORDER BY line_id, station_number, error_count DESC
  `);

  const activeDowntime = await pool.query(`
    SELECT machine_name, line_id, notes, start_time
    FROM downtime_records
    WHERE status = 'ongoing' AND notes LIKE '%AUTO-DOWNTIME%'
  `);

  const registeredMachines = await pool.query(`
    SELECT mr.id, mr.name, mr.code, mr.machine_type, mr.line_id, mr.station_number,
           mr.station_name, mr.model, mr.heartbeat_at, pl.name AS line_name
    FROM machine_registry mr
    LEFT JOIN production_lines pl ON pl.id = mr.line_id
    WHERE mr.is_active = true
    ORDER BY mr.line_id, mr.station_number, mr.name
  `);

  const tempAssignments = await pool.query(`
    SELECT mta.id AS assignment_id, mta.machine_registry_id, mta.temp_line_id, mta.created_at,
           mr.name AS machine_name, mr.code AS machine_code, mr.machine_type, mr.station_number,
           mr.station_name, mr.model, mr.heartbeat_at, mr.line_id AS registered_line_id
    FROM machine_temp_assignments mta
    INNER JOIN machine_registry mr ON mr.id = mta.machine_registry_id
    WHERE mta.dismissed_at IS NULL AND mr.is_active = true
    ORDER BY mta.created_at
  `);

  type StationKey = string;
  const stationStatsMap: Record<StationKey, any> = {};
  for (const r of stationStats.rows) {
    stationStatsMap[`${r.line_id}_${r.station_number ?? 0}`] = r;
  }
  const deviceStatsMap: Record<StationKey, any> = {};
  for (const r of deviceStats.rows) {
    deviceStatsMap[`${r.line_id}_${r.station_number ?? 0}`] = r;
  }
  const errorMap: Record<StationKey, any[]> = {};
  for (const r of errorStats.rows) {
    const key = `${r.line_id}_${r.station_number ?? 0}`;
    if (!errorMap[key]) errorMap[key] = [];
    errorMap[key].push({ msg: r.result_msg, count: Number(r.error_count), lastSeen: r.last_seen?.toISOString() });
  }
  const downtimeMap: Record<string, any[]> = {};
  for (const r of activeDowntime.rows) {
    const key = String(r.machine_name);
    if (!downtimeMap[key]) downtimeMap[key] = [];
    downtimeMap[key].push({ startTime: r.start_time?.toISOString(), notes: r.notes });
  }

  const lineMap: Record<number, Record<number, any[]>> = {};

  for (const r of latestData.rows) {
    if (!r.line_id) continue;
    const st = r.station_number ?? 0;
    if (!lineMap[r.line_id]) lineMap[r.line_id] = {};
    if (!lineMap[r.line_id][st]) lineMap[r.line_id][st] = [];
    const STALE_MS = 5 * 60 * 1000;
    const dataStale = !r.pushed_at || Date.now() - new Date(r.pushed_at).getTime() > STALE_MS;
    const hbStale  = !r.heartbeat_at || Date.now() - new Date(r.heartbeat_at).getTime() > STALE_MS;
    const stale = dataStale && hbStale;
    lineMap[r.line_id][st].push({
      machineRegistryId: r.machine_registry_id,
      machineName: r.machine_name,
      machineCode: r.machine_code,
      machineType: r.machine_type,
      status: stale ? "offline" : r.status,
      passCount: r.pass_count ?? 0,
      failCount: r.fail_count ?? 0,
      totalCount: r.total_count,
      notes: r.notes,
      pushedAt: r.pushed_at?.toISOString(),
      heartbeatAt: r.heartbeat_at?.toISOString() ?? null,
      stationName: r.station_name,
      model: r.model,
      resultMsg: r.result_msg,
      lotId: r.lot_id,
      cycleTimeMs: r.cycle_time_ms,
      live: !stale,
      autoDowntime: downtimeMap[r.machine_name] ?? null,
    });
  }

  for (const m of registeredMachines.rows) {
    if (!m.line_id) continue;
    const st = m.station_number ?? 0;
    if (!lineMap[m.line_id]) lineMap[m.line_id] = {};
    if (!lineMap[m.line_id][st]) lineMap[m.line_id][st] = [];
    const alreadyLive = lineMap[m.line_id][st].some((x: any) => x.machineRegistryId === m.id);
    if (!alreadyLive) {
      const STALE_MS = 5 * 60 * 1000;
      const hbFresh = m.heartbeat_at && Date.now() - new Date(m.heartbeat_at).getTime() < STALE_MS;
      lineMap[m.line_id][st].push({
        machineRegistryId: m.id,
        machineName: m.name,
        machineCode: m.code,
        machineType: m.machine_type,
        status: hbFresh ? "idle" : "offline",
        passCount: 0,
        failCount: 0,
        totalCount: null,
        notes: null,
        pushedAt: null,
        heartbeatAt: m.heartbeat_at?.toISOString() ?? null,
        stationName: m.station_name,
        model: m.model,
        resultMsg: null,
        lotId: null,
        cycleTimeMs: null,
        live: hbFresh,
        autoDowntime: null,
      });
    }
  }

  /* ── Inject temp machines into their temp lines ── */
  const TEMP_STATION_NUM = 9999;
  for (const ta of tempAssignments.rows) {
    const tempLineId = ta.temp_line_id;
    const STALE_MS = 5 * 60 * 1000;
    const hbFresh = ta.heartbeat_at && Date.now() - new Date(ta.heartbeat_at).getTime() < STALE_MS;
    if (!lineMap[tempLineId]) lineMap[tempLineId] = {};
    if (!lineMap[tempLineId][TEMP_STATION_NUM]) lineMap[tempLineId][TEMP_STATION_NUM] = [];
    const alreadyAdded = lineMap[tempLineId][TEMP_STATION_NUM].some((x: any) => x.machineRegistryId === ta.machine_registry_id);
    if (!alreadyAdded) {
      lineMap[tempLineId][TEMP_STATION_NUM].push({
        machineRegistryId: ta.machine_registry_id,
        machineName: ta.machine_name,
        machineCode: ta.machine_code,
        machineType: ta.machine_type,
        status: hbFresh ? "idle" : "offline",
        passCount: 0,
        failCount: 0,
        totalCount: null,
        notes: null,
        pushedAt: null,
        heartbeatAt: ta.heartbeat_at?.toISOString() ?? null,
        stationName: ta.station_name,
        model: ta.model,
        resultMsg: null,
        lotId: null,
        cycleTimeMs: null,
        live: hbFresh,
        autoDowntime: null,
        isTemp: true,
        assignmentId: ta.assignment_id,
        registeredLineId: ta.registered_line_id,
      });
    }

    /* ensure the temp line appears in the lines list */
    if (!lines.rows.find((l: any) => l.id === tempLineId)) {
      const lRow = await pool.query(`SELECT id, name FROM production_lines WHERE id = $1 LIMIT 1`, [tempLineId]);
      if (lRow.rows.length) lines.rows.push(lRow.rows[0]);
    }
  }

  const result = lines.rows.map((line: any) => {
    const stations = lineMap[line.id] ?? {};
    const stationList = Object.keys(stations)
      .map(Number).sort((a, b) => a - b)
      .map(st => {
        const machines = stations[st];
        const key = `${line.id}_${st}`;
        const ss = stationStatsMap[key] ?? {};
        const ds = deviceStatsMap[key] ?? {};
        const errors = (errorMap[key] ?? []).slice(0, 5);
        const totalTests = Number(ss.total_tests ?? 0);
        const passTests = Number(ss.pass_tests ?? 0);
        const failTests = Number(ss.fail_tests ?? 0);
        const totalDevices = Number(ss.total_devices ?? 0);
        const devicesPass = Number(ds.devices_pass ?? 0);
        const devicesFail = Number(ds.devices_fail ?? 0);
        const passRate = totalTests > 0 ? Math.round((passTests / totalTests) * 100) : null;
        const avgCycleMs = ss.avg_cycle_ms ? Math.round(Number(ss.avg_cycle_ms)) : null;
        const hasAutoDowntime = machines.some((m: any) => m.autoDowntime && m.autoDowntime.length > 0);
        return {
          stationNumber: st,
          stationName: st === 9999 ? "Temporary Machines" : (machines[0]?.stationName ?? (st === 0 ? "Unassigned" : `Station ${st}`)),
          machines,
          stats: { totalTests, passTests, failTests, passRate, totalDevices, devicesPass, devicesFail, avgCycleMs },
          topErrors: errors,
          hasAutoDowntime,
        };
      });

    const totalTests = stationList.reduce((a, s) => a + s.stats.totalTests, 0);
    const passTests = stationList.reduce((a, s) => a + s.stats.passTests, 0);
    const failTests = stationList.reduce((a, s) => a + s.stats.failTests, 0);
    const linePassRate = totalTests > 0 ? Math.round((passTests / totalTests) * 100) : null;
    return {
      lineId: line.id,
      lineName: line.name,
      stations: stationList,
      totalMachines: stationList.reduce((a, s) => a + s.machines.length, 0),
      liveMachines: stationList.reduce((a, s) => a + s.machines.filter((m: any) => m.live).length, 0),
      stats: { totalTests, passTests, failTests, linePassRate },
    };
  }).filter((l: any) => l.totalMachines > 0);

  return res.json(result);
});

/* ═══════════════════════════════════════════════
   GET /api/machine-data/history/:registryId
   Recent 200 pushes for a specific machine.
   ═══════════════════════════════════════════════ */
router.get("/history/:registryId", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const registryId = parseInt(req.params.registryId);
  if (isNaN(registryId)) return res.status(400).json({ error: "Invalid id" });

  const rows = await pool.query(`
    SELECT id, machine_name, machine_code, status, pass_count, fail_count,
           total_count, notes, pushed_at, lot_id, test_time, result_msg,
           cycle_time_ms, line_id_raw, source_file
    FROM machine_data_logs
    WHERE machine_registry_id = $1
    ORDER BY pushed_at DESC LIMIT 200
  `, [registryId]);

  return res.json(rows.rows.map((r: any) => ({
    id: r.id,
    machineName: r.machine_name,
    machineCode: r.machine_code,
    status: r.status,
    passCount: r.pass_count ?? 0,
    failCount: r.fail_count ?? 0,
    totalCount: r.total_count,
    notes: r.notes,
    pushedAt: r.pushed_at?.toISOString(),
    lotId: r.lot_id,
    testTime: r.test_time?.toISOString(),
    resultMsg: r.result_msg,
    cycleTimeMs: r.cycle_time_ms,
    lineIdRaw: r.line_id_raw,
    sourceFile: r.source_file,
  })));
});

/* ═══════════════════════════════════════════════
   GET /api/machine-data/column-mapping
   ═══════════════════════════════════════════════ */
router.get("/column-mapping", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !["admin", "manager"].includes(user.role ?? "")) return res.status(403).json({ error: "Forbidden" });
  const mapping = await getColumnMapping();
  return res.json({ mappings: mapping, targetFields: TARGET_FIELDS });
});

/* ═══════════════════════════════════════════════
   PUT /api/machine-data/column-mapping
   ═══════════════════════════════════════════════ */
router.put("/column-mapping", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !["admin", "manager"].includes(user.role ?? "")) return res.status(403).json({ error: "Forbidden" });
  const { mappings } = req.body;
  if (!mappings || typeof mappings !== "object") return res.status(400).json({ error: "mappings object required" });

  const existing = await pool.query(`SELECT id FROM machine_column_mappings LIMIT 1`);
  if (existing.rows.length > 0) {
    await pool.query(`UPDATE machine_column_mappings SET mappings = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(mappings), existing.rows[0].id]);
  } else {
    await pool.query(`INSERT INTO machine_column_mappings (tenant_id, mappings, updated_at) VALUES (1, $1, NOW())`, [JSON.stringify(mappings)]);
  }

  return res.json({ ok: true });
});

/* ═══════════════════════════════════════════════
   POST /api/machine-data/import  (XLSX upload)
   ═══════════════════════════════════════════════ */
router.post("/import", upload.single("file"), async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !["admin", "manager"].includes(user.role ?? "")) return res.status(403).json({ error: "Forbidden" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const wb = XLSX.read(req.file.buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: null });
  if (raw.length === 0) return res.json({ ok: true, inserted: 0 });

  const mapping = await getColumnMapping();
  const rows: typeof machineDataLogsTable.$inferInsert[] = [];

  for (const rawItem of raw) {
    const item = applyMapping(rawItem, mapping);
    const status = normalizeStatus(item.status ?? item.test_result ?? item.TEST_RESULT);
    const resultMsg = item.resultMsg ?? item.result_msg ?? item.RESULT_MSG ?? null;

    let registeredMachine: typeof machineRegistryTable.$inferSelect | null = null;
    const machineIp = item.machineIp ?? item.machine_ip;
    if (machineIp) {
      const r = await db.select().from(machineRegistryTable)
        .where(eq(machineRegistryTable.machineIp, String(machineIp).trim())).limit(1);
      registeredMachine = r[0] ?? null;
    }

    const rawCycle = _float(item.cycleTime ?? item.cycle_time ?? item.CYCLETIME);
    rows.push({
      machineRegistryId: registeredMachine?.id ?? null,
      lineId: registeredMachine?.lineId ?? null,
      stationNumber: registeredMachine?.stationNumber ?? null,
      machineName: registeredMachine?.name ?? String(item.machine_name ?? item.machineName ?? item.MACHINE_NAME ?? "Unknown"),
      machineCode: registeredMachine?.code ?? item.machine_code ?? null,
      machineType: registeredMachine?.machineType ?? item.machine_type ?? null,
      status,
      passCount: status === "pass" ? 1 : (status === "fail" ? 0 : 0),
      failCount: status === "fail" ? 1 : 0,
      totalCount: _int(item.total_count ?? item.totalCount),
      notes: typeof resultMsg === "string" ? resultMsg : null,
      sourceFile: req.file.originalname,
      lotId: item.lotId ?? item.lot_id ?? item.LOT_ID ?? null,
      testTime: _ts(item.testTime ?? item.test_time ?? item.TEST_TIME),
      resultMsg: typeof resultMsg === "string" ? resultMsg : null,
      cycleTimeMs: rawCycle != null ? (rawCycle < 10000 ? Math.round(rawCycle * 1000) : Math.round(rawCycle)) : null,
      lineIdRaw: item.lineIdRaw ?? item.line_id_raw ?? item.LINE_ID ?? null,
    });
  }

  if (rows.length > 0) await db.insert(machineDataLogsTable).values(rows);
  return res.json({ ok: true, inserted: rows.length });
});

/* ═══════════════════════════════════════════════
   GET /api/machine-data/export  (XLSX download)
   ═══════════════════════════════════════════════ */
router.get("/export", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const logs = await db.select().from(machineDataLogsTable).orderBy(desc(machineDataLogsTable.pushedAt)).limit(10000);
  const data = logs.map(l => ({
    "Machine Name": l.machineName,
    "Machine Code": l.machineCode ?? "",
    "Status": l.status,
    "Pass Count": l.passCount ?? 0,
    "Fail Count": l.failCount ?? 0,
    "Result Msg": l.resultMsg ?? "",
    "Lot ID": l.lotId ?? "",
    "Cycle Time (ms)": l.cycleTimeMs ?? "",
    "Line ID Raw": l.lineIdRaw ?? "",
    "Source File": l.sourceFile ?? "",
    "Test Time": l.testTime?.toISOString() ?? "",
    "Pushed At": l.pushedAt?.toISOString() ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Machine Data");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Disposition", `attachment; filename="machine-data-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buf);
});

/* ═══════════════════════════════════════════════
   GET /api/machine-data/analysis/:machineId
   Returns raw log rows formatted for the analysis tool.
   Query params: hours (default 168 = 7 days)
   ═══════════════════════════════════════════════ */
router.get("/analysis/:machineId", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const machineId = parseInt(req.params.machineId);
  if (isNaN(machineId)) return res.status(400).json({ error: "Invalid machine ID" });

  const hours = Math.min(parseInt((req.query.hours as string) ?? "168"), 720); // max 30 days
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const machines = await db
    .select()
    .from(machineRegistryTable)
    .where(eq(machineRegistryTable.id, machineId))
    .limit(1);

  if (!machines[0]) return res.status(404).json({ error: "Machine not found" });
  const machine = machines[0];

  const result = await pool.query(
    `SELECT lot_id, status, test_time, pushed_at, result_msg, machine_name, cycle_time_ms
     FROM machine_data_logs
     WHERE machine_registry_id = $1
       AND pushed_at >= $2
     ORDER BY pushed_at ASC
     LIMIT 50000`,
    [machineId, since]
  );

  const rows = result.rows.map((r: any) => ({
    LOT_ID: r.lot_id ?? "",
    TEST_RESULT: String(r.status ?? "").toLowerCase() === "pass" ? "PASS" : "FAIL",
    TEST_TIME: (r.test_time ?? r.pushed_at ?? new Date()).toISOString(),
    PUSHED_AT: (r.pushed_at ?? new Date()).toISOString(),
    RESULT_MSG: r.result_msg ?? "",
    DEVICE: r.machine_name ?? machine.name,
    CYCLETIME: r.cycle_time_ms != null ? r.cycle_time_ms / 1000 : 0,
  }));

  res.json({
    machine: {
      id: machine.id,
      name: machine.name,
      code: machine.code,
      type: machine.machineType,
    },
    rows,
    hours,
    since: since.toISOString(),
  });
});

/* ═══════════════════════════════════════════════
   GET /api/machine-data/api-key
   ═══════════════════════════════════════════════ */
router.get("/api-key", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  const key = await getMachineApiKey();
  res.json({ apiKey: key });
});

/* ═══════════════════════════════════════════════
   DELETE /api/machine-data/temp-assignment/:assignmentId
   Dismiss a temp machine from a line.
   Allowed: team_leader, manager, admin.
   ═══════════════════════════════════════════════ */
router.delete("/temp-assignment/:assignmentId", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || !["admin", "manager", "team_leader"].includes(user.role ?? "")) {
    return res.status(403).json({ error: "Forbidden — team leader or above required" });
  }
  const id = parseInt(req.params.assignmentId);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid assignment id" });

  const result = await pool.query(
    `UPDATE machine_temp_assignments
     SET dismissed_at = NOW(), dismissed_by_id = $1
     WHERE id = $2 AND dismissed_at IS NULL`,
    [user.id, id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: "Assignment not found or already dismissed" });

  await logAudit(user, "delete", "MachineTempAssignment", id, `Dismissed temp machine assignment #${id}`, { userId: user.id });
  return res.json({ ok: true });
});

/* ═══════════════════════════════════════════════
   DELETE /api/machine-data/reset
   Admin only. Clears all machine data logs.
   ═══════════════════════════════════════════════ */
router.delete("/reset", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  const { rowCount } = await pool.query(`DELETE FROM machine_data_logs`);
  await logAudit(user, "delete", "MachineDataLogs", null, `All machine data logs cleared (${rowCount} rows)`, { rowsDeleted: rowCount });
  res.json({ ok: true });
});

export default router;
