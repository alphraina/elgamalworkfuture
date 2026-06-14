import { Router, type Request, type Response } from "express";
import { readFile as fsReadFile, writeFile as fsWriteFile, readdir } from "fs/promises";
import { execSync } from "child_process";
import { join, resolve, relative } from "path";
import { pool } from "@workspace/db";
import { getCurrentUser } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

const WORKSPACE = "/home/runner/workspace";
const ALLOWED_WRITE_DIRS = [
  "artifacts/api-server/src",
  "artifacts/cmms/src",
  "artifacts/cmms-mobile/src",
  "packages/db/src",
];

// ── Path safety ──────────────────────────────────────────────────────────────

function safeResolve(p: string): string | null {
  const abs = p.startsWith("/") ? p : join(WORKSPACE, p);
  const r = resolve(abs);
  return r.startsWith(WORKSPACE) ? r : null;
}

// ── Tool implementations ─────────────────────────────────────────────────────

async function toolReadFile({ path }: { path: string }): Promise<string> {
  const abs = safeResolve(path);
  if (!abs) return "Error: path is outside the workspace";
  try {
    const content = await fsReadFile(abs, "utf-8");
    const MAX = 10000;
    if (content.length > MAX) return content.slice(0, MAX) + `\n\n... [truncated — ${content.length - MAX} more chars]`;
    return content;
  } catch (e: any) { return `Error: ${e.message}`; }
}

async function toolWriteFile({ path, content }: { path: string; content: string }): Promise<string> {
  const abs = safeResolve(path);
  if (!abs) return "Error: path is outside the workspace";
  const rel = relative(WORKSPACE, abs);
  const allowed = ALLOWED_WRITE_DIRS.some(d => rel.startsWith(d));
  if (!allowed) return `Error: writing to '${rel}' is not permitted. Allowed: ${ALLOWED_WRITE_DIRS.join(", ")}`;
  try {
    await fsWriteFile(abs, content, "utf-8");
    return `OK — wrote ${content.length} chars to ${rel}`;
  } catch (e: any) { return `Error: ${e.message}`; }
}

async function toolListDirectory({ path }: { path: string }): Promise<string> {
  const abs = safeResolve(path);
  if (!abs) return "Error: path is outside the workspace";
  try {
    const entries = await readdir(abs, { withFileTypes: true });
    return entries.map(e => `${e.isDirectory() ? "DIR " : "FILE"} ${e.name}`).join("\n") || "(empty)";
  } catch (e: any) { return `Error: ${e.message}`; }
}

async function toolSearchCode({ pattern, directory }: { pattern: string; directory?: string }): Promise<string> {
  const dir = directory ? (safeResolve(directory) || WORKSPACE) : WORKSPACE;
  try {
    const escaped = pattern.replace(/'/g, "'\\''");
    const out = execSync(
      `grep -rn --include="*.ts" --include="*.tsx" --include="*.js" -l '${escaped}' "${dir}" 2>/dev/null | head -30`,
      { encoding: "utf-8", timeout: 8000 }
    );
    if (!out.trim()) return "No matches found";
    return out.trim();
  } catch { return "No matches found"; }
}

async function toolSearchCodeContent({ pattern, directory, context_lines }: { pattern: string; directory?: string; context_lines?: number }): Promise<string> {
  const dir = directory ? (safeResolve(directory) || WORKSPACE) : WORKSPACE;
  const ctx = context_lines ?? 2;
  try {
    const escaped = pattern.replace(/'/g, "'\\''");
    const out = execSync(
      `grep -rn --include="*.ts" --include="*.tsx" -C ${ctx} '${escaped}' "${dir}" 2>/dev/null | head -100`,
      { encoding: "utf-8", timeout: 8000 }
    );
    if (!out.trim()) return "No matches found";
    return out.trim();
  } catch { return "No matches found"; }
}

async function toolExecuteSql({ query }: { query: string }): Promise<string> {
  const q = query.trim();
  if (!/^(select|with)\s/i.test(q)) return "Error: only SELECT / WITH queries are allowed for safety";
  try {
    const result = await pool.query(q);
    return JSON.stringify(result.rows.slice(0, 100), null, 2);
  } catch (e: any) { return `SQL Error: ${e.message}`; }
}

async function toolGetDatabaseSchema(): Promise<string> {
  try {
    const result = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);
    interface ColRow { table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null }
    const tables: Record<string, string[]> = {};
    for (const row of result.rows as ColRow[]) {
      if (!tables[row.table_name]) tables[row.table_name] = [];
      tables[row.table_name].push(`  ${row.column_name} ${row.data_type}${row.is_nullable === "NO" ? " NOT NULL" : ""}${row.column_default ? ` DEFAULT ${row.column_default}` : ""}`);
    }
    return Object.entries(tables).map(([t, cols]) => `TABLE ${t}:\n${cols.join("\n")}`).join("\n\n");
  } catch (e: any) { return `Error: ${e.message}`; }
}

// ── Tool dispatcher ───────────────────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case "read_file":            return toolReadFile(args as any);
    case "write_file":           return toolWriteFile(args as any);
    case "list_directory":       return toolListDirectory(args as any);
    case "search_code":          return toolSearchCode(args as any);
    case "search_code_content":  return toolSearchCodeContent(args as any);
    case "execute_sql":          return toolExecuteSql(args as any);
    case "get_database_schema":  return toolGetDatabaseSchema();
    default:                     return `Unknown tool: ${name}`;
  }
}

// ── OpenAI tool definitions ───────────────────────────────────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the full contents of a file. Always do this before editing to see the current state. Paths are relative to /home/runner/workspace or absolute.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write full content to a file. ALWAYS read the file first. Writes the complete file — not a patch. Only allowed in src directories.",
      parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "List files and subdirectories at a path.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_code",
      description: "Search for a text pattern in .ts/.tsx source files. Returns file paths that match (not content).",
      parameters: { type: "object", properties: { pattern: { type: "string", description: "grep regex pattern" }, directory: { type: "string", description: "optional directory to restrict search" } }, required: ["pattern"] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_code_content",
      description: "Search for a pattern and return the matching lines WITH surrounding context. Useful to find exact code snippets.",
      parameters: { type: "object", properties: { pattern: { type: "string" }, directory: { type: "string" }, context_lines: { type: "number", description: "lines of context around each match (default 2)" } }, required: ["pattern"] },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_sql",
      description: "Run a read-only SELECT query against the PostgreSQL database. Returns up to 100 rows as JSON.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_database_schema",
      description: "Get the full PostgreSQL database schema — all tables and columns with types. Call this when you need to understand the data model.",
      parameters: { type: "object", properties: {} },
    },
  },
];

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Midea CMMS AI Code Assistant — an expert full-stack developer embedded inside the Midea Factory CMMS system. You have direct read/write access to the codebase, exactly like the original developer.

WORKSPACE LAYOUT:
- artifacts/api-server/src/    — Backend (TypeScript + Express + Drizzle ORM + PostgreSQL)
  - routes/                    — API route handlers (one file per feature)
  - lib/                       — Shared utilities (audit.ts, current-user.ts, etc.)
  - index.ts                   — Server entry point
  - app.ts                     — Express app setup
- artifacts/cmms/src/          — Frontend (React 18 + TypeScript + Vite + Tailwind CSS + Wouter)
  - pages/                     — Page components
  - components/                — Shared UI components (layout.tsx = nav/sidebar)
  - contexts/                  — React contexts
  - hooks/                     — Custom hooks
- packages/db/src/             — Drizzle ORM schema (schema.ts) + shared DB connection

KEY PATTERNS:
- Backend auth: const user = await getCurrentUser(req); if (!user) return res.status(401).json({error:"Unauthorized"});
- Backend audit: await logAudit(user, "ACTION", "entity", entityId, "label", {data});  (6 args, import from "../lib/audit.js")
- Backend imports use .js extension (ESM): import { db } from "@workspace/db"; import { getCurrentUser } from "../lib/current-user.js";
- Frontend API calls: const BASE = import.meta.env.BASE_URL.replace(/\\/$/, ""); then fetch(\`\${BASE}/api/...\`, {credentials:"include"})
- Frontend imports: no .js extension; use @/ for src aliases
- CSS: Tailwind dark theme — follow existing component patterns, use bg-white/5, border-white/10, text-muted-foreground etc.
- Recharts charts: NEVER use CSS variables in fill/stroke — use hardcoded hex like "#3b82f6"
- Navigation: add routes in artifacts/cmms/src/App.tsx and nav items in artifacts/cmms/src/components/layout.tsx
- jsonb columns in DB: audit_logs.changes, factory_config.* — use sql\`\` or raw pool.query for these

WORKFLOW:
1. Always READ files before editing — never guess content
2. Use search_code/search_code_content to find where things are defined before jumping to edit
3. When writing a file, write the COMPLETE file (not a partial patch)
4. Frontend changes apply instantly via Vite HMR. Backend changes require server restart (warn the user).
5. Database schema: check get_database_schema or read packages/db/src/schema.ts
6. Be precise and minimal — make the smallest change that achieves the goal

You are talking directly to the system administrator (Ahmed El-Gamal / admin role). Be concise, technical, and action-oriented. After making changes, summarize exactly what you changed and any next steps.`;

// ── Chat endpoint (SSE) ───────────────────────────────────────────────────────

router.post("/chat", async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { messages = [] } = req.body as { messages: Array<{ role: string; content: string }> };
  if (!Array.isArray(messages)) {
    res.status(400).json({ error: "messages must be an array" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (ev: object) => res.write(`data: ${JSON.stringify(ev)}\n\n`);

  const BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const API_KEY  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!BASE_URL || !API_KEY) {
    send({ type: "error", message: "OpenAI integration not configured. Please add the OpenAI integration in Replit." });
    send({ type: "done" });
    res.end();
    return;
  }

  const conversation: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ];

  const MAX_ITER = 12;
  let iter = 0;

  try {
    while (iter < MAX_ITER) {
      iter++;

      const apiRes = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: "gpt-5.2",
          messages: conversation,
          tools: TOOLS,
          tool_choice: "auto",
          max_completion_tokens: 4096,
        }),
      });

      if (!apiRes.ok) {
        const t = await apiRes.text();
        send({ type: "error", message: `AI API error ${apiRes.status}: ${t.slice(0, 300)}` });
        break;
      }

      const data = await apiRes.json() as any;
      const choice = data.choices?.[0];
      if (!choice) { send({ type: "error", message: "No response returned from AI" }); break; }

      const msg = choice.message;
      conversation.push(msg);

      if (!msg.tool_calls?.length) {
        send({ type: "message", content: msg.content ?? "" });
        break;
      }

      for (const tc of msg.tool_calls) {
        let args: Record<string, any> = {};
        try { args = JSON.parse(tc.function.arguments); } catch {}

        send({ type: "tool_start", id: tc.id, name: tc.function.name, args });

        const result = await executeTool(tc.function.name, args);
        const preview = result.length > 800 ? result.slice(0, 800) + "…" : result;
        send({ type: "tool_end", id: tc.id, name: tc.function.name, preview });

        conversation.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
    }

    if (iter >= MAX_ITER) {
      send({ type: "error", message: "The AI took too many steps. Please simplify your request." });
    }

    // Log that the AI assistant was used
    await logAudit(user, "AI_ASSISTANT_CHAT", "ai_assistant", "session", "AI Code Assistant", { messageCount: messages.length + 1 });

  } catch (e: any) {
    send({ type: "error", message: e.message ?? "Unexpected error" });
  }

  send({ type: "done" });
  res.end();
});

export default router;
