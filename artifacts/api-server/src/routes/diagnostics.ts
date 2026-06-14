import { Router } from "express";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import { getCurrentUser } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";
import { generateBackupJson } from "../lib/backup-util.js";
import { getRecentErrors, markErrorFixed } from "../lib/error-tracker.js";

const router = Router();

export interface DiagCheck {
  id: string;
  category: string;
  name: string;
  status: "ok" | "warning" | "critical";
  message: string;
  detail?: string;
  value?: string | number;
}

interface ScanResult {
  checks: DiagCheck[];
  score: number;
  scannedAt: string;
  serverUptime: number;
  memoryMb: number;
}

async function runScan(): Promise<ScanResult> {
  const checks: DiagCheck[] = [];

  // ── 1. Database Connectivity ────────────────────────────────────────────
  try {
    await db.execute(sql`SELECT 1`);
    checks.push({ id: "db_conn", category: "Database", name: "Database Connection", status: "ok", message: "Connected to PostgreSQL successfully" });
  } catch (e: any) {
    checks.push({ id: "db_conn", category: "Database", name: "Database Connection", status: "critical", message: "Database unreachable", detail: e.message });
  }

  // ── 2. Table Row Counts ─────────────────────────────────────────────────
  const tables = [
    { id: "users", label: "Users" },
    { id: "machine_registry", label: "Machines" },
    { id: "downtime_records", label: "Downtime Records" },
    { id: "inventory_items", label: "Inventory Items" },
    { id: "pm_plans", label: "PM Plans" },
    { id: "tasks", label: "Tasks" },
    { id: "audit_logs", label: "Audit Logs" },
    { id: "attendance_records", label: "Attendance Records" },
  ];

  for (const t of tables) {
    try {
      const res = await db.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${t.id}`));
      const cnt = Number((res as any).rows?.[0]?.cnt ?? 0);
      checks.push({
        id: `table_${t.id}`,
        category: "Database",
        name: `Table: ${t.label}`,
        status: "ok",
        message: `${cnt} records`,
        value: cnt,
      });
    } catch (e: any) {
      checks.push({
        id: `table_${t.id}`,
        category: "Database",
        name: `Table: ${t.label}`,
        status: "critical",
        message: `Table missing or inaccessible`,
        detail: e.message,
      });
    }
  }

  // ── 3. Factory Configuration ─────────────────────────────────────────────
  try {
    const cfgRows = await db.execute(sql`SELECT machine_api_key, omtp_columns FROM factory_config LIMIT 1`);
    const cfg = (cfgRows as any).rows?.[0];
    if (!cfg) {
      checks.push({ id: "cfg_exists", category: "Configuration", name: "Factory Config", status: "warning", message: "No factory configuration found — defaults will be used" });
    } else {
      checks.push({ id: "cfg_exists", category: "Configuration", name: "Factory Config", status: "ok", message: "Factory configuration record exists" });
      if (!cfg.machine_api_key) {
        checks.push({ id: "cfg_apikey", category: "Configuration", name: "Machine API Key", status: "warning", message: "API key not set — Machine Monitor will not accept data" });
      } else {
        checks.push({ id: "cfg_apikey", category: "Configuration", name: "Machine API Key", status: "ok", message: "Machine API key is configured" });
      }
    }
  } catch (e: any) {
    checks.push({ id: "cfg_exists", category: "Configuration", name: "Factory Config", status: "critical", message: "Cannot read factory config", detail: e.message });
  }

  // ── 4. Auto-Backup Freshness ─────────────────────────────────────────────
  try {
    const bkRows = await db.execute(sql`SELECT created_at, size_bytes FROM auto_backups ORDER BY created_at DESC LIMIT 1`);
    const bk = (bkRows as any).rows?.[0];
    if (!bk) {
      checks.push({ id: "auto_backup", category: "Data Safety", name: "Auto Backup", status: "warning", message: "No automatic backup found — restart the server to trigger one" });
    } else {
      const ageMins = Math.floor((Date.now() - new Date(bk.created_at).getTime()) / 60000);
      const ageh = Math.floor(ageMins / 60);
      const sizeKb = Math.round(Number(bk.size_bytes) / 1024);
      const status = ageMins > 1500 ? "warning" : "ok"; // > 25h
      checks.push({
        id: "auto_backup",
        category: "Data Safety",
        name: "Auto Backup",
        status,
        message: `Last backup ${ageh}h ago (${sizeKb} KB)`,
        value: ageMins,
      });
    }
  } catch (e: any) {
    checks.push({ id: "auto_backup", category: "Data Safety", name: "Auto Backup", status: "critical", message: "Cannot check auto_backups table", detail: e.message });
  }

  // ── 5. Data Quality Checks ───────────────────────────────────────────────
  try {
    const staleRows = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM downtime_records 
      WHERE status = 'open' AND start_time < NOW() - INTERVAL '7 days'
    `);
    const cnt = Number((staleRows as any).rows?.[0]?.cnt ?? 0);
    if (cnt > 0) {
      checks.push({ id: "stale_downtime", category: "Data Quality", name: "Stale Open Downtime", status: "warning", message: `${cnt} open downtime record(s) older than 7 days — resolve or close them`, value: cnt });
    } else {
      checks.push({ id: "stale_downtime", category: "Data Quality", name: "Stale Open Downtime", status: "ok", message: "No stale open downtime records" });
    }
  } catch { /* downtime table may not exist in edge case */ }

  try {
    const lowRows = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM inventory_items 
      WHERE quantity <= min_quantity
    `);
    const cnt = Number((lowRows as any).rows?.[0]?.cnt ?? 0);
    if (cnt > 0) {
      checks.push({ id: "low_stock", category: "Data Quality", name: "Low Stock Items", status: "warning", message: `${cnt} inventory item(s) at or below minimum stock level`, value: cnt });
    } else {
      checks.push({ id: "low_stock", category: "Data Quality", name: "Low Stock Items", status: "ok", message: "All inventory items above minimum stock" });
    }
  } catch { /* inventory may be empty */ }

  try {
    const pmRows = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM machine_registry m
      WHERE NOT EXISTS (SELECT 1 FROM pm_plans p WHERE p.machine_id = m.id AND p.is_active = true)
    `);
    const cnt = Number((pmRows as any).rows?.[0]?.cnt ?? 0);
    if (cnt > 0) {
      checks.push({ id: "machines_no_pm", category: "Data Quality", name: "Machines Without PM", status: "warning", message: `${cnt} active machine(s) have no PM plan assigned`, value: cnt });
    } else {
      checks.push({ id: "machines_no_pm", category: "Data Quality", name: "Machines Without PM", status: "ok", message: "All machines have at least one PM plan" });
    }
  } catch { /* machines/pm may be empty */ }

  try {
    const openBm = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM broken_machines WHERE status NOT IN ('resolved', 'closed')
    `);
    const cnt = Number((openBm as any).rows?.[0]?.cnt ?? 0);
    if (cnt > 5) {
      checks.push({ id: "open_broken", category: "Data Quality", name: "Open Broken Machines", status: "warning", message: `${cnt} broken machine reports are still open`, value: cnt });
    } else {
      checks.push({ id: "open_broken", category: "Data Quality", name: "Open Broken Machines", status: "ok", message: cnt === 0 ? "No open broken machine reports" : `${cnt} open report(s) — within acceptable limit` });
    }
  } catch { /* ok */ }

  // ── 6. Audit Log Activity ────────────────────────────────────────────────
  try {
    const auditRows = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM audit_logs WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    const cnt = Number((auditRows as any).rows?.[0]?.cnt ?? 0);
    if (cnt === 0) {
      checks.push({ id: "audit_activity", category: "Security", name: "Audit Log Activity", status: "warning", message: "No audit events in last 24 hours — expected if system is idle" });
    } else {
      checks.push({ id: "audit_activity", category: "Security", name: "Audit Log Activity", status: "ok", message: `${cnt} audit event(s) recorded in the last 24 hours`, value: cnt });
    }
  } catch (e: any) {
    checks.push({ id: "audit_activity", category: "Security", name: "Audit Log Activity", status: "critical", message: "Audit log table inaccessible", detail: e.message });
  }

  // ── 7. User Account Health ───────────────────────────────────────────────
  try {
    const userRows = await db.execute(sql`SELECT role, COUNT(*) as cnt FROM users GROUP BY role`);
    const rows = (userRows as any).rows ?? [];
    const total = rows.reduce((s: number, r: any) => s + Number(r.cnt), 0);
    const adminCnt = Number(rows.find((r: any) => r.role === "admin")?.cnt ?? 0);
    if (total <= 1) {
      checks.push({ id: "user_count", category: "Users", name: "User Accounts", status: "warning", message: "Only admin account exists — add real team members" });
    } else {
      checks.push({ id: "user_count", category: "Users", name: "User Accounts", status: "ok", message: `${total} user(s): ${adminCnt} admin, ${total - adminCnt} team members`, value: total });
    }
  } catch (e: any) {
    checks.push({ id: "user_count", category: "Users", name: "User Accounts", status: "critical", message: "Cannot read user table", detail: e.message });
  }

  // ── 8. Server Memory ─────────────────────────────────────────────────────
  const mem = process.memoryUsage();
  const memMb = Math.round(mem.heapUsed / 1024 / 1024);
  const memTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
  const memPct = Math.round((mem.heapUsed / mem.heapTotal) * 100);
  checks.push({
    id: "server_memory",
    category: "Server",
    name: "Server Memory",
    status: memPct > 90 ? "critical" : memPct > 75 ? "warning" : "ok",
    message: `${memMb} MB used of ${memTotalMb} MB heap (${memPct}%)`,
    value: memMb,
  });

  // ── 9. Runtime Error Monitor ─────────────────────────────────────────────
  try {
    const errRows = await db.execute(sql`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN resolved = false THEN 1 ELSE 0 END) as unresolved
      FROM system_errors
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    const row = (errRows as any).rows?.[0];
    const total = Number(row?.total ?? 0);
    const unresolved = Number(row?.unresolved ?? 0);
    if (unresolved > 5) {
      checks.push({ id: "runtime_errors", category: "Application", name: "Runtime Errors", status: "critical", message: `${unresolved} unresolved API error(s) in the last 24 hours`, value: unresolved });
    } else if (unresolved > 0) {
      checks.push({ id: "runtime_errors", category: "Application", name: "Runtime Errors", status: "warning", message: `${unresolved} API error(s) detected in the last 24 hours (${total - unresolved} resolved)`, value: unresolved });
    } else {
      checks.push({ id: "runtime_errors", category: "Application", name: "Runtime Errors", status: "ok", message: total === 0 ? "No runtime errors recorded" : `${total} error(s) in 24h — all resolved`, value: total });
    }
  } catch {
    checks.push({ id: "runtime_errors", category: "Application", name: "Runtime Errors", status: "ok", message: "Error tracking active — no errors recorded" });
  }

  // ── Score Calculation ─────────────────────────────────────────────────────
  const criticals = checks.filter(c => c.status === "critical").length;
  const warnings  = checks.filter(c => c.status === "warning").length;
  const score = Math.max(0, 100 - criticals * 15 - warnings * 5);

  return {
    checks,
    score,
    scannedAt: new Date().toISOString(),
    serverUptime: Math.floor(process.uptime()),
    memoryMb: memMb,
  };
}

// GET /api/diagnostics/scan
router.get("/scan", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const result = await runScan();
  await logAudit(user, "view", "Diagnostics", null, "System diagnostic scan", { score: result.score, criticals: result.checks.filter(c => c.status === "critical").length, warnings: result.checks.filter(c => c.status === "warning").length });
  res.json(result);
});

// POST /api/diagnostics/ai-analyze
router.post("/ai-analyze", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    return res.status(503).json({ error: "AI integration not configured" });
  }

  // Run a fresh scan to get current data
  const scan = await runScan();

  const criticals = scan.checks.filter(c => c.status === "critical");
  const warnings  = scan.checks.filter(c => c.status === "warning");
  const oks       = scan.checks.filter(c => c.status === "ok");

  const prompt = `You are a CMMS system health AI for an OPPO mobile manufacturing factory. 
Analyze the following system diagnostic report and provide:
1. A short overall assessment (2-3 sentences)
2. A numbered list of specific problems found with simple fix instructions
3. A prioritized repair plan (top 3 steps)
4. An overall health summary

Keep language simple and practical. Factory staff will read this.

DIAGNOSTIC REPORT:
- Health Score: ${scan.score}/100
- Server Uptime: ${Math.floor(scan.serverUptime / 3600)}h ${Math.floor((scan.serverUptime % 3600) / 60)}m
- Memory: ${scan.memoryMb} MB used
- Scanned: ${new Date(scan.scannedAt).toLocaleString()}

CRITICAL ISSUES (${criticals.length}):
${criticals.length === 0 ? "None" : criticals.map(c => `- [${c.category}] ${c.name}: ${c.message}${c.detail ? ` (${c.detail})` : ""}`).join("\n")}

WARNINGS (${warnings.length}):
${warnings.length === 0 ? "None" : warnings.map(c => `- [${c.category}] ${c.name}: ${c.message}`).join("\n")}

PASSING CHECKS (${oks.length}):
${oks.map(c => `- ${c.name}: ${c.message}`).join("\n")}

Please respond in JSON format:
{
  "assessment": "short overall assessment",
  "healthLabel": "Excellent|Good|Fair|Poor|Critical",
  "findings": [{ "priority": "critical|warning|info", "title": "...", "problem": "...", "fix": "..." }],
  "repairPlan": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "summary": "one-line conclusion"
}`;

  try {
    const aiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.2",
        max_completion_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return res.status(502).json({ error: "AI service error", detail: errText });
    }

    const aiData = await aiRes.json() as any;
    const content = aiData.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    res.json({ ...parsed, scan });
  } catch (e: any) {
    res.status(500).json({ error: "AI analysis failed", detail: e.message });
  }
});

// POST /api/diagnostics/code-repair  — AI reads errors + code and auto-fixes what it can
router.post("/code-repair", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseUrl || !apiKey) return res.status(503).json({ error: "AI integration not configured" });

  // ── 1. Collect recent errors ───────────────────────────────────────────────
  const recentErrors = await getRecentErrors(48, 20);

  // ── 2. Collect DB schema ──────────────────────────────────────────────────
  let schemaSummary = "";
  try {
    const schemaRes = await db.execute(sql`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);
    const rows = (schemaRes as any).rows ?? [];
    schemaSummary = rows.map((r: any) =>
      `${r.table_name}.${r.column_name} ${r.data_type}${r.is_nullable === "NO" ? " NOT NULL" : ""}${r.column_default ? " DEFAULT " + r.column_default : ""}`
    ).join("\n");
  } catch { /* non-fatal */ }

  // ── 3. Read relevant source files ─────────────────────────────────────────
  const ROUTE_MAP: Record<string, string> = {
    "/auth":          "src/routes/auth.ts",
    "/users":         "src/routes/users.ts",
    "/inventory":     "src/routes/inventory.ts",
    "/machine":       "src/routes/machine-registry.ts",
    "/downtime":      "src/routes/downtime.ts",
    "/pm":            "src/routes/pm-plans.ts",
    "/tasks":         "src/routes/tasks.ts",
    "/attendance":    "src/routes/attendance.ts",
    "/training":      "src/routes/training.ts",
    "/diagnostics":   "src/routes/diagnostics.ts",
    "/factory-config":"src/routes/factory-config.ts",
    "/backup":        "src/routes/backup.ts",
    "/broken":        "src/routes/broken-machines.ts",
    "/kpi":           "src/routes/kpi.ts",
    "/notifications": "src/routes/notifications.ts",
  };

  const sourceFiles: Record<string, string> = {};
  const relevantUrls = [...new Set(recentErrors.map(e => e.url as string).filter(Boolean))];
  for (const url of relevantUrls) {
    for (const [pattern, file] of Object.entries(ROUTE_MAP)) {
      if (url.includes(pattern) && !sourceFiles[file]) {
        try {
          const content = await readFile(join(process.cwd(), file), "utf8");
          sourceFiles[file] = content.slice(0, 2500);
        } catch { /* file not found, skip */ }
      }
    }
  }

  // ── 4. Compose prompt ─────────────────────────────────────────────────────
  const errorSummary = recentErrors.slice(0, 12).map((e, i) =>
    `[#${e.id}] ${e.error_type} | ${e.method ?? "?"} ${e.url ?? "?"} | HTTP ${e.status_code ?? "?"}\nMessage: ${e.error_message}\n${e.stack_trace ? "Stack (first 300 chars): " + String(e.stack_trace).slice(0, 300) : ""}`
  ).join("\n\n");

  const sourceCodeSection = Object.entries(sourceFiles).map(([f, c]) => `=== ${f} ===\n${c}`).join("\n\n");

  const prompt = `You are a senior Node.js/TypeScript/PostgreSQL engineer maintaining a CMMS factory management system (Express + Drizzle ORM + PostgreSQL).

Analyze these ${recentErrors.length} runtime errors and produce specific, actionable fixes.

For each fix identify:
- fixType: "sql" | "config" | "data" | "code"
- If "sql": provide a safe SQL statement to execute (e.g. add missing column, fix constraint, clean bad data)
- If "data": provide SQL to clean/fix corrupted or missing data records
- If "config": name the environment variable or config key to set and what value
- If "code": provide the exact file name, the old code fragment (old_code), and the corrected replacement (new_code)

Only mark fixable=true for sql/data fixes that are safe to auto-execute. Code fixes are never auto-executed.

RUNTIME ERRORS (last 48h):
${errorSummary || "No errors recorded yet — system is clean"}

DATABASE SCHEMA:
${schemaSummary.slice(0, 2000)}

SOURCE CODE CONTEXT:
${sourceCodeSection.slice(0, 4000)}

Respond in JSON only:
{
  "analysis": "brief overall assessment of the error patterns",
  "fixes": [
    {
      "title": "short fix title",
      "rootCause": "what causes this",
      "fixType": "sql|config|data|code",
      "fixable": true|false,
      "sqlFix": "SQL statement (if fixType is sql or data)",
      "codeFile": "src/routes/xyz.ts (if fixType is code)",
      "oldCode": "exact existing code to replace",
      "newCode": "replacement code",
      "configKey": "ENV_VAR_NAME (if fixType is config)",
      "configValue": "value to set",
      "description": "what this fix does and why",
      "errorIds": [list of error IDs this fix addresses]
    }
  ],
  "summary": "one-line conclusion about system health"
}`;

  // ── 5. Call GPT ───────────────────────────────────────────────────────────
  const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5.2",
      max_completion_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    return res.status(502).json({ error: "AI service error", detail: errText });
  }

  const aiData = await aiResponse.json() as any;
  const rawContent = aiData.choices?.[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(rawContent); } catch { parsed = { analysis: "Parse error", fixes: [], summary: "AI response malformed" }; }

  // ── 6. Execute safe SQL/data fixes ────────────────────────────────────────
  const results: any[] = [];
  for (const fix of parsed.fixes ?? []) {
    if (fix.fixable && (fix.fixType === "sql" || fix.fixType === "data") && fix.sqlFix) {
      try {
        await db.execute(sql.raw(fix.sqlFix));
        const errorIds: number[] = fix.errorIds ?? [];
        for (const id of errorIds) await markErrorFixed(id, fix.description);
        results.push({ ...fix, applied: true, applyError: null });
      } catch (e: any) {
        results.push({ ...fix, applied: false, applyError: e.message });
      }
    } else {
      results.push({ ...fix, applied: false, applyError: null });
    }
  }

  // ── 7. Audit + respond ────────────────────────────────────────────────────
  const appliedCount = results.filter(f => f.applied).length;
  await logAudit(user, "update", "Diagnostics", null, "AI Code Repair run",
    { errorsAnalyzed: recentErrors.length, fixesGenerated: results.length, autoApplied: appliedCount });

  res.json({
    analysis: parsed.analysis,
    fixes: results,
    summary: parsed.summary,
    totalErrors: recentErrors.length,
    applied: appliedCount,
    errors: recentErrors.slice(0, 10).map(e => ({
      id: e.id,
      method: e.method,
      url: e.url,
      errorType: e.error_type,
      message: e.error_message,
      createdAt: e.created_at,
      resolved: e.resolved,
      autoFixed: e.auto_fixed,
    })),
  });
});

// POST /api/diagnostics/auto-repair
router.post("/auto-repair", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  // ── Step 1: Run pre-repair scan ───────────────────────────────────────────
  const preScan = await runScan();

  interface RepairAction {
    checkId: string;
    checkName: string;
    category: string;
    status: "fixed" | "skipped" | "failed" | "manual";
    action: string;
    detail?: string;
  }

  const repairs: RepairAction[] = [];

  // ── Step 2: Attempt repairs for each failing check ────────────────────────
  for (const check of preScan.checks) {
    if (check.status === "ok") continue;

    switch (check.id) {

      // ── Auto-backup stale or missing → trigger new backup ─────────────────
      case "auto_backup": {
        try {
          const backupJson = await generateBackupJson();
          const sizeBytes  = Buffer.byteLength(backupJson, "utf8");
          await pool.query(`DELETE FROM auto_backups`);
          await pool.query(
            `INSERT INTO auto_backups (data, size_bytes, created_at) VALUES ($1, $2, NOW())`,
            [backupJson, sizeBytes]
          );
          repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "fixed", action: `Triggered a fresh automatic backup (${Math.round(sizeBytes / 1024)} KB)` });
        } catch (e: any) {
          repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "failed", action: "Attempted to create a new backup", detail: e.message });
        }
        break;
      }

      // ── Missing factory config → create defaults ─────────────────────────
      case "cfg_exists": {
        try {
          const existing = await db.execute(sql`SELECT id FROM factory_config LIMIT 1`);
          if ((existing as any).rows?.length === 0) {
            const newKey = `cmms_${randomBytes(20).toString("hex")}`;
            await db.execute(sql`INSERT INTO factory_config (tenant_id, machine_api_key) VALUES (1, ${newKey}) ON CONFLICT DO NOTHING`);
            repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "fixed", action: "Created default factory configuration record with a new API key" });
          } else {
            repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "skipped", action: "Factory config already exists — no action needed" });
          }
        } catch (e: any) {
          repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "failed", action: "Attempted to create default factory config", detail: e.message });
        }
        break;
      }

      // ── Missing API key → auto-generate one ──────────────────────────────
      case "cfg_apikey": {
        try {
          const newKey = `cmms_${randomBytes(20).toString("hex")}`;
          const updated = await db.execute(sql`UPDATE factory_config SET machine_api_key = ${newKey} WHERE machine_api_key IS NULL OR machine_api_key = ''`);
          if ((updated as any).rowCount > 0) {
            repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "fixed", action: "Generated and saved a new machine API key — copy it from OMTP Integration settings" });
          } else {
            repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "skipped", action: "API key already exists" });
          }
        } catch (e: any) {
          repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "failed", action: "Attempted to generate API key", detail: e.message });
        }
        break;
      }

      // ── Stale open downtime records (>7 days) → auto-close them ──────────
      case "stale_downtime": {
        try {
          const result = await db.execute(sql`
            UPDATE downtime_records
            SET status = 'closed',
                end_time = NOW(),
                notes = COALESCE(notes, '') || ' [Auto-closed by System Diagnostics after 7+ days open]'
            WHERE status = 'open'
              AND start_time < NOW() - INTERVAL '7 days'
          `);
          const count = (result as any).rowCount ?? 0;
          repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "fixed", action: `Auto-closed ${count} stale downtime record(s) that were open for 7+ days` });
        } catch (e: any) {
          repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "failed", action: "Attempted to close stale downtime records", detail: e.message });
        }
        break;
      }

      // ── High server memory → trigger GC if available ─────────────────────
      case "server_memory": {
        try {
          if (typeof (global as any).gc === "function") {
            (global as any).gc();
            repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "fixed", action: "Triggered JavaScript garbage collection to free heap memory" });
          } else {
            repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "manual", action: "Memory cannot be freed automatically without --expose-gc flag. Monitor usage and restart if critical." });
          }
        } catch (e: any) {
          repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "failed", action: "GC attempt failed", detail: e.message });
        }
        break;
      }

      // ── Runtime errors → delegate to AI Code Repair ──────────────────────
      case "runtime_errors": {
        const cnt = typeof check.value === "number" ? check.value : "?";
        repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "manual", action: `${cnt} unresolved error(s) detected. Use the "AI Code Repair" button below — it reads your actual source code, diagnoses the root cause, and auto-fixes what it can.` });
        break;
      }

      // ── Issues that require human action ─────────────────────────────────
      case "low_stock": {
        const cnt = typeof check.value === "number" ? check.value : "?";
        repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "manual", action: `${cnt} inventory item(s) are below minimum stock. Open Inventory → Low Stock to create purchase requests.` });
        break;
      }
      case "machines_no_pm": {
        repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "manual", action: "Go to Preventive Maintenance and assign a PM plan to each machine that lacks one." });
        break;
      }
      case "open_broken": {
        repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "manual", action: "Review Broken Machines and resolve or close each open report with a technician." });
        break;
      }
      case "user_count": {
        repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "manual", action: "Go to User Management and add team members (maintenance, inventory, etc.)." });
        break;
      }
      case "audit_activity": {
        repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "manual", action: "No audit events in 24 hours — expected if system is idle. No action needed." });
        break;
      }

      // ── DB connection / table issues → can't auto-repair ─────────────────
      default: {
        if (check.id.startsWith("table_") || check.id === "db_conn") {
          repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "manual", action: "Database structural issues require a DBA or redeployment. Contact IT support." });
        } else {
          repairs.push({ checkId: check.id, checkName: check.name, category: check.category, status: "skipped", action: "No automated repair available for this check." });
        }
        break;
      }
    }
  }

  // ── Step 3: Run post-repair scan ──────────────────────────────────────────
  const postScan = await runScan();

  // ── Step 4: AI summary of repairs ────────────────────────────────────────
  let aiSummary: string | null = null;
  if (baseUrl && apiKey) {
    const fixed   = repairs.filter(r => r.status === "fixed");
    const manual  = repairs.filter(r => r.status === "manual");
    const failed  = repairs.filter(r => r.status === "failed");

    const repairPrompt = `You are a CMMS system AI for an OPPO factory.
The system just ran an auto-repair. Summarize what happened in 2-3 sentences, plain language for factory staff.

PRE-REPAIR SCORE: ${preScan.score}/100
POST-REPAIR SCORE: ${postScan.score}/100

FIXED AUTOMATICALLY (${fixed.length}):
${fixed.length === 0 ? "None" : fixed.map(r => `- ${r.checkName}: ${r.action}`).join("\n")}

NEEDS MANUAL ACTION (${manual.length}):
${manual.length === 0 ? "None" : manual.map(r => `- ${r.checkName}: ${r.action}`).join("\n")}

FAILED TO REPAIR (${failed.length}):
${failed.length === 0 ? "None" : failed.map(r => `- ${r.checkName}: ${r.action} — ${r.detail ?? ""}`).join("\n")}

Respond in JSON: { "summary": "2-3 sentence summary" }`;

    try {
      const aiRes = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-5.2",
          max_completion_tokens: 200,
          messages: [{ role: "user", content: repairPrompt }],
          response_format: { type: "json_object" },
        }),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json() as any;
        const parsed = JSON.parse(aiData.choices?.[0]?.message?.content ?? "{}");
        aiSummary = parsed.summary ?? null;
      }
    } catch { /* non-fatal */ }
  }

  // ── Step 5: Audit log + respond ───────────────────────────────────────────
  const fixed  = repairs.filter(r => r.status === "fixed").length;
  const manual = repairs.filter(r => r.status === "manual").length;
  const failed = repairs.filter(r => r.status === "failed").length;
  await logAudit(user, "update", "Diagnostics", null, "Auto-repair run",
    { preScore: preScan.score, postScore: postScan.score, fixed, manual, failed });

  res.json({ repairs, preScan, postScan, aiSummary });
});

export default router;
