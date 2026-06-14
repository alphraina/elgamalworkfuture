import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetBrokenMachines, useCreateBrokenMachineRecord, useUpdateBrokenMachine, type CreateBrokenMachineRequestSeverity } from "@workspace/api-client-react";
import { Button, Input, Select, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Modal, Label } from "@/components/ui";
import { Wrench, CheckCircle, Hammer, ScanLine, QrCode, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { FilterBar, matchesDateFilter, matchesShiftFilter, matchesSearch, type FilterState } from "@/components/filter-bar";
import { useTranslation } from "react-i18next";
import { QRScanner } from "@/components/qr-scanner";

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

export default function BrokenMachines() {
  const { t } = useTranslation();
  const { data: records, isLoading } = useGetBrokenMachines();
  const createMutation = useCreateBrokenMachineRecord();
  const updateMutation = useUpdateBrokenMachine();
  const { toast } = useToast();
  const { isMaintenance, isAdmin, isManager, isTeamLeader, user } = useAuth();

  const [filters, setFilters] = useState<FilterState>({ date: "", shift: "", search: "", status: "" });
  const [teamFilter, setTeamFilter] = useState<string>("");
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [repairTarget, setRepairTarget] = useState<{ id: number; machineName: string } | null>(null);
  const [repairForm, setRepairForm] = useState({ resolutionNotes: "", partsUsed: "" });

  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannedMachine, setScannedMachine] = useState<MachineResult | null>(null);
  const [scannedCode, setScannedCode] = useState("");
  const [machineNameManual, setMachineNameManual] = useState("");

  const { data: allMachines } = useQuery<MachineResult[]>({
    queryKey: ["machines"],
    queryFn: () => fetch(`${BASE}/api/machines`, { credentials: "include" }).then((r) => r.json()),
    enabled: isReportOpen,
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

  const resetForm = () => {
    setScannedMachine(null);
    setScannedCode("");
    setMachineNameManual("");
  };

  const handleReport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const machineName = (scannedMachine?.name ?? machineNameManual).trim();
    if (!machineName) {
      toast({ title: t("downtime.machineRequired"), description: t("downtime.machineRequiredDesc"), variant: "destructive" });
      return;
    }
    if (!scannedCode) {
      toast({ title: t("downtime.qrRequired"), description: t("downtime.qrRequiredDesc"), variant: "destructive" });
      return;
    }

    try {
      await createMutation.mutateAsync({
        data: {
          machineName,
          machineCode: scannedCode,
          lineId: scannedMachine?.lineId ? scannedMachine.lineId : Number(fd.get("lineId")),
          problemDescription: fd.get("problemDescription") as string,
          severity: fd.get("severity") as CreateBrokenMachineRequestSeverity,
          reportedAt: new Date().toISOString(),
        }
      });
      setIsReportOpen(false);
      resetForm();
      toast({ title: t("common.success") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  };

  const handleRepair = async () => {
    if (!repairTarget) return;
    if (!repairForm.resolutionNotes.trim()) {
      toast({ title: t("common.required"), variant: "destructive" });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: repairTarget.id,
        data: {
          resolutionNotes: repairForm.resolutionNotes,
          partsUsed: repairForm.partsUsed || undefined,
          status: "resolved",
        } as any,
      });
      setRepairTarget(null);
      setRepairForm({ resolutionNotes: "", partsUsed: "" });
      toast({ title: t("common.success") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  };

  const handleManagerResolve = async (id: number) => {
    try {
      await updateMutation.mutateAsync({ id, data: { status: 'resolved', resolvedAt: new Date().toISOString() } });
      toast({ title: t("common.success") });
    } catch (err: any) {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const severityColors: Record<string, any> = { low: 'outline', medium: 'secondary', high: 'warning', critical: 'destructive' };
  const showTeamFilter = isAdmin || isManager || isTeamLeader;

  const TEAMS = [
    { value: "assembly", label: t("teams.assembly") },
    { value: "test", label: t("teams.test") },
    { value: "packaging", label: t("teams.packaging") },
  ] as const;

  const filtered = (records ?? []).filter((r) => {
    if (!matchesDateFilter(r.reportedAt, filters.date)) return false;
    if (!matchesShiftFilter(r.reportedAt, filters.shift)) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (teamFilter && (r as any).reportedByTeam !== teamFilter) return false;
    return matchesSearch([r.machineName, r.problemDescription, (r as any).machineCode], filters.search);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">{t("brokenMachines.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {isMaintenance ? t("brokenMachines.noRecords") : t("brokenMachines.title")}
          </p>
        </div>
        <Button onClick={() => setIsReportOpen(true)} variant="destructive" className="gap-2 tech-border shadow-[0_0_15px_rgba(225,29,72,0.3)]">
          <Wrench className="w-4 h-4" /> {t("brokenMachines.addRecord")}
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
          { value: "reported", label: t("brokenMachines.status_open") },
          { value: "in_progress", label: t("brokenMachines.status_in_progress") },
          { value: "resolved", label: t("brokenMachines.status_resolved") },
          { value: "closed", label: t("brokenMachines.status_closed") },
        ]}
      />

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("brokenMachines.machine")}</TableHead>
                <TableHead>{t("teams.label")}</TableHead>
                <TableHead>{t("brokenMachines.reportedAt")}</TableHead>
                <TableHead>{t("brokenMachines.description")}</TableHead>
                <TableHead>{t("brokenMachines.severity")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("brokenMachines.resolution")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("brokenMachines.noRecords")}</TableCell></TableRow>
              ) : (
                filtered.map(r => {
                  const isOwn = r.reportedById === user?.id;
                  const canRepair = isMaintenance && isOwn && r.status !== 'resolved' && r.status !== 'closed';
                  const canResolve = !isMaintenance && (r.status === 'reported' || r.status === 'in_progress');

                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-semibold text-white">{r.machineName}</div>
                        {(r as any).machineCode && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <QrCode className="w-3 h-3 text-primary flex-shrink-0" />
                            <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">{(r as any).machineCode}</span>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5">{r.lineName || `${t("common.line")} ${r.lineId}`}</div>
                      </TableCell>
                      <TableCell>
                        <TeamBadge team={(r as any).reportedByTeam} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(r.reportedAt)}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs" title={r.problemDescription}>{r.problemDescription}</TableCell>
                      <TableCell>
                        <Badge variant={severityColors[r.severity]} className="uppercase text-[10px]">{r.severity}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.status === 'resolved' || r.status === 'closed' ? 'success' : 'primary'} className="uppercase text-[10px]">
                          {r.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[160px] text-xs text-muted-foreground truncate" title={r.resolutionNotes ?? ""}>
                        {r.resolutionNotes || '—'}
                      </TableCell>
                      <TableCell className="text-end">
                        {canRepair && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-emerald-400/50 text-emerald-400 hover:bg-emerald-400/10 gap-1.5"
                            onClick={() => {
                              setRepairTarget({ id: r.id, machineName: r.machineName });
                              setRepairForm({ resolutionNotes: "", partsUsed: "" });
                            }}
                          >
                            <Hammer className="w-3 h-3" /> {t("brokenMachines.status_resolved")}
                          </Button>
                        )}
                        {canResolve && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleManagerResolve(r.id)}
                            className="border-success text-success hover:bg-success hover:text-white gap-2"
                          >
                            <CheckCircle className="w-3 h-3" /> {t("downtime.resolve")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Report Modal */}
      <Modal isOpen={isReportOpen} onClose={() => { setIsReportOpen(false); resetForm(); }} title={t("brokenMachines.addRecord")}>
        <form onSubmit={handleReport} className="space-y-4">

          {/* Machine — QR scan required */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("brokenMachines.machine")} *</Label>
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
                <button type="button" onClick={resetForm} className="text-muted-foreground hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : scannedCode && !scannedMachine ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
                  <QrCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-amber-400">{t("machines.codeNotRegistered")}:</span>
                  <span className="font-mono text-white">{scannedCode}</span>
                  <button type="button" onClick={resetForm} className="ml-auto text-muted-foreground hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Input
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

          {scannedCode && !scannedMachine && (
            <div className="space-y-2">
              <Label>{t("common.line")} *</Label>
              <Input type="number" name="lineId" required placeholder="e.g. 2" />
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("brokenMachines.severity")} *</Label>
            <Select name="severity" required defaultValue="medium">
              <option value="low">{t("brokenMachines.severity_low")}</option>
              <option value="medium">{t("brokenMachines.severity_medium")}</option>
              <option value="high">{t("brokenMachines.severity_high")}</option>
              <option value="critical">{t("brokenMachines.severity_critical")}</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("brokenMachines.description")} *</Label>
            <textarea
              name="problemDescription"
              required
              rows={3}
              placeholder="Describe what happened..."
              className={TEXTAREA_CLS}
            />
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
              <Button type="button" variant="ghost" onClick={() => { setIsReportOpen(false); resetForm(); }}>{t("common.cancel")}</Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={createMutation.isPending || !scannedCode || (!!scannedCode && !scannedMachine && !machineNameManual.trim())}
              >
                {t("common.submit")}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Repair Modal */}
      <Modal isOpen={!!repairTarget} onClose={() => setRepairTarget(null)} title={`${t("brokenMachines.status_resolved")} — ${repairTarget?.machineName}`}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("downtime.rootCause")} *</Label>
            <textarea
              rows={3}
              value={repairForm.resolutionNotes}
              onChange={(e) => setRepairForm(f => ({ ...f, resolutionNotes: e.target.value }))}
              placeholder="e.g. Replaced worn motor belt..."
              className={TEXTAREA_CLS}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("common.notes")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
            <Input
              value={repairForm.partsUsed}
              onChange={(e) => setRepairForm(f => ({ ...f, partsUsed: e.target.value }))}
              placeholder="e.g. Drive belt P/N 4082..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
            <Button variant="outline" onClick={() => setRepairTarget(null)}>{t("common.cancel")}</Button>
            <Button
              onClick={handleRepair}
              disabled={updateMutation.isPending}
              className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white border-0"
            >
              <CheckCircle className="w-4 h-4" />
              {updateMutation.isPending ? t("common.loading") : t("common.confirm")}
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
