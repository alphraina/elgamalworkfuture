import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, Badge, Modal } from "@/components/ui";
import { AlertTriangle, CheckCircle, Clock, Activity, Package, Wrench, Megaphone, Plus, Trash2, X, Info, Pencil } from "lucide-react";
import { useGetDowntimeRecords, useGetTasks, useGetInventory, useGetBrokenMachines } from "@workspace/api-client-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatTimeOnly } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Priority = "info" | "warning" | "urgent";

interface Announcement {
  id: number;
  title: string;
  message: string;
  priority: Priority;
  isActive: boolean;
  expiresAt: string | null;
  createdById: number;
  createdAt: string;
}

const canManage = (role?: string) =>
  ["admin", "manager", "teamleader"].includes(role ?? "");

const EMPTY_FORM = { title: "", message: "", priority: "info" as Priority, expiresAt: "" };

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const PRIORITY_STYLES: Record<Priority, { border: string; bg: string; icon: string; badge: string; label: string }> = {
    info: {
      border: "border-blue-500/60",
      bg: "bg-blue-500/10",
      icon: "text-blue-400",
      badge: "bg-blue-500/20 text-blue-300 border-blue-500/40",
      label: t("dashboard.info"),
    },
    warning: {
      border: "border-amber-500/60",
      bg: "bg-amber-500/10",
      icon: "text-amber-400",
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      label: t("dashboard.warning"),
    },
    urgent: {
      border: "border-red-500/60",
      bg: "bg-red-500/10",
      icon: "text-red-400",
      badge: "bg-red-500/20 text-red-300 border-red-500/40",
      label: t("dashboard.urgent"),
    },
  };

  const { data: downtime } = useGetDowntimeRecords({ query: { enabled: !!user } });
  const { data: tasks } = useGetTasks({ query: { enabled: !!user } });
  const { data: inventory } = useGetInventory({ query: { enabled: !!user } });
  const { data: brokenMachines } = useGetBrokenMachines({ query: { enabled: !!user } });

  const activeDowntimes = downtime?.filter(d => d.status === 'ongoing').length || 0;
  const pendingTasks = tasks?.filter(t => t.status === 'pending' || t.status === 'in_progress').length || 0;
  const lowStockItems = inventory?.filter(i => i.quantity <= i.minQuantity).length || 0;
  const criticalMachines = brokenMachines?.filter(b => b.status !== 'closed' && b.status !== 'resolved' && b.severity === 'critical').length || 0;

  const today = new Date().toISOString().split("T")[0];
  const _h = new Date().getHours();
  // Night shift: 23:00–23:59 or 00:00–06:59
  const currentShift: "day" | "night" = (_h >= 23 || _h < 7) ? "night" : "day";
  // Night shift after midnight → record against previous day's date
  const shiftDate = (currentShift === "night" && _h < 7)
    ? new Date(Date.now() - 86_400_000).toISOString().split("T")[0]
    : today;

  type LiveSetup = { lineId: number; lineName: string | null; totalCapacityTarget: number | null; assignedUserTeam: string | null };
  type LiveRecord = { lineId: number; hour: number; actualCapacity: number };
  type LiveLine = { id: number; name: string; team: string | null };

  const [liveSetups, setLiveSetups] = useState<LiveSetup[]>([]);
  const [liveRecords, setLiveRecords] = useState<LiveRecord[]>([]);
  const [liveLines, setLiveLines] = useState<LiveLine[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);

  const fetchLiveProduction = async () => {
    try {
      const [setupsRes, recordsRes, linesRes] = await Promise.all([
        fetch(`${BASE}/api/production/shift-setups?date=${today}&shift=${currentShift}`, { credentials: "include" }),
        fetch(`${BASE}/api/production?date=${today}&shift=${currentShift}`, { credentials: "include" }),
        fetch(`${BASE}/api/production/lines`, { credentials: "include" }),
      ]);
      if (setupsRes.ok) {
        const all: LiveSetup[] = await setupsRes.json();
        const withTarget = all.filter(s => s.totalCapacityTarget != null);
        setLiveSetups(withTarget);
        setSelectedLineId(prev => {
          if (prev && withTarget.find(s => s.lineId === prev)) return prev;
          return withTarget[0]?.lineId ?? null;
        });
      }
      if (recordsRes.ok) {
        setLiveRecords(await recordsRes.json());
      }
      if (linesRes.ok) {
        setLiveLines(await linesRes.json());
      }
    } catch {}
  };

  useEffect(() => {
    if (user) {
      fetchLiveProduction();
      const interval = setInterval(fetchLiveProduction, 60_000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const selectedSetup = liveSetups.find(s => s.lineId === selectedLineId);
  const hourTarget = selectedSetup?.totalCapacityTarget ? Math.round(selectedSetup.totalCapacityTarget / 10) : null;
  const liveChartData = HOURS.map(h => {
    const rec = liveRecords.find(r => r.lineId === selectedLineId && r.hour === h);
    return { hour: `H${h}`, actual: rec?.actualCapacity ?? null, target: hourTarget };
  });

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Announcement | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const fetchAnnouncements = async () => {
    try {
      const r = await fetch(`${BASE}/api/announcements`, { credentials: "include" });
      if (r.ok) setAnnouncements(await r.json());
    } catch {}
  };

  useEffect(() => { if (user) fetchAnnouncements(); }, [user]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormErr("");
    setShowForm(true);
  };

  const openEdit = (a: Announcement) => {
    setEditTarget(a);
    setForm({
      title: a.title,
      message: a.message,
      priority: a.priority,
      expiresAt: a.expiresAt ? a.expiresAt.slice(0, 10) : "",
    });
    setFormErr("");
    setShowForm(true);
  };

  const saveForm = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      setFormErr(t("common.required"));
      return;
    }
    setSaving(true);
    setFormErr("");
    try {
      const body = {
        title: form.title.trim(),
        message: form.message.trim(),
        priority: form.priority,
        expiresAt: form.expiresAt || null,
      };
      const url = editTarget
        ? `${BASE}/api/announcements/${editTarget.id}`
        : `${BASE}/api/announcements`;
      const r = await fetch(url, {
        method: editTarget ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      setShowForm(false);
      fetchAnnouncements();
    } catch {
      setFormErr(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const deleteAnnouncement = async (id: number) => {
    if (!confirm(t("common.confirm") + "?")) return;
    await fetch(`${BASE}/api/announcements/${id}`, { method: "DELETE", credentials: "include" });
    fetchAnnouncements();
  };

  const toggleActive = async (a: Announcement) => {
    await fetch(`${BASE}/api/announcements/${a.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ isActive: !a.isActive }),
    });
    fetchAnnouncements();
  };

  const visible = announcements.filter(a => !dismissed.includes(a.id));

  return (
    <div className="space-y-6">
      {/* Active announcement banners */}
      {visible.length > 0 && (
        <div className="space-y-3">
          {visible.map(a => {
            const s = PRIORITY_STYLES[a.priority];
            return (
              <div
                key={a.id}
                className={`flex items-start gap-3 p-4 rounded-xl border ${s.border} ${s.bg} ${a.priority === "urgent" ? "animate-pulse-border" : ""}`}
              >
                <Megaphone className={`w-5 h-5 mt-0.5 shrink-0 ${s.icon}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-white text-sm">{a.title}</span>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-bold ${s.badge}`}>
                      {s.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{a.message}</p>
                </div>
                <button
                  onClick={() => setDismissed(p => [...p, a.id])}
                  className="shrink-0 text-muted-foreground hover:text-white transition-colors mt-0.5"
                  title={t("dashboard.dismiss")}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-display font-bold text-white tracking-tight">{t("dashboard.title")}</h2>
          <p className="text-muted-foreground mt-1">{t("dashboard.welcome", { name: user?.fullName })}</p>
        </div>
        {canManage(user?.role) && (
          <button
            onClick={() => setShowManage(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
          >
            <Megaphone className="w-4 h-4" />
            {t("dashboard.manageAnnouncements")}
            {announcements.length > 0 && (
              <span className="ms-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {announcements.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-s-4 border-s-destructive tech-border">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">{t("dashboard.activeDowntime")}</p>
              <h3 className="text-3xl font-mono font-bold text-white">{activeDowntimes}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center text-destructive">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-s-4 border-s-warning tech-border">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">{t("dashboard.lowStock")}</p>
              <h3 className="text-3xl font-mono font-bold text-white">{lowStockItems}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-warning/20 flex items-center justify-center text-warning">
              <Package className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-s-4 border-s-primary tech-border">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">{t("dashboard.pendingTasks")}</p>
              <h3 className="text-3xl font-mono font-bold text-white">{pendingTasks}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-s-4 border-s-destructive tech-border">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">{t("dashboard.criticalMachines")}</p>
              <h3 className="text-3xl font-mono font-bold text-white">{criticalMachines}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center text-destructive">
              <Wrench className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Teams Production Overview */}
      {liveSetups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(["assembly", "test"] as const).map(team => {
            const teamLabel = team === "assembly" ? t("teams.assembly") : t("teams.test");
            const teamColor = team === "assembly"
              ? { border: "border-blue-400/40", bg: "bg-blue-400/5", icon: "text-blue-400", bar: "bg-blue-400", badge: "bg-blue-400/15 text-blue-300 border-blue-400/30" }
              : { border: "border-amber-400/40", bg: "bg-amber-400/5", icon: "text-amber-400", bar: "bg-amber-400", badge: "bg-amber-400/15 text-amber-300 border-amber-400/30" };
            const teamSetups = liveSetups.filter(s => s.assignedUserTeam === team);
            const teamLineIds = teamSetups.map(s => s.lineId);
            const teamTarget = teamSetups.reduce((s, setup) => s + (setup.totalCapacityTarget ?? 0), 0);
            const teamActual = liveRecords.filter(r => teamLineIds.includes(r.lineId)).reduce((s, r) => s + (r.actualCapacity ?? 0), 0);
            const pct = teamTarget > 0 ? Math.min(Math.round((teamActual / teamTarget) * 100), 100) : 0;
            const activeLinesCount = teamSetups.length;
            return (
              <Card key={team} className={`border ${teamColor.border} ${teamColor.bg}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Activity className={`w-4 h-4 ${teamColor.icon}`} />
                      <span className="font-semibold text-white">{teamLabel}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${teamColor.badge}`}>
                        {activeLinesCount} {t("common.lines")}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">{currentShift}</span>
                  </div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-3xl font-mono font-bold text-white">{teamActual.toLocaleString()}</span>
                    {teamTarget > 0 && (
                      <span className="text-sm text-muted-foreground mb-1">/ {teamTarget.toLocaleString()}</span>
                    )}
                  </div>
                  {teamTarget > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-white shrink-0">{pct}%</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">{t("production.setup")} targets to see progress</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                {t("dashboard.liveProduction")}
                <span className="text-xs text-muted-foreground font-normal capitalize ms-1">({currentShift})</span>
              </CardTitle>
              <div className="flex items-center gap-1 flex-wrap">
                {liveSetups.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">{t("production.noEntries")}</span>
                ) : (
                  liveSetups.map(s => (
                    <button
                      key={s.lineId}
                      onClick={() => setSelectedLineId(s.lineId)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        selectedLineId === s.lineId
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {s.lineName ?? `Line ${s.lineId}`}
                    </button>
                  ))
                )}
              </div>
            </div>
            {selectedSetup && (
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>{t("production.target")}: <span className="text-white font-semibold">{selectedSetup.totalCapacityTarget?.toLocaleString()}</span></span>
                <span>{t("production.hour")} target: <span className="text-white font-semibold">{hourTarget}</span></span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {liveSetups.length === 0 ? (
              <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Activity className="w-10 h-10 opacity-20" />
                <p className="text-sm">{t("production.setup")} {t("production.shift").toLowerCase()} targets to see live data</p>
              </div>
            ) : (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={liveChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 16% 18%)" vertical={false} />
                    <XAxis dataKey="hour" stroke="hsl(215 20% 65%)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(215 20% 65%)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(222 16% 9%)', borderColor: 'hsl(222 16% 18%)', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="actual" name={t("production.totalPhones")} stroke="hsl(217 91% 60%)" strokeWidth={3} fillOpacity={1} fill="url(#colorActual)" connectNulls={false} />
                    <Area type="step" dataKey="target" name={t("production.target")} stroke="hsl(142 71% 45%)" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {liveSetups.length > 0 && selectedSetup && (() => {
              const total = liveRecords.filter(r => r.lineId === selectedLineId).reduce((s, r) => s + (r.actualCapacity ?? 0), 0);
              const target = selectedSetup.totalCapacityTarget ?? 0;
              const pct = target > 0 ? Math.min(Math.round((total / target) * 100), 100) : 0;
              return (
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    <span className="text-white font-semibold font-mono">{total.toLocaleString()}</span>
                    <span className="mx-1">/</span>
                    {target.toLocaleString()} ({pct}%)
                  </span>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Active Issues */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {t("dashboard.activeIssues")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="space-y-0">
              {downtime?.filter(d => d.status === 'ongoing').slice(0, 5).map(record => (
                <div key={record.id} className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                  <div>
                    <p className="font-semibold text-white">{record.machineName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{t("common.line")} {record.lineId} • {formatTimeOnly(record.startTime)}</p>
                  </div>
                  <Badge variant="destructive" className="uppercase text-[10px] tracking-wider">{record.category}</Badge>
                </div>
              ))}
              {activeDowntimes === 0 && (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                  <CheckCircle className="w-8 h-8 mb-2 text-success opacity-50" />
                  <p>{t("dashboard.noIssues")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manage Announcements Modal */}
      <Modal isOpen={showManage} onClose={() => setShowManage(false)} title={t("dashboard.manageAnnouncements")}>
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("dashboard.newAnnouncement")}
            </button>
          </div>

          {announcements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>{t("dashboard.noAnnouncements")}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pe-1">
              {announcements.map(a => {
                const s = PRIORITY_STYLES[a.priority];
                return (
                  <div key={a.id} className={`flex items-start gap-3 p-4 rounded-xl border ${s.border} ${a.isActive ? s.bg : "bg-white/5 opacity-60"}`}>
                    <Megaphone className={`w-4 h-4 mt-1 shrink-0 ${s.icon}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-white text-sm">{a.title}</span>
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-bold ${s.badge}`}>
                          {s.label}
                        </span>
                        {!a.isActive && (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/20 text-muted-foreground font-bold">
                            {t("dashboard.hidden")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{a.message}</p>
                      {a.expiresAt && (
                        <p className="text-[10px] text-muted-foreground mt-1">{t("dashboard.announcementExpiry")} {new Date(a.expiresAt).toLocaleDateString()}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleActive(a)}
                        title={a.isActive ? t("dashboard.hidden") : t("dashboard.show")}
                        className="p-1.5 rounded text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                      >
                        {a.isActive ? <X className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => openEdit(a)}
                        title={t("common.edit")}
                        className="p-1.5 rounded text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteAnnouncement(a.id)}
                        title={t("common.delete")}
                        className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Create / Edit Announcement Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editTarget ? t("dashboard.editAnnouncement") : t("dashboard.newAnnouncement")}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-1.5">{t("dashboard.announcementTitle")} *</label>
            <input
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder={t("dashboard.announcementPlaceholderTitle")}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-1.5">{t("dashboard.announcementMessage")} *</label>
            <textarea
              value={form.message}
              onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              placeholder={t("dashboard.announcementPlaceholderMsg")}
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-1.5">{t("dashboard.announcementPriority")}</label>
              <select
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: e.target.value as Priority }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
              >
                <option value="info">{t("dashboard.info")}</option>
                <option value="warning">{t("dashboard.warning")}</option>
                <option value="urgent">{t("dashboard.urgent")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-1.5">{t("dashboard.announcementExpires")}</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          {/* Priority preview */}
          {form.title && (
            <div className={`p-3 rounded-lg border ${PRIORITY_STYLES[form.priority].border} ${PRIORITY_STYLES[form.priority].bg} flex items-start gap-2`}>
              <Info className={`w-4 h-4 mt-0.5 shrink-0 ${PRIORITY_STYLES[form.priority].icon}`} />
              <div>
                <p className="text-sm font-semibold text-white">{form.title}</p>
                {form.message && <p className="text-xs text-muted-foreground mt-0.5">{form.message}</p>}
              </div>
            </div>
          )}

          {formErr && <p className="text-xs text-red-400">{formErr}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-muted-foreground hover:bg-white/5 transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={saveForm}
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? t("common.loading") : editTarget ? t("common.saveChanges") : t("dashboard.postAnnouncement")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
