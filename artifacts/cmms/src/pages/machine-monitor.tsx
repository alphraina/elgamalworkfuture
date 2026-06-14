import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useFactoryConfig } from "@/contexts/factory-config-context";
import {
  RefreshCw, CheckCircle2, XCircle, AlertCircle,
  Clock, Activity, RotateCcw,
  ChevronDown, ChevronRight, Layers, AlertTriangle,
  BarChart2, Cpu, Smartphone, TrendingUp,
  Shield, Zap, WifiOff, UserMinus,
} from "lucide-react";
import MachineAnalysisModal from "./machine-analysis-modal";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const apiFetch = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}/api${path}`, { credentials: "include", ...opts }).then(async r => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.statusText);
    return r.json();
  });

/* ══════════════════════════════════
   TYPES
   ══════════════════════════════════ */
interface AutoDowntime { startTime: string; notes: string; }
interface MachineSnapshot {
  machineRegistryId: number | null;
  machineName: string;
  machineCode: string | null;
  machineType: string | null;
  status: string;
  passCount: number;
  failCount: number;
  totalCount: number | null;
  notes: string | null;
  pushedAt: string | null;
  stationName: string | null;
  model: string | null;
  live: boolean;
  resultMsg: string | null;
  lotId: string | null;
  cycleTimeMs: number | null;
  autoDowntime: AutoDowntime[] | null;
  isTemp?: boolean;
  assignmentId?: number;
  registeredLineId?: number | null;
}
interface StationStats {
  totalTests: number;
  passTests: number;
  failTests: number;
  passRate: number | null;
  totalDevices: number;
  devicesPass: number;
  devicesFail: number;
  avgCycleMs: number | null;
}
interface StationGroup {
  stationNumber: number;
  stationName: string;
  machines: MachineSnapshot[];
  stats: StationStats;
  topErrors: TopError[];
  hasAutoDowntime: boolean;
}
interface LineStats {
  totalTests: number;
  passTests: number;
  failTests: number;
  linePassRate: number | null;
}
interface LineGroup {
  lineId: number;
  lineName: string;
  stations: StationGroup[];
  totalMachines: number;
  liveMachines: number;
  stats: LineStats;
}

/* ══════════════════════════════════
   STATUS CONFIG
   ══════════════════════════════════ */
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; dot: string; icon: React.ElementType }> = {
  pass:    { label: "PASS",    color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", dot: "bg-emerald-400", icon: CheckCircle2 },
  running: { label: "RUNNING", color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/25",    dot: "bg-blue-400",    icon: Activity },
  fail:    { label: "FAIL",    color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/25",     dot: "bg-red-400",     icon: XCircle },
  stopped: { label: "STOPPED", color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/25",  dot: "bg-orange-400",  icon: AlertCircle },
  idle:    { label: "IDLE",    color: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/25",  dot: "bg-yellow-400",  icon: Clock },
  offline: { label: "OFFLINE", color: "text-muted-foreground", bg: "bg-white/5",   border: "border-white/10",       dot: "bg-white/20",    icon: WifiOff },
  unknown: { label: "UNKNOWN", color: "text-muted-foreground", bg: "bg-white/5",   border: "border-white/10",       dot: "bg-white/20",    icon: AlertCircle },
};
const getStatus = (s: string) => STATUS_CFG[s?.toLowerCase()] ?? STATUS_CFG.unknown;

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}
function isStale(iso: string | null): boolean {
  return !iso || Date.now() - new Date(iso).getTime() > 5 * 60 * 1000;
}
function fmtCycle(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ══════════════════════════════════
   HISTORY MODAL
   ══════════════════════════════════ */
function HistoryModal({ m, onClose }: { m: MachineSnapshot; onClose: () => void }) {
  const { data: history = [], isLoading } = useQuery<any[]>({
    queryKey: ["machine-history-modal", m.machineRegistryId],
    queryFn: () => apiFetch(`/machine-data/history/${m.machineRegistryId}`),
    enabled: !!m.machineRegistryId,
    refetchInterval: 8000,
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[hsl(222,16%,7%)] border border-white/15 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <p className="font-bold text-white text-base">{m.machineName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {m.machineCode}{m.machineType ? ` · ${m.machineType}` : ""} · Test History
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-white text-lg leading-none px-2 py-1 rounded hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Stats bar */}
        {history.length > 0 && (
          <div className="grid grid-cols-3 border-b border-white/10 divide-x divide-white/10">
            <div className="p-3 text-center">
              <p className="text-lg font-bold text-white">{history.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Records</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-lg font-bold text-emerald-400">
                {history.filter((h: any) => h.status === "pass").length}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pass</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-lg font-bold text-red-400">
                {history.filter((h: any) => h.status === "fail").length}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fail</p>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              No test records yet
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[hsl(222,16%,9%)] border-b border-white/10">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">Lot / Device</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">Result / Error</th>
                  <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">Cycle</th>
                  <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.map((h: any, i: number) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${
                        h.status === "pass"
                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                          : h.status === "fail"
                          ? "text-red-400 bg-red-500/10 border-red-500/20"
                          : "text-muted-foreground bg-white/5 border-white/10"
                      }`}>
                        {h.status?.toUpperCase() ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-white text-sm font-mono">{h.lotId || <span className="text-muted-foreground">—</span>}</span>
                    </td>
                    <td className="px-4 py-2.5 max-w-xs">
                      {h.resultMsg ? (
                        <span className={`text-sm leading-snug break-words ${h.status === "fail" ? "text-red-300" : "text-muted-foreground"}`}>
                          {h.resultMsg}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-blue-400 font-mono">
                      {h.cycleTimeMs != null ? fmtCycle(h.cycleTimeMs) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                      {timeAgo(h.pushedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════
   MACHINE CARD
   ══════════════════════════════════ */
function MachineCard({ m, onDismissTemp }: { m: MachineSnapshot; onDismissTemp?: (assignmentId: number) => void }) {
  const { user } = useAuth();
  const [showHistory, setShowHistory] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const st = getStatus(m.status);
  const Icon = st.icon;
  const stale = isStale(m.pushedAt);
  const hasAutoDowntime = m.autoDowntime && m.autoDowntime.length > 0;
  const canDismiss = ["admin","manager","team_leader"].includes(user?.role ?? "");

  // Pusher status
  const pusherActive = m.live && !stale;
  const pusherStale  = m.live && stale;

  return (
    <>
    <div className={`bg-black/30 border rounded-xl transition-all ${
      m.isTemp ? "border-amber-500/40" :
      hasAutoDowntime ? "border-red-500/50" :
      m.status === "fail" ? "border-red-500/30" :
      m.status === "pass" ? "border-emerald-500/20" :
      "border-white/10"
    }`}>
      <div className="p-3">
        {/* Temp machine banner */}
        {m.isTemp && (
          <div className="flex items-center justify-between bg-amber-500/15 border border-amber-500/30 rounded-lg px-2 py-1 mb-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-[10px] text-amber-400 font-semibold">TEMP — VISITING THIS LINE</span>
            </div>
            {canDismiss && m.assignmentId != null && (
              <button
                onClick={() => onDismissTemp?.(m.assignmentId!)}
                className="flex items-center gap-0.5 text-[10px] text-amber-400 hover:text-white bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/30 px-1.5 py-0.5 rounded transition-colors"
                title="Remove from this line"
              >
                <UserMinus className="w-2.5 h-2.5" />
                Remove
              </button>
            )}
          </div>
        )}

        {/* Auto-downtime alert */}
        {hasAutoDowntime && (
          <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 rounded-lg px-2 py-1 mb-2">
            <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
            <span className="text-[10px] text-red-400 font-semibold">AUTO-DOWNTIME RECORDED</span>
          </div>
        )}

        {/* Pusher indicator */}
        <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 mb-2 border text-[10px] font-semibold ${
          pusherActive
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            : pusherStale
            ? "bg-orange-500/10 border-orange-500/20 text-orange-400"
            : "bg-white/5 border-white/10 text-muted-foreground"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            pusherActive ? "bg-emerald-400 animate-pulse" :
            pusherStale  ? "bg-orange-400" :
            "bg-white/20"
          }`} />
          {pusherActive
            ? "PUSHER ACTIVE"
            : pusherStale
            ? `PUSHER IDLE · ${timeAgo(m.pushedAt)}`
            : "PUSHER OFFLINE"}
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">{m.machineName}</p>
            <p className="text-[10px] text-muted-foreground">
              {m.machineCode}{m.machineType ? ` · ${m.machineType}` : ""}
            </p>
          </div>
          <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${st.bg} ${st.border} ${st.color}`}>
            <Icon className="w-3 h-3" />
            {st.label}
          </div>
        </div>

        {/* Live counts */}
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          <div className="bg-emerald-500/10 rounded-lg p-1.5 text-center">
            <p className="text-sm font-bold text-emerald-400">{m.passCount}</p>
            <p className="text-[9px] text-muted-foreground">PASS</p>
          </div>
          <div className="bg-red-500/10 rounded-lg p-1.5 text-center">
            <p className="text-sm font-bold text-red-400">{m.failCount}</p>
            <p className="text-[9px] text-muted-foreground">FAIL</p>
          </div>
        </div>

        {/* Current device & error */}
        {m.lotId && (
          <div className="flex items-center gap-1 mb-1">
            <Smartphone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-[10px] text-muted-foreground truncate">{m.lotId}</span>
          </div>
        )}
        {m.resultMsg && m.status === "fail" && (
          <div className="bg-red-500/10 border border-red-500/20 rounded px-2 py-1 mb-1">
            <p className="text-[10px] text-red-400 break-words leading-relaxed">{m.resultMsg}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 gap-1">
          <span className="text-[10px] text-muted-foreground">{timeAgo(m.pushedAt)}</span>
          {m.cycleTimeMs != null && (
            <span className="text-[10px] text-blue-400 flex-shrink-0">{fmtCycle(m.cycleTimeMs)}</span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {m.machineRegistryId && (
              <button
                onClick={() => setShowAnalysis(true)}
                className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5 font-semibold bg-primary/10 hover:bg-primary/20 border border-primary/20 px-1.5 py-0.5 rounded transition-colors"
              >
                <BarChart2 className="w-2.5 h-2.5" />
                Analysis
              </button>
            )}
            {m.machineRegistryId && (
              <button
                onClick={() => setShowHistory(true)}
                className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5 underline underline-offset-2"
              >
                <ChevronRight className="w-3 h-3" />
                history
              </button>
            )}
          </div>
        </div>
      </div>
    </div>

    {showHistory && <HistoryModal m={m} onClose={() => setShowHistory(false)} />}
    {showAnalysis && m.machineRegistryId && (
      <MachineAnalysisModal
        machineId={m.machineRegistryId}
        machineName={m.machineName}
        onClose={() => setShowAnalysis(false)}
      />
    )}
    </>
  );
}

/* ══════════════════════════════════
   PASS RATE BAR
   ══════════════════════════════════ */
function PassRateBar({ rate, total }: { rate: number | null; total: number }) {
  if (total === 0 || rate === null) return <span className="text-muted-foreground text-xs">No data</span>;
  const color = rate >= 95 ? "bg-emerald-500" : rate >= 80 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-white/10 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${rate}%` }} />
      </div>
      <span className={`text-xs font-bold ${rate >= 95 ? "text-emerald-400" : rate >= 80 ? "text-yellow-400" : "text-red-400"}`}>
        {rate}%
      </span>
    </div>
  );
}

/* ══════════════════════════════════
   STATION ROW
   ══════════════════════════════════ */
function StationRow({ station, lineId, onDismissTemp }: { station: StationGroup; lineId: number; onDismissTemp?: (id: number) => void }) {
  const [expanded, setExpanded] = useState(true);
  const { config } = useFactoryConfig();
  const failThreshold = config.downtimeFailThreshold ?? 3;
  const { stats, topErrors } = station;
  const hasErrors = topErrors.length > 0;
  const hasRepeatedError = topErrors.some(e => e.count >= failThreshold);
  const isTempStation = station.stationNumber === 9999;

  return (
    <div className={`bg-card border rounded-xl overflow-hidden ${
      isTempStation ? "border-amber-500/30" :
      station.hasAutoDowntime ? "border-red-500/40" :
      hasRepeatedError ? "border-orange-500/30" :
      "border-white/10"
    }`}>
      {/* Station header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isTempStation
            ? <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            : <Layers className="w-4 h-4 text-primary flex-shrink-0" />
          }
          <div className="min-w-0">
            <p className={`text-sm font-bold ${isTempStation ? "text-amber-400" : "text-white"}`}>{station.stationName}</p>
            <p className="text-xs text-muted-foreground">{station.machines.length} machine{station.machines.length !== 1 ? "s" : ""}{isTempStation ? " · visiting from another line" : ""}</p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="hidden sm:flex items-center gap-4">
          {/* Tests */}
          <div className="text-center">
            <p className="text-sm font-bold text-white">{stats.totalTests.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Tests</p>
          </div>
          {/* Pass */}
          <div className="text-center">
            <p className="text-sm font-bold text-emerald-400">{stats.passTests.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Pass</p>
          </div>
          {/* Fail */}
          <div className="text-center">
            <p className="text-sm font-bold text-red-400">{stats.failTests.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Fail</p>
          </div>
          {/* Devices */}
          {stats.totalDevices > 0 && (
            <div className="text-center">
              <p className="text-sm font-bold text-blue-400">{stats.totalDevices}</p>
              <p className="text-[10px] text-muted-foreground">Devices</p>
            </div>
          )}
          {/* Pass rate */}
          <div className="w-28">
            <PassRateBar rate={stats.passRate} total={stats.totalTests} />
          </div>
        </div>

        {/* Alerts */}
        <div className="flex items-center gap-1.5">
          {station.hasAutoDowntime && (
            <span className="bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              DOWNTIME
            </span>
          )}
          {hasRepeatedError && !station.hasAutoDowntime && (
            <span className="bg-orange-500/20 border border-orange-500/30 text-orange-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              REPEAT ERR
            </span>
          )}
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/10">
          {/* Station stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b border-white/10">
            <div className="p-3 text-center border-r border-white/10">
              <p className="text-lg font-bold text-white">{stats.totalTests.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Total Tests</p>
            </div>
            <div className="p-3 text-center border-r border-white/5">
              <p className="text-lg font-bold text-emerald-400">{stats.passTests.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Passed</p>
            </div>
            <div className="p-3 text-center border-r border-white/5">
              <p className="text-lg font-bold text-red-400">{stats.failTests.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Failed</p>
            </div>
            <div className="p-3 text-center">
              {stats.totalDevices > 0 ? (
                <>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-emerald-400 font-bold">{stats.devicesPass}</span>
                    <span className="text-muted-foreground text-xs">/</span>
                    <span className="text-red-400 font-bold">{stats.devicesFail}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Devices Pass/Fail</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-muted-foreground">—</p>
                  <p className="text-[10px] text-muted-foreground">No device data</p>
                </>
              )}
            </div>
          </div>

          {/* Content: machines + errors */}
          <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Machines */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {station.machines.map((m, i) => (
                <MachineCard key={m.machineRegistryId ?? `${m.machineName}-${i}`} m={m} onDismissTemp={onDismissTemp} />
              ))}
            </div>

            {/* Errors panel */}
            <div className="space-y-2">
              {stats.avgCycleMs != null && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-blue-400">Avg cycle: <strong>{fmtCycle(stats.avgCycleMs)}</strong></span>
                </div>
              )}
              {hasErrors ? (
                <div className="bg-card border border-white/10 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-xs font-semibold text-white">Error Summary</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {topErrors.map((err, i) => {
                      const isRepeated = err.count >= failThreshold;
                      return (
                        <div key={i} className={`px-3 py-2 ${isRepeated ? "bg-red-500/5" : ""}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-[11px] leading-relaxed break-words flex-1 ${isRepeated ? "text-red-400" : "text-muted-foreground"}`}>
                              {err.msg}
                            </p>
                            <span className={`text-xs font-bold flex-shrink-0 px-1.5 py-0.5 rounded-full ${
                              isRepeated ? "bg-red-500/20 text-red-400" : "bg-white/10 text-muted-foreground"
                            }`}>
                              ×{err.count}
                            </span>
                          </div>
                          {isRepeated && (
                            <p className="text-[10px] text-red-400/70 mt-0.5 flex items-center gap-1">
                              <Shield className="w-2.5 h-2.5" />
                              Repeated — auto-downtime triggered
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{timeAgo(err.lastSeen)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-400">No errors in last 24h</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════
   LINE PANEL
   ══════════════════════════════════ */
function LinePanel({ line, onDismissTemp }: { line: LineGroup; onDismissTemp?: (id: number) => void }) {
  const { stats } = line;
  const totalMachines = line.totalMachines;
  const liveMachines = line.liveMachines;
  const hasAutoDowntime = line.stations.some(s => s.hasAutoDowntime);

  return (
    <div className="space-y-4">
      {/* Line overview header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Machines</span>
          </div>
          <p className="text-2xl font-bold text-white">{liveMachines}<span className="text-sm text-muted-foreground">/{totalMachines}</span></p>
          <p className="text-[10px] text-muted-foreground">Live / Registered</p>
        </div>
        <div className="bg-card border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-muted-foreground">Tests (24h)</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalTests.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">{stats.passTests.toLocaleString()} pass · {stats.failTests.toLocaleString()} fail</p>
        </div>
        <div className="bg-card border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground">Pass Rate</span>
          </div>
          {stats.linePassRate != null ? (
            <>
              <p className={`text-2xl font-bold ${stats.linePassRate >= 95 ? "text-emerald-400" : stats.linePassRate >= 80 ? "text-yellow-400" : "text-red-400"}`}>
                {stats.linePassRate}%
              </p>
              <PassRateBar rate={stats.linePassRate} total={stats.totalTests} />
            </>
          ) : (
            <p className="text-2xl font-bold text-muted-foreground">—</p>
          )}
        </div>
        <div className={`border rounded-xl p-4 ${hasAutoDowntime ? "bg-red-500/10 border-red-500/30" : "bg-card border-white/10"}`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className={`w-4 h-4 ${hasAutoDowntime ? "text-red-400" : "text-muted-foreground"}`} />
            <span className="text-xs text-muted-foreground">Status</span>
          </div>
          <p className={`text-sm font-bold ${hasAutoDowntime ? "text-red-400" : "text-emerald-400"}`}>
            {hasAutoDowntime ? "DOWNTIME ACTIVE" : "RUNNING"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">{line.stations.length} station{line.stations.length !== 1 ? "s" : ""} active</p>
        </div>
      </div>

      {/* Stations */}
      <div className="space-y-3">
        {line.stations.map(station => (
          <StationRow key={station.stationNumber} station={station} lineId={line.lineId} onDismissTemp={onDismissTemp} />
        ))}
      </div>
    </div>
  );
}


/* ══════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════ */
export default function MachineMonitorPage() {
  const { user } = useAuth();
  const { config } = useFactoryConfig();
  const queryClient = useQueryClient();

  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const { data: lines = [], isLoading: linesLoading, dataUpdatedAt } = useQuery<LineGroup[]>({
    queryKey: ["machine-by-line"],
    queryFn: () => apiFetch("/machine-data/by-line"),
    refetchInterval: 10000,
  });

  const resetDataMut = useMutation({
    mutationFn: () => apiFetch("/machine-data/reset", { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machine-by-line"] });
      setConfirmReset(false);
    },
  });

  const dismissTempMut = useMutation({
    mutationFn: (assignmentId: number) =>
      apiFetch(`/machine-data/temp-assignment/${assignmentId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["machine-by-line"] }),
  });

  // Set default selected line
  useEffect(() => {
    if (lines.length > 0 && selectedLine === null) {
      setSelectedLine(lines[0].lineId);
    }
  }, [lines]);

  const activeLine = lines.find(l => l.lineId === selectedLine) ?? lines[0];

  // Summary stats
  const totalTests = lines.reduce((a, l) => a + l.stats.totalTests, 0);
  const totalPass = lines.reduce((a, l) => a + l.stats.passTests, 0);
  const totalFail = lines.reduce((a, l) => a + l.stats.failTests, 0);
  const overallRate = totalTests > 0 ? Math.round((totalPass / totalTests) * 100) : null;
  const activeLines = lines.length;
  const totalAutoDowntime = lines.reduce((a, l) => a + l.stations.filter(s => s.hasAutoDowntime).length, 0);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Machine Monitor
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Live production line tracking · {activeLines} active line{activeLines !== 1 ? "s" : ""}
            {dataUpdatedAt ? ` · Updated ${timeAgo(new Date(dataUpdatedAt).toISOString())}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["machine-by-line"] })}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          {(user?.role === "admin" || user?.role === "manager") && (
            confirmReset ? (
              <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-1.5">
                <span className="text-xs text-red-400 font-medium">Clear all data?</span>
                <button
                  onClick={() => resetDataMut.mutate()}
                  disabled={resetDataMut.isPending}
                  className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded font-medium transition-colors disabled:opacity-50"
                >
                  {resetDataMut.isPending ? "Clearing..." : "Yes, clear"}
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="text-xs text-muted-foreground hover:text-white transition-colors px-1"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm px-3 py-2 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Data
              </button>
            )
          )}
        </div>
      </div>

      {/* Overall summary bar */}
      {activeLines > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-card border border-white/10 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Active Lines</p>
                <p className="text-2xl font-bold text-white">{activeLines}</p>
              </div>
              <div className="bg-card border border-white/10 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Tests (24h)</p>
                <p className="text-2xl font-bold text-white">{totalTests.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{totalPass.toLocaleString()} pass · {totalFail.toLocaleString()} fail</p>
              </div>
              <div className="bg-card border border-white/10 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Overall Pass Rate</p>
                {overallRate != null ? (
                  <>
                    <p className={`text-2xl font-bold ${overallRate >= 95 ? "text-emerald-400" : overallRate >= 80 ? "text-yellow-400" : "text-red-400"}`}>
                      {overallRate}%
                    </p>
                    <PassRateBar rate={overallRate} total={totalTests} />
                  </>
                ) : (
                  <p className="text-2xl font-bold text-muted-foreground">—</p>
                )}
              </div>
              <div className={`border rounded-xl p-4 ${totalAutoDowntime > 0 ? "bg-red-500/10 border-red-500/30" : "bg-card border-white/10"}`}>
                <p className="text-xs text-muted-foreground mb-1">Auto-Downtime</p>
                <p className={`text-2xl font-bold ${totalAutoDowntime > 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {totalAutoDowntime > 0 ? `${totalAutoDowntime} active` : "None"}
                </p>
                <p className="text-[10px] text-muted-foreground">{config.downtimeFailThreshold ?? 3}× repeat errors</p>
              </div>
            </div>
          )}

          {/* Line tabs */}
          {linesLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />)}
            </div>
          ) : lines.length === 0 ? (
            <div className="bg-card border border-white/10 rounded-xl p-12 text-center">
              <Cpu className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-white font-semibold text-lg mb-2">No Machine Data Yet</p>
              <p className="text-muted-foreground text-sm">
                Configure the OMTP agent in Factory Settings, then start it on each factory PC to see live data here.
              </p>
            </div>
          ) : (
            <>
              {/* Line selector tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {lines.map(line => {
                  const isActive = line.lineId === selectedLine;
                  const hasDowntime = line.stations.some(s => s.hasAutoDowntime);
                  return (
                    <button
                      key={line.lineId}
                      onClick={() => setSelectedLine(line.lineId)}
                      className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? "bg-primary text-white shadow-lg"
                          : "bg-card border border-white/10 text-muted-foreground hover:text-white hover:border-white/25"
                      }`}
                    >
                      {hasDowntime && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                      {line.lineName}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isActive ? "bg-white/20" : "bg-white/10"
                      }`}>
                        {line.liveMachines}/{line.totalMachines}
                      </span>
                      {line.stats.linePassRate != null && (
                        <span className={`text-[10px] font-bold ${
                          line.stats.linePassRate >= 95 ? "text-emerald-400" :
                          line.stats.linePassRate >= 80 ? "text-yellow-400" : "text-red-400"
                        }`}>
                          {line.stats.linePassRate}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active line panel */}
              {activeLine && <LinePanel line={activeLine} onDismissTemp={(id) => dismissTempMut.mutate(id)} />}
            </>
          )}
      </div>
  );
}
