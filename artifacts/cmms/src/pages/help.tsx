import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useFactoryConfig } from "@/contexts/factory-config-context";
import {
  LayoutDashboard, AlertTriangle, PackageSearch, ShoppingCart,
  CalendarClock, GraduationCap, Activity, CheckSquare, ClipboardList,
  Users, Palmtree, QrCode, Smartphone, Wrench, Cpu, BarChart3,
  FileCheck2, ShieldCheck, ChevronDown, ChevronRight, Info,
  Key, UserCheck, Building2, BookOpen, Settings2, KeyRound, HardDrive, LineChart,
  MonitorDot, Factory, Sparkles, CheckCircle2, Bug, Zap, Play,
  ArrowLeftRight, AlertOctagon,
} from "lucide-react";


interface Section {
  icon: React.ElementType;
  sectionKey: string;
  defaultTitle: string;
  color: string;
  description: string;
  bullets: string[];
  roles?: string;
  adminOnly?: boolean;
}

const ALL_SECTIONS: Section[] = [
  {
    icon: LayoutDashboard,
    sectionKey: "dashboard",
    defaultTitle: "Dashboard",
    color: "text-blue-400",
    description: "Your home screen. Shows a summary of all key metrics at a glance.",
    bullets: [
      "Overview cards: open downtime incidents, pending PM tasks, active production, and attendance",
      "License expiry countdown — warns you when your license is close to expiring",
      "Storage usage bar — shows how much of your data storage quota is used",
      "Quota widget — displays current user count vs. your factory's user limit",
      "Role-aware — each role sees the stats most relevant to them",
    ],
    roles: "All roles",
  },
  {
    icon: AlertTriangle,
    sectionKey: "downtime",
    defaultTitle: "Downtime Records",
    color: "text-red-400",
    description: "Log and manage machine downtime incidents on the factory floor.",
    bullets: [
      "Create a downtime record with machine, category, reason, and start/end time",
      "Track resolution notes and total downtime duration",
      "Filter by machine, date range, or category",
      "Admin and managers can view all records; maintenance technicians can log and resolve",
    ],
    roles: "Admin, Manager, Team Leader, Maintenance",
  },
  {
    icon: PackageSearch,
    sectionKey: "inventory",
    defaultTitle: "Inventory",
    color: "text-green-400",
    description: "Catalog of all spare parts and consumables used in your factory.",
    bullets: [
      "Add/edit/delete spare part entries with part number, name, unit, and stock quantity",
      "Track minimum stock level — low-stock items are highlighted",
      "Inventory role can manage stock; admin and managers can view and edit",
    ],
    roles: "Admin, Manager, Team Leader, Inventory",
  },
  {
    icon: ShoppingCart,
    sectionKey: "orders",
    defaultTitle: "Spare Part Orders",
    color: "text-orange-400",
    description: "Maintenance team requests parts; inventory and admin approve and fulfill.",
    bullets: [
      "Maintenance technicians submit part order requests",
      "Inventory role approves, rejects, or marks orders as fulfilled",
      "Order history is tracked with timestamps and approver info",
    ],
    roles: "Admin, Manager, Team Leader, Maintenance, Inventory",
  },
  {
    icon: CalendarClock,
    sectionKey: "pm",
    defaultTitle: "Preventive Maintenance",
    color: "text-cyan-400",
    description: "Schedule and track planned maintenance tasks to prevent breakdowns.",
    bullets: [
      "Create PM plans with machine, frequency (daily/weekly/monthly), and assigned shift",
      "The calendar automatically generates recurring occurrences for each plan based on its frequency — no manual entry needed",
      "Marking an occurrence as Done auto-advances the plan's next due date to the following scheduled occurrence",
      "Overdue tasks are highlighted — any occurrence before today that has not been marked done",
      "Team leaders and maintenance technicians can mark their own assigned PM tasks as done",
      "Email notification toggle per plan",
      "Filter by machine, team, or date",
    ],
    roles: "Admin, Manager, Team Leader, Maintenance",
  },
  {
    icon: GraduationCap,
    sectionKey: "training",
    defaultTitle: "Training Plans",
    color: "text-violet-400",
    description: "Schedule and manage training sessions for your factory teams.",
    bullets: [
      "Create training plans with title, trainer, participants, date and team",
      "Track attendance and completion status",
      "Attach related exams to training plans",
      "Notifications sent to participants automatically",
    ],
    roles: "Admin, Manager, Team Leader, Maintenance",
  },
  {
    icon: FileCheck2,
    sectionKey: "exams",
    defaultTitle: "Training Exams",
    color: "text-purple-400",
    description: "Multiple-choice exams linked to training plans for knowledge verification.",
    bullets: [
      "Create exams with questions, multiple choice answers, and a passing score threshold",
      "Assign exams to employees; results are recorded and scored automatically",
      "Admin and managers can view all results and grade submissions",
    ],
    roles: "Admin, Manager, Team Leader, Maintenance",
  },
  {
    icon: Activity,
    sectionKey: "production",
    defaultTitle: "Production Capacity",
    color: "text-emerald-400",
    description: "Track actual daily output against planned targets per production line, and set up today's shift model for the machine agent.",
    bullets: [
      "Log hourly production counts for each line",
      "Compare actual vs. target and view efficiency percentage",
      "Shift-based records — morning, afternoon, night",
      "Historical production data with date filters",
      "Shift Setup — define today's model number per line; the machine agent reads this to find the correct log file folder",
      "Log file path is built dynamically: BASE_FOLDER\\LOG_SUBFOLDER\\{model}\\{DD-M-YYYY}.xlsx",
    ],
    roles: "Admin, Manager, Team Leader, Maintenance",
  },
  {
    icon: AlertOctagon,
    sectionKey: "defects",
    defaultTitle: "Defects",
    color: "text-orange-400",
    description: "Log and track production defects per line and shift — quantity, reason, and details.",
    bullets: [
      "Record a defect entry with production line, shift, date, reason, and defective quantity",
      "Choose from common defect reasons (dimensional non-conformance, surface defect, assembly error, etc.) or enter a custom reason",
      "Add optional detailed notes for each defect report",
      "Filter by production line, shift, and date range",
      "Edit or delete existing defect entries",
      "All defect data is scoped to your factory",
    ],
    roles: "Admin, Manager, Team Leader, Maintenance",
  },
  {
    icon: Factory,
    sectionKey: "productionLines",
    defaultTitle: "Production Lines",
    color: "text-teal-400",
    description: "Configure and manage your factory's production lines — names, capacity targets, teams, and supervisors.",
    bullets: [
      "Add new lines with a name, department/team, target capacity (units/hour), and minimum capacity",
      "Assign a supervisor responsible for each line",
      "Edit any line's settings at any time — changes apply immediately across the system",
      "Toggle a line active or inactive to hide it from production entry without deleting its history",
      "Delete a line permanently — historical production records that reference the line are preserved with a null line reference",
      "Inline confirmation step before deletion to prevent accidental removal",
      "Lines drive the Production Capacity module, Machine Monitor hierarchy, and Analytics reports",
    ],
    roles: "Admin only (view for all roles)",
  },
  {
    icon: CheckSquare,
    sectionKey: "tasks",
    defaultTitle: "Tasks & Alerts",
    color: "text-yellow-400",
    description: "Assign and track maintenance or operational tasks across your team.",
    bullets: [
      "Create tasks with title, description, assignee, priority, and due date",
      "Update task status: open, in progress, done",
      "Tasks generate bell notifications for the assigned user",
      "Completion notes recorded when a task is closed",
    ],
    roles: "Admin, Manager, Team Leader, Maintenance",
  },
  {
    icon: ClipboardList,
    sectionKey: "linePlans",
    defaultTitle: "Daily Line Plans",
    color: "text-teal-400",
    description: "Plan daily production shifts per line — models, targets, and team assignments.",
    bullets: [
      "Create shift-based production plans for each line",
      "Set model, planned quantity, and assigned team per shift",
      "Quick-view of all lines planned for the current day",
    ],
    roles: "Admin, Manager, Team Leader, Maintenance",
  },
  {
    icon: ArrowLeftRight,
    sectionKey: "changeover",
    defaultTitle: "Changeover",
    color: "text-violet-400",
    description: "Track model changeover tasks between production runs — list, cylinders, and calendar views.",
    bullets: [
      "Create changeover records with title, assigned line, target date, and planned duration",
      "Log step-by-step progress on each changeover task with a manual progress slider",
      "Three view modes: List (detailed table), Cylinders (visual liquid-fill progress per task), and Calendar (monthly overview)",
      "Cylinders view shows a visual tank indicator — color shifts from red → amber → green as progress increases",
      "Calendar view highlights days that have changeover activity — click a day to see its tasks",
      "Status tracking: pending, in-progress, completed, or cancelled",
      "Filter by production line and date range",
    ],
    roles: "Admin, Manager, Team Leader, Maintenance",
  },
  {
    icon: Users,
    sectionKey: "attendance",
    defaultTitle: "Attendance",
    color: "text-sky-400",
    description: "Record daily attendance for all employees across shifts.",
    bullets: [
      "Mark employees as present, absent, or on leave",
      "Filter by date, team, or employee",
      "Export-ready attendance summary per day",
    ],
    roles: "All roles",
  },
  {
    icon: Palmtree,
    sectionKey: "vacation",
    defaultTitle: "Vacation Requests",
    color: "text-lime-400",
    description: "Submit and approve vacation or leave requests.",
    bullets: [
      "Employees submit vacation requests with start date, end date, and reason",
      "Admin and managers approve or reject requests",
      "Approved vacations reflect in the attendance module",
    ],
    roles: "All roles",
  },
  {
    icon: QrCode,
    sectionKey: "machines",
    defaultTitle: "Machine Registry",
    color: "text-indigo-400",
    description: "Master catalog of all machines in your factory with QR code support.",
    bullets: [
      "Add machines with name, code, model, location, and assigned team/line",
      "Each machine auto-generates a printable QR code",
      "Scan a machine's QR code to quickly look up its record",
      "Mark machines as active or inactive",
    ],
    roles: "Admin, Manager, Team Leader, Maintenance",
  },
  {
    icon: Smartphone,
    sectionKey: "workPhones",
    defaultTitle: "Work Phones",
    color: "text-pink-400",
    description: "Track work phones assigned to employees on the production floor.",
    bullets: [
      "Log each phone with employee work ID, name, color, phone number, and PCBA number",
      "Scan QR codes to look up phone records quickly",
      "Bulk import phone data via CSV",
      "Search and filter by employee or phone details",
    ],
    roles: "Admin, Manager, Team Leader, Maintenance, Inventory",
  },
  {
    icon: Wrench,
    sectionKey: "brokenMachines",
    defaultTitle: "Broken Machines",
    color: "text-rose-400",
    description: "Report and track broken machine incidents from detection to resolution.",
    bullets: [
      "Log a broken machine with machine name, issue description, reporter, and date",
      "Track repair progress and mark as resolved with resolution notes",
      "Filter by machine, date, or status (reported / in-progress / resolved / closed)",
    ],
    roles: "Admin, Manager, Team Leader, Maintenance",
  },
  {
    icon: MonitorDot,
    sectionKey: "machineMonitor",
    defaultTitle: "Machine Monitor",
    color: "text-sky-400",
    description: "Live real-time dashboard showing test stats for every machine, station, and production line — powered by the CMMS agent script.",
    bullets: [
      "Hierarchy view: Line → Station → Machine, with live pass/fail counts and pass rate",
      "Each machine card shows: total devices tested, pass count, fail count, error summary, and last-seen time",
      "Machine identification is by IP address — the agent injects the machine IP automatically",
      "Auto-downtime: when the same error repeats a configurable number of times in a row, a downtime record is created automatically and the line leader is notified",
      "The repeat threshold (default 3×) is configured in Factory Settings → OMTP tab",
      "Errors at or above the threshold are highlighted in red with a 'REPEAT ERR' badge",
      "Reset Data — admins and managers can clear all machine data instantly; data also resets automatically at midnight",
      "When no data has arrived yet, the monitor directs you to Factory Settings to complete the agent setup",
    ],
    roles: "Admin, Manager, Team Leader, Maintenance",
  },
  {
    icon: Cpu,
    sectionKey: "machineAnalysis",
    defaultTitle: "Machine Analysis",
    color: "text-amber-400",
    description: "Deep-dive analytics modal for any machine — production flow, OEE, anomalies, error heatmaps, and predictive maintenance insights.",
    bullets: [
      "Open the analysis modal from the Machine Monitor by clicking any machine card",
      "6 KPI summary cards: Total Tested, Pass Count, Fail Count, Pass Rate, Cycle Time, and Availability",
      "3 donut charts: Pass vs Fail ratio, error category distribution, and shift-based yield breakdown",
      "Daily trend area chart — pass and fail counts over time with an overall yield trendline",
      "Error analysis bar chart — top error codes ranked by frequency, with a detailed table showing count, %, first seen, and last seen",
      "Machine performance dashboard: availability gauge, performance rate, quality index, and OEE score",
      "Predictive maintenance panel: MTBF estimate, MTTR, next predicted failure window, and maintenance recommendation level",
      "LOT × Machine production flow matrix — shows pass/fail per LOT ID for each machine in a heatmap grid",
      "Advanced analytics: horizontal bar charts for station comparisons, cycle time histogram, retest statistics, and shift-level analysis",
      "Anomaly detection panel: highlights unusual readings, sudden drops, and statistical outliers",
      "Failure heatmap: time-of-day × day-of-week grid showing when failures are most concentrated",
      "Hourly tracer: minute-by-minute trace of tested counts and fail spikes across the day",
      "Dynamic bottleneck analysis: ranks machines by their contribution to line downtime",
      "All chart colors use hardcoded hex values for reliable rendering in all browsers",
      "Select any date range to narrow the analysis to a specific production period",
    ],
    roles: "Admin, Manager, Team Leader, Maintenance",
  },
  {
    icon: BarChart3,
    sectionKey: "kpi",
    defaultTitle: "KPI Report",
    color: "text-fuchsia-400",
    description: "Per-member and per-team KPI scorecard — tracks each employee's performance across attendance, tasks, exams, repairs, PM, and line plans with a weighted composite score.",
    bullets: [
      "Monthly scorecard per employee — shows attendance rate, task completion rate, exam results, broken machine repairs, PM completions, and line plan contributions",
      "Weighted composite score (0–100%) per person — formula adapts based on whether the member has exam data",
      "Color-coded score badges: green ≥ 90%, amber ≥ 70%, red below threshold — configurable thresholds",
      "Drill-down modal per employee: detailed breakdown of each metric with sub-scores and raw counts",
      "Team filter and month selector — compare performance across departments and time periods",
      "Admin can configure KPI weights (attendance, tasks, exams, repairs, PM, line plans) from within the page",
      "Average team score summary card at the top of the report",
      "Print and export buttons for offline reporting",
    ],
    roles: "Admin, Manager, Team Leader",
  },
  {
    icon: Users,
    sectionKey: "users",
    defaultTitle: "User Management",
    color: "text-blue-300",
    description: "Manage all user accounts in your factory workspace.",
    bullets: [
      "Approve, edit, or deactivate user accounts that self-registered via your factory link",
      "Assign roles: admin, manager, team leader, maintenance, inventory",
      "Grant extra roles for cross-functional access",
      "Customize team names (Assembly, Test, Packaging) — names sync across the entire app",
      "Set the maximum number of active users allowed in your factory",
      "Reset passwords for any user",
    ],
    roles: "Admin only",
    adminOnly: true,
  },
  {
    icon: ShieldCheck,
    sectionKey: "auditLogs",
    defaultTitle: "Audit Logs",
    color: "text-gray-400",
    description: "Full history of every action taken within your factory's workspace.",
    bullets: [
      "Comprehensive logging covers every write action across all modules — creates, updates, deletes, logins, logouts, and more",
      "Tracks user management, downtime, inventory, PM plans, training, tasks, machines, attendance, broken machines, vacation, announcements, defects, changeover, and line plans",
      "Factory-level actions are also logged: config changes, section name/permission edits, API key regeneration, section video updates, and machine data resets",
      "Backup and restore operations are recorded with metadata (table counts, file size)",
      "Shows user name, role, action type, affected record, timestamp, and expandable change diff (before/after values)",
      "Filter by action type, entity, user, or date range",
      "Delete individual entries or clear all logs",
      "Scoped to your factory — you only see your own factory's activity",
    ],
    roles: "Admin only",
    adminOnly: true,
  },
  {
    icon: LineChart,
    sectionKey: "reports",
    defaultTitle: "Analytics & Reports",
    color: "text-cyan-400",
    description: "Machine reliability and performance analytics: MTTR, MTBF, OEE, downtime analysis, and bottleneck identification.",
    bullets: [
      "Period selector: analyze the last 7, 30, 90, 180, or 365 days",
      "Summary cards: total incidents, total downtime hours, average MTTR, and open incident count",
      "Downtime trend chart — daily downtime hours as an area chart over the selected period",
      "Downtime by category — pie/bar breakdown: mechanical, electrical, software, material, other",
      "Downtime by production line — bar chart showing which lines lose the most time",
      "Bottleneck machines table — top machines by cumulative downtime with open incident count and MTTR",
      "OEE per production line — availability × performance gauge (world-class target ≥ 85%)",
      "Broken machine summary card — total reported, open, resolved, and average repair time",
      "MTTR by machine — horizontal bar chart: which machines take longest to repair",
      "MTBF by machine — horizontal bar chart: which machines are most reliable",
      "Metric glossary — definitions of MTTR, MTBF, OEE, and Bottleneck for team reference",
    ],
    roles: "Admin, Manager, Team Leader",
  },
  {
    icon: Settings2,
    sectionKey: "factory-settings",
    defaultTitle: "Factory Settings",
    color: "text-primary",
    description: "Customize how the CMMS looks, behaves, and connects to factory machines for your factory.",
    bullets: [
      "Role Names — rename any role's display label across the entire app (e.g. rename 'teamleader' to 'Shift Supervisor')",
      "Section Names — rename any sidebar module to match your factory's terminology",
      "Section Access — a permission matrix: toggle which roles can see each section, and whether they can create/edit/delete",
      "Changes to roles, names, and permissions take effect immediately for all users",
      "Backup & Restore — download a complete JSON backup of all factory data; restore from any previous backup file to roll back the entire system to that point in time",
      "Automatic Daily Backup — the system automatically takes a full backup every day at midnight and stores it in the database; the status card shows the date, file size, and a countdown to the next backup; download or restore directly from the card",
      "OMTP Tab — API Key: view, copy, or regenerate your factory's machine agent API key",
      "OMTP Tab — Download Agent: download the cmms_Start.bat launcher and cmms_Startup.vbs auto-start script for deployment on factory PCs",
      "OMTP Tab — Auto-Downtime Threshold: set how many consecutive identical failures trigger an automatic downtime record (default 3; range 1–20)",
      "OMTP Tab — Log File Path Template: configure the base folder and subfolder pattern the agent uses to locate test log files",
      "OMTP Tab — Column Mapping: map your Excel log file's column headers to the expected fields (Pass, Fail, Error Code, Serial, etc.)",
      "OMTP Tab — Setup Guide: full step-by-step instructions for installing and configuring the agent on factory PCs",
    ],
    roles: "Admin only",
    adminOnly: true,
  },
];

const WHATS_NEW = [
  {
    icon: HardDrive,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    tag: "New",
    title: "Automatic Daily Backup — runs every midnight",
    desc: "The system now automatically takes a complete backup of all factory data every day at midnight. The backup is stored in the database. A status card in Factory Settings shows the last backup date, file size, and countdown to the next backup — with one-click download and restore.",
  },
  {
    icon: KeyRound,
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    tag: "Fix",
    title: "Backup & Restore — fully reliable JSON restore",
    desc: "The backup restore process has been overhauled to correctly handle all column types. Previously, restoring a backup could silently corrupt JSONB array columns (audit log changes, factory config, column mappings). This is now resolved — restores are validated before writing and 100% reliable across all 30+ tables.",
  },
  {
    icon: ShieldCheck,
    color: "text-gray-400",
    bg: "bg-gray-500/10 border-gray-500/20",
    tag: "Improved",
    title: "Audit Logging — now covers every write action",
    desc: "Audit logging now tracks every write action across the entire system. Previously, some operations were unlogged — factory config changes, section video edits, API key regeneration, task deletions, and machine data resets. All of these now produce audit records. The result: a complete, tamper-evident trail of everything that has ever changed in your workspace.",
  },
  {
    icon: CalendarClock,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    tag: "Updated",
    title: "PM Calendar — automatic recurring occurrences",
    desc: "The PM Calendar now generates virtual recurring occurrences for every plan based on its frequency (daily, weekly, monthly). You no longer need to create individual entries for each occurrence. Marking any occurrence as Done automatically advances the plan's next due date to the following scheduled slot.",
  },
  {
    icon: Sparkles,
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    tag: "New",
    title: "Changeover — 3-mode tracking page",
    desc: "A new Changeover module tracks model changeover tasks between production runs. Three view modes: List (detailed table with progress), Cylinders (animated liquid-fill indicators per task — red → amber → green), and Calendar (monthly view with clickable days). Includes status tracking, line filter, and progress slider.",
  },
  {
    icon: AlertOctagon,
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    tag: "New",
    title: "Defects — production quality defect logging",
    desc: "A new Defects module lets your team log defective unit counts per production line, shift, and date. Includes a preset list of common defect reasons plus a free-text field, optional notes, and filters by line, shift, and date range.",
  },
  {
    icon: BarChart3,
    color: "text-fuchsia-400",
    bg: "bg-fuchsia-500/10 border-fuchsia-500/20",
    tag: "Updated",
    title: "KPI Report — per-member team scorecard",
    desc: "The KPI page is a per-employee performance scorecard, not factory-wide OEE. Each member gets a weighted composite score from: attendance rate, task completion, exam results, broken machine repairs, PM completions, and line plan contributions. Admins can configure weights and thresholds. Includes drill-down modal per member, team filter, month selector, and print/export.",
  },
  {
    icon: Zap,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    tag: "Improved",
    title: "Machine Analysis Modal — full dashboard rebuild",
    desc: "The machine analysis modal now includes 6 KPI cards, 3 donut charts, daily trend, error bar chart + table, OEE/predictive maintenance panel, LOT × Machine flow matrix, anomaly detection, failure heatmap, hourly tracer, and dynamic bottleneck analysis.",
  },
  {
    icon: CheckCircle2,
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    tag: "Fix",
    title: "Machine Monitor — always shows current machine name",
    desc: "The Machine Monitor now uses the registry-based machine name even after a machine has been renamed. Previously it could show stale names from the original log data.",
  },
];

const ACTIVATION_STEPS = [
  {
    icon: Building2,
    color: "text-yellow-400",
    title: "1. Company Registration",
    desc: "Your factory admin visits the factory sign-up page at your unique factory URL. Register with company name, contact info, and admin credentials. No license key is needed at this step.",
  },
  {
    icon: UserCheck,
    color: "text-blue-400",
    title: "2. Owner Approval",
    desc: "After signing up, you'll see a 'Waiting for Approval' screen. The system owner reviews and approves your account. You can email the owner directly from that screen to speed things up.",
  },
  {
    icon: Key,
    color: "text-green-400",
    title: "3. License Activation",
    desc: "Once approved, log in and enter your license key on the activation screen. The owner provides the key. After activation, your full CMMS workspace is unlocked and ready to use.",
  },
];

const DEFAULT_ROLE_INFO = [
  { key: "admin",       defaultLabel: "Admin",       desc: "Full access to all modules, settings, and user management" },
  { key: "manager",     defaultLabel: "Manager",     desc: "Full operational access — no user management or factory settings" },
  { key: "teamleader",  defaultLabel: "Team Leader", desc: "Operational modules including plans, tasks, and production" },
  { key: "maintenance", defaultLabel: "Maintenance", desc: "Downtime, PM, tasks, broken machines, and machine registry" },
  { key: "inventory",   defaultLabel: "Inventory",   desc: "Inventory management, spare part orders, and attendance" },
];

// Map each help section key to its video section ID in the animated tutorial
const SECTION_VIDEO_MAP: Record<string, string> = {
  dashboard: "dashboard",
  downtime: "downtime",
  inventory: "inventory",
  orders: "orders",
  pm: "pm",
  training: "training",
  exams: "training",
  production: "dashboard",
  defects: "defects",
  productionLines: "dashboard",
  tasks: "downtime",
  linePlans: "changeover",
  changeover: "changeover",
  attendance: "attendance",
  vacation: "attendance",
  machines: "machines",
  workPhones: "machines",
  brokenMachines: "broken-machines",
  machineMonitor: "machines",
  machineAnalysis: "kpi",
  kpi: "kpi",
  users: "users",
  auditLogs: "factory-settings",
  reports: "kpi",
  "factory-settings": "factory-settings",
};

function SectionCard({
  s,
  customTitle,
}: {
  s: Section;
  customTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const Icon = s.icon;
  const videoSectionId = SECTION_VIDEO_MAP[s.sectionKey];
  const videoSrc = videoSectionId ? `/cmms-guide-video/?section=${videoSectionId}` : null;

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-card/40 hover:border-white/20 transition-colors">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 ${s.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <button className="flex-1 min-w-0 text-start" onClick={() => setOpen(o => !o)}>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">{customTitle}</p>
            {customTitle !== s.defaultTitle && (
              <span className="text-[10px] text-muted-foreground/50 italic">({s.defaultTitle})</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{s.description}</p>
        </button>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {videoSrc && (
            <button
              onClick={() => { setShowVideo(p => !p); if (!open) setOpen(true); }}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border transition-all ${
                showVideo
                  ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                  : "bg-white/5 border-white/10 text-white/50 hover:text-blue-300 hover:border-blue-500/30"
              }`}
              title="Watch animated tutorial for this section"
            >
              <Play className="w-2.5 h-2.5" />
              Watch
            </button>
          )}
          <button onClick={() => setOpen(o => !o)} className="p-1">
            {open
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground" />
            }
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="px-4 pb-4 space-y-3 border-t border-white/5">
            <ul className="mt-3 space-y-1.5">
              {s.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current ${s.color}`} />
                  {b}
                </li>
              ))}
            </ul>
            {s.roles && (
              <p className="text-[10px] text-muted-foreground/60 border-t border-white/5 pt-2">
                <span className="text-muted-foreground font-medium">Access: </span>{s.roles}
              </p>
            )}
          </div>

          {/* Animated section video */}
          {showVideo && videoSrc && (
            <div className="border-t border-white/5">
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  className="absolute inset-0 w-full h-full border-0"
                  src={videoSrc}
                  title={`Tutorial: ${customTitle}`}
                  allow="autoplay"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Help() {
  const { isAdmin } = useAuth();
  const [showVideo, setShowVideo] = useState(false);
  const companyName = "Midea CMMS";
  const { roleName, sectionName } = useFactoryConfig();

  const visibleSections = ALL_SECTIONS.filter(s => {
    if (s.adminOnly) return isAdmin;
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-6 h-6 text-primary" />
        </div>
        <div>
          {companyName && (
            <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-0.5">{companyName}</p>
          )}
          <h1 className="text-2xl font-bold text-white">System Guide</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Everything you need to know about using your factory's CMMS workspace.
          </p>
        </div>
      </div>

      {/* Animated Tutorial Video — always visible to all users */}
      <div className="border border-primary/30 rounded-xl overflow-hidden bg-primary/5">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-primary/20">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Play className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Animated System Tutorial</p>
            <p className="text-xs text-muted-foreground">Full walkthrough of every section with live animations — Login, Dashboard, Downtime, Inventory, Orders, PM Calendar (recurring tasks), Training, KPI, Attendance, Machines, Changeover, Defects, Backup &amp; Restore, Factory Settings, and more</p>
          </div>
          <button
            onClick={() => setShowVideo(v => !v)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/80 transition-colors flex-shrink-0"
          >
            {showVideo ? "Close" : "Watch"}
          </button>
        </div>
        {showVideo && (
          <div className="w-full bg-black rounded-b-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
            <video
              className="w-full h-full"
              src={import.meta.env.BASE_URL + "cmms-tutorial.mp4"}
              controls
              autoPlay
              playsInline
            />
          </div>
        )}
      </div>

      {/* What's New */}
      <div className="bg-white/3 border border-white/10 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-white">What's New</h2>
          <span className="text-[10px] bg-primary/15 text-primary border border-primary/20 rounded px-1.5 py-0.5 font-medium">March 2026</span>
        </div>
        <div className="space-y-3">
          {WHATS_NEW.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className={`border rounded-lg p-3 flex items-start gap-3 ${item.bg}`}>
                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${item.color}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${item.color}`}>{item.tag}</span>
                    <span className="text-xs font-semibold text-white">{item.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Account activation */}
      <div className="bg-white/3 border border-white/10 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-white">Account Activation Steps</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {ACTIVATION_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="bg-white/5 rounded-lg p-3 space-y-1.5">
                <div className={`flex items-center gap-2 ${step.color}`}>
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-semibold">{step.title}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dashboard info callout */}
      <div className="bg-white/3 border border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">Dashboard Status Widgets</h2>
          <span className="text-[10px] bg-primary/15 text-primary border border-primary/20 rounded px-1.5 py-0.5 font-medium">Admin only</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="bg-white/5 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-yellow-400">
              <KeyRound className="w-4 h-4" />
              <span className="text-xs font-semibold">License Status</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Shows days remaining on your current license. Turns yellow when ≤ 30 days, red when ≤ 7 days. Contact the owner to renew before expiry.
            </p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-primary">
              <HardDrive className="w-4 h-4" />
              <span className="text-xs font-semibold">Storage Usage</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Shows how much of your allocated data storage is used, with a color-coded progress bar. Turns red when above 90% — contact the owner to increase your limit.
            </p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400">
              <Users className="w-4 h-4" />
              <span className="text-xs font-semibold">User Quota</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Shows how many active users you have vs. your factory's user limit. Contact the owner to increase your user quota if needed.
            </p>
          </div>
        </div>
      </div>

      {/* Roles legend */}
      <div className="bg-white/3 border border-white/10 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-white">User Roles</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DEFAULT_ROLE_INFO.map(r => (
            <div key={r.key} className="text-xs">
              <span className="text-white font-medium">{roleName(r.key) || r.defaultLabel}</span>
              <p className="text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
        {isAdmin && (
          <p className="text-[10px] text-muted-foreground/50 border-t border-white/5 pt-2">
            Role display names can be customized in Factory Settings. The system role keys are unchanged.
          </p>
        )}
      </div>

      {/* Module sections */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
          Available Modules
        </h2>
        <div className="space-y-2">
          {visibleSections.map(s => (
            <SectionCard
              key={s.sectionKey}
              s={s}
              customTitle={sectionName(s.sectionKey, s.defaultTitle)}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground/50 pb-4">
        {companyName ? companyName : "CMMS"} — System Guide · Last updated March 2026
      </div>
    </div>
  );
}
