import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertOctagon, PlusCircle, Pencil, Trash2, Save, X, AlertTriangle,
  ChevronDown, Calendar, Filter, Activity,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const apiFetch = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}/api${path}`, { credentials: "include", ...opts }).then(async r => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.statusText);
    return r.json();
  });

interface Defect {
  id: number;
  lineId: number | null;
  lineName: string | null;
  date: string;
  shift: string | null;
  reason: string;
  quantity: number;
  details: string | null;
  reportedById: number | null;
  reportedByName: string | null;
  createdAt: string;
}

interface Line { id: number; name: string; team: string | null; isActive: boolean }

const SHIFT_OPTIONS = [
  { value: "", label: "— All shifts —" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "night", label: "Night" },
];

const SHIFT_LABELS: Record<string, string> = {
  morning: "Morning", afternoon: "Afternoon", night: "Night",
};

const COMMON_REASONS = [
  "Dimensional non-conformance",
  "Surface defect / scratch",
  "Wrong color / coating",
  "Assembly error",
  "Missing component",
  "Electrical failure",
  "Weld defect",
  "Packaging damage",
  "Contamination",
  "Operator error",
];

const INPUT = "bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 w-full";
const LABEL = "text-xs font-medium text-muted-foreground mb-1 block";

function todayStr() { return new Date().toISOString().slice(0, 10); }

function emptyForm() {
  return { lineId: "", date: todayStr(), shift: "", reason: "", quantity: 1, details: "" };
}

export default function Defects() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterLine, setFilterLine] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState("");

  const params = new URLSearchParams();
  if (filterDate) params.set("date", filterDate);
  if (filterLine) params.set("lineId", filterLine);

  const { data: defects = [], isLoading } = useQuery<Defect[]>({
    queryKey: ["defects", filterDate, filterLine],
    queryFn: () => apiFetch(`/defects?${params}`),
    enabled: !!user,
  });

  const { data: lines = [] } = useQuery<Line[]>({
    queryKey: ["production-lines"],
    queryFn: () => apiFetch("/production/lines"),
    enabled: !!user,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["defects"] });
    qc.invalidateQueries({ queryKey: ["analytics"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: object) => apiFetch("/defects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    onSuccess: () => { invalidate(); setShowAdd(false); setForm(emptyForm()); setError(""); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => apiFetch(`/defects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    onSuccess: () => { invalidate(); setEditingId(null); setError(""); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/defects/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setConfirmDelete(null); },
  });

  function startEdit(d: Defect) {
    setEditingId(d.id);
    setForm({
      lineId: d.lineId ? String(d.lineId) : "",
      date: d.date,
      shift: d.shift ?? "",
      reason: d.reason,
      quantity: d.quantity,
      details: d.details ?? "",
    });
    setError("");
    setShowAdd(false);
  }

  function buildBody() {
    return {
      lineId: form.lineId || null,
      date: form.date,
      shift: form.shift || null,
      reason: form.reason.trim(),
      quantity: Number(form.quantity),
      details: form.details.trim() || null,
    };
  }

  function submitCreate() {
    if (!form.reason.trim()) { setError("Defect reason is required."); return; }
    if (!form.quantity || Number(form.quantity) < 1) { setError("Quantity must be at least 1."); return; }
    createMutation.mutate(buildBody());
  }

  function submitEdit() {
    if (!form.reason.trim()) { setError("Defect reason is required."); return; }
    if (editingId) updateMutation.mutate({ id: editingId, body: buildBody() });
  }

  const totalDefects = defects.reduce((acc, d) => acc + d.quantity, 0);
  const isAdminOrManager = ["admin", "manager"].includes(user?.role ?? "");

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-red-400" />
            Defects Log
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Record non-conforming units per line and shift — feeds into OEE Quality rate
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEditingId(null); setForm(emptyForm()); setError(""); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          Log Defect
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input
            type="date" value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none"
          />
        </div>
        <div className="relative">
          <select
            value={filterLine}
            onChange={e => setFilterLine(e.target.value)}
            className="appearance-none bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm text-white cursor-pointer focus:outline-none"
          >
            <option value="">All lines</option>
            {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
        {totalDefects > 0 && (
          <div className="ml-auto flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertOctagon className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400 font-semibold">{totalDefects} defective units</span>
            <span className="text-xs text-muted-foreground">on {filterDate || "all dates"}</span>
          </div>
        )}
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-card border border-primary/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Log New Defect</h3>
            <button onClick={() => setShowAdd(false)}><X className="w-4 h-4 text-muted-foreground hover:text-white" /></button>
          </div>
          <DefectForm form={form} setForm={setForm} lines={lines} />
          {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm rounded-lg border border-white/10 text-muted-foreground hover:text-white">Cancel</button>
            <button
              onClick={submitCreate}
              disabled={createMutation.isPending}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {createMutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Defect list */}
      {isLoading ? (
        <div className="flex items-center gap-3 text-muted-foreground py-10 justify-center">
          <Activity className="w-5 h-5 animate-pulse" />
          <span>Loading defects…</span>
        </div>
      ) : defects.length === 0 ? (
        <div className="bg-card border border-white/10 rounded-xl p-12 text-center">
          <AlertOctagon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-white font-medium">No defects recorded</p>
          <p className="text-sm text-muted-foreground mt-1">
            {filterDate ? `for ${filterDate}` : "for the selected period"}
            {filterLine ? " on this line" : ""}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {defects.map(d => (
            <div key={d.id} className="bg-card border border-white/10 rounded-xl overflow-hidden">
              {editingId === d.id ? (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Edit Defect</h3>
                    <button onClick={() => setEditingId(null)}><X className="w-4 h-4 text-muted-foreground hover:text-white" /></button>
                  </div>
                  <DefectForm form={form} setForm={setForm} lines={lines} />
                  {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm rounded-lg border border-white/10 text-muted-foreground hover:text-white">Cancel</button>
                    <button
                      onClick={submitEdit}
                      disabled={updateMutation.isPending}
                      className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {updateMutation.isPending ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </div>
              ) : confirmDelete === d.id ? (
                <div className="p-4 flex items-center gap-4 flex-wrap">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">Delete this defect entry?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{d.reason} — {d.quantity} units on {d.date}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 text-sm rounded-lg border border-white/10 text-muted-foreground hover:text-white">Cancel</button>
                    <button
                      onClick={() => deleteMutation.mutate(d.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 flex items-center gap-4 flex-wrap">
                  {/* Qty badge */}
                  <div className="w-14 h-14 rounded-xl bg-red-500/10 border border-red-500/20 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-red-400">{d.quantity}</span>
                    <span className="text-[9px] text-muted-foreground uppercase">units</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-white">{d.reason}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {d.lineName && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                          {d.lineName}
                        </span>
                      )}
                      <span>{d.date}</span>
                      {d.shift && <span className="capitalize">{SHIFT_LABELS[d.shift] ?? d.shift} shift</span>}
                      {d.reportedByName && <span>by {d.reportedByName}</span>}
                    </div>
                    {d.details && <p className="text-xs text-muted-foreground/70 truncate">{d.details}</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(d)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {isAdminOrManager && (
                      <button
                        onClick={() => setConfirmDelete(d.id)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* OEE impact note */}
      <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-4 flex items-start gap-3">
        <AlertOctagon className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-yellow-400 font-semibold">OEE Impact — </span>
          Defects directly reduce the <strong className="text-white">Quality</strong> rate in the OEE equation.
          Quality = (Units Produced − Defective Units) / Units Produced.
          <br />Full OEE = Availability × Performance × Quality. View the impact in <strong className="text-white">Analytics & Reports</strong>.
        </div>
      </div>
    </div>
  );
}

/* ─── Shared form ─── */
function DefectForm({
  form, setForm, lines,
}: {
  form: ReturnType<typeof emptyForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyForm>>>;
  lines: Line[];
}) {
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Reason */}
      <div className="sm:col-span-2">
        <label className={LABEL}>Defect Reason *</label>
        <input
          className={INPUT} list="reason-list"
          placeholder="e.g. Dimensional non-conformance"
          value={form.reason} onChange={set("reason")}
        />
        <datalist id="reason-list">
          {COMMON_REASONS.map(r => <option key={r} value={r} />)}
        </datalist>
      </div>

      {/* Quantity */}
      <div>
        <label className={LABEL}>Defective Units *</label>
        <input
          className={INPUT} type="number" min={1}
          value={form.quantity} onChange={set("quantity")}
        />
      </div>

      {/* Line */}
      <div>
        <label className={LABEL}>Production Line</label>
        <select className={INPUT} value={form.lineId} onChange={set("lineId")}>
          <option value="">— None / Unknown —</option>
          {lines.filter(l => l.isActive).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {/* Date */}
      <div>
        <label className={LABEL}>Date</label>
        <input className={INPUT} type="date" value={form.date} onChange={set("date")} />
      </div>

      {/* Shift */}
      <div>
        <label className={LABEL}>Shift</label>
        <select className={INPUT} value={form.shift} onChange={set("shift")}>
          {SHIFT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Details */}
      <div className="sm:col-span-2">
        <label className={LABEL}>Details / Notes (optional)</label>
        <textarea
          className={INPUT} rows={2}
          placeholder="Describe the defect, root cause, or affected batch…"
          value={form.details} onChange={set("details")}
        />
      </div>
    </div>
  );
}
