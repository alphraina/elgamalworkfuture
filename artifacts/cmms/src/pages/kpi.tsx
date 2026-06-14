import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, Badge, Button, Modal, Select } from "@/components/ui";
import { BarChart3, Printer, Download, ChevronRight, TrendingUp, Users, CheckCircle2, Clock, Wrench, GraduationCap, Palmtree, AlertTriangle, Settings, Save, CalendarCheck, ShieldCheck, Hammer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ROLE_COLORS: Record<string, string> = {
  admin:       "text-red-400 border-red-400/30 bg-red-400/10",
  manager:     "text-blue-400 border-blue-400/30 bg-blue-400/10",
  teamleader:  "text-purple-400 border-purple-400/30 bg-purple-400/10",
  maintenance: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  inventory:   "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
};

interface MemberKPI {
  userId: number;
  userName: string;
  workId: string;
  role: string;
  department: string | null;
  attendance: {
    present: number; absent: number; late: number; leave: number; halfday: number;
    totalDays: number; attendanceScore: number | null; punctualityScore: number | null;
  };
  tasks: {
    completed: number; pending: number; inProgress: number; cancelled: number;
    overdue: number; total: number; taskScore: number | null;
  };
  downtime: { incidents: number; totalMinutes: number };
  training: { completed: number; scheduled: number; total: number };
  vacation: { days: number; requests: number };
  brokenMachines: {
    reported: number; resolved: number; inProgress: number;
    repairAssigned: number; repairCompleted: number; repairInProgress: number;
  };
  pm: { total: number; completed: number; overdue: number; active: number };
  linePlans: { total: number; completed: number; published: number; draft: number };
  exams: { taken: number; passed: number; avgScore: number | null };
  overallScore: number | null;
  scoreColor: string;
}

interface KPIData {
  month: string;
  members: MemberKPI[];
  settings: KpiWeights;
  summary: { totalMembers: number; avgScore: number | null };
}

interface KpiWeights {
  attWithExams: number;
  tasksWithExams: number;
  examsWeight: number;
  attWithoutExams: number;
  tasksWithoutExams: number;
  repairWeight: number;
  pmWeight: number;
  linePlanWeight: number;
  greenThreshold: number;
  yellowThreshold: number;
}

function ScoreBadge({ score, small }: { score: number | null; small?: boolean }) {
  if (score === null) return <span className="text-muted-foreground text-xs">—</span>;
  const cls = score >= 90
    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    : score >= 70
    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
    : "bg-red-500/20 text-red-400 border-red-500/30";
  return (
    <span className={`inline-flex items-center justify-center font-bold border rounded px-2 py-0.5 ${small ? "text-xs" : "text-sm"} ${cls}`}>
      {score}%
    </span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return null;
  const color = score >= 90 ? "bg-emerald-500" : score >= 70 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="w-full bg-white/10 rounded-full h-1.5 mt-1">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${Math.min(score, 100)}%` }} />
    </div>
  );
}

function DetailModal({ member, onClose }: { member: MemberKPI; onClose: () => void }) {
  const att = member.attendance;
  const tasks = member.tasks;

  const sections = [
    {
      icon: <Clock className="w-4 h-4 text-blue-400" />,
      title: "Attendance",
      color: "blue",
      items: [
        { label: "Present", value: att.present, color: "text-emerald-400" },
        { label: "Absent", value: att.absent, color: "text-red-400" },
        { label: "Late Arrivals", value: att.late, color: "text-amber-400" },
        { label: "Leave Days", value: att.leave, color: "text-blue-400" },
        { label: "Half Days", value: att.halfday, color: "text-purple-400" },
        { label: "Total Recorded", value: att.totalDays, color: "text-white" },
        { label: "Punctuality Rate (info)", value: att.punctualityScore !== null ? `${att.punctualityScore}%` : "—", color: "text-muted-foreground" },
      ],
      scores: [
        { label: "Attendance Rate", score: att.attendanceScore },
      ],
    },
    {
      icon: <CheckCircle2 className="w-4 h-4 text-green-400" />,
      title: "Tasks",
      color: "green",
      items: [
        { label: "Completed", value: tasks.completed, color: "text-emerald-400" },
        { label: "In Progress", value: tasks.inProgress, color: "text-blue-400" },
        { label: "Pending", value: tasks.pending, color: "text-amber-400" },
        { label: "Overdue", value: tasks.overdue, color: "text-red-400" },
        { label: "Cancelled", value: tasks.cancelled, color: "text-muted-foreground" },
        { label: "Total Assigned", value: tasks.total, color: "text-white" },
      ],
      scores: [{ label: "Task Completion Rate", score: tasks.taskScore }],
    },
  ];

  return (
    <Modal isOpen onClose={onClose} title={`KPI Detail — ${member.userName}`}>
      <div className="space-y-5">
        {/* Overall score */}
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Overall KPI Score</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {member.role.charAt(0).toUpperCase() + member.role.slice(1)} · {member.department ?? "No Dept"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              <ScoreBadge score={member.overallScore} />
            </div>
            <ScoreBar score={member.overallScore} />
          </div>
        </div>

        {/* Sections */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sections.map(s => (
            <div key={s.title} className="bg-card border border-white/5 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                {s.icon}
                <span className="font-semibold text-white text-sm">{s.title}</span>
              </div>
              <div className="space-y-1.5">
                {s.items.map(item => (
                  <div key={item.label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className={`font-bold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
              {s.scores.map(sc => (
                <div key={sc.label} className="pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{sc.label}</span>
                    <ScoreBadge score={sc.score} small />
                  </div>
                  <ScoreBar score={sc.score} />
                </div>
              ))}
            </div>
          ))}

          {/* Downtime */}
          <div className="bg-card border border-white/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="font-semibold text-white text-sm">Downtime</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Incidents Reported</span>
                <span className={`font-bold ${member.downtime.incidents > 0 ? "text-orange-400" : "text-emerald-400"}`}>{member.downtime.incidents}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total Downtime</span>
                <span className="font-bold text-white">
                  {member.downtime.totalMinutes >= 60
                    ? `${Math.floor(member.downtime.totalMinutes / 60)}h ${member.downtime.totalMinutes % 60}m`
                    : `${member.downtime.totalMinutes}m`}
                </span>
              </div>
            </div>
          </div>

          {/* Training */}
          <div className="bg-card border border-white/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-purple-400" />
              <span className="font-semibold text-white text-sm">Training</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Sessions Completed</span>
                <span className="font-bold text-emerald-400">{member.training.completed}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Sessions Scheduled</span>
                <span className="font-bold text-blue-400">{member.training.scheduled}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total Enrolled</span>
                <span className="font-bold text-white">{member.training.total}</span>
              </div>
            </div>
          </div>

          {/* Vacation */}
          <div className="bg-card border border-white/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Palmtree className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-white text-sm">Vacation / Leave</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Leave Days Taken</span>
                <span className="font-bold text-cyan-400">{member.vacation.days}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Requests Submitted</span>
                <span className="font-bold text-white">{member.vacation.requests}</span>
              </div>
            </div>
          </div>

          {/* Broken Machines */}
          <div className="bg-card border border-white/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-red-400" />
              <span className="font-semibold text-white text-sm">Broken Machines</span>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Reported by</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Reported</span>
                <span className={`font-bold ${member.brokenMachines.reported > 0 ? "text-red-400" : "text-muted-foreground"}`}>{member.brokenMachines.reported}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">In Progress</span>
                <span className={`font-bold ${(member.brokenMachines.inProgress ?? 0) > 0 ? "text-amber-400" : "text-muted-foreground"}`}>{member.brokenMachines.inProgress ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Resolved / Closed</span>
                <span className={`font-bold ${member.brokenMachines.resolved > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>{member.brokenMachines.resolved}</span>
              </div>
            </div>
            {(member.brokenMachines.repairAssigned ?? 0) > 0 && (
              <>
                <div className="border-t border-white/10 pt-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Assigned for repair</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Total Assigned</span>
                      <span className="font-bold text-white">{member.brokenMachines.repairAssigned}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">In Progress</span>
                      <span className={`font-bold ${(member.brokenMachines.repairInProgress ?? 0) > 0 ? "text-amber-400" : "text-muted-foreground"}`}>{member.brokenMachines.repairInProgress ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Repaired</span>
                      <span className={`font-bold ${(member.brokenMachines.repairCompleted ?? 0) > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>{member.brokenMachines.repairCompleted ?? 0}</span>
                    </div>
                  </div>
                  {(member.brokenMachines.repairAssigned ?? 0) > 0 && (
                    <div className="pt-2 border-t border-white/10 mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Repair completion rate</span>
                        <ScoreBadge score={Math.round(((member.brokenMachines.repairCompleted ?? 0) / member.brokenMachines.repairAssigned!) * 100)} small />
                      </div>
                      <ScoreBar score={Math.round(((member.brokenMachines.repairCompleted ?? 0) / member.brokenMachines.repairAssigned!) * 100)} />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Preventive Maintenance */}
          <div className="bg-card border border-white/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-white text-sm">Preventive Maintenance</span>
            </div>
            {(member.pm?.total ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">No PM tasks assigned this month.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total Assigned</span>
                    <span className="font-bold text-white">{member.pm?.total ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Completed</span>
                    <span className={`font-bold ${(member.pm?.completed ?? 0) > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>{member.pm?.completed ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Active</span>
                    <span className={`font-bold ${(member.pm?.active ?? 0) > 0 ? "text-blue-400" : "text-muted-foreground"}`}>{member.pm?.active ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Overdue</span>
                    <span className={`font-bold ${(member.pm?.overdue ?? 0) > 0 ? "text-red-400" : "text-muted-foreground"}`}>{member.pm?.overdue ?? 0}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">PM completion rate</span>
                    <ScoreBadge score={Math.round(((member.pm?.completed ?? 0) / (member.pm?.total ?? 1)) * 100)} small />
                  </div>
                  <ScoreBar score={Math.round(((member.pm?.completed ?? 0) / (member.pm?.total ?? 1)) * 100)} />
                </div>
              </>
            )}
          </div>

          {/* Line Plans */}
          <div className="bg-card border border-white/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-white text-sm">Shift Handover</span>
            </div>
            {(member.linePlans?.total ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">No line plans assigned this month.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total Assigned</span>
                    <span className="font-bold text-white">{member.linePlans?.total ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Completed</span>
                    <span className={`font-bold ${(member.linePlans?.completed ?? 0) > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>{member.linePlans?.completed ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Published</span>
                    <span className={`font-bold ${(member.linePlans?.published ?? 0) > 0 ? "text-blue-400" : "text-muted-foreground"}`}>{member.linePlans?.published ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Draft</span>
                    <span className={`font-bold ${(member.linePlans?.draft ?? 0) > 0 ? "text-amber-400" : "text-muted-foreground"}`}>{member.linePlans?.draft ?? 0}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Completion rate</span>
                    <ScoreBadge score={Math.round(((member.linePlans?.completed ?? 0) / (member.linePlans?.total ?? 1)) * 100)} small />
                  </div>
                  <ScoreBar score={Math.round(((member.linePlans?.completed ?? 0) / (member.linePlans?.total ?? 1)) * 100)} />
                </div>
              </>
            )}
          </div>

          {/* Exams */}
          <div className="bg-card border border-white/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-yellow-400" />
              <span className="font-semibold text-white text-sm">Training Exams</span>
            </div>
            {(member.exams?.taken ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">No exams taken this month.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Exams Taken</span>
                    <span className="font-bold text-white">{member.exams.taken}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Passed</span>
                    <span className="font-bold text-emerald-400">{member.exams.passed}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Failed</span>
                    <span className="font-bold text-red-400">{member.exams.taken - member.exams.passed}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Avg Exam Score</span>
                    <ScoreBadge score={member.exams.avgScore} small />
                  </div>
                  <ScoreBar score={member.exams.avgScore} />
                  <p className="text-[10px] text-muted-foreground mt-1">Contributes 15% to overall KPI</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

const DEFAULT_WEIGHTS: KpiWeights = {
  attWithExams: 0.30, tasksWithExams: 0.40, examsWeight: 0.15,
  attWithoutExams: 0.40, tasksWithoutExams: 0.60,
  repairWeight: 0.10, pmWeight: 0.10, linePlanWeight: 0.10,
  greenThreshold: 90, yellowThreshold: 70,
};

function pct(v: number) { return `${Math.round(v * 100)}%`; }

export default function KPI() {
  const { isAdmin, isManager, isTeamLeader } = useAuth();
  const { toast } = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [roleFilter, setRoleFilter] = useState("");
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberKPI | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [weightsDraft, setWeightsDraft] = useState<KpiWeights>(DEFAULT_WEIGHTS);
  const [savingWeights, setSavingWeights] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isAdmin && !isManager && !isTeamLeader) {
    return <div className="p-8 text-center text-destructive">Access denied. Managers and Team Leaders only.</div>;
  }

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/kpi?month=${month}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d?.settings) setWeightsDraft(d.settings);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [month]);

  const saveWeights = async () => {
    setSavingWeights(true);
    try {
      const r = await fetch(`${BASE}/api/kpi/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(weightsDraft),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      toast({ title: "KPI equation saved" });
      setShowSettings(false);
      setLoading(true);
      fetch(`${BASE}/api/kpi?month=${month}`, { credentials: "include" })
        .then(res => res.json()).then(d => setData(d)).catch(() => {}).finally(() => setLoading(false));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingWeights(false);
    }
  };

  const W = data?.settings ?? DEFAULT_WEIGHTS;

  const members = (data?.members ?? []).filter(m => !roleFilter || m.role === roleFilter);

  const avgAttendance = members.filter(m => m.attendance.attendanceScore !== null).length > 0
    ? Math.round(members.reduce((s, m) => s + (m.attendance.attendanceScore ?? 0), 0) / members.filter(m => m.attendance.attendanceScore !== null).length)
    : null;

  const avgTask = members.filter(m => m.tasks.taskScore !== null).length > 0
    ? Math.round(members.reduce((s, m) => s + (m.tasks.taskScore ?? 0), 0) / members.filter(m => m.tasks.taskScore !== null).length)
    : null;

  const avgKPI = members.filter(m => m.overallScore !== null).length > 0
    ? Math.round(members.reduce((s, m) => s + (m.overallScore ?? 0), 0) / members.filter(m => m.overallScore !== null).length)
    : null;

  const handleExportCSV = () => {
    if (!data) return;
    const headers = [
      "Name", "Work ID", "Role", "Department",
      "Present", "Absent", "Late", "Leave", "Half Day", "Attendance %", "Punctuality %",
      "Tasks Done", "Tasks Total", "Overdue", "Task %",
      "Downtime Incidents", "Downtime Minutes",
      "Training Sessions", "Vacation Days",
      "Broken Reported", "Broken Resolved",
      "Overall KPI %",
    ];
    const rows = members.map(m => [
      m.userName, m.workId, m.role, m.department ?? "",
      m.attendance.present, m.attendance.absent, m.attendance.late, m.attendance.leave, m.attendance.halfday,
      m.attendance.attendanceScore ?? "", m.attendance.punctualityScore ?? "",
      m.tasks.completed, m.tasks.total, m.tasks.overdue, m.tasks.taskScore ?? "",
      m.downtime.incidents, m.downtime.totalMinutes,
      m.training.completed + m.training.scheduled, m.vacation.days,
      m.brokenMachines.reported, m.brokenMachines.resolved,
      m.overallScore ?? "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `KPI_Report_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  const monthLabel = new Date(`${month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            KPI Report
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Monthly performance overview for all team members.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="h-8 text-xs rounded border border-input bg-background/50 px-3 text-white focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="h-8 text-xs w-36">
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="teamleader">Team Leader</option>
            <option value="maintenance">Maintenance</option>
            <option value="inventory">Inventory</option>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs print:hidden">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10">
              <Settings className="w-3.5 h-3.5" /> KPI Equation
            </Button>
          )}
        </div>
      </div>

      {/* Print header (visible only in print) */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">Midea Factory CMMS — KPI Report</h1>
        <p className="text-sm text-gray-600">{monthLabel} · Generated {new Date().toLocaleDateString()}</p>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
          {[
            { icon: <Users className="w-5 h-5 text-blue-400" />, label: "Total Members", value: members.length, color: "text-blue-400" },
            { icon: <TrendingUp className="w-5 h-5 text-primary" />, label: "Avg KPI Score", value: avgKPI !== null ? `${avgKPI}%` : "—", color: avgKPI !== null ? (avgKPI >= 90 ? "text-emerald-400" : avgKPI >= 70 ? "text-amber-400" : "text-red-400") : "text-muted-foreground" },
            { icon: <Clock className="w-5 h-5 text-green-400" />, label: "Avg Attendance", value: avgAttendance !== null ? `${avgAttendance}%` : "—", color: avgAttendance !== null ? (avgAttendance >= 90 ? "text-emerald-400" : avgAttendance >= 70 ? "text-amber-400" : "text-red-400") : "text-muted-foreground" },
            { icon: <CheckCircle2 className="w-5 h-5 text-purple-400" />, label: "Avg Task Rate", value: avgTask !== null ? `${avgTask}%` : "—", color: avgTask !== null ? (avgTask >= 90 ? "text-emerald-400" : avgTask >= 70 ? "text-amber-400" : "text-red-400") : "text-muted-foreground" },
          ].map(card => (
            <div key={card.label} className="bg-card border border-white/5 rounded-lg p-4 flex items-center gap-3">
              <div className="flex-shrink-0">{card.icon}</div>
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPI Table */}
      <Card>
        <div className="p-4 border-b border-white/10 flex items-center justify-between print:hidden">
          <span className="text-sm font-semibold text-white">
            {monthLabel} — {members.length} member{members.length !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-muted-foreground">Click a row to view full details</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading KPI data...</div>
        ) : members.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            {data ? "No members found for the selected filters." : "Select a month to load KPI data."}
          </div>
        ) : (
          <div className="overflow-x-auto" ref={printRef}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left py-3 px-4 sticky left-0 bg-card z-10 min-w-[180px]">Employee</th>
                  {/* Attendance */}
                  <th className="text-center py-3 px-2 min-w-[60px]" title="Present days">P</th>
                  <th className="text-center py-3 px-2 min-w-[60px]" title="Absent days">A</th>
                  <th className="text-center py-3 px-2 min-w-[60px]" title="Late arrivals">L</th>
                  <th className="text-center py-3 px-2 min-w-[60px]" title="Leave days">Lv</th>
                  <th className="text-center py-3 px-2 min-w-[90px]">Att %</th>
                  <th className="text-center py-3 px-2 min-w-[90px]">Punct %</th>
                  {/* Tasks */}
                  <th className="text-center py-3 px-2 min-w-[90px]">Tasks Done</th>
                  <th className="text-center py-3 px-2 min-w-[70px]">Overdue</th>
                  <th className="text-center py-3 px-2 min-w-[90px]">Task %</th>
                  {/* Downtime */}
                  <th className="text-center py-3 px-2 min-w-[90px]">DT Events</th>
                  <th className="text-center py-3 px-2 min-w-[90px]">DT Hrs</th>
                  {/* Training */}
                  <th className="text-center py-3 px-2 min-w-[90px]">Training</th>
                  {/* Exams */}
                  <th className="text-center py-3 px-2 min-w-[90px]">Exam Avg</th>
                  {/* Vacation */}
                  <th className="text-center py-3 px-2 min-w-[80px]">Vac Days</th>
                  {/* Broken Machines */}
                  <th className="text-center py-3 px-2 min-w-[90px]" title="Reported / Resolved">BM Rep.</th>
                  <th className="text-center py-3 px-2 min-w-[90px]" title="Assigned for repair / Repaired">BM Repair</th>
                  {/* PM */}
                  <th className="text-center py-3 px-2 min-w-[90px]" title="PM Completed / Total">PM</th>
                  {/* Line Plans */}
                  <th className="text-center py-3 px-2 min-w-[90px]" title="Line Plans Completed / Total">Line Plans</th>
                  {/* Overall */}
                  <th className="text-center py-3 px-4 min-w-[100px]">KPI Score</th>
                  <th className="py-3 px-2 print:hidden" />
                </tr>
                {/* Column group labels */}
                <tr className="border-b border-white/5 text-[10px] text-muted-foreground/60 bg-white/[0.02]">
                  <th />
                  <th colSpan={6} className="text-center py-1 border-r border-white/5 font-normal">ATTENDANCE</th>
                  <th colSpan={3} className="text-center py-1 border-r border-white/5 font-normal">TASKS</th>
                  <th colSpan={2} className="text-center py-1 border-r border-white/5 font-normal">DOWNTIME</th>
                  <th className="text-center py-1 border-r border-white/5 font-normal">TRAIN.</th>
                  <th className="text-center py-1 border-r border-white/5 font-normal">EXAMS</th>
                  <th className="text-center py-1 border-r border-white/5 font-normal">LEAVE</th>
                  <th colSpan={2} className="text-center py-1 border-r border-white/5 font-normal">BROKEN</th>
                  <th className="text-center py-1 border-r border-white/5 font-normal">PM</th>
                  <th className="text-center py-1 border-r border-white/5 font-normal">PLANS</th>
                  <th colSpan={2} />
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr
                    key={m.userId}
                    className={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}
                    onClick={() => setSelectedMember(m)}
                  >
                    {/* Employee */}
                    <td className="py-3 px-4 sticky left-0 bg-card z-10">
                      <div className="font-semibold text-white text-sm">{m.userName}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase ${ROLE_COLORS[m.role] ?? ""}`}>{m.role}</span>
                        {m.department && <span className="text-[10px] text-muted-foreground">{m.department}</span>}
                      </div>
                    </td>
                    {/* Attendance */}
                    <td className="text-center py-3 px-2 text-emerald-400 font-bold">{m.attendance.present}</td>
                    <td className="text-center py-3 px-2 text-red-400 font-bold">{m.attendance.absent || <span className="text-muted-foreground">0</span>}</td>
                    <td className="text-center py-3 px-2 text-amber-400 font-bold">{m.attendance.late || <span className="text-muted-foreground">0</span>}</td>
                    <td className="text-center py-3 px-2 text-blue-400 font-bold">{m.attendance.leave || <span className="text-muted-foreground">0</span>}</td>
                    <td className="text-center py-3 px-2"><ScoreBadge score={m.attendance.attendanceScore} small /></td>
                    <td className="text-center py-3 px-2"><ScoreBadge score={m.attendance.punctualityScore} small /></td>
                    {/* Tasks */}
                    <td className="text-center py-3 px-2 text-white text-xs">
                      <span className="text-emerald-400 font-bold">{m.tasks.completed}</span>
                      <span className="text-muted-foreground"> / {m.tasks.total}</span>
                    </td>
                    <td className="text-center py-3 px-2">
                      {m.tasks.overdue > 0
                        ? <span className="text-red-400 font-bold">{m.tasks.overdue}</span>
                        : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="text-center py-3 px-2"><ScoreBadge score={m.tasks.taskScore} small /></td>
                    {/* Downtime */}
                    <td className="text-center py-3 px-2">
                      {m.downtime.incidents > 0
                        ? <span className="text-orange-400 font-bold">{m.downtime.incidents}</span>
                        : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="text-center py-3 px-2 text-xs text-muted-foreground">
                      {m.downtime.totalMinutes > 0
                        ? m.downtime.totalMinutes >= 60
                          ? `${Math.floor(m.downtime.totalMinutes / 60)}h ${m.downtime.totalMinutes % 60}m`
                          : `${m.downtime.totalMinutes}m`
                        : "—"}
                    </td>
                    {/* Training */}
                    <td className="text-center py-3 px-2 text-purple-400 font-bold">
                      {m.training.completed + m.training.scheduled || <span className="text-muted-foreground">0</span>}
                    </td>
                    {/* Exams */}
                    <td className="text-center py-3 px-2">
                      {(m.exams?.taken ?? 0) > 0 ? (
                        <div>
                          <ScoreBadge score={m.exams.avgScore} small />
                          <div className="text-[10px] text-muted-foreground mt-0.5">{m.exams.passed}/{m.exams.taken} pass</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    {/* Vacation */}
                    <td className="text-center py-3 px-2 text-cyan-400 font-bold">
                      {m.vacation.days || <span className="text-muted-foreground">0</span>}
                    </td>
                    {/* Broken Machines - Reported/Resolved */}
                    <td className="text-center py-3 px-2 text-xs">
                      {m.brokenMachines.reported === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span>
                          <span className="text-red-400 font-bold">{m.brokenMachines.reported}</span>
                          <span className="text-muted-foreground"> rep / </span>
                          <span className="text-emerald-400 font-bold">{m.brokenMachines.resolved}</span>
                          <span className="text-muted-foreground"> fix</span>
                        </span>
                      )}
                    </td>
                    {/* Broken Machines - Repair Assignments */}
                    <td className="text-center py-3 px-2 text-xs">
                      {m.brokenMachines.repairAssigned === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span>
                          <span className="text-emerald-400 font-bold">{m.brokenMachines.repairCompleted}</span>
                          <span className="text-muted-foreground"> / {m.brokenMachines.repairAssigned}</span>
                        </span>
                      )}
                    </td>
                    {/* Preventive Maintenance */}
                    <td className="text-center py-3 px-2 text-xs">
                      {(m.pm?.total ?? 0) === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span>
                          <span className={`font-bold ${(m.pm?.overdue ?? 0) > 0 ? "text-red-400" : "text-emerald-400"}`}>{m.pm?.completed ?? 0}</span>
                          <span className="text-muted-foreground"> / {m.pm?.total ?? 0}</span>
                          {(m.pm?.overdue ?? 0) > 0 && <span className="text-red-400 ml-1">({m.pm?.overdue}⚠)</span>}
                        </span>
                      )}
                    </td>
                    {/* Line Plans */}
                    <td className="text-center py-3 px-2 text-xs">
                      {(m.linePlans?.total ?? 0) === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span>
                          <span className="text-indigo-400 font-bold">{m.linePlans?.completed ?? 0}</span>
                          <span className="text-muted-foreground"> / {m.linePlans?.total ?? 0}</span>
                        </span>
                      )}
                    </td>
                    {/* KPI Score */}
                    <td className="text-center py-3 px-4">
                      <div>
                        <ScoreBadge score={m.overallScore} />
                        <ScoreBar score={m.overallScore} />
                      </div>
                    </td>
                    {/* Expand */}
                    <td className="py-3 px-2 print:hidden">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Score legend */}
      <div className="flex flex-col gap-2 text-xs text-muted-foreground print:hidden">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-medium text-white">KPI Legend:</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> Excellent (≥{W.greenThreshold}%)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" /> Good ({W.yellowThreshold}–{W.greenThreshold - 1}%)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500 inline-block" /> Needs Improvement (&lt;{W.yellowThreshold}%)</span>
        </div>
        <div className="flex flex-col gap-1 text-muted-foreground/70 text-xs">
          <span>
            <span className="text-white/50">With exams: </span>
            Attendance {pct(W.attWithExams)} + Tasks {pct(W.tasksWithExams)} + Exams {pct(W.examsWeight)}
            {W.repairWeight > 0 && <span className="text-red-400/70"> + Repair {pct(W.repairWeight)}</span>}
            {W.pmWeight > 0 && <span className="text-cyan-400/70"> + PM {pct(W.pmWeight)}</span>}
            {W.linePlanWeight > 0 && <span className="text-indigo-400/70"> + Line Plans {pct(W.linePlanWeight)}</span>}
            <span className="text-white/30 ml-1">(normalised to 100%)</span>
          </span>
          <span>
            <span className="text-white/50">Without exams: </span>
            Attendance {pct(W.attWithoutExams)} + Tasks {pct(W.tasksWithoutExams)}
            {W.repairWeight > 0 && <span className="text-red-400/70"> + Repair {pct(W.repairWeight)}</span>}
            {W.pmWeight > 0 && <span className="text-cyan-400/70"> + PM {pct(W.pmWeight)}</span>}
            {W.linePlanWeight > 0 && <span className="text-indigo-400/70"> + Line Plans {pct(W.linePlanWeight)}</span>}
            <span className="text-white/30 ml-1">(normalised to 100%)</span>
          </span>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedMember && (
        <DetailModal member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}

      {/* KPI Equation Editor (Admin only) */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="KPI Equation Settings">
        <div className="space-y-5">
          <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg p-3">
            Weights are relative — the system normalises them automatically. Operational metrics (Repair, PM, Line Plans) only count for employees who have relevant data in the selected month. Set a weight to 0 to exclude a metric from scoring.
          </div>

          {/* With Exams */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white border-b border-white/10 pb-2">When exam results exist</p>
            <div className="grid grid-cols-3 gap-3">
              {([
                { label: "Attendance", key: "attWithExams", color: "text-emerald-400" },
                { label: "Task Completion", key: "tasksWithExams", color: "text-blue-400" },
                { label: "Exam Score", key: "examsWeight", color: "text-yellow-400" },
                { label: "Machine Repair Rate", key: "repairWeight", color: "text-red-400" },
                { label: "Preventive Maintenance", key: "pmWeight", color: "text-cyan-400" },
                { label: "Line Plan Completion", key: "linePlanWeight", color: "text-indigo-400" },
              ] as { label: string; key: keyof KpiWeights; color: string }[]).map(f => (
                <div key={f.key} className="space-y-1">
                  <label className={`text-xs font-medium ${f.color}`}>{f.label}</label>
                  <input
                    type="number" min={0} max={100} step={1}
                    value={Math.round((weightsDraft[f.key] as number) * 100)}
                    onChange={e => setWeightsDraft(p => ({ ...p, [f.key]: Math.min(1, Math.max(0, Number(e.target.value) / 100)) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Without Exams */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white border-b border-white/10 pb-2">When no exam results</p>
            <div className="grid grid-cols-3 gap-3">
              {([
                { label: "Attendance", key: "attWithoutExams", color: "text-emerald-400" },
                { label: "Task Completion", key: "tasksWithoutExams", color: "text-blue-400" },
                { label: "Machine Repair Rate", key: "repairWeight", color: "text-red-400" },
                { label: "Preventive Maintenance", key: "pmWeight", color: "text-cyan-400" },
                { label: "Line Plan Completion", key: "linePlanWeight", color: "text-indigo-400" },
              ] as { label: string; key: keyof KpiWeights; color: string }[]).map(f => (
                <div key={f.key} className="space-y-1">
                  <label className={`text-xs font-medium ${f.color}`}>{f.label}</label>
                  <input
                    type="number" min={0} max={100} step={1}
                    value={Math.round((weightsDraft[f.key] as number) * 100)}
                    onChange={e => setWeightsDraft(p => ({ ...p, [f.key]: Math.min(1, Math.max(0, Number(e.target.value) / 100)) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Score thresholds */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white border-b border-white/10 pb-2">Score thresholds</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500 inline-block" /> Excellent threshold (%)</label>
                <input
                  type="number" min={0} max={100} step={1}
                  value={weightsDraft.greenThreshold}
                  onChange={e => setWeightsDraft(p => ({ ...p, greenThreshold: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500 inline-block" /> Good threshold (%)</label>
                <input
                  type="number" min={0} max={100} step={1}
                  value={weightsDraft.yellowThreshold}
                  onChange={e => setWeightsDraft(p => ({ ...p, yellowThreshold: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-white/10">
            <button
              onClick={() => setShowSettings(false)}
              className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-muted-foreground hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveWeights}
              disabled={savingWeights}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {savingWeights ? "Saving…" : "Save Equation"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
