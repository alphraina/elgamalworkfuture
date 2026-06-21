import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useFactoryConfig, FactoryConfig } from "@/contexts/factory-config-context";
import { Save, RotateCcw, Eye, EyeOff, Pencil, Shield, Settings2, Users2, Download, FileText, Terminal, BookOpen, Copy, Check, RefreshCw, Link, FolderOpen, Columns3, X, Plus, AlertTriangle, Wand2, Upload, Database, ShieldAlert, UploadCloud, HardDrive, Clock, CalendarClock, Activity, Cpu, CheckCircle2, AlertCircle, Server, Sparkles, Loader2, ChevronDown, ChevronRight, Info, Wrench, XCircle, MinusCircle, Bot, Code2, Zap } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string) {
  const r = await fetch(`${BASE}/api${path}`, { credentials: "include" });
  return r.json();
}

async function apiPut(path: string, body: unknown) {
  const r = await fetch(`${BASE}/api${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return r.json();
}

async function apiPost(path: string) {
  const r = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    credentials: "include",
  });
  return r.json();
}

async function apiPostJson(path: string, body: unknown) {
  const r = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Request failed"); }
  return r.json();
}

const ROLE_KEYS = ["admin", "manager", "teamleader", "maintenance", "inventory"] as const;
const ROLE_DEFAULTS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  teamleader: "Team Leader",
  maintenance: "Maintenance",
  inventory: "Inventory",
};

const SECTIONS = [
  { key: "dashboard",       label: "Dashboard" },
  { key: "downtime",        label: "Downtime" },
  { key: "inventory",       label: "Inventory" },
  { key: "orders",          label: "Spare Part Orders" },
  { key: "pm",              label: "Preventive Maintenance" },
  { key: "training",        label: "Training" },
  { key: "production",      label: "Production" },
  { key: "tasks",           label: "Tasks" },
  { key: "linePlans",       label: "Line Plans" },
  { key: "changeover",      label: "Changeover" },
  { key: "attendance",      label: "Attendance" },
  { key: "vacation",        label: "Vacation Requests" },
  { key: "machines",        label: "Machine Registry" },
  { key: "workPhones",      label: "Work Phones" },
  { key: "brokenMachines",  label: "Broken Machines" },
  { key: "defects",         label: "Defects Log" },
  { key: "machineMonitor",  label: "Machine Monitor" },
  { key: "machineAnalysis", label: "Machine Analysis" },
  { key: "exams",           label: "Exams" },
  { key: "kpi",             label: "KPI" },
  { key: "reports",         label: "Analytics & Reports" },
] as const;

const NAV_ITEMS_FOR_VISIBILITY = [
  { href: "/dashboard",        label: "Dashboard",              protected: false },
  { href: "/downtime",         label: "Downtime",               protected: false },
  { href: "/inventory",        label: "Inventory",              protected: false },
  { href: "/orders",           label: "Spare Part Orders",      protected: false },
  { href: "/pm",               label: "Preventive Maintenance", protected: false },
  { href: "/training",         label: "Training",               protected: false },
  { href: "/production",       label: "Production",             protected: false },
  { href: "/tasks",            label: "Tasks",                  protected: false },
  { href: "/line-plans",       label: "Handover / Line Plans",  protected: false },
  { href: "/changeover",       label: "Changeover",             protected: false },
  { href: "/attendance",       label: "Attendance",             protected: false },
  { href: "/vacation",         label: "Vacation",               protected: false },
  { href: "/machines",         label: "Machine Registry",       protected: false },
  { href: "/work-phones",      label: "Work Phones",            protected: false },
  { href: "/broken-machines",  label: "Broken Machines",        protected: false },
  { href: "/defects",          label: "Defects Log",            protected: false },
  { href: "/machine-analysis", label: "Machine Analysis",       protected: false },
  { href: "/machine-monitor",  label: "Machine Monitor",        protected: false },
  { href: "/exams",            label: "Training Exams",         protected: false },
  { href: "/kpi",              label: "KPI",                    protected: false },
  { href: "/reports",          label: "Analytics & Reports",    protected: false },
  { href: "/production-lines", label: "Production Lines",       protected: false },
  { href: "/users",            label: "Users",                  protected: true  },
  { href: "/audit-logs",       label: "Audit Logs",             protected: true  },
  { href: "/factory-settings", label: "Factory Settings",       protected: true  },
  { href: "/ai-assistant",     label: "AI Code Assistant",      protected: false },
  { href: "/help",             label: "Help",                   protected: false },
];

const DEFAULT_TEAMS = [
  { key: "assembly",  label: "Assembly" },
  { key: "test",      label: "Test" },
  { key: "packaging", label: "Packaging" },
];

type Tab = "names" | "access" | "holidays" | "integration" | "backup" | "diagnostics";

interface DiagCheck {
  id: string;
  category: string;
  name: string;
  status: "ok" | "warning" | "critical";
  message: string;
  detail?: string;
  value?: string | number;
}

interface ScanResult {
  checks: DiagCheck[];
  score: number;
  scannedAt: string;
  serverUptime: number;
  memoryMb: number;
}

interface AIFinding {
  priority: "critical" | "warning" | "info";
  title: string;
  problem: string;
  fix: string;
}

interface CodeFix {
  title: string;
  rootCause: string;
  fixType: "sql" | "config" | "data" | "code";
  fixable: boolean;
  sqlFix?: string;
  codeFile?: string;
  oldCode?: string;
  newCode?: string;
  configKey?: string;
  configValue?: string;
  description: string;
  errorIds?: number[];
  applied: boolean;
  applyError?: string | null;
}

interface TrackedError {
  id: number;
  method: string;
  url: string;
  errorType: string;
  message: string;
  createdAt: string;
  resolved: boolean;
  autoFixed: boolean;
}

interface CodeRepairResult {
  analysis: string;
  fixes: CodeFix[];
  summary: string;
  totalErrors: number;
  applied: number;
  errors: TrackedError[];
}

interface RepairAction {
  checkId: string;
  checkName: string;
  category: string;
  status: "fixed" | "skipped" | "failed" | "manual";
  action: string;
  detail?: string;
}

interface RepairResult {
  repairs: RepairAction[];
  preScan: ScanResult;
  postScan: ScanResult;
  aiSummary: string | null;
}

interface AIAnalysis {
  assessment: string;
  healthLabel: string;
  findings: AIFinding[];
  repairPlan: string[];
  summary: string;
  scan?: ScanResult;
}

const DEFAULT_OMTP_PATH = "D:\\OMTP_LOG\\{MODEL}\\data\\{DATE}.csv";

const OMTP_ROLES: { key: keyof OmtpColumnMap; label: string; hint: string }[] = [
  { key: "station",   label: "Station / Operator",  hint: "e.g. OPER" },
  { key: "result",    label: "Test Result",          hint: "e.g. TEST_RESULT (PASS/FAIL/NG)" },
  { key: "timestamp", label: "Test Time",            hint: "e.g. TEST_TIME" },
  { key: "error",     label: "Error / Result Msg",   hint: "e.g. RESULT_MSG" },
  { key: "lot",       label: "Lot ID",               hint: "e.g. LOT_ID" },
  { key: "cycle",     label: "Cycle Time",           hint: "e.g. CYCLETIME" },
];

interface OmtpColumnMap {
  station: string; result: string; error: string; timestamp: string; lot: string; cycle: string;
}

const DEFAULT_OMTP_COLUMNS: OmtpColumnMap = {
  station: "OPER", result: "TEST_RESULT", error: "RESULT_MSG",
  timestamp: "TEST_TIME", lot: "LOT_ID", cycle: "CYCLETIME",
};

function Toggle({ checked, onChange, color = "blue" }: { checked: boolean; onChange: (v: boolean) => void; color?: "blue" | "green" }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
        checked ? (color === "green" ? "bg-emerald-500" : "bg-blue-500") : "bg-white/15"
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function FactorySettings() {
  const { user, isAdmin } = useAuth();
  const { reload } = useFactoryConfig();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("names");
  const [saved, setSaved] = useState(false);

  // ── Diagnostics state ─────────────────────────────────────────────────────
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);
  const [codeRepairing, setCodeRepairing] = useState(false);
  const [codeRepairResult, setCodeRepairResult] = useState<CodeRepairResult | null>(null);
  const [codeRepairError, setCodeRepairError] = useState<string | null>(null);
  const [expandedFix, setExpandedFix] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  async function safeFetchJson(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
    const res = await fetch(url, { credentials: "include", ...init });
    const text = await res.text();
    if (!text || text.trim() === "") {
      throw new Error("Server returned an empty response — please try again in a moment");
    }
    let data: any;
    try { data = JSON.parse(text); }
    catch { throw new Error("Server returned an unexpected response. Please try again."); }
    return { ok: res.ok, status: res.status, data };
  }

  const runDiagScan = async () => {
    setScanning(true); setScanError(null); setAiResult(null); setRepairResult(null);
    try {
      const { ok, data } = await safeFetchJson(`${BASE}/api/diagnostics/scan`);
      if (!ok) throw new Error(data.error ?? "Scan failed");
      setScanResult(data);
      const cats = new Set(data.checks.filter((c: DiagCheck) => c.status !== "ok").map((c: DiagCheck) => c.category));
      setExpandedCategories(cats.size > 0 ? cats : new Set(["Database", "Configuration"]));
    } catch (e: any) { setScanError(e.message); }
    finally { setScanning(false); }
  };

  const runAiAnalysis = async () => {
    setAnalyzing(true); setAiError(null); setRepairResult(null);
    try {
      const { ok, data } = await safeFetchJson(`${BASE}/api/diagnostics/ai-analyze`, { method: "POST" });
      if (!ok) throw new Error(data.error ?? "AI analysis failed");
      setAiResult(data);
      if (data.scan) setScanResult(data.scan);
    } catch (e: any) { setAiError(e.message); }
    finally { setAnalyzing(false); }
  };

  const runCodeRepair = async () => {
    setCodeRepairing(true); setCodeRepairError(null); setCodeRepairResult(null); setAiResult(null); setRepairResult(null);
    try {
      const { ok, data } = await safeFetchJson(`${BASE}/api/diagnostics/code-repair`, { method: "POST" });
      if (!ok) throw new Error(data.error ?? "Code repair failed");
      setCodeRepairResult(data);
    } catch (e: any) { setCodeRepairError(e.message); }
    finally { setCodeRepairing(false); }
  };

  const runAutoRepair = async () => {
    setRepairing(true); setRepairError(null); setRepairResult(null); setAiResult(null);
    try {
      const { ok, data } = await safeFetchJson(`${BASE}/api/diagnostics/auto-repair`, { method: "POST" });
      if (!ok) throw new Error(data.error ?? "Auto-repair failed");
      setRepairResult(data);
      if (data.postScan) setScanResult(data.postScan);
    } catch (e: any) { setRepairError(e.message); }
    finally { setRepairing(false); }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const { data: cfg, isLoading } = useQuery<FactoryConfig & { machineApiKey?: string }>({
    queryKey: ["factory-config"],
    queryFn: () => apiFetch("/factory-config"),
  });

  const serverUrl = typeof window !== "undefined"
    ? window.location.origin + BASE
    : "";

  const machineApiKey = (cfg as any)?.machineApiKey ?? null;

  const regenMutation = useMutation({
    mutationFn: () => apiPost("/factory-config/regenerate-api-key"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["factory-config"] }),
  });

  const copyText = (text: string, setDone: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    });
  };

  // ── Backup handlers ────────────────────────────────────────────────────────
  const downloadBackup = async () => {
    setBackingUp(true);
    try {
      const res = await fetch(`${BASE}/api/backup`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `cmms-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Backup failed: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setBackingUp(false);
    }
  };

  const confirmRestore = async () => {
    if (!restoreFile) return;
    setShowRestoreConfirm(false);
    setRestoring(true);
    setRestoreError(null);
    setRestoreResult(null);
    try {
      const text = await restoreFile.text();
      const res = await fetch(`${BASE}/api/backup/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: text,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Restore failed");
      setRestoreResult({ rows: data.rowsRestored, tables: data.tables });
      setRestoreFile(null);
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setRestoring(false);
    }
  };

  const downloadAutoBackup = async () => {
    setDownloadingAuto(true);
    try {
      const res = await fetch(`${BASE}/api/backup/auto/download`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const info = autoBackupInfoQuery.data;
      const date = info?.createdAt ? new Date(info.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `cmms-auto-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Download failed: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setDownloadingAuto(false);
    }
  };

  const confirmAutoRestore = async () => {
    setShowAutoRestoreConfirm(false);
    setRestoringAuto(true);
    setAutoRestoreError(null);
    setAutoRestoreResult(null);
    try {
      const res = await fetch(`${BASE}/api/backup/auto/restore`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Restore failed");
      setAutoRestoreResult({ rows: data.rowsRestored, tables: data.tables });
    } catch (e) {
      setAutoRestoreError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setRestoringAuto(false);
    }
  };

  const [roleNames, setRoleNames] = useState<Record<string, string>>({});
  const [sectionNames, setSectionNames] = useState<Record<string, string>>({});
  const [sectionPerms, setSectionPerms] = useState<Record<string, Record<string, { canSee: boolean; canWrite: boolean }>>>({});
  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>({});
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [systemName, setSystemName] = useState("");
  const [factoryType, setFactoryType] = useState("");
  const [omtpPath, setOmtpPath] = useState(DEFAULT_OMTP_PATH);
  const [omtpColumns, setOmtpColumns] = useState<OmtpColumnMap>({ ...DEFAULT_OMTP_COLUMNS });
  const [rawHeaders, setRawHeaders] = useState("");
  const [downtimeFailThreshold, setDowntimeFailThreshold] = useState(3);

  // Holidays / day-off state
  const [holidays, setHolidays] = useState<string[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayLabel, setNewHolidayLabel] = useState("");
  const [delayResults, setDelayResults] = useState<Record<string, { tasksDelayed: number; pmDelayed: number; newDate: string } | null>>({});
  const [delayingDate, setDelayingDate] = useState<string | null>(null);
  const [previewCounts, setPreviewCounts] = useState<Record<string, { tasksAffected: number; pmAffected: number } | null>>({});
  const [holidaySaved, setHolidaySaved] = useState(false);

  // ── Backup & Restore state ─────────────────────────────────────────────────
  const [backingUp, setBackingUp] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ rows: number; tables: number } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  // ── Auto-backup state ──────────────────────────────────────────────────────
  const [downloadingAuto, setDownloadingAuto] = useState(false);
  const [restoringAuto, setRestoringAuto] = useState(false);
  const [autoRestoreResult, setAutoRestoreResult] = useState<{ rows: number; tables: number } | null>(null);
  const [autoRestoreError, setAutoRestoreError] = useState<string | null>(null);
  const [showAutoRestoreConfirm, setShowAutoRestoreConfirm] = useState(false);

  const autoBackupInfoQuery = useQuery({
    queryKey: ["auto-backup-info"],
    queryFn: () => apiFetch("/backup/auto/info"),
    refetchInterval: 60_000,
  });

  // Parsed headers from the raw textarea
  // Handles: tab-separated (Excel/CSV copy), comma-separated, space-separated, or any mix
  const parsedHeaders = rawHeaders
    .split(/[\t,\n]+|\s{2,}/)   // tab, comma, newline, or 2+ spaces
    .map(h => h.trim())
    .filter(Boolean);

  // Auto-map: match parsed headers against known OMTP default column names
  const autoMapColumns = () => {
    const defaults: Record<string, string> = { ...DEFAULT_OMTP_COLUMNS };
    const available = new Set(parsedHeaders);
    const mapped: OmtpColumnMap = { ...omtpColumns };
    for (const key of Object.keys(defaults) as Array<keyof OmtpColumnMap>) {
      if (defaults[key] && available.has(defaults[key])) {
        mapped[key] = defaults[key];
      }
    }
    setOmtpColumns(mapped);
  };

  useEffect(() => {
    if (cfg) {
      const c = cfg as any;
      setRoleNames(cfg.roleNames ?? {});
      setSectionNames(cfg.sectionNames ?? {});
      setSectionPerms(cfg.sectionPerms ?? {});
      setHiddenSections(c.hiddenSections ?? {});
      setTeamNames(c.teamNames ?? {});
      setSystemName(c.systemName ?? "");
      setFactoryType(c.factoryType ?? "");
      setOmtpPath(c.omtpPathTemplate ?? DEFAULT_OMTP_PATH);
      setOmtpColumns(c.omtpColumns ?? { ...DEFAULT_OMTP_COLUMNS });
      setDowntimeFailThreshold(c.downtimeFailThreshold ?? 3);
      setHolidays(c.holidays ?? []);
    }
  }, [cfg]);

  const mutation = useMutation({
    mutationFn: (data: Partial<FactoryConfig>) => apiPut("/factory-config", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["factory-config"] });
      reload();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const saveHolidays = async () => {
    await apiPut("/factory-config", { holidays } as any);
    qc.invalidateQueries({ queryKey: ["factory-config"] });
    setHolidaySaved(true);
    setTimeout(() => setHolidaySaved(false), 2000);
  };

  const addHoliday = () => {
    if (!newHolidayDate) return;
    const entry = newHolidayLabel.trim() ? `${newHolidayDate}|${newHolidayLabel.trim()}` : newHolidayDate;
    if (!holidays.includes(entry) && !holidays.some(h => h.startsWith(newHolidayDate))) {
      setHolidays(prev => [...prev, entry].sort());
    }
    setNewHolidayDate("");
    setNewHolidayLabel("");
  };

  const removeHoliday = (h: string) => {
    setHolidays(prev => prev.filter(x => x !== h));
    const dateKey = h.split("|")[0];
    setDelayResults(prev => { const n = { ...prev }; delete n[dateKey]; return n; });
    setPreviewCounts(prev => { const n = { ...prev }; delete n[dateKey]; return n; });
  };

  const getHolidayDate = (h: string) => h.split("|")[0];
  const getHolidayLabel = (h: string) => h.includes("|") ? h.split("|").slice(1).join("|") : "";

  const previewHoliday = async (h: string) => {
    const date = getHolidayDate(h);
    try {
      const data = await apiFetch(`/factory-config/delay-tasks/preview?date=${date}`);
      setPreviewCounts(prev => ({ ...prev, [date]: data }));
    } catch {}
  };

  const delayHoliday = async (h: string) => {
    const date = getHolidayDate(h);
    setDelayingDate(date);
    try {
      const data = await apiPostJson("/factory-config/delay-tasks", { date });
      setDelayResults(prev => ({ ...prev, [date]: data }));
      setPreviewCounts(prev => ({ ...prev, [date]: { tasksAffected: 0, pmAffected: 0 } }));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDelayingDate(null);
    }
  };

  const save = () => mutation.mutate({
    roleNames, sectionNames, sectionPerms,
    hiddenSections, teamNames, systemName, factoryType,
    omtpPathTemplate: omtpPath,
    omtpColumns,
    downtimeFailThreshold,
  } as any);

  const resetToDefaults = () => {
    if (!confirm("Reset all custom names and permissions to defaults?")) return;
    setRoleNames({});
    setSectionNames({});
    setSectionPerms({});
    setHiddenSections({});
    setTeamNames({});
    setSystemName("");
    setFactoryType("");
  };

  const getPerm = (section: string, role: string) => {
    return sectionPerms[section]?.[role] ?? { canSee: true, canWrite: true };
  };

  const setPerm = (section: string, role: string, changes: Partial<{ canSee: boolean; canWrite: boolean }>) => {
    setSectionPerms(prev => {
      const existing = prev[section]?.[role] ?? { canSee: true, canWrite: true };
      return {
        ...prev,
        [section]: {
          ...(prev[section] ?? {}),
          [role]: { ...existing, ...changes },
        },
      };
    });
  };

  if (!user || user.role !== "admin") {
    return <div className="text-muted-foreground p-8 text-center">Admin access required.</div>;
  }

  if (isLoading) {
    return <div className="text-muted-foreground p-8 text-center animate-pulse">Loading settings...</div>;
  }

  const navItems: { key: Tab; label: string; desc: string; icon: typeof Settings2; color: string; iconBg: string }[] = [
    { key: "names",       label: "Labels & Names",    desc: "Roles & section display names", icon: Users2,       color: "text-blue-400",    iconBg: "bg-blue-500/15 border-blue-500/20" },
    { key: "access",      label: "Access Control",    desc: "Section visibility & write permissions", icon: Shield, color: "text-violet-400", iconBg: "bg-violet-500/15 border-violet-500/20" },
    { key: "holidays",    label: "Holidays & Days Off", desc: "Auto-delay tasks on closed days", icon: CalendarClock, color: "text-orange-400", iconBg: "bg-orange-500/15 border-orange-500/20" },
    { key: "integration", label: "OMTP Integration",  desc: "Machine data pipeline & scripts", icon: Terminal,    color: "text-emerald-400", iconBg: "bg-emerald-500/15 border-emerald-500/20" },
    { key: "backup",      label: "Backup & Restore",  desc: "Data safety & recovery", icon: HardDrive,     color: "text-amber-400",   iconBg: "bg-amber-500/15 border-amber-500/20" },
    { key: "diagnostics", label: "Diagnostics",       desc: "System health & AI analysis", icon: Activity,   color: "text-rose-400",    iconBg: "bg-rose-500/15 border-rose-500/20" },
  ];

  // ── Diagnostics helpers (defined inside return to access scanResult scope) ──
  const diagCategories = scanResult ? [...new Set(scanResult.checks.map(c => c.category))] : [];
  const scoreColor = !scanResult ? "#3b82f6" : scanResult.score >= 85 ? "#10b981" : scanResult.score >= 60 ? "#f59e0b" : "#ef4444";
  const scoreLabel = !scanResult ? "" : scanResult.score >= 85 ? "Healthy" : scanResult.score >= 60 ? "Fair" : "Needs Attention";
  const statusIcon = (s: DiagCheck["status"]) =>
    s === "ok" ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
    : s === "warning" ? <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
    : <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
  const statusBg = (s: DiagCheck["status"]) =>
    s === "ok" ? "bg-emerald-500/5" : s === "warning" ? "bg-amber-500/5" : "bg-red-500/10";
  const findingBg = (p: string) =>
    p === "critical" ? "border-red-500/30 bg-red-500/10" : p === "warning" ? "border-amber-500/30 bg-amber-500/8" : "border-blue-500/20 bg-blue-500/5";
  const findingColor = (p: string) =>
    p === "critical" ? "text-red-400" : p === "warning" ? "text-amber-400" : "text-blue-400";

  const autoInfo = autoBackupInfoQuery.data as { exists: boolean; createdAt?: string; sizeBytes?: number } | undefined;
  const hasAutoBackup = autoInfo?.exists;
  const autoBackupDate = hasAutoBackup && autoInfo?.createdAt ? new Date(autoInfo.createdAt) : null;
  const nextMidnight = new Date(); nextMidnight.setHours(24, 0, 0, 0);
  const hoursUntilBackup = Math.round((nextMidnight.getTime() - Date.now()) / 3600000);

  const showSaveBar = activeTab === "names" || activeTab === "access" || activeTab === "integration";
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-6xl space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <Settings2 className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-display font-bold text-white leading-none">Factory Settings</h2>
          <p className="text-xs text-muted-foreground mt-1">System configuration and admin controls for Midea CMMS</p>
        </div>
        {showSaveBar && (
          <div className="flex items-center gap-2">
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 transition-colors text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button
              onClick={save}
              disabled={mutation.isPending}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg ${
                saved
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-primary text-white hover:bg-primary/90 border border-primary/40 shadow-primary/20"
              }`}
            >
              <Save className="w-4 h-4" />
              {saved ? "Saved!" : mutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {/* ── Two-column layout: sidebar nav + content ── */}
      <div className="flex gap-5 items-start">

        {/* Sidebar */}
        <div className="w-52 flex-shrink-0 space-y-1">
          {navItems.map(item => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all group ${
                  isActive
                    ? "bg-white/8 border border-white/12 shadow-sm"
                    : "border border-transparent hover:bg-white/4 hover:border-white/8"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all ${
                  isActive ? item.iconBg : "bg-white/5 border-white/10 group-hover:bg-white/8"
                }`}>
                  <item.icon className={`w-4 h-4 ${isActive ? item.color : "text-muted-foreground group-hover:text-white/70"}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium leading-none ${isActive ? "text-white" : "text-muted-foreground group-hover:text-white/80"}`}>
                    {item.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1 leading-tight line-clamp-2">{item.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ══ Tab: Labels & Names ══════════════════════════════════════════ */}
          {activeTab === "names" && (
            <div className="space-y-4">

              {/* Role Names */}
              <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Users2 className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white leading-none">Custom Role Names</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Override how each system role is labelled in the UI</p>
                  </div>
                </div>
                <div className="divide-y divide-white/5">
                  {ROLE_KEYS.map(role => (
                    <div key={role} className="flex items-center gap-4 px-5 py-3">
                      <div className="w-32 flex-shrink-0">
                        <span className="text-xs text-white font-medium">{ROLE_DEFAULTS[role]}</span>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono">{role}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={roleNames[role] ?? ""}
                          onChange={e => setRoleNames(prev => ({ ...prev, [role]: e.target.value }))}
                          placeholder={`Display as "${ROLE_DEFAULTS[role]}"`}
                          className="flex-1 max-w-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/40 transition-colors"
                        />
                        {roleNames[role] && (
                          <button
                            onClick={() => setRoleNames(prev => { const next = { ...prev }; delete next[role]; return next; })}
                            className="text-[10px] text-muted-foreground hover:text-white transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20 flex-shrink-0"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section Names */}
              <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Pencil className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white leading-none">Custom Section Names</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Override the name shown in the sidebar for each section</p>
                  </div>
                </div>
                <div className="divide-y divide-white/5">
                  {SECTIONS.map(s => (
                    <div key={s.key} className="flex items-center gap-4 px-5 py-3">
                      <div className="w-44 flex-shrink-0">
                        <span className="text-xs text-white/80">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={sectionNames[s.key] ?? ""}
                          onChange={e => setSectionNames(prev => ({ ...prev, [s.key]: e.target.value }))}
                          placeholder={`Display as "${s.label}"`}
                          className="flex-1 max-w-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/40 transition-colors"
                        />
                        {sectionNames[s.key] && (
                          <button
                            onClick={() => setSectionNames(prev => { const next = { ...prev }; delete next[s.key]; return next; })}
                            className="text-[10px] text-muted-foreground hover:text-white transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20 flex-shrink-0"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Identity */}
              <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Settings2 className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white leading-none">System Identity</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Customize the system name shown in the sidebar and browser tab</p>
                  </div>
                </div>
                <div className="divide-y divide-white/5">
                  <div className="flex items-center gap-4 px-5 py-3">
                    <div className="w-44 flex-shrink-0">
                      <span className="text-xs text-white font-medium">System Name</span>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Shown in sidebar header</p>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={systemName}
                        onChange={e => setSystemName(e.target.value)}
                        placeholder='e.g. "Midea CMMS" or "Oven Factory MMS"'
                        className="flex-1 max-w-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/40 transition-colors"
                      />
                      {systemName && (
                        <button onClick={() => setSystemName("")} className="text-[10px] text-muted-foreground hover:text-white transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20 flex-shrink-0">Reset</button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 px-5 py-3">
                    <div className="w-44 flex-shrink-0">
                      <span className="text-xs text-white font-medium">Factory Type</span>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Describe what this factory produces</p>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={factoryType}
                        onChange={e => setFactoryType(e.target.value)}
                        placeholder='e.g. "Oven Manufacturing", "HVAC Assembly"'
                        className="flex-1 max-w-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/40 transition-colors"
                      />
                      {factoryType && (
                        <button onClick={() => setFactoryType("")} className="text-[10px] text-muted-foreground hover:text-white transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20 flex-shrink-0">Reset</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Team Names */}
              <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Users2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white leading-none">Team Names</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Rename the production teams to match your factory structure</p>
                  </div>
                </div>
                <div className="divide-y divide-white/5">
                  {DEFAULT_TEAMS.map(t => (
                    <div key={t.key} className="flex items-center gap-4 px-5 py-3">
                      <div className="w-44 flex-shrink-0">
                        <span className="text-xs text-white font-medium">{t.label}</span>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono">{t.key}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={teamNames[t.key] ?? ""}
                          onChange={e => setTeamNames(prev => ({ ...prev, [t.key]: e.target.value }))}
                          placeholder={`Display as "${t.label}"`}
                          className="flex-1 max-w-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/40 transition-colors"
                        />
                        {teamNames[t.key] && (
                          <button
                            onClick={() => setTeamNames(prev => { const next = { ...prev }; delete next[t.key]; return next; })}
                            className="text-[10px] text-muted-foreground hover:text-white transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20 flex-shrink-0"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigation Visibility */}
              <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                    <Eye className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white leading-none">Navigation Visibility</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Hide sections that are not relevant to this factory — affects all users</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const allHidden: Record<string, boolean> = {};
                        NAV_ITEMS_FOR_VISIBILITY.filter(n => !n.protected).forEach(n => { allHidden[n.href] = true; });
                        setHiddenSections(allHidden);
                      }}
                      className="text-[10px] text-muted-foreground hover:text-white transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20 flex-shrink-0"
                    >
                      Hide all
                    </button>
                    <button
                      onClick={() => setHiddenSections({})}
                      className="text-[10px] text-muted-foreground hover:text-white transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20 flex-shrink-0"
                    >
                      Show all
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-white/5">
                  {NAV_ITEMS_FOR_VISIBILITY.map((item, idx) => {
                    const isVisible = !hiddenSections[item.href];
                    const isEven = idx % 2 === 0;
                    return (
                      <div
                        key={item.href}
                        className={`flex items-center gap-3 px-5 py-3 border-white/5 ${
                          Math.floor(idx / 2) < Math.floor(NAV_ITEMS_FOR_VISIBILITY.length / 2)
                            ? "sm:border-b"
                            : ""
                        } ${isEven ? "sm:border-r" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs font-medium ${item.protected ? "text-muted-foreground/60" : isVisible ? "text-white" : "text-muted-foreground/50 line-through"}`}>
                            {item.label}
                          </span>
                          {item.protected && (
                            <span className="ml-2 text-[9px] text-amber-400/70 uppercase tracking-wider font-semibold">locked</span>
                          )}
                        </div>
                        {item.protected ? (
                          <div className="flex items-center gap-1.5 flex-shrink-0 opacity-40">
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">Always shown</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isVisible
                              ? <Eye className="w-3.5 h-3.5 text-emerald-400" />
                              : <EyeOff className="w-3.5 h-3.5 text-muted-foreground/40" />
                            }
                            <Toggle
                              checked={isVisible}
                              onChange={val => setHiddenSections(prev => {
                                const next = { ...prev };
                                if (val) delete next[item.href];
                                else next[item.href] = true;
                                return next;
                              })}
                              color={isVisible ? "green" : "blue"}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ══ Tab: Access Control ══════════════════════════════════════════ */}
          {activeTab === "access" && (
            <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white leading-none">Section Access by Role</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <Eye className="w-3 h-3 inline mr-1 opacity-60" />Visible &nbsp;·&nbsp;
                    <Pencil className="w-3 h-3 inline mr-1 opacity-60" />Write &nbsp;·&nbsp;
                    <span className="text-yellow-400/70">Admin always has full access</span>
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-start px-5 py-3 text-xs font-semibold text-muted-foreground w-44 min-w-[10rem]">Section</th>
                      {ROLE_KEYS.filter(r => r !== "admin").map(role => (
                        <th key={role} className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground min-w-[7rem]">
                          <div className="text-white/80">{roleNames[role] || ROLE_DEFAULTS[role]}</div>
                          <div className="text-[10px] text-muted-foreground/50 font-normal mt-0.5 flex justify-center gap-3">
                            <span>see</span><span>write</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {SECTIONS.map(s => (
                      <tr key={s.key} className="hover:bg-white/2 transition-colors">
                        <td className="px-5 py-3 text-xs text-white font-medium">
                          {sectionNames[s.key] || s.label}
                        </td>
                        {ROLE_KEYS.filter(r => r !== "admin").map(role => {
                          const p = getPerm(s.key, role);
                          return (
                            <td key={role} className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center gap-3">
                                <Toggle checked={p.canSee} onChange={val => setPerm(s.key, role, val ? { canSee: true } : { canSee: false, canWrite: false })} color="blue" />
                                <Toggle checked={p.canSee && p.canWrite} onChange={val => setPerm(s.key, role, val ? { canSee: true, canWrite: true } : { canWrite: false })} color="green" />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ Tab: Holidays & Days Off ═════════════════════════════════════ */}
          {activeTab === "holidays" && (
            <div className="space-y-4">
              {/* Header card */}
              <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                      <CalendarClock className="w-3.5 h-3.5 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white leading-none">Factory Holidays & Days Off</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Mark factory-wide closed days. Then delay any tasks or PM plans due on those days to the next working day.</p>
                    </div>
                  </div>
                  <button
                    onClick={saveHolidays}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-shrink-0 ${
                      holidaySaved
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-primary text-white hover:bg-primary/90 border border-primary/40"
                    }`}
                  >
                    <Save className="w-4 h-4" />
                    {holidaySaved ? "Saved!" : "Save Holidays"}
                  </button>
                </div>

                {/* Add new holiday */}
                <div className="px-5 py-4 border-b border-white/8 bg-white/2">
                  <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Add Holiday / Day Off</p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Date *</label>
                      <input
                        type="date"
                        value={newHolidayDate}
                        min={today}
                        onChange={e => setNewHolidayDate(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/40 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-[160px]">
                      <label className="text-xs text-muted-foreground">Label (optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Eid Al-Fitr, National Day…"
                        value={newHolidayLabel}
                        onChange={e => setNewHolidayLabel(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addHoliday()}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/40 transition-colors"
                      />
                    </div>
                    <button
                      onClick={addHoliday}
                      disabled={!newHolidayDate}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                </div>

                {/* Holidays list */}
                {holidays.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <CalendarClock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No holidays added yet.</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Add a date above to get started.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {holidays.map(h => {
                      const date = getHolidayDate(h);
                      const label = getHolidayLabel(h);
                      const result = delayResults[date];
                      const preview = previewCounts[date];
                      const isDelaying = delayingDate === date;
                      const isPast = date < today;
                      const formattedDate = new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

                      return (
                        <div key={h} className={`px-5 py-4 ${isPast ? "opacity-60" : ""}`}>
                          <div className="flex items-start gap-4">
                            {/* Date info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-white font-mono">{date}</span>
                                {label && <span className="text-xs bg-orange-500/15 border border-orange-500/25 text-orange-300 px-2 py-0.5 rounded">{label}</span>}
                                {isPast && <span className="text-[10px] bg-white/5 border border-white/10 text-muted-foreground px-1.5 py-0.5 rounded">Past</span>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{formattedDate}</p>

                              {/* Preview counts */}
                              {preview && (
                                <div className="mt-2 flex items-center gap-3">
                                  <span className={`text-xs px-2 py-0.5 rounded border ${preview.tasksAffected > 0 ? "bg-blue-500/10 border-blue-500/20 text-blue-300" : "bg-white/5 border-white/10 text-muted-foreground"}`}>
                                    {preview.tasksAffected} task{preview.tasksAffected !== 1 ? "s" : ""} affected
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded border ${preview.pmAffected > 0 ? "bg-violet-500/10 border-violet-500/20 text-violet-300" : "bg-white/5 border-white/10 text-muted-foreground"}`}>
                                    {preview.pmAffected} PM plan{preview.pmAffected !== 1 ? "s" : ""} affected
                                  </span>
                                </div>
                              )}

                              {/* Delay result feedback */}
                              {result && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                                  <Check className="w-3.5 h-3.5" />
                                  Delayed {result.tasksDelayed} task{result.tasksDelayed !== 1 ? "s" : ""} + {result.pmDelayed} PM plan{result.pmDelayed !== 1 ? "s" : ""} → {result.newDate}
                                </div>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {!result && (
                                <button
                                  onClick={() => previewHoliday(h)}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-white hover:border-white/20 hover:bg-white/5 transition-colors flex items-center gap-1.5"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Preview
                                </button>
                              )}
                              {!result && (
                                <button
                                  onClick={() => {
                                    const count = (preview?.tasksAffected ?? 0) + (preview?.pmAffected ?? 0);
                                    const msg = count > 0
                                      ? `This will delay ${preview!.tasksAffected} task(s) and ${preview!.pmAffected} PM plan(s) from ${date} to the next working day. Continue?`
                                      : `Delay all tasks and PM plans due on ${date} to the next working day?`;
                                    if (!confirm(msg)) return;
                                    delayHoliday(h);
                                  }}
                                  disabled={isDelaying}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  {isDelaying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                  {isDelaying ? "Delaying…" : "Delay Tasks"}
                                </button>
                              )}
                              <button
                                onClick={() => removeHoliday(h)}
                                className="p-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-colors"
                                title="Remove holiday"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Info callout */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-5 py-4 flex gap-3">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-300/80 space-y-1">
                  <p><strong className="text-blue-300">How it works:</strong> Save your holiday list first, then click <em>Preview</em> to see how many tasks are affected, and <em>Delay Tasks</em> to push them to the next working day (skipping weekends and other saved holidays).</p>
                  <p>Only <strong className="text-blue-300">pending / in-progress tasks</strong> and <strong className="text-blue-300">active PM plans</strong> are moved — completed and cancelled records are untouched.</p>
                </div>
              </div>
            </div>
          )}

          {/* ══ Tab: OMTP Integration ════════════════════════════════════════ */}
          {activeTab === "integration" && (
            <div className="space-y-4">

              {/* Connection Info */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-emerald-500/15 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Link className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white leading-none">Machine Monitor — Connection Info</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Paste these into OMTP_Setup.bat on factory PCs</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Server URL</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-emerald-400 font-mono truncate select-all">
                        {serverUrl}
                      </code>
                      <button onClick={() => copyText(serverUrl, setCopiedUrl)} className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white transition-colors flex-shrink-0">
                        {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        {copiedUrl ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">API Key</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono truncate select-all text-amber-400">
                        {machineApiKey
                          ? (showKey ? machineApiKey : "cmms_" + "•".repeat(40))
                          : <span className="text-muted-foreground italic">Generating…</span>}
                      </code>
                      <button onClick={() => setShowKey(v => !v)} className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white transition-colors flex-shrink-0">
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      {machineApiKey && (
                        <button onClick={() => copyText(machineApiKey, setCopiedKey)} className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white transition-colors flex-shrink-0">
                          {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          {copiedKey ? "Copied!" : "Copy"}
                        </button>
                      )}
                      <button
                        onClick={() => { if (!confirm("Regenerate the API key? The OMTP script will stop working until you update its config.")) return; regenMutation.mutate(); }}
                        disabled={regenMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-sm text-amber-400 transition-colors flex-shrink-0"
                      >
                        <RefreshCw className={`w-4 h-4 ${regenMutation.isPending ? "animate-spin" : ""}`} /> Regen
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70">Keep this secret — paste it when OMTP_Setup.bat asks for "API Key".</p>
                  </div>
                </div>
              </div>

              {/* Auto-Downtime Threshold */}
              <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white leading-none">Auto-Downtime Threshold</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Consecutive failures before a downtime record is auto-created</p>
                  </div>
                </div>
                <div className="px-5 py-4 flex items-center gap-5">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setDowntimeFailThreshold(v => Math.max(1, v - 1))} className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors text-lg font-bold">−</button>
                    <input
                      type="number" min={1} max={20} value={downtimeFailThreshold}
                      onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1) setDowntimeFailThreshold(v); }}
                      className="w-16 text-center bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-base font-bold text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <button type="button" onClick={() => setDowntimeFailThreshold(v => Math.min(20, v + 1))} className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors text-lg font-bold">+</button>
                  </div>
                  <div>
                    <p className="text-sm text-white font-semibold">
                      {downtimeFailThreshold === 1 ? "Every single failure" : `${downtimeFailThreshold} consecutive fails`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {downtimeFailThreshold === 1 ? "Downtime is recorded on the very first failure" : `The same error must appear ${downtimeFailThreshold}× in a row to trigger downtime`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Path Template */}
              <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white leading-none">Log File Path Template</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Use <code className="text-amber-400">{"{MODEL}"}</code> and <code className="text-amber-400">{"{DATE}"}</code> as dynamic tokens</p>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <input
                    type="text" value={omtpPath} onChange={e => setOmtpPath(e.target.value)} placeholder={DEFAULT_OMTP_PATH}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
                  />
                  <div className="flex flex-wrap gap-2">
                    {["{MODEL}", "{DATE}"].map(token => (
                      <button key={token} type="button" onClick={() => setOmtpPath(p => p + token)} className="flex items-center gap-1 px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-mono hover:bg-amber-500/20 transition-colors">
                        <Plus className="w-3 h-3" />{token}
                      </button>
                    ))}
                    <button type="button" onClick={() => setOmtpPath(DEFAULT_OMTP_PATH)} className="flex items-center gap-1 px-2 py-1 rounded border border-white/10 text-muted-foreground text-xs hover:text-white hover:border-white/20 transition-colors">
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  </div>
                  <div className="rounded-lg bg-white/3 border border-white/8 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground/60 mb-1 uppercase tracking-widest">Preview — today</p>
                    <code className="text-xs text-emerald-400 break-all">
                      {omtpPath.replace(/\{MODEL\}/gi, "CPH2025").replace(/\{DATE\}/gi, new Date().toLocaleDateString("en-GB").split("/").join("-"))}
                    </code>
                  </div>
                </div>
              </div>

              {/* Column Mapping */}
              <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Columns3 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white leading-none">Column Header Mapping</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Paste CSV/xlsx headers then auto-map known OMTP fields</p>
                  </div>
                </div>
                <div className="px-5 pt-4 pb-2 space-y-3">
                  <div className="relative">
                    <textarea
                      value={rawHeaders} onChange={e => setRawHeaders(e.target.value)} rows={3}
                      placeholder="Paste header row from OMTP CSV or Excel — OPER  LOT_ID  TEST_RESULT  TEST_TIME  RESULT_MSG  CYCLETIME"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                    />
                    {rawHeaders && (
                      <button onClick={() => setRawHeaders("")} className="absolute top-2 right-2 p-1 rounded text-muted-foreground hover:text-white">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {parsedHeaders.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1.5">
                          {parsedHeaders.map(h => (
                            <span key={h} className="px-2 py-0.5 rounded bg-primary/15 border border-primary/20 text-primary text-xs font-mono">{h}</span>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground/60 flex-shrink-0 ml-2">{parsedHeaders.length} cols</span>
                      </div>
                      <button type="button" onClick={autoMapColumns} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary text-xs font-semibold transition-colors">
                        <Wand2 className="w-3.5 h-3.5" /> Auto-Map Known Fields
                      </button>
                    </div>
                  )}
                </div>
                <div className="divide-y divide-white/5 pb-2">
                  {OMTP_ROLES.map(role => {
                    const options = parsedHeaders.length > 0 ? parsedHeaders : Object.values(DEFAULT_OMTP_COLUMNS);
                    return (
                      <div key={role.key} className="flex items-center gap-4 px-5 py-3">
                        <div className="w-40 flex-shrink-0">
                          <p className="text-sm text-white font-medium">{role.label}</p>
                          <p className="text-xs text-muted-foreground/60">{role.hint}</p>
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <select value={omtpColumns[role.key] || ""} onChange={e => setOmtpColumns(prev => ({ ...prev, [role.key]: e.target.value }))} className="flex-1 max-w-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/50">
                            <option value="" className="bg-[#0e1117] text-muted-foreground">— not mapped —</option>
                            {options.map(h => <option key={h} value={h} className="bg-[#0e1117]">{h}</option>)}
                          </select>
                          <input type="text" value={omtpColumns[role.key] || ""} onChange={e => setOmtpColumns(prev => ({ ...prev, [role.key]: e.target.value }))} placeholder="or type manually" className="w-32 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50" />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-5 pb-4 pt-1">
                  <button type="button" onClick={() => setOmtpColumns({ ...DEFAULT_OMTP_COLUMNS })} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white px-2 py-1 rounded border border-white/10 hover:border-white/20 transition-colors">
                    <RotateCcw className="w-3 h-3" /> Reset columns to default
                  </button>
                </div>
              </div>

              {/* Script Download */}
              {isAdmin && (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 overflow-hidden">
                  <div className="px-5 py-4 border-b border-emerald-500/15 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white leading-none">OMTP Log Pusher Script</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Pre-configured with your server URL and API key — no editing needed</p>
                    </div>
                    <a href={`${BASE}/api/downloads/omtp-ready`} download="cmms_Start.bat" className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors flex-shrink-0 shadow-lg shadow-emerald-500/20">
                      <Download className="w-4 h-4" /> Download cmms_Start.bat
                    </a>
                  </div>
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { step: "①", title: "On the factory PC", body: <>Double-click <span className="text-emerald-400 font-mono">cmms_Start.bat</span> — a green window opens. Python installs automatically if missing.</> },
                      { step: "②", title: "Fully automatic", body: <>PC is identified by IP via Machine Registry. Line ID and model are fetched from CMMS — no typing at the factory PC.</> },
                      { step: "③", title: "Team leader step", body: <>Enter the <span className="text-amber-400">product model code</span> (e.g. CPH2523) in <span className="text-white">Production → Shift Setup</span> each shift.</> },
                    ].map(s => (
                      <div key={s.step} className="bg-white/4 rounded-xl border border-white/8 p-4">
                        <p className="text-emerald-400 font-bold text-base mb-1">{s.step}</p>
                        <p className="text-white text-xs font-semibold mb-1">{s.title}</p>
                        <p className="text-muted-foreground text-xs leading-relaxed">{s.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 pb-4 flex items-center gap-4">
                    <a href={`${BASE}/api/downloads/omtp-guide`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                      <BookOpen className="w-3.5 h-3.5" /> Full setup guide
                    </a>
                    <span className="text-white/10">|</span>
                    <a href={`${BASE}/api/downloads/omtp-pusher`} download="omtp_log_pusher.py" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors">
                      <FileText className="w-3.5 h-3.5" /> Python script only
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ Tab: Backup & Restore ════════════════════════════════════════ */}
          {activeTab === "backup" && (
            <div className="space-y-4">

              {/* Manual Backup & Restore */}
              <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white leading-none">Manual Backup & Restore</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Full factory snapshot — all users, machines, downtime, inventory, KPIs, training, PM plans, attendance</p>
                  </div>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Create Backup */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Create Backup</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">Downloads a complete snapshot of your factory database as JSON. Store it safely — it can restore the entire system from scratch.</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {["Users & roles", "Machines & QR registry", "Downtime records", "Inventory & orders", "PM plans & history", "Training & exam results", "Attendance & KPIs", "Factory settings & config"].map(item => (
                        <li key={item} className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500/60 flex-shrink-0" />{item}
                        </li>
                      ))}
                    </ul>
                    <button onClick={downloadBackup} disabled={backingUp} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50">
                      {backingUp ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</> : <><Download className="w-4 h-4" /> Download Full Backup</>}
                    </button>
                  </div>

                  {/* Restore from Backup */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Restore Backup</span>
                    </div>
                    {restoreResult ? (
                      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-emerald-400"><Check className="w-4 h-4" /><span className="text-sm font-semibold">Restore complete!</span></div>
                        <p className="text-xs text-muted-foreground">{restoreResult.rows.toLocaleString()} rows restored across {restoreResult.tables} tables.</p>
                        <p className="text-xs text-amber-400">Please refresh the page to see restored data.</p>
                        <button onClick={() => window.location.reload()} className="mt-1 text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white transition-colors">Refresh now →</button>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-3 flex items-start gap-2">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-300/80 leading-relaxed">Restoring a backup <strong className="text-amber-300">permanently replaces all current data</strong>. This cannot be undone.</p>
                        </div>
                        <label className={`flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${restoreFile ? "border-blue-500/50 bg-blue-500/8" : "border-white/15 hover:border-white/30 bg-white/3"}`}>
                          <Upload className="w-5 h-5 text-muted-foreground" />
                          {restoreFile ? (
                            <div className="text-center">
                              <p className="text-xs font-semibold text-blue-300">{restoreFile.name}</p>
                              <p className="text-xs text-muted-foreground">{(restoreFile.size / 1024 / 1024).toFixed(1)} MB — ready to restore</p>
                            </div>
                          ) : (
                            <div className="text-center">
                              <p className="text-xs font-medium text-white">Click to select backup file</p>
                              <p className="text-xs text-muted-foreground">cmms-backup-YYYY-MM-DD.json</p>
                            </div>
                          )}
                          <input type="file" accept=".json,application/json" className="hidden" onChange={e => { setRestoreFile(e.target.files?.[0] ?? null); setRestoreError(null); setRestoreResult(null); }} />
                        </label>
                        {restoreError && (
                          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-300 break-all">{restoreError}</p>
                          </div>
                        )}
                        {!showRestoreConfirm ? (
                          <button onClick={() => setShowRestoreConfirm(true)} disabled={!restoreFile || restoring} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                            <UploadCloud className="w-4 h-4" /> Restore from Backup
                          </button>
                        ) : (
                          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 space-y-2">
                            <p className="text-xs text-red-300 font-semibold text-center">⚠ This will erase ALL current data. Are you sure?</p>
                            <div className="flex gap-2">
                              <button onClick={confirmRestore} disabled={restoring} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors disabled:opacity-50">
                                {restoring ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Restoring…</> : "Yes, erase & restore"}
                              </button>
                              <button onClick={() => setShowRestoreConfirm(false)} className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors">Cancel</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Auto Backup */}
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-violet-500/15 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                    <CalendarClock className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white leading-none">Automatic Daily Backup</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Full backup runs every day at midnight and is stored in the database</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    <span className="text-xs text-violet-300 font-medium">Active</span>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-white/4 border border-white/8 px-4 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Latest backup</p>
                      {autoBackupInfoQuery.isLoading ? (
                        <p className="text-sm font-semibold text-white">Loading…</p>
                      ) : hasAutoBackup && autoBackupDate ? (
                        <p className="text-sm font-semibold text-white">{autoBackupDate.toLocaleDateString()} {autoBackupDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      ) : (
                        <p className="text-sm font-semibold text-muted-foreground">Not yet taken</p>
                      )}
                    </div>
                    <div className="rounded-xl bg-white/4 border border-white/8 px-4 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Backup size</p>
                      <p className="text-sm font-semibold text-white">{hasAutoBackup && autoInfo?.sizeBytes ? `${(autoInfo.sizeBytes / 1024).toFixed(0)} KB` : "—"}</p>
                    </div>
                    <div className="rounded-xl bg-white/4 border border-white/8 px-4 py-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Next backup in</p>
                      <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-violet-400" />
                        {hoursUntilBackup < 1 ? "< 1 hour" : `~${hoursUntilBackup}h`}
                      </p>
                    </div>
                  </div>

                  {autoRestoreResult ? (
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-400"><Check className="w-4 h-4" /><span className="text-sm font-semibold">Restore complete!</span></div>
                      <p className="text-xs text-muted-foreground">{autoRestoreResult.rows.toLocaleString()} rows restored across {autoRestoreResult.tables} tables.</p>
                      <p className="text-xs text-amber-400">Refresh the page to see restored data.</p>
                      <button onClick={() => window.location.reload()} className="mt-1 text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white transition-colors">Refresh now →</button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button onClick={downloadAutoBackup} disabled={!hasAutoBackup || downloadingAuto} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 text-sm font-semibold hover:bg-violet-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        {downloadingAuto ? <><RefreshCw className="w-4 h-4 animate-spin" /> Downloading…</> : <><Download className="w-4 h-4" /> Download Latest Auto-Backup</>}
                      </button>
                      {!showAutoRestoreConfirm ? (
                        <button onClick={() => setShowAutoRestoreConfirm(true)} disabled={!hasAutoBackup || restoringAuto} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                          <UploadCloud className="w-4 h-4" /> Restore from Auto-Backup
                        </button>
                      ) : (
                        <div className="flex-1 rounded-xl bg-red-500/10 border border-red-500/30 p-4 space-y-2">
                          <p className="text-xs text-red-300 font-semibold text-center">⚠ This will erase ALL current data. Sure?</p>
                          <div className="flex gap-2">
                            <button onClick={confirmAutoRestore} disabled={restoringAuto} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors disabled:opacity-50">
                              {restoringAuto ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Restoring…</> : "Yes, erase & restore"}
                            </button>
                            <button onClick={() => setShowAutoRestoreConfirm(false)} className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {autoRestoreError && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-300 break-all">{autoRestoreError}</p>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground/60">The previous backup is replaced each time a new one is taken. Download it to store externally.</p>
                </div>
              </div>
            </div>
          )}

          {/* ══ Tab: Diagnostics ═════════════════════════════════════════════ */}
          {activeTab === "diagnostics" && (
            <div className="space-y-4">

              {/* Header + action buttons */}
              <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                    <Cpu className="w-5 h-5 text-rose-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white">System Diagnostics</h3>
                    <p className="text-xs text-muted-foreground">Run a full health scan and get AI-powered analysis and repair suggestions.</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={runDiagScan} disabled={scanning || analyzing || repairing} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-lg shadow-primary/20">
                      {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                      {scanning ? "Scanning…" : "Run Scan"}
                    </button>
                    <button onClick={runAiAnalysis} disabled={scanning || analyzing || repairing} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-semibold hover:bg-violet-500/30 transition-colors disabled:opacity-50">
                      {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {analyzing ? "Analyzing…" : "AI Analyze"}
                    </button>
                    <button onClick={runAutoRepair} disabled={scanning || analyzing || repairing || codeRepairing} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/30 transition-colors disabled:opacity-50">
                      {repairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                      {repairing ? "Repairing…" : "Auto Repair"}
                    </button>
                    <button onClick={runCodeRepair} disabled={scanning || analyzing || repairing || codeRepairing} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-sm font-semibold hover:bg-cyan-500/30 transition-colors disabled:opacity-50">
                      {codeRepairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                      {codeRepairing ? "Analyzing…" : "AI Code Repair"}
                    </button>
                  </div>
                </div>

                {scanError && (
                  <div className="px-5 py-3 flex items-center gap-2 bg-red-500/10 border-b border-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-300">{scanError}</p>
                  </div>
                )}

                {!scanResult && !scanning && !repairing && !scanError && (
                  <div className="px-5 py-14 flex flex-col items-center gap-3 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
                      <Activity className="w-7 h-7 text-white/15" />
                    </div>
                    <p className="text-sm text-muted-foreground max-w-xs">Click <strong className="text-white">Run Scan</strong> to check system health, <strong className="text-violet-300">AI Analyze</strong> for a smart report, <strong className="text-emerald-300">Auto Repair</strong> to automatically fix issues, or <strong className="text-cyan-300">AI Code Repair</strong> to diagnose and patch runtime errors using GPT.</p>
                  </div>
                )}

                {repairing && (
                  <div className="px-5 py-12 flex flex-col items-center gap-4">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
                      <div className="absolute inset-2 rounded-full border-2 border-emerald-500/40 animate-ping [animation-delay:150ms]" />
                      <div className="absolute inset-4 rounded-full border-2 border-emerald-500 animate-ping [animation-delay:300ms]" />
                      <Wrench className="absolute inset-0 m-auto w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-white">Auto-Repair in progress…</p>
                      <p className="text-xs text-muted-foreground mt-1">Scanning issues and applying fixes automatically</p>
                    </div>
                  </div>
                )}

                {codeRepairing && (
                  <div className="px-5 py-12 flex flex-col items-center gap-4">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
                      <div className="absolute inset-2 rounded-full border-2 border-cyan-500/40 animate-ping [animation-delay:150ms]" />
                      <div className="absolute inset-4 rounded-full border-2 border-cyan-500 animate-ping [animation-delay:300ms]" />
                      <Bot className="absolute inset-0 m-auto w-6 h-6 text-cyan-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-white">AI Code Repair in progress…</p>
                      <p className="text-xs text-muted-foreground mt-1">Reading source code, errors, and database schema…</p>
                    </div>
                  </div>
                )}

                {scanning && (
                  <div className="px-5 py-12 flex flex-col items-center gap-4">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
                      <div className="absolute inset-2 rounded-full border-2 border-primary/40 animate-ping [animation-delay:150ms]" />
                      <div className="absolute inset-4 rounded-full border-2 border-primary animate-ping [animation-delay:300ms]" />
                      <Activity className="absolute inset-0 m-auto w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">Scanning all systems…</p>
                  </div>
                )}

                {scanResult && !scanning && (
                  <div className="p-5 space-y-5">
                    {/* Score row */}
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center gap-2 flex-shrink-0">
                        <div className="relative w-20 h-36">
                          <svg viewBox="0 0 80 144" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                            <defs><clipPath id="cyl-clip"><rect x="4" y="10" width="72" height="124" rx="6" /></clipPath></defs>
                            <rect x="4" y="10" width="72" height="124" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                            <rect x="4" y={10 + 124 * (1 - scanResult.score / 100)} width="72" height={124 * (scanResult.score / 100)} rx="3" fill={scoreColor} opacity="0.25" clipPath="url(#cyl-clip)" />
                            <rect x="4" y={10 + 124 * (1 - scanResult.score / 100) - 1} width="72" height="2" fill={scoreColor} opacity="0.6" clipPath="url(#cyl-clip)" />
                            {[25, 50, 75].map(pct => (
                              <line key={pct} x1="4" y1={10 + 124 * (1 - pct / 100)} x2="16" y2={10 + 124 * (1 - pct / 100)} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                            ))}
                            <text x="40" y="74" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="20" fontWeight="bold">{scanResult.score}</text>
                            <text x="40" y="92" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.4)" fontSize="8">/ 100</text>
                          </svg>
                        </div>
                        <span className="text-xs font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-3 text-center">
                            <div className="text-2xl font-bold text-red-400">{scanResult.checks.filter(c => c.status === "critical").length}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Critical</div>
                          </div>
                          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-3 text-center">
                            <div className="text-2xl font-bold text-amber-400">{scanResult.checks.filter(c => c.status === "warning").length}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Warnings</div>
                          </div>
                          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-3 text-center">
                            <div className="text-2xl font-bold text-emerald-400">{scanResult.checks.filter(c => c.status === "ok").length}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Passing</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-white/3 rounded-xl border border-white/8 px-3 py-2.5">
                          <div className="flex items-center gap-1.5"><Server className="w-3 h-3" /> Uptime: {Math.floor(scanResult.serverUptime / 3600)}h {Math.floor((scanResult.serverUptime % 3600) / 60)}m</div>
                          <div className="flex items-center gap-1.5"><Database className="w-3 h-3" /> Memory: {scanResult.memoryMb} MB</div>
                          <div className="col-span-2 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Scanned: {new Date(scanResult.scannedAt).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    {/* Checks grouped by category */}
                    <div className="space-y-2">
                      {diagCategories.map(cat => {
                        const catChecks = scanResult.checks.filter(c => c.category === cat);
                        const catIssues = catChecks.filter(c => c.status !== "ok").length;
                        const isOpen = expandedCategories.has(cat);
                        return (
                          <div key={cat} className="rounded-xl border border-white/10 overflow-hidden">
                            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors text-left" onClick={() => toggleCategory(cat)}>
                              {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                              <span className="text-sm font-semibold text-white flex-1">{cat}</span>
                              <span className="text-xs text-muted-foreground">{catChecks.length} checks</span>
                              {catIssues > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">{catIssues} issue{catIssues > 1 ? "s" : ""}</span>
                              )}
                            </button>
                            {isOpen && (
                              <div className="border-t border-white/8 divide-y divide-white/5">
                                {catChecks.map(c => (
                                  <div key={c.id} className={`flex items-start gap-3 px-4 py-3 ${statusBg(c.status)}`}>
                                    <div className="mt-0.5">{statusIcon(c.status)}</div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-white">{c.name}</p>
                                      <p className="text-xs text-muted-foreground mt-0.5">{c.message}</p>
                                      {c.detail && <p className="text-[10px] text-red-300/70 mt-0.5 font-mono break-all">{c.detail}</p>}
                                    </div>
                                    {c.value !== undefined && <span className="text-xs text-muted-foreground/60 flex-shrink-0">{c.value}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Analysis */}
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-violet-500/15 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">AI System Analysis</h3>
                    <p className="text-xs text-muted-foreground">Smart diagnosis — finds root causes and gives step-by-step fix instructions.</p>
                  </div>
                </div>

                {aiError && (
                  <div className="px-5 py-3 flex items-center gap-2 bg-red-500/10 border-b border-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-300">{aiError}</p>
                  </div>
                )}

                {analyzing && (
                  <div className="px-5 py-12 flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                    <p className="text-sm text-muted-foreground">AI is analyzing your system…</p>
                  </div>
                )}

                {!aiResult && !analyzing && !aiError && (
                  <div className="px-5 py-10 text-center">
                    <Sparkles className="w-8 h-8 text-violet-400/20 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">Click <strong className="text-violet-300">AI Analyze</strong> above to get a smart diagnosis with root-cause analysis and repair steps.</p>
                  </div>
                )}

                {repairError && (
                  <div className="px-5 py-3 flex items-center gap-2 bg-red-500/10 border-b border-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-300">{repairError}</p>
                  </div>
                )}

                {codeRepairError && (
                  <div className="px-5 py-3 flex items-center gap-2 bg-red-500/10 border-b border-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-300">{codeRepairError}</p>
                  </div>
                )}

                {repairResult && !repairing && (
                  <div className="p-5 space-y-5 border-t border-white/8">
                    {/* Score delta */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Wrench className="w-3.5 h-3.5 text-emerald-400" /> Auto-Repair Report
                        </h4>
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-white/4 border border-white/8">
                            <span className="text-xs text-muted-foreground">Before</span>
                            <span className="text-2xl font-bold" style={{ color: repairResult.preScan.score >= 80 ? "#34d399" : repairResult.preScan.score >= 60 ? "#fbbf24" : "#f87171" }}>{repairResult.preScan.score}</span>
                          </div>
                          <div className="text-muted-foreground text-lg">→</div>
                          <div className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-xs text-emerald-400">After</span>
                            <span className="text-2xl font-bold" style={{ color: repairResult.postScan.score >= 80 ? "#34d399" : repairResult.postScan.score >= 60 ? "#fbbf24" : "#f87171" }}>{repairResult.postScan.score}</span>
                          </div>
                          {repairResult.postScan.score > repairResult.preScan.score && (
                            <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                              <span className="text-emerald-400 text-sm font-bold">+{repairResult.postScan.score - repairResult.preScan.score}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-3 text-xs text-center flex-shrink-0">
                        <div className="flex flex-col items-center gap-1">
                          <span className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">{repairResult.repairs.filter(r => r.status === "fixed").length}</span>
                          <span className="text-muted-foreground">Fixed</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">{repairResult.repairs.filter(r => r.status === "manual").length}</span>
                          <span className="text-muted-foreground">Manual</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 font-bold">{repairResult.repairs.filter(r => r.status === "failed").length}</span>
                          <span className="text-muted-foreground">Failed</span>
                        </div>
                      </div>
                    </div>

                    {/* AI Summary */}
                    {repairResult.aiSummary && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-emerald-200/90 leading-relaxed">{repairResult.aiSummary}</p>
                      </div>
                    )}

                    {/* Repair actions list */}
                    <div className="space-y-2">
                      {repairResult.repairs.map((r, i) => {
                        const isFixed  = r.status === "fixed";
                        const isManual = r.status === "manual";
                        const isFailed = r.status === "failed";
                        return (
                          <div key={i} className={`rounded-xl border p-3 flex items-start gap-3 ${
                            isFixed  ? "bg-emerald-500/8 border-emerald-500/20"
                            : isManual ? "bg-amber-500/8 border-amber-500/20"
                            : isFailed ? "bg-red-500/8 border-red-500/20"
                            : "bg-white/4 border-white/8"
                          }`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isFixed  ? "bg-emerald-500/20" : isManual ? "bg-amber-500/20" : isFailed ? "bg-red-500/20" : "bg-white/8"
                            }`}>
                              {isFixed  && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                              {isManual && <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
                              {isFailed && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                              {r.status === "skipped" && <MinusCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-white">{r.checkName}</span>
                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${
                                  isFixed  ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                                  : isManual ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                                  : isFailed ? "text-red-400 border-red-500/30 bg-red-500/10"
                                  : "text-muted-foreground border-white/10"
                                }`}>{isFixed ? "Fixed" : isManual ? "Manual" : isFailed ? "Failed" : "Skipped"}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.action}</p>
                              {r.detail && <p className="text-xs text-red-300/70 mt-1 font-mono">{r.detail}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {codeRepairResult && !codeRepairing && (
                  <div className="p-5 space-y-5 border-t border-white/8">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-white uppercase tracking-widest">AI Code Repair Report</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{codeRepairResult.analysis}</p>
                      </div>
                      <div className="flex gap-3 text-xs text-center flex-shrink-0">
                        <div className="flex flex-col items-center gap-1">
                          <span className="w-7 h-7 rounded-full bg-slate-500/20 border border-slate-500/30 flex items-center justify-center text-slate-300 font-bold">{codeRepairResult.totalErrors}</span>
                          <span className="text-muted-foreground">Errors</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">{codeRepairResult.fixes.length}</span>
                          <span className="text-muted-foreground">Fixes</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">{codeRepairResult.applied}</span>
                          <span className="text-muted-foreground">Applied</span>
                        </div>
                      </div>
                    </div>

                    {/* Recent errors list */}
                    {codeRepairResult.errors.length > 0 && (
                      <div className="space-y-1.5">
                        <h5 className="text-xs font-bold text-white/60 uppercase tracking-widest">Captured Errors</h5>
                        {codeRepairResult.errors.map(e => (
                          <div key={e.id} className={`rounded-lg border px-3 py-2 flex items-start gap-2 text-xs ${e.autoFixed ? "bg-emerald-500/8 border-emerald-500/20" : e.resolved ? "bg-white/4 border-white/8" : "bg-red-500/8 border-red-500/20"}`}>
                            <span className={`font-mono px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${e.autoFixed ? "bg-emerald-500/20 text-emerald-400" : e.resolved ? "bg-white/10 text-muted-foreground" : "bg-red-500/20 text-red-400"}`}>
                              {e.autoFixed ? "FIXED" : e.resolved ? "OK" : "ERR"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="text-white/80 font-medium">{e.errorType}</span>
                              <span className="text-muted-foreground mx-1">·</span>
                              <span className="text-muted-foreground font-mono">{e.method} {e.url}</span>
                              <p className="text-muted-foreground truncate mt-0.5">{e.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Fixes */}
                    {codeRepairResult.fixes.length > 0 ? (
                      <div className="space-y-2">
                        <h5 className="text-xs font-bold text-white/60 uppercase tracking-widest">Fixes Generated</h5>
                        {codeRepairResult.fixes.map((fix, i) => {
                          const isExpanded = expandedFix === i;
                          const typeColor = fix.fixType === "sql" || fix.fixType === "data"
                            ? "text-blue-400 border-blue-500/30 bg-blue-500/10"
                            : fix.fixType === "code"
                            ? "text-violet-400 border-violet-500/30 bg-violet-500/10"
                            : "text-amber-400 border-amber-500/30 bg-amber-500/10";
                          return (
                            <div key={i} className={`rounded-xl border overflow-hidden ${fix.applied ? "bg-emerald-500/8 border-emerald-500/20" : fix.applyError ? "bg-red-500/8 border-red-500/20" : "bg-white/4 border-white/8"}`}>
                              <button className="w-full flex items-center gap-3 p-3 text-left" onClick={() => setExpandedFix(isExpanded ? null : i)}>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {fix.applied ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : fix.applyError ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" /> : fix.fixType === "code" ? <Code2 className="w-4 h-4 text-violet-400 flex-shrink-0" /> : <Zap className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                                  <span className="text-xs font-semibold text-white truncate">{fix.title}</span>
                                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border flex-shrink-0 ${typeColor}`}>{fix.fixType}</span>
                                  {fix.applied && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border text-emerald-400 border-emerald-500/30 bg-emerald-500/10 flex-shrink-0">Applied</span>}
                                </div>
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                              </button>
                              {isExpanded && (
                                <div className="px-3 pb-3 space-y-2.5 border-t border-white/8 pt-2.5">
                                  <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Root Cause</p>
                                    <p className="text-xs text-white/80">{fix.rootCause}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Fix Description</p>
                                    <p className="text-xs text-muted-foreground">{fix.description}</p>
                                  </div>
                                  {fix.sqlFix && (
                                    <div>
                                      <p className="text-[10px] text-blue-400 uppercase font-bold tracking-wider mb-1">SQL {fix.applied ? "(Executed)" : "(Not yet applied)"}</p>
                                      <pre className="text-[10px] font-mono bg-black/30 border border-white/8 rounded-lg p-2 overflow-x-auto text-blue-300 whitespace-pre-wrap">{fix.sqlFix}</pre>
                                    </div>
                                  )}
                                  {fix.codeFile && (
                                    <div>
                                      <p className="text-[10px] text-violet-400 uppercase font-bold tracking-wider mb-1">File: {fix.codeFile}</p>
                                      {fix.oldCode && (
                                        <div className="space-y-1">
                                          <p className="text-[10px] text-red-400 font-bold">Remove:</p>
                                          <pre className="text-[10px] font-mono bg-red-500/10 border border-red-500/20 rounded-lg p-2 overflow-x-auto text-red-300 whitespace-pre-wrap">{fix.oldCode}</pre>
                                          <p className="text-[10px] text-emerald-400 font-bold">Replace with:</p>
                                          <pre className="text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 overflow-x-auto text-emerald-300 whitespace-pre-wrap">{fix.newCode}</pre>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {fix.configKey && (
                                    <div>
                                      <p className="text-[10px] text-amber-400 uppercase font-bold tracking-wider mb-1">Config Change</p>
                                      <code className="text-xs bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 text-amber-300">{fix.configKey} = {fix.configValue}</code>
                                    </div>
                                  )}
                                  {fix.applyError && <p className="text-xs text-red-300">Error: {fix.applyError}</p>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <p className="text-xs text-emerald-200">No errors detected — your code and data are clean.</p>
                      </div>
                    )}

                    {codeRepairResult.summary && (
                      <div className="border-t border-white/8 pt-3 flex items-start gap-2">
                        <Bot className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground italic">{codeRepairResult.summary}</p>
                      </div>
                    )}
                  </div>
                )}

                {aiResult && !analyzing && (
                  <div className="p-5 space-y-5">
                    <div className="flex items-start gap-4">
                      <div className={`px-3 py-1 rounded-full text-xs font-bold border flex-shrink-0 ${
                        aiResult.healthLabel === "Excellent" || aiResult.healthLabel === "Good" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                        : aiResult.healthLabel === "Fair" ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
                        : "bg-red-500/20 border-red-500/30 text-red-400"
                      }`}>{aiResult.healthLabel}</div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{aiResult.assessment}</p>
                    </div>

                    {aiResult.findings && aiResult.findings.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-widest">Issues Found</h4>
                        {aiResult.findings.map((f, i) => (
                          <div key={i} className={`rounded-xl border p-4 space-y-2 ${findingBg(f.priority)}`}>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${findingColor(f.priority)} border-current/30 bg-current/10`}>{f.priority}</span>
                              <span className="text-sm font-semibold text-white">{f.title}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{f.problem}</p>
                            <div className="flex items-start gap-1.5 pt-1.5 border-t border-white/5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-emerald-300/90">{f.fix}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {aiResult.repairPlan && aiResult.repairPlan.length > 0 && (
                      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                        <h4 className="text-xs font-bold text-blue-300 uppercase tracking-widest flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5" /> Repair Plan
                        </h4>
                        <ol className="space-y-2">
                          {aiResult.repairPlan.map((step, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                              <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold flex-shrink-0 text-[10px]">{i + 1}</span>
                              {step.replace(/^Step \d+:\s*/i, "")}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {aiResult.summary && (
                      <div className="border-t border-white/8 pt-3 flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground italic">{aiResult.summary}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Sticky save bar — only on config tabs */}
      {showSaveBar && (
        <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/90 backdrop-blur-md border-t border-white/10 flex items-center justify-end gap-3 z-20">
          <p className="text-xs text-muted-foreground flex-1">
            {saved ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> All changes saved
              </span>
            ) : "Unsaved changes — click Save to apply."}
          </p>
          <button onClick={resetToDefaults} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 transition-colors text-xs">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button onClick={save} disabled={mutation.isPending} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg ${saved ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-primary text-white hover:bg-primary/90 border border-primary/40 shadow-primary/20"}`}>
            <Save className="w-4 h-4" />
            {saved ? "Saved!" : mutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
