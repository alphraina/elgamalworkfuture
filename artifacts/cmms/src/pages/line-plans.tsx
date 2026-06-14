import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Select, Card, Modal, Label } from "@/components/ui";
import {
  ArrowLeftRight, CheckCheck, Loader2, ChevronDown, ChevronUp,
  AlertTriangle, ClipboardCheck, Wrench, StickyNote, Clock, User, Trash2,
  Plus, PenLine, MessageSquare
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const TEAM_COLORS: Record<string, string> = {
  assembly: "bg-blue-400/10 text-blue-400 border-blue-400/30",
  test: "bg-amber-400/10 text-amber-400 border-amber-400/30",
  packaging: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
};

const SHIFT_COLORS: Record<string, string> = {
  day:   "bg-amber-400/10 text-amber-300 border-amber-400/30",
  night: "bg-indigo-400/10 text-indigo-300 border-indigo-400/30",
};

interface Handover {
  id: number;
  date: string;
  shift: string;
  lineId: number;
  lineName: string | null;
  submittedById: number;
  submittedByName: string | null;
  submittedByTeam: string | null;
  assignedToId: number;
  completedWork: string | null;
  tasks: string | null;
  equipmentStatus: string | null;
  notes: string | null;
  acknowledgedById: number | null;
  acknowledgedByName: string | null;
  acknowledgedAt: string | null;
  acknowledgeNotes: string | null;
  status: "draft" | "published" | "completed";
  createdAt: string;
}

const TA = "w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none";

const SectionHeader = ({ icon: Icon, label, color }: { icon: any; label: string; color: string }) => (
  <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-1 ${color}`}>
    <Icon className="w-3.5 h-3.5" />
    {label}
  </div>
);

export default function LinePlans() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, isInventory } = useAuth();
  const qc = useQueryClient();

  const canUse = !isInventory;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterShift, setFilterShift] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [lines, setLines] = useState<{ id: number; name: string }[]>([]);

  // Acknowledge modal state
  const [ackId, setAckId] = useState<number | null>(null);
  const [ackNotes, setAckNotes] = useState("");

  // Add-more modal state
  const [addMoreHandover, setAddMoreHandover] = useState<Handover | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/production/lines`, { credentials: "include" })
      .then(r => r.json()).then(d => setLines(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const { data: handovers = [], isLoading } = useQuery<Handover[]>({
    queryKey: ["handovers"],
    queryFn: () => fetch(`${BASE}/api/line-plans`, { credentials: "include" }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, any>) => {
      const r = await fetch(`${BASE}/api/line-plans`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (!r.ok) throw json;
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["handovers"] });
      setIsAddOpen(false);
      toast({ title: t("handover.submitted") });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e?.error ?? e?.message, variant: "destructive" }),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ id, acknowledgeNotes }: { id: number; acknowledgeNotes: string }) => {
      const r = await fetch(`${BASE}/api/line-plans/${id}/acknowledge`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledgeNotes }),
      });
      const json = await r.json();
      if (!r.ok) throw json;
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["handovers"] });
      setAckId(null);
      setAckNotes("");
      toast({ title: t("handover.acknowledgedSuccess") });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e?.error, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...body }: Record<string, any>) => {
      const r = await fetch(`${BASE}/api/line-plans/${id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (!r.ok) throw json;
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["handovers"] });
      setAddMoreHandover(null);
      toast({ title: t("common.saved") });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e?.error, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${BASE}/api/line-plans/${id}`, { method: "DELETE", credentials: "include" });
      const json = await r.json();
      if (!r.ok) throw json;
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["handovers"] });
      setConfirmDeleteId(null);
      toast({ title: t("common.deleted") });
    },
    onError: (e: any) => toast({ title: t("common.error"), description: e?.error, variant: "destructive" }),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      date: fd.get("date"),
      shift: fd.get("shift"),
      lineId: Number(fd.get("lineId")),
      completedWork: fd.get("completedWork"),
      tasks: fd.get("tasks"),
      equipmentStatus: fd.get("equipmentStatus"),
      notes: fd.get("notes"),
      assignedToId: user?.id,
    });
  };

  const handleAddMore = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!addMoreHandover) return;
    const fd = new FormData(e.currentTarget);
    const now = new Date().toLocaleString();
    const sigLine = `\n\n─── ${t("handover.addedBy")} ${user?.fullName ?? "Unknown"} · ${now} ───`;

    const appendField = (existing: string | null, newVal: string | null) => {
      if (!newVal?.trim()) return existing ?? undefined;
      return `${existing ?? ""}${sigLine}\n${newVal.trim()}`;
    };

    const newTasks = fd.get("additionalTasks") as string;
    const newEquipment = fd.get("additionalEquipment") as string;
    const newNotes = fd.get("additionalNotes") as string;

    updateMutation.mutate({
      id: addMoreHandover.id,
      tasks: appendField(addMoreHandover.tasks, newTasks),
      equipmentStatus: appendField(addMoreHandover.equipmentStatus, newEquipment),
      notes: appendField(addMoreHandover.notes, newNotes),
    });
  };

  const filtered = handovers.filter(h => {
    if (filterShift && h.shift !== filterShift) return false;
    if (filterDate && h.date !== filterDate) return false;
    return true;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pending = filtered.filter(h => h.status === "draft").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-3 justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-display font-bold text-white">{t("handover.title")}</h2>
            {pending > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {pending} {t("handover.pendingAck")}
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">{t("handover.subtitle")}</p>
        </div>
        {canUse && (
          <Button onClick={() => setIsAddOpen(true)} className="gap-2 tech-border">
            <ArrowLeftRight className="w-4 h-4" /> {t("handover.submit")}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("handover.shift")}:</span>
          {["", "day", "night"].map(s => (
            <button key={s} onClick={() => setFilterShift(s)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors capitalize ${filterShift === s ? "border-primary text-primary bg-primary/10" : "border-white/10 text-muted-foreground hover:border-white/20"}`}>
              {s === "" ? t("teams.allTeams") : t(`attendance.shift_${s}`)}
            </button>
          ))}
        </div>
        <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="h-8 text-xs w-36 bg-background/50" />
        {filterDate && (
          <button onClick={() => setFilterDate("")} className="text-xs text-muted-foreground hover:text-white underline">
            {t("common.clear")}
          </button>
        )}
      </div>

      {/* Handover Cards */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="py-12 text-center text-muted-foreground text-sm">{t("handover.noHandovers")}</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(h => {
            const isExpanded = expandedId === h.id;
            const isAcknowledged = h.status === "published" || h.status === "completed";
            const isOwner = h.submittedById === user?.id;
            const canDelete = isOwner;
            const canAcknowledge = canUse && !isOwner && !isAcknowledged;
            const canAddMore = canUse;

            return (
              <Card key={h.id} className={`transition-all duration-200 ${isAcknowledged ? "border-emerald-500/20" : "border-amber-500/20"}`}>
                {/* Card Header Row */}
                <div className="flex flex-wrap gap-3 items-start justify-between p-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${isAcknowledged ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>
                      {isAcknowledged ? <CheckCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {isAcknowledged ? t("handover.acknowledged") : t("handover.submitted")}
                    </span>
                    {/* Shift */}
                    <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase ${SHIFT_COLORS[h.shift] ?? "text-muted-foreground border-white/10"}`}>
                      {t(`attendance.shift_${h.shift}`)}
                    </span>
                    {/* Date */}
                    <span className="text-sm font-semibold text-white">{h.date}</span>
                    {/* Line */}
                    <span className="text-sm text-muted-foreground">{h.lineName ?? `Line ${h.lineId}`}</span>
                    {/* Team */}
                    {h.submittedByTeam && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${TEAM_COLORS[h.submittedByTeam] ?? "text-muted-foreground border-white/10"}`}>
                        {h.submittedByTeam}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Submitted by */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span className="font-medium text-white/80">{h.submittedByName ?? `User #${h.submittedById}`}</span>
                      {isOwner && <span className="text-[10px] text-primary ml-1">({t("common.you")})</span>}
                    </div>

                    {/* Add More button */}
                    {canAddMore && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 border border-blue-400/20"
                        onClick={() => setAddMoreHandover(h)}
                      >
                        <Plus className="w-3 h-3" />
                        {t("handover.addMore")}
                      </Button>
                    )}

                    {/* Acknowledge button */}
                    {canAcknowledge && (
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white border-0"
                        onClick={() => { setAckId(h.id); setAckNotes(""); }}
                      >
                        <CheckCheck className="w-3 h-3" />
                        {t("handover.acknowledge")}
                      </Button>
                    )}

                    {/* Delete — only owner */}
                    {canDelete && (
                      confirmDeleteId === h.id ? (
                        <span className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive px-2"
                            onClick={() => deleteMutation.mutate(h.id)} disabled={deleteMutation.isPending}>
                            {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t("common.confirm")}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2"
                            onClick={() => setConfirmDeleteId(null)}>{t("common.cancel")}</Button>
                        </span>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmDeleteId(h.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )
                    )}

                    {/* Expand toggle */}
                    <button onClick={() => setExpandedId(isExpanded ? null : h.id)}
                      className="p-1.5 rounded text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-white/5 p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Completed Work */}
                      <div>
                        <SectionHeader icon={ClipboardCheck} label={t("handover.completedWork")} color="text-emerald-400" />
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{h.completedWork || "—"}</p>
                      </div>

                      {/* Outstanding Tasks */}
                      <div>
                        <SectionHeader icon={AlertTriangle} label={t("handover.outstandingTasks")} color="text-amber-400" />
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{h.tasks || "—"}</p>
                      </div>

                      {/* Equipment Status */}
                      <div>
                        <SectionHeader icon={Wrench} label={t("handover.equipmentStatus")} color="text-blue-400" />
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{h.equipmentStatus || "—"}</p>
                      </div>

                      {/* Safety Notes */}
                      <div>
                        <SectionHeader icon={StickyNote} label={t("handover.safetyNotes")} color="text-red-400" />
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{h.notes || "—"}</p>
                      </div>
                    </div>

                    {/* Acknowledgment block */}
                    {isAcknowledged && h.acknowledgedByName && (
                      <div className="pt-3 border-t border-white/5 bg-emerald-500/5 rounded-lg p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <CheckCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">{t("handover.acknowledgedBy")}</span>
                          <span className="text-sm font-bold text-white">{h.acknowledgedByName}</span>
                          {h.acknowledgedAt && (
                            <span className="text-xs text-muted-foreground">· {formatDate(h.acknowledgedAt)}</span>
                          )}
                        </div>
                        {h.acknowledgeNotes && (
                          <div className="ml-6">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                              <MessageSquare className="w-3 h-3" />
                              {t("handover.acknowledgeNotes")}
                            </div>
                            <p className="text-sm text-white/80 whitespace-pre-wrap">{h.acknowledgeNotes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Submit Handover Modal ── */}
      {canUse && (
        <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={t("handover.submitTitle")}>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Submitter display */}
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
              <User className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">{t("handover.submittingAs")}</span>
              <span className="text-sm font-semibold text-white">{user?.fullName}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("common.date")}</Label>
                <Input type="date" name="date" required defaultValue={new Date().toISOString().split("T")[0]} />
              </div>
              <div className="space-y-2">
                <Label>{t("handover.endingShift")}</Label>
                <Select name="shift" required defaultValue="day">
                  <option value="day">{t("attendance.shift_day")}</option>
                  <option value="night">{t("attendance.shift_night")}</option>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("handover.line")}</Label>
              <Select name="lineId" required defaultValue="">
                <option value="" disabled className="bg-background">—</option>
                {lines.map(l => (
                  <option key={l.id} value={l.id} className="bg-background">{l.name}</option>
                ))}
              </Select>
            </div>

            <div>
              <SectionHeader icon={ClipboardCheck} label={t("handover.completedWork")} color="text-emerald-400" />
              <textarea name="completedWork" rows={3} className={TA} placeholder={t("handover.completedWorkPlaceholder")} />
            </div>
            <div>
              <SectionHeader icon={AlertTriangle} label={t("handover.outstandingTasks")} color="text-amber-400" />
              <textarea name="tasks" rows={3} className={TA} placeholder={t("handover.outstandingPlaceholder")} />
            </div>
            <div>
              <SectionHeader icon={Wrench} label={t("handover.equipmentStatus")} color="text-blue-400" />
              <textarea name="equipmentStatus" rows={2} className={TA} placeholder={t("handover.equipmentPlaceholder")} />
            </div>
            <div>
              <SectionHeader icon={StickyNote} label={t("handover.safetyNotes")} color="text-red-400" />
              <textarea name="notes" rows={2} className={TA} placeholder={t("handover.safetyPlaceholder")} />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={createMutation.isPending} className="gap-2">
                {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <ArrowLeftRight className="w-3.5 h-3.5" />
                {t("handover.submit")}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Acknowledge Modal ── */}
      <Modal
        isOpen={ackId !== null}
        onClose={() => { setAckId(null); setAckNotes(""); }}
        title={t("handover.acknowledgeTitle")}
      >
        <div className="space-y-4">
          {/* Who is acknowledging */}
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <CheckCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground">{t("handover.acknowledgeAs")}</span>
            <span className="text-sm font-bold text-white">{user?.fullName}</span>
          </div>

          {/* Acknowledgment notes */}
          <div>
            <SectionHeader icon={MessageSquare} label={t("handover.acknowledgeNotes")} color="text-emerald-400" />
            <textarea
              rows={4}
              className={TA}
              placeholder={t("handover.acknowledgeNotesPlaceholder")}
              value={ackNotes}
              onChange={e => setAckNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
            <Button variant="ghost" onClick={() => { setAckId(null); setAckNotes(""); }}>{t("common.cancel")}</Button>
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white border-0"
              disabled={acknowledgeMutation.isPending}
              onClick={() => ackId !== null && acknowledgeMutation.mutate({ id: ackId, acknowledgeNotes: ackNotes })}
            >
              {acknowledgeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
              {t("handover.confirmAcknowledge")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Add More Items Modal ── */}
      {addMoreHandover && (
        <Modal
          isOpen={true}
          onClose={() => setAddMoreHandover(null)}
          title={t("handover.addMoreTitle")}
        >
          <form onSubmit={handleAddMore} className="space-y-4">
            {/* Who is adding */}
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <PenLine className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">{t("handover.addingAs")}</span>
              <span className="text-sm font-bold text-white">{user?.fullName}</span>
            </div>

            <div className="text-xs text-muted-foreground bg-white/5 rounded px-3 py-2">
              <span className="font-medium text-white/60">{t("handover.handoverRef")}:</span>{" "}
              {addMoreHandover.lineName ?? `Line ${addMoreHandover.lineId}`} · {addMoreHandover.date} · {t(`attendance.shift_${addMoreHandover.shift}`)}
            </div>

            <div>
              <SectionHeader icon={AlertTriangle} label={t("handover.additionalTasks")} color="text-amber-400" />
              <textarea name="additionalTasks" rows={3} className={TA} placeholder={t("handover.additionalTasksPlaceholder")} />
            </div>
            <div>
              <SectionHeader icon={Wrench} label={t("handover.additionalEquipment")} color="text-blue-400" />
              <textarea name="additionalEquipment" rows={2} className={TA} placeholder={t("handover.additionalEquipmentPlaceholder")} />
            </div>
            <div>
              <SectionHeader icon={StickyNote} label={t("handover.additionalNotes")} color="text-red-400" />
              <textarea name="additionalNotes" rows={2} className={TA} placeholder={t("handover.additionalNotesPlaceholder")} />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
              <Button type="button" variant="ghost" onClick={() => setAddMoreHandover(null)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={updateMutation.isPending} className="gap-2">
                {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {t("handover.addMoreSave")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
