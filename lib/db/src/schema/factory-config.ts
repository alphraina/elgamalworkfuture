import { pgTable, serial, integer, jsonb, text } from "drizzle-orm/pg-core";

export interface SectionPerm {
  canSee: boolean;
  canWrite: boolean;
}

export interface OmtpColumnMap {
  station:   string;
  result:    string;
  error:     string;
  timestamp: string;
  lot:       string;
  cycle:     string;
}

export const factoryConfigTable = pgTable("factory_config", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").unique(),
  roleNames: jsonb("role_names").$type<Record<string, string>>(),
  sectionNames: jsonb("section_names").$type<Record<string, string>>(),
  sectionPerms: jsonb("section_perms").$type<Record<string, Record<string, SectionPerm>>>(),
  sectionVideos: jsonb("section_videos").$type<Record<string, string>>(),
  machineApiKey: text("machine_api_key"),
  omtpPathTemplate: text("omtp_path_template"),
  omtpColumns: jsonb("omtp_columns").$type<OmtpColumnMap>(),
  downtimeFailThreshold: integer("downtime_fail_threshold").default(3),
});

export type FactoryConfig = typeof factoryConfigTable.$inferSelect;
