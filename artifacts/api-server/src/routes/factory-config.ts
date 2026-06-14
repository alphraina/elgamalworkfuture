import { Router } from "express";
import { db } from "@workspace/db";
import { factoryConfigTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "../lib/current-user.js";
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
  });
});

router.put("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });

  const { roleNames, sectionNames, sectionPerms, sectionVideos, hiddenSections, teamNames, systemName, factoryType, omtpPathTemplate, omtpColumns, downtimeFailThreshold } = req.body ?? {};

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
