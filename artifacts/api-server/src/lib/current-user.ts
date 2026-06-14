import { Request } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export type UserLike = { role: string; extraRoles?: string[] | null } | null | undefined;

export function userAllRoles(user: UserLike): string[] {
  if (!user) return [];
  return [user.role, ...(user.extraRoles ?? [])].filter(Boolean) as string[];
}

function hasRole(user: UserLike, ...roles: string[]): boolean {
  return userAllRoles(user).some(r => roles.includes(r));
}

export async function getCurrentUser(req: Request) {
  const userId = req.session.userId;
  if (!userId) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return user ?? null;
}

export function isMaintenance(user: UserLike) {
  return hasRole(user, "maintenance");
}
export function isInventory(user: UserLike) {
  return hasRole(user, "inventory");
}
export function isTeamLeader(user: UserLike) {
  return hasRole(user, "teamleader");
}
export function isManager(user: UserLike) {
  return hasRole(user, "manager", "admin");
}
export function isAdmin(user: UserLike) {
  return hasRole(user, "admin");
}
export function canCreatePlans(user: UserLike) {
  return hasRole(user, "teamleader", "manager", "admin");
}

export function isStrictTeamLeader(user: UserLike) {
  const all = userAllRoles(user);
  return all.includes("teamleader") && !all.includes("admin") && !all.includes("manager");
}
