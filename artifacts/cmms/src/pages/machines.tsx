import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Label, Modal } from "@/components/ui";
import {
  Plus, QrCode, CheckCircle, XCircle, Pencil, PowerOff, ScanLine,
  History, StickyNote, AlertTriangle, Clock, Send, Trash2, Loader2,
  Download, Upload, Settings2, Shield, ChevronDown, ChevronUp, FileSpreadsheet, Monitor,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { QRScanner } from "@/components/qr-scanner";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/utils";
import * as XLSX from "xlsx";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const TEXTAREA_CLS =
  "flex w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary resize-none";

const ALL_ROLES = ["admin", "manager", "teamleader", "maintenance", "inventory"] as const;
type RoleKey = typeof ALL_ROLES[number];

const ROLE_LABELS: Record<RoleKey, string> = {
  admin: "Admin",
  manager: "Manager",
  teamleader: "Team Leader",
  maintenance: "Maintenance",
  inventory: "Inventory",
};

const TEAMS = ["assembly", "test", "packaging"] as const;
const TEAM_COLORS: Record<string, string> = {
  assembly: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  test:     "text-amber-400 border-amber-400/30 bg-amber-400/10",
  packaging:"text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
};

interface Machine {
  id: number;
  name: string;
  code: string;
  model: string | null;
  location: string | null;
  lineId: number | null;
  lineName: string | null;
  team: string | null;
  isActive: boolean;
  createdByName: string | null;
  createdAt: string;
}

type TimelineEntry =
  | { type: "note"; id: number; content: string; createdByName: string | null; createdAt: string }
  | {
      type: "downtime"; id: number; reason: string; rootCause: string | null;
      category: string; status: string; durationMinutes: number | null;
      lineName: string | null; recordedByName: string | null;
      startTime: string; endTime: string | null; createdAt: string;
    };

interface HistoryResponse {
  machine: Machine;
  timeline: TimelineEntry[];
}

function useMachines() {
  return useQuery<Machine[]>({
    queryKey: ["machines"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/machines`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
}

function useProductionLines() {
  return useQuery<{ id: number; name: string; team: string | null }[]>({
    queryKey: ["production-lines"],
    queryFn: () => fetch(`${BASE}/api/production/lines`, { credentials: "include" }).then(r => r.json()),
    staleTime: 60_000,
  });
}

function useMachineHistory(machineId: number | null) {
  return useQuery<HistoryResponse>({
    queryKey: ["machine-history", machineId],
    queryFn: () => fetch(`${BASE}/api/machines/${machineId}/history`, { credentials: "include" }).then((r) => r.json()),
    enabled: machineId != null,
  });
}

function useMachineSettings(isAdmin: boolean) {
  return useQuery<{ allowedRoles: string[]; allRoles: string[] }>({
    queryKey: ["machine-settings"],
    queryFn: () => fetch(`${BASE}/api/machines/settings`, { credentials: "include" }).then((r) => r.json()),
    enabled: isAdmin,
  });
}

const EMPTY_FORM = { name: "", code: "", model: "", location: "", lineId: "", team: "", stationNumber: "", stationName: "", machineType: "", machineIp: "" };

export default function Machines() {
  const { t } = useTranslation();
  const { user, isTeamLeader, isManager } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: machines, isLoading } = useMachines();
  const { data: productionLines } = useProductionLines();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === "admin";
  const isStrictTeamLeader = isTeamLeader && !isManager && !isAdmin;

  const { data: settingsData } = useMachineSettings(isAdmin);
  const allowedRoles: string[] = settingsData?.allowedRoles ?? ["admin", "manager"];
  const canAdd = !!user && allowedRoles.includes(user.role);
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [filterLine, setFilterLine] = useState<string>("all");
  const [filterTeam, setFilterTeam] = useState<string>("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showScanner, setShowScanner] = useState(false);
  const [editTarget, setEditTarget] = useState<Machine | null>(null);
  const [editForm, setEditForm] = useState({ name: "", model: "", location: "", lineId: "", stationNumber: "", stationName: "", machineType: "", machineIp: "" });
  const [scannerFor, setScannerFor] = useState<"add" | "edit">("add");
  const [showPermissions, setShowPermissions] = useState(false);
  const [permissionRoles, setPermissionRoles] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{ added: number; skipped: string[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [historyMachine, setHistoryMachine] = useState<Machine | null>(null);
  const [noteText, setNoteText] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data: historyData, isLoading: historyLoading } = useMachineHistory(historyMachine?.id ?? null);

  const uniqueLines = Array.from(
    new Map((machines ?? []).filter((m) => m.lineName).map((m) => [m.lineId, m.lineName])).entries()
  );

  const createMutation = useMutation({
    mutationFn: async (data: typeof EMPTY_FORM) => {
      const r = await fetch(`${BASE}/api/machines`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, lineId: data.lineId ? Number(data.lineId) : null }),
      });
      const json = await r.json();
      if (!r.ok) throw { response: { data: json } };
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      setIsAddOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: t("machines.added") });
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err?.response?.data?.error ?? err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await fetch(`${BASE}/api/machines/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await r.json();
      if (!r.ok) throw { response: { data: json } };
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      setEditTarget(null);
      toast({ title: t("machines.updated") });
    },
    onError: (err: any) => {
      toast({ title: t("common.error"), description: err?.response?.data?.error ?? err.message, variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/api/machines/${id}/deactivate`, { method: "PATCH", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast({ title: t("machines.deactivated") });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/api/machines/${id}/activate`, { method: "PATCH", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast({ title: t("machines.activated") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/api/machines/${id}`, { method: "DELETE", credentials: "include" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      setConfirmDeleteId(null);
      toast({ title: t("machines.deleted") });
    },
  });

  const savePermissionsMutation = useMutation({
    mutationFn: async (roles: string[]) => {
      const r = await fetch(`${BASE}/api/machines/settings`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedRoles: roles }),
      });
      const json = await r.json();
      if (!r.ok) throw json;
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine-settings"] });
      toast({ title: t("machines.permissionsSaved") });
      setShowPermissions(false);
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const r = await fetch(`${BASE}/api/machines/${id}/notes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = await r.json();
      if (!r.ok) throw json;
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine-history", historyMachine?.id] });
      setNoteText("");
      toast({ title: t("machines.noteAdded") });
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async ({ machineId, noteId }: { machineId: number; noteId: number }) => {
      const r = await fetch(`${BASE}/api/machines/${machineId}/notes/${noteId}`, {
        method: "DELETE",
        credentials: "include",
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine-history", historyMachine?.id] });
      toast({ title: t("machines.noteDeleted") });
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      toast({ title: t("machines.nameCodeRequired"), variant: "destructive" });
      return;
    }
    createMutation.mutate(form);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    updateMutation.mutate({
      id: editTarget.id,
      data: { ...editForm, lineId: editForm.lineId ? Number(editForm.lineId) : null, stationNumber: editForm.stationNumber ? Number(editForm.stationNumber) : null },
    });
  };

  const openEdit = (m: Machine) => {
    setEditTarget(m);
    setEditForm({ name: m.name, model: m.model ?? "", location: m.location ?? "", lineId: m.lineId?.toString() ?? "", stationNumber: (m as any).stationNumber?.toString() ?? "", stationName: (m as any).stationName ?? "", machineType: (m as any).machineType ?? "", machineIp: (m as any).machineIp ?? "" });
  };

  const handleQRScan = (code: string) => {
    setShowScanner(false);
    if (scannerFor === "add") setForm((f) => ({ ...f, code }));
  };

  const handleAddNote = () => {
    if (!noteText.trim() || !historyMachine) return;
    addNoteMutation.mutate({ id: historyMachine.id, content: noteText });
  };

  const openPermissions = () => {
    setPermissionRoles(allowedRoles);
    setShowPermissions(true);
  };

  const togglePermissionRole = (role: string) => {
    if (role === "admin") return;
    setPermissionRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleExcelDownload = () => {
    const data = (machines ?? []).map((m) => ({
      Name: m.name,
      Code: m.code,
      Model: m.model ?? "",
      Location: m.location ?? "",
      Line: m.lineName ?? "",
      Status: m.isActive ? "Active" : "Inactive",
      "Registered By": m.createdByName ?? "",
      "Registered At": m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Machines");
    ws["!cols"] = [
      { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 22 },
      { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 16 },
    ];
    XLSX.writeFile(wb, "machines-registry.xlsx");
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const machines = rows.map((row) => ({
        name: String(row["Name"] ?? row["name"] ?? row["Machine Name"] ?? "").trim(),
        code: String(row["Code"] ?? row["code"] ?? row["QR Code"] ?? row["QRCode"] ?? "").trim(),
        model: String(row["Model"] ?? row["model"] ?? "").trim() || null,
        location: String(row["Location"] ?? row["location"] ?? "").trim() || null,
        lineId: row["Line ID"] ?? row["lineId"] ?? null,
      })).filter((m) => m.name && m.code);

      if (machines.length === 0) {
        toast({ title: t("machines.importNoRows"), variant: "destructive" });
        return;
      }

      const r = await fetch(`${BASE}/api/machines/import`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machines }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);

      qc.invalidateQueries({ queryKey: ["machines"] });
      setImportResult({ added: result.added, skipped: result.skipped });
      toast({
        title: t("machines.importDone"),
        description: `${result.added} ${t("machines.importAdded")}, ${result.skipped.length} ${t("machines.importSkipped")}`,
      });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = (machines ?? []).filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.code.toLowerCase().includes(search.toLowerCase()) ||
      (m.lineName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === "all" ? true : filterStatus === "active" ? m.isActive : !m.isActive;
    const matchLine =
      filterLine === "all" ? true : String(m.lineId) === filterLine;
    const matchTeam =
      !filterTeam ? true : m.team === filterTeam;
    return matchSearch && matchStatus && matchLine && matchTeam;
  });

  const timeline = historyData?.timeline ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">{t("machines.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t("machines.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              className="gap-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              onClick={openPermissions}
            >
              <Shield className="w-4 h-4" /> {t("machines.manageAccess")}
            </Button>
          )}
          <Button
            variant="outline"
            className="gap-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
            onClick={handleExcelDownload}
            disabled={!machines?.length}
          >
            <Download className="w-4 h-4" /> {t("machines.exportExcel")}
          </Button>
          {canAdd && (
            <>
              <Button
                variant="outline"
                className="gap-2 border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {t("machines.importExcel")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleExcelUpload}
              />
              <Button
                onClick={() => { setForm(EMPTY_FORM); setIsAddOpen(true); }}
                className="gap-2 tech-border shadow-[0_0_15px_rgba(37,99,235,0.3)]"
              >
                <Plus className="w-4 h-4" /> {t("machines.addMachine")}
              </Button>
            </>
          )}
        </div>
      </div>

      {importResult && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm">
          <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-emerald-400 font-medium">
              {t("machines.importDone")}: <span className="font-bold">{importResult.added}</span> {t("machines.importAdded")}
              {importResult.skipped.length > 0 && (
                <>, <span className="font-bold text-amber-400">{importResult.skipped.length}</span> {t("machines.importSkipped")}</>
              )}
            </p>
            {importResult.skipped.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("machines.importSkippedCodes")}: {importResult.skipped.join(", ")}
              </p>
            )}
          </div>
          <button className="text-muted-foreground hover:text-white" onClick={() => setImportResult(null)}>
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Team filter buttons */}
      {!isStrictTeamLeader && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterTeam("")}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${!filterTeam ? "border-primary text-primary bg-primary/10" : "border-white/10 text-muted-foreground hover:border-white/20"}`}
          >
            {t("teams.allTeams")}
          </button>
          {TEAMS.map(team => (
            <button
              key={team}
              onClick={() => setFilterTeam(filterTeam === team ? "" : team)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors capitalize ${filterTeam === team ? `${TEAM_COLORS[team]} border-current` : "border-white/10 text-muted-foreground hover:border-white/20"}`}
            >
              {t(`teams.${team}`)}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={t("machines.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="h-9 rounded-md border border-input bg-background/50 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">{t("common.all")} {t("common.status")}</option>
          <option value="active">{t("common.active")}</option>
          <option value="inactive">{t("common.inactive")}</option>
        </select>
        {uniqueLines.length > 0 && (
          <select
            value={filterLine}
            onChange={(e) => setFilterLine(e.target.value)}
            className="h-9 rounded-md border border-input bg-background/50 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">{t("common.all")} {t("common.line")}</option>
            {uniqueLines.map(([id, name]) => (
              <option key={id} value={String(id)}>{name}</option>
            ))}
          </select>
        )}
        <span className="self-center text-xs text-muted-foreground ml-1">
          {filtered.length} {t("common.recordsFound")}
        </span>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("machines.machineName")}</TableHead>
                <TableHead>{t("machines.qrCode")}</TableHead>
                <TableHead>{t("machines.model")}</TableHead>
                <TableHead>{t("machines.location")}</TableHead>
                <TableHead>{t("machines.line")}</TableHead>
                <TableHead>{t("teams.label")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("machines.noMachines")}</TableCell></TableRow>
              ) : (
                filtered.map((m) => (
                  <TableRow key={m.id} className={m.isActive ? "" : "opacity-50"}>
                    <TableCell>
                      <div className="font-semibold text-white">{m.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{m.createdByName && `${t("common.by")} ${m.createdByName}`}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">{m.code}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.model || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.location || "—"}</TableCell>
                    <TableCell>
                      {m.lineName ? (
                        <Badge variant="outline" className="text-xs">{m.lineName}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.team ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${TEAM_COLORS[m.team] ?? "border-white/10 text-muted-foreground"}`}>
                          {t(`teams.${m.team}`)}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      {m.isActive ? (
                        <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3" /> {t("common.active")}</Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1"><XCircle className="w-3 h-3" /> {t("common.inactive")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-sky-400 hover:text-sky-300"
                          onClick={() => { setHistoryMachine(m); setNoteText(""); }}
                          title={t("machines.history")}
                        >
                          <History className="w-3.5 h-3.5" />
                        </Button>
                        {isAdminOrManager && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(m)} className="gap-1">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {m.isActive ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-amber-400 hover:text-amber-300"
                                onClick={() => deactivateMutation.mutate(m.id)}
                                disabled={deactivateMutation.isPending}
                                title={t("machines.deactivate")}
                              >
                                <PowerOff className="w-3.5 h-3.5" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-green-400 hover:text-green-300"
                                onClick={() => activateMutation.mutate(m.id)}
                                disabled={activateMutation.isPending}
                                title={t("machines.activate")}
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {confirmDeleteId === m.id ? (
                              <span className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive px-1.5 text-xs h-7"
                                  onClick={() => deleteMutation.mutate(m.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t("common.confirm")}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="px-1.5 text-xs h-7"
                                  onClick={() => setConfirmDeleteId(null)}
                                >
                                  {t("common.cancel")}
                                </Button>
                              </span>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-destructive hover:text-destructive"
                                onClick={() => setConfirmDeleteId(m.id)}
                                title={t("common.delete")}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Permissions Modal */}
      <Modal
        isOpen={showPermissions}
        onClose={() => setShowPermissions(false)}
        title={t("machines.manageAccess")}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
            <Shield className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{t("machines.permissionsDesc")}</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("machines.rolesCanAdd")}</Label>
            <div className="space-y-2 pt-1">
              {ALL_ROLES.map((role) => (
                <label
                  key={role}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    permissionRoles.includes(role)
                      ? "border-primary/40 bg-primary/10"
                      : "border-white/10 bg-white/5 hover:bg-white/8"
                  } ${role === "admin" ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={permissionRoles.includes(role)}
                    onChange={() => togglePermissionRole(role)}
                    disabled={role === "admin"}
                    className="accent-primary w-4 h-4"
                  />
                  <span className="text-sm text-white">{ROLE_LABELS[role]}</span>
                  {role === "admin" && (
                    <span className="text-xs text-muted-foreground ml-auto">{t("machines.alwaysAllowed")}</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setShowPermissions(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={() => savePermissionsMutation.mutate(permissionRoles)}
              disabled={savePermissionsMutation.isPending}
            >
              {t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* History & Notes Modal */}
      <Modal
        isOpen={!!historyMachine}
        onClose={() => setHistoryMachine(null)}
        title={historyMachine ? `${t("machines.history")} — ${historyMachine.name}` : ""}
      >
        <div className="space-y-4">
          {historyMachine && (
            <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-white/5 border border-white/10 text-xs">
              <span className="flex items-center gap-1 text-primary font-mono">
                <QrCode className="w-3 h-3" /> {historyMachine.code}
              </span>
              {historyMachine.model && <span className="text-muted-foreground">{historyMachine.model}</span>}
              {historyMachine.location && <span className="text-muted-foreground">{historyMachine.location}</span>}
              {historyMachine.lineName && <Badge variant="outline" className="text-[10px]">{historyMachine.lineName}</Badge>}
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5 text-amber-400" />
              {t("machines.addNote")}
            </Label>
            <div className="flex gap-2">
              <textarea
                className={TEXTAREA_CLS}
                rows={2}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={t("machines.notePlaceholder")}
              />
              <Button
                type="button"
                size="sm"
                className="self-end gap-1 shrink-0"
                onClick={handleAddNote}
                disabled={!noteText.trim() || addNoteMutation.isPending}
              >
                {addNoteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">{t("machines.timeline")}</p>

            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : timeline.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">{t("machines.noHistory")}</div>
            ) : (
              <div className="relative space-y-0 max-h-[50vh] overflow-y-auto custom-scrollbar pe-2">
                {timeline.map((entry, i) => (
                  <div key={`${entry.type}-${entry.id}`} className="flex gap-3 group">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                        entry.type === "note"
                          ? "bg-amber-500/20 border border-amber-500/40"
                          : entry.status === "ongoing"
                          ? "bg-red-500/20 border border-red-500/40"
                          : "bg-emerald-500/20 border border-emerald-500/40"
                      }`}>
                        {entry.type === "note" ? (
                          <StickyNote className="w-3.5 h-3.5 text-amber-400" />
                        ) : entry.status === "ongoing" ? (
                          <Clock className="w-3.5 h-3.5 text-red-400" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </div>
                      {i < timeline.length - 1 && (
                        <div className="w-px flex-1 bg-white/10 my-1" />
                      )}
                    </div>

                    <div className={`flex-1 pb-4`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          {entry.type === "note" ? (
                            <span className="text-xs font-medium text-amber-400">{t("machines.note")}</span>
                          ) : (
                            <span className={`text-xs font-medium ${entry.status === "ongoing" ? "text-red-400" : "text-emerald-400"}`}>
                              {t("downtime.title")} — {entry.status === "ongoing" ? t("downtime.status_ongoing") : t("downtime.status_resolved")}
                            </span>
                          )}
                          {entry.type === "downtime" && entry.durationMinutes && (
                            <span className="text-xs text-muted-foreground font-mono">{entry.durationMinutes} min</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{formatDate(entry.createdAt)}</span>
                          {entry.type === "note" && (
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              onClick={() => historyMachine && deleteNoteMutation.mutate({ machineId: historyMachine.id, noteId: entry.id })}
                              disabled={deleteNoteMutation.isPending}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {entry.type === "note" ? (
                        <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-sm text-white">{entry.reason}</p>
                          {entry.rootCause && (
                            <p className="text-xs text-muted-foreground italic">{entry.rootCause}</p>
                          )}
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] uppercase">{entry.category}</Badge>
                            {entry.lineName && <Badge variant="outline" className="text-[10px]">{entry.lineName}</Badge>}
                          </div>
                        </div>
                      )}

                      <div className="text-[10px] text-muted-foreground mt-1">
                        {entry.type === "note" && entry.createdByName && `${t("common.by")} ${entry.createdByName}`}
                        {entry.type === "downtime" && entry.recordedByName && `${t("common.by")} ${entry.recordedByName}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Add Machine Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={t("machines.addMachine")}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("machines.machineName")} *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. SMT Mounter A"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t("machines.qrCode")} *</Label>
            <div className="flex gap-2">
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder={t("machines.scanToFill")}
                readOnly={!!form.code}
                className={form.code ? "font-mono text-primary bg-primary/5" : ""}
              />
              <Button
                type="button"
                variant="outline"
                className="gap-2 shrink-0"
                onClick={() => { setScannerFor("add"); setShowScanner(true); }}
              >
                <ScanLine className="w-4 h-4" />
                {t("machines.scan")}
              </Button>
            </div>
            {form.code && (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                {t("machines.codeScanned")}: <span className="font-mono">{form.code}</span>
                <button type="button" className="text-muted-foreground hover:text-white ml-auto" onClick={() => setForm((f) => ({ ...f, code: "" }))}>
                  {t("common.clear")}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("machines.model")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
              <Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="e.g. FUJI NXT III" />
            </div>
            <div className="space-y-2">
              <Label>{t("machines.line")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
              <select
                value={form.lineId}
                onChange={(e) => setForm((f) => ({ ...f, lineId: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background/50 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="" className="bg-background">—</option>
                {(productionLines ?? []).map(l => (
                  <option key={l.id} value={l.id} className="bg-background">{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("machines.location")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Workshop B, Row 3" />
            </div>
            {!isStrictTeamLeader && (
              <div className="space-y-2">
                <Label>{t("teams.label")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
                <select
                  value={form.team}
                  onChange={(e) => setForm((f) => ({ ...f, team: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input bg-background/50 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="" className="bg-background">{t("teams.noTeam")}</option>
                  {TEAMS.map(team => <option key={team} value={team} className="bg-background capitalize">{t(`teams.${team}`)}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-white/10">
            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1"><Monitor className="w-3 h-3" /> {t("machines.monitorFields")}</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("machines.stationNumber")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
                <Input type="number" value={form.stationNumber} onChange={(e) => setForm((f) => ({ ...f, stationNumber: e.target.value }))} placeholder="e.g. 3" />
              </div>
              <div className="space-y-2">
                <Label>{t("machines.stationName")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
                <Input value={form.stationName} onChange={(e) => setForm((f) => ({ ...f, stationName: e.target.value }))} placeholder="e.g. SMT-A" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="space-y-2">
                <Label>{t("machines.machineType")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
                <Input value={form.machineType} onChange={(e) => setForm((f) => ({ ...f, machineType: e.target.value }))} placeholder="e.g. SMT, AOI, Reflow" />
              </div>
              <div className="space-y-2">
                <Label>{t("machines.machineIp")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
                <Input value={form.machineIp} onChange={(e) => setForm((f) => ({ ...f, machineIp: e.target.value }))} placeholder="192.168.1.100" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={createMutation.isPending}>{t("common.save")}</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Machine Modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title={t("machines.editMachine")}>
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("machines.machineName")} *</Label>
            <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("machines.model")}</Label>
              <Input value={editForm.model} onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t("machines.line")}</Label>
              <select
                value={editForm.lineId}
                onChange={(e) => setEditForm((f) => ({ ...f, lineId: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background/50 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="" className="bg-background">—</option>
                {(productionLines ?? []).map(l => (
                  <option key={l.id} value={l.id} className="bg-background">{l.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("machines.location")}</Label>
            <Input value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))} />
          </div>
          {editTarget && (
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">{t("machines.qrCode")}:</span>
              <span className="font-mono text-xs text-primary">{editTarget.code}</span>
            </div>
          )}

          <div className="pt-2 border-t border-white/10">
            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1"><Monitor className="w-3 h-3" /> {t("machines.monitorFields")}</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("machines.stationNumber")}</Label>
                <Input type="number" value={editForm.stationNumber} onChange={(e) => setEditForm((f) => ({ ...f, stationNumber: e.target.value }))} placeholder="e.g. 3" />
              </div>
              <div className="space-y-2">
                <Label>{t("machines.stationName")}</Label>
                <Input value={editForm.stationName} onChange={(e) => setEditForm((f) => ({ ...f, stationName: e.target.value }))} placeholder="e.g. SMT-A" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="space-y-2">
                <Label>{t("machines.machineType")}</Label>
                <Input value={editForm.machineType} onChange={(e) => setEditForm((f) => ({ ...f, machineType: e.target.value }))} placeholder="e.g. SMT, AOI, Reflow" />
              </div>
              <div className="space-y-2">
                <Label>{t("machines.machineIp")}</Label>
                <Input value={editForm.machineIp} onChange={(e) => setEditForm((f) => ({ ...f, machineIp: e.target.value }))} placeholder="192.168.1.100" />
              </div>
            </div>
            {editTarget && (editTarget as any).machineToken && (
              <div className="mt-3 p-2 rounded bg-white/5 border border-white/10">
                <p className="text-xs text-muted-foreground mb-1">{t("machines.apiToken")}</p>
                <code className="text-xs font-mono text-primary break-all">{(editTarget as any).machineToken}</code>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setEditTarget(null)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={updateMutation.isPending}>{t("common.save")}</Button>
          </div>
        </form>
      </Modal>

      {showScanner && (
        <QRScanner
          label={t("machines.scanQRLabel")}
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
