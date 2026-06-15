import { useState } from "react";
import {
  useGetDowntimeRecords,
  useCreateDowntimeRecord,
  useUpdateDowntime,
  type CreateDowntimeRequestCategory,
} from "@workspace/api-client-react";
import { Button, Input, Select, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Modal, Label } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { Plus, CheckCircle, Clock, Timer, ScanLine, QrCode, X, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { FilterBar, matchesDateFilter, matchesShiftFilter, matchesSearch, type FilterState } from "@/components/filter-bar";
import { useTranslation } from "react-i18next";
import { QRScanner } from "@/components/qr-scanner";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const TEXTAREA_CLS =
  "flex w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary resize-none";

const TEAM_COLORS: Record<string, string> = {
  assembly: "bg-blue-400/10 text-blue-400 border-blue-400/30",
  test: "bg-amber-400/10 text-amber-400 border-amber-400/30",
  packaging: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
};

function TeamBadge({ team }: { team: string | null | undefined }) {
  if (!team) return null;
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase ${TEAM_COLORS[team] ?? "bg-muted text-muted-foreground border-muted"}`}>
      {team}
    </span>
  );
}

interface MachineResult {
  id: number;
  name: string;
  code: string;
  lineName: string | null;
  lineId: number | null;
}

export default function Downtime() {
  const { t } = useTranslation();
  const { data: records, isLoading } = useGetDowntimeRecords();
  const createMutation = useCreateDowntimeRecord();
  const updateMutation = useUpdateDowntime();
  const { toast } = useToast();
  const { isMaintenance, isAdmin, isManager, isTeamLeader } = useAuth();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [mode, setMode] = useState<"ongoing" | "with-end">("ongoing");
  const [resolveTarget, setResolveTarget] = useState<{ id: number; machineName: string; startTime: string } | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const canEditRecords = isAdmin || isManager;

  const handleEditOpen = (r: any) => setEditTarget(r);
  const handleEditClose = () => setEditTarget(null);

  const handleEditSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await updateMutation.mutateAsync({
        id: editTarget.id,
        data: {
          reason: fd.get("reason") as string,
          rootCause: fd.get("rootCause") as string,
          category: fd.get("category") as string,
          notes: fd.get("notes") as string || undefined,
          startTime: fd.get("startTime") as string,
          endTime: fd.get("endTime") ? (fd.get("endTime") as string) : undefined,
          status: fd.get("status") as string,
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
  const [resolveForm, setResolveForm] = useState({ rootCause: "", endTime: new Date().toISOString().slice(0, 16) });
  const [filters, setFilters] = useState<FilterState>({ date: "", shift: "", search: "", status: "" });
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannedMachine, setScannedMachine] = useState<MachineResult | null>(null);
  const [machineNameManual, setMachineNameManual] = useState("");
  const [scannedCode, setScannedCode] = useState("");

  const { data: allMachines } = useQuery<MachineResult[]>({
    queryKey: ["machines"],
    queryFn: () => fetch(`${BASE}/api/machines`, { credentials: "include" }).then((r) => r.json()),
    enabled: isAddOpen,
  });

  const { data: productionLines } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["production-lines"],
    queryFn: () => fetch(`${BASE}/api/production/lines`, { credentials: "include" }).then(r => r.json()),
    staleTime: 60_000,
  });

  const handleQRScan = (code: string) => {
    setShowQRScanner(false);
    setScannedCode(code);
    const found = (allMachines ?? []).find((m) => m.code === code);
    if (found) {
      setScannedMachine(found);
      setMachineNameManual(found.name);
    } else {
      setScannedMachine(null);
      toast({
        title: t("machines.notFound"),
        description: t("machines.notFoundDesc"),
        variant: "destructive",
      });
    }
  };

  const resetAddForm = () => {
    setScannedMachine(null);
    setScannedCode("");
    setMachineNameManual("");
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const machineName = (scannedMachine?.name ?? machineNameManual).trim() || (fd.get("machineName") as string)?.trim();
    const rootCause = (fd.get("rootCause") as string)?.trim();

    if (!machineName) {
      toast({ title: t("downtime.machineRequired"), description: t("downtime.machineRequiredDesc"), variant: "destructive" });
      return;
    }
    if (!scannedCode) {
      toast({ title: t("downtime.qrRequired"), description: t("downtime.qrRequiredDesc"), variant: "destructive" });
      return;
    }
    if (!rootCause) {
      toast({ title: t("downtime.rootCauseRequired"), description: t("downtime.rootCauseDesc"), variant: "destructive" });
      return;
    }
    try {
      await (createMutation.mutateAsync as any)({
        data: {
          machineName,
          machineCode: scannedCode || undefined,
          lineId: scannedMachine?.lineId ? scannedMachine.lineId : Number(fd.get("lineId")),
          startTime: fd.get("startTime") as string,
          endTime: mode === "with-end" ? (fd.get("endTime") as string) || undefined : undefined,
          reason: fd.get("reason") as string,
          rootCause,
          category: fd.get("category") as CreateDowntimeRequestCategory,
          notes: fd.get("notes") as string,
        },
      });
      setIsAddOpen(false);
      resetAddForm();
      toast({ title: mode === "with-end" ? t("downtime.recordedResolved") : t("downtime.recordedOngoing") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  };

  const openResolve = (r: { id: number; machineName: string; startTime?: string }) => {
    setResolveTarget({ id: r.id, machineName: r.machineName, startTime: r.startTime ?? "" });
    setResolveForm({ rootCause: "", endTime: new Date().toISOString().slice(0, 16) });
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    if (!resolveForm.rootCause.trim()) {
      toast({ title: t("downtime.rootCauseRequired"), description: t("downtime.rootCauseDesc"), variant: "destructive" });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: resolveTarget.id,
        data: {
          status: "resolved",
          endTime: new Date(resolveForm.endTime).toISOString(),
          rootCause: resolveForm.rootCause,
        } as any,
      });
      setResolveTarget(null);
      toast({ title: t("downtime.resolvedSuccess") });
    } catch (err: any) {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const showTeamFilter = isAdmin || isManager || isTeamLeader;
  const TEAMS = [
    { value: "assembly", label: t("teams.assembly") },
    { value: "test", label: t("teams.test") },
    { value: "packaging", label: t("teams.packaging") },
  ] as const;

  const filtered = (records ?? []).filter((r) => {
    if (!matchesDateFilter(r.startTime, filters.date)) return false;
    if (!matchesShiftFilter(r.startTime, filters.shift)) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (teamFilter && (r as any).recordedByTeam !== teamFilter) return false;
    return matchesSearch([r.machineName, r.reason, r.rootCause, r.category], filters.search);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">{t("downtime.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {isMaintenance
              ? t("downtime.addRecord")
              : t("downtime.filters")}
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2 tech-border shadow-[0_0_15px_rgba(37,99,235,0.3)]">
          <Plus className="w-4 h-4" /> {t("downtime.addRecord")}
        </Button>
      </div>

      {showTeamFilter && (
        <div className="flex items-center gap-2 flex-wrap">
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
        </div>
      )}

      <FilterBar
        filters={filters}
        onChange={setFilters}
        showShift
        showSearch
        statusOptions={[
          { value: "ongoing", label: t("downtime.status_ongoing") },
          { value: "resolved", label: t("downtime.status_resolved") },
        ]}
      />

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("downtime.machine")}</TableHead>
                <TableHead>{t("teams.label")}</TableHead>
                <TableHead>{t("downtime.category")}</TableHead>
                <TableHead>{t("downtime.startTime")}</TableHead>
                <TableHead>{t("downtime.endTime")}</TableHead>
                <TableHead className="text-end">{t("downtime.duration")}</TableHead>
                <TableHead>{t("common.description")}</TableHead>
                <TableHead>{t("downtime.rootCause")}</TableHead>
                {!isMaintenance && <TableHead className="text-end">{t("common.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">{t("downtime.noRecords")}</TableCell></TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.status === "ongoing" ? (
                        <Badge variant="destructive" className="animate-pulse gap-1"><Clock className="w-3 h-3" /> {t("downtime.status_ongoing")}</Badge>
                      ) : (
                        <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3" /> {t("downtime.status_resolved")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-white">{r.machineName}</div>
                      {(r as any).machineCode && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <QrCode className="w-3 h-3 text-primary flex-shrink-0" />
                          <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">{(r as any).machineCode}</span>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-0.5">{(r as any).lineName || `${t("common.line")} ${r.lineId}`}</div>
                    </TableCell>
                    <TableCell>
                      {(r as any).isPublicReport ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase tracking-wide">
                            ⚠ {t("publicDowntime.reportButton")}
                          </span>
                          {(r as any).reporterName && (
                            <div className="text-xs text-muted-foreground truncate max-w-[120px]">{(r as any).reporterName}</div>
                          )}
                        </div>
                      ) : (
                        <TeamBadge team={(r as any).recordedByTeam} />
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="uppercase text-[10px]">{r.category}</Badge></TableCell>
                    <TableCell className="text-xs">{formatDate(r.startTime)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.endTime ? formatDate(r.endTime) : <span className="italic">—</span>}
                    </TableCell>
                    <TableCell className="text-end">
                      {r.durationMinutes != null ? (
                        <span className="font-mono text-sm font-semibold text-white flex items-center justify-end gap-1">
                          <Timer className="w-3 h-3 text-muted-foreground" />
                          {r.durationMinutes} min
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate text-xs" title={r.reason}>{r.reason}</TableCell>
                    <TableCell className="max-w-[140px] text-xs text-muted-foreground truncate" title={(r as any).rootCause ?? ""}>
                      {(r as any).rootCause || <span className="italic">—</span>}
                    </TableCell>
                    {!isMaintenance && (
                      <TableCell className="text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEditRecords && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-white hover:bg-white/10 border border-white/10" onClick={() => handleEditOpen(r)}>
                              <Pencil className="w-3.5 h-3.5" />{t("common.edit")}
                            </Button>
                          )}
                          {r.status === "ongoing" && (
                            <Button variant="outline" size="sm" onClick={() => openResolve(r as any)} disabled={updateMutation.isPending}>
                              {t("downtime.resolve")}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit Downtime Record Modal */}
      {editTarget && (
        <Modal isOpen onClose={handleEditClose} title={`${t("common.edit")} — ${editTarget.machineName}`}>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("downtime.category")} *</Label>
                <Select name="category" defaultValue={editTarget.category}>
                  <option value="mechanical">{t("downtime.category_mechanical")}</option>
                  <option value="electrical">{t("downtime.category_electrical")}</option>
                  <option value="software">{t("downtime.category_software")}</option>
                  <option value="material">{t("downtime.category_material")}</option>
                  <option value="other">{t("downtime.category_other")}</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("common.status")}</Label>
                <Select name="status" defaultValue={editTarget.status}>
                  <option value="ongoing">{t("downtime.status_ongoing")}</option>
                  <option value="resolved">{t("downtime.status_resolved")}</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("downtime.startTime")} *</Label>
                <Input type="datetime-local" name="startTime" required defaultValue={editTarget.startTime ? editTarget.startTime.slice(0, 16) : ""} />
              </div>
              <div className="space-y-2">
                <Label>{t("downtime.endTime")}</Label>
                <Input type="datetime-local" name="endTime" defaultValue={editTarget.endTime ? editTarget.endTime.slice(0, 16) : ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("common.description")} *</Label>
              <Input name="reason" required defaultValue={editTarget.reason ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>{t("downtime.rootCause")} *</Label>
              <textarea name="rootCause" rows={3} required defaultValue={editTarget.rootCause ?? ""} className={TEXTAREA_CLS} />
            </div>
            <div className="space-y-2">
              <Label>{t("common.notes")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
              <Input name="notes" defaultValue={editTarget.notes ?? ""} />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
              <Button type="button" variant="ghost" onClick={handleEditClose}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={editBusy}>{editBusy ? t("common.loading") : t("common.save")}</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Downtime Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={t("downtime.addRecord")}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex gap-2 p-1 rounded-lg bg-white/5 border border-white/10">
            <button
              type="button"
              onClick={() => setMode("ongoing")}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${mode === "ongoing" ? "bg-primary text-white" : "text-muted-foreground hover:text-white"}`}
            >
              {t("downtime.recordOngoing")}
            </button>
            <button
              type="button"
              onClick={() => setMode("with-end")}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${mode === "with-end" ? "bg-primary text-white" : "text-muted-foreground hover:text-white"}`}
            >
              {t("downtime.recordWithEnd")}
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                {t("downtime.machine")} *
              </Label>
              <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded px-2 py-0.5">
                <QrCode className="w-3 h-3" />
                {t("downtime.qrRequiredBadge")}
              </span>
            </div>

            {scannedMachine ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <QrCode className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm">{scannedMachine.name}</div>
                  <div className="text-xs text-emerald-400 font-mono">{scannedMachine.code}</div>
                  {scannedMachine.lineName && (
                    <div className="text-xs text-muted-foreground">{scannedMachine.lineName}</div>
                  )}
                </div>
                <button type="button" onClick={resetAddForm} className="text-muted-foreground hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : scannedCode && !scannedMachine ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
                  <QrCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-amber-400">{t("machines.codeNotRegistered")}:</span>
                  <span className="font-mono text-white">{scannedCode}</span>
                  <button type="button" onClick={resetAddForm} className="ml-auto text-muted-foreground hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Input
                  name="machineName"
                  required
                  value={machineNameManual}
                  onChange={(e) => setMachineNameManual(e.target.value)}
                  placeholder={t("downtime.typeNameManually")}
                  autoFocus
                />
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowQRScanner(true)}
                  className="w-full flex items-center justify-center gap-3 p-4 rounded-lg border-2 border-dashed border-primary/40 hover:border-primary/70 hover:bg-primary/5 transition-colors text-primary"
                >
                  <ScanLine className="w-5 h-5" />
                  <span className="font-medium">{t("downtime.scanToSelectMachine")}</span>
                </button>
                <p className="text-xs text-center text-muted-foreground">{t("downtime.qrRequiredDesc")}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("downtime.lineId")} *</Label>
              <select
                name="lineId"
                required={!scannedMachine?.lineId}
                defaultValue={scannedMachine?.lineId ?? ""}
                className="w-full h-9 rounded-md border border-input bg-background/50 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="" className="bg-background">— {t("common.select")} —</option>
                {(productionLines ?? []).map(l => (
                  <option key={l.id} value={l.id} className="bg-background">{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("downtime.category")} *</Label>
              <Select name="category" required defaultValue="mechanical">
                <option value="mechanical">{t("downtime.category_mechanical")}</option>
                <option value="electrical">{t("downtime.category_electrical")}</option>
                <option value="software">{t("downtime.category_software")}</option>
                <option value="material">{t("downtime.category_material")}</option>
                <option value="other">{t("downtime.category_other")}</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("downtime.startTime")} *</Label>
              <Input type="datetime-local" name="startTime" required defaultValue={new Date().toISOString().slice(0, 16)} />
            </div>
          </div>

          {mode === "with-end" && (
            <div className="space-y-2">
              <Label>{t("downtime.endTime")} *</Label>
              <Input type="datetime-local" name="endTime" required />
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("common.description")} *</Label>
            <Input name="reason" required placeholder="Brief description of the issue" />
          </div>

          <div className="space-y-2">
            <Label>{t("downtime.rootCause")} *</Label>
            <textarea name="rootCause" rows={3} required placeholder="What caused the downtime?" className={TEXTAREA_CLS} />
          </div>

          <div className="space-y-2">
            <Label>{t("common.notes")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
            <Input name="notes" placeholder="Any extra details..." />
          </div>

          <div className="space-y-3 pt-4 border-t border-white/10 mt-4">
            {!scannedCode && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2">
                <QrCode className="w-3.5 h-3.5 shrink-0" />
                {t("downtime.qrRequiredDesc")}
              </div>
            )}
            {scannedCode && !scannedMachine && !machineNameManual.trim() && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2">
                <QrCode className="w-3.5 h-3.5 shrink-0" />
                {t("downtime.machineRequiredDesc")}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>{t("common.cancel")}</Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !scannedCode || (!!scannedCode && !scannedMachine && !machineNameManual.trim())}
              >
                {t("common.save")}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Resolve Modal */}
      <Modal
        isOpen={!!resolveTarget}
        onClose={() => setResolveTarget(null)}
        title={`${t("downtime.resolveTitle")} — ${resolveTarget?.machineName}`}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("downtime.endTime")} *</Label>
            <Input
              type="datetime-local"
              value={resolveForm.endTime}
              onChange={(e) => setResolveForm((f) => ({ ...f, endTime: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("downtime.rootCause")} *</Label>
            <textarea
              rows={3}
              value={resolveForm.rootCause}
              onChange={(e) => setResolveForm((f) => ({ ...f, rootCause: e.target.value }))}
              placeholder="Describe what caused the downtime and how it was resolved..."
              className={TEXTAREA_CLS}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
            <Button variant="outline" onClick={() => setResolveTarget(null)}>{t("common.cancel")}</Button>
            <Button
              onClick={handleResolve}
              disabled={updateMutation.isPending}
              className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white border-0"
            >
              <CheckCircle className="w-4 h-4" />
              {updateMutation.isPending ? t("common.loading") : t("downtime.resolve")}
            </Button>
          </div>
        </div>
      </Modal>

      {showQRScanner && (
        <QRScanner
          label={t("machines.scanQRLabel")}
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  );
}
