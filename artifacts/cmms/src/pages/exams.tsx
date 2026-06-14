import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Modal, Label, Input, Select } from "@/components/ui";
import {
  GraduationCap, Plus, ChevronDown, ChevronRight, Pencil, Trash2, Save,
  CheckCircle2, XCircle, Trophy, Users, BarChart2, Clock, MapPin, Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}/api/training-exams${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  const data = res.headers.get("content-type")?.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) throw new Error(typeof data === "object" ? (data as { error?: string }).error ?? "Failed" : data as string);
  return data;
}

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

interface Participant {
  userId: number;
  userName: string;
  userWorkId: string;
  role: string;
  team: string | null;
  department: string | null;
  result: { id: number; score: number | null; passed: boolean | null; notes: string | null; gradedAt: string | null } | null;
}

interface ExamStats {
  totalParticipants: number;
  graded: number;
  passed: number;
  failed: number;
  avgScore: number | null;
}

interface Exam {
  id: number;
  trainingId: number;
  trainingTitle: string | null;
  title: string;
  description: string | null;
  examDate: string;
  examTime: string;
  location: string | null;
  passingScore: number;
  team: string | null;
  createdByName: string | null;
  createdAt: string;
  participants: Participant[];
  stats: ExamStats;
}

interface TrainingOption {
  id: number;
  title: string;
  status: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin:       "text-red-400 border-red-400/30 bg-red-400/10",
  manager:     "text-blue-400 border-blue-400/30 bg-blue-400/10",
  teamleader:  "text-purple-400 border-purple-400/30 bg-purple-400/10",
  maintenance: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  inventory:   "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
};

function ScoreBadge({ score, passed }: { score: number | null; passed: boolean | null; passingScore: number }) {
  if (score === null) return <span className="text-muted-foreground text-xs">—</span>;
  const color = passed ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" : "text-red-400 border-red-400/30 bg-red-400/10";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded border ${color}`}>
      {passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {score}%
    </span>
  );
}

export default function Exams() {
  const { t } = useTranslation();
  const { user, isAdmin, isManager, isTeamLeader } = useAuth();
  const { toast } = useToast();
  const canManage = isAdmin || isManager || isTeamLeader;
  const isStrictTeamLeader = isTeamLeader && !isManager && !isAdmin;

  const [exams, setExams] = useState<Exam[]>([]);
  const [trainings, setTrainings] = useState<TrainingOption[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: number; fullName: string; username: string; role: string; team: string | null }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedExam, setExpandedExam] = useState<number | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Exam | null>(null);
  const [showResultModal, setShowResultModal] = useState<{ exam: Exam; participant: Participant } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  const [createForm, setCreateForm] = useState({
    trainingId: "", title: "", description: "",
    examDate: "", examTime: "09:00", location: "", passingScore: "60",
  });
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");

  const [editForm, setEditForm] = useState({
    title: "", description: "", examDate: "",
    examTime: "", location: "", passingScore: "60", team: "",
  });

  const [resultForm, setResultForm] = useState({ score: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const TEAMS = [
    { value: "assembly", label: t("teams.assembly") },
    { value: "test", label: t("teams.test") },
    { value: "packaging", label: t("teams.packaging") },
  ] as const;

  async function load() {
    try {
      const [examsData] = await Promise.all([api("")]);
      setExams(Array.isArray(examsData) ? examsData : []);
      if (canManage) {
        const [tData, uData] = await Promise.all([
          fetch(`${BASE}/api/training`, { credentials: "include" }).then(r => r.json()),
          fetch(`${BASE}/api/users`, { credentials: "include" }).then(r => r.json()),
        ]);
        setTrainings(Array.isArray(tData) ? tData : []);
        setAllUsers(Array.isArray(uData) ? uData : []);
      }
    } catch { /* silent */ } finally { setLoaded(true); }
  }

  useEffect(() => { load(); }, []);


  const resetCreateModal = () => {
    setShowCreateModal(false);
    setCreateForm({ trainingId: "", title: "", description: "", examDate: "", examTime: "09:00", location: "", passingScore: "60" });
    setSelectedParticipants([]);
    setParticipantSearch("");
  };

  async function handleCreate() {
    if (!createForm.trainingId || !createForm.title || !createForm.examDate || !createForm.examTime) {
      return toast({ title: t("common.error"), variant: "destructive" });
    }
    setBusy(true);
    try {
      await api("", {
        method: "POST",
        body: JSON.stringify({
          ...createForm,
          trainingId: parseInt(createForm.trainingId),
          passingScore: parseInt(createForm.passingScore) || 60,
          participantIds: selectedParticipants.length > 0 ? selectedParticipants : undefined,
        }),
      });
      toast({ title: t("common.success") });
      resetCreateModal();
      await load();
    } catch (e: unknown) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function handleEdit() {
    if (!showEditModal) return;
    setBusy(true);
    try {
      await api(`/${showEditModal.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...editForm, passingScore: parseInt(editForm.passingScore) || 60, team: editForm.team || null }),
      });
      toast({ title: t("common.success") });
      setShowEditModal(null);
      await load();
    } catch (e: unknown) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function handleDelete(id: number) {
    setBusy(true);
    try {
      await api(`/${id}`, { method: "DELETE" });
      toast({ title: t("common.success") });
      setShowDeleteConfirm(null);
      setExpandedExam(null);
      await load();
    } catch (e: unknown) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function handleSaveResult() {
    if (!showResultModal) return;
    const score = parseInt(resultForm.score);
    if (isNaN(score) || score < 0 || score > 100) {
      return toast({ title: t("common.error"), variant: "destructive" });
    }
    setBusy(true);
    try {
      await api(`/${showResultModal.exam.id}/results`, {
        method: "POST",
        body: JSON.stringify({ userId: showResultModal.participant.userId, score, notes: resultForm.notes }),
      });
      toast({ title: t("common.success") });
      setShowResultModal(null);
      setResultForm({ score: "", notes: "" });
      await load();
    } catch (e: unknown) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally { setBusy(false); }
  }

  const myExams = exams.filter(e =>
    canManage || e.participants.some(p => p.userId === user?.id)
  );

  const filteredExams = teamFilter
    ? myExams.filter(e => e.team === teamFilter)
    : myExams;

  const upcomingCount = myExams.filter(e => e.examDate >= new Date().toISOString().slice(0, 10)).length;
  const gradedCount   = myExams.reduce((s, e) => s + e.stats.graded, 0);
  const passedCount   = myExams.reduce((s, e) => s + e.stats.passed, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" />
            {t("exams.title")}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {canManage ? t("exams.subtitle_manager") : t("exams.subtitle_employee")}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {t("exams.scheduleExam")}
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t("exams.upcoming"), value: upcomingCount, icon: <Calendar className="w-5 h-5 text-primary" />, color: "text-primary" },
          { label: t("exams.graded"), value: gradedCount,   icon: <BarChart2 className="w-5 h-5 text-purple-400" />, color: "text-purple-400" },
          { label: t("exams.passed"), value: passedCount,   icon: <Trophy className="w-5 h-5 text-emerald-400" />, color: "text-emerald-400" },
        ].map(card => (
          <div key={card.label} className="bg-card border border-white/5 rounded-lg p-4 flex items-center gap-3">
            {card.icon}
            <div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Team Filter */}
      {canManage && (
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

      {/* Exam List */}
      {!loaded ? (
        <Card><div className="py-16 text-center text-muted-foreground">{t("common.loading")}</div></Card>
      ) : filteredExams.length === 0 ? (
        <Card><div className="py-16 text-center text-muted-foreground">{t("exams.noExams")}</div></Card>
      ) : (
        <div className="space-y-3">
          {filteredExams.map(exam => {
            const isExpanded = expandedExam === exam.id;
            const isPast = exam.examDate < new Date().toISOString().slice(0, 10);
            const myResult = exam.participants.find(p => p.userId === user?.id)?.result;

            return (
              <Card key={exam.id}>
                <div
                  className="p-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors rounded-lg"
                  onClick={() => setExpandedExam(isExpanded ? null : exam.id)}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white text-sm">{exam.title}</h3>
                        {isPast ? (
                          <span className="text-xs px-1.5 py-0.5 rounded border border-white/10 text-muted-foreground bg-white/5">{t("exams.past")}</span>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded border border-primary/30 text-primary bg-primary/10">{t("exams.upcoming")}</span>
                        )}
                        <TeamBadge team={exam.team} />
                        {!canManage && myResult && (
                          <ScoreBadge score={myResult.score} passed={myResult.passed} passingScore={exam.passingScore} />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{exam.trainingTitle ?? t("training.title")}</p>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{exam.examDate}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{exam.examTime}</span>
                        {exam.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{exam.location}</span>}
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{exam.stats.totalParticipants}</span>
                        <span className="text-muted-foreground/60">{t("exams.passingScore")}: {exam.passingScore}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs flex-shrink-0">
                    {exam.stats.graded > 0 && (
                      <>
                        <div className="text-center">
                          <div className="text-emerald-400 font-bold">{exam.stats.passed}</div>
                          <div className="text-muted-foreground">{t("exams.passed")}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-red-400 font-bold">{exam.stats.failed}</div>
                          <div className="text-muted-foreground">{t("exams.failed")}</div>
                        </div>
                        {exam.stats.avgScore !== null && (
                          <div className="text-center">
                            <div className={`font-bold ${exam.stats.avgScore >= exam.passingScore ? "text-emerald-400" : "text-amber-400"}`}>
                              {exam.stats.avgScore}%
                            </div>
                            <div className="text-muted-foreground">{t("exams.avg")}</div>
                          </div>
                        )}
                      </>
                    )}
                    {canManage && (
                      <div className="flex items-center gap-1 ms-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setEditForm({
                              title: exam.title, description: exam.description ?? "",
                              examDate: exam.examDate, examTime: exam.examTime,
                              location: exam.location ?? "", passingScore: String(exam.passingScore),
                              team: exam.team ?? "",
                            });
                            setShowEditModal(exam);
                          }}
                          className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(exam.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-white/10 p-4 space-y-4">
                    {exam.description && (
                      <p className="text-sm text-muted-foreground bg-white/5 rounded-lg px-3 py-2">{exam.description}</p>
                    )}

                    {!canManage && myResult && (
                      <div className={`rounded-lg border p-4 ${myResult.passed ? "border-emerald-400/20 bg-emerald-400/5" : "border-red-400/20 bg-red-400/5"}`}>
                        <p className={`font-semibold text-base ${myResult.passed ? "text-emerald-400" : "text-red-400"}`}>
                          {myResult.passed ? `✓ ${t("exams.passed")}` : `✗ ${t("exams.failed")}`}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t("exams.score")}: <span className="text-white font-bold">{myResult.score}%</span>
                          {" · "}{t("exams.passingScore")}: {exam.passingScore}%
                        </p>
                        {myResult.notes && <p className="text-xs text-muted-foreground mt-1">{myResult.notes}</p>}
                      </div>
                    )}

                    {canManage && exam.participants.length > 0 && (
                      <div className="overflow-x-auto rounded-lg border border-white/10">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("attendance.employee")}</TableHead>
                              <TableHead>{t("common.role")}</TableHead>
                              <TableHead>{t("teams.label")}</TableHead>
                              <TableHead className="text-center">{t("exams.score")}</TableHead>
                              <TableHead className="text-center">{t("exams.result")}</TableHead>
                              <TableHead className="text-center">{t("common.status")}</TableHead>
                              {canManage && <TableHead className="text-center">{t("common.actions")}</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {exam.participants.map(p => (
                              <TableRow key={p.userId}>
                                <TableCell>
                                  <div className="font-semibold text-white text-sm">{p.userName}</div>
                                  <div className="text-xs text-primary font-mono">{p.userWorkId}</div>
                                </TableCell>
                                <TableCell>
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase ${ROLE_COLORS[p.role] ?? ""}`}>
                                    {p.role}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <TeamBadge team={p.team} />
                                </TableCell>
                                <TableCell className="text-center">
                                  {p.result?.score !== null && p.result?.score !== undefined
                                    ? <span className="font-bold text-white">{p.result.score}%</span>
                                    : <span className="text-muted-foreground text-xs">—</span>}
                                </TableCell>
                                <TableCell className="text-center">
                                  <ScoreBadge score={p.result?.score ?? null} passed={p.result?.passed ?? null} passingScore={exam.passingScore} />
                                </TableCell>
                                <TableCell className="text-center">
                                  {p.result?.score !== null && p.result?.score !== undefined ? (
                                    <span className="text-xs text-emerald-400 flex items-center justify-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> {t("exams.graded")}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">{t("tasks.status_pending")}</span>
                                  )}
                                </TableCell>
                                {canManage && (
                                  <TableCell className="text-center">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs h-7 px-2"
                                      onClick={() => {
                                        setResultForm({
                                          score: p.result?.score !== null && p.result?.score !== undefined ? String(p.result.score) : "",
                                          notes: p.result?.notes ?? "",
                                        });
                                        setShowResultModal({ exam, participant: p });
                                      }}
                                    >
                                      {p.result?.score !== null && p.result?.score !== undefined ? t("exams.editResult") : t("exams.enterResult")}
                                    </Button>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {canManage && exam.participants.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">{t("exams.noParticipants")}</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title={t("exams.scheduleExam")}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("exams.linkedTraining")} *</Label>
            <Select value={createForm.trainingId} onChange={e => setCreateForm(f => ({ ...f, trainingId: e.target.value }))}>
              <option value="" className="bg-background">—</option>
              {trainings.map(tr => (
                <option key={tr.id} value={tr.id} className="bg-background">{tr.title} ({tr.status})</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("exams.examTitle")} *</Label>
            <Input placeholder="e.g. Safety Procedures Assessment" value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("exams.description")}</Label>
            <Input placeholder="Optional details..." value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("exams.examDate")} *</Label>
              <Input type="date" value={createForm.examDate} onChange={e => setCreateForm(f => ({ ...f, examDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("exams.examTime")} *</Label>
              <Input type="time" value={createForm.examTime} onChange={e => setCreateForm(f => ({ ...f, examTime: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("exams.location")}</Label>
              <Input placeholder="e.g. Training Room A" value={createForm.location} onChange={e => setCreateForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("exams.passingScore")} (%)</Label>
              <Input type="number" min="0" max="100" placeholder="60" value={createForm.passingScore} onChange={e => setCreateForm(f => ({ ...f, passingScore: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              {t("exams.participants")}
              {selectedParticipants.length > 0 && (
                <span className="ml-2 text-primary font-bold">{selectedParticipants.length} {t("common.selectedCount")}</span>
              )}
            </Label>
            <p className="text-xs text-muted-foreground">{t("exams.selectParticipants")}</p>
            <Input
              placeholder={t("common.search")}
              value={participantSearch}
              onChange={e => setParticipantSearch(e.target.value)}
            />
            <div className="max-h-48 overflow-y-auto custom-scrollbar border border-white/10 rounded-lg divide-y divide-white/5">
              {allUsers
                .filter(u =>
                  u.fullName.toLowerCase().includes(participantSearch.toLowerCase()) ||
                  u.username.toLowerCase().includes(participantSearch.toLowerCase())
                )
                .map(u => {
                  const checked = selectedParticipants.includes(u.id);
                  return (
                    <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={checked}
                        onChange={() => setSelectedParticipants(prev =>
                          checked ? prev.filter(id => id !== u.id) : [...prev, u.id]
                        )}
                      />
                      <span className="text-sm text-white flex-1">{u.fullName}</span>
                      {u.team && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase ${TEAM_COLORS[u.team] ?? "bg-muted/10 text-muted-foreground border-muted"}`}>
                          {u.team}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{u.username}</span>
                    </label>
                  );
                })}
              {allUsers.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">{t("common.loading")}</p>
              )}
            </div>
            {selectedParticipants.length === 0 && (
              <p className="text-xs text-amber-400/80">{t("exams.noParticipants")}</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={resetCreateModal}>{t("common.cancel")}</Button>
            <Button onClick={handleCreate} disabled={busy} className="gap-1.5">
              <Plus className="w-4 h-4" />
              {busy ? t("common.loading") : t("exams.scheduleExam")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      {showEditModal && (
        <Modal isOpen onClose={() => setShowEditModal(null)} title={`${t("common.edit")} — ${showEditModal.title}`}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("exams.examTitle")}</Label>
              <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("exams.description")}</Label>
              <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("exams.examDate")}</Label>
                <Input type="date" value={editForm.examDate} onChange={e => setEditForm(f => ({ ...f, examDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("exams.examTime")}</Label>
                <Input type="time" value={editForm.examTime} onChange={e => setEditForm(f => ({ ...f, examTime: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("exams.location")}</Label>
                <Input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("exams.passingScore")} (%)</Label>
                <Input type="number" min="0" max="100" value={editForm.passingScore} onChange={e => setEditForm(f => ({ ...f, passingScore: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("teams.label")}</Label>
              <Select
                value={editForm.team}
                onChange={e => setEditForm(f => ({ ...f, team: e.target.value }))}
                disabled={isStrictTeamLeader}
              >
                <option value="" className="bg-background">{t("teams.allTeams")}</option>
                {TEAMS.map(team => (
                  <option key={team.value} value={team.value} className="bg-background">{team.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowEditModal(null)}>{t("common.cancel")}</Button>
              <Button onClick={handleEdit} disabled={busy} className="gap-1.5">
                <Save className="w-4 h-4" />
                {busy ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Result Modal */}
      {showResultModal && (
        <Modal isOpen onClose={() => setShowResultModal(null)} title={`${t("exams.enterResult")} — ${showResultModal.participant.userName}`}>
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm">
              <p className="text-white font-semibold">{showResultModal.exam.title}</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {showResultModal.exam.examDate} · {showResultModal.exam.examTime}
                {showResultModal.exam.location ? ` · ${showResultModal.exam.location}` : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("exams.passingScore")}: <span className="text-amber-400 font-semibold">{showResultModal.exam.passingScore}%</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("exams.score")} (0–100) *</Label>
              <Input
                type="number" min="0" max="100" placeholder="0"
                value={resultForm.score}
                onChange={e => setResultForm(f => ({ ...f, score: e.target.value }))}
              />
              {resultForm.score !== "" && (() => {
                const s = parseInt(resultForm.score);
                const passes = s >= showResultModal.exam.passingScore;
                return (
                  <div className={`flex items-center gap-1.5 text-xs ${passes ? "text-emerald-400" : "text-red-400"}`}>
                    {passes ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {passes ? t("exams.passed") : t("exams.failed")}
                  </div>
                );
              })()}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t("common.notes")} ({t("common.optional")})</Label>
              <Input placeholder="Any remarks..." value={resultForm.notes} onChange={e => setResultForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowResultModal(null)}>{t("common.cancel")}</Button>
              <Button onClick={handleSaveResult} disabled={busy || !resultForm.score} className="gap-1.5">
                <Save className="w-4 h-4" />
                {busy ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm !== null && (
        <Modal isOpen onClose={() => setShowDeleteConfirm(null)} title={t("common.delete")}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("common.confirm")}</p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>{t("common.cancel")}</Button>
              <Button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={busy}
                className="bg-red-500 hover:bg-red-600 text-white gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                {busy ? t("common.loading") : t("common.delete")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
