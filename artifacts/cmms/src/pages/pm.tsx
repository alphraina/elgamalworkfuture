import { useState, useMemo } from "react";
import {
  useGetPreventiveMaintenancePlans,
  useCreatePreventiveMaintenancePlan,
  useUpdatePMPlan,
  useGetUsers,
  type CreatePMPlanRequestFrequency,
} from "@workspace/api-client-react";
import { Button, Input, Select, Modal, Label, Badge } from "@/components/ui";
import { CalendarClock, ChevronLeft, ChevronRight, Users, X, LayoutGrid, CalendarDays, RefreshCw, CheckCircle2 } from "lucide-react";
import { CylinderProgress } from "@/components/cylinder-progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";

const TEAM_COLORS: Record<string, string> = {
  assembly: "bg-blue-400/10 text-blue-400 border-blue-400/30",
  test: "bg-amber-400/10 text-amber-400 border-amber-400/30",
  packaging: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
};

const STATUS_PILL: Record<string, string> = {
  active: "bg-primary/20 text-primary border-primary/30",
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  overdue: "bg-red-500/20 text-red-400 border-red-500/30",
  paused: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

function TeamBadge({ team }: { team: string | null | undefined }) {
  if (!team) return null;
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase ${TEAM_COLORS[team] ?? "bg-muted text-muted-foreground border-muted"}`}>
      {team}
    </span>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function toYMD(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function advanceDateFE(d: Date, frequency: string): Date {
  const next = new Date(d);
  switch (frequency) {
    case "daily":   next.setDate(next.getDate() + 1); break;
    case "weekly":  next.setDate(next.getDate() + 7); break;
    case "monthly": next.setMonth(next.getMonth() + 1); break;
    case "quarterly": next.setMonth(next.getMonth() + 3); break;
  }
  return next;
}

export default function PM() {
  const { t } = useTranslation();
  const { data: plans, isLoading } = useGetPreventiveMaintenancePlans();
  const { data: allUsers } = useGetUsers();
  const createMutation = useCreatePreventiveMaintenancePlan();
  const updateMutation = useUpdatePMPlan();
  const { toast } = useToast();
  const { isMaintenance, isAdmin, isManager, isTeamLeader, user } = useAuth();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [assignedUserId, setAssignedUserId] = useState<string>("");
  const [userSearch, setUserSearch] = useState("");
  const [viewMode, setViewMode] = useState<"calendar" | "cylinder">("calendar");
  const [completingId, setCompletingId] = useState<number | null>(null);

  const isStrictTeamLeader = isTeamLeader && !isManager && !isAdmin;

  const TEAMS = [
    { value: "assembly", label: t("teams.assembly") },
    { value: "test", label: t("teams.test") },
    { value: "packaging", label: t("teams.packaging") },
  ] as const;

  const handleMarkDone = async (planId: number) => {
    setCompletingId(planId);
    try {
      await updateMutation.mutateAsync({ id: planId, data: { status: "completed" } as any });
      toast({ title: "Task marked complete — next occurrence scheduled automatically" });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setCompletingId(null);
    }
  };

  const handleClose = () => {
    setIsAddOpen(false);
    setAssignedUserId("");
    setUserSearch("");
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createMutation.mutateAsync({
        data: {
          title: fd.get("title") as string,
          machineName: fd.get("machineName") as string,
          frequency: fd.get("frequency") as CreatePMPlanRequestFrequency,
          nextDueDate: fd.get("nextDueDate") as string,
          assignedToId: assignedUserId ? Number(assignedUserId) : undefined,
        } as any,
      });
      handleClose();
      toast({ title: t("common.success") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  };

  const filteredPlans = useMemo(() => {
    return (plans ?? []).filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (teamFilter && (p as any).assignedToTeam !== teamFilter) return false;
      return true;
    });
  }, [plans, statusFilter, teamFilter]);

  const plansByDate = useMemo(() => {
    const map: Record<string, typeof filteredPlans> = {};
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const lastOfMonth = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59);

    for (const p of filteredPlans) {
      const anchor = new Date(p.nextDueDate);

      // If the next occurrence is past this month, skip — no instances to show
      if (anchor > lastOfMonth) continue;

      // If anchor is before this month, fast-forward to find first occurrence in this month
      let current = new Date(anchor);
      if (current < firstOfMonth) {
        // Daily: calculate jump in one step
        if (p.frequency === "daily") {
          const daysNeeded = Math.floor((firstOfMonth.getTime() - current.getTime()) / 86400000);
          current = new Date(current);
          current.setDate(current.getDate() + daysNeeded);
        } else {
          // Weekly/monthly/quarterly: step forward until we reach this month
          let safety = 0;
          while (current < firstOfMonth && safety++ < 500) {
            current = advanceDateFE(current, p.frequency);
          }
        }
      }

      // Add all occurrences within this month
      let safety = 0;
      while (current <= lastOfMonth && safety++ < 100) {
        const key = toYMD(current);
        if (!map[key]) map[key] = [];
        // Avoid duplicates (same plan on same day)
        if (!map[key].find(x => x.id === p.id)) map[key].push(p);
        current = advanceDateFE(current, p.frequency);
      }
    }
    return map;
  }, [filteredPlans, viewYear, viewMonth]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const todayStr = toYMD(today);
  const selectedDayPlans = selectedDay ? (plansByDate[selectedDay] ?? []) : [];

  const filteredUsers = (allUsers ?? []).filter(u => {
    const matchSearch = u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase());
    if (isStrictTeamLeader && user?.team) return matchSearch && (u as any).team === user.team;
    return matchSearch;
  });
  const selectedUser = (allUsers ?? []).find(u => u.id === Number(assignedUserId));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">{t("pm.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">Recurring maintenance schedule — daily, weekly, monthly, quarterly</p>
        </div>
        {!isMaintenance && (
          <Button onClick={() => setIsAddOpen(true)} className="gap-2 tech-border">
            <CalendarClock className="w-4 h-4" /> {t("pm.addTask")}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Team pills */}
        {(isAdmin || isManager || isTeamLeader) && (
          <>
            <button
              onClick={() => setTeamFilter("")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${!teamFilter ? "bg-primary text-white border-primary" : "border-white/10 text-muted-foreground hover:text-white"}`}
            >
              {t("teams.allTeams")}
            </button>
            {TEAMS.map(team => (
              <button
                key={team.value}
                onClick={() => setTeamFilter(teamFilter === team.value ? "" : team.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${teamFilter === team.value ? `${TEAM_COLORS[team.value]} border-current` : "border-white/10 text-muted-foreground hover:text-white"}`}
              >
                {team.label}
              </button>
            ))}
            <span className="w-px h-5 bg-white/10 mx-1" />
          </>
        )}
        {/* Status pills */}
        {[
          { value: "", label: "All" },
          { value: "active", label: t("pm.status_scheduled") },
          { value: "overdue", label: t("pm.status_overdue") },
          { value: "completed", label: t("pm.status_done") },
          { value: "paused", label: t("pm.status_skipped") },
        ].map(s => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${statusFilter === s.value ? "bg-white/10 text-white border-white/20" : "border-white/10 text-muted-foreground hover:text-white"}`}
          >
            {s.label}
          </button>
        ))}
        {/* View toggle */}
        <div style={{ marginLeft: "auto", display: "flex", background: "hsl(222 16% 8%)", border: "1px solid hsl(222 16% 18%)", borderRadius: "8px", overflow: "hidden" }}>
          {(["calendar","cylinder"] as const).map((mode) => {
            const Icon = mode === "calendar" ? CalendarDays : LayoutGrid;
            const label = mode === "calendar" ? "Calendar" : "Cylinders";
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

      {/* Cylinder View */}
      {viewMode === "cylinder" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
          {isLoading ? (
            <div style={{ color: "hsl(222 16% 50%)", padding: "32px" }}>Loading…</div>
          ) : (filteredPlans ?? []).length === 0 ? (
            <div style={{ color: "hsl(222 16% 50%)", padding: "32px" }}>No PM plans found.</div>
          ) : (filteredPlans ?? []).map((plan: any) => {
            const progress = plan.status === "completed" ? 100 : plan.status === "active" ? 50 : plan.status === "paused" ? 30 : 15;
            return (
              <div key={plan.id} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
                background: "hsl(222 16% 7%)", border: "1px solid hsl(222 16% 15%)", borderRadius: "12px",
                padding: "18px 14px", minWidth: "120px", maxWidth: "140px",
              }}>
                <CylinderProgress progress={progress} status={plan.status} id={`pm-${plan.id}`} size="lg" />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "hsl(0 0% 85%)", lineHeight: 1.3, marginBottom: "3px" }}>{plan.title}</div>
                  <div style={{ fontSize: "10px", color: "hsl(222 16% 45%)" }}>{plan.machineName}</div>
                  <div style={{ marginTop: "6px" }}>
                    <span style={{
                      fontSize: "9px", padding: "2px 7px", borderRadius: "10px", fontWeight: 700, textTransform: "uppercase",
                      background: plan.status === "completed" ? "#16a34a33" : plan.status === "active" ? "#2563eb33" : plan.status === "paused" ? "#d9770633" : "#dc262633",
                      color: plan.status === "completed" ? "#4ade80" : plan.status === "active" ? "#60a5fa" : plan.status === "paused" ? "#fb923c" : "#f87171",
                    }}>{plan.status}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar card */}
      {viewMode === "calendar" && <div className="rounded-xl border border-white/10 bg-card overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h3 className="font-semibold text-white text-lg tracking-wide">
            {MONTHS[viewMonth]} {viewYear}
          </h3>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-white/10">
          {DAYS.map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">{t("common.loading")}</div>
        ) : (
          <div className="grid grid-cols-7">
            {calendarDays.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} className="min-h-[100px] border-r border-b border-white/5 bg-black/10" />;
              const ymd = toYMD(date);
              const dayPlans = plansByDate[ymd] ?? [];
              const isToday = ymd === todayStr;
              const isPast = ymd < todayStr;
              const isSelected = ymd === selectedDay;

              return (
                <div
                  key={ymd}
                  onClick={() => setSelectedDay(isSelected ? null : ymd)}
                  className={`min-h-[100px] border-r border-b border-white/5 p-1.5 transition-colors cursor-pointer
                    ${isSelected ? "bg-primary/10 border-primary/30" : "hover:bg-white/5"}
                    ${isPast && !isToday ? "opacity-60" : ""}
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                      ${isToday ? "bg-primary text-white" : "text-muted-foreground"}
                    `}>
                      {date.getDate()}
                    </span>
                    {dayPlans.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">{dayPlans.length}</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayPlans.slice(0, 3).map(p => (
                      <div
                        key={p.id}
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded truncate border ${STATUS_PILL[p.status] ?? STATUS_PILL.active}`}
                        title={`${p.title} — ${p.machineName}`}
                      >
                        {p.title}
                      </div>
                    ))}
                    {dayPlans.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">+{dayPlans.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>}

      {/* Selected day detail panel */}
      {viewMode === "calendar" && selectedDay && (
        <div className="rounded-xl border border-white/10 bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-white">
              {new Date(selectedDay + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </h4>
            <button onClick={() => setSelectedDay(null)} className="text-muted-foreground hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {selectedDayPlans.length === 0 ? (
            <p className="text-muted-foreground text-sm">No PM tasks scheduled for this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedDayPlans.map(p => {
                const canComplete =
                  (isAdmin || isManager || isTeamLeader || (isMaintenance && p.assignedToId === user?.id)) &&
                  p.status !== "paused";
                const isNextDueDay = p.nextDueDate.split("T")[0] === selectedDay;
                return (
                  <div key={p.id} className="bg-white/5 rounded-lg px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white truncate">{p.title}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] border border-white/15 text-muted-foreground px-1.5 py-0.5 rounded uppercase">
                            <RefreshCw className="w-2.5 h-2.5" />
                            {p.frequency}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.machineName}</p>
                        {(p as any).assignedToName && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5">
                              {(p as any).assignedToName}
                            </span>
                            <TeamBadge team={(p as any).assignedToTeam} />
                          </div>
                        )}
                        {(p as any).lastCompletedDate && (
                          <p className="text-[11px] text-emerald-400/70 mt-1">
                            Last done: {new Date((p as any).lastCompletedDate).toLocaleDateString()}
                          </p>
                        )}
                        {!isNextDueDay && (
                          <p className="text-[11px] text-primary/60 mt-0.5">
                            Next due: {new Date(p.nextDueDate + "").toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={p.status === "completed" ? "success" : p.status === "overdue" ? "destructive" : "primary"}
                        className="uppercase text-[10px] shrink-0"
                      >
                        {p.status}
                      </Badge>
                    </div>
                    {canComplete && isNextDueDay && (
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 border border-emerald-400/20 h-7 text-xs"
                          disabled={completingId === p.id}
                          onClick={() => handleMarkDone(p.id)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {completingId === p.id ? "Saving…" : "Mark Done"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Task Modal */}
      {!isMaintenance && (
        <Modal isOpen={isAddOpen} onClose={handleClose} title={t("pm.addTask")}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.name")}</Label>
              <Input name="title" required placeholder="e.g. Monthly SMT Calibration" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("pm.machine")}</Label>
                <Input name="machineName" required placeholder="e.g. SMT-01" />
              </div>
              <div className="space-y-2">
                <Label>{t("pm.frequency")}</Label>
                <Select name="frequency" required defaultValue="monthly">
                  <option value="daily">{t("common.day")}</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                {t("pm.nextDue")}
                <span className="text-muted-foreground font-normal ms-1 text-xs">(first occurrence — repeats automatically)</span>
              </Label>
              <Input type="date" name="nextDueDate" required />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                {t("pm.assignee")}
                {selectedUser && (
                  <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                    {selectedUser.fullName}
                  </span>
                )}
              </Label>
              <Input
                placeholder={t("common.search")}
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
              <div className="max-h-44 overflow-y-auto custom-scrollbar border border-white/10 rounded-lg divide-y divide-white/5">
                <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors">
                  <input type="radio" name="assignedUserId" className="accent-primary" checked={assignedUserId === ""} onChange={() => setAssignedUserId("")} />
                  <span className="text-sm text-muted-foreground italic">—</span>
                </label>
                {filteredUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">{t("common.noData")}</p>
                ) : (
                  filteredUsers.map(u => (
                    <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors">
                      <input type="radio" name="assignedUserId" className="accent-primary" checked={assignedUserId === String(u.id)} onChange={() => setAssignedUserId(String(u.id))} />
                      <span className="text-sm text-white">{u.fullName}</span>
                      {(u as any).team && <TeamBadge team={(u as any).team} />}
                      <span className="text-xs text-muted-foreground ms-auto">{u.username}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-white/10 mt-4">
              <Button type="button" variant="ghost" onClick={handleClose}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={createMutation.isPending}>{t("common.save")}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
