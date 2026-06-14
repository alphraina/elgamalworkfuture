import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";

type AuditAction = "create" | "update" | "delete" | "login" | "logout" | "login_failed";

interface AuditUser {
  id: number;
  fullName: string | null;
  role: string;
}

interface ChangeEntry {
  field: string;
  old: unknown;
  new: unknown;
}

function computeChanges(oldData: Record<string, unknown>, newData: Record<string, unknown>): ChangeEntry[] {
  const skipFields = new Set(["updatedAt", "createdAt", "passwordHash"]);
  const changes: ChangeEntry[] = [];

  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  for (const key of allKeys) {
    if (skipFields.has(key)) continue;
    const oldVal = oldData[key];
    const newVal = newData[key];
    const oldStr = JSON.stringify(oldVal);
    const newStr = JSON.stringify(newVal);
    if (oldStr !== newStr) {
      changes.push({ field: key, old: oldVal, new: newVal });
    }
  }
  return changes;
}

export async function logAudit(
  user: AuditUser | null | undefined,
  action: AuditAction,
  entity: string,
  entityId: string | number | null | undefined,
  entityLabel: string | null | undefined,
  changesOrData: Record<string, unknown> | ChangeEntry[] | null
): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      userId: user?.id ?? null,
      userFullName: user?.fullName ?? null,
      userRole: user?.role ?? null,
      action,
      entity,
      entityId: entityId != null ? String(entityId) : null,
      entityLabel: entityLabel ?? null,
      changes: changesOrData as any,
    });
  } catch {
    // Audit logging must never break the main flow
  }
}

export function diffObjects(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): ChangeEntry[] {
  return computeChanges(oldData, newData);
}
