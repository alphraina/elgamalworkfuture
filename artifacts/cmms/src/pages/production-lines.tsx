import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  PlusCircle, Pencil, Trash2, CheckCircle2, XCircle, Activity,
  Factory, Save, X, AlertTriangle, ToggleLeft, ToggleRight, RefreshCw,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const apiFetch = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}/api${path}`, { credentials: "include", ...opts }).then(async r => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.statusText);
    return r.json();
  });

interface Line {
  id: number;
  name: string;
  description: string | null;
  team: string | null;
  targetCapacityPerHour: number;
  minimumCapacityPerHour: number;
  responsibleUserId: number | null;
  responsibleUserName: string | null;
  isActive: boolean;
  createdAt: string;
}

interface User {
  id: number;
  fullName: string;
  role: string;
}

const TEAM_SUGGESTIONS = [
  "Assembly", "Test / QC", "Packaging", "Machining", "Stamping",
  "Enamel Cleaning", "Welding", "Painting", "Warehouse", "Final Inspection",
];

const TEAM_PALETTE = [
  "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "bg-orange-500/15 text-orange-400 border-orange-500/20",
  "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  "bg-pink-500/15 text-pink-400 border-pink-500/20",
  "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  "bg-rose-500/15 text-rose-400 border-rose-500/20",
  "bg-lime-500/15 text-lime-400 border-lime-500/20",
  "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
];

function teamColor(team: string | null): string {
  if (!team) return "bg-white/10 text-muted-foreground border-white/10";
  let hash = 0;
  for (let i = 0; i < team.length; i++) hash = team.charCodeAt(i) + ((hash << 5) - hash);
  return TEAM_PALETTE[Math.abs(hash) % TEAM_PALETTE.length];
}

const INPUT = "bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 w-full";
const SELECT = `${INPUT} [&>option]:bg-[#0e1623] [&>option]:text-white`;
const LABEL = "text-xs font-medium text-muted-foreground mb-1 block";

function emptyForm() {
  return { name: "", description: "", team: "", targetCapacityPerHour: 200, minimumCapacityPerHour: 150, responsibleUserId: "" };
}

export default function ProductionLines() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");

  const { data: lines = [], isLoading } = useQuery<Line[]>({
    queryKey: ["production-lines"],
    queryFn: () => apiFetch("/production/lines"),
    enabled: !!user,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users-list"],
    queryFn: () => apiFetch("/users"),
    enabled: !!user,
  });

  const supervisors = users.filter(u => ["admin", "manager", "teamleader"].includes(u.role));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["production-lines"] });
    qc.invalidateQueries({ queryKey: ["analytics"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/production/lines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    onSuccess: () => { invalidate(); setShowAdd(false); setForm(emptyForm()); setError(""); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => apiFetch(`/production/lines/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    onSuccess: () => { invalidate(); setEditingId(null); setError(""); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/production/lines/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setConfirmDelete(null); },
    onError: (e: Error) => setError(e.message),
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      for (const line of lines) {
        await apiFetch(`/production/lines/${line.id}`, { method: "DELETE" });
      }
    },
    onSuccess: () => { invalidate(); setConfirmClearAll(false); },
    onError: (e: Error) => setError(e.message),
  });

  const toggleActive = (line: Line) => updateMutation.mutate({ id: line.id, body: { isActive: !line.isActive } });

  function startEdit(line: Line) {
    setEditingId(line.id);
    setForm({
      name: line.name,
      description: line.description ?? "",
      team: line.team ?? "",
      targetCapacityPerHour: line.targetCapacityPerHour,
      minimumCapacityPerHour: line.minimumCapacityPerHour,
      responsibleUserId: String(line.responsibleUserId ?? ""),
    });
    setError("");
  }

  function saveEdit() {
    if (!editingId) return;
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      team: form.team.trim() || null,
      targetCapacityPerHour: Number(form.targetCapacityPerHour),
      minimumCapacityPerHour: Number(form.minimumCapacityPerHour),
      responsibleUserId: form.responsibleUserId ? Number(form.responsibleUserId) : null,
    };
    if (!body.name) { setError("Line name is required."); return; }
    updateMutation.mutate({ id: editingId, body });
  }

  function submitCreate() {
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      team: form.team.trim() || null,
      targetCapacityPerHour: Number(form.targetCapacityPerHour),
      minimumCapacityPerHour: Number(form.minimumCapacityPerHour),
      responsibleUserId: form.responsibleUserId ? Number(form.responsibleUserId) : null,
    };
    if (!body.name) { setError("Line name is required."); return; }
    createMutation.mutate(body);
  }

  const isAdmin = user?.role === "admin";
  const activeCnt = lines.filter(l => l.isActive).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Factory className="w-5 h-5 text-primary" />
            Production Lines
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {lines.length} line{lines.length !== 1 ? "s" : ""} configured · {activeCnt} active
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {lines.length > 0 && (
              <button
                onClick={() => setConfirmClearAll(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-white/10 text-muted-foreground hover:text-white hover:border-white/20 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Clear all
              </button>
            )}
            <button
              onClick={() => { setShowAdd(true); setForm(emptyForm()); setEditingId(null); setError(""); }}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Add Line
            </button>
          </div>
        )}
      </div>

      {/* Clear All Confirm */}
      {confirmClearAll && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 flex items-start gap-4">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-white font-semibold">Delete all {lines.length} lines?</p>
            <p className="text-xs text-muted-foreground mt-1">
              All existing lines will be removed. Historical production records will be preserved but will no longer reference a line. You can then add your own custom lines.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setConfirmClearAll(false)} className="px-3 py-1.5 text-sm rounded-lg border border-white/10 text-muted-foreground hover:text-white">Cancel</button>
            <button
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {clearAllMutation.isPending ? "Deleting…" : "Yes, clear all"}
            </button>
          </div>
        </div>
      )}

      {/* Add Line Form */}
      {showAdd && (
        <div className="bg-card border border-primary/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">New Production Line / Station</h3>
            <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <LineForm form={form} setForm={setForm} supervisors={supervisors} />
          {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm rounded-lg border border-white/10 text-muted-foreground hover:text-white transition-colors">Cancel</button>
            <button
              onClick={submitCreate}
              disabled={createMutation.isPending}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {createMutation.isPending ? "Saving…" : "Save Line"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center gap-3 text-muted-foreground py-10 justify-center">
          <Activity className="w-5 h-5 animate-pulse" />
          <span>Loading lines…</span>
        </div>
      ) : lines.length === 0 ? (
        <div className="bg-card border border-white/10 rounded-xl p-12 text-center">
          <Factory className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-white font-medium">No production lines configured</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Add your own lines — name them anything: "Machine 1 Stamping", "Enamel Cleaning", "Assembly Line 1", etc.
          </p>
          {isAdmin && (
            <button
              onClick={() => { setShowAdd(true); setForm(emptyForm()); }}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Add First Line
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {lines.map(line => (
            <div key={line.id} className={`bg-card border rounded-xl overflow-hidden transition-colors ${line.isActive ? "border-white/10" : "border-white/5 opacity-60"}`}>
              {editingId === line.id ? (
                /* ─── Edit mode ─── */
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Editing — {line.name}</h3>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
                  </div>
                  <LineForm form={form} setForm={setForm} supervisors={supervisors} />
                  {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>}
                  <div className="flex gap-2 justify-end pt-1">
                    <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm rounded-lg border border-white/10 text-muted-foreground hover:text-white transition-colors">Cancel</button>
                    <button
                      onClick={saveEdit}
                      disabled={updateMutation.isPending}
                      className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {updateMutation.isPending ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </div>
              ) : confirmDelete === line.id ? (
                /* ─── Delete confirm ─── */
                <div className="p-5 flex items-center gap-4 flex-wrap">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">Delete <span className="text-red-400">{line.name}</span>?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">This will remove the line permanently. Existing production records referencing this line will be preserved.</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 text-sm rounded-lg border border-white/10 text-muted-foreground hover:text-white">Cancel</button>
                    <button
                      onClick={() => deleteMutation.mutate(line.id)}
                      disabled={deleteMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {deleteMutation.isPending ? "Deleting…" : "Yes, delete"}
                    </button>
                  </div>
                </div>
              ) : (
                /* ─── View mode ─── */
                <div className="p-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-shrink-0">
                    {line.isActive
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      : <XCircle className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{line.name}</span>
                      {line.team && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${teamColor(line.team)}`}>
                          {line.team}
                        </span>
                      )}
                      {!line.isActive && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-white/5 text-muted-foreground border-white/10">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span>Target: <span className="text-white">{line.targetCapacityPerHour} u/h</span></span>
                      <span>Min: <span className="text-white">{line.minimumCapacityPerHour} u/h</span></span>
                      {line.responsibleUserName && <span>Supervisor: <span className="text-white">{line.responsibleUserName}</span></span>}
                      {line.description && <span className="truncate max-w-xs text-muted-foreground/70">{line.description}</span>}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleActive(line)}
                        title={line.isActive ? "Deactivate" : "Activate"}
                        className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                      >
                        {line.isActive ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => startEdit(line)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(line.id)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lines.length > 0 && (
        <p className="text-xs text-muted-foreground/60 text-center pb-2">
          Production records, downtime, and OEE analytics are all linked to these lines.
          Deleting a line keeps historical records but removes it from future data entry.
        </p>
      )}
    </div>
  );
}

/* ─── Shared line form ─── */
function LineForm({
  form, setForm, supervisors,
}: {
  form: ReturnType<typeof emptyForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyForm>>>;
  supervisors: User[];
}) {
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Name */}
      <div className="sm:col-span-2">
        <label className={LABEL}>Line / Station Name *</label>
        <input
          className={INPUT}
          placeholder='e.g. "Machine 1 Stamping", "Enamel Cleaning", "Assembly Line 1"'
          value={form.name}
          onChange={set("name")}
          autoFocus
        />
      </div>

      {/* Team — free-form with suggestions */}
      <div>
        <label className={LABEL}>Zone / Category <span className="text-muted-foreground/50 font-normal">(optional — type anything)</span></label>
        <input
          className={INPUT}
          list="team-suggestions"
          placeholder="e.g. Stamping, Enamel, Assembly…"
          value={form.team}
          onChange={set("team")}
        />
        <datalist id="team-suggestions">
          {TEAM_SUGGESTIONS.map(s => <option key={s} value={s} />)}
        </datalist>
      </div>

      {/* Supervisor */}
      <div>
        <label className={LABEL}>Supervisor</label>
        <select className={SELECT} value={form.responsibleUserId} onChange={set("responsibleUserId")}>
          <option value="">— None —</option>
          {supervisors.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
      </div>

      {/* Target capacity */}
      <div>
        <label className={LABEL}>Target Capacity (units/hour)</label>
        <input
          className={INPUT} type="number" min={1} placeholder="200"
          value={form.targetCapacityPerHour} onChange={set("targetCapacityPerHour")}
        />
      </div>

      {/* Min capacity */}
      <div>
        <label className={LABEL}>Minimum Capacity (units/hour)</label>
        <input
          className={INPUT} type="number" min={1} placeholder="150"
          value={form.minimumCapacityPerHour} onChange={set("minimumCapacityPerHour")}
        />
      </div>

      {/* Description */}
      <div className="sm:col-span-2">
        <label className={LABEL}>Description (optional)</label>
        <textarea
          className={INPUT} rows={2} placeholder="Notes about this line or station…"
          value={form.description} onChange={set("description")}
        />
      </div>
    </div>
  );
}
