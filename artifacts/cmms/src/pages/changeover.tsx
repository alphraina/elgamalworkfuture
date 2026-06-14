import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Plus, Play, CheckCircle, XCircle, SlidersHorizontal, Trash2, ChevronDown, ChevronUp, LayoutList, LayoutGrid, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

const CAL_DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const CAL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

function CylinderProgress({ progress, status }: { progress: number; status: string }) {
  const clamp = Math.max(0, Math.min(100, progress));
  const fillHeight = (clamp / 100) * 100;

  const color =
    status === "completed"
      ? "#22c55e"
      : status === "cancelled"
      ? "#6b7280"
      : clamp < 30
      ? "#ef4444"
      : clamp < 70
      ? "#f59e0b"
      : "#22c55e";

  const glowColor =
    status === "completed"
      ? "rgba(34,197,94,0.4)"
      : status === "cancelled"
      ? "rgba(107,114,128,0.2)"
      : clamp < 30
      ? "rgba(239,68,68,0.4)"
      : clamp < 70
      ? "rgba(245,158,11,0.4)"
      : "rgba(34,197,94,0.4)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
      <svg width="56" height="120" viewBox="0 0 56 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id={`clip-${clamp}-${status}`}>
            <rect x="2" y={2 + (100 - fillHeight)} width="52" height={fillHeight} />
          </clipPath>
          <linearGradient id={`fill-grad-${clamp}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.6" />
            <stop offset="50%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="body-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(222 16% 12%)" />
            <stop offset="40%" stopColor="hsl(222 16% 18%)" />
            <stop offset="100%" stopColor="hsl(222 16% 10%)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Cylinder body */}
        <rect x="2" y="2" width="52" height="100" rx="8" ry="8" fill="url(#body-grad)" stroke="hsl(222 16% 25%)" strokeWidth="1.5" />

        {/* Liquid fill */}
        {clamp > 0 && (
          <rect
            x="2" y={2 + (100 - fillHeight)}
            width="52" height={fillHeight}
            rx={fillHeight >= 100 ? 8 : 0}
            style={{
              borderRadius: fillHeight >= 100 ? "8px" : undefined,
            }}
            fill={`url(#fill-grad-${clamp})`}
            filter="url(#glow)"
            clipPath={`url(#clip-${clamp}-${status})`}
          />
        )}

        {/* Bottom cap round */}
        {clamp > 0 && (
          <rect x="2" y="90" width="52" height="12" rx="0" fill={`url(#fill-grad-${clamp})`} clipPath={`url(#clip-${clamp}-${status})`} />
        )}

        {/* Shine overlay */}
        <rect x="6" y="4" width="12" height="96" rx="6" fill="white" opacity="0.04" />

        {/* Top ellipse */}
        <ellipse cx="28" cy="2" rx="26" ry="6" fill="hsl(222 16% 22%)" stroke="hsl(222 16% 30%)" strokeWidth="1.5" />

        {/* Bottom ellipse */}
        <ellipse cx="28" cy="102" rx="26" ry="6" fill="hsl(222 16% 18%)" stroke="hsl(222 16% 25%)" strokeWidth="1.5" />

        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = 2 + (100 - tick);
          return (
            <line key={tick} x1="51" y1={y} x2="54" y2={y} stroke="hsl(222 16% 35%)" strokeWidth="1" />
          );
        })}

        {/* Percentage text */}
        <text x="28" y="56" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="'Chakra Petch', monospace" opacity="0.9">
          {clamp}%
        </text>
      </svg>
      <span style={{ fontSize: "11px", color: "hsl(222 16% 55%)", fontFamily: "monospace" }}>
        {clamp}%
      </span>
    </div>
  );
}

function BigCylinderProgress({ progress, status, taskId }: { progress: number; status: string; taskId: number }) {
  const clamp = Math.max(0, Math.min(100, progress));
  const fillHeight = (clamp / 100) * 140;

  const color =
    status === "completed" ? "#22c55e"
    : status === "cancelled" ? "#6b7280"
    : clamp < 30 ? "#ef4444"
    : clamp < 70 ? "#f59e0b"
    : "#22c55e";

  const uid = `big-${taskId}`;

  return (
    <svg width="80" height="180" viewBox="0 0 80 180" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id={`${uid}-clip`}>
          <rect x="3" y={3 + (140 - fillHeight)} width="74" height={fillHeight} />
        </clipPath>
        <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="50%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(222 16% 10%)" />
          <stop offset="40%" stopColor="hsl(222 16% 17%)" />
          <stop offset="100%" stopColor="hsl(222 16% 8%)" />
        </linearGradient>
        <filter id={`${uid}-glow`}>
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Body */}
      <rect x="3" y="3" width="74" height="140" rx="10" ry="10"
        fill={`url(#${uid}-body)`} stroke="hsl(222 16% 25%)" strokeWidth="1.5" />

      {/* Fill */}
      {clamp > 0 && (
        <rect x="3" y={3 + (140 - fillHeight)} width="74" height={fillHeight}
          rx={fillHeight >= 140 ? 10 : 0}
          fill={`url(#${uid}-fill)`}
          filter={`url(#${uid}-glow)`}
          clipPath={`url(#${uid}-clip)`}
        />
      )}

      {/* Bottom cap */}
      {clamp > 0 && (
        <rect x="3" y="131" width="74" height="12" fill={`url(#${uid}-fill)`}
          clipPath={`url(#${uid}-clip)`} />
      )}

      {/* Shine */}
      <rect x="9" y="6" width="16" height="134" rx="8" fill="white" opacity="0.04" />

      {/* Top cap */}
      <ellipse cx="40" cy="3" rx="37" ry="8" fill="hsl(222 16% 20%)" stroke="hsl(222 16% 30%)" strokeWidth="1.5" />

      {/* Bottom cap */}
      <ellipse cx="40" cy="143" rx="37" ry="8" fill="hsl(222 16% 16%)" stroke="hsl(222 16% 25%)" strokeWidth="1.5" />

      {/* Tick marks */}
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = 3 + (140 - (tick / 100) * 140);
        return (
          <g key={tick}>
            <line x1="73" y1={y} x2="78" y2={y} stroke="hsl(222 16% 35%)" strokeWidth="1.2" />
            <text x="79" y={y + 3} fontSize="8" fill="hsl(222 16% 42%)" fontFamily="monospace">{tick}</text>
          </g>
        );
      })}

      {/* Percentage */}
      <text x="40" y="76" textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize="18" fontWeight="bold"
        fontFamily="'Chakra Petch', monospace" opacity="0.95">
        {clamp}%
      </text>

      {/* Liquid surface wave line */}
      {clamp > 0 && clamp < 100 && (
        <line
          x1="3" y1={3 + (140 - fillHeight)}
          x2="77" y2={3 + (140 - fillHeight)}
          stroke={color} strokeWidth="1.5" opacity="0.6"
          clipPath={`url(#${uid}-clip)`}
        />
      )}
    </svg>
  );
}

const statusColors: Record<string, string> = {
  pending: "hsl(222 16% 30%)",
  in_progress: "hsl(217 91% 50%)",
  completed: "hsl(142 71% 35%)",
  cancelled: "hsl(222 16% 28%)",
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
    <Label style={{ fontSize: "12px", color: "hsl(222 16% 55%)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</Label>
    {children}
  </div>
);

export default function Changeover() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user, isAdmin, isManager, isTeamLeader } = useAuth();

  const canManage = isAdmin || isManager;

  const [showCreate, setShowCreate] = useState(false);
  const [progressCard, setProgressCard] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterLine, setFilterLine] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "cylinder" | "calendar">("list");
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calSelectedDay, setCalSelectedDay] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    lineId: "",
    fromModel: "",
    toModel: "",
    assignedToId: "",
    scheduledStart: "",
    scheduledEnd: "",
    notes: "",
  });

  const [progressValue, setProgressValue] = useState(0);
  const [progressNotes, setProgressNotes] = useState("");

  const { data: tasks = [], isLoading } = useQuery<any[]>({
    queryKey: ["changeover-tasks"],
    queryFn: () => apiFetch("/api/changeover-tasks"),
  });

  const { data: lines = [] } = useQuery<any[]>({
    queryKey: ["lines"],
    queryFn: () => apiFetch("/api/production/lines"),
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["users"],
    queryFn: () => apiFetch("/api/users"),
    enabled: canManage,
  });

  const teamLeaders = useMemo(() => users.filter((u: any) => u.role === "teamleader"), [users]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/api/changeover-tasks", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["changeover-tasks"] });
      setShowCreate(false);
      setForm({ date: new Date().toISOString().slice(0, 10), lineId: "", fromModel: "", toModel: "", assignedToId: "", scheduledStart: "", scheduledEnd: "", notes: "" });
      toast({ title: t("changeover.created") });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const startMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/changeover-tasks/${id}/start`, { method: "PATCH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["changeover-tasks"] }); toast({ title: t("changeover.started") }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const progressMutation = useMutation({
    mutationFn: ({ id, progress, notes }: { id: number; progress: number; notes?: string }) =>
      apiFetch(`/api/changeover-tasks/${id}/progress`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ progress, notes }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["changeover-tasks"] }); setProgressCard(null); toast({ title: t("changeover.progressUpdated") }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/changeover-tasks/${id}/complete`, { method: "PATCH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["changeover-tasks"] }); toast({ title: t("changeover.completed") }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/changeover-tasks/${id}/cancel`, { method: "PATCH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["changeover-tasks"] }); toast({ title: t("changeover.cancelled") }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/changeover-tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["changeover-tasks"] }); toast({ title: t("common.deleted") }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    return tasks.filter((t: any) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterLine !== "all" && String(t.lineId) !== filterLine) return false;
      return true;
    }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [tasks, filterStatus, filterLine]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const t of tasks) {
      const key = t.date.split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [tasks]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(calYear, calMonth, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calYear, calMonth]);

  const todayStr = today.toISOString().split("T")[0];

  function handleCreate() {
    if (!form.lineId || !form.fromModel || !form.toModel || !form.assignedToId || !form.date) {
      toast({ title: t("changeover.fillRequired"), variant: "destructive" });
      return;
    }
    createMutation.mutate({ ...form, lineId: parseInt(form.lineId), assignedToId: parseInt(form.assignedToId) });
  }

  const statusLabel: Record<string, string> = {
    pending: t("changeover.statusPending"),
    in_progress: t("changeover.statusInProgress"),
    completed: t("changeover.statusCompleted"),
    cancelled: t("changeover.statusCancelled"),
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "hsl(0 0% 95%)", fontFamily: "'Chakra Petch', sans-serif", margin: 0 }}>
            {t("changeover.title")}
          </h1>
          <p style={{ fontSize: "13px", color: "hsl(222 16% 55%)", marginTop: "4px" }}>{t("changeover.subtitle")}</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreate(true)} style={{ background: "hsl(217 91% 50%)", color: "white", gap: "6px" }}>
            <Plus size={15} /> {t("changeover.create")}
          </Button>
        )}
      </div>

      {/* Filters + View Toggle */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger style={{ width: "160px", background: "hsl(222 16% 10%)", border: "1px solid hsl(222 16% 20%)", color: "hsl(0 0% 85%)" }}>
            <SelectValue placeholder={t("changeover.filterStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("changeover.allStatuses")}</SelectItem>
            <SelectItem value="pending">{t("changeover.statusPending")}</SelectItem>
            <SelectItem value="in_progress">{t("changeover.statusInProgress")}</SelectItem>
            <SelectItem value="completed">{t("changeover.statusCompleted")}</SelectItem>
            <SelectItem value="cancelled">{t("changeover.statusCancelled")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterLine} onValueChange={setFilterLine}>
          <SelectTrigger style={{ width: "180px", background: "hsl(222 16% 10%)", border: "1px solid hsl(222 16% 20%)", color: "hsl(0 0% 85%)" }}>
            <SelectValue placeholder={t("changeover.filterLine")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("changeover.allLines")}</SelectItem>
            {lines.map((l: any) => (
              <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View mode toggle */}
        <div style={{
          display: "flex", marginLeft: "auto",
          background: "hsl(222 16% 8%)", border: "1px solid hsl(222 16% 18%)",
          borderRadius: "8px", overflow: "hidden",
        }}>
          {(["list","cylinder","calendar"] as const).map((mode) => {
            const Icon = mode === "list" ? LayoutList : mode === "cylinder" ? LayoutGrid : CalendarDays;
            const label = mode === "list" ? "List" : mode === "cylinder" ? "Cylinders" : "Calendar";
            return (
              <button key={mode} onClick={() => setViewMode(mode)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "7px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer", border: "none",
                  background: viewMode === mode ? "hsl(217 91% 45%)" : "transparent",
                  color: viewMode === mode ? "white" : "hsl(222 16% 50%)",
                  transition: "all 0.15s",
                }}
              >
                <Icon size={14} /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
        {["pending", "in_progress", "completed"].map(s => {
          const count = tasks.filter((t: any) => t.status === s).length;
          return (
            <div key={s} style={{
              background: "hsl(222 16% 8%)", border: "1px solid hsl(222 16% 15%)", borderRadius: "8px",
              padding: "12px 20px", display: "flex", flexDirection: "column", gap: "2px",
            }}>
              <span style={{ fontSize: "22px", fontWeight: "700", color: statusColors[s], fontFamily: "'Chakra Petch', monospace" }}>{count}</span>
              <span style={{ fontSize: "11px", color: "hsl(222 16% 50%)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{statusLabel[s]}</span>
            </div>
          );
        })}
      </div>

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div style={{ borderRadius: "12px", border: "1px solid hsl(222 16% 15%)", background: "hsl(222 16% 6%)", overflow: "hidden" }}>
          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid hsl(222 16% 12%)" }}>
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); }}
              style={{ padding: "6px", borderRadius: "6px", background: "transparent", border: "none", cursor: "pointer", color: "hsl(222 16% 50%)" }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, color: "hsl(0 0% 88%)", fontSize: "15px" }}>
              {CAL_MONTHS[calMonth]} {calYear}
            </span>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); }}
              style={{ padding: "6px", borderRadius: "6px", background: "transparent", border: "none", cursor: "pointer", color: "hsl(222 16% 50%)" }}>
              <ChevronRight size={16} />
            </button>
          </div>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid hsl(222 16% 11%)" }}>
            {CAL_DAYS.map(d => (
              <div key={d} style={{ padding: "8px 0", textAlign: "center", fontSize: "10px", fontWeight: 700, color: "hsl(222 16% 40%)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{d}</div>
            ))}
          </div>
          {/* Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
            {calendarDays.map((date, idx) => {
              if (!date) return <div key={`e-${idx}`} style={{ minHeight: 90, borderRight: "1px solid hsl(222 16% 10%)", borderBottom: "1px solid hsl(222 16% 10%)", background: "hsl(222 16% 4%)" }} />;
              const ymd = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
              const dayTasks = tasksByDate[ymd] ?? [];
              const isToday = ymd === todayStr;
              const isSelected = ymd === calSelectedDay;
              return (
                <div key={ymd} onClick={() => setCalSelectedDay(isSelected ? null : ymd)}
                  style={{
                    minHeight: 90, borderRight: "1px solid hsl(222 16% 10%)", borderBottom: "1px solid hsl(222 16% 10%)",
                    padding: "6px", cursor: "pointer", transition: "background 0.15s",
                    background: isSelected ? "hsl(217 91% 45% / 0.12)" : isToday ? "hsl(222 16% 10%)" : "transparent",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{
                      width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: "50%", fontSize: "11px", fontWeight: 700,
                      background: isToday ? "hsl(217 91% 50%)" : "transparent",
                      color: isToday ? "white" : "hsl(222 16% 55%)",
                    }}>{date.getDate()}</span>
                    {dayTasks.length > 0 && <span style={{ fontSize: "9px", color: "hsl(222 16% 40%)" }}>{dayTasks.length}</span>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    {dayTasks.slice(0, 3).map((task: any) => (
                      <div key={task.id} style={{
                        fontSize: "9px", padding: "2px 5px", borderRadius: "4px", fontWeight: 600,
                        background: statusColors[task.status] + "22",
                        color: statusColors[task.status],
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {task.fromModel}→{task.toModel}
                      </div>
                    ))}
                    {dayTasks.length > 3 && <span style={{ fontSize: "9px", color: "hsl(222 16% 40%)" }}>+{dayTasks.length - 3} more</span>}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Selected day detail */}
          {calSelectedDay && (tasksByDate[calSelectedDay] ?? []).length > 0 && (
            <div style={{ borderTop: "1px solid hsl(222 16% 13%)", padding: "16px 20px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "hsl(217 91% 60%)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {calSelectedDay}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {(tasksByDate[calSelectedDay] ?? []).map((task: any) => (
                  <div key={task.id} style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    background: "hsl(222 16% 10%)", border: "1px solid hsl(222 16% 18%)", borderRadius: "8px", padding: "10px 14px",
                  }}>
                    <div style={{ flexShrink: 0 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: statusColors[task.status],
                      }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "hsl(0 0% 88%)", fontFamily: "'Chakra Petch', sans-serif" }}>
                        {task.fromModel} → {task.toModel}
                      </div>
                      <div style={{ fontSize: "11px", color: "hsl(222 16% 50%)", marginTop: "2px" }}>
                        🏭 {task.lineName} · 👤 {task.assignedToName}
                      </div>
                    </div>
                    <Badge style={{ background: statusColors[task.status]+"33", color: statusColors[task.status], border: `1px solid ${statusColors[task.status]}55`, fontSize: "9px" }}>
                      {statusLabel[task.status]}
                    </Badge>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "hsl(0 0% 70%)", fontFamily: "monospace" }}>
                      {task.progress}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cylinder Grid View */}
      {!isLoading && filtered.length > 0 && viewMode === "cylinder" && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "20px",
        }}>
          {filtered.map((task: any) => {
            const isMyTask = user?.id === task.assignedToId;
            const canAct = isMyTask || canManage;
            const clamp = Math.max(0, Math.min(100, task.progress));
            const color =
              task.status === "completed" ? "#22c55e"
              : task.status === "cancelled" ? "#6b7280"
              : clamp < 30 ? "#ef4444"
              : clamp < 70 ? "#f59e0b"
              : "#22c55e";

            return (
              <div key={task.id} style={{
                background: "hsl(222 16% 8%)",
                border: `1px solid ${task.status === "in_progress" ? "hsl(217 91% 30%)" : "hsl(222 16% 15%)"}`,
                borderRadius: "16px",
                padding: "20px 16px 16px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                transition: "border-color 0.2s, box-shadow 0.2s",
                boxShadow: task.status === "in_progress" ? `0 0 18px ${color}22` : "none",
              }}>
                {/* Large Cylinder */}
                <BigCylinderProgress progress={task.progress} status={task.status} taskId={task.id} />

                {/* Task Info */}
                <div style={{ width: "100%", textAlign: "center" }}>
                  <div style={{
                    fontSize: "13px", fontWeight: "700",
                    color: "hsl(0 0% 88%)",
                    fontFamily: "'Chakra Petch', sans-serif",
                    marginBottom: "4px",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {task.fromModel} → {task.toModel}
                  </div>
                  <Badge style={{
                    background: statusColors[task.status] + "33",
                    color: statusColors[task.status],
                    border: `1px solid ${statusColors[task.status]}55`,
                    fontSize: "9px", fontWeight: "600", letterSpacing: "0.05em",
                    marginBottom: "6px",
                  }}>
                    {statusLabel[task.status]}
                  </Badge>
                  <div style={{ fontSize: "11px", color: "hsl(222 16% 50%)", marginTop: "2px" }}>
                    🏭 {task.lineName}
                  </div>
                  <div style={{ fontSize: "11px", color: "hsl(217 91% 60%)", marginTop: "2px" }}>
                    👤 {task.assignedToName}
                  </div>
                  <div style={{ fontSize: "11px", color: "hsl(222 16% 45%)", marginTop: "2px" }}>
                    📅 {task.date}
                  </div>
                </div>

                {/* Quick Actions */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
                  {task.status === "pending" && canAct && (
                    <Button size="sm" onClick={() => startMutation.mutate(task.id)}
                      style={{ background: "hsl(217 91% 40%)", color: "white", gap: "4px", fontSize: "11px", padding: "4px 10px" }}>
                      <Play size={10} /> {t("changeover.start")}
                    </Button>
                  )}
                  {task.status === "in_progress" && canAct && (
                    <Button size="sm" onClick={() => completeMutation.mutate(task.id)}
                      style={{ background: "hsl(142 71% 30%)", color: "white", gap: "4px", fontSize: "11px", padding: "4px 10px" }}>
                      <CheckCircle size={10} /> {t("changeover.complete")}
                    </Button>
                  )}
                  {task.status !== "completed" && task.status !== "cancelled" && canManage && (
                    <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate(task.id)}
                      style={{ borderColor: "hsl(0 84% 30%)", color: "hsl(0 84% 60%)", fontSize: "11px", padding: "4px 8px" }}>
                      <XCircle size={10} />
                    </Button>
                  )}
                  {canManage && (
                    <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(task.id)}
                      style={{ borderColor: "hsl(222 16% 22%)", color: "hsl(222 16% 40%)", fontSize: "11px", padding: "4px 8px" }}>
                      <Trash2 size={10} />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List/Cards View */}
      {isLoading ? (
        <div style={{ textAlign: "center", color: "hsl(222 16% 45%)", padding: "60px" }}>{t("common.loading")}</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "hsl(222 16% 40%)", padding: "60px", border: "2px dashed hsl(222 16% 18%)", borderRadius: "12px" }}>
          <SlidersHorizontal size={40} style={{ marginBottom: "12px", opacity: 0.4 }} />
          <p style={{ margin: 0 }}>{t("changeover.noTasks")}</p>
        </div>
      ) : viewMode === "list" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filtered.map((task: any) => {
            const isExpanded = expandedId === task.id;
            const isMyTask = user?.id === task.assignedToId;
            const canAct = isMyTask || canManage;
            const isShowingProgress = progressCard === task.id;

            return (
              <div key={task.id} style={{
                background: "hsl(222 16% 8%)",
                border: `1px solid ${task.status === "in_progress" ? "hsl(217 91% 35%)" : "hsl(222 16% 15%)"}`,
                borderRadius: "12px",
                overflow: "hidden",
                transition: "border-color 0.2s",
              }}>
                <div style={{ display: "flex", gap: "0", alignItems: "stretch" }}>
                  {/* Cylinder column */}
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    padding: "20px 16px", background: "hsl(222 16% 6%)", borderRight: "1px solid hsl(222 16% 13%)",
                    minWidth: "88px",
                  }}>
                    <CylinderProgress progress={task.progress} status={task.status} />
                  </div>

                  {/* Main content */}
                  <div style={{ flex: 1, padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <span style={{
                            fontSize: "16px", fontWeight: "700", color: "hsl(0 0% 90%)",
                            fontFamily: "'Chakra Petch', sans-serif",
                          }}>
                            {task.fromModel} → {task.toModel}
                          </span>
                          <Badge style={{
                            background: statusColors[task.status] + "33",
                            color: statusColors[task.status],
                            border: `1px solid ${statusColors[task.status]}55`,
                            fontSize: "10px", fontWeight: "600", letterSpacing: "0.05em",
                          }}>
                            {statusLabel[task.status]}
                          </Badge>
                        </div>
                        <div style={{ display: "flex", gap: "16px", marginTop: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "12px", color: "hsl(222 16% 55%)" }}>
                            🏭 {task.lineName}
                          </span>
                          <span style={{ fontSize: "12px", color: "hsl(222 16% 55%)" }}>
                            📅 {task.date}
                          </span>
                          {task.scheduledStart && (
                            <span style={{ fontSize: "12px", color: "hsl(222 16% 55%)" }}>
                              🕐 {task.scheduledStart}{task.scheduledEnd ? ` – ${task.scheduledEnd}` : ""}
                            </span>
                          )}
                        </div>
                        <div style={{ marginTop: "6px" }}>
                          <span style={{ fontSize: "12px", color: "hsl(217 91% 60%)" }}>
                            👤 {task.assignedToName}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                        {task.status === "pending" && canAct && (
                          <Button size="sm" onClick={() => startMutation.mutate(task.id)}
                            style={{ background: "hsl(217 91% 40%)", color: "white", gap: "5px", fontSize: "12px" }}>
                            <Play size={12} /> {t("changeover.start")}
                          </Button>
                        )}
                        {task.status === "in_progress" && canAct && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => {
                              setProgressCard(isShowingProgress ? null : task.id);
                              setProgressValue(task.progress);
                              setProgressNotes(task.notes ?? "");
                            }}
                              style={{ borderColor: "hsl(222 16% 25%)", color: "hsl(0 0% 80%)", fontSize: "12px", gap: "5px" }}>
                              <SlidersHorizontal size={12} /> {t("changeover.updateProgress")}
                            </Button>
                            <Button size="sm" onClick={() => completeMutation.mutate(task.id)}
                              style={{ background: "hsl(142 71% 30%)", color: "white", gap: "5px", fontSize: "12px" }}>
                              <CheckCircle size={12} /> {t("changeover.complete")}
                            </Button>
                          </>
                        )}
                        {task.status !== "completed" && task.status !== "cancelled" && canManage && (
                          <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate(task.id)}
                            style={{ borderColor: "hsl(0 84% 30%)", color: "hsl(0 84% 60%)", fontSize: "12px", gap: "5px" }}>
                            <XCircle size={12} /> {t("changeover.cancel")}
                          </Button>
                        )}
                        {canManage && (
                          <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(task.id)}
                            style={{ borderColor: "hsl(222 16% 22%)", color: "hsl(222 16% 45%)", padding: "0 8px" }}>
                            <Trash2 size={12} />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setExpandedId(isExpanded ? null : task.id)}
                          style={{ color: "hsl(222 16% 45%)", padding: "0 6px" }}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </Button>
                      </div>
                    </div>

                    {/* Inline progress updater */}
                    {isShowingProgress && (
                      <div style={{
                        marginTop: "14px", background: "hsl(222 16% 11%)", borderRadius: "8px",
                        padding: "16px", border: "1px solid hsl(222 16% 18%)",
                      }}>
                        <Label style={{ fontSize: "12px", color: "hsl(222 16% 55%)", marginBottom: "10px", display: "block" }}>
                          {t("changeover.progress")}: {progressValue}%
                        </Label>
                        <Slider
                          min={0} max={100} step={5}
                          value={[progressValue]}
                          onValueChange={([v]) => setProgressValue(v)}
                          style={{ marginBottom: "12px" }}
                        />
                        <Textarea
                          value={progressNotes}
                          onChange={(e: any) => setProgressNotes(e.target.value)}
                          placeholder={t("changeover.notesPlaceholder")}
                          rows={2}
                          style={{ background: "hsl(222 16% 8%)", border: "1px solid hsl(222 16% 20%)", color: "hsl(0 0% 85%)", fontSize: "13px", marginBottom: "10px" }}
                        />
                        <div style={{ display: "flex", gap: "8px" }}>
                          <Button size="sm" onClick={() => progressMutation.mutate({ id: task.id, progress: progressValue, notes: progressNotes })}
                            style={{ background: "hsl(217 91% 45%)", color: "white" }}>
                            {t("common.save")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setProgressCard(null)}
                            style={{ borderColor: "hsl(222 16% 22%)", color: "hsl(222 16% 50%)" }}>
                            {t("common.cancel")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{
                    borderTop: "1px solid hsl(222 16% 13%)",
                    padding: "16px 20px",
                    background: "hsl(222 16% 6%)",
                    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px",
                  }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "hsl(222 16% 45%)", textTransform: "uppercase", marginBottom: "4px" }}>{t("changeover.createdBy")}</div>
                      <div style={{ fontSize: "13px", color: "hsl(0 0% 80%)" }}>{task.createdByName}</div>
                    </div>
                    {task.actualStart && (
                      <div>
                        <div style={{ fontSize: "11px", color: "hsl(222 16% 45%)", textTransform: "uppercase", marginBottom: "4px" }}>{t("changeover.actualStart")}</div>
                        <div style={{ fontSize: "13px", color: "hsl(0 0% 80%)" }}>{new Date(task.actualStart).toLocaleString()}</div>
                      </div>
                    )}
                    {task.actualEnd && (
                      <div>
                        <div style={{ fontSize: "11px", color: "hsl(222 16% 45%)", textTransform: "uppercase", marginBottom: "4px" }}>{t("changeover.actualEnd")}</div>
                        <div style={{ fontSize: "13px", color: "hsl(0 0% 80%)" }}>{new Date(task.actualEnd).toLocaleString()}</div>
                      </div>
                    )}
                    {task.notes && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={{ fontSize: "11px", color: "hsl(222 16% 45%)", textTransform: "uppercase", marginBottom: "4px" }}>{t("changeover.notes")}</div>
                        <div style={{ fontSize: "13px", color: "hsl(0 0% 75%)", whiteSpace: "pre-wrap", lineHeight: "1.5" }}>{task.notes}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent style={{ background: "hsl(222 16% 8%)", border: "1px solid hsl(222 16% 18%)", maxWidth: "520px" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "hsl(0 0% 90%)", fontFamily: "'Chakra Petch', sans-serif" }}>{t("changeover.createTitle")}</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "8px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label={t("changeover.date")}>
                <Input type="date" value={form.date} onChange={(e: any) => setForm(f => ({ ...f, date: e.target.value }))}
                  style={{ background: "hsl(222 16% 11%)", border: "1px solid hsl(222 16% 22%)", color: "hsl(0 0% 85%)" }} />
              </Field>
              <Field label={t("changeover.line")}>
                <Select value={form.lineId} onValueChange={v => setForm(f => ({ ...f, lineId: v }))}>
                  <SelectTrigger style={{ background: "hsl(222 16% 11%)", border: "1px solid hsl(222 16% 22%)", color: "hsl(0 0% 85%)" }}>
                    <SelectValue placeholder={t("changeover.selectLine")} />
                  </SelectTrigger>
                  <SelectContent>
                    {lines.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label={t("changeover.fromModel")}>
                <Input value={form.fromModel} onChange={(e: any) => setForm(f => ({ ...f, fromModel: e.target.value }))}
                  placeholder="e.g. A57s" style={{ background: "hsl(222 16% 11%)", border: "1px solid hsl(222 16% 22%)", color: "hsl(0 0% 85%)" }} />
              </Field>
              <Field label={t("changeover.toModel")}>
                <Input value={form.toModel} onChange={(e: any) => setForm(f => ({ ...f, toModel: e.target.value }))}
                  placeholder="e.g. Reno12" style={{ background: "hsl(222 16% 11%)", border: "1px solid hsl(222 16% 22%)", color: "hsl(0 0% 85%)" }} />
              </Field>
            </div>
            <Field label={t("changeover.assignTo")}>
              <Select value={form.assignedToId} onValueChange={v => setForm(f => ({ ...f, assignedToId: v }))}>
                <SelectTrigger style={{ background: "hsl(222 16% 11%)", border: "1px solid hsl(222 16% 22%)", color: "hsl(0 0% 85%)" }}>
                  <SelectValue placeholder={t("changeover.selectTeamLeader")} />
                </SelectTrigger>
                <SelectContent>
                  {teamLeaders.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label={t("changeover.scheduledStart")}>
                <Input type="time" value={form.scheduledStart} onChange={(e: any) => setForm(f => ({ ...f, scheduledStart: e.target.value }))}
                  style={{ background: "hsl(222 16% 11%)", border: "1px solid hsl(222 16% 22%)", color: "hsl(0 0% 85%)" }} />
              </Field>
              <Field label={t("changeover.scheduledEnd")}>
                <Input type="time" value={form.scheduledEnd} onChange={(e: any) => setForm(f => ({ ...f, scheduledEnd: e.target.value }))}
                  style={{ background: "hsl(222 16% 11%)", border: "1px solid hsl(222 16% 22%)", color: "hsl(0 0% 85%)" }} />
              </Field>
            </div>
            <Field label={t("changeover.notes")}>
              <Textarea value={form.notes} onChange={(e: any) => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={t("changeover.notesPlaceholder")} rows={3}
                style={{ background: "hsl(222 16% 11%)", border: "1px solid hsl(222 16% 22%)", color: "hsl(0 0% 85%)", fontSize: "13px" }} />
            </Field>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <Button variant="outline" onClick={() => setShowCreate(false)}
                style={{ borderColor: "hsl(222 16% 22%)", color: "hsl(222 16% 55%)" }}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}
                style={{ background: "hsl(217 91% 45%)", color: "white" }}>
                {t("changeover.createBtn")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
