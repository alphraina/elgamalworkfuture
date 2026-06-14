import { Router } from "express";
import { db } from "@workspace/db";
import { vacationRequestsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, isMaintenance, isInventory, isManager, isTeamLeader, isAdmin } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

async function formatVacation(v: typeof vacationRequestsTable.$inferSelect) {
  const user = v.userId ? (await db.select().from(usersTable).where(eq(usersTable.id, v.userId)))[0] : null;
  const managerApprover = v.managerApprovedById ? (await db.select().from(usersTable).where(eq(usersTable.id, v.managerApprovedById)))[0] : null;
  const tlApprover = v.teamLeaderApprovedById ? (await db.select().from(usersTable).where(eq(usersTable.id, v.teamLeaderApprovedById)))[0] : null;

  return {
    id: v.id,
    userId: v.userId,
    userName: user?.fullName ?? null,
    userRole: user?.role ?? null,
    userTeam: user?.team ?? null,
    startDate: v.startDate,
    endDate: v.endDate,
    reason: v.reason,
    status: v.status,
    managerApproved: v.managerApproved,
    managerApprovedById: v.managerApprovedById,
    managerApprovedByName: managerApprover?.fullName ?? null,
    managerApprovedAt: v.managerApprovedAt?.toISOString() ?? null,
    teamLeaderApproved: v.teamLeaderApproved,
    teamLeaderApprovedById: v.teamLeaderApprovedById,
    teamLeaderApprovedByName: tlApprover?.fullName ?? null,
    teamLeaderApprovedAt: v.teamLeaderApprovedAt?.toISOString() ?? null,
    createdAt: v.createdAt?.toISOString(),
  };
}

function computeStatus(managerApproved: boolean | null, tlApproved: boolean | null): string {
  if (managerApproved === false || tlApproved === false) return "rejected";
  if (managerApproved === true && tlApproved === true) return "approved";
  return "pending";
}

function isStrictTeamLeader(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return false;
  const all = [user.role, ...(user.extraRoles ?? [])];
  return all.includes("teamleader") && !all.includes("admin") && !all.includes("manager");
}

router.get("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  let records = await db.select().from(vacationRequestsTable).orderBy(vacationRequestsTable.createdAt);

  if (!isAdmin(currentUser) && !isManager(currentUser) && !isTeamLeader(currentUser)) {
    records = records.filter((r) => r.userId === currentUser!.id);
  } else if (isStrictTeamLeader(currentUser)) {
    // Team leader: only see vacations from their team
    const team = currentUser!.team;
    if (team) {
      const teamMembers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.team, team));
      const teamIds = new Set(teamMembers.map(m => m.id));
      records = records.filter(r => teamIds.has(r.userId));
    }
  }

  const formatted = await Promise.all(records.map(formatVacation));
  res.json(formatted);
});

router.post("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ error: "Not authenticated" });

  const { startDate, endDate, reason } = req.body;
  if (!startDate || !endDate || !reason) {
    return res.status(400).json({ error: "Start date, end date, and reason are required" });
  }

  const [record] = await db.insert(vacationRequestsTable).values({
    userId: currentUser.id,
    startDate,
    endDate,
    reason,
    status: "pending",
  }).returning();

  await logAudit(currentUser, "create", "Vacation Request", record.id, `${currentUser.fullName} (${startDate} → ${endDate})`, { startDate, endDate, reason });

  return res.status(201).json(await formatVacation(record));
});

router.put("/:id/approve", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ error: "Not authenticated" });

  const id = parseInt(req.params.id);
  const { approved } = req.body;

  const [existing] = await db.select().from(vacationRequestsTable).where(eq(vacationRequestsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  // Team leader can only approve their team's requests
  if (isStrictTeamLeader(currentUser)) {
    const team = currentUser.team;
    if (team) {
      const requestUser = existing.userId ? (await db.select().from(usersTable).where(eq(usersTable.id, existing.userId)))[0] : null;
      if (requestUser?.team !== team) {
        return res.status(403).json({ error: "You can only approve requests from your team" });
      }
    }
  }

  const updates: Partial<typeof vacationRequestsTable.$inferInsert> = {};

  if (isAdmin(currentUser)) {
    updates.managerApproved = approved;
    updates.managerApprovedById = currentUser.id;
    updates.managerApprovedAt = new Date();
    updates.teamLeaderApproved = approved;
    updates.teamLeaderApprovedById = currentUser.id;
    updates.teamLeaderApprovedAt = new Date();
    updates.status = approved ? "approved" : "rejected";
  } else if (isManager(currentUser)) {
    updates.managerApproved = approved;
    updates.managerApprovedById = currentUser.id;
    updates.managerApprovedAt = new Date();
    updates.status = computeStatus(approved ?? null, existing.teamLeaderApproved ?? null) as "pending" | "approved" | "rejected" | "cancelled";
  } else if (isTeamLeader(currentUser)) {
    updates.teamLeaderApproved = approved;
    updates.teamLeaderApprovedById = currentUser.id;
    updates.teamLeaderApprovedAt = new Date();
    updates.status = computeStatus(existing.managerApproved ?? null, approved ?? null) as "pending" | "approved" | "rejected" | "cancelled";
  } else {
    return res.status(403).json({ error: "Only admins, managers, and team leaders can approve requests" });
  }

  const [record] = await db.update(vacationRequestsTable).set(updates).where(eq(vacationRequestsTable.id, id)).returning();

  const ownerUser = existing.userId ? (await db.select().from(usersTable).where(eq(usersTable.id, existing.userId)))[0] : null;
  await logAudit(currentUser, "update", "Vacation Request", id, `${ownerUser?.fullName ?? "User"} (${existing.startDate} → ${existing.endDate})`, {
    action: approved ? "Approved" : "Rejected", newStatus: record.status, approver: currentUser.fullName,
  });

  return res.json(await formatVacation(record));
});

router.delete("/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ error: "Not authenticated" });

  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(vacationRequestsTable).where(eq(vacationRequestsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });

  if (existing.userId !== currentUser.id && !isManager(currentUser)) {
    return res.status(403).json({ error: "You can only cancel your own requests" });
  }

  await db.update(vacationRequestsTable).set({ status: "cancelled" }).where(eq(vacationRequestsTable.id, id));
  await logAudit(currentUser, "update", "Vacation Request", id, `Cancelled: ${existing.startDate} → ${existing.endDate}`, { action: "Cancelled" });

  return res.json({ success: true });
});

export default router;
