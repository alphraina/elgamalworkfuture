import { Router } from "express";
import { db } from "@workspace/db";
import {
  machineRegistryTable,
  machineNotesTable,
  productionLinesTable,
  usersTable,
  downtimeTable,
  kpiSettingsTable,
  machineDataLogsTable,
} from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getCurrentUser } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

const ALL_ROLES = ["admin", "manager", "teamleader", "maintenance", "inventory"] as const;
const DEFAULT_ALLOWED = ["admin", "manager"];

async function getAllowedRoles(): Promise<string[]> {
  const [settings] = await db.select().from(kpiSettingsTable).limit(1);
  return settings?.machineRegistryRoles ?? DEFAULT_ALLOWED;
}

async function formatMachine(m: typeof machineRegistryTable.$inferSelect) {
  const line = m.lineId
    ? (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, m.lineId)))[0]
    : null;
  const createdBy = m.createdById
    ? (await db.select().from(usersTable).where(eq(usersTable.id, m.createdById)))[0]
    : null;
  return {
    id: m.id,
    name: m.name,
    code: m.code,
    model: m.model,
    location: m.location,
    team: m.team ?? null,
    lineId: m.lineId,
    lineName: line?.name ?? null,
    isActive: m.isActive,
    createdById: m.createdById,
    createdByName: createdBy?.fullName ?? null,
    createdAt: m.createdAt?.toISOString(),
    stationNumber: (m as any).stationNumber ?? null,
    stationName: (m as any).stationName ?? null,
    machineType: (m as any).machineType ?? null,
    machineIp: (m as any).machineIp ?? null,
    machineToken: (m as any).machineToken ?? null,
  };
}

function isStrictTeamLeader(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return false;
  const all = [user.role, ...(user.extraRoles ?? [])];
  return all.includes("teamleader") && !all.includes("admin") && !all.includes("manager");
}

router.get("/settings", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const allowedRoles = await getAllowedRoles();
  res.json({ allowedRoles, allRoles: ALL_ROLES });
});

router.put("/settings", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role !== "admin") return res.status(403).json({ error: "Forbidden" });

  const { allowedRoles } = req.body;
  if (!Array.isArray(allowedRoles)) return res.status(400).json({ error: "allowedRoles must be an array" });
  const valid = allowedRoles.filter((r: any) => ALL_ROLES.includes(r));
  if (!valid.includes("admin")) valid.push("admin");

  const [existing] = await db.select().from(kpiSettingsTable).limit(1);
  if (existing) {
    await db.update(kpiSettingsTable).set({ machineRegistryRoles: valid }).where(eq(kpiSettingsTable.id, existing.id));
  } else {
    await db.insert(kpiSettingsTable).values({ machineRegistryRoles: valid });
  }
  res.json({ allowedRoles: valid });
});

router.post("/import", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const allowedRoles = await getAllowedRoles();
  if (!allowedRoles.includes(user.role)) return res.status(403).json({ error: "Forbidden" });

  const { machines } = req.body;
  if (!Array.isArray(machines) || machines.length === 0) {
    return res.status(400).json({ error: "machines array is required" });
  }

  let added = 0;
  const skipped: string[] = [];

  for (const m of machines) {
    const { name, code, model, location, lineId, team } = m;
    if (!name || !code) {
      skipped.push(code ?? "(no code)");
      continue;
    }
    const existing = await db
      .select()
      .from(machineRegistryTable)
      .where(eq(machineRegistryTable.code, String(code)));
    if (existing.length > 0) {
      skipped.push(String(code));
      continue;
    }
    await db.insert(machineRegistryTable).values({
      name: String(name),
      code: String(code),
      model: model ? String(model) : null,
      location: location ? String(location) : null,
      team: team ? String(team) : null,
      lineId: lineId ? Number(lineId) : null,
      createdById: user.id,
      isActive: true,
    });
    added++;
  }

  res.json({ added, skipped, total: machines.length });
});

router.get("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  let machines = await db
    .select()
    .from(machineRegistryTable)
    .orderBy(desc(machineRegistryTable.createdAt));

  // Team leaders only see machines from their team
  if (isStrictTeamLeader(user) && user.team) {
    machines = machines.filter(m => m.team === user.team || !m.team);
  }

  const formatted = await Promise.all(machines.map(formatMachine));
  res.json(formatted);
});

router.get("/by-code/:code", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const [machine] = await db
    .select()
    .from(machineRegistryTable)
    .where(eq(machineRegistryTable.code, req.params.code));
  if (!machine) return res.status(404).json({ error: "Machine not found" });
  res.json(await formatMachine(machine));
});

router.get("/:id/history", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const machineId = Number(req.params.id);
  const [machine] = await db
    .select()
    .from(machineRegistryTable)
    .where(eq(machineRegistryTable.id, machineId));
  if (!machine) return res.status(404).json({ error: "Machine not found" });

  const [rawNotes, rawDowntime] = await Promise.all([
    db.select().from(machineNotesTable).where(eq(machineNotesTable.machineId, machineId)).orderBy(desc(machineNotesTable.createdAt)),
    machine.code
      ? db.select().from(downtimeTable).where(eq(downtimeTable.machineCode, machine.code)).orderBy(desc(downtimeTable.startTime))
      : Promise.resolve([]),
  ]);

  const notes = await Promise.all(
    rawNotes.map(async (n) => {
      const author = n.createdById
        ? (await db.select().from(usersTable).where(eq(usersTable.id, n.createdById)))[0]
        : null;
      return {
        type: "note" as const,
        id: n.id,
        content: n.content,
        createdByName: author?.fullName ?? null,
        createdAt: n.createdAt?.toISOString(),
      };
    })
  );

  const downtime = await Promise.all(
    rawDowntime.map(async (d) => {
      const line = d.lineId
        ? (await db.select().from(productionLinesTable).where(eq(productionLinesTable.id, d.lineId)))[0]
        : null;
      const reporter = d.recordedById
        ? (await db.select().from(usersTable).where(eq(usersTable.id, d.recordedById)))[0]
        : null;
      return {
        type: "downtime" as const,
        id: d.id,
        reason: d.reason,
        rootCause: d.rootCause,
        category: d.category,
        status: d.status,
        durationMinutes: d.durationMinutes,
        lineName: line?.name ?? null,
        recordedByName: reporter?.fullName ?? null,
        startTime: d.startTime?.toISOString(),
        endTime: d.endTime?.toISOString() ?? null,
        createdAt: d.startTime?.toISOString(),
      };
    })
  );

  const timeline = [...notes, ...downtime].sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  );

  res.json({ machine: await formatMachine(machine), timeline });
});

router.post("/:id/notes", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const machineId = Number(req.params.id);
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Note content is required" });

  const [note] = await db
    .insert(machineNotesTable)
    .values({ machineId, content: content.trim(), createdById: user.id })
    .returning();

  const author = user;
  res.status(201).json({
    type: "note",
    id: note.id,
    content: note.content,
    createdByName: author.fullName ?? null,
    createdAt: note.createdAt?.toISOString(),
  });
});

router.delete("/:id/notes/:noteId", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const noteId = Number(req.params.noteId);
  const [note] = await db.select().from(machineNotesTable).where(eq(machineNotesTable.id, noteId));
  if (!note) return res.status(404).json({ error: "Note not found" });

  if (note.createdById !== user.id && !["admin", "manager"].includes(user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  await db.delete(machineNotesTable).where(eq(machineNotesTable.id, noteId));
  res.json({ success: true });
});

router.post("/", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const allowedRoles = await getAllowedRoles();
  if (!allowedRoles.includes(user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { name, code, model, location, lineId, team, stationNumber, stationName, machineType, machineIp } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: "Name and code are required" });
  }

  const existing = await db
    .select()
    .from(machineRegistryTable)
    .where(eq(machineRegistryTable.code, code));
  if (existing.length > 0) {
    return res.status(409).json({ error: "A machine with this code already exists" });
  }

  // Team leaders auto-assign their team
  const resolvedTeam = isStrictTeamLeader(user) ? (user.team ?? team ?? null) : (team || null);

  const [machine] = await db
    .insert(machineRegistryTable)
    .values({
      name,
      code,
      model: model || null,
      location: location || null,
      team: resolvedTeam,
      lineId: lineId ? Number(lineId) : null,
      stationNumber: stationNumber ? Number(stationNumber) : null,
      stationName: stationName || null,
      machineType: machineType || null,
      machineIp: machineIp || null,
      createdById: user.id,
      isActive: true,
    })
    .returning();

  await logAudit(user, "create", "Machine", machine.id, `${name} [${code}]`, { name, code, model, location, team: resolvedTeam, lineId, stationNumber, stationName, machineType, machineIp });
  res.status(201).json(await formatMachine(machine));
});

router.put("/:id", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!["admin", "manager"].includes(user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { name, model, location, lineId, team, isActive, stationNumber, stationName, machineType, machineIp } = req.body;
  const [updated] = await db
    .update(machineRegistryTable)
    .set({
      ...(name && { name }),
      ...(model !== undefined && { model: model || null }),
      ...(location !== undefined && { location: location || null }),
      ...(team !== undefined && { team: team || null }),
      ...(lineId !== undefined && { lineId: lineId ? Number(lineId) : null }),
      ...(isActive !== undefined && { isActive }),
      ...(stationNumber !== undefined && { stationNumber: stationNumber ? Number(stationNumber) : null }),
      ...(stationName !== undefined && { stationName: stationName || null }),
      ...(machineType !== undefined && { machineType: machineType || null }),
      ...(machineIp !== undefined && { machineIp: machineIp || null }),
    })
    .where(eq(machineRegistryTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Machine not found" });
  await logAudit(user, "update", "Machine", updated.id, `${updated.name} [${updated.code}]`, { name, model, location, team, lineId, isActive });
  res.json(await formatMachine(updated));
});

router.patch("/:id/activate", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!["admin", "manager"].includes(user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const [updated] = await db
    .update(machineRegistryTable)
    .set({ isActive: true })
    .where(eq(machineRegistryTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Machine not found" });
  await logAudit(user, "update", "Machine", updated.id, `${updated.name} [${updated.code}]`, { isActive: true });
  res.json(await formatMachine(updated));
});

router.patch("/:id/deactivate", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!["admin", "manager"].includes(user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const [updated] = await db
    .update(machineRegistryTable)
    .set({ isActive: false })
    .where(eq(machineRegistryTable.id, Number(req.params.id)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Machine not found" });
  await logAudit(user, "update", "Machine", updated.id, `${updated.name} [${updated.code}]`, { isActive: false });
  res.json({ success: true });
});

router.delete("/:id", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!["admin", "manager"].includes(user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const id = Number(req.params.id);
  const [machine] = await db.select().from(machineRegistryTable).where(eq(machineRegistryTable.id, id));
  if (!machine) return res.status(404).json({ error: "Machine not found" });

  await db.delete(machineNotesTable).where(eq(machineNotesTable.machineId, id));
  await db.update(machineDataLogsTable).set({ machineRegistryId: null } as any).where(eq(machineDataLogsTable.machineRegistryId as any, id));
  await db.execute(sql`UPDATE machine_temp_assignments SET machine_registry_id = NULL WHERE machine_registry_id = ${id}`);
  await db.delete(machineRegistryTable).where(eq(machineRegistryTable.id, id));

  await logAudit(user, "delete", "Machine", id, `${machine.name} [${machine.code}]`, { action: "Permanently deleted" });
  res.json({ success: true });
});

export default router;
