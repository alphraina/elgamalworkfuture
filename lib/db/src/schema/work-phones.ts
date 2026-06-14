import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const workPhonesTable = pgTable("work_phones", {
  id: serial("id").primaryKey(),
  workId: text("work_id").notNull(),
  name: text("name").notNull(),
  phoneColor: text("phone_color"),
  phoneNumber: text("phone_number"),
  pcbaNumber: text("pcba_number"),
  createdById: integer("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WorkPhone = typeof workPhonesTable.$inferSelect;
export type InsertWorkPhone = typeof workPhonesTable.$inferInsert;
