import { Router } from "express";
import { db } from "@workspace/db";
import { factoryConfigTable, tasksTable, pmPlansTable } from "@workspace/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { getCurrentUser, isAdmin as checkAdmin } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";
import { randomBytes } from "crypto";

const router = Router();

function generateApiKey(): string {
  return "cmms_" + randomBytes(24).toString("hex");
}

async function getOrCreateConfig() {
  const rows = await db.select().from(factoryConfigTable).limit(1);
  if (rows[0]) return rows[0];
  const [created] = await db.insert(factoryConfigTable).values({
    tenantId: 1,
    roleNames: {},
    sectionNames: {},
    sectionPerms: {},
    machineApiKey: generateApiKey(),
  }).returning();
  return created;
}

/** Returns the next working day after `dateStr` that isn't a holiday or weekend */
function nextWorkingDay(dateStr: string, holidays: string[]): string {
  const holidaySet = new Set(holidays);
  const d = new Date(dateStr + "T12:00:00Z"); // noon UTC to avoid DST issues
  d.setUTCDate(d.getUTCDate() + 1);
  while (
    d.getUTCDay() === 0 || // Sunday
    d.getUTCDay() === 6 || // Saturday
    holidaySet.has(d.toISOString().split("T")[0])
  ) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString().split("T")[0];
}

router.get("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const cfg = await getOrCreateConfig();

  res.json({
    roleNames:             cfg.roleNames ?? {},
    sectionNames:          cfg.sectionNames ?? {},
    sectionPerms:          cfg.sectionPerms ?? {},
    sectionVideos:         cfg.sectionVideos ?? {},
    hiddenSections:        cfg.hiddenSections ?? {},
    teamNames:             cfg.teamNames ?? {},
    systemName:            cfg.systemName ?? "",
    factoryType:           cfg.factoryType ?? "",
    machineApiKey:         user.role === "admin" ? (cfg.machineApiKey ?? null) : undefined,
    omtpPathTemplate:      cfg.omtpPathTemplate ?? null,
    omtpColumns:           cfg.omtpColumns ?? null,
    downtimeFailThreshold: cfg.downtimeFailThreshold ?? 3,
    holidays:              (cfg as any).holidays ?? [],
  });
});

router.put("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const { roleNames, sectionNames, sectionPerms, sectionVideos, hiddenSections, teamNames, systemName, factoryType, omtpPathTemplate, omtpColumns, downtimeFailThreshold, holidays } = req.body ?? {};

  const threshold = typeof downtimeFailThreshold === "number" && downtimeFailThreshold >= 1
    ? Math.round(downtimeFailThreshold) : undefined;

  const existing = await db.select().from(factoryConfigTable).limit(1);
  if (existing.length > 0) {
    await db.update(factoryConfigTable).set({
      ...(roleNames              !== undefined ? { roleNames }              : {}),
      ...(sectionNames           !== undefined ? { sectionNames }           : {}),
      ...(sectionPerms           !== undefined ? { sectionPerms }           : {}),
      ...(sectionVideos          !== undefined ? { sectionVideos }          : {}),
      ...(hiddenSections         !== undefined ? { hiddenSections }         : {}),
      ...(teamNames              !== undefined ? { teamNames }              : {}),
      ...(systemName             !== undefined ? { systemName }             : {}),
      ...(factoryType            !== undefined ? { factoryType }            : {}),
      ...(omtpPathTemplate       !== undefined ? { omtpPathTemplate }       : {}),
      ...(omtpColumns            !== undefined ? { omtpColumns }            : {}),
      ...(threshold              !== undefined ? { downtimeFailThreshold: threshold } : {}),
      ...(holidays               !== undefined ? { holidays: Array.isArray(holidays) ? holidays : [] } : {}),
    }).where(eq(factoryConfigTable.id, existing[0].id));
  } else {
    await db.insert(factoryConfigTable).values({
      tenantId: 1,
      roleNames:             roleNames ?? {},
      sectionNames:          sectionNames ?? {},
      sectionPerms:          sectionPerms ?? {},
      sectionVideos:         sectionVideos ?? {},
      hiddenSections:        hiddenSections ?? {},
      teamNames:             teamNames ?? {},
      systemName:            systemName ?? "",
      factoryType:           factoryType ?? "",
      machineApiKey:         generateApiKey(),
      omtpPathTemplate:      omtpPathTemplate ?? null,
      omtpColumns:           omtpColumns ?? null,
      downtimeFailThreshold: threshold ?? 3,
    });
  }

  const changedFields = Object.keys({ roleNames, sectionNames, sectionPerms, sectionVideos, hiddenSections, teamNames, systemName, factoryType, omtpPathTemplate, omtpColumns, downtimeFailThreshold }).filter(k => (req.body ?? {})[k] !== undefined);
  await logAudit(user, "update", "FactoryConfig", null, "Factory Configuration", { updatedFields: changedFields });

  res.json({ ok: true });
});

/* Delay all pending tasks + active PM plans from a holiday date to next working day */
router.post("/delay-tasks", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const { date } = req.body ?? {};
  if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date (YYYY-MM-DD) is required" });
  }

  const cfg = await getOrCreateConfig();
  const holidays = ((cfg as any).holidays ?? []) as string[];
  const newDate = nextWorkingDay(date, holidays);
  const newDateTs = new Date(newDate + "T00:00:00Z");

  // Delay tasks: all non-completed, non-cancelled tasks with due_date on the given date
  const taskResult = await db.execute(
    sql`UPDATE tasks SET due_date = ${newDateTs}
        WHERE DATE(due_date AT TIME ZONE 'UTC') = ${date}::date
          AND status NOT IN ('completed', 'cancelled')`
  );

  // Delay PM plans: all active plans with next_due_date on the given date
  const pmResult = await db.execute(
    sql`UPDATE pm_plans SET next_due_date = ${newDateTs}
        WHERE DATE(next_due_date AT TIME ZONE 'UTC') = ${date}::date
          AND status NOT IN ('completed', 'paused')`
  );

  const tasksDelayed = (taskResult as any).rowCount ?? 0;
  const pmDelayed   = (pmResult as any).rowCount ?? 0;

  await logAudit(user, "update", "FactoryConfig", null, `Holiday delay: ${date} → ${newDate}`, {
    date, newDate, tasksDelayed, pmDelayed,
  });

  res.json({ ok: true, date, newDate, tasksDelayed, pmDelayed });
});

/* Preview how many tasks/PM plans fall on a holiday date (without modifying anything) */
router.get("/delay-tasks/preview", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const { date } = req.query as { date?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date (YYYY-MM-DD) query param required" });
  }

  const taskResult = await db.execute(
    sql`SELECT COUNT(*) AS cnt FROM tasks
        WHERE DATE(due_date AT TIME ZONE 'UTC') = ${date}::date
          AND status NOT IN ('completed', 'cancelled')`
  );
  const pmResult = await db.execute(
    sql`SELECT COUNT(*) AS cnt FROM pm_plans
        WHERE DATE(next_due_date AT TIME ZONE 'UTC') = ${date}::date
          AND status NOT IN ('completed', 'paused')`
  );

  res.json({
    tasksAffected: Number((taskResult as any).rows?.[0]?.cnt ?? 0),
    pmAffected:    Number((pmResult   as any).rows?.[0]?.cnt ?? 0),
  });
});

/* Set or clear a video URL for one section */
router.put("/section-video/:sectionKey", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const { sectionKey } = req.params;
  const { url } = req.body ?? {};

  const existing = await db.select().from(factoryConfigTable).limit(1);
  const cfg = existing[0];
  if (!cfg) return res.status(404).json({ error: "Config not found" });

  const current: Record<string, string> = (cfg.sectionVideos as Record<string, string>) ?? {};
  let updated: Record<string, string>;
  if (url && typeof url === "string" && url.trim()) {
    updated = { ...current, [sectionKey]: url.trim() };
  } else {
    updated = { ...current };
    delete updated[sectionKey];
  }

  await db.update(factoryConfigTable)
    .set({ sectionVideos: updated })
    .where(eq(factoryConfigTable.id, cfg.id));

  await logAudit(user, "update", "FactoryConfig", null, `Section video: ${sectionKey}`, { sectionKey, url: url || null, action: url ? "set" : "cleared" });

  res.json({ ok: true, sectionVideos: updated });
});

/* Regenerate machine API key */
router.post("/regenerate-api-key", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const newKey = generateApiKey();
  const existing = await db.select().from(factoryConfigTable).limit(1);
  if (existing.length > 0) {
    await db.update(factoryConfigTable).set({ machineApiKey: newKey })
      .where(eq(factoryConfigTable.id, existing[0].id));
  } else {
    await db.insert(factoryConfigTable).values({ tenantId: 1, machineApiKey: newKey });
  }

  await logAudit(user, "update", "FactoryConfig", null, "Machine API Key regenerated", { action: "regenerate_api_key" });

  res.json({ machineApiKey: newKey });
});

/* Public getter for machine-data route to validate keys */
export async function getMachineApiKey(): Promise<string | null> {
  const rows = await db.select({ machineApiKey: factoryConfigTable.machineApiKey }).from(factoryConfigTable).limit(1);
  return rows[0]?.machineApiKey ?? null;
}

/* Public getter for auto-downtime threshold */
export async function getDowntimeFailThreshold(): Promise<number> {
  const rows = await db.select({ downtimeFailThreshold: factoryConfigTable.downtimeFailThreshold }).from(factoryConfigTable).limit(1);
  return rows[0]?.downtimeFailThreshold ?? 3;
}

/* Public getter for OMTP config used by downloads route */
export async function getOmtpConfig(): Promise<{ pathTemplate: string | null; columns: Record<string, string> | null }> {
  const rows = await db
    .select({ omtpPathTemplate: factoryConfigTable.omtpPathTemplate, omtpColumns: factoryConfigTable.omtpColumns })
    .from(factoryConfigTable).limit(1);
  return {
    pathTemplate: rows[0]?.omtpPathTemplate ?? null,
    columns:      rows[0]?.omtpColumns as Record<string, string> | null ?? null,
  };
}

export default router;
