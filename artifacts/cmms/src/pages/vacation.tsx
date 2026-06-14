import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Input, Label, Modal } from "@/components/ui";
import { Palmtree, Plus, CheckCircle2, XCircle, Clock } from "lucide-react";
import { FilterBar, type FilterState } from "@/components/filter-bar";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const TEAMS = ["assembly", "test", "packaging"] as const;
const TEAM_COLORS: Record<string, string> = {
  assembly: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  test:     "text-amber-400 border-amber-400/30 bg-amber-400/10",
  packaging:"text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
};

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}/api/vacation-requests${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Request failed");
  }
  return res.json();
}

interface VacationRequest {
  id: number;
  userId: number;
  userName: string | null;
  userTeam?: string | null;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  managerApproved: boolean | null;
  managerApprovedByName: string | null;
  managerApprovedAt: string | null;
  teamLeaderApproved: boolean | null;
  teamLeaderApprovedByName: string | null;
  teamLeaderApprovedAt: string | null;
  createdAt: string | null;
}

function useVacations() {
  const [data, setData] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try { setData(await apiFetch("")); } finally { setLoading(false); }
  };
  return { data, loading, load };
}

const STATUS_STYLES: Record<string, string> = {
  pending: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  approved: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  rejected: "text-red-400 border-red-400/30 bg-red-400/10",
  cancelled: "text-muted-foreground border-white/10 bg-white/5",
};

const APPROVAL_ICON = {
  true: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  false: <XCircle className="w-4 h-4 text-red-400" />,
  null: <Clock className="w-4 h-4 text-amber-400/60" />,
};

export default function Vacation() {
  const { t } = useTranslation();
  const { user, isTeamLeader, isManager, isAdmin } = useAuth();
  const { data, loading, load } = useVacations();
  const [loaded, setLoaded] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ date: "", shift: "", search: "", status: "" });
  const [teamFilter, setTeamFilter] = useState("");
  const [newForm, setNewForm] = useState({ startDate: "", endDate: "", reason: "" });
  const [newError, setNewError] = useState("");
  const [newBusy, setNewBusy] = useState(false);

  if (!loaded) { load(); setLoaded(true); }

  const canApprove = isAdmin || isManager || isTeamLeader;
  const isStrictTeamLeader = isTeamLeader && !isManager && !isAdmin;

  async function handleSubmit() {
    setNewError("");
    if (!newForm.startDate || !newForm.endDate || !newForm.reason.trim()) {
      setNewError(t("common.required"));
      return;
    }
    setNewBusy(true);
    try {
      await apiFetch("", { method: "POST", body: JSON.stringify(newForm) });
      setShowNew(false);
      setNewForm({ startDate: "", endDate: "", reason: "" });
      load();
    } catch (e: unknown) {
      setNewError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setNewBusy(false);
    }
  }

  async function handleApprove(id: number, approved: boolean) {
    await apiFetch(`/${id}/approve`, { method: "PUT", body: JSON.stringify({ approved }) });
    load();
  }

  async function handleCancel(id: number) {
    await apiFetch(`/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = data.filter(r => {
    if (filters.date && r.startDate !== filters.date) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (teamFilter && r.userTeam !== teamFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <Palmtree className="w-6 h-6 text-primary" />
            {t("vacation.title")}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {canApprove ? t("vacation.managerApproval") : t("vacation.addRequest")}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          {t("vacation.addRequest")}
        </Button>
      </div>

      {canApprove && data.filter(r => r.status === "pending").length > 0 && (
        <div className="bg-amber-400/10 border border-amber-400/20 rounded-lg px-4 py-3 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <p className="text-amber-400 text-sm font-medium">
            {data.filter(r => r.status === "pending").length} {t("vacation.status_pending")}
          </p>
        </div>
      )}

      <FilterBar
        filters={filters}
        onChange={setFilters}
        showShift={false}
        statusOptions={[
          { value: "pending", label: t("vacation.status_pending") },
          { value: "approved", label: t("vacation.status_approved") },
          { value: "rejected", label: t("vacation.status_rejected") },
        ]}
      />

      {/* Team filter (not for strict team leader who already sees only their team) */}
      {canApprove && !isStrictTeamLeader && (
        <div className="flex gap-2 flex-wrap">
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
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {canApprove && <TableHead>{t("attendance.employee")}</TableHead>}
                {canApprove && !isStrictTeamLeader && <TableHead>{t("teams.label")}</TableHead>}
                <TableHead>{t("vacation.startDate")}</TableHead>
                <TableHead>{t("vacation.endDate")}</TableHead>
                <TableHead>{t("vacation.reason")}</TableHead>
                <TableHead>{t("vacation.managerApproval")}</TableHead>
                <TableHead>{t("vacation.teamLeaderApproval")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">{t("vacation.noRequests")}</TableCell></TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    {canApprove && (
                      <TableCell className="font-semibold text-white text-sm">{r.userName}</TableCell>
                    )}
                    {canApprove && !isStrictTeamLeader && (
                      <TableCell>
                        {r.userTeam ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${TEAM_COLORS[r.userTeam] ?? "border-white/10 text-muted-foreground"}`}>
                            {t(`teams.${r.userTeam}`)}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-sm">{r.startDate}</TableCell>
                    <TableCell className="font-mono text-sm">{r.endDate}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{r.reason}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {APPROVAL_ICON[String(r.managerApproved) as keyof typeof APPROVAL_ICON]}
                        <span className="text-xs text-muted-foreground">
                          {r.managerApproved === true ? r.managerApprovedByName : r.managerApproved === false ? t("vacation.status_rejected") : t("vacation.status_pending")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {APPROVAL_ICON[String(r.teamLeaderApproved) as keyof typeof APPROVAL_ICON]}
                        <span className="text-xs text-muted-foreground">
                          {r.teamLeaderApproved === true ? r.teamLeaderApprovedByName : r.teamLeaderApproved === false ? t("vacation.status_rejected") : t("vacation.status_pending")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded border uppercase ${STATUS_STYLES[r.status] ?? ""}`}>
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin && r.status === "pending" && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 font-semibold" onClick={() => handleApprove(r.id, true)}>✓</Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={() => handleApprove(r.id, false)}>✕</Button>
                          </>
                        )}
                        {isManager && !isAdmin && r.status === "pending" && r.managerApproved === null && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10" onClick={() => handleApprove(r.id, true)}>{t("vacation.approve")}</Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={() => handleApprove(r.id, false)}>{t("vacation.reject")}</Button>
                          </>
                        )}
                        {isTeamLeader && !isAdmin && r.status === "pending" && r.teamLeaderApproved === null && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10" onClick={() => handleApprove(r.id, true)}>{t("vacation.approve")}</Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={() => handleApprove(r.id, false)}>{t("vacation.reject")}</Button>
                          </>
                        )}
                        {r.userId === user?.id && r.status === "pending" && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-red-400" onClick={() => handleCancel(r.id)}>{t("common.cancel")}</Button>
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

      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title={t("vacation.addRequest")}>
        <div className="space-y-4">
          {newError && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{newError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("vacation.startDate")} *</Label>
              <Input type="date" value={newForm.startDate} onChange={(e) => setNewForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("vacation.endDate")} *</Label>
              <Input type="date" value={newForm.endDate} onChange={(e) => setNewForm((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("vacation.reason")} *</Label>
            <textarea
              value={newForm.reason}
              onChange={(e) => setNewForm((f) => ({ ...f, reason: e.target.value }))}
              rows={3}
              placeholder="Enter the reason for your vacation request..."
              className="flex w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowNew(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={newBusy}>
              {newBusy ? t("common.loading") : t("common.submit")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
