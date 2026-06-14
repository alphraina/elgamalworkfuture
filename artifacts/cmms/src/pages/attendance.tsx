import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Modal, Label, Select, Input } from "@/components/ui";
import { Users, UserCheck, Clock, ClipboardCheck, ListChecks, Settings2, AlertTriangle, CheckCircle2, Save, Palmtree, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FilterBar, type FilterState } from "@/components/filter-bar";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}/api/attendance${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = typeof data === "object" ? (data as { error?: string }).error : data;
    const code = typeof data === "object" ? (data as { code?: string }).code : undefined;
    const err = new Error(msg || "Request failed") as Error & { code?: string };
    err.code = code;
    throw err;
  }
  return data;
}

interface AttRecord {
  id: number;
  userId: number;
  userName: string | null;
  userWorkId: string | null;
  date: string;
  checkIn: string | null;
  shift: string;
  status: string;
}

interface UserEntry {
  id: number;
  fullName: string;
  username: string;
  role: string;
  department?: string | null;
}

interface ShiftConfig {
  startTime: string;
  endTime: string;
  maxCheckInTime: string;
}

interface ShiftSettings {
  day: ShiftConfig;
  night: ShiftConfig;
}

const STATUS_COLORS: Record<string, string> = {
  present:  "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  absent:   "text-red-400 border-red-400/30 bg-red-400/10",
  late:     "text-amber-400 border-amber-400/30 bg-amber-400/10",
  leave:    "text-blue-400 border-blue-400/30 bg-blue-400/10",
  halfday:  "text-purple-400 border-purple-400/30 bg-purple-400/10",
};

const today = new Date().toISOString().split("T")[0];

/** For night shift: workers checking in 00:00–06:59 are still on the *previous* day's shift */
const _nowHour = new Date().getHours();
const shiftDate = (_nowHour < 7)
  ? new Date(Date.now() - 86_400_000).toISOString().split("T")[0]
  : today;

function fmt12(time24: string) {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function Attendance() {
  const { user, isAdmin, isManager, isTeamLeader } = useAuth();
  const { toast } = useToast();

  const canManage = isAdmin || isManager || isTeamLeader;
  const isSelfOnly = !canManage;

  const [records, setRecords]   = useState<AttRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserEntry[]>([]);
  const [loaded, setLoaded]     = useState(false);
  const [tab, setTab]           = useState<"roster" | "log" | "settings">("roster");
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy]          = useState(false);
  const [logFilters, setLogFilters] = useState<FilterState>({ date: "", shift: "" });
  const [rosterDate, setRosterDate] = useState(today);

  const [onVacationToday, setOnVacationToday] = useState(false);

  const [shiftSettings, setShiftSettings] = useState<ShiftSettings>({
    day:   { startTime: "08:00", endTime: "16:00", maxCheckInTime: "08:30" },
    night: { startTime: "23:00", endTime: "07:00", maxCheckInTime: "23:30" },
  });
  const [settingsForm, setSettingsForm] = useState<ShiftSettings>({
    day:   { startTime: "08:00", endTime: "16:00", maxCheckInTime: "08:30" },
    night: { startTime: "23:00", endTime: "07:00", maxCheckInTime: "23:30" },
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const [markAbsentModal, setMarkAbsentModal] = useState(false);
  const [markAbsentForm, setMarkAbsentForm] = useState({ date: today, shift: "day" });
  const [markingAbsent, setMarkingAbsent] = useState(false);

  const [showSelfModal, setShowSelfModal] = useState(false);
  const [selfShift, setSelfShift] = useState("day");
  const [selfBusy, setSelfBusy] = useState(false);
  const [selfOnVacation, setSelfOnVacation] = useState(false);

  const [form, setForm] = useState({
    userId: "",
    date: shiftDate,
    shift: "day",
    status: "present",
  });

  async function loadAll() {
    try {
      const [recs, settings] = await Promise.all([
        apiFetch(""),
        fetch(`${BASE}/api/shift-settings`, { credentials: "include" }).then(r => r.json()),
      ]);
      setRecords(Array.isArray(recs) ? recs : []);
      if (settings && settings.day) {
        setShiftSettings(settings);
        setSettingsForm(settings);
      }
      if (canManage) {
        const u = await fetch(`${BASE}/api/users`, { credentials: "include" }).then((r) => r.json());
        setAllUsers(Array.isArray(u) ? u : []);
      }

      // Check if current user has approved vacation today (self-only users and canManage users for self check-in)
      if (user) {
        const vacReqs = await fetch(`${BASE}/api/vacation-requests`, { credentials: "include" }).then(r => r.json());
        const onVac = Array.isArray(vacReqs) && vacReqs.some((v: { status: string; startDate: string; endDate: string }) =>
          v.status === "approved" && v.startDate <= shiftDate && v.endDate >= shiftDate
        );
        if (isSelfOnly) setOnVacationToday(onVac);
        else setSelfOnVacation(onVac);
      }
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const alreadyCheckedIn = isSelfOnly && records.some((r) => r.userId === user?.id && r.date === shiftDate);
  const selfAlreadyCheckedIn = canManage && records.some((r) => r.userId === user?.id && r.date === shiftDate);

  async function handleSelfCheckIn() {
    setSelfBusy(true);
    try {
      const body = {
        userId: user!.id,
        date: shiftDate,
        shift: selfShift,
        checkIn: new Date().toISOString(),
        status: "present",
      };
      await apiFetch("", { method: "POST", body: JSON.stringify(body) });
      toast({ title: "Checked in successfully!" });
      setShowSelfModal(false);
      const recs = await apiFetch("");
      setRecords(recs);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error("Failed");
      const code = (err as Error & { code?: string }).code;
      if (code === "ON_VACATION") {
        toast({ title: "Check-in blocked", description: "You have an approved vacation for today.", variant: "destructive" });
        setSelfOnVacation(true);
        setShowSelfModal(false);
      } else {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    } finally {
      setSelfBusy(false);
    }
  }

  async function handleCheckIn() {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        date: shiftDate,
        shift: form.shift,
        checkIn: new Date().toISOString(),
      };
      if (canManage) {
        body.userId = parseInt(form.userId);
        body.shift  = form.shift;
        body.status = form.status;
        body.date   = form.date;
        body.checkIn = form.date === today ? new Date().toISOString() : undefined;
      }
      await apiFetch("", { method: "POST", body: JSON.stringify(body) });
      toast({ title: isSelfOnly ? "Attendance recorded!" : "Attendance logged" });
      setShowModal(false);
      const recs = await apiFetch("");
      setRecords(recs);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error("Failed");
      const code = (err as Error & { code?: string }).code;
      if (code === "ON_VACATION") {
        toast({
          title: "Check-in blocked",
          description: "You have an approved vacation for today. Check-in is not allowed.",
          variant: "destructive",
        });
        setOnVacationToday(true);
        setShowModal(false);
      } else {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveShiftSetting(shift: "day" | "night") {
    setSavingSettings(true);
    try {
      const cfg = settingsForm[shift];
      const res = await fetch(`${BASE}/api/shift-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ shift, ...cfg }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setShiftSettings(updated);
      setSettingsForm(updated);
      toast({ title: `${shift === "day" ? "Day" : "Night"} shift settings saved` });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleMarkAbsent() {
    setMarkingAbsent(true);
    try {
      const res = await apiFetch("/mark-absent", {
        method: "POST",
        body: JSON.stringify(markAbsentForm),
      });
      toast({
        title: "Done",
        description: `Marked ${res.markedAbsent} absent, ${res.markedLeave} on leave.`,
      });
      setMarkAbsentModal(false);
      const recs = await apiFetch("");
      setRecords(recs);
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setMarkingAbsent(false);
    }
  }

  // Build roster
  const todayRecordsMap = new Map(
    records.filter((r) => r.date === rosterDate).map((r) => [r.userId, r])
  );

  const rosterRows = allUsers.map((u) => ({
    ...u,
    record: todayRecordsMap.get(u.id) ?? null,
  }));

  const presentCount = rosterRows.filter((r) => r.record?.status === "present").length;
  const lateCount    = rosterRows.filter((r) => r.record?.status === "late").length;
  const absentCount  = rosterRows.filter((r) => r.record && r.record.status !== "present" && r.record.status !== "late").length;
  const notRecorded  = rosterRows.filter((r) => !r.record).length;

  const tabs: Array<{ key: "roster" | "log" | "settings"; label: string; icon: React.ReactNode; show: boolean }> = [
    { key: "roster", label: "Roster", icon: <ListChecks className="w-4 h-4" />, show: canManage },
    { key: "log", label: "Attendance Log", icon: <ClipboardCheck className="w-4 h-4" />, show: true },
    { key: "settings", label: "Shift Settings", icon: <Settings2 className="w-4 h-4" />, show: isAdmin },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Attendance
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {isSelfOnly
              ? "Record your attendance when you arrive at the factory."
              : `Roster — ${rosterDate}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canManage && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Auto-Attendance Active
              </span>
              <Button variant="ghost" size="sm" onClick={() => setMarkAbsentModal(true)} className="gap-1.5 text-xs text-muted-foreground hover:text-white">
                <AlertTriangle className="w-3.5 h-3.5" />
                Manual Override
              </Button>
            </div>
          )}
          {isSelfOnly ? (
            <Button
              onClick={() => { if (!onVacationToday && !alreadyCheckedIn) setShowModal(true); }}
              disabled={alreadyCheckedIn || onVacationToday}
              className="gap-2"
            >
              <UserCheck className="w-4 h-4" />
              {alreadyCheckedIn ? "Already Checked In" : onVacationToday ? "On Vacation" : "Check In Now"}
            </Button>
          ) : (
            <>
              {isTeamLeader && (
                <Button
                  variant="outline"
                  onClick={() => { if (!selfAlreadyCheckedIn && !selfOnVacation) setShowSelfModal(true); }}
                  disabled={selfAlreadyCheckedIn || selfOnVacation}
                  className="gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  {selfAlreadyCheckedIn ? "Already Checked In" : selfOnVacation ? "On Vacation" : "Check In Myself"}
                </Button>
              )}
              <Button onClick={() => setShowModal(true)} className="gap-2">
                <ClipboardCheck className="w-4 h-4" />
                Log Attendance
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Shift time info bar — visible to all */}
      <div className="flex flex-wrap gap-3">
        {(["day", "night"] as const).map(s => (
          <div key={s} className="flex items-center gap-2 text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <Clock className={`w-3.5 h-3.5 ${s === "day" ? "text-amber-400" : "text-blue-400"}`} />
            <span className="text-muted-foreground capitalize font-medium">{s === "day" ? "Day" : "Night"} Shift:</span>
            <span className="text-white font-medium">{fmt12(shiftSettings[s].startTime)} → {fmt12(shiftSettings[s].endTime)}</span>
            {s === "night" && <span className="text-[10px] text-blue-300">(next day)</span>}
            <span className="text-muted-foreground">·</span>
            <span className="text-amber-400">Late after {fmt12(shiftSettings[s].maxCheckInTime)}</span>
          </div>
        ))}
      </div>

      {/* Self-only: status card */}
      {isSelfOnly && (
        <div className={`rounded-lg border p-4 flex items-center gap-4 ${
          onVacationToday
            ? "border-blue-400/20 bg-blue-400/5"
            : alreadyCheckedIn
            ? "border-emerald-400/20 bg-emerald-400/5"
            : "border-amber-400/20 bg-amber-400/5"
        }`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            onVacationToday ? "bg-blue-400/20" : alreadyCheckedIn ? "bg-emerald-400/20" : "bg-amber-400/20"
          }`}>
            {onVacationToday
              ? <Palmtree className="w-5 h-5 text-blue-400" />
              : alreadyCheckedIn
              ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              : <Clock className="w-5 h-5 text-amber-400" />}
          </div>
          <div>
            <p className={`font-semibold ${
              onVacationToday ? "text-blue-400" : alreadyCheckedIn ? "text-emerald-400" : "text-amber-400"
            }`}>
              {onVacationToday ? "On approved vacation — check-in blocked" : alreadyCheckedIn ? "Present today" : "Not yet checked in"}
            </p>
            <p className="text-xs text-muted-foreground">{today}</p>
          </div>
        </div>
      )}

      {/* Manager view */}
      {canManage && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Present",      count: presentCount, cls: "text-emerald-400 border-emerald-400/20 bg-emerald-400/5" },
              { label: "Late",         count: lateCount,    cls: "text-amber-400 border-amber-400/20 bg-amber-400/5" },
              { label: "Other Status", count: absentCount,  cls: "text-red-400 border-red-400/20 bg-red-400/5" },
              { label: "Not Recorded", count: notRecorded,  cls: "text-muted-foreground border-white/10 bg-white/5" },
            ].map(({ label, count, cls }) => (
              <div key={label} className={`rounded-lg border p-3 ${cls}`}>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs mt-0.5 opacity-80">{label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-white/10">
            {tabs.filter(t => t.show).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                  tab === t.key ? "border-primary text-white" : "border-transparent text-muted-foreground hover:text-white"
                }`}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* Roster tab */}
          {tab === "roster" && (
            <>
              <div className="flex items-center gap-3">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Roster Date</Label>
                <Input
                  type="date"
                  value={rosterDate}
                  onChange={e => setRosterDate(e.target.value || today)}
                  className="w-44"
                />
                {rosterDate !== today && (
                  <button onClick={() => setRosterDate(today)} className="text-xs text-primary hover:underline">
                    Back to today
                  </button>
                )}
              </div>
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Work ID</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!loaded ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
                      ) : rosterRows.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No users found.</TableCell></TableRow>
                      ) : (
                        rosterRows.map((row) => (
                          <TableRow key={row.id} className={!row.record ? "opacity-60" : ""}>
                            <TableCell className="font-semibold text-white">{row.fullName}</TableCell>
                            <TableCell className="font-mono text-sm text-primary">{row.username}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{row.department ?? "—"}</TableCell>
                            <TableCell>
                              {row.record
                                ? <span className="text-xs uppercase text-muted-foreground">{row.record.shift}</span>
                                : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">
                              {row.record?.checkIn
                                ? new Date(row.record.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {row.record ? (
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded border uppercase ${STATUS_COLORS[row.record.status] ?? ""}`}>
                                  {row.record.status}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded border uppercase text-muted-foreground border-white/10 bg-white/5">
                                  Not Recorded
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          )}

          {/* Log tab */}
          {tab === "log" && (
            <>
              <FilterBar filters={logFilters} onChange={setLogFilters} showShift />
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Work ID</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const filtered = [...records].reverse().filter(r =>
                          (!logFilters.date || r.date === logFilters.date) &&
                          (!logFilters.shift || r.shift === logFilters.shift)
                        );
                        return filtered.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No records found.</TableCell></TableRow>
                        ) : filtered.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-sm text-white">{r.date}</TableCell>
                            <TableCell className="font-semibold text-white">{r.userName}</TableCell>
                            <TableCell className="font-mono text-sm text-primary">{r.userWorkId ?? "—"}</TableCell>
                            <TableCell><span className="text-xs uppercase text-muted-foreground">{r.shift}</span></TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">
                              {r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded border uppercase ${STATUS_COLORS[r.status] ?? ""}`}>
                                {r.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          )}

          {/* Shift Settings tab — admin only */}
          {tab === "settings" && isAdmin && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure shift times. Employees who check in after the max check-in time are automatically marked <span className="text-amber-400 font-medium">Late</span>.
                Night shift hours cross midnight — workers checking in between 00:00–06:59 are still recorded against the previous day's shift date.
              </p>
              {(["day", "night"] as const).map(shift => (
                <Card key={shift}>
                  <div className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Clock className={`w-5 h-5 ${shift === "day" ? "text-amber-400" : "text-blue-400"}`} />
                      <h3 className="text-base font-semibold text-white">{shift === "day" ? "Day Shift" : "Night Shift"}</h3>
                      {shift === "night" && <span className="text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded px-2 py-0.5">Crosses midnight</span>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Shift Start Time</Label>
                        <Input
                          type="time"
                          value={settingsForm[shift].startTime}
                          onChange={e => setSettingsForm(f => ({ ...f, [shift]: { ...f[shift], startTime: e.target.value } }))}
                        />
                        <p className="text-xs text-muted-foreground">When the shift begins</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Shift End Time</Label>
                        <Input
                          type="time"
                          value={settingsForm[shift].endTime}
                          onChange={e => setSettingsForm(f => ({ ...f, [shift]: { ...f[shift], endTime: e.target.value } }))}
                        />
                        <p className="text-xs text-muted-foreground">{shift === "night" ? "Next day (e.g. 07:00)" : "When the shift ends"}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Max Check-In <span className="text-amber-400">(Late threshold)</span></Label>
                        <Input
                          type="time"
                          value={settingsForm[shift].maxCheckInTime}
                          onChange={e => setSettingsForm(f => ({ ...f, [shift]: { ...f[shift], maxCheckInTime: e.target.value } }))}
                        />
                        <p className="text-xs text-muted-foreground">After this = <span className="text-amber-400">Late</span></p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                      <div className="text-xs text-muted-foreground">
                        Current: <span className="text-white">{fmt12(shiftSettings[shift].startTime)}</span> → <span className="text-white">{fmt12(shiftSettings[shift].endTime)}</span>
                        {shift === "night" && <span className="text-blue-300"> (next day)</span>}
                        <span className="mx-1">·</span>Late after <span className="text-amber-400">{fmt12(shiftSettings[shift].maxCheckInTime)}</span>
                      </div>
                      <Button size="sm" onClick={() => saveShiftSetting(shift)} disabled={savingSettings} className="gap-1.5 text-xs">
                        <Save className="w-3.5 h-3.5" />
                        Save {shift === "day" ? "Day" : "Night"} Shift
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Self-only attendance log */}
      {isSelfOnly && (
        <>
          <FilterBar filters={logFilters} onChange={setLogFilters} showShift />
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const filtered = [...records].reverse().filter(r =>
                      (!logFilters.date || r.date === logFilters.date) &&
                      (!logFilters.shift || r.shift === logFilters.shift)
                    );
                    return !loaded ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No records found.</TableCell></TableRow>
                    ) : filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-sm text-white">{r.date}</TableCell>
                        <TableCell><span className="text-xs uppercase text-muted-foreground">{r.shift}</span></TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded border uppercase ${STATUS_COLORS[r.status] ?? ""}`}>
                            {r.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      {/* Self Check-In Modal */}
      {isSelfOnly && (
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Check In">
          <div className="space-y-4">
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <p className="text-white font-semibold">{user?.fullName}</p>
              <p className="text-muted-foreground text-sm mt-0.5">
                Recording attendance for today: <span className="text-white">{today}</span>
              </p>
              <p className="text-muted-foreground text-sm mt-0.5">
                Check-in time: <span className="text-white">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Your Shift</Label>
              <Select value={form.shift} onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))}>
                <option value="day" className="bg-background">Day Shift</option>
                <option value="night" className="bg-background">Night Shift</option>
              </Select>
            </div>
            {/* Show late warning if current time is past max */}
            {(() => {
              const cfg = shiftSettings[form.shift as "day" | "night"];
              const now = new Date();
              const [h, m] = cfg.maxCheckInTime.split(":").map(Number);
              const maxMins = h * 60 + m;
              const nowMins = now.getHours() * 60 + now.getMinutes();
              if (nowMins > maxMins) {
                return (
                  <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>You are checking in after the {form.shift} shift max time ({fmt12(cfg.maxCheckInTime)}). Your status will be marked as <strong>Late</strong>.</span>
                  </div>
                );
              }
              return null;
            })()}
            <p className="text-xs text-muted-foreground">Once checked in, you cannot modify this record.</p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleCheckIn} disabled={busy}>
                {busy ? "Recording..." : "Confirm Check In"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Team Leader Self Check-In Modal */}
      {isTeamLeader && (
        <Modal isOpen={showSelfModal} onClose={() => setShowSelfModal(false)} title="Check In Myself">
          <div className="space-y-4">
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <p className="text-white font-semibold">{user?.fullName}</p>
              <p className="text-muted-foreground text-sm mt-0.5">
                Recording your own attendance for: <span className="text-white">{today}</span>
              </p>
              <p className="text-muted-foreground text-sm mt-0.5">
                Check-in time: <span className="text-white">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Your Shift</Label>
              <Select value={selfShift} onChange={(e) => setSelfShift(e.target.value)}>
                <option value="day" className="bg-background">Day Shift</option>
                <option value="night" className="bg-background">Night Shift</option>
              </Select>
            </div>
            {(() => {
              const cfg = shiftSettings[selfShift as "day" | "night"];
              const now = new Date();
              const [h, m] = cfg.maxCheckInTime.split(":").map(Number);
              const maxMins = h * 60 + m;
              const nowMins = now.getHours() * 60 + now.getMinutes();
              if (nowMins > maxMins) {
                return (
                  <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>You are checking in after the {selfShift} shift max time ({fmt12(cfg.maxCheckInTime)}). Status will be marked as <strong>Late</strong>.</span>
                  </div>
                );
              }
              return null;
            })()}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowSelfModal(false)}>Cancel</Button>
              <Button onClick={handleSelfCheckIn} disabled={selfBusy}>
                {selfBusy ? "Recording..." : "Confirm Check In"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Manager Log Modal */}
      {canManage && (
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Log Attendance">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Employee *</Label>
                <Select value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}>
                  <option value="" className="bg-background">Select employee...</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id} className="bg-background">
                      {u.fullName} ({u.username})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Date *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Shift</Label>
                <Select value={form.shift} onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))}>
                  <option value="day" className="bg-background">Day Shift</option>
                  <option value="night" className="bg-background">Night Shift</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Status</Label>
                <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="present" className="bg-background">Present</option>
                  <option value="absent" className="bg-background">Absent</option>
                  <option value="late" className="bg-background">Late</option>
                  <option value="leave" className="bg-background">Leave</option>
                  <option value="halfday" className="bg-background">Half Day</option>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleCheckIn} disabled={busy || !form.userId}>
                {busy ? "Logging..." : "Log Attendance"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Auto-Mark Absent Modal */}
      <Modal isOpen={markAbsentModal} onClose={() => setMarkAbsentModal(false)} title="Manual Override — Mark Absent / Leave">
        <div className="space-y-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-sm text-emerald-400 flex items-start gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 animate-pulse flex-shrink-0" />
            <p><strong>Auto-mode is active.</strong> Today's absent/leave are marked automatically 30 min after the shift's max check-in time. Use this only to backfill a past date or a specific shift manually.</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-sm text-amber-400">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">This fills attendance for users with no record on the selected date:</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  <li>• Users with an <span className="text-blue-400">approved vacation</span> → marked as <span className="text-blue-400">Leave</span></li>
                  <li>• All other users with no record → marked as <span className="text-red-400">Absent</span></li>
                </ul>
                <p className="mt-1 text-xs">Users who already have a record are not affected.</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Date</Label>
              <Input
                type="date"
                value={markAbsentForm.date}
                onChange={e => setMarkAbsentForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Shift</Label>
              <Select value={markAbsentForm.shift} onChange={e => setMarkAbsentForm(f => ({ ...f, shift: e.target.value }))}>
                <option value="day" className="bg-background">Day Shift</option>
                <option value="night" className="bg-background">Night Shift</option>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setMarkAbsentModal(false)}>Cancel</Button>
            <Button
              onClick={handleMarkAbsent}
              disabled={markingAbsent}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {markingAbsent ? "Processing..." : "Mark Absent / Leave"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
