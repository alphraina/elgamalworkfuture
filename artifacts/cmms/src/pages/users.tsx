import { useState, useRef, useEffect } from "react";
import { useGetUsers } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { FilterBar, type FilterState } from "@/components/filter-bar";
import {
  Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Badge, Button, Input, Label, Select, Modal,
} from "@/components/ui";
import { UserPlus, Pencil, Trash2, ShieldCheck, RefreshCw, Lock, Clock, CheckCircle, XCircle, ToggleLeft, ToggleRight, Users as UsersIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

const ROLES = ["admin", "manager", "teamleader", "maintenance", "inventory"] as const;
type Role = typeof ROLES[number];

const TEAMS = ["assembly", "test", "packaging"] as const;
const TEAM_COLORS: Record<string, string> = {
  assembly: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  test:     "text-amber-400 border-amber-400/30 bg-amber-400/10",
  packaging:"text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
};
const TEAM_ROLES: Role[] = ["teamleader", "maintenance"];

function TeamSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <Select value={value} onChange={e => onChange(e.target.value)}>
      <option value="" className="bg-background">{t("teams.noTeam")}</option>
      {TEAMS.map(team => <option key={team} value={team} className="bg-background capitalize">{t(`teams.${team}`)}</option>)}
    </Select>
  );
}

const ROLE_COLORS: Record<string, string> = {
  admin:       "text-red-400 border-red-400/30 bg-red-400/10",
  manager:     "text-blue-400 border-blue-400/30 bg-blue-400/10",
  teamleader:  "text-purple-400 border-purple-400/30 bg-purple-400/10",
  maintenance: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  inventory:   "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", manager: "Manager", teamleader: "Team Leader",
  maintenance: "Maintenance", inventory: "Inventory",
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
      {children}
    </div>
  );
}

function RoleBadges({ role, extraRoles }: { role: string; extraRoles?: string[] | null }) {
  const all = [role, ...(extraRoles ?? [])].filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1">
      {all.map((r, i) => (
        <span key={r} className={`text-xs font-semibold px-2 py-0.5 rounded border uppercase ${ROLE_COLORS[r] ?? ""} ${i === 0 ? "" : "opacity-70"}`}>
          {ROLE_LABELS[r] ?? r}
        </span>
      ))}
    </div>
  );
}

function ExtraRolesChecklist({ primary, selected, onChange }: {
  primary: Role;
  selected: Role[];
  onChange: (roles: Role[]) => void;
}) {
  const available = ROLES.filter(r => r !== primary);
  return (
    <div className="border border-white/10 rounded-lg divide-y divide-white/5">
      {available.map(r => (
        <label key={r} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors">
          <input
            type="checkbox"
            className="accent-primary"
            checked={selected.includes(r)}
            onChange={e => {
              if (e.target.checked) onChange([...selected, r]);
              else onChange(selected.filter(x => x !== r));
            }}
          />
          <span className={`text-xs font-semibold px-2 py-0.5 rounded border uppercase ${ROLE_COLORS[r]}`}>
            {ROLE_LABELS[r]}
          </span>
        </label>
      ))}
    </div>
  );
}

async function apiPut(id: number, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Update failed");
  }
  return res.json();
}

async function apiPost(body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Create failed");
  }
  return res.json();
}

async function apiDelete(id: number) {
  const res = await fetch(`${BASE}/api/users/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Delete failed");
  }
  return res.json();
}

interface AddForm {
  username: string; password: string; fullName: string; email: string;
  role: Role; extraRoles: Role[]; team: string; department: string; phone: string;
}
interface EditForm {
  fullName: string; email: string; role: Role; extraRoles: Role[];
  team: string; department: string; phone: string; newPassword: string;
}

const emptyAdd: AddForm = {
  username: "", password: "", fullName: "", email: "",
  role: "maintenance", extraRoles: [], team: "", department: "", phone: "",
};

interface PendingUser {
  id: number; username: string; fullName: string; email?: string;
  department?: string; phone?: string; createdAt?: string;
}

export default function Users() {
  const { t } = useTranslation();
  const { isAdmin, user: me } = useAuth();
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useGetUsers({ query: { enabled: isAdmin } });

  const [activeTab, setActiveTab] = useState<"users" | "pending">("users");

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(emptyAdd);
  const [addError, setAddError] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    fullName: "", email: "", role: "maintenance", extraRoles: [],
    department: "", phone: "", newPassword: "",
  });
  const [editError, setEditError] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const editTargetId = useRef<number | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [userFilters, setUserFilters] = useState<FilterState>({ date: "", shift: "", search: "", status: "" });

  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [approveRoles, setApproveRoles] = useState<Record<number, Role>>({});
  const [approveTeams, setApproveTeams] = useState<Record<number, string>>({});
  const [approveError, setApproveError] = useState<Record<number, string>>({});
  const [approveBusy, setApproveBusy] = useState<Record<number, boolean>>({});

  const [signupEnabled, setSignupEnabled] = useState<boolean>(false);
  const [signupToggleBusy, setSignupToggleBusy] = useState(false);
  const [publicDowntimeEnabled, setPublicDowntimeEnabled] = useState<boolean>(false);
  const [publicDowntimeToggleBusy, setPublicDowntimeToggleBusy] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    fetch(`${BASE}/api/site-settings`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        setSignupEnabled(d.signupEnabled ?? false);
        setPublicDowntimeEnabled(d.publicDowntimeEnabled ?? false);
      })
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || activeTab !== "pending") return;
    loadPending();
  }, [isAdmin, activeTab]);

  async function loadPending() {
    setPendingLoading(true);
    try {
      const res = await fetch(`${BASE}/api/users/pending`, { credentials: "include" });
      const data = await res.json();
      setPendingUsers(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setPendingLoading(false); }
  }

  async function handleToggleSignup() {
    setSignupToggleBusy(true);
    try {
      const res = await fetch(`${BASE}/api/site-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ signupEnabled: !signupEnabled }),
      });
      const data = await res.json();
      setSignupEnabled(data.signupEnabled);
    } catch { /* silent */ }
    finally { setSignupToggleBusy(false); }
  }

  async function handleTogglePublicDowntime() {
    setPublicDowntimeToggleBusy(true);
    try {
      const res = await fetch(`${BASE}/api/site-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ publicDowntimeEnabled: !publicDowntimeEnabled }),
      });
      const data = await res.json();
      setPublicDowntimeEnabled(data.publicDowntimeEnabled);
    } catch { /* silent */ }
    finally { setPublicDowntimeToggleBusy(false); }
  }

  async function handleApprove(u: PendingUser) {
    const role = approveRoles[u.id];
    if (!role) {
      setApproveError(prev => ({ ...prev, [u.id]: t("pendingApprovals.roleRequired") }));
      return;
    }
    setApproveError(prev => ({ ...prev, [u.id]: "" }));
    setApproveBusy(prev => ({ ...prev, [u.id]: true }));
    const team = approveTeams[u.id] || undefined;
    try {
      await fetch(`${BASE}/api/users/${u.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role, team }),
      });
      queryClient.invalidateQueries();
      setPendingUsers(prev => prev.filter(p => p.id !== u.id));
    } catch (e: any) {
      setApproveError(prev => ({ ...prev, [u.id]: e.message }));
    } finally {
      setApproveBusy(prev => ({ ...prev, [u.id]: false }));
    }
  }

  async function handleReject(u: PendingUser) {
    setApproveBusy(prev => ({ ...prev, [u.id]: true }));
    try {
      await fetch(`${BASE}/api/users/${u.id}/reject`, {
        method: "POST",
        credentials: "include",
      });
      queryClient.invalidateQueries();
      setPendingUsers(prev => prev.filter(p => p.id !== u.id));
    } catch { /* silent */ }
    finally {
      setApproveBusy(prev => ({ ...prev, [u.id]: false }));
    }
  }

  if (!isAdmin) {
    return <div className="p-8 text-center text-destructive">{t("common.unauthorized")}</div>;
  }

  function openAdd() {
    setAddForm(emptyAdd);
    setAddError("");
    setShowAdd(true);
  }

  function openEdit(u: (typeof users)[0]) {
    editTargetId.current = u.id;
    setEditUsername(u.username);
    setEditForm({
      fullName: u.fullName ?? "",
      email: u.email ?? "",
      role: (u.role as Role) ?? "maintenance",
      extraRoles: ((u as any).extraRoles ?? []) as Role[],
      team: (u as any).team ?? "",
      department: u.department ?? "",
      phone: u.phone ?? "",
      newPassword: "",
    });
    setEditError("");
    setShowEdit(true);
  }

  async function handleCreate() {
    setAddError("");
    if (!addForm.username.trim() || !addForm.password.trim() || !addForm.fullName.trim()) {
      setAddError(t("common.required"));
      return;
    }
    setAddBusy(true);
    try {
      await apiPost({
        username: addForm.username.trim(),
        password: addForm.password,
        fullName: addForm.fullName.trim(),
        email: addForm.email || undefined,
        role: addForm.role,
        extraRoles: addForm.extraRoles,
        team: addForm.team || undefined,
        department: addForm.department || undefined,
        phone: addForm.phone || undefined,
      });
      queryClient.invalidateQueries();
      setShowAdd(false);
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setAddBusy(false);
    }
  }

  async function handleUpdate() {
    const id = editTargetId.current;
    if (!id) return;
    setEditError("");
    setEditBusy(true);
    try {
      const body: Record<string, unknown> = {
        fullName: editForm.fullName.trim(),
        email: editForm.email || undefined,
        role: editForm.role,
        extraRoles: editForm.extraRoles,
        team: editForm.team || null,
        department: editForm.department || undefined,
        phone: editForm.phone || undefined,
      };
      if (editForm.newPassword.trim()) body.password = editForm.newPassword.trim();
      await apiPut(id, body);
      queryClient.invalidateQueries();
      setShowEdit(false);
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setEditBusy(false);
    }
  }

  async function handleToggleActive(u: (typeof users)[0]) {
    try {
      await apiPut(u.id, { isActive: !u.isActive });
      queryClient.invalidateQueries();
    } catch { /* silent */ }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await apiDelete(deleteTarget.id);
      queryClient.invalidateQueries();
      setDeleteTarget(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setDeleteBusy(false);
    }
  }

  const roleCounts = ROLES.reduce<Record<string, number>>((acc, r) => {
    acc[r] = users.filter(u => u.role === r).length;
    return acc;
  }, {});

  const filteredUsers = users.filter(u => {
    if (userFilters.status && u.role !== userFilters.status) return false;
    if (!userFilters.search) return true;
    const q = userFilters.search.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.department ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            {t("users.title")}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">{t("users.subtitle")}</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <UserPlus className="w-4 h-4" /> {t("users.addUser")}
        </Button>
      </div>

      {/* Signup toggle */}
      <div
        className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
          signupEnabled
            ? "bg-green-500/10 border-green-500/30"
            : "bg-white/5 border-white/10"
        }`}
      >
        <div className="flex items-center gap-3">
          {signupEnabled
            ? <ToggleRight className="w-5 h-5 text-green-400" />
            : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
          <div>
            <p className="text-sm font-medium text-white">{t("pendingApprovals.signupToggle")}</p>
            <p className="text-xs text-muted-foreground">
              {signupEnabled ? t("pendingApprovals.signupEnabled") : t("pendingApprovals.signupDisabled")}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={signupEnabled ? "destructive" : "outline"}
          onClick={handleToggleSignup}
          disabled={signupToggleBusy}
          className="min-w-[90px]"
        >
          {signupToggleBusy ? "..." : signupEnabled ? t("common.close") ?? "Close" : t("common.open") ?? "Open"}
        </Button>
      </div>

      {/* Public downtime toggle */}
      <div
        className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
          publicDowntimeEnabled
            ? "bg-red-500/10 border-red-500/30"
            : "bg-white/5 border-white/10"
        }`}
      >
        <div className="flex items-center gap-3">
          {publicDowntimeEnabled
            ? <ToggleRight className="w-5 h-5 text-red-400" />
            : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
          <div>
            <p className="text-sm font-medium text-white">{t("publicDowntime.toggle")}</p>
            <p className="text-xs text-muted-foreground">
              {publicDowntimeEnabled ? t("publicDowntime.toggleEnabled") : t("publicDowntime.toggleDisabled")}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={publicDowntimeEnabled ? "destructive" : "outline"}
          onClick={handleTogglePublicDowntime}
          disabled={publicDowntimeToggleBusy}
          className="min-w-[90px]"
        >
          {publicDowntimeToggleBusy ? "..." : publicDowntimeEnabled ? t("common.close") ?? "Close" : t("common.open") ?? "Open"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "users"
              ? "border-primary text-white"
              : "border-transparent text-muted-foreground hover:text-white"
          }`}
        >
          <UsersIcon className="w-4 h-4" />
          {t("users.title")}
          <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded">{users.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "pending"
              ? "border-amber-400 text-white"
              : "border-transparent text-muted-foreground hover:text-white"
          }`}
        >
          <Clock className="w-4 h-4" />
          {t("pendingApprovals.title")}
          {pendingUsers.length > 0 && (
            <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
              {pendingUsers.length}
            </span>
          )}
        </button>
      </div>

      {/* All Users tab */}
      {activeTab === "users" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {ROLES.map((role) => (
              <div key={role} className="bg-card border border-white/5 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{ROLE_LABELS[role]}</p>
                  <p className="text-2xl font-bold text-white mt-1">{roleCounts[role]}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded border uppercase ${ROLE_COLORS[role]}`}>{role}</span>
              </div>
            ))}
          </div>

          <FilterBar
            filters={userFilters}
            onChange={setUserFilters}
            showDate={false}
            showShift={false}
            showSearch
            statusOptions={ROLES.map(r => ({ value: r, label: ROLE_LABELS[r] }))}
          />

          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{t("users.fullName")}</TableHead>
                    <TableHead>{t("users.workId")}</TableHead>
                    <TableHead>{t("users.roles")}</TableHead>
                    <TableHead>{t("teams.label")}</TableHead>
                    <TableHead>{t("users.department")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead className="text-end">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{t("common.noData")}</TableCell></TableRow>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelf = me?.id === u.id;
                      return (
                        <TableRow key={u.id} className={!u.isActive ? "opacity-50" : ""}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{u.id}</TableCell>
                          <TableCell className="font-semibold text-white">
                            {u.fullName}
                            {isSelf && <span className="ms-2 text-[10px] text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5 font-semibold">YOU</span>}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{u.username}</TableCell>
                          <TableCell>
                            <RoleBadges role={u.role ?? "maintenance"} extraRoles={(u as any).extraRoles} />
                          </TableCell>
                          <TableCell>
                            {(u as any).team ? (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${TEAM_COLORS[(u as any).team] ?? ""}`}>
                                {t(`teams.${(u as any).team}`)}
                              </span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{u.department ?? "—"}</TableCell>
                          <TableCell>
                            {u.isActive
                              ? <Badge variant="success" className="text-[10px]">{t("users.active")}</Badge>
                              : <Badge variant="destructive" className="text-[10px]">{t("users.inactive")}</Badge>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-white" onClick={() => openEdit(u)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              {isSelf ? (
                                <span className="h-7 w-7 flex items-center justify-center opacity-25 cursor-not-allowed">
                                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                                </span>
                              ) : (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-amber-400" onClick={() => handleToggleActive(u)}>
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget({ id: u.id, name: u.fullName })}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      {/* Pending Approvals tab */}
      {activeTab === "pending" && (
        <Card>
          <div className="p-4 border-b border-white/10">
            <p className="text-sm text-muted-foreground">{t("pendingApprovals.subtitle")}</p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("users.fullName")}</TableHead>
                  <TableHead>{t("users.workId")}</TableHead>
                  <TableHead>{t("users.email")}</TableHead>
                  <TableHead>{t("users.department")}</TableHead>
                  <TableHead>{t("users.phone")}</TableHead>
                  <TableHead>{t("users.primaryRole")}</TableHead>
                  <TableHead className="text-end">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
                ) : pendingUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <CheckCircle className="w-10 h-10 text-green-400/40 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">{t("pendingApprovals.noData")}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingUsers.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-semibold text-white">{u.fullName}</TableCell>
                      <TableCell className="font-mono text-sm">{u.username}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{u.email ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{u.department ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{u.phone ?? "—"}</TableCell>
                      <TableCell>
                        <div className="space-y-1.5 min-w-[240px]">
                          <Select
                            value={approveRoles[u.id] ?? ""}
                            onChange={e => setApproveRoles(prev => ({ ...prev, [u.id]: e.target.value as Role }))}
                            className="text-xs h-8"
                          >
                            <option value="" disabled className="bg-background">{t("pendingApprovals.selectRole")}</option>
                            {ROLES.map(r => <option key={r} value={r} className="bg-background capitalize">{ROLE_LABELS[r]}</option>)}
                          </Select>
                          {TEAM_ROLES.includes(approveRoles[u.id]) && (
                            <Select
                              value={approveTeams[u.id] ?? ""}
                              onChange={e => setApproveTeams(prev => ({ ...prev, [u.id]: e.target.value }))}
                              className="text-xs h-8"
                            >
                              <option value="" className="bg-background">{t("teams.noTeam")}</option>
                              {TEAMS.map(team => <option key={team} value={team} className="bg-background capitalize">{t(`teams.${team}`)}</option>)}
                            </Select>
                          )}
                          {approveError[u.id] && (
                            <p className="text-[10px] text-destructive">{approveError[u.id]}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            className="gap-1.5 bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                            onClick={() => handleApprove(u)}
                            disabled={approveBusy[u.id]}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {t("pendingApprovals.approve")}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1.5 h-8 text-xs"
                            onClick={() => handleReject(u)}
                            disabled={approveBusy[u.id]}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            {t("pendingApprovals.reject")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Add Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title={t("users.addUser")}>
        <div className="space-y-4">
          {addError && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{addError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={`${t("users.workId")} *`}>
              <Input value={addForm.username} onChange={e => setAddForm(f => ({ ...f, username: e.target.value }))} placeholder="EG52000" autoComplete="off" />
            </Field>
            <Field label={`${t("users.password")} *`}>
              <Input type="password" value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} placeholder="••••" autoComplete="new-password" />
            </Field>
          </div>
          <Field label={`${t("users.fullName")} *`}>
            <Input value={addForm.fullName} onChange={e => setAddForm(f => ({ ...f, fullName: e.target.value }))} placeholder="John Doe" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={`${t("users.primaryRole")} *`}>
              <Select value={addForm.role} onChange={e => {
                const newRole = e.target.value as Role;
                setAddForm(f => ({ ...f, role: newRole, extraRoles: f.extraRoles.filter(r => r !== newRole) }));
              }}>
                {ROLES.map(r => <option key={r} value={r} className="bg-background capitalize">{ROLE_LABELS[r]}</option>)}
              </Select>
            </Field>
            {TEAM_ROLES.includes(addForm.role) && (
              <Field label={t("teams.label")}>
                <TeamSelect value={addForm.team} onChange={v => setAddForm(f => ({ ...f, team: v }))} />
              </Field>
            )}
          </div>
          <Field label={`${t("users.extraRoles")} (${t("common.optional")})`}>
            <ExtraRolesChecklist primary={addForm.role} selected={addForm.extraRoles} onChange={roles => setAddForm(f => ({ ...f, extraRoles: roles }))} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t("users.email")}>
              <Input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="john@factory.com" />
            </Field>
            <Field label={t("users.department")}>
              <Input value={addForm.department} onChange={e => setAddForm(f => ({ ...f, department: e.target.value }))} placeholder="Maintenance" />
            </Field>
          </div>
          <Field label={t("users.phone")}>
            <Input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="+20 1xx xxx xxxx" />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleCreate} disabled={addBusy}>{addBusy ? t("common.loading") : t("users.addUser")}</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={`${t("common.edit")} — ${editUsername}`}>
        <div className="space-y-4">
          {editError && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{editError}</p>}
          <Field label={t("users.fullName")}>
            <Input value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t("users.primaryRole")}>
              <Select value={editForm.role} onChange={e => {
                const newRole = e.target.value as Role;
                setEditForm(f => ({ ...f, role: newRole, extraRoles: f.extraRoles.filter(r => r !== newRole) }));
              }}>
                {ROLES.map(r => <option key={r} value={r} className="bg-background capitalize">{ROLE_LABELS[r]}</option>)}
              </Select>
            </Field>
            {TEAM_ROLES.includes(editForm.role) && (
              <Field label={t("teams.label")}>
                <TeamSelect value={editForm.team} onChange={v => setEditForm(f => ({ ...f, team: v }))} />
              </Field>
            )}
          </div>
          <Field label={`${t("users.extraRoles")} (${t("common.optional")})`}>
            <ExtraRolesChecklist primary={editForm.role} selected={editForm.extraRoles} onChange={roles => setEditForm(f => ({ ...f, extraRoles: roles }))} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t("users.email")}>
              <Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label={t("users.department")}>
              <Input value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} />
            </Field>
          </div>
          <Field label={t("users.phone")}>
            <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label={t("users.newPassword")}>
            <Input type="password" value={editForm.newPassword} onChange={e => setEditForm(f => ({ ...f, newPassword: e.target.value }))} placeholder="••••••••" autoComplete="new-password" />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowEdit(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleUpdate} disabled={editBusy}>{editBusy ? t("common.loading") : t("common.save")}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t("common.delete")}>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            <span className="text-white font-semibold">{deleteTarget?.name}</span>
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteBusy}>
              {deleteBusy ? t("common.loading") : t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
