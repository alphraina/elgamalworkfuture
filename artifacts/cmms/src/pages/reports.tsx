import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadialBarChart, RadialBar,
} from "recharts";
import {
  AlertTriangle, Clock, TrendingDown, Zap, ChevronDown, Activity,
  Wrench, BarChart3, Timer, RefreshCw, Target, CircleDot,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const apiFetch = async (path: string) => {
  const r = await fetch(`${BASE}/api${path}`, { credentials: "include" });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

interface AnalyticsData {
  days: number;
  summary: {
    totalIncidents: number;
    totalDowntimeHours: number;
    avgMttrHours: number;
    openIncidents: number;
  };
  mttrByMachine: { machine: string; code: string; incidents: number; avgMttrHours: number; totalDowntimeHours: number }[];
  mtbfByMachine: { machine: string; avgMtbfHours: number; gapCount: number }[];
  downtimeByCategory: { category: string; incidents: number; totalHours: number }[];
  downtimeTrend: { day: string; incidents: number; totalHours: number }[];
  bottlenecks: { machine: string; code: string; incidents: number; totalDowntimeHours: number; avgMttrHours: number | null; openIncidents: number }[];
  oeeByLine: { lineId: number; lineName: string; downtimeMinutes: number; availability: number; performance: number | null; oee: number | null; totalActual: number; totalTarget: number }[];
  downtimeByLine: { line: string; incidents: number; totalHours: number }[];
  brokenMachines: { total: number; open: number; resolved: number; avgRepairHours: number | null };
}

const CATEGORY_COLORS: Record<string, string> = {
  mechanical: "#ef4444",
  electrical: "#f59e0b",
  software:   "#3b82f6",
  material:   "#8b5cf6",
  other:      "#6b7280",
};

const CATEGORY_LABELS: Record<string, string> = {
  mechanical: "Mechanical",
  electrical: "Electrical",
  software:   "Software",
  material:   "Material",
  other:      "Other",
};

const LINE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

function fmt(h: number, unit = "h"): string {
  if (unit === "h") {
    if (h < 1) return `${Math.round(h * 60)}m`;
    return `${h.toFixed(1)}h`;
  }
  return String(h);
}

function MetricCard({ icon: Icon, title, value, sub, color = "text-primary" }: {
  icon: React.ElementType; title: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-white/10 p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${color === "text-primary" ? "bg-primary/15" : "bg-white/5"}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-xs text-white/80 font-medium">{title}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function OEEGauge({ value, label }: { value: number | null; label: string }) {
  const pct = value ?? 0;
  const color = pct >= 85 ? "#10b981" : pct >= 65 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
          <circle
            cx="40" cy="40" r="32" fill="none"
            stroke={value !== null ? color : "rgba(255,255,255,0.1)"}
            strokeWidth="8"
            strokeDasharray={`${2 * Math.PI * 32}`}
            strokeDashoffset={`${2 * Math.PI * 32 * (1 - pct / 100)}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-white">
            {value !== null ? `${pct}%` : "—"}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center max-w-[5rem] truncate" title={label}>{label}</p>
    </div>
  );
}

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(222 47% 11%)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#fff",
};

export default function Reports() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<AnalyticsData>({
    queryKey: ["analytics", days],
    queryFn: () => apiFetch(`/analytics?days=${days}`),
    enabled: !!user,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const periodOptions = [
    { label: "7 days",   value: 7 },
    { label: "30 days",  value: 30 },
    { label: "90 days",  value: 90 },
    { label: "180 days", value: 180 },
    { label: "1 year",   value: 365 },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-3">
        <Activity className="w-5 h-5 animate-pulse" />
        <span>Building analytics…</span>
      </div>
    );
  }

  const d = data;
  if (isError || (!d?.summary && !isLoading)) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
      <AlertTriangle className="w-8 h-8 text-yellow-400" />
      <p className="text-sm">Could not load analytics. The query may have failed.</p>
      <button
        onClick={() => refetch()}
        disabled={isFetching}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm hover:bg-primary/20 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
        {isFetching ? "Loading…" : "Retry"}
      </button>
    </div>
  );

  const { summary, downtimeTrend, downtimeByCategory, bottlenecks, mttrByMachine, mtbfByMachine, oeeByLine, downtimeByLine, brokenMachines } = d;

  const avgOee = oeeByLine.filter(l => l.oee !== null).length > 0
    ? oeeByLine.filter(l => l.oee !== null).reduce((acc, l) => acc + (l.oee ?? 0), 0) / oeeByLine.filter(l => l.oee !== null).length
    : null;

  const avgMtbf = mtbfByMachine.length > 0
    ? mtbfByMachine.reduce((acc, m) => acc + m.avgMtbfHours, 0) / mtbfByMachine.length
    : null;

  const pieData = downtimeByCategory.map(c => ({
    name: CATEGORY_LABELS[c.category] ?? c.category,
    value: c.totalHours,
    fill: CATEGORY_COLORS[c.category] ?? "#6b7280",
  }));

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Reporting & Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">MTTR · MTBF · OEE · Downtime Analysis · Bottlenecks</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="appearance-none bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm text-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              {periodOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg border border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard icon={AlertTriangle}  title="Total Incidents"    value={String(summary.totalIncidents)}          sub={`${summary.openIncidents} still open`}            color="text-red-400" />
        <MetricCard icon={TrendingDown}   title="Total Downtime"     value={fmt(summary.totalDowntimeHours)}          sub={`over ${days} days`}                              color="text-orange-400" />
        <MetricCard icon={Timer}          title="Avg MTTR"           value={fmt(summary.avgMttrHours)}                sub="mean time to repair"                              color="text-yellow-400" />
        <MetricCard icon={Clock}          title="Avg MTBF"           value={avgMtbf !== null ? fmt(avgMtbf) : "—"}   sub="mean time between failures"                       color="text-blue-400" />
      </div>

      {/* OEE + Broken machines row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* OEE gauges */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-white/10 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              OEE by Production Line
            </h3>
            {avgOee !== null && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                avgOee >= 85 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : avgOee >= 65 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>
                Avg {avgOee.toFixed(1)}%
              </span>
            )}
          </div>
          {oeeByLine.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No production line data for this period.</p>
          ) : (
            <div className="space-y-3">
              {oeeByLine.map((line, i) => (
                <div key={line.lineId} className="flex items-center gap-3">
                  <div className="w-28 flex-shrink-0">
                    <p className="text-xs text-white font-medium truncate" title={line.lineName}>{line.lineName}</p>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="w-20">Availability</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${line.availability}%` }} />
                      </div>
                      <span className="w-10 text-right">{line.availability}%</span>
                    </div>
                    {line.performance !== null && (
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="w-20">Performance</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, line.performance)}%` }} />
                        </div>
                        <span className="w-10 text-right">{line.performance}%</span>
                      </div>
                    )}
                    {(line as any).quality !== null && (line as any).quality !== undefined && (
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="w-20">Quality</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-purple-500" style={{ width: `${Math.min(100, (line as any).quality)}%` }} />
                        </div>
                        <span className="w-10 text-right">{(line as any).quality}%</span>
                      </div>
                    )}
                    {line.oee !== null && (
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="w-20 font-semibold text-white">OEE</span>
                        <div className="flex-1 h-2 rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full ${line.oee >= 85 ? "bg-emerald-400" : line.oee >= 65 ? "bg-yellow-400" : "bg-red-400"}`}
                            style={{ width: `${line.oee}%` }}
                          />
                        </div>
                        <span className={`w-10 text-right font-semibold ${line.oee >= 85 ? "text-emerald-400" : line.oee >= 65 ? "text-yellow-400" : "text-red-400"}`}>
                          {line.oee}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground/50 pt-1 border-t border-white/5">
                OEE = Availability × Performance × Quality. World-class target: ≥ 85%
              </p>
            </div>
          )}
        </div>

        {/* Broken machines card */}
        <div className="bg-card rounded-xl border border-white/10 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Wrench className="w-4 h-4 text-rose-400" />
            Broken Machines
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Reported",  value: brokenMachines.total,    color: "text-white" },
              { label: "Open",      value: brokenMachines.open,     color: "text-red-400" },
              { label: "Resolved",  value: brokenMachines.resolved, color: "text-emerald-400" },
              { label: "Avg Repair",value: brokenMachines.avgRepairHours != null ? fmt(brokenMachines.avgRepairHours) : "—", color: "text-yellow-400" },
            ].map(item => (
              <div key={item.label} className="bg-white/5 rounded-lg p-3 text-center">
                <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Downtime trend */}
      <div className="bg-card rounded-xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-orange-400" />
          Downtime Trend — last {days} days
        </h3>
        {downtimeTrend.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No downtime records in this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={downtimeTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dtGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => `${v}h`} />
              <Tooltip contentStyle={TOOLTIP_STYLE}
                formatter={(v: number) => [`${v}h`, "Downtime"]}
                labelFormatter={l => `Date: ${l}`} />
              <Area type="monotone" dataKey="totalHours" stroke="#ef4444" strokeWidth={2}
                fill="url(#dtGrad)" dot={false} name="Downtime (h)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Category + Line downtime */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By Category */}
        <div className="bg-card rounded-xl border border-white/10 p-4">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <CircleDot className="w-4 h-4 text-muted-foreground" />
            Downtime by Category
          </h3>
          {pieData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No data.</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={62}
                    dataKey="value" stroke="none">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number) => [`${v}h`, ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {pieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.fill }} />
                      <span className="text-xs text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="text-xs text-white font-medium">{item.value}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* By Line */}
        <div className="bg-card rounded-xl border border-white/10 p-4">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            Downtime by Production Line
          </h3>
          {downtimeByLine.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={downtimeByLine} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#666", fontSize: 10 }} tickLine={false}
                  tickFormatter={v => `${v}h`} />
                <YAxis type="category" dataKey="line" tick={{ fill: "#999", fontSize: 10 }} tickLine={false}
                  width={80} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [`${v}h`, "Downtime"]} />
                <Bar dataKey="totalHours" radius={[0, 4, 4, 0]}>
                  {downtimeByLine.map((_, i) => (
                    <Cell key={i} fill={LINE_COLORS[i % LINE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottleneck machines */}
      <div className="bg-card rounded-xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          Top Bottleneck Machines
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Machines causing the most total downtime in this period</p>
        {bottlenecks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No downtime records in this period.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bottlenecks.slice(0, 8)} margin={{ top: 0, right: 8, left: -16, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="machine" tick={{ fill: "#999", fontSize: 10 }} tickLine={false}
                  angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: "#666", fontSize: 10 }} tickLine={false}
                  tickFormatter={v => `${v}h`} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number, name: string) => [
                    name === "totalDowntimeHours" ? `${v}h` : String(v),
                    name === "totalDowntimeHours" ? "Downtime" : "Incidents",
                  ]} />
                <Bar dataKey="totalDowntimeHours" fill="#ef4444" radius={[4, 4, 0, 0]} name="totalDowntimeHours" />
              </BarChart>
            </ResponsiveContainer>
            {/* Bottleneck table */}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-white/10">
                    <th className="text-start py-2 px-2 font-medium">Machine</th>
                    <th className="text-end py-2 px-2 font-medium">Incidents</th>
                    <th className="text-end py-2 px-2 font-medium">Total DT</th>
                    <th className="text-end py-2 px-2 font-medium">Avg MTTR</th>
                    <th className="text-end py-2 px-2 font-medium">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {bottlenecks.map((m, i) => (
                    <tr key={i} className="hover:bg-white/2">
                      <td className="py-2 px-2 text-white font-medium">
                        {m.machine}
                        {m.code && <span className="text-muted-foreground ml-1">({m.code})</span>}
                      </td>
                      <td className="py-2 px-2 text-end text-muted-foreground">{m.incidents}</td>
                      <td className="py-2 px-2 text-end text-red-400 font-medium">{fmt(m.totalDowntimeHours)}</td>
                      <td className="py-2 px-2 text-end text-yellow-400">{m.avgMttrHours != null ? fmt(m.avgMttrHours) : "—"}</td>
                      <td className="py-2 px-2 text-end">
                        {m.openIncidents > 0
                          ? <span className="text-red-400 font-bold">{m.openIncidents}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* MTTR + MTBF by machine */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* MTTR */}
        <div className="bg-card rounded-xl border border-white/10 p-4">
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <Timer className="w-4 h-4 text-yellow-400" />
            MTTR by Machine
          </h3>
          <p className="text-[10px] text-muted-foreground mb-3">Mean Time To Repair — lower is better</p>
          {mttrByMachine.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No resolved incidents in this period.</p>
          ) : (
            <div className="space-y-2">
              {mttrByMachine.slice(0, 8).map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground w-28 truncate flex-shrink-0" title={m.machine}>{m.machine}</p>
                  <div className="flex-1 h-5 bg-white/5 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-yellow-500/70 rounded-md flex items-center px-2"
                      style={{ width: `${Math.min(100, (m.avgMttrHours / (mttrByMachine[0]?.avgMttrHours || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-yellow-400 font-medium w-10 text-end flex-shrink-0">{fmt(m.avgMttrHours)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MTBF */}
        <div className="bg-card rounded-xl border border-white/10 p-4">
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            MTBF by Machine
          </h3>
          <p className="text-[10px] text-muted-foreground mb-3">Mean Time Between Failures — higher is better</p>
          {mtbfByMachine.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Need ≥ 2 incidents per machine to compute MTBF.</p>
          ) : (
            <div className="space-y-2">
              {mtbfByMachine.slice(0, 8).map((m, i) => {
                const maxMtbf = mtbfByMachine[mtbfByMachine.length - 1]?.avgMtbfHours || 1;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground w-28 truncate flex-shrink-0" title={m.machine}>{m.machine}</p>
                    <div className="flex-1 h-5 bg-white/5 rounded-md overflow-hidden">
                      <div
                        className="h-full bg-blue-500/70 rounded-md"
                        style={{ width: `${Math.min(100, (m.avgMtbfHours / maxMtbf) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-blue-400 font-medium w-10 text-end flex-shrink-0">{fmt(m.avgMtbfHours)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Glossary */}
      <div className="bg-white/3 border border-white/10 rounded-xl p-4">
        <p className="text-xs font-semibold text-white mb-3">Metric Definitions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { term: "MTTR", full: "Mean Time To Repair", def: "Average time from failure start to resolution. Lower = faster repairs." },
            { term: "MTBF", full: "Mean Time Between Failures", def: "Average time between consecutive failures on the same machine. Higher = more reliable." },
            { term: "OEE", full: "Overall Equipment Effectiveness", def: "Availability × Performance × Quality. World-class benchmark: ≥ 85%. Quality requires defect records." },
            { term: "Bottleneck", full: "Constraint Machine", def: "The machine that limits your line's throughput most — highest cumulative downtime hours." },
          ].map(item => (
            <div key={item.term} className="bg-white/5 rounded-lg p-3">
              <p className="text-xs font-bold text-primary">{item.term}</p>
              <p className="text-[10px] text-white/70 font-medium">{item.full}</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{item.def}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
