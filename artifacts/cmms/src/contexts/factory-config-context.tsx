import React, { createContext, useContext, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface SectionPerm {
  canSee: boolean;
  canWrite: boolean;
}

export interface FactoryConfig {
  roleNames: Record<string, string>;
  sectionNames: Record<string, string>;
  sectionPerms: Record<string, Record<string, SectionPerm>>;
  sectionVideos: Record<string, string>;
  hiddenSections: Record<string, boolean>;
  teamNames: Record<string, string>;
  systemName: string;
  factoryType: string;
  downtimeFailThreshold?: number;
}

const DEFAULT_CONFIG: FactoryConfig = {
  roleNames: {},
  sectionNames: {},
  sectionPerms: {},
  sectionVideos: {},
  hiddenSections: {},
  teamNames: {},
  systemName: "",
  factoryType: "",
  downtimeFailThreshold: 3,
};

const FactoryConfigContext = createContext<{
  config: FactoryConfig;
  canSee: (section: string, role: string) => boolean;
  canWrite: (section: string, role: string) => boolean;
  roleName: (role: string) => string;
  sectionName: (section: string, fallback: string) => string;
  sectionVideo: (section: string) => string | null;
  isHidden: (href: string) => boolean;
  teamName: (key: string, fallback: string) => string;
  reload: () => void;
}>({
  config: DEFAULT_CONFIG,
  canSee: () => true,
  canWrite: () => true,
  roleName: (r) => r,
  sectionName: (_s, f) => f,
  sectionVideo: () => null,
  isHidden: () => false,
  teamName: (_k, f) => f,
  reload: () => {},
});

async function fetchConfig(): Promise<FactoryConfig> {
  const r = await fetch(`${BASE}/api/factory-config`, { credentials: "include" });
  if (!r.ok) return DEFAULT_CONFIG;
  return r.json();
}

export function FactoryConfigProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data = DEFAULT_CONFIG } = useQuery<FactoryConfig>({
    queryKey: ["factory-config"],
    queryFn: fetchConfig,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const canSee = useCallback((section: string, role: string): boolean => {
    const perm = data.sectionPerms?.[section]?.[role];
    if (perm === undefined) return true;
    return perm.canSee;
  }, [data]);

  const canWrite = useCallback((section: string, role: string): boolean => {
    const perm = data.sectionPerms?.[section]?.[role];
    if (perm === undefined) return true;
    return perm.canWrite;
  }, [data]);

  const roleName = useCallback((role: string): string => {
    return data.roleNames?.[role] || role;
  }, [data]);

  const sectionName = useCallback((section: string, fallback: string): string => {
    return data.sectionNames?.[section] || fallback;
  }, [data]);

  const sectionVideo = useCallback((section: string): string | null => {
    return data.sectionVideos?.[section] ?? null;
  }, [data]);

  const isHidden = useCallback((href: string): boolean => {
    return data.hiddenSections?.[href] === true;
  }, [data]);

  const teamName = useCallback((key: string, fallback: string): string => {
    return data.teamNames?.[key] || fallback;
  }, [data]);

  const reload = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["factory-config"] });
  }, [qc]);

  return (
    <FactoryConfigContext.Provider value={{ config: data, canSee, canWrite, roleName, sectionName, sectionVideo, isHidden, teamName, reload }}>
      {children}
    </FactoryConfigContext.Provider>
  );
}

export function useFactoryConfig() {
  return useContext(FactoryConfigContext);
}
