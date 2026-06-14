import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "../lib/current-user.js";
import { logAudit, diffObjects } from "../lib/audit.js";

const router = Router();

function formatItem(item: typeof inventoryTable.$inferSelect) {
  return {
    id: item.id,
    partNumber: item.partNumber,
    partName: item.partName,
    category: item.category,
    description: item.description,
    quantity: item.quantity,
    minQuantity: item.minQuantity,
    unit: item.unit,
    location: item.location,
    supplier: item.supplier,
    unitPrice: item.unitPrice ? parseFloat(item.unitPrice as string) : null,
    isActive: item.isActive,
    createdAt: item.createdAt?.toISOString(),
    updatedAt: item.updatedAt?.toISOString(),
  };
}

router.get("/", async (_req, res) => {
  const items = await db.select().from(inventoryTable).orderBy(inventoryTable.partName);
  res.json(items.map(formatItem));
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const items = await db.select().from(inventoryTable).where(eq(inventoryTable.id, id));
  if (!items[0]) return res.status(404).json({ error: "Not found" });
  res.json(formatItem(items[0]));
});

router.post("/", async (req, res) => {
  const actor = await getCurrentUser(req);
  const { partNumber, partName, category, description, quantity, minQuantity, unit, location, supplier, unitPrice } = req.body;

  if (!partNumber || !partName || quantity === undefined || minQuantity === undefined) {
    return res.status(400).json({ error: "Required fields missing" });
  }

  const [item] = await db.insert(inventoryTable).values({
    partNumber, partName, category, description, quantity, minQuantity,
    unit, location, supplier, unitPrice: unitPrice?.toString(), isActive: true,
  }).returning();

  await logAudit(actor, "create", "Inventory", item.id, `${partName} (${partNumber})`, {
    partNumber, partName, category, quantity, minQuantity, unit, location, supplier,
  });

  return res.status(201).json(formatItem(item));
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const actor = await getCurrentUser(req);
  const { partName, category, description, quantity, minQuantity, unit, location, supplier, unitPrice, isActive } = req.body;

  const [existing] = await db.select().from(inventoryTable).where(eq(inventoryTable.id, id));

  const updates: Partial<typeof inventoryTable.$inferInsert> = { updatedAt: new Date() };
  if (partName !== undefined) updates.partName = partName;
  if (category !== undefined) updates.category = category;
  if (description !== undefined) updates.description = description;
  if (quantity !== undefined) updates.quantity = quantity;
  if (minQuantity !== undefined) updates.minQuantity = minQuantity;
  if (unit !== undefined) updates.unit = unit;
  if (location !== undefined) updates.location = location;
  if (supplier !== undefined) updates.supplier = supplier;
  if (unitPrice !== undefined) updates.unitPrice = unitPrice?.toString();
  if (isActive !== undefined) updates.isActive = isActive;

  const [item] = await db.update(inventoryTable).set(updates).where(eq(inventoryTable.id, id)).returning();
  if (!item) return res.status(404).json({ error: "Not found" });

  if (existing) {
    const changes = diffObjects(formatItem(existing) as Record<string, unknown>, formatItem(item) as Record<string, unknown>);
    await logAudit(actor, "update", "Inventory", id, `${item.partName} (${item.partNumber})`, changes);
  }

  return res.json(formatItem(item));
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const actor = await getCurrentUser(req);
  const [existing] = await db.select().from(inventoryTable).where(eq(inventoryTable.id, id));
  await db.delete(inventoryTable).where(eq(inventoryTable.id, id));
  await logAudit(actor, "delete", "Inventory", id, existing ? `${existing.partName} (${existing.partNumber})` : String(id), existing ? formatItem(existing) as Record<string, unknown> : null);
  return res.json({ success: true, message: "Deleted" });
});

export default router;
