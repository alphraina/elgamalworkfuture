import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Label } from "@/components/ui";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/utils";
import {
  ShieldCheck, Plus, Pencil, Trash2, ChevronDown, ChevronUp, RefreshCw, X,
  LogIn, LogOut, AlertCircle, CheckSquare, Square, AlertTriangle, Download,
} from "lucide-react";
import * as XLSX from "xlsx";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ROLE_COLORS: Record<string, string> = {
  admin:       "text-red-400 border-red-400/30 bg-red-400/10",
  manager:     "text-blue-400 border-blue-400/30 bg-blue-400/10",
  teamleader:  "text-purple-400 border-purple-400/30 bg-purple-400/10",
  maintenance: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  inventory:   "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
};

const ACTION_STYLES: Record<string, { color: string; icon: React.ReactNode; translationKey: string }> = {
  create:       { color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30", icon: <Plus className="w-3 h-3" />,        translationKey: "actionCreate" },
  update:       { color: "text-blue-400 bg-blue-400/10 border-blue-400/30",          icon: <Pencil className="w-3 h-3" />,      translationKey: "actionUpdate" },
  delete:       { color: "text-red-400 bg-red-400/10 border-red-400/30",             icon: <Trash2 className="w-3 h-3" />,      translationKey: "actionDelete" },
  login:        { color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",          icon: <LogIn className="w-3 h-3" />,       translationKey: "actionLogin" },
  logout:       { color: "text-slate-400 bg-slate-400/10 border-slate-400/30",       icon: <LogOut className="w-3 h-3" />,      translationKey: "actionLogout" },
  login_failed: { color: "text-orange-400 bg-orange-400/10 border-orange-400/30",    icon: <AlertCircle className="w-3 h-3" />, translationKey: "actionLoginFailed" },
};

const ALL_ENTITIES = [
  "Auth", "Machine", "Downtime", "Broken Machine", "User", "Inventory",
  "Vacation Request", "Announcement", "Task", "Attendance",
  "Spare Part Order", "PM Plan", "Training Plan", "Training Exam",
  "Production Record", "Production Line", "Shift Setup", "Line Plan",
  "KPI Settings",
];

interface AuditLog {
  id: number;
  userId: number | null;
  userFullName: string | null;
  userRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  entityLabel: string | null;
  changes: any;
  createdAt: string;
}

function ChangesView({ changes }: { changes: any }) {
  const [expanded, setExpanded] = useState(false);
  if (!changes) return <span className="text-muted-foreground text-xs">—</span>;

  const isArray = Array.isArray(changes);

  if (isArray && changes.length === 0) return <span className="text-muted-foreground text-xs">No changes</span>;

  if (isArray) {
    return (
      <div className="space-y-1">
        {changes.slice(0, expanded ? undefined : 3).map((c: any, i: number) => (
          <div key={i} className="text-xs">
            <span className="text-muted-foreground font-mono">{c.field}:</span>{" "}
            {c.old !== undefined && (
              <><span className="line-through text-red-400/80">{String(c.old ?? "—")}</span>{" → "}</>
            )}
            <span className="text-emerald-400">{String(c.new ?? "—")}</span>
          </div>
        ))}
        {changes.length > 3 && (
          <button className="text-xs text-primary hover:underline flex items-center gap-1" onClick={() => setExpanded(!expanded)}>
            {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> {changes.length - 3} more</>}
          </button>
        )}
      </div>
    );
  }

  const keys = Object.keys(changes);
  return (
    <div className="space-y-1">
      {(expanded ? keys : keys.slice(0, 3)).map((k) => (
        <div key={k} className="text-xs">
          <span className="text-muted-foreground font-mono">{k}:</span>{" "}
          <span className="text-white/80">{String(changes[k] ?? "—")}</span>
        </div>
      ))}
      {keys.length > 3 && (
        <button className="text-xs text-primary hover:underline flex items-center gap-1" onClick={() => setExpanded(!expanded)}>
          {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> {keys.length - 3} more</>}
        </button>
      )}
    </div>
  );
}

function ConfirmDialog({
  open,
  count,
  isAll,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  count: number;
  isAll: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-base">{t("auditLogs.deleteConfirmTitle")}</h3>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isAll ? t("auditLogs.deleteConfirmAll") : t("auditLogs.deleteConfirmSelected", { count })}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground border border-white/10 rounded-lg bg-white/5 px-3 py-2">
          {t("auditLogs.deleteWarning")}
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white border-0 gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {loading ? t("common.loading") : t("common.delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AuditLogs() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const params = new URLSearchParams();
  if (filterAction !== "all") params.set("action", filterAction);
  if (filterEntity !== "all") params.set("entity", filterEntity);
  if (filterFrom) params.set("from", filterFrom);
  if (filterTo) params.set("to", filterTo);
  params.set("limit", "500");

  const { data: rawLogs, isLoading, refetch } = useQuery<AuditLog[]>({
    queryKey: ["audit-logs", params.toString()],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/audit-logs?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load audit logs");
      return r.json();
    },
    refetchInterval: 30000,
  });
  const logs: AuditLog[] = Array.isArray(rawLogs) ? rawLogs : [];

  const filtered = useMemo(() => logs.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (log.userFullName ?? "").toLowerCase().includes(q) ||
      (log.entityLabel ?? "").toLowerCase().includes(q) ||
      log.entity.toLowerCase().includes(q)
    );
  }), [logs, search]);

  const deleteMutation = useMutation({
    mutationFn: async (payload: { ids?: number[]; all?: boolean }) => {
      const r = await fetch(`${BASE}/api/audit-logs`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Delete failed");
      return r.json();
    },
    onSuccess: () => {
      setSelected(new Set());
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });

  const filteredIds = useMemo(() => filtered.map((l) => l.id), [filtered]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selected);
      filteredIds.forEach((id) => next.delete(id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filteredIds.forEach((id) => next.add(id));
      setSelected(next);
    }
  };

  const toggleRow = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleDeleteSelected = () => {
    setConfirmAll(false);
    setConfirmOpen(true);
  };

  const handleDeleteAll = () => {
    setConfirmAll(true);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (confirmAll) {
      deleteMutation.mutate({ all: true });
    } else {
      deleteMutation.mutate({ ids: Array.from(selected) });
    }
  };

  const clearFilters = () => {
    setFilterAction("all");
    setFilterEntity("all");
    setFilterFrom("");
    setFilterTo("");
    setSearch("");
  };

  const hasFilters = filterAction !== "all" || filterEntity !== "all" || filterFrom || filterTo || search;

  function exportToExcel() {
    const rows = filtered.map((log) => ({
      ID: log.id,
      Timestamp: log.createdAt ? new Date(log.createdAt).toLocaleString() : "",
      User: log.userFullName ?? "",
      Role: log.userRole ?? "",
      Action: log.action,
      Entity: log.entity,
      "Entity ID": log.entityId ?? "",
      Details: log.entityLabel ?? "",
      Changes: log.changes ? JSON.stringify(log.changes) : "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws["!cols"] = [
      { wch: 6 },   // ID
      { wch: 22 },  // Timestamp
      { wch: 20 },  // User
      { wch: 13 },  // Role
      { wch: 12 },  // Action
      { wch: 20 },  // Entity
      { wch: 10 },  // Entity ID
      { wch: 40 },  // Details
      { wch: 60 },  // Changes
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Logs");

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `audit-logs-${dateStr}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmOpen}
        count={selected.size}
        isAll={confirmAll}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        loading={deleteMutation.isPending}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            {t("auditLogs.title")}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">{t("auditLogs.subtitle")}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
              <X className="w-3.5 h-3.5" /> {t("common.clear")}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            disabled={filtered.length === 0}
            className="gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/60"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel {filtered.length > 0 && `(${filtered.length})`}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> {t("common.refresh")}
          </Button>
          {someSelected && (
            <Button
              size="sm"
              onClick={handleDeleteSelected}
              className="gap-1 bg-red-600/90 hover:bg-red-600 text-white border-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("auditLogs.deleteSelected", { count: selected.size })}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteAll}
            className="gap-1 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t("auditLogs.deleteAll")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("common.search")}</Label>
            <Input
              placeholder={t("auditLogs.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("auditLogs.filterAction")}</Label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="h-9 rounded-md border border-input bg-background/50 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">{t("common.all")}</option>
              <option value="create">{t("auditLogs.actionCreate")}</option>
              <option value="update">{t("auditLogs.actionUpdate")}</option>
              <option value="delete">{t("auditLogs.actionDelete")}</option>
              <option value="login">{t("auditLogs.actionLogin")}</option>
              <option value="logout">{t("auditLogs.actionLogout")}</option>
              <option value="login_failed">{t("auditLogs.actionLoginFailed")}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("auditLogs.filterEntity")}</Label>
            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="h-9 rounded-md border border-input bg-background/50 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">{t("common.all")}</option>
              {ALL_ENTITIES.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("common.from")}</Label>
            <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-36" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("common.to")}</Label>
            <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="w-36" />
          </div>
          <div className="self-center pb-1 flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {filtered.length} {t("common.recordsFound")}
            </span>
            {someSelected && (
              <span className="text-xs text-primary font-medium">
                {selected.size} {t("auditLogs.selectedCount")}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {/* Select-all checkbox column */}
                <TableHead className="w-10 text-center">
                  <button
                    onClick={toggleSelectAll}
                    className="text-muted-foreground hover:text-white transition-colors"
                    title={allFilteredSelected ? t("auditLogs.deselectAll") : t("auditLogs.selectAll")}
                  >
                    {allFilteredSelected
                      ? <CheckSquare className="w-4 h-4 text-primary" />
                      : <Square className="w-4 h-4" />
                    }
                  </button>
                </TableHead>
                <TableHead className="w-10">#</TableHead>
                <TableHead>{t("auditLogs.user")}</TableHead>
                <TableHead>{t("auditLogs.action")}</TableHead>
                <TableHead>{t("auditLogs.entity")}</TableHead>
                <TableHead>{t("auditLogs.target")}</TableHead>
                <TableHead>{t("auditLogs.changes")}</TableHead>
                <TableHead>{t("common.date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{t("common.loading")}</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{t("auditLogs.noLogs")}</TableCell>
                </TableRow>
              ) : (
                filtered.map((log) => {
                  const actionStyle = ACTION_STYLES[log.action] ?? ACTION_STYLES.update;
                  const isChecked = selected.has(log.id);
                  return (
                    <TableRow
                      key={log.id}
                      className={isChecked ? "bg-primary/5 border-primary/20" : ""}
                    >
                      <TableCell className="text-center">
                        <button
                          onClick={() => toggleRow(log.id)}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          {isChecked
                            ? <CheckSquare className="w-4 h-4 text-primary" />
                            : <Square className="w-4 h-4" />
                          }
                        </button>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{log.id}</TableCell>
                      <TableCell>
                        <div className="font-medium text-white text-sm">{log.userFullName ?? t("common.na")}</div>
                        {log.userRole && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase ${ROLE_COLORS[log.userRole] ?? ""}`}>
                            {log.userRole}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border ${actionStyle.color}`}>
                          {actionStyle.icon}
                          {t(`auditLogs.${actionStyle.translationKey}`)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{log.entity}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <div className="text-sm text-white truncate" title={log.entityLabel ?? ""}>
                          {log.entityLabel || "—"}
                        </div>
                        {log.entityId && (
                          <div className="text-[10px] text-muted-foreground font-mono">ID: {log.entityId}</div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <ChangesView changes={log.changes} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
