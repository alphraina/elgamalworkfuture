import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, AlertTriangle, PackageSearch, ShoppingCart,
  CalendarClock, GraduationCap, FileCheck2, Activity, Factory,
  CheckSquare, ClipboardList, Users, Palmtree, QrCode, Smartphone,
  Wrench, MonitorDot, Cpu, BarChart3, LineChart, ShieldCheck,
  Settings2, ArrowLeftRight, AlertOctagon, X, Plus, Trash2,
  ChevronDown, Search,
} from "lucide-react";

// ─── Cursor SVG ─────────────────────────────────────────────────────────────
function CursorSVG({ clicking }: { clicking: boolean }) {
  return (
    <div className="relative">
      <svg width="18" height="22" viewBox="0 0 18 22" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))" }}>
        <path d="M0 0L0 18L4.5 13.5L7.5 20L9.5 19.2L6.5 12.5L13 12.5Z" fill="white" stroke="#111827" strokeWidth="0.8" />
      </svg>
      <AnimatePresence>
        {clicking && (
          <motion.div
            key="ripple"
            className="absolute top-1 left-1 rounded-full border-2 border-white/80"
            initial={{ width: 0, height: 0, opacity: 1, x: 0, y: 0 }}
            animate={{ width: 28, height: 28, opacity: 0, x: -14, y: -14 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sidebar nav data ────────────────────────────────────────────────────────
const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "downtime", label: "Downtime", icon: AlertTriangle },
  { key: "inventory", label: "Inventory", icon: PackageSearch },
  { key: "orders", label: "Orders", icon: ShoppingCart },
  { key: "pm", label: "PM", icon: CalendarClock },
  { key: "training", label: "Training", icon: GraduationCap },
  { key: "exams", label: "Exams", icon: FileCheck2 },
  { key: "production", label: "Production", icon: Activity },
  { key: "defects", label: "Defects", icon: AlertOctagon },
  { key: "productionLines", label: "Lines", icon: Factory },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "linePlans", label: "Line Plans", icon: ClipboardList },
  { key: "changeover", label: "Changeover", icon: ArrowLeftRight },
  { key: "attendance", label: "Attendance", icon: Users },
  { key: "vacation", label: "Vacation", icon: Palmtree },
  { key: "machines", label: "Machines", icon: QrCode },
  { key: "workPhones", label: "Phones", icon: Smartphone },
  { key: "brokenMachines", label: "Broken", icon: Wrench },
  { key: "machineMonitor", label: "Monitor", icon: MonitorDot },
  { key: "machineAnalysis", label: "Analysis", icon: Cpu },
  { key: "kpi", label: "KPI", icon: BarChart3 },
  { key: "reports", label: "Analytics", icon: LineChart },
  { key: "users", label: "Users", icon: ShieldCheck },
  { key: "auditLogs", label: "Audit", icon: ShieldCheck },
  { key: "factory-settings", label: "Settings", icon: Settings2 },
];

// ─── Status badge helper ─────────────────────────────────────────────────────
function StatusBadge({ text }: { text: string }) {
  const cls =
    text === "Open" || text === "Pending" || text === "Reported"
      ? "bg-red-500/20 text-red-300 border-red-500/30"
      : text === "Resolved" || text === "Completed" || text === "Fulfilled" || text === "Approved" || text === "Active"
      ? "bg-green-500/20 text-green-300 border-green-500/30"
      : text === "In Progress" || text === "Scheduled"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
      : "bg-white/10 text-white/50 border-white/10";
  return <span className={`text-[7px] px-1 py-0.5 rounded border ${cls} font-medium whitespace-nowrap`}>{text}</span>;
}

// ─── Section data ────────────────────────────────────────────────────────────
interface ScreencastDef {
  pageTitle: string;
  columns: string[];
  rows: string[][];
  formTitle: string;
  fields: { label: string; value: string; type?: "select" | "text" }[];
  newRow: string[];
  deleteRowIndex: number;
}

const SCREENCAST_DATA: Record<string, ScreencastDef> = {
  dashboard: {
    pageTitle: "Dashboard",
    columns: ["Metric", "Value", "Status"],
    rows: [
      ["Open Downtime", "3 incidents", "Open"],
      ["Pending PM", "7 tasks", "Pending"],
      ["Today Attendance", "42 / 45", "Active"],
      ["Active Production", "Line 1, 2, 3", "Active"],
    ],
    formTitle: "Dashboard Overview",
    fields: [{ label: "Period", value: "Today" }, { label: "Team", value: "All Teams" }],
    newRow: ["Storage Usage", "34% used", "Active"],
    deleteRowIndex: 0,
  },
  downtime: {
    pageTitle: "Downtime Records",
    columns: ["Machine", "Category", "Status", "Duration"],
    rows: [
      ["Machine A – L1", "Electrical", "Open", "2h 15m"],
      ["Machine B – L2", "Mechanical", "Resolved", "45m"],
      ["Machine C – L3", "Software", "Open", "1h 0m"],
    ],
    formTitle: "New Downtime Record",
    fields: [
      { label: "Machine", value: "Machine D – Line 1", type: "select" },
      { label: "Category", value: "Mechanical", type: "select" },
      { label: "Reason", value: "Gear bearing failure" },
      { label: "Start Time", value: "09:30 AM" },
    ],
    newRow: ["Machine D – Line 1", "Mechanical", "Open", "0m"],
    deleteRowIndex: 1,
  },
  inventory: {
    pageTitle: "Inventory",
    columns: ["Part No.", "Name", "Stock", "Min"],
    rows: [
      ["SP-001", "Bearing 6205", "24 pcs", "10"],
      ["SP-002", "Motor Belt A", "6 pcs", "5"],
      ["SP-003", "Filter Mesh", "3 pcs", "8"],
    ],
    formTitle: "Add Spare Part",
    fields: [
      { label: "Part Number", value: "SP-004" },
      { label: "Name", value: "Coupling Disc" },
      { label: "Unit", value: "pcs" },
      { label: "Stock Qty", value: "15" },
    ],
    newRow: ["SP-004", "Coupling Disc", "15 pcs", "5"],
    deleteRowIndex: 0,
  },
  orders: {
    pageTitle: "Spare Part Orders",
    columns: ["Part", "Qty", "Requester", "Status"],
    rows: [
      ["Bearing 6205", "4", "Ahmed K.", "Pending"],
      ["Motor Belt A", "2", "Omar T.", "Fulfilled"],
      ["Filter Mesh", "10", "Sara M.", "Pending"],
    ],
    formTitle: "New Order Request",
    fields: [
      { label: "Part", value: "Coupling Disc", type: "select" },
      { label: "Quantity", value: "3" },
      { label: "Notes", value: "Urgent - Line 2 stopped" },
    ],
    newRow: ["Coupling Disc", "3", "Current User", "Pending"],
    deleteRowIndex: 1,
  },
  pm: {
    pageTitle: "Preventive Maintenance",
    columns: ["Machine", "Frequency", "Assignee", "Status"],
    rows: [
      ["Machine A", "Weekly", "Team A", "Completed"],
      ["Machine B", "Monthly", "Team B", "Pending"],
      ["Machine C", "Daily", "Team A", "In Progress"],
    ],
    formTitle: "New PM Plan",
    fields: [
      { label: "Machine", value: "Machine D", type: "select" },
      { label: "Frequency", value: "Weekly", type: "select" },
      { label: "Shift", value: "Morning", type: "select" },
      { label: "Assignee", value: "Team B", type: "select" },
    ],
    newRow: ["Machine D", "Weekly", "Team B", "Pending"],
    deleteRowIndex: 1,
  },
  training: {
    pageTitle: "Training Plans",
    columns: ["Title", "Trainer", "Date", "Status"],
    rows: [
      ["Safety Induction", "Eng. Ahmed", "Mar 20", "Completed"],
      ["Machine Operation", "Eng. Sara", "Mar 25", "Scheduled"],
      ["Quality Control", "Eng. Omar", "Mar 28", "Scheduled"],
    ],
    formTitle: "New Training Plan",
    fields: [
      { label: "Title", value: "Electrical Safety" },
      { label: "Trainer", value: "Eng. Nour" },
      { label: "Date", value: "Apr 5, 2024" },
      { label: "Team", value: "Maintenance", type: "select" },
    ],
    newRow: ["Electrical Safety", "Eng. Nour", "Apr 5", "Scheduled"],
    deleteRowIndex: 1,
  },
  exams: {
    pageTitle: "Training Exams",
    columns: ["Title", "Questions", "Pass Score", "Taken"],
    rows: [
      ["Safety Basics", "15 Qs", "70%", "12"],
      ["Machine Ops", "20 Qs", "75%", "8"],
      ["Quality SOP", "10 Qs", "80%", "5"],
    ],
    formTitle: "New Exam",
    fields: [
      { label: "Exam Title", value: "Electrical Safety Exam" },
      { label: "No. of Questions", value: "12" },
      { label: "Passing Score", value: "75%" },
    ],
    newRow: ["Electrical Safety", "12 Qs", "75%", "0"],
    deleteRowIndex: 2,
  },
  production: {
    pageTitle: "Production Capacity",
    columns: ["Line", "Shift", "Actual", "Target"],
    rows: [
      ["Line 1", "Morning", "420 units", "450 units"],
      ["Line 2", "Afternoon", "380 units", "400 units"],
      ["Line 3", "Morning", "510 units", "500 units"],
    ],
    formTitle: "Log Production",
    fields: [
      { label: "Production Line", value: "Line 4", type: "select" },
      { label: "Shift", value: "Morning", type: "select" },
      { label: "Actual Output", value: "390 units" },
      { label: "Target", value: "400 units" },
    ],
    newRow: ["Line 4", "Morning", "390 units", "400 units"],
    deleteRowIndex: 1,
  },
  defects: {
    pageTitle: "Defects",
    columns: ["Line", "Shift", "Reason", "Qty"],
    rows: [
      ["Line 1", "Morning", "Surface defect", "12"],
      ["Line 2", "Afternoon", "Assembly error", "5"],
      ["Line 3", "Morning", "Missing component", "3"],
    ],
    formTitle: "Log Defect",
    fields: [
      { label: "Production Line", value: "Line 1", type: "select" },
      { label: "Shift", value: "Night", type: "select" },
      { label: "Reason", value: "Weld defect", type: "select" },
      { label: "Quantity", value: "7" },
    ],
    newRow: ["Line 1", "Night", "Weld defect", "7"],
    deleteRowIndex: 1,
  },
  productionLines: {
    pageTitle: "Production Lines",
    columns: ["Name", "Team", "Target/hr", "Status"],
    rows: [
      ["Line 1", "Assembly", "450 units", "Active"],
      ["Line 2", "Test", "400 units", "Active"],
      ["Line 3", "Packaging", "500 units", "Active"],
    ],
    formTitle: "Add Production Line",
    fields: [
      { label: "Line Name", value: "Line 4" },
      { label: "Department", value: "Assembly", type: "select" },
      { label: "Target (units/hr)", value: "420" },
      { label: "Supervisor", value: "Ahmed K.", type: "select" },
    ],
    newRow: ["Line 4", "Assembly", "420 units", "Active"],
    deleteRowIndex: 2,
  },
  tasks: {
    pageTitle: "Tasks & Alerts",
    columns: ["Title", "Assignee", "Priority", "Status"],
    rows: [
      ["Fix conveyor belt", "Ahmed K.", "High", "Open"],
      ["Calibrate sensors", "Omar T.", "Medium", "In Progress"],
      ["Lubricate gears", "Sara M.", "Low", "Completed"],
    ],
    formTitle: "New Task",
    fields: [
      { label: "Title", value: "Replace air filter" },
      { label: "Assign To", value: "Ahmed K.", type: "select" },
      { label: "Priority", value: "High", type: "select" },
      { label: "Due Date", value: "Mar 28, 2024" },
    ],
    newRow: ["Replace air filter", "Ahmed K.", "High", "Open"],
    deleteRowIndex: 2,
  },
  linePlans: {
    pageTitle: "Daily Line Plans",
    columns: ["Line", "Shift", "Model", "Target"],
    rows: [
      ["Line 1", "Morning", "A300X", "450 units"],
      ["Line 2", "Afternoon", "B200", "400 units"],
      ["Line 3", "Night", "A300X", "380 units"],
    ],
    formTitle: "New Line Plan",
    fields: [
      { label: "Production Line", value: "Line 4", type: "select" },
      { label: "Shift", value: "Morning", type: "select" },
      { label: "Model Number", value: "B200" },
      { label: "Planned Qty", value: "420" },
    ],
    newRow: ["Line 4", "Morning", "B200", "420 units"],
    deleteRowIndex: 1,
  },
  changeover: {
    pageTitle: "Changeover",
    columns: ["Title", "Line", "Progress", "Status"],
    rows: [
      ["A300X → B200", "Line 1", "85%", "In Progress"],
      ["B200 → C100", "Line 2", "100%", "Completed"],
      ["C100 → A300X", "Line 3", "20%", "Pending"],
    ],
    formTitle: "New Changeover",
    fields: [
      { label: "Title", value: "B200 → D500" },
      { label: "Line", value: "Line 4", type: "select" },
      { label: "Target Date", value: "Mar 25, 2024" },
      { label: "Duration (min)", value: "45" },
    ],
    newRow: ["B200 → D500", "Line 4", "0%", "Pending"],
    deleteRowIndex: 1,
  },
  attendance: {
    pageTitle: "Attendance",
    columns: ["Employee", "Work ID", "Status", "Shift"],
    rows: [
      ["Ahmed Kareem", "WK-001", "Active", "Morning"],
      ["Sara Mohamed", "WK-002", "Active", "Morning"],
      ["Omar Taher", "WK-003", "Pending", "Afternoon"],
    ],
    formTitle: "Mark Attendance",
    fields: [
      { label: "Date", value: "Mar 24, 2024" },
      { label: "Employee", value: "Nour Ali", type: "select" },
      { label: "Status", value: "Present", type: "select" },
      { label: "Shift", value: "Morning", type: "select" },
    ],
    newRow: ["Nour Ali", "WK-004", "Active", "Morning"],
    deleteRowIndex: 2,
  },
  vacation: {
    pageTitle: "Vacation Requests",
    columns: ["Employee", "From", "To", "Status"],
    rows: [
      ["Ahmed K.", "Apr 1", "Apr 3", "Approved"],
      ["Sara M.", "Apr 5", "Apr 7", "Pending"],
      ["Omar T.", "Apr 10", "Apr 12", "Pending"],
    ],
    formTitle: "New Vacation Request",
    fields: [
      { label: "Employee", value: "Nour Ali", type: "select" },
      { label: "Start Date", value: "Apr 15, 2024" },
      { label: "End Date", value: "Apr 17, 2024" },
      { label: "Reason", value: "Annual leave" },
    ],
    newRow: ["Nour Ali", "Apr 15", "Apr 17", "Pending"],
    deleteRowIndex: 2,
  },
  machines: {
    pageTitle: "Machine Registry",
    columns: ["Code", "Name", "Model", "Line"],
    rows: [
      ["MCH-001", "Conveyor A", "CV-500", "Line 1"],
      ["MCH-002", "Press B", "PR-200", "Line 2"],
      ["MCH-003", "Welder C", "WD-300", "Line 3"],
    ],
    formTitle: "Register Machine",
    fields: [
      { label: "Machine Code", value: "MCH-004" },
      { label: "Name", value: "Drill Press D" },
      { label: "Model", value: "DP-100" },
      { label: "Assign to Line", value: "Line 4", type: "select" },
    ],
    newRow: ["MCH-004", "Drill Press D", "DP-100", "Line 4"],
    deleteRowIndex: 2,
  },
  workPhones: {
    pageTitle: "Work Phones",
    columns: ["Work ID", "Employee", "Phone No.", "Color"],
    rows: [
      ["WK-001", "Ahmed K.", "0501234567", "Black"],
      ["WK-002", "Sara M.", "0507654321", "Silver"],
      ["WK-003", "Omar T.", "0509876543", "Blue"],
    ],
    formTitle: "Register Work Phone",
    fields: [
      { label: "Work ID", value: "WK-004" },
      { label: "Employee Name", value: "Nour Ali" },
      { label: "Phone Number", value: "0501112233" },
      { label: "Color", value: "Black" },
    ],
    newRow: ["WK-004", "Nour Ali", "0501112233", "Black"],
    deleteRowIndex: 2,
  },
  brokenMachines: {
    pageTitle: "Broken Machines",
    columns: ["Machine", "Issue", "Reporter", "Status"],
    rows: [
      ["Machine A", "Motor overheating", "Ahmed K.", "Reported"],
      ["Machine B", "Belt slipping", "Omar T.", "In Progress"],
      ["Machine C", "Sensor error", "Sara M.", "Resolved"],
    ],
    formTitle: "Report Broken Machine",
    fields: [
      { label: "Machine", value: "Machine D", type: "select" },
      { label: "Issue Description", value: "Hydraulic leak on unit" },
      { label: "Reporter", value: "Current User" },
    ],
    newRow: ["Machine D", "Hydraulic leak", "Current User", "Reported"],
    deleteRowIndex: 2,
  },
  machineMonitor: {
    pageTitle: "Machine Monitor",
    columns: ["Machine IP", "Pass", "Fail", "Pass Rate"],
    rows: [
      ["192.168.1.10", "142", "3", "97.9%"],
      ["192.168.1.11", "98", "12", "89.1%"],
      ["192.168.1.12", "205", "1", "99.5%"],
    ],
    formTitle: "Reset Monitor Data",
    fields: [
      { label: "Action", value: "Clear all live data", type: "select" },
      { label: "Confirm", value: "Type RESET to confirm" },
    ],
    newRow: ["192.168.1.13", "0", "0", "—"],
    deleteRowIndex: 1,
  },
  machineAnalysis: {
    pageTitle: "Machine Analysis",
    columns: ["Metric", "Value", "Status", "Trend"],
    rows: [
      ["Pass Rate", "97.9%", "Active", "↑ +1.2%"],
      ["Cycle Time", "4.2s", "Active", "→ stable"],
      ["OEE Score", "84.3%", "Pending", "↓ -0.5%"],
    ],
    formTitle: "Analysis Config",
    fields: [
      { label: "Machine IP", value: "192.168.1.10", type: "select" },
      { label: "Date Range", value: "Last 30 days", type: "select" },
    ],
    newRow: ["MTBF", "127h", "Active", "↑ good"],
    deleteRowIndex: 2,
  },
  kpi: {
    pageTitle: "KPI Report — March 2024",
    columns: ["Employee", "Role", "Score", "Status"],
    rows: [
      ["Ahmed K.", "Maintenance", "94%", "Active"],
      ["Sara M.", "Team Leader", "87%", "Active"],
      ["Omar T.", "Inventory", "72%", "Active"],
    ],
    formTitle: "KPI Weight Settings",
    fields: [
      { label: "Attendance Weight", value: "30%" },
      { label: "Tasks Weight", value: "25%" },
      { label: "Exams Weight", value: "20%" },
      { label: "Repairs Weight", value: "15%" },
    ],
    newRow: ["Nour A.", "Maintenance", "61%", "Active"],
    deleteRowIndex: 2,
  },
  reports: {
    pageTitle: "Analytics & Reports",
    columns: ["Machine", "Downtime", "MTTR", "MTBF"],
    rows: [
      ["Machine A", "4.5h", "1.5h", "127h"],
      ["Machine B", "2.0h", "0.7h", "209h"],
      ["Machine C", "8.2h", "2.1h", "62h"],
    ],
    formTitle: "Report Filters",
    fields: [
      { label: "Period", value: "Last 30 days", type: "select" },
      { label: "Production Line", value: "All Lines", type: "select" },
    ],
    newRow: ["Machine D", "1.0h", "0.5h", "300h"],
    deleteRowIndex: 2,
  },
  users: {
    pageTitle: "User Management",
    columns: ["Name", "Work ID", "Role", "Status"],
    rows: [
      ["Ahmed K.", "WK-001", "Maintenance", "Active"],
      ["Sara M.", "WK-002", "Team Leader", "Active"],
      ["New User", "WK-005", "—", "Pending"],
    ],
    formTitle: "Edit User",
    fields: [
      { label: "Full Name", value: "Nour Ali" },
      { label: "Work ID", value: "WK-006" },
      { label: "Role", value: "Maintenance", type: "select" },
      { label: "Department", value: "Test Team", type: "select" },
    ],
    newRow: ["Nour Ali", "WK-006", "Maintenance", "Active"],
    deleteRowIndex: 2,
  },
  auditLogs: {
    pageTitle: "Audit Logs",
    columns: ["User", "Action", "Entity", "Time"],
    rows: [
      ["Ahmed K.", "CREATE", "Downtime", "09:41 AM"],
      ["Sara M.", "UPDATE", "Task", "09:35 AM"],
      ["Admin", "DELETE", "Inventory", "09:20 AM"],
    ],
    formTitle: "Filter Logs",
    fields: [
      { label: "Action Type", value: "All Types", type: "select" },
      { label: "User", value: "All Users", type: "select" },
      { label: "Date", value: "Mar 24, 2024" },
    ],
    newRow: ["Current User", "VIEW", "AuditLog", "Now"],
    deleteRowIndex: 2,
  },
  "factory-settings": {
    pageTitle: "Factory Settings",
    columns: ["Setting", "Current Value", "Type", "Status"],
    rows: [
      ["Admin Role Name", "Admin", "Role Name", "Active"],
      ["Auto-Downtime Threshold", "3 repeats", "OMTP", "Active"],
      ["Max Users", "50", "Limit", "Active"],
    ],
    formTitle: "Edit Setting",
    fields: [
      { label: "Setting", value: "Section Name", type: "select" },
      { label: "New Value", value: "Quality Control" },
      { label: "Apply To", value: "All Users", type: "select" },
    ],
    newRow: ["KPI Section Name", "Performance", "Section Name", "Active"],
    deleteRowIndex: 2,
  },
};

// ─── Timeline phases ─────────────────────────────────────────────────────────
type Phase =
  | "start"
  | "moving-to-nav"
  | "clicked-nav"
  | "browsing"
  | "moving-to-add"
  | "clicked-add"
  | "form-visible"
  | "typing-1"
  | "typing-2"
  | "moving-to-save"
  | "clicked-save"
  | "row-added"
  | "moving-to-delete"
  | "clicked-delete"
  | "row-deleted"
  | "done";

const PHASE_SEQ: Phase[] = [
  "start", "moving-to-nav", "clicked-nav", "browsing",
  "moving-to-add", "clicked-add", "form-visible",
  "typing-1", "typing-2",
  "moving-to-save", "clicked-save", "row-added",
  "moving-to-delete", "clicked-delete", "row-deleted", "done",
];

const PHASE_DURATION: Record<Phase, number> = {
  start: 600,
  "moving-to-nav": 900,
  "clicked-nav": 300,
  browsing: 1400,
  "moving-to-add": 700,
  "clicked-add": 300,
  "form-visible": 600,
  "typing-1": 1200,
  "typing-2": 1000,
  "moving-to-save": 600,
  "clicked-save": 300,
  "row-added": 1400,
  "moving-to-delete": 900,
  "clicked-delete": 300,
  "row-deleted": 800,
  done: 400,
};

const PHASE_CAPTION: Record<Phase, string> = {
  start: "Opening Midea CMMS...",
  "moving-to-nav": "Navigating to the section...",
  "clicked-nav": "Section selected",
  browsing: "Viewing existing records in the list...",
  "moving-to-add": 'Moving to "+ Add New"...',
  "clicked-add": "Opening the form...",
  "form-visible": "Form is open, filling in the details...",
  "typing-1": "Entering the first field...",
  "typing-2": "Filling in the remaining fields...",
  "moving-to-save": "Moving to the Save button...",
  "clicked-save": "Saving the record...",
  "row-added": "New record added to the list!",
  "moving-to-delete": "Selecting a record to delete...",
  "clicked-delete": "Confirming deletion...",
  "row-deleted": "Record removed successfully.",
  done: "Done — restarting demo...",
};

// ─── Cursor target positions (% of container 380×260) ───────────────────────
// sidebar is ~22%, header is ~15% height
const CUR = {
  rest:       { x: 55, y: 70 },
  navItem:    { x: 11, y: 55 },
  browse1:    { x: 60, y: 38 },
  browse2:    { x: 45, y: 48 },
  addBtn:     { x: 87, y: 14 },
  field1:     { x: 55, y: 42 },
  field2:     { x: 55, y: 52 },
  saveBtn:    { x: 55, y: 76 },
  deleteRow:  { x: 87, y: 48 },
  confirmBtn: { x: 62, y: 52 },
};

// ─── Typewriter hook ─────────────────────────────────────────────────────────
function useTypewriter(target: string, active: boolean, speed = 45) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!active) { setText(""); return; }
    let i = 0;
    setText("");
    const iv = setInterval(() => {
      i++;
      setText(target.slice(0, i));
      if (i >= target.length) clearInterval(iv);
    }, speed);
    return () => clearInterval(iv);
  }, [active, target, speed]);
  return text;
}

// ─── Main component ──────────────────────────────────────────────────────────
interface Props { sectionKey: string; onClose: () => void }

export function SectionScreencast({ sectionKey, onClose }: Props) {
  const data = SCREENCAST_DATA[sectionKey];
  const navEntry = NAV.find(n => n.key === sectionKey);

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [newRow, setNewRow] = useState<string[] | null>(null);
  const [deletedRowIndex, setDeletedRowIndex] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const phase = PHASE_SEQ[phaseIndex] ?? "done";

  const t1 = useTypewriter(data?.fields[0]?.value ?? "", phase === "typing-1");
  const t2 = useTypewriter(
    (data?.fields.slice(1).map(f => f.value).join(" · ")) ?? "",
    phase === "typing-2",
  );

  const reset = useCallback(() => {
    setPhaseIndex(0);
    setShowModal(false);
    setNewRow(null);
    setDeletedRowIndex(null);
    setShowConfirm(false);
  }, []);

  // Phase side effects
  useEffect(() => {
    if (phase === "clicked-add") setShowModal(true);
    if (phase === "clicked-save") {
      setTimeout(() => {
        setShowModal(false);
        setNewRow(data?.newRow ?? []);
      }, 250);
    }
    if (phase === "clicked-delete") setShowConfirm(true);
    if (phase === "row-deleted") {
      setShowConfirm(false);
      setDeletedRowIndex(data?.deleteRowIndex ?? 0);
    }
    if (phase === "done") {
      setTimeout(reset, 400);
    }
  }, [phase, data, reset]);

  // Advance phases
  useEffect(() => {
    if (paused) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setPhaseIndex(i => {
        const next = i + 1;
        return next < PHASE_SEQ.length ? next : 0;
      });
    }, PHASE_DURATION[phase]);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phaseIndex, paused, phase]);

  if (!data || !navEntry) return null;

  // Compute cursor position
  const cursorPos = (() => {
    if (phase === "start" || phase === "done") return CUR.rest;
    if (phase === "moving-to-nav" || phase === "clicked-nav") return CUR.navItem;
    if (phase === "browsing") return phaseIndex % 2 === 0 ? CUR.browse1 : CUR.browse2;
    if (phase === "moving-to-add" || phase === "clicked-add") return CUR.addBtn;
    if (phase === "form-visible" || phase === "typing-1") return CUR.field1;
    if (phase === "typing-2") return CUR.field2;
    if (phase === "moving-to-save" || phase === "clicked-save") return CUR.saveBtn;
    if (phase === "row-added") return CUR.browse1;
    if (phase === "moving-to-delete" || phase === "clicked-delete") return CUR.deleteRow;
    if (phase === "row-deleted") return CUR.rest;
    return CUR.rest;
  })();

  const clicking = phase === "clicked-nav" || phase === "clicked-add" ||
    phase === "clicked-save" || phase === "clicked-delete";

  const NavIcon = navEntry.icon;

  return (
    <div className="border-t border-white/5">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&display=swap');
        .sc-chakra { font-family: 'Chakra Petch', sans-serif; }
      `}</style>

      {/* ── Screencast container ── */}
      <div className="relative bg-[#090d13] overflow-hidden select-none" style={{ height: 264 }}>

        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{ backgroundImage: "linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)", backgroundSize: "18px 18px" }} />

        {/* ── App shell ── */}
        <div className="absolute inset-0 flex" style={{ bottom: 28 }}>

          {/* Sidebar */}
          <div className="w-[88px] flex-shrink-0 border-r border-white/[0.06] bg-[#0b0f1a] flex flex-col overflow-hidden">
            <div className="px-2 pt-2 pb-1.5 border-b border-white/[0.06]">
              <div className="sc-chakra text-[8px] font-bold text-blue-400 leading-tight">Midea</div>
              <div className="sc-chakra text-[6px] text-white/25 tracking-widest">CMMS</div>
            </div>
            <div className="flex-1 overflow-hidden py-0.5">
              {NAV.slice(0, 14).map(item => {
                const Icon = item.icon;
                const active = item.key === sectionKey;
                return (
                  <div key={item.key}
                    className={`flex items-center gap-1 px-2 py-[3px] text-[7px] transition-colors ${
                      active
                        ? "bg-blue-500/15 text-blue-300 border-l-2 border-blue-500"
                        : "text-white/25 border-l-2 border-transparent"
                    } ${phase === "moving-to-nav" || phase === "clicked-nav" ? (active ? "bg-blue-500/20" : "") : ""}`}>
                    <Icon className="w-2.5 h-2.5 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Page header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-[#0c1120] flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <NavIcon className="w-3 h-3 text-blue-400 flex-shrink-0" />
                <span className="sc-chakra text-[10px] font-semibold text-white truncate">{data.pageTitle}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-5 px-1.5 bg-white/5 border border-white/10 rounded flex items-center gap-0.5">
                  <Search className="w-2 h-2 text-white/30" />
                  <span className="text-[7px] text-white/20">Search...</span>
                </div>
                <motion.div
                  animate={phase === "moving-to-add" ? { backgroundColor: "rgba(59,130,246,0.4)", scale: 1.05 } : { backgroundColor: "rgba(59,130,246,0.2)", scale: 1 }}
                  className="h-5 px-2 rounded text-[7px] text-blue-300 border border-blue-500/40 flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-2.5 h-2.5" />
                  Add New
                </motion.div>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 p-2 overflow-hidden flex flex-col gap-0.5">
              {/* Column headers */}
              <div className="flex gap-1 px-2 pb-1 border-b border-white/[0.05]">
                {data.columns.map((col, i) => (
                  <span key={i} className="text-[7px] text-white/25 font-medium flex-1 truncate">{col}</span>
                ))}
                <span className="text-[7px] text-white/25 w-8 text-right">Act</span>
              </div>

              {/* Data rows */}
              {data.rows.map((row, i) => {
                const isDeleted = deletedRowIndex === i;
                const isDeleteTarget = data.deleteRowIndex === i && (phase === "moving-to-delete" || phase === "clicked-delete");
                return (
                  <motion.div
                    key={i}
                    animate={{ opacity: isDeleted ? 0 : 1, x: isDeleted ? -20 : 0 }}
                    transition={{ duration: 0.4 }}
                    className={`flex gap-1 px-2 py-1 rounded text-[7px] ${isDeleteTarget ? "bg-red-500/10 border border-red-500/20" : "bg-white/[0.03] hover:bg-white/[0.05]"}`}
                  >
                    {row.map((cell, j) => {
                      const isStatus = j === 2 && ["Open","Resolved","Pending","In Progress","Active","Reported","Fulfilled","Completed","Approved","Scheduled"].includes(cell);
                      return (
                        <span key={j} className="flex-1 truncate">
                          {isStatus ? <StatusBadge text={cell} /> : <span className="text-white/55">{cell}</span>}
                        </span>
                      );
                    })}
                    <div className="w-8 flex justify-end items-center gap-0.5">
                      <Trash2 className={`w-2.5 h-2.5 transition-colors ${isDeleteTarget ? "text-red-400" : "text-white/15"}`} />
                    </div>
                  </motion.div>
                );
              })}

              {/* New row */}
              <AnimatePresence>
                {newRow && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, backgroundColor: "rgba(34,197,94,0.15)" }}
                    animate={{ opacity: 1, y: 0, backgroundColor: ["rgba(34,197,94,0.15)", "rgba(34,197,94,0.05)"] }}
                    transition={{ duration: 0.5 }}
                    className="flex gap-1 px-2 py-1 rounded text-[7px] border border-green-500/25"
                  >
                    {newRow.map((cell, j) => {
                      const isStatus = j === 2 && ["Open","Resolved","Pending","In Progress","Active","Reported","Fulfilled","Completed","Approved","Scheduled"].includes(cell);
                      return (
                        <span key={j} className="flex-1 truncate">
                          {isStatus ? <StatusBadge text={cell} /> : <span className="text-green-300/80">{cell}</span>}
                        </span>
                      );
                    })}
                    <div className="w-8 flex justify-end items-center">
                      <Trash2 className="w-2.5 h-2.5 text-white/15" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Modal overlay ── */}
        <AnimatePresence>
          {showModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/65 flex items-center justify-center z-20"
              style={{ bottom: 28 }}
            >
              <motion.div
                initial={{ scale: 0.88, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className="bg-[#131c2f] border border-white/10 rounded-xl p-4 w-52 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="sc-chakra text-[10px] font-semibold text-white">{data.formTitle}</span>
                  <X className="w-3 h-3 text-white/30" />
                </div>

                {data.fields.map((field, fi) => (
                  <div key={fi} className="mb-2">
                    <div className="text-[7px] text-white/35 mb-0.5">{field.label}</div>
                    <div className={`h-5 rounded px-1.5 flex items-center text-[7px] border ${
                      fi === 0 && phase === "typing-1" ? "border-blue-500/60 bg-blue-500/5" :
                      fi !== 0 && phase === "typing-2" ? "border-blue-500/40 bg-blue-500/5" :
                      "border-white/10 bg-white/5"
                    }`}>
                      {field.type === "select" ? (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-white/50">
                            {fi === 0 ? (phase === "typing-1" || phase === "typing-2" || phase === "moving-to-save" || phase === "clicked-save" ? field.value : "") :
                             (phase === "typing-2" || phase === "moving-to-save" || phase === "clicked-save" ? field.value : "")}
                          </span>
                          <ChevronDown className="w-2 h-2 text-white/25 flex-shrink-0" />
                        </div>
                      ) : (
                        <span className="text-white/65">
                          {fi === 0 ? t1 : (phase === "typing-2" || phase === "moving-to-save" || phase === "clicked-save" ? field.value : "")}
                          {((fi === 0 && phase === "typing-1") || (fi !== 0 && phase === "typing-2")) && (
                            <span className="animate-pulse text-blue-400 ml-0.5">|</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                <motion.div
                  animate={phase === "moving-to-save" || phase === "clicked-save"
                    ? { backgroundColor: "rgba(59,130,246,0.9)", scale: 1.02 }
                    : { backgroundColor: "rgba(59,130,246,0.2)", scale: 1 }}
                  className="mt-3 h-6 rounded flex items-center justify-center text-[8px] font-semibold text-white border border-blue-500/40 cursor-pointer"
                >
                  Save Record
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Delete confirm ── */}
        <AnimatePresence>
          {showConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 flex items-center justify-center z-30"
              style={{ bottom: 28 }}
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#1a1020] border border-red-500/30 rounded-xl p-4 w-44 shadow-2xl"
              >
                <div className="text-[9px] font-semibold text-red-400 mb-1">Delete Record?</div>
                <div className="text-[7px] text-white/40 mb-3">This action cannot be undone.</div>
                <div className="flex gap-2">
                  <div className="flex-1 h-5 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[7px] text-white/40">Cancel</div>
                  <motion.div
                    animate={{ backgroundColor: "rgba(239,68,68,0.8)" }}
                    className="flex-1 h-5 rounded flex items-center justify-center text-[7px] font-semibold text-white cursor-pointer"
                  >
                    Delete
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Animated cursor ── */}
        <motion.div
          className="absolute pointer-events-none z-50"
          animate={{ left: `${cursorPos.x}%`, top: `${cursorPos.y}%` }}
          transition={{ type: "spring", stiffness: 180, damping: 22, mass: 0.8 }}
          style={{ translateX: "-2px", translateY: "-2px" }}
        >
          <CursorSVG clicking={clicking} />
        </motion.div>

        {/* ── Caption bar ── */}
        <div className="absolute bottom-0 left-0 right-0 h-7 bg-[#050810]/90 border-t border-white/[0.05] flex items-center gap-2 px-3">
          {/* Progress dots */}
          <div className="flex gap-0.5">
            {PHASE_SEQ.map((p, i) => (
              <div key={i} className={`w-1 h-1 rounded-full transition-all ${i === phaseIndex ? "bg-blue-400 w-2.5" : i < phaseIndex ? "bg-blue-500/40" : "bg-white/10"}`} />
            ))}
          </div>
          <span className="flex-1 text-[8px] text-white/55 truncate">{PHASE_CAPTION[phase]}</span>

          {/* Controls */}
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPaused(p => !p)}
              className="text-[7px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 hover:text-white/70 transition-colors">
              {paused ? "▶" : "⏸"}
            </button>
            <button onClick={() => { reset(); }} className="text-[7px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 hover:text-white/70 transition-colors">
              ↺
            </button>
            <button onClick={onClose} className="text-[7px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 hover:text-red-400 transition-colors">
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
