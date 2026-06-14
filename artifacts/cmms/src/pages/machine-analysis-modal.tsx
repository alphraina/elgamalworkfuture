import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X, RefreshCw, Activity, BarChart2, Server, AlertTriangle, Cpu,
  ShieldAlert, Filter, Calendar, GitBranch, TrendingUp, Layers,
} from "lucide-react";
import {
  LineChart, Line, BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart,
} from "recharts";
import { calculateKPIs, ParsedData } from "@/lib/analysis-processor";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const apiFetch = (path: string) =>
  fetch(`${BASE}/api${path}`, { credentials: "include" }).then(async (r) => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.statusText);
    return r.json();
  });

// ── Hardcoded palette (CSS vars don't resolve inside SVG fill/stroke) ──
const C = {
  green:   "#22c55e",
  red:     "#ef4444",
  blue:    "#3b82f6",
  violet:  "#8b5cf6",
  amber:   "#f59e0b",
  orange:  "#f97316",
  cyan:    "#06b6d4",
  grid:    "#1e2940",
  axis:    "#64748b",
  card:    "#111827",
  tooltip: "#131c2e",
  border:  "#1e2940",
  text:    "#dde4f0",
};

const CHART_COLORS = [C.blue, C.red, C.amber, C.green, C.violet, C.cyan, C.orange];

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: C.tooltip, borderColor: C.border, fontSize: 12 },
  itemStyle: { color: C.text },
  labelStyle: { color: C.axis },
};

const HOUR_OPTIONS = [
  { label: "Last 24h", value: 24 },
  { label: "Last 7d", value: 168 },
  { label: "Last 30d", value: 720 },
];

interface Props {
  machineId: number;
  machineName: string;
  onClose: () => void;
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="bg-card/80 border border-white/10 rounded-xl p-4" style={{ borderLeftWidth: 4, borderLeftColor: accent }}>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-white font-mono">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold flex items-center gap-2 border-b border-white/10 pb-2 uppercase tracking-widest" style={{ color: C.blue }}>
        <Icon className="w-4 h-4" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function Card({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card/80 border border-white/10 rounded-xl overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-white/10">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function PassBadge({ result, attempt }: { result: "PASS" | "FAIL" | null; attempt?: number }) {
  if (!result) return <span className="text-white/20 text-[10px]">—</span>;
  const isPass = result === "PASS";
  const bg = isPass ? (attempt === 1 ? "rgba(34,197,94,0.25)" : "rgba(59,130,246,0.25)") : "rgba(239,68,68,0.25)";
  const color = isPass ? (attempt === 1 ? C.green : C.blue) : C.red;
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono" style={{ backgroundColor: bg, color }}>
      {isPass ? (attempt === 1 ? "✓" : `✓${attempt}`) : "✗"}
    </span>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">{msg}</div>;
}

export default function MachineAnalysisModal({ machineId, machineName, onClose }: Props) {
  const [hours, setHours] = useState(168);

  const { data: raw, isLoading, error, refetch } = useQuery({
    queryKey: ["machine-analysis", machineId, hours],
    queryFn: () => apiFetch(`/machine-data/analysis/${machineId}?hours=${hours}`),
    staleTime: 30_000,
  });

  const analysis: ParsedData | null = raw?.rows?.length ? calculateKPIs(raw.rows) : null;
  const noData = !isLoading && !error && raw && raw.rows.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-white/10 flex-shrink-0" style={{ backgroundColor: "#080e1a" }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5" style={{ color: C.blue }} />
            <span className="font-bold text-white text-sm uppercase tracking-wider">OPPO Manufacturing System</span>
            <span className="text-muted-foreground text-xs ml-2">— {machineName}</span>
          </div>
          {raw && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {raw.rows.length.toLocaleString()} records · since {new Date(raw.since).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg p-1">
          {HOUR_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setHours(opt.value)}
              className="px-3 py-1 rounded text-xs font-medium transition-all"
              style={hours === opt.value ? { backgroundColor: C.blue, color: "#fff" } : { color: C.axis }}>
              {opt.label}
            </button>
          ))}
        </div>

        <button onClick={() => refetch()} className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-10">

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-muted-foreground">
              <RefreshCw className="w-10 h-10 animate-spin" style={{ color: C.blue }} />
              <p className="text-sm">Loading analysis data...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: C.red }}>
              <AlertTriangle className="w-8 h-8" />
              <p className="text-sm">{String(error)}</p>
              <button onClick={() => refetch()} className="text-xs underline" style={{ color: C.blue }}>Retry</button>
            </div>
          )}

          {noData && (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-muted-foreground">
              <Activity className="w-10 h-10" />
              <p className="text-sm">No data available for the selected time range.</p>
              <p className="text-xs">Try a wider range or wait for the machine to push data.</p>
            </div>
          )}

          {analysis && (
            <>
              {/* ── KPI Cards ── */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard label="First Pass Yield" value={`${analysis.fpy.toFixed(1)}%`} sub="Pass on 1st attempt" accent={C.blue} />
                <KpiCard label="Pass Rate" value={`${analysis.passRate.toFixed(1)}%`} sub={`${analysis.passCount.toLocaleString()} passed`} accent={C.green} />
                <KpiCard label="Total NG" value={analysis.totalNG.toLocaleString()} sub="Never passed" accent={C.red} />
                <KpiCard label="Retest Rate" value={`${analysis.retestRate.toFixed(1)}%`} sub={`${analysis.productionFlow.filter(f => f.attempts > 1).length} units retested`} accent={C.orange} />
                <KpiCard label="Avg Cycle Time" value={`${analysis.avgCycleTime.toFixed(1)}s`} sub="Per test" accent={C.cyan} />
                <KpiCard label="Total Records" value={analysis.totalTested.toLocaleString()} sub={`${analysis.uniquePhones.toLocaleString()} unique LOTs`} accent={C.violet} />
              </div>

              {/* ── Overview: Donut Charts + Trend ── */}
              <Section title="Overview" icon={Activity}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  <Card title="Pass vs Fail Tests">
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={[{ name: "Pass", value: analysis.passCount }, { name: "Fail", value: analysis.failCount }]}
                            cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                            <Cell fill={C.green} />
                            <Cell fill={C.red} />
                          </Pie>
                          <Tooltip {...TOOLTIP_STYLE} />
                          <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: C.axis }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card title="Phones: Pass vs NG">
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={[{ name: "Passed Phones", value: analysis.uniquePhones - analysis.totalNG }, { name: "NG Phones", value: analysis.totalNG }]}
                            cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                            <Cell fill={C.green} />
                            <Cell fill={C.red} />
                          </Pie>
                          <Tooltip {...TOOLTIP_STYLE} />
                          <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: C.axis }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card title="Pass by Attempt">
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "1st", value: analysis.passByAttempt.first },
                              { name: "2nd", value: analysis.passByAttempt.second },
                              { name: "3rd", value: analysis.passByAttempt.third },
                              { name: "4th+", value: analysis.passByAttempt.fourth + analysis.passByAttempt.fifthPlus },
                              { name: "NG", value: analysis.totalNG },
                            ].filter((d) => d.value > 0)}
                            cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value"
                          >
                            {[C.green, C.blue, C.amber, C.orange, C.red].map((color, i) => (
                              <Cell key={i} fill={color} />
                            ))}
                          </Pie>
                          <Tooltip {...TOOLTIP_STYLE} />
                          <Legend iconSize={10} wrapperStyle={{ fontSize: 10, color: C.axis }} layout="vertical" verticalAlign="middle" align="right" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>

                {analysis.passTrend.length > 0 && (
                  <Card title="Daily Test Volume Trend" sub="Pass vs Fail over time (bucketed by push date)">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analysis.passTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                          <XAxis dataKey="date" stroke={C.axis} fontSize={11} tickLine={false} tick={{ fill: C.axis }} />
                          <YAxis stroke={C.axis} fontSize={11} tickLine={false} axisLine={false} tick={{ fill: C.axis }} />
                          <Tooltip {...TOOLTIP_STYLE} />
                          <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: C.axis }} />
                          <Line type="monotone" dataKey="pass" name="Pass" stroke={C.green} strokeWidth={2} dot={{ r: 3, fill: C.green }} />
                          <Line type="monotone" dataKey="fail" name="Fail" stroke={C.red} strokeWidth={2} dot={{ r: 3, fill: C.red }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}
              </Section>

              {/* ── TOP ERROR MESSAGES ── */}
              <Section title="Top Error Messages" icon={AlertTriangle}>
                {analysis.errorDistribution.length === 0 ? (
                  <Card title="Error Frequency" sub="No failures recorded">
                    <EmptyState msg="No error data — all tests passed." />
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card title="Error Frequency" sub="Top 10 failure reasons — horizontal">
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <RBarChart data={analysis.errorDistribution.slice(0, 10)} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
                            <XAxis type="number" stroke={C.axis} fontSize={10} tick={{ fill: C.axis }} />
                            <YAxis type="category" dataKey="name" stroke={C.axis} fontSize={9} width={130} tick={{ fill: C.axis }} />
                            <Tooltip {...TOOLTIP_STYLE} />
                            <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]}>
                              {analysis.errorDistribution.slice(0, 10).map((_, i) => (
                                <Cell key={i} fill={i < 3 ? C.red : C.orange} />
                              ))}
                            </Bar>
                          </RBarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card title="Error Detail Table" sub={`${analysis.failCount.toLocaleString()} total failures`}>
                      <div className="overflow-y-auto max-h-72">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-card">
                            <tr className="border-b border-white/10">
                              <th className="text-left py-2 px-2 text-muted-foreground font-medium w-8">#</th>
                              <th className="text-left py-2 px-2 text-muted-foreground font-medium">Error</th>
                              <th className="text-right py-2 px-2 text-muted-foreground font-medium">Count</th>
                              <th className="text-right py-2 px-2 text-muted-foreground font-medium">%</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {analysis.errorDistribution.map((err, idx) => (
                              <tr key={err.name} className={idx < 3 ? "bg-red-500/5" : ""}>
                                <td className="py-1.5 px-2 font-mono font-bold" style={{ color: idx < 3 ? C.red : C.axis }}>#{idx + 1}</td>
                                <td className="py-1.5 px-2 break-words max-w-xs" style={{ color: idx < 3 ? C.text : C.axis }}>{err.name || <em>Unknown</em>}</td>
                                <td className="py-1.5 px-2 text-right font-mono text-white">{err.count.toLocaleString()}</td>
                                <td className="py-1.5 px-2 text-right font-mono font-bold" style={{ color: idx < 3 ? C.red : C.axis }}>{err.percentage.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </div>
                )}
              </Section>

              {/* ── MACHINE PERFORMANCE DASHBOARD ── */}
              {analysis.machinePerformance.length > 0 && (
                <Section title="Machine Performance Dashboard" icon={Server}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card title="Pass Rate by Station" sub="Green ≥ 90% · Red < 90%">
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <RBarChart data={analysis.machinePerformance.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                            <XAxis dataKey="device" stroke={C.axis} fontSize={10} angle={-35} textAnchor="end" height={55} tick={{ fill: C.axis }} />
                            <YAxis stroke={C.axis} fontSize={11} domain={[0, 100]} tick={{ fill: C.axis }} />
                            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`${Number(v).toFixed(1)}%`, "Pass Rate"]} />
                            <Bar dataKey="passRate" radius={[4, 4, 0, 0]}>
                              {analysis.machinePerformance.slice(0, 10).map((m, i) => (
                                <Cell key={i} fill={m.passRate < 90 ? C.red : C.green} />
                              ))}
                            </Bar>
                          </RBarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card title="Output Volume by Station" sub="Pass (green) vs Fail (red) stacked">
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <RBarChart data={analysis.machinePerformance.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                            <XAxis dataKey="device" stroke={C.axis} fontSize={10} angle={-35} textAnchor="end" height={55} tick={{ fill: C.axis }} />
                            <YAxis stroke={C.axis} fontSize={11} tick={{ fill: C.axis }} />
                            <Tooltip {...TOOLTIP_STYLE} />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: C.axis }} />
                            <Bar dataKey="passCount" name="Pass" fill={C.green} radius={[4, 4, 0, 0]} stackId="a" />
                            <Bar dataKey="failCount" name="Fail" fill={C.red} radius={[4, 4, 0, 0]} stackId="a" />
                          </RBarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </div>

                  <Card title="Performance Leaderboard">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            {["#", "Machine", "Score", "Pass Rate", "Tests", "Pass", "Fail", "Avg Cycle", "Escapes", "Top Error"].map((h) => (
                              <th key={h} className="text-left py-2 px-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {analysis.machinePerformance.map((m, idx) => {
                            const isWorst = m.passRate < 85 || m.escapeRate > 10;
                            return (
                              <tr key={m.device} className={isWorst ? "bg-red-500/5" : ""}>
                                <td className="py-2 px-2 font-mono font-bold text-muted-foreground">#{idx + 1}</td>
                                <td className="py-2 px-2 font-medium text-white whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    {m.device}
                                    {isWorst && <AlertTriangle className="w-3 h-3" style={{ color: C.red }} />}
                                  </div>
                                </td>
                                <td className="py-2 px-2">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: isWorst ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)", color: isWorst ? C.red : C.green }}>
                                    {m.performanceScore.toFixed(1)}
                                  </span>
                                </td>
                                <td className="py-2 px-2 font-mono" style={{ color: m.passRate < 90 ? C.red : C.green }}>{m.passRate.toFixed(2)}%</td>
                                <td className="py-2 px-2 font-mono text-white">{m.totalTests.toLocaleString()}</td>
                                <td className="py-2 px-2 font-mono" style={{ color: C.green }}>{m.passCount.toLocaleString()}</td>
                                <td className="py-2 px-2 font-mono" style={{ color: C.red }}>{m.failCount.toLocaleString()}</td>
                                <td className="py-2 px-2 font-mono" style={{ color: C.blue }}>{m.avgCycleTime.toFixed(1)}s</td>
                                <td className="py-2 px-2 font-mono" style={{ color: m.escapeCount > 0 ? C.orange : C.axis }}>{m.escapeCount}</td>
                                <td className="py-2 px-2 text-muted-foreground max-w-[160px] truncate" title={m.topError}>{m.topError || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </Section>
              )}

              {/* ── PREDICTIVE MAINTENANCE & OEE ── */}
              {analysis.machinePerformance.length > 0 && (
                <Section title="Predictive Maintenance & OEE" icon={ShieldAlert}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card title="Predictive Failure Risk" sub="Based on cycle time, error frequency, fail rates">
                      <div className="overflow-y-auto max-h-64">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-card">
                            <tr className="border-b border-white/10">
                              <th className="text-left py-2 px-2 text-muted-foreground font-medium">Machine</th>
                              <th className="text-left py-2 px-2 text-muted-foreground font-medium">Risk</th>
                              <th className="text-right py-2 px-2 text-muted-foreground font-medium">Score</th>
                              <th className="text-right py-2 px-2 text-muted-foreground font-medium w-24">Bar</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {[...analysis.machinePerformance]
                              .sort((a, b) => b.predictiveRiskScore - a.predictiveRiskScore)
                              .map((m) => {
                                const pct = Math.round(m.predictiveRiskScore * 100);
                                const isHigh = m.predictiveStatus === "High Risk";
                                const isMed = m.predictiveStatus === "Medium Risk";
                                const barColor = isHigh ? C.red : isMed ? C.orange : C.green;
                                return (
                                  <tr key={`pred-${m.device}`} style={{ backgroundColor: isHigh ? "rgba(239,68,68,0.08)" : isMed ? "rgba(249,115,22,0.08)" : "" }}>
                                    <td className="py-2 px-2 font-mono text-white">{m.device}</td>
                                    <td className="py-2 px-2">
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${barColor}33`, color: barColor }}>
                                        {m.predictiveStatus}
                                      </span>
                                    </td>
                                    <td className="py-2 px-2 text-right font-mono font-bold" style={{ color: barColor }}>{pct}</td>
                                    <td className="py-2 px-2">
                                      <div className="bg-white/10 rounded-full h-1.5 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    <Card title="OEE Breakdown" sub="Availability · Performance · Quality">
                      <div className="overflow-y-auto max-h-64">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-card">
                            <tr className="border-b border-white/10">
                              <th className="text-left py-2 px-2 text-muted-foreground font-medium">Machine</th>
                              <th className="text-right py-2 px-2 text-muted-foreground font-medium">Avail.</th>
                              <th className="text-right py-2 px-2 text-muted-foreground font-medium">Perf.</th>
                              <th className="text-right py-2 px-2 text-muted-foreground font-medium">Quality</th>
                              <th className="text-right py-2 px-2 text-muted-foreground font-medium">OEE</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {analysis.machinePerformance.map((m) => {
                              const oeeLow = m.oee.overall < 65;
                              return (
                                <tr key={`oee-${m.device}`} style={{ backgroundColor: oeeLow ? "rgba(239,68,68,0.05)" : "" }}>
                                  <td className="py-2 px-2 font-mono text-white">{m.device}</td>
                                  <td className="py-2 px-2 text-right font-mono" style={{ color: C.blue }}>{m.oee.availability.toFixed(1)}%</td>
                                  <td className="py-2 px-2 text-right font-mono" style={{ color: C.violet }}>{m.oee.performance.toFixed(1)}%</td>
                                  <td className="py-2 px-2 text-right font-mono" style={{ color: C.green }}>{m.oee.quality.toFixed(1)}%</td>
                                  <td className="py-2 px-2 text-right font-mono font-bold" style={{ color: oeeLow ? C.red : C.blue }}>{m.oee.overall.toFixed(1)}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </div>
                </Section>
              )}

              {/* ── PRODUCTION FLOW MAPPING ── */}
              <Section title="Production Flow Mapping" icon={GitBranch}>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[
                    { label: "Retest Rate", val: `${analysis.retestRate.toFixed(1)}%`, sub: `${analysis.productionFlow.filter(f => f.attempts > 1).length} units retested`, color: C.orange },
                    { label: "NG Rate", val: `${analysis.uniquePhones > 0 ? ((analysis.totalNG / analysis.uniquePhones) * 100).toFixed(1) : "0.0"}%`, sub: `${analysis.totalNG} permanently failed`, color: C.red },
                    { label: "First Pass Yield", val: `${analysis.fpy.toFixed(1)}%`, sub: `${analysis.passByAttempt.first} passed 1st attempt`, color: C.green },
                  ].map(({ label, val, sub, color }) => (
                    <div key={label} className="bg-card/80 border border-white/10 rounded-xl p-4 text-center">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
                      <p className="text-3xl font-bold font-mono" style={{ color }}>{val}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
                    </div>
                  ))}
                </div>

                <Card title="LOT Journey Matrix" sub="✓ = 1st pass (green) · ✓2,✓3 = retry pass (blue) · ✗ = fail (red) · — = not tested at this station">
                  {analysis.flowMatrix.rows.length === 0 ? (
                    <EmptyState msg="No LOT data available." />
                  ) : (
                    <div className="overflow-auto max-h-[500px]">
                      <table className="text-xs border-collapse min-w-full">
                        <thead className="sticky top-0 z-10" style={{ backgroundColor: "#080e1a" }}>
                          <tr>
                            <th className="text-left py-2 px-3 text-muted-foreground font-medium border-b border-white/10 whitespace-nowrap">LOT ID</th>
                            <th className="text-center py-2 px-2 text-muted-foreground font-medium border-b border-white/10">Tries</th>
                            <th className="text-center py-2 px-2 text-muted-foreground font-medium border-b border-white/10">Result</th>
                            {analysis.flowMatrix.deviceList.map((dev) => (
                              <th key={dev} className="text-center py-2 px-3 text-muted-foreground font-medium border-b border-white/10 whitespace-nowrap">{dev}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {analysis.flowMatrix.rows.slice(0, 200).map((row) => (
                            <tr key={row.lotId}
                              style={{ backgroundColor: row.finalResult === "FAIL" ? "rgba(239,68,68,0.05)" : row.attempts > 1 ? "rgba(59,130,246,0.05)" : "" }}>
                              <td className="py-1.5 px-3 font-mono text-[10px] whitespace-nowrap" style={{ color: C.blue }}>{row.lotId.slice(-16)}</td>
                              <td className="py-1.5 px-2 text-center">
                                {row.attempts > 1
                                  ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "rgba(249,115,22,0.2)", color: C.orange }}>×{row.attempts}</span>
                                  : <span className="text-muted-foreground text-[10px]">1</span>}
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                                  style={{ backgroundColor: row.finalResult === "PASS" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)", color: row.finalResult === "PASS" ? C.green : C.red }}>
                                  {row.finalResult}
                                </span>
                              </td>
                              {analysis.flowMatrix.deviceList.map((dev) => (
                                <td key={dev} className="py-1.5 px-2 text-center">
                                  <PassBadge result={row.cells[dev]?.result ?? null} attempt={row.cells[dev]?.attempt} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {analysis.flowMatrix.rows.length > 200 && (
                        <p className="text-[10px] text-center py-2" style={{ color: C.axis }}>
                          Showing 200 of {analysis.flowMatrix.rows.length} LOTs
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              </Section>

              {/* ── ADVANCED ANALYTICS ── */}
              <Section title="Advanced Analytics" icon={TrendingUp}>

                {/* Machine horizontal pass-rate bars */}
                {analysis.machinePerformance.length > 0 && (
                  <Card title="Machine Pass Rate Comparison" sub="Horizontal view — sorted worst to best">
                    <div className="space-y-2">
                      {[...analysis.machinePerformance].sort((a, b) => a.passRate - b.passRate).map((m) => (
                        <div key={`hbar-${m.device}`} className="flex items-center gap-3">
                          <span className="text-[10px] font-mono w-24 text-right truncate" style={{ color: C.axis }} title={m.device}>{m.device}</span>
                          <div className="flex-1 rounded-full h-4 overflow-hidden relative" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                            <div className="h-full rounded-full" style={{ width: `${m.passRate}%`, backgroundColor: m.passRate >= 90 ? C.green : C.red }} />
                            <span className="absolute inset-0 flex items-center justify-end pr-2 text-[9px] font-mono font-bold text-white">
                              {m.passRate.toFixed(1)}%
                            </span>
                          </div>
                          <span className="text-[10px] font-mono w-16 text-right" style={{ color: C.axis }}>{m.totalTests.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Cycle Time Distribution */}
                {analysis.cycleTimeDistribution.length > 0 && (
                  <Card title="Cycle Time Distribution" sub="Tests per 5-second bucket">
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <RBarChart data={analysis.cycleTimeDistribution}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                          <XAxis dataKey="bucket" stroke={C.axis} fontSize={9} angle={-35} textAnchor="end" height={45} tick={{ fill: C.axis }} />
                          <YAxis stroke={C.axis} fontSize={11} tick={{ fill: C.axis }} />
                          <Tooltip {...TOOLTIP_STYLE} />
                          <Bar dataKey="count" name="Tests" radius={[4, 4, 0, 0]}>
                            {analysis.cycleTimeDistribution.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </RBarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}

                {/* Retest Stats + Shift Analysis */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card title="Retest Statistics" sub="How many attempts units needed before pass or NG">
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-2xl font-bold font-mono text-white">{analysis.totalTested.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">Total Tests</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold font-mono" style={{ color: C.orange }}>{analysis.productionFlow.filter(f => f.attempts > 1).length.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">Retested</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold font-mono" style={{ color: C.red }}>{analysis.retestRate.toFixed(1)}%</p>
                          <p className="text-[10px] text-muted-foreground">Retest Rate</p>
                        </div>
                      </div>
                      <div className="h-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <RBarChart data={[
                            { label: "1st", count: analysis.passByAttempt.first },
                            { label: "2nd", count: analysis.passByAttempt.second },
                            { label: "3rd", count: analysis.passByAttempt.third },
                            { label: "4th", count: analysis.passByAttempt.fourth },
                            { label: "5th+", count: analysis.passByAttempt.fifthPlus },
                            { label: "NG", count: analysis.totalNG },
                          ]}>
                            <XAxis dataKey="label" stroke={C.axis} fontSize={10} tick={{ fill: C.axis }} />
                            <YAxis stroke={C.axis} fontSize={10} tick={{ fill: C.axis }} />
                            <Tooltip {...TOOLTIP_STYLE} />
                            <Bar dataKey="count" name="Units" radius={[4, 4, 0, 0]}>
                              {[C.green, C.blue, C.amber, C.orange, C.violet, C.red].map((color, i) => (
                                <Cell key={i} fill={color} />
                              ))}
                            </Bar>
                          </RBarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </Card>

                  <Card title="Shift Analysis" sub="Production breakdown by work shift">
                    {analysis.shiftAnalysis.length === 0 ? (
                      <EmptyState msg="No shift data available." />
                    ) : (
                      <div className="space-y-4">
                        {analysis.shiftAnalysis.map((s) => (
                          <div key={s.shift} className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-white">{s.label}</span>
                              <div className="flex gap-3 text-[10px] font-mono">
                                <span style={{ color: C.green }}>{s.passCount.toLocaleString()} pass</span>
                                <span style={{ color: C.red }}>{s.failCount.toLocaleString()} fail</span>
                                <span style={{ color: C.blue }}>{s.avgCycleTime.toFixed(1)}s</span>
                              </div>
                            </div>
                            {s.totalTests > 0 && (
                              <div className="flex gap-0.5 h-5 rounded-lg overflow-hidden">
                                <div className="flex items-center justify-center" style={{ width: `${s.passRate}%`, backgroundColor: C.green + "cc" }}>
                                  {s.passRate > 20 && <span className="text-[9px] font-mono text-white font-bold">{s.passRate.toFixed(0)}%</span>}
                                </div>
                                <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: C.red + "cc" }}>
                                  {(100 - s.passRate) > 10 && <span className="text-[9px] font-mono text-white font-bold">{(100 - s.passRate).toFixed(0)}%</span>}
                                </div>
                              </div>
                            )}
                            <p className="text-[10px] text-muted-foreground">{s.totalTests.toLocaleString()} tests · {s.uniquePhones.toLocaleString()} unique LOTs</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              </Section>

              {/* ── MACHINE ANOMALY DETECTION ── */}
              {analysis.machineAnomalies.length > 0 && (
                <Section title="Machine Anomaly Detection" icon={Cpu}>
                  <Card title="Anomaly Status" sub="Machines flagged vs global average thresholds">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            {["Machine", "Status", "Pass Rate", "Avg Cycle", "Escape Rate", "Risk Flags"].map((h) => (
                              <th key={h} className="text-left py-2 px-2 text-muted-foreground font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {analysis.machineAnomalies.map((m) => {
                            const statusColor = m.status === "CRITICAL" ? C.red : m.status === "WARNING" ? C.orange : C.green;
                            return (
                              <tr key={m.device} style={{ backgroundColor: m.status === "CRITICAL" ? "rgba(239,68,68,0.08)" : m.status === "WARNING" ? "rgba(249,115,22,0.08)" : "" }}>
                                <td className="py-2 px-2 font-mono text-white">{m.device}</td>
                                <td className="py-2 px-2">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${statusColor}33`, color: statusColor }}>{m.status}</span>
                                </td>
                                <td className="py-2 px-2 font-mono" style={{ color: m.passRate < 90 ? C.red : C.green }}>{m.passRate.toFixed(1)}%</td>
                                <td className="py-2 px-2 font-mono" style={{ color: C.blue }}>{m.avgCycleTime.toFixed(1)}s</td>
                                <td className="py-2 px-2 font-mono" style={{ color: m.escapeRate > 5 ? C.orange : C.axis }}>{m.escapeRate.toFixed(1)}%</td>
                                <td className="py-2 px-2 font-mono text-muted-foreground">{m.riskScore}/3</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </Section>
              )}

              {/* ── FAILURE HEATMAP ── */}
              <Section title="Failure Heatmap" icon={Layers}>
                {analysis.failureHeatmap.length === 0 ? (
                  <Card title="Device × Error Matrix" sub="No failures recorded">
                    <EmptyState msg="No failure data — all tests passed." />
                  </Card>
                ) : (
                  <Card title="Device × Error Matrix" sub="Top failure combinations — bar = relative frequency">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-2 px-2 text-muted-foreground font-medium">Machine</th>
                            <th className="text-left py-2 px-2 text-muted-foreground font-medium">Error Message</th>
                            <th className="text-right py-2 px-2 text-muted-foreground font-medium">Count</th>
                            <th className="text-right py-2 px-2 text-muted-foreground font-medium w-28">Heat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {analysis.failureHeatmap.slice(0, 30).map((item, idx) => {
                            const maxCount = analysis.failureHeatmap[0]?.count ?? 1;
                            const pct = Math.round((item.count / maxCount) * 100);
                            const barColor = pct > 70 ? C.red : pct > 40 ? C.orange : C.amber;
                            return (
                              <tr key={idx} style={{ backgroundColor: idx < 5 ? "rgba(239,68,68,0.05)" : "" }}>
                                <td className="py-1.5 px-2 font-mono whitespace-nowrap" style={{ color: C.blue }}>{item.device}</td>
                                <td className="py-1.5 px-2 text-muted-foreground break-words max-w-xs">{item.error}</td>
                                <td className="py-1.5 px-2 text-right font-mono font-bold" style={{ color: idx < 5 ? C.red : C.text }}>{item.count}</td>
                                <td className="py-1.5 px-2">
                                  <div className="flex items-center gap-1">
                                    <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                                    </div>
                                    <span className="text-[10px] w-8 text-right" style={{ color: C.axis }}>{pct}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </Section>

              {/* ── HOURLY PRODUCTION TRACER ── */}
              {analysis.hourlyTracer.length > 0 && (
                <Section title="Hourly Production Tracer" icon={Calendar}>
                  <Card title="Hourly Output & Fail Rate" sub="Stacked bars = tests · Line = fail %">
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={analysis.hoursList.slice(-24).map((hour) => {
                            const entries = analysis.hourlyTracer.filter((h) => h.hour === hour);
                            const pass = entries.reduce((s, e) => s + e.passCount, 0);
                            const fail = entries.reduce((s, e) => s + e.failCount, 0);
                            const total = pass + fail;
                            return { hour: hour.split(" ")[1] ?? hour, pass, fail, failRate: total > 0 ? (fail / total) * 100 : 0 };
                          })}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                          <XAxis dataKey="hour" stroke={C.axis} fontSize={10} tick={{ fill: C.axis }} />
                          <YAxis yAxisId="l" stroke={C.axis} fontSize={11} tick={{ fill: C.axis }} />
                          <YAxis yAxisId="r" orientation="right" stroke={C.axis} fontSize={11} domain={[0, 100]} tick={{ fill: C.axis }} />
                          <Tooltip {...TOOLTIP_STYLE} />
                          <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: C.axis }} />
                          <Bar yAxisId="l" dataKey="pass" name="Pass" fill={C.green} radius={[4, 4, 0, 0]} stackId="a" />
                          <Bar yAxisId="l" dataKey="fail" name="Fail" fill={C.red} radius={[4, 4, 0, 0]} stackId="a" />
                          <Line yAxisId="r" type="monotone" dataKey="failRate" name="Fail %" stroke={C.amber} strokeWidth={2} dot={{ r: 3, fill: C.amber }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card title="Hourly Breakdown Table" sub="Tests per hour — most recent first">
                    <div className="overflow-auto max-h-64">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-card">
                          <tr className="border-b border-white/10">
                            {["Hour", "Machine", "Tests", "Pass", "Fail", "Fail%", "Unique LOTs"].map((h) => (
                              <th key={h} className={`py-2 px-2 text-muted-foreground font-medium whitespace-nowrap ${h === "Hour" || h === "Machine" ? "text-left" : "text-right"}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {analysis.hourlyTracer.slice(-100).reverse().map((h, i) => (
                            <tr key={i} style={{ backgroundColor: h.failRate > 10 ? "rgba(239,68,68,0.05)" : "" }}>
                              <td className="py-1.5 px-2 font-mono text-[10px] whitespace-nowrap" style={{ color: C.axis }}>{h.hour.split(" ")[1] ?? h.hour}</td>
                              <td className="py-1.5 px-2" style={{ color: C.blue }}>{h.device}</td>
                              <td className="py-1.5 px-2 text-right font-mono text-white">{h.totalTests}</td>
                              <td className="py-1.5 px-2 text-right font-mono" style={{ color: C.green }}>{h.passCount}</td>
                              <td className="py-1.5 px-2 text-right font-mono" style={{ color: C.red }}>{h.failCount}</td>
                              <td className="py-1.5 px-2 text-right font-mono" style={{ color: h.failRate > 10 ? C.red : C.axis }}>{h.failRate.toFixed(1)}%</td>
                              <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">{h.uniquePhones}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </Section>
              )}

              {/* ── DYNAMIC BOTTLENECK ANALYSIS ── */}
              {analysis.dynamicBottlenecks.length > 0 && (
                <Section title="Dynamic Bottleneck Analysis" icon={Filter}>
                  <Card title="Hourly Bottleneck Log" sub="Worst-performing station per hour">
                    <div className="overflow-y-auto max-h-72">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-card">
                          <tr className="border-b border-white/10">
                            {["Time Window", "Worst Machine", "Reason", "Tests", "Avg Cycle", "Fails"].map((h) => (
                              <th key={h} className={`py-2 px-2 text-muted-foreground font-medium ${["Tests", "Avg Cycle", "Fails"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {analysis.dynamicBottlenecks.slice(-20).reverse().map((b, i) => {
                            const reasonColor = b.reason === "High Failure Rate" ? C.red : b.reason === "Slow Cycle Time" ? C.orange : C.blue;
                            return (
                              <tr key={i} style={{ backgroundColor: b.reason === "High Failure Rate" ? "rgba(239,68,68,0.05)" : b.reason === "Slow Cycle Time" ? "rgba(249,115,22,0.05)" : "" }}>
                                <td className="py-2 px-2 font-mono whitespace-nowrap" style={{ color: C.axis }}>{b.timeWindow}</td>
                                <td className="py-2 px-2 text-white font-medium">{b.worstMachine}</td>
                                <td className="py-2 px-2">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: `${reasonColor}33`, color: reasonColor }}>
                                    {b.reason}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-right font-mono text-white">{b.totalTests}</td>
                                <td className="py-2 px-2 text-right font-mono" style={{ color: C.blue }}>{b.avgCycleTime.toFixed(1)}s</td>
                                <td className="py-2 px-2 text-right font-mono" style={{ color: b.failCount > 0 ? C.red : C.axis }}>{b.failCount}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
