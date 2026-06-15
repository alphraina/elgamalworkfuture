import { useState, useEffect, useCallback } from "react";
import { useGetProductionRecords, useGetProductionLines, useGetUsers } from "@workspace/api-client-react";
import { Button, Input, Select, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Modal, Label } from "@/components/ui";
import { Activity, AlertTriangle, Settings, BarChart3, Grid3X3, User, Save, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const HOUR_TARGET = 200;
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type ShiftSetup = {
  id: number; date: string; shift: string;
  lineId: number; lineName: string | null;
  assignedUserId: number | null; assignedUserName: string | null;
  totalCapacityTarget: number | null;
  productModel: string | null;
};

type ReportRow = {
  lineId: number; lineName: string;
  totalPhones: number; hoursRecorded: number;
  totalDowntimeMinutes: number; downtimeIncidents: number;
};

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function Production() {
  const { t } = useTranslation();
  const { data: lines } = useGetProductionLines();
  const { data: records, refetch: refetchRecords } = useGetProductionRecords();
  const { data: allUsers } = useGetUsers();
  const { toast } = useToast();
  const { isTeamLeader, isManager, isAdmin } = useAuth();

  const canManage = isTeamLeader || isManager || isAdmin;

  const today = new Date().toISOString().split("T")[0];
  const [tab, setTab] = useState<"setup" | "grid" | "report">("grid");
  const [selDate, setSelDate] = useState(today);
  const [selShift, setSelShift] = useState<"day" | "night">("day");
  const [teamTab, setTeamTab] = useState<string>("all");

  const [shiftSetups, setShiftSetups] = useState<ShiftSetup[]>([]);
  const [setupDraft, setSetupDraft] = useState<Record<number, { assignedUserId: string; totalCapacityTarget: string; productModel: string }>>({});
  const [setupBusy, setSetupBusy] = useState(false);

  const [report, setReport] = useState<ReportRow[]>([]);
  const [reportLoaded, setReportLoaded] = useState(false);

  const [entryModal, setEntryModal] = useState<{ lineId: number; lineName: string; hour: number; existingId?: number; existingVal?: number } | null>(null);
  const [entryVal, setEntryVal] = useState<string>("");
  const [entryBusy, setEntryBusy] = useState(false);

  const [reasonModal, setReasonModal] = useState<{ recordId: number; lineName: string; hour: number } | null>(null);
  const [reasonVal, setReasonVal] = useState("");
  const [reasonBusy, setReasonBusy] = useState(false);

  const loadSetups = useCallback(async () => {
    try {
      const data = await apiFetch(`/production/shift-setups?date=${selDate}&shift=${selShift}`);
      setShiftSetups(data);
      const draft: typeof setupDraft = {};
      (lines ?? []).forEach(l => {
        const existing = data.find((s: ShiftSetup) => s.lineId === l.id);
        draft[l.id] = {
          assignedUserId: existing?.assignedUserId?.toString() ?? "",
          totalCapacityTarget: existing?.totalCapacityTarget?.toString() ?? "",
          productModel: existing?.productModel ?? "",
        };
      });
      setSetupDraft(draft);
    } catch (e) { /* silent */ }
  }, [selDate, selShift, lines]);

  const loadReport = useCallback(async () => {
    try {
      const data = await apiFetch(`/production/report?date=${selDate}&shift=${selShift}`);
      setReport((data as any[]).slice().sort((a, b) => a.lineId - b.lineId));
      setReportLoaded(true);
    } catch (e) { setReportLoaded(true); }
  }, [selDate, selShift]);

  useEffect(() => { loadSetups(); }, [loadSetups]);
  useEffect(() => { if (tab === "report") loadReport(); }, [tab, loadReport]);

  const saveSetup = async () => {
    setSetupBusy(true);
    try {
      await Promise.all(
        Object.entries(setupDraft).map(([lineId, vals]) =>
          apiFetch("/production/shift-setups", {
            method: "POST",
            body: JSON.stringify({
              date: selDate, shift: selShift,
              lineId: Number(lineId),
              assignedUserId: vals.assignedUserId ? Number(vals.assignedUserId) : null,
              totalCapacityTarget: vals.totalCapacityTarget ? Number(vals.totalCapacityTarget) : null,
              productModel: vals.productModel || null,
            }),
          })
        )
      );
      await loadSetups();
      toast({ title: t("common.success") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally { setSetupBusy(false); }
  };

  const getRecord = (lineId: number, hour: number) =>
    (records ?? []).find(r => r.lineId === lineId && r.hour === hour && r.date === selDate && r.shift === selShift);

  const openEntry = (lineId: number, lineName: string, hour: number) => {
    const rec = getRecord(lineId, hour);
    setEntryVal(rec?.actualCapacity?.toString() ?? "");
    setEntryModal({ lineId, lineName, hour, existingId: rec?.id, existingVal: rec?.actualCapacity });
  };

  const submitEntry = async () => {
    if (!entryModal || entryVal === "") return;
    setEntryBusy(true);
    try {
      await apiFetch("/production", {
        method: "POST",
        body: JSON.stringify({
          lineId: entryModal.lineId, hour: entryModal.hour,
          actualCapacity: Number(entryVal), shift: selShift, date: selDate,
        }),
      });
      await refetchRecords();
      const val = Number(entryVal);
      if (val < HOUR_TARGET) {
        toast({ title: t("production.belowTarget"), variant: "destructive" });
      } else {
        toast({ title: t("common.success") });
      }
      setEntryModal(null);
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally { setEntryBusy(false); }
  };

  const submitReason = async () => {
    if (!reasonModal || !reasonVal) return;
    setReasonBusy(true);
    try {
      await apiFetch(`/production/${reasonModal.recordId}/reason`, {
        method: "PUT",
        body: JSON.stringify({ reason: reasonVal }),
      });
      await refetchRecords();
      toast({ title: t("common.success") });
      setReasonModal(null);
      setReasonVal("");
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally { setReasonBusy(false); }
  };

  const allGridLines = (lines ?? []).slice().sort((a, b) => a.id - b.id);
  const gridLines = teamTab === "all"
    ? allGridLines
    : allGridLines.filter(l => (l.team ?? "") === teamTab);

  // Derive unique teams dynamically from actual line data
  const uniqueTeams = Array.from(new Set(
    allGridLines.map(l => l.team).filter((t): t is string => !!t)
  ));

  const TEAM_PALETTE = [
    { color: "text-blue-400",    border: "border-blue-400/60",    bg: "bg-blue-400/10",    active: "bg-blue-400/20 border-blue-400 text-blue-300" },
    { color: "text-amber-400",   border: "border-amber-400/60",   bg: "bg-amber-400/10",   active: "bg-amber-400/20 border-amber-400 text-amber-300" },
    { color: "text-emerald-400", border: "border-emerald-400/60", bg: "bg-emerald-400/10", active: "bg-emerald-400/20 border-emerald-400 text-emerald-300" },
    { color: "text-purple-400",  border: "border-purple-400/60",  bg: "bg-purple-400/10",  active: "bg-purple-400/20 border-purple-400 text-purple-300" },
    { color: "text-pink-400",    border: "border-pink-400/60",    bg: "bg-pink-400/10",    active: "bg-pink-400/20 border-pink-400 text-pink-300" },
    { color: "text-cyan-400",    border: "border-cyan-400/60",    bg: "bg-cyan-400/10",    active: "bg-cyan-400/20 border-cyan-400 text-cyan-300" },
    { color: "text-rose-400",    border: "border-rose-400/60",    bg: "bg-rose-400/10",    active: "bg-rose-400/20 border-rose-400 text-rose-300" },
    { color: "text-lime-400",    border: "border-lime-400/60",    bg: "bg-lime-400/10",    active: "bg-lime-400/20 border-lime-400 text-lime-300" },
  ];
  const teamStyle = (team: string) => {
    let hash = 0;
    for (let i = 0; i < team.length; i++) hash = team.charCodeAt(i) + ((hash << 5) - hash);
    return TEAM_PALETTE[Math.abs(hash) % TEAM_PALETTE.length];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" /> {t("production.title")}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">{t("production.subtitle")}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">{t("common.date")}</Label>
          <Input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} className="w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">{t("production.shift")}</Label>
          <Select value={selShift} onChange={e => setSelShift(e.target.value as any)} className="w-36">
            <option value="day">{t("attendance.shift_day")}</option>
            <option value="night">{t("attendance.shift_night")}</option>
          </Select>
        </div>
        {uniqueTeams.length > 0 && (
          <div className="flex items-center gap-1.5 ms-auto flex-wrap">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <button
              onClick={() => setTeamTab("all")}
              className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors border",
                teamTab === "all"
                  ? "bg-white/15 text-white border-white/20"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white border-transparent"
              )}
            >
              {t("common.all")}
            </button>
            {uniqueTeams.map(team => {
              const st = teamStyle(team);
              return (
                <button
                  key={team}
                  onClick={() => setTeamTab(teamTab === team ? "all" : team)}
                  className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors border",
                    teamTab === team ? st.active : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white border-transparent"
                  )}
                >
                  {team}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {canManage && (
          <button onClick={() => setTab("setup")} className={cn(
            "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5",
            tab === "setup" ? "border-primary text-white" : "border-transparent text-muted-foreground hover:text-white"
          )}>
            <Settings className="w-4 h-4" /> {t("production.setup")}
          </button>
        )}
        <button onClick={() => setTab("grid")} className={cn(
          "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5",
          tab === "grid" ? "border-primary text-white" : "border-transparent text-muted-foreground hover:text-white"
        )}>
          <Grid3X3 className="w-4 h-4" /> {t("production.grid")}
        </button>
        {canManage && (
          <button onClick={() => setTab("report")} className={cn(
            "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5",
            tab === "report" ? "border-primary text-white" : "border-transparent text-muted-foreground hover:text-white"
          )}>
            <BarChart3 className="w-4 h-4" /> {t("production.report")}
          </button>
        )}
      </div>

      {/* Setup Tab */}
      {tab === "setup" && canManage && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">{t("production.setup")}</p>
            <Button onClick={saveSetup} disabled={setupBusy} className="gap-2">
              <Save className="w-4 h-4" />{setupBusy ? t("common.loading") : t("common.save")}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {gridLines.map(line => (
              <div key={line.id} className="border border-white/10 rounded-lg p-3 space-y-2 bg-white/2">
                <p className="text-sm font-semibold text-white">{line.name}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("production.assignedTo")}</Label>
                    <Select
                      value={setupDraft[line.id]?.assignedUserId ?? ""}
                      onChange={e => setSetupDraft(d => ({ ...d, [line.id]: { ...d[line.id], assignedUserId: e.target.value } }))}
                    >
                      <option value="">—</option>
                      {(allUsers ?? []).map(u => (
                        <option key={u.id} value={u.id}>{u.fullName}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("production.target")}</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 2000"
                      value={setupDraft[line.id]?.totalCapacityTarget ?? ""}
                      onChange={e => setSetupDraft(d => ({ ...d, [line.id]: { ...d[line.id], totalCapacityTarget: e.target.value } }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    📱 {t("production.productModel")}
                  </Label>
                  <Input
                    placeholder="e.g. CPH2523"
                    value={setupDraft[line.id]?.productModel ?? ""}
                    onChange={e => setSetupDraft(d => ({ ...d, [line.id]: { ...d[line.id], productModel: e.target.value.toUpperCase() } }))}
                    className="font-mono uppercase"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Grid Tab */}
      {tab === "grid" && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm border-collapse" style={{ minWidth: `${gridLines.length * 62 + 64}px` }}>
            <thead>
              <tr className="bg-card/80">
                <th className="px-2 py-2 text-start text-xs font-semibold text-muted-foreground border-b border-white/10 w-14 sticky start-0 bg-card/80 z-10">
                  {t("production.hour")}
                </th>
                {gridLines.map(line => {
                  const setup = shiftSetups.find(s => s.lineId === line.id);
                  const lineTeam = line?.team ?? null;
                  return (
                    <th key={line.id} className="px-1 py-2 text-center text-xs font-semibold border-b border-white/10 min-w-[60px]">
                      <p className="text-white text-[11px]">{line.name}</p>
                      {teamTab === "all" && lineTeam && (
                        <p className={cn("text-[8px] font-bold uppercase tracking-wider mt-0.5", teamStyle(lineTeam).color)}>
                          {lineTeam}
                        </p>
                      )}
                      {setup?.assignedUserName && (
                        <p className="text-[9px] text-primary mt-0.5 truncate max-w-[58px] mx-auto">
                          {setup.assignedUserName.split(" ")[0]}
                        </p>
                      )}
                      {setup?.productModel && (
                        <p className="text-[8px] font-mono font-bold text-amber-400 mt-0.5 truncate max-w-[58px] mx-auto">
                          {setup.productModel}
                        </p>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour, i) => (
                <tr key={hour} className={i % 2 === 0 ? "bg-white/[0.01]" : ""}>
                  <td className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-white/5 sticky start-0 bg-card/50 z-10 whitespace-nowrap">
                    H{hour}
                  </td>
                  {gridLines.map(line => {
                    const rec = getRecord(line.id, hour);
                    const val = rec?.actualCapacity;
                    const isBelow = val !== undefined && val < HOUR_TARGET;
                    const isGood = val !== undefined && val >= HOUR_TARGET;
                    return (
                      <td
                        key={line.id}
                        className={cn(
                          "px-1 py-1.5 text-center border-b border-white/5 relative group",
                          canManage && "cursor-pointer hover:brightness-125",
                          isBelow && "bg-red-500/10",
                          isGood && "bg-emerald-500/10",
                          !val && "bg-white/[0.02]"
                        )}
                        onClick={() => canManage && openEntry(line.id, line.name, hour)}
                      >
                        {val !== undefined ? (
                          <div className="space-y-0.5">
                            <p className={cn("font-mono font-bold text-sm", isBelow ? "text-red-400" : "text-emerald-400")}>
                              {val}
                            </p>
                            {isBelow && (
                              <div className="flex items-center justify-center gap-0.5">
                                {rec?.reason ? (
                                  <span className="text-[9px] text-amber-400 truncate max-w-[70px]" title={rec.reason}>✓</span>
                                ) : (
                                  <button
                                    className="text-[9px] text-red-400 hover:text-red-300 underline"
                                    onClick={e => {
                                      e.stopPropagation();
                                      setReasonModal({ recordId: rec!.id, lineName: line.name, hour });
                                      setReasonVal("");
                                    }}
                                  >
                                    +
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        )}
                        {canManage && (
                          <span className="absolute inset-0 border border-transparent group-hover:border-primary/30 rounded pointer-events-none transition-all" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-primary/5 border-t border-primary/20">
                <td className="px-3 py-2.5 text-xs font-bold text-white sticky start-0 bg-primary/5 z-10">{t("common.total")}</td>
                {gridLines.map(line => {
                  const total = HOURS.reduce((sum, hour) => {
                    const rec = getRecord(line.id, hour);
                    return sum + (rec?.actualCapacity ?? 0);
                  }, 0);
                  const setup = shiftSetups.find(s => s.lineId === line.id);
                  const target = setup?.totalCapacityTarget ?? (HOUR_TARGET * 10);
                  return (
                    <td key={line.id} className="px-2 py-2.5 text-center">
                      <p className={cn("font-mono font-bold text-sm", total < target ? "text-red-400" : "text-emerald-400")}>{total}</p>
                      <p className="text-[10px] text-muted-foreground">/{target}</p>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Report Tab */}
      {tab === "report" && canManage && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{selDate} — {selShift}</p>
            <Button variant="outline" size="sm" onClick={loadReport}>{t("common.refresh")}</Button>
          </div>
          {/* Per-team summary cards — dynamic from actual line zones */}
          {reportLoaded && report.length > 0 && uniqueTeams.length > 0 && (
            <div className={cn("grid gap-4", uniqueTeams.length === 1 ? "grid-cols-1" : uniqueTeams.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
              {uniqueTeams.map(team => {
                const teamLineIds = allGridLines.filter(l => l.team === team).map(l => l.id);
                const teamRows = report.filter(r => teamLineIds.includes(r.lineId));
                const total = teamRows.reduce((s, r) => s + r.totalPhones, 0);
                const maxPossible = HOUR_TARGET * 10 * teamLineIds.length;
                const pct = maxPossible > 0 ? Math.min(Math.round((total / maxPossible) * 100), 100) : 0;
                const st = teamStyle(team);
                return (
                  <div key={team} className={cn("rounded-xl border p-4 space-y-2", st.border, st.bg)}>
                    <p className={cn("text-xs font-bold uppercase tracking-wider", st.color)}>{team}</p>
                    <p className="text-2xl font-mono font-bold text-white">{total.toLocaleString()}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", pct >= 80 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400")} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.line")}</TableHead>
                  <TableHead>{t("teams.label")}</TableHead>
                  <TableHead className="text-end">{t("production.totalPhones")}</TableHead>
                  <TableHead className="text-end">{t("production.hoursRecorded")}</TableHead>
                  <TableHead className="text-end">{t("production.downtime")}</TableHead>
                  <TableHead className="text-end">{t("production.incidents")}</TableHead>
                  <TableHead>{t("kpi.performance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!reportLoaded ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
                ) : report.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
                ) : (
                  (() => {
                    const filteredReport = teamTab === "all"
                      ? report
                      : report.filter(r => {
                          const line = allGridLines.find(l => l.id === r.lineId);
                          return line?.team === teamTab;
                        });
                    return filteredReport.map(row => {
                      const line = allGridLines.find(l => l.id === row.lineId);
                      const lineTeam = line?.team ?? null;
                      const maxPossible = HOUR_TARGET * 10;
                      const pct = Math.round((row.totalPhones / maxPossible) * 100);
                      return (
                        <TableRow key={row.lineId}>
                          <TableCell className="font-semibold text-white">{row.lineName}</TableCell>
                          <TableCell>
                            {lineTeam ? (
                              <span className={cn("text-xs font-bold", teamStyle(lineTeam).color)}>{lineTeam}</span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-end font-mono font-bold text-lg text-white">{row.totalPhones.toLocaleString()}</TableCell>
                          <TableCell className="text-end text-muted-foreground">{row.hoursRecorded}</TableCell>
                          <TableCell className="text-end">
                            <span className={row.totalDowntimeMinutes > 0 ? "text-red-400 font-semibold" : "text-muted-foreground"}>
                              {row.totalDowntimeMinutes}
                            </span>
                          </TableCell>
                          <TableCell className="text-end text-muted-foreground">{row.downtimeIncidents}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden max-w-[80px]">
                                <div
                                  className={cn("h-full rounded-full transition-all", pct >= 80 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400")}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{pct}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()
                )}
                {reportLoaded && report.length > 0 && (() => {
                  const filteredReport = teamTab === "all"
                    ? report
                    : report.filter(r => {
                        const line = allGridLines.find(l => l.id === r.lineId);
                        return line?.team === teamTab;
                      });
                  return filteredReport.length > 0 ? (
                    <TableRow className="border-t-2 border-primary/20 bg-primary/5">
                      <TableCell className="font-bold text-white">{t("common.total")}</TableCell>
                      <TableCell />
                      <TableCell className="text-end font-mono font-bold text-white">
                        {filteredReport.reduce((s, r) => s + r.totalPhones, 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-end text-muted-foreground">—</TableCell>
                      <TableCell className="text-end font-semibold text-red-400">
                        {filteredReport.reduce((s, r) => s + r.totalDowntimeMinutes, 0)}
                      </TableCell>
                      <TableCell className="text-end text-muted-foreground">
                        {filteredReport.reduce((s, r) => s + r.downtimeIncidents, 0)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ) : null;
                })()}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* Entry Modal */}
      {entryModal && (
        <Modal isOpen onClose={() => setEntryModal(null)} title={`${entryModal.lineName} — ${t("production.hour")} ${entryModal.hour}`}>
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground">
              {t("production.target")}: <span className="text-white font-semibold">{HOUR_TARGET}</span>
            </div>
            <div className="space-y-2">
              <Label>{t("production.totalPhones")}</Label>
              <Input
                type="number"
                min={0}
                value={entryVal}
                onChange={e => setEntryVal(e.target.value)}
                className={cn(
                  "text-2xl font-bold font-mono h-14 text-center",
                  entryVal !== "" && Number(entryVal) < HOUR_TARGET ? "border-red-500/50 text-red-400" : "text-emerald-400"
                )}
                placeholder="0"
                autoFocus
              />
              {entryVal !== "" && Number(entryVal) < HOUR_TARGET && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t("production.belowTarget")}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <Button variant="outline" onClick={() => setEntryModal(null)}>{t("common.cancel")}</Button>
              <Button onClick={submitEntry} disabled={entryBusy || entryVal === ""}>
                {entryBusy ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reason Modal */}
      {reasonModal && (
        <Modal isOpen onClose={() => { setReasonModal(null); setReasonVal(""); }} title={`${reasonModal.lineName} — ${t("production.hour")} ${reasonModal.hour}`}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("production.belowTarget")}</p>
            <div className="space-y-2">
              <Label>{t("downtime.rootCause")}</Label>
              <Input
                value={reasonVal}
                onChange={e => setReasonVal(e.target.value)}
                placeholder="e.g. Machine breakdown, material shortage..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <Button variant="outline" onClick={() => { setReasonModal(null); setReasonVal(""); }}>{t("common.cancel")}</Button>
              <Button onClick={submitReason} disabled={reasonBusy || !reasonVal}>
                {reasonBusy ? t("common.loading") : t("common.submit")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
