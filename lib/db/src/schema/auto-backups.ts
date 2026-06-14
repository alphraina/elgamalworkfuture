import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const autoBackups = pgTable("auto_backups", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sizeBytes: text("size_bytes").notNull().default("0"),
  data: text("data").notNull(),
});
