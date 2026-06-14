import { db } from "@workspace/db";
import { usersTable, productionLinesTable, inventoryTable } from "@workspace/db/schema";
import crypto from "crypto";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function seed() {
  console.log("Seeding database...");

  // Create default users
  const existingUsers = await db.select().from(usersTable);
  if (existingUsers.length === 0) {
    await db.insert(usersTable).values([
      {
        username: "admin",
        passwordHash: hashPassword("admin123"),
        fullName: "System Administrator",
        email: "admin@oppo-factory.com",
        role: "admin",
        department: "IT",
        isActive: true,
      },
      {
        username: "manager",
        passwordHash: hashPassword("manager123"),
        fullName: "Maintenance Manager",
        email: "manager@oppo-factory.com",
        role: "manager",
        department: "Maintenance",
        isActive: true,
      },
      {
        username: "tech1",
        passwordHash: hashPassword("tech123"),
        fullName: "Ahmed Hassan",
        email: "ahmed@oppo-factory.com",
        role: "maintenance",
        department: "Maintenance",
        isActive: true,
      },
      {
        username: "tech2",
        passwordHash: hashPassword("tech123"),
        fullName: "Mohamed Ali",
        email: "mohamed@oppo-factory.com",
        role: "maintenance",
        department: "Maintenance",
        isActive: true,
      },
      {
        username: "inventory1",
        passwordHash: hashPassword("inv123"),
        fullName: "Sara Ibrahim",
        email: "sara@oppo-factory.com",
        role: "inventory",
        department: "Inventory",
        isActive: true,
      },
    ]);
    console.log("✓ Users created");
  } else {
    console.log("✓ Users already exist, skipping");
  }

  // Create production lines
  const existingLines = await db.select().from(productionLinesTable);
  if (existingLines.length === 0) {
    await db.insert(productionLinesTable).values([
      { name: "Line 1", description: "OPPO production line 1", targetCapacityPerHour: 120, minimumCapacityPerHour: 90, isActive: true },
      { name: "Line 2", description: "OPPO production line 2", targetCapacityPerHour: 150, minimumCapacityPerHour: 110, isActive: true },
      { name: "Line 3", description: "OPPO production line 3", targetCapacityPerHour: 100, minimumCapacityPerHour: 75, isActive: true },
      { name: "Line 4", description: "OPPO production line 4", targetCapacityPerHour: 80, minimumCapacityPerHour: 60, isActive: true },
      { name: "Line 5", description: "OPPO production line 5", targetCapacityPerHour: 120, minimumCapacityPerHour: 90, isActive: true },
      { name: "Line 6", description: "OPPO production line 6", targetCapacityPerHour: 120, minimumCapacityPerHour: 90, isActive: true },
      { name: "Line 7", description: "OPPO production line 7", targetCapacityPerHour: 120, minimumCapacityPerHour: 90, isActive: true },
      { name: "Line 8", description: "OPPO production line 8", targetCapacityPerHour: 120, minimumCapacityPerHour: 90, isActive: true },
    ]);
    console.log("✓ Production lines created");
  } else {
    console.log("✓ Production lines already exist, skipping");
  }

  // Create inventory items
  const existingInventory = await db.select().from(inventoryTable);
  if (existingInventory.length === 0) {
    await db.insert(inventoryTable).values([
      { partNumber: "BRG-001", partName: "Ball Bearing 6205", category: "Bearings", description: "Standard ball bearing for conveyor motors", quantity: 50, minQuantity: 10, unit: "pcs", location: "A-1-01", supplier: "SKF", unitPrice: "15.50" },
      { partNumber: "BLT-001", partName: "V-Belt A50", category: "Belts", description: "Drive belt for assembly line motors", quantity: 25, minQuantity: 5, unit: "pcs", location: "A-1-02", supplier: "Gates", unitPrice: "8.75" },
      { partNumber: "MTR-001", partName: "Motor Contactor 25A", category: "Electrical", description: "3-phase motor contactor", quantity: 8, minQuantity: 3, unit: "pcs", location: "B-2-01", supplier: "Schneider", unitPrice: "45.00" },
      { partNumber: "LUB-001", partName: "Grease MP-3", category: "Lubricants", description: "Multi-purpose bearing grease", quantity: 20, minQuantity: 5, unit: "kg", location: "C-1-01", supplier: "Shell", unitPrice: "12.00" },
      { partNumber: "SEN-001", partName: "Proximity Sensor", category: "Sensors", description: "Inductive proximity sensor 12mm", quantity: 3, minQuantity: 5, unit: "pcs", location: "B-3-01", supplier: "Sick", unitPrice: "35.00" },
      { partNumber: "FLT-001", partName: "Air Filter 0.3 micron", category: "Filters", description: "Compressed air line filter", quantity: 15, minQuantity: 5, unit: "pcs", location: "A-2-03", supplier: "Festo", unitPrice: "22.00" },
    ]);
    console.log("✓ Inventory items created");
  } else {
    console.log("✓ Inventory already exists, skipping");
  }

  console.log("\nSeed complete!");
  console.log("\nDefault login credentials:");
  console.log("  Admin:     admin / admin123");
  console.log("  Manager:   manager / manager123");
  console.log("  Tech 1:    tech1 / tech123");
  console.log("  Tech 2:    tech2 / tech123");
  console.log("  Inventory: inventory1 / inv123");
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
