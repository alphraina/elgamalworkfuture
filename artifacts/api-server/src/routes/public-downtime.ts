import { Router } from "express";
import { db } from "@workspace/db";
import {
  downtimeTable,
  productionLinesTable,
  productionShiftSetupsTable,
  siteSettingsTable,
  notificationsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { sendPushToUser } from "../lib/push.js";

const router = Router();

async function getSettings() {
  const rows = await db.select().from(siteSettingsTable);
  if (rows.length === 0) {
    const [created] = await db.insert(siteSettingsTable).values({ signupEnabled: false, publicDowntimeEnabled: false }).returning();
    return created;
  }
  return rows[0];
}

function currentShift(): "day" | "night" {
  const hour = new Date().getHours();
  // Night shift: 23:00–23:59 or 00:00–06:59
  if (hour >= 23 || hour < 7) return "night";
  // Day shift: 08:00–22:59
  return "day";
}

router.get("/status", async (_req, res) => {
  const settings = await getSettings();
  const lines = await db.select({ id: productionLinesTable.id, name: productionLinesTable.name, team: productionLinesTable.team })
    .from(productionLinesTable)
    .where(eq(productionLinesTable.isActive, true))
    .orderBy(productionLinesTable.id);
  res.json({ publicDowntimeEnabled: settings.publicDowntimeEnabled, lines });
});

router.post("/report", async (req, res) => {
  const settings = await getSettings();
  if (!settings.publicDowntimeEnabled) {
    return res.status(403).json({ error: "Public downtime reporting is disabled" });
  }

  const { machineName, lineId, reporterName, machineCode, reporterTeam } = req.body;
  if (!machineName || !lineId || !reporterName || !reporterTeam) {
    return res.status(400).json({ error: "machineName, lineId, reporterName and reporterTeam are required" });
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const shift = currentShift();

  const [record] = await db.insert(downtimeTable).values({
    machineName,
    machineCode: machineCode ?? null,
    lineId: Number(lineId),
    startTime: now,
    reason: "Machine issue reported by floor staff",
    category: "other",
    recordedById: null,
    reporterName,
    isPublicReport: true,
    status: "ongoing",
    notes: `Team: ${reporterTeam}`,
  }).returning();

  const lineRows = await db.select({ name: productionLinesTable.name })
    .from(productionLinesTable)
    .where(eq(productionLinesTable.id, Number(lineId)));
  const lineName = lineRows[0]?.name ?? `Line ${lineId}`;

  const setupRows = await db.select({ assignedUserId: productionShiftSetupsTable.assignedUserId })
    .from(productionShiftSetupsTable)
    .where(
      and(
        eq(productionShiftSetupsTable.lineId, Number(lineId)),
        eq(productionShiftSetupsTable.date, today),
        eq(productionShiftSetupsTable.shift, shift),
      )
    );

  const assignedUserId = setupRows[0]?.assignedUserId ?? null;

  if (assignedUserId) {
    const userRows = await db.select({ fullName: usersTable.fullName })
      .from(usersTable)
      .where(eq(usersTable.id, assignedUserId));
    const userName = userRows[0]?.fullName ?? "Team Member";

    await db.insert(notificationsTable).values({
      userId: assignedUserId,
      title: "Machine Issue Reported",
      message: `${reporterName} (${reporterTeam} team) reported a machine issue: "${machineName}" on ${lineName}. Please investigate.`,
      type: "general",
      relatedId: record.id,
    });

    await sendPushToUser(
      assignedUserId,
      "Machine Issue Reported",
      `${reporterName}: "${machineName}" down on ${lineName}. Please respond.`,
      { downtimeId: record.id, screen: "downtime" }
    );
  }

  res.status(201).json({
    id: record.id,
    machineName: record.machineName,
    lineName,
    startTime: record.startTime.toISOString(),
    assignedUserId,
    message: assignedUserId
      ? "Report submitted. The line operator has been notified."
      : "Report submitted. A supervisor will be notified.",
  });
});

export default router;
