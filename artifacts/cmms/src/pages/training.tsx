import { useState } from "react";
import { useGetTrainingPlans, useCreateTrainingPlan, useGetUsers } from "@workspace/api-client-react";
import { Button, Input, Select, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Modal, Label } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { GraduationCap, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { FilterBar, matchesDateFilter, matchesSearch, type FilterState } from "@/components/filter-bar";
import { useTranslation } from "react-i18next";

const TEAMS = ["assembly", "test", "packaging"] as const;
const TEAM_COLORS: Record<string, string> = {
  assembly: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  test:     "text-amber-400 border-amber-400/30 bg-amber-400/10",
  packaging:"text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
};

export default function Training() {
  const { t } = useTranslation();
  const { data: plans, isLoading } = useGetTrainingPlans();
  const { data: allUsers } = useGetUsers();
  const createMutation = useCreateTrainingPlan();
  const { toast } = useToast();
  const { isMaintenance, isTeamLeader, isManager, isAdmin, user } = useAuth();
  const isStrictTeamLeader = isTeamLeader && !isManager && !isAdmin;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ date: "", shift: "", search: "", status: "" });
  const [teamFilter, setTeamFilter] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [formTeam, setFormTeam] = useState("");

  const toggleParticipant = (id: number) => {
    setSelectedParticipants(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await createMutation.mutateAsync({
        data: {
          title: fd.get("title") as string,
          trainerName: fd.get("trainerName") as string,
          scheduledDate: fd.get("scheduledDate") as string,
          location: fd.get("location") as string,
          team: isStrictTeamLeader ? (user?.team ?? undefined) : (formTeam || undefined),
          participants: selectedParticipants as any,
        } as any
      });
      setIsAddOpen(false);
      setSelectedParticipants([]);
      setParticipantSearch("");
      setFormTeam("");
      toast({ title: t("common.success") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  };

  const filtered = (plans ?? []).filter((p) => {
    if (!matchesDateFilter(p.scheduledDate, filters.date)) return false;
    if (filters.status && p.status !== filters.status) return false;
    if (teamFilter && (p as any).team !== teamFilter) return false;
    return matchesSearch([p.title, p.trainerName, p.location], filters.search);
  });

  // For participant picker: team leaders only see their team's users
  const pickableUsers = isStrictTeamLeader
    ? (allUsers ?? []).filter(u => !user?.team || (u as any).team === user.team)
    : (allUsers ?? []);

  const filteredUsers = pickableUsers.filter(u =>
    u.fullName.toLowerCase().includes(participantSearch.toLowerCase()) ||
    u.username.toLowerCase().includes(participantSearch.toLowerCase())
  );

  const closeModal = () => { setIsAddOpen(false); setSelectedParticipants([]); setParticipantSearch(""); setFormTeam(""); };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">{t("training.title")}</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {isMaintenance ? t("training.noPlans") : t("training.title")}
          </p>
        </div>
        {!isMaintenance && (
          <Button onClick={() => setIsAddOpen(true)} className="gap-2 tech-border">
            <GraduationCap className="w-4 h-4" /> {t("training.addPlan")}
          </Button>
        )}
      </div>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        showShift={false}
        showSearch
        statusOptions={[
          { value: "scheduled", label: t("training.status_scheduled") },
          { value: "completed", label: t("training.status_completed") },
          { value: "cancelled", label: t("training.status_cancelled") },
        ]}
      />

      {!isStrictTeamLeader && (
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
                <TableHead>{t("training.topic")}</TableHead>
                <TableHead>{t("teams.label")}</TableHead>
                <TableHead>{t("training.trainer")}</TableHead>
                <TableHead>{t("training.participants")}</TableHead>
                <TableHead>{t("training.date")}</TableHead>
                <TableHead>{t("training.location")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("training.noPlans")}</TableCell></TableRow>
              ) : (
                filtered.map(p => {
                  const pTeam = (p as any).team as string | null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-semibold text-white">{p.title}</TableCell>
                      <TableCell>
                        {pTeam ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${TEAM_COLORS[pTeam] ?? "border-white/10 text-muted-foreground"}`}>
                            {t(`teams.${pTeam}`)}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">{t("teams.allTeams")}</span>}
                      </TableCell>
                      <TableCell>{p.trainerName || '—'}</TableCell>
                      <TableCell>
                        {(p as any).participantNames?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(p as any).participantNames.map((name: string) => (
                              <span key={name} className="text-xs bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5">{name}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(p.scheduledDate).split(',')[0]} {p.scheduledTime}</TableCell>
                      <TableCell>{p.location || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'completed' ? 'success' : 'primary'} className="uppercase text-[10px]">
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {!isMaintenance && (
        <Modal isOpen={isAddOpen} onClose={closeModal} title={t("training.addPlan")}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("training.topic")}</Label>
              <Input name="title" required placeholder="e.g. Robot Arm Calibration" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("training.trainer")}</Label>
                <Input name="trainerName" placeholder="e.g. John Doe" />
              </div>
              <div className="space-y-2">
                <Label>{t("training.location")}</Label>
                <Input name="location" placeholder="e.g. Room B" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("training.date")}</Label>
                <Input type="date" name="scheduledDate" required />
              </div>
              {!isStrictTeamLeader && (
                <div className="space-y-2">
                  <Label>{t("teams.label")}</Label>
                  <Select value={formTeam} onChange={e => setFormTeam(e.target.value)}>
                    <option value="" className="bg-background">{t("teams.allTeams")}</option>
                    {TEAMS.map(team => (
                      <option key={team} value={team} className="bg-background capitalize">{t(`teams.${team}`)}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                {t("training.participants")}
                {selectedParticipants.length > 0 && (
                  <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                    {selectedParticipants.length}
                  </span>
                )}
              </Label>
              <Input
                placeholder={t("common.search")}
                value={participantSearch}
                onChange={e => setParticipantSearch(e.target.value)}
              />
              <div className="max-h-40 overflow-y-auto custom-scrollbar border border-white/10 rounded-lg divide-y divide-white/5">
                {filteredUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">{t("common.noData")}</p>
                ) : (
                  filteredUsers.map(u => {
                    const uTeam = (u as any).team as string | null;
                    return (
                      <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors">
                        <input type="checkbox" className="accent-primary" checked={selectedParticipants.includes(u.id)} onChange={() => toggleParticipant(u.id)} />
                        <span className="text-sm text-white">{u.fullName}</span>
                        {uTeam && <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase ms-auto ${TEAM_COLORS[uTeam] ?? ""}`}>{t(`teams.${uTeam}`)}</span>}
                      </label>
                    );
                  })
                )}
              </div>
              {selectedParticipants.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {selectedParticipants.map(id => {
                    const u = (allUsers ?? []).find(x => x.id === id);
                    return u ? (
                      <span key={id} className="text-xs bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5 flex items-center gap-1">
                        {u.fullName}
                        <button type="button" onClick={() => toggleParticipant(id)} className="ms-1 hover:text-red-400">×</button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-white/10 mt-4">
              <Button type="button" variant="ghost" onClick={closeModal}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={createMutation.isPending}>{t("common.save")}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
