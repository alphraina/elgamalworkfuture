import { Router } from "express";
import { db } from "@workspace/db";
import { sparepartOrdersTable, inventoryTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "../lib/current-user.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

async function formatOrder(o: typeof sparepartOrdersTable.$inferSelect) {
  const item = o.inventoryItemId ? (await db.select().from(inventoryTable).where(eq(inventoryTable.id, o.inventoryItemId)))[0] : null;
  const orderedBy = o.orderedById ? (await db.select().from(usersTable).where(eq(usersTable.id, o.orderedById)))[0] : null;
  const approvedBy = o.approvedById ? (await db.select().from(usersTable).where(eq(usersTable.id, o.approvedById)))[0] : null;

  return {
    id: o.id,
    inventoryItemId: o.inventoryItemId,
    partName: item?.partName ?? null,
    partNumber: item?.partNumber ?? null,
    quantity: o.quantity,
    reason: o.reason,
    status: o.status,
    orderedById: o.orderedById,
    orderedByName: orderedBy?.fullName ?? null,
    approvedById: o.approvedById,
    approvedByName: approvedBy?.fullName ?? null,
    notes: o.notes,
    createdAt: o.createdAt?.toISOString(),
    updatedAt: o.updatedAt?.toISOString(),
  };
}

router.get("/", async (_req, res) => {
  const orders = await db.select().from(sparepartOrdersTable).orderBy(sparepartOrdersTable.createdAt);
  const formatted = await Promise.all(orders.map(formatOrder));
  res.json(formatted);
});

router.post("/", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const { inventoryItemId, quantity, reason, notes } = req.body;

  if (!inventoryItemId || !quantity || !reason || !currentUser) {
    return res.status(400).json({ error: "Required fields missing" });
  }

  const [order] = await db.insert(sparepartOrdersTable).values({
    inventoryItemId,
    quantity,
    reason,
    notes,
    orderedById: currentUser.id,
    status: "pending",
  }).returning();

  const item = inventoryItemId ? (await db.select().from(inventoryTable).where(eq(inventoryTable.id, inventoryItemId)))[0] : null;
  await logAudit(currentUser, "create", "Spare Part Order", order.id, `${item?.partName ?? String(inventoryItemId)} × ${quantity}`, {
    partName: item?.partName, partNumber: item?.partNumber, quantity, reason, status: "pending",
  });

  return res.status(201).json(await formatOrder(order));
});

router.put("/:id", async (req, res) => {
  const currentUser = await getCurrentUser(req);
  const id = parseInt(req.params.id);
  const { status, notes } = req.body;

  const [existing] = await db.select().from(sparepartOrdersTable).where(eq(sparepartOrdersTable.id, id));

  const updates: Partial<typeof sparepartOrdersTable.$inferInsert> = { updatedAt: new Date() };
  if (status) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  if (status === "approved" || status === "rejected") {
    updates.approvedById = currentUser?.id;
  }

  // Deduct inventory when approved for the first time (only if previously pending or unset)
  const deductOnApprove = status === "approved" && existing && existing.status === "pending";
  if (deductOnApprove) {
    const [inv] = await db.select().from(inventoryTable).where(eq(inventoryTable.id, existing.inventoryItemId));
    if (inv) {
      await db.update(inventoryTable)
        .set({ quantity: Math.max(0, inv.quantity - existing.quantity) })
        .where(eq(inventoryTable.id, inv.id));
    }
  }

  const [order] = await db.update(sparepartOrdersTable).set(updates).where(eq(sparepartOrdersTable.id, id)).returning();
  if (!order) return res.status(404).json({ error: "Not found" });

  const item = order.inventoryItemId ? (await db.select().from(inventoryTable).where(eq(inventoryTable.id, order.inventoryItemId)))[0] : null;
  await logAudit(currentUser, "update", "Spare Part Order", id, `${item?.partName ?? String(id)} × ${order.quantity}`, {
    previousStatus: existing?.status, newStatus: status, notes,
  });

  return res.json(await formatOrder(order));
});

export default router;
