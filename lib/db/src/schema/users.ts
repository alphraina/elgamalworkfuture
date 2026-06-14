import { pgTable, serial, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("role", ["admin", "manager", "teamleader", "maintenance", "inventory"]);

export const PRODUCTION_TEAMS = ["assembly", "test", "packaging"] as const;
export type ProductionTeam = typeof PRODUCTION_TEAMS[number];

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  role: roleEnum("role").notNull().default("maintenance"),
  extraRoles: text("extra_roles").array(),
  team: text("team"),
  department: text("department"),
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
  registrationStatus: text("registration_status").notNull().default("approved"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
