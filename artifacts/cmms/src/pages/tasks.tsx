import { useState, useEffect } from "react";
import { useGetTasks, useCreateTask, useUpdateTask, type CreateTaskRequestPriority, type CreateTaskRequestType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Select, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Modal, Label } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { CheckSquare, CheckCircle2, LayoutGrid, LayoutList, Pencil } from "lucide-react";
import { CylinderProgress } from "@/components/cylinder-progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { FilterBar, matchesDateFilter, matchesSearch, type FilterState } from "@/components/filter-bar";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const TEAMS = ["assembly", "test", "packaging"] as const;
const TEAM_COLORS: Record<string, string> = {
  assembly: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  test:     "text-amber-400 border-amber-400/30 bg-amber-400/10",
  packaging:"text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
};

interface AugUser { id: number; fullName: string; team?: string | null; role?: string }

export default function Tasks() {
  const { t } = useTranslation();
  const { data: tasks, isLoading } = useGetTasks();
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const { toast } = useToast();
  const { user, isMaintenance, isTeamLeader, isManager, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const isStrictTeamLeader = isTeamLeader && !isManager && !isAdmin;
  const canEdit = isAdmin || isManager || isTeamLeader;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<AugUser[]>([]);
  const [assignedToId, setAssignedToId] = useState("");
  const [formTeam, setFormTeam] = useState("");
  const [completingTask, setCompletingTask] = useState<{ id: number; title: string } | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [completeBusy, setCompleteBusy] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ date: "", shift: "", search: "", status: "" });
  const [teamFilter, setTeamFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "cylinder">("list");

  // Edit state
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editAssignedToId, setEditAssignedToId] = useState("");
  const [editFormTeam, setEditFormTeam] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const handleEditOpen = (tk: any) => {
    setEditTarget(tk);
    setEditAssignedToId(tk.assignedToId ? String(tk.assignedToId) : "");
    setEditFormTeam((tk as any).assignedToTeam ?? "");
  };
  const handleEditClose = () => { setEditTarget(null); setEditAssignedToId(""); setEditFormTeam(""); };

  const handleEditSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await updateMutation.mutateAsync({
        id: editTarget.id,
        data: {
          title: fd.get("title") as string,
          description: fd.get("description") as string || undefined,
          priority: fd.get("priority") as CreateTaskRequestPriority,
          type: fd.get("type") as CreateTaskRequestType,
          dueDate: fd.get("dueDate") as string || undefined,
          status: fd.get("status") as string,
          assignedToId: editAssignedToId ? Number(editAssignedToId) : undefined,
        } as any,
      });
      toast({ title: t("common.success") });
      handleEditClose();
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setEditBusy(false);
    }
  };

  const editFilteredUsers = isStrictTeamLeader
    ? allUsers.filter(u => !user?.team || u.team === user.team)
    : editFormTeam
      ? allUsers.filter(u => u.team === editFormTeam)
      : allUsers;

  useEffect(() => {
    fetch(`${BASE}/api/users`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setAllUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // For team leaders, only show their team's members in the dropdown
  const assignableUsers = isStrictTeamLeader
    ? allUsers.filter(u => !user?.team || u.team === user.team)
    : allUsers;

  // Inside the create form, admin/manager can filter by team first
  const formFilteredUsers = isStrictTeamLeader
    ? assignableUsers
    : formTeam
      ? assignableUsers.filter(u => u.team === formTeam)
      : assignableUsers;

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createMutation.mutateAsync({
        data: {
          title: fd.get("title") as string,
          description: fd.get("description") as string,
          assignedToId: Number(assignedToId),
          priority: fd.get("priority") as CreateTaskRequestPriority,
          type: fd.get("type") as CreateTaskRequestType,
          dueDate: fd.get("dueDate") as string,
        }
      });
      setIsAddOpen(false);
      setAssignedToId("");
      setFormTeam("");
      toast({ title: t("common.success") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  };

  const openCompleteModal = (tk: { id: number; title: string }) => {
    setCompletingTask(tk);
    setCompletionNote("");
  };

  const handleComplete = async () => {
    if (!completingTask) return;
    setCompleteBusy(true);
    try {
      const res = await fetch(`${BASE}/api/tasks/${completingTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "completed", completionNote }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to complete task");
      }
      await queryClient.invalidateQueries({ queryKey: ["getTasks"] });
      setCompletingTask(null);
      toast({ title: t("tasks.markComplete") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setCompleteBusy(false);
    }
  };

  const priorityColors: Record<string, any> = { low: 'outline', medium: 'secondary', high: 'warning', urgent: 'destructive' };

  const filtered = (tasks ?? []).filter((tk) => {
    if (!matchesDateFilter(tk.dueDate ?? undefined, filters.date)) return false;
    if (filters.status && tk.status !== filters.status) return false;
    if (teamFilter && (tk as any).assignedToTeam !== teamFilter) return false;
    return matchesSearch([tk.title, tk.description, (tk as any).assignedToName], filters.search);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">{t("tasks.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {isMaintenance ? t("tasks.myTasks") : t("tasks.allTasks")}
          </p>
        </div>
        {!isMaintenance && (
          <Button onClick={() => setIsAddOpen(true)} className="gap-2 tech-border">
            <CheckSquare className="w-4 h-4" /> {t("tasks.addTask")}
          </Button>
        )}
      </div>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        showShift={false}
        showSearch
        statusOptions={[
          { value: "pending", label: t("tasks.status_pending") },
          { value: "in_progress", label: t("tasks.status_in_progress") },
          { value: "completed", label: t("tasks.status_completed") },
          { value: "cancelled", label: t("tasks.status_cancelled") },
        ]}
      />

      {/* Team filter + view toggle row */}
      <div className="flex gap-2 flex-wrap items-center">
        {!isStrictTeamLeader && !isMaintenance && (
          <>
            <button
              onClick={() => setTeamFilter("")}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${!teamFilter ? "border-primary text-primary bg-primary/10" : "border-white/10 text-muted-foreground hover:border-white/20"}`}
            >
              {t("teams.allTeams")}
            </button>
            {TEAMS.map(team => (
              <button
                key={team}
                onClick={() => setTeamFilter(teamFilter === team ? "" : team)}
                className={`text-xs px-3 py-1.5 rounded border transition-colors capitalize ${teamFilter === team ? `${TEAM_COLORS[team]} border-current` : "border-white/10 text-muted-foreground hover:border-white/20"}`}
              >
                {t(`teams.${team}`)}
              </button>
            ))}
          </>
        )}
        {/* View toggle */}
        <div style={{ marginLeft: "auto", display: "flex", background: "hsl(222 16% 8%)", border: "1px solid hsl(222 16% 18%)", borderRadius: "8px", overflow: "hidden" }}>
          {(["list","cylinder"] as const).map((mode) => {
            const Icon = mode === "list" ? LayoutList : LayoutGrid;
            const label = mode === "list" ? "List" : "Cylinders";
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
          ) : filtered.length === 0 ? (
            <div style={{ color: "hsl(222 16% 50%)", padding: "32px" }}>No tasks found.</div>
          ) : filtered.map((task: any) => {
            const progress = task.status === "completed" ? 100 : task.status === "in_progress" ? 50 : task.status === "pending" ? 10 : 0;
            const color = task.status === "completed" ? "#4ade80" : task.status === "in_progress" ? "#60a5fa" : task.status === "pending" ? "#fb923c" : "#6b7280";
            const bg = task.status === "completed" ? "#16a34a33" : task.status === "in_progress" ? "#2563eb33" : task.status === "pending" ? "#d9770633" : "#6b728033";
            return (
              <div key={task.id} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
                background: "hsl(222 16% 7%)", border: "1px solid hsl(222 16% 15%)", borderRadius: "12px",
                padding: "18px 14px", minWidth: "120px", maxWidth: "140px",
              }}>
                <CylinderProgress progress={progress} status={task.status} id={`task-${task.id}`} size="lg" />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "hsl(0 0% 85%)", lineHeight: 1.3, marginBottom: "3px" }}>{task.title}</div>
                  {task.assignedToName && <div style={{ fontSize: "10px", color: "hsl(222 16% 45%)" }}>{task.assignedToName}</div>}
                  <div style={{ marginTop: "6px" }}>
                    <span style={{ fontSize: "9px", padding: "2px 7px", borderRadius: "10px", fontWeight: 700, textTransform: "uppercase", background: bg, color }}>{task.status.replace("_"," ")}</span>
                  </div>
                  {canEdit && (
                    <button onClick={() => handleEditOpen(task)} style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "hsl(222 16% 55%)", background: "hsl(222 16% 12%)", border: "1px solid hsl(222 16% 20%)", borderRadius: "6px", padding: "3px 8px", cursor: "pointer" }}>
                      <Pencil size={10} /> {t("common.edit")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "list" && <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tasks.taskTitle")}</TableHead>
                <TableHead>{t("common.type")}</TableHead>
                <TableHead>{t("tasks.priority")}</TableHead>
                {!isMaintenance && <TableHead>{t("tasks.assignedTo")}</TableHead>}
                {!isMaintenance && <TableHead>{t("teams.label")}</TableHead>}
                <TableHead>{t("tasks.dueDate")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("tasks.noTasks")}</TableCell></TableRow>
              ) : (
                filtered.map(tk => {
                  const isAssignee = user?.id === tk.assignedToId;
                  const canComplete = isAssignee && tk.status !== "completed" && tk.status !== "cancelled";
                  const tkTeam = (tk as any).assignedToTeam as string | null;
                  return (
                    <TableRow key={tk.id}>
                      <TableCell>
                        <div className="font-semibold text-white">{tk.title}</div>
                        {tk.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{tk.description}</div>
                        )}
                        {(tk as any).completionNote && (
                          <div className="text-xs text-emerald-400/80 mt-0.5 truncate max-w-[200px]">
                            {(tk as any).completionNote}
                          </div>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="uppercase text-[10px]">{tk.type}</Badge></TableCell>
                      <TableCell><Badge variant={priorityColors[tk.priority] || 'default'} className="uppercase text-[10px]">{tk.priority}</Badge></TableCell>
                      {!isMaintenance && <TableCell className="text-sm">{tk.assignedToName || `User #${tk.assignedToId}`}</TableCell>}
                      {!isMaintenance && (
                        <TableCell>
                          {tkTeam ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${TEAM_COLORS[tkTeam] ?? "text-muted-foreground border-white/10"}`}>
                              {t(`teams.${tkTeam}`)}
                            </span>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                      )}
                      <TableCell className="text-xs text-muted-foreground">{tk.dueDate ? formatDate(tk.dueDate).split(',')[0] : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={tk.status === 'completed' ? 'success' : tk.status === 'in_progress' ? 'primary' : 'secondary'} className="uppercase text-[10px]">
                          {tk.status.replace('_', ' ')}
                        </Badge>
                        {tk.status === 'completed' && tk.completedAt && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">{formatDate(tk.completedAt).split(',')[0]}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-white hover:bg-white/10 border border-white/10" onClick={() => handleEditOpen(tk)}>
                              <Pencil className="w-3.5 h-3.5" />{t("common.edit")}
                            </Button>
                          )}
                          {canComplete && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 gap-1" onClick={() => openCompleteModal({ id: tk.id, title: tk.title })}>
                              <CheckCircle2 className="w-3.5 h-3.5" />{t("tasks.markComplete")}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>}

      {/* Edit Task Modal */}
      {editTarget && (
        <Modal isOpen onClose={handleEditClose} title={`${t("common.edit")} — ${editTarget.title}`}>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("tasks.taskTitle")}</Label>
              <Input name="title" required defaultValue={editTarget.title} />
            </div>
            <div className="space-y-2">
              <Label>{t("tasks.description")}</Label>
              <Input name="description" defaultValue={editTarget.description ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("common.type")}</Label>
                <Select name="type" defaultValue={editTarget.type}>
                  <option value="maintenance">Maintenance</option>
                  <option value="inspection">Inspection</option>
                  <option value="repair">Repair</option>
                  <option value="general">General</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("tasks.priority")}</Label>
                <Select name="priority" defaultValue={editTarget.priority}>
                  <option value="low">{t("tasks.priority_low")}</option>
                  <option value="medium">{t("tasks.priority_medium")}</option>
                  <option value="high">{t("tasks.priority_high")}</option>
                  <option value="urgent">{t("tasks.priority_critical")}</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("common.status")}</Label>
                <Select name="status" defaultValue={editTarget.status}>
                  <option value="pending">{t("tasks.status_pending")}</option>
                  <option value="in_progress">{t("tasks.status_in_progress")}</option>
                  <option value="completed">{t("tasks.status_completed")}</option>
                  <option value="cancelled">{t("tasks.status_cancelled")}</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("tasks.dueDate")}</Label>
                <Input type="date" name="dueDate" defaultValue={editTarget.dueDate ? editTarget.dueDate.split("T")[0] : ""} />
              </div>
            </div>
            {!isStrictTeamLeader && (
              <div className="space-y-2">
                <Label>{t("teams.label")}</Label>
                <Select value={editFormTeam} onChange={e => { setEditFormTeam(e.target.value); setEditAssignedToId(""); }}>
                  <option value="">{t("teams.allTeams")}</option>
                  {TEAMS.map(tm => <option key={tm} value={tm} className="capitalize">{t(`teams.${tm}`)}</option>)}
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("tasks.assignedTo")}</Label>
              <Select value={editAssignedToId} onChange={e => setEditAssignedToId(e.target.value)}>
                <option value="">—</option>
                {editFilteredUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName}{u.team ? ` (${u.team})` : ""}</option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
              <Button type="button" variant="ghost" onClick={handleEditClose}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={editBusy}>{editBusy ? t("common.loading") : t("common.save")}</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Mark Complete Modal */}
      {completingTask && (
        <Modal isOpen={!!completingTask} onClose={() => setCompletingTask(null)} title={t("tasks.markComplete")}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="text-white font-semibold">"{completingTask.title}"</span>
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("common.notes")} <span className="text-muted-foreground/60">({t("common.optional")})</span></Label>
              <textarea
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                rows={3}
                placeholder="Describe what was done..."
                className="flex w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setCompletingTask(null)}>{t("common.cancel")}</Button>
              <Button
                onClick={handleComplete}
                disabled={completeBusy}
                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white border-0"
              >
                <CheckCircle2 className="w-4 h-4" />
                {completeBusy ? t("common.loading") : t("common.confirm")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Task Modal */}
      {!isMaintenance && (
        <Modal isOpen={isAddOpen} onClose={() => { setIsAddOpen(false); setFormTeam(""); setAssignedToId(""); }} title={t("tasks.addTask")}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("tasks.taskTitle")}</Label>
              <Input name="title" required placeholder="e.g. Inspect Line 4 Motors" />
            </div>
            <div className="space-y-2">
              <Label>{t("tasks.description")}</Label>
              <Input name="description" placeholder="Details..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("common.type")}</Label>
                <Select name="type" required defaultValue="maintenance">
                  <option value="maintenance">Maintenance</option>
                  <option value="inspection">Inspection</option>
                  <option value="repair">Repair</option>
                  <option value="general">General</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("tasks.priority")}</Label>
                <Select name="priority" required defaultValue="medium">
                  <option value="low">{t("tasks.priority_low")}</option>
                  <option value="medium">{t("tasks.priority_medium")}</option>
                  <option value="high">{t("tasks.priority_high")}</option>
                  <option value="urgent">{t("tasks.priority_critical")}</option>
                </Select>
              </div>
            </div>
            {!isStrictTeamLeader && (
              <div className="space-y-2">
                <Label>{t("teams.label")}</Label>
                <Select
                  value={formTeam}
                  onChange={(e) => { setFormTeam(e.target.value); setAssignedToId(""); }}
                >
                  <option value="" className="bg-background">{t("teams.allTeams")}</option>
                  {TEAMS.map((tm) => (
                    <option key={tm} value={tm} className="bg-background capitalize">{t(`teams.${tm}`)}</option>
                  ))}
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("tasks.assignedTo")}</Label>
                <Select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} required>
                  <option value="" className="bg-background">—</option>
                  {formFilteredUsers.map((u) => (
                    <option key={u.id} value={u.id} className="bg-background">
                      {u.fullName}{u.team ? ` (${u.team})` : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("tasks.dueDate")}</Label>
                <Input type="date" name="dueDate" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-white/10 mt-4">
              <Button type="button" variant="ghost" onClick={() => { setIsAddOpen(false); setFormTeam(""); setAssignedToId(""); }}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={createMutation.isPending}>{t("common.save")}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
