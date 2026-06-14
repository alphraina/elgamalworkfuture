export type CursorWaypoint = {
  x: number;
  y: number;
  delay: number;
  click?: boolean;
};

export type ZoomRegion = {
  x: number;
  y: number;
  scale: number;
  startAt: number;
};

export type Callout = {
  x: number;      // % of browser inner width
  y: number;      // % of browser inner height
  text: string;
  showAt: number; // ms
  hideAt: number;
  side?: "left" | "right";
};

export type ActionStep = {
  text: string;
  showAt: number;
};

export type Section = {
  id: string;
  title: string;
  subtitle: string;
  screenshot: string;
  accentColor: string;
  duration: number;
  cursor: CursorWaypoint[];
  zoom?: ZoomRegion;
  features: string[];
  actions: ActionStep[];
  callouts: Callout[];
};

export const SECTIONS: Section[] = [
  {
    id: "login",
    title: "Login",
    subtitle: "Secure role-based access for every user",
    screenshot: "screenshots/00-login.png",
    accentColor: "#3b82f6",
    duration: 8000,
    features: ["Admin · Manager · Team Leader", "Maintenance · Inventory roles", "Session-based auth", "Arabic / English / Chinese"],
    actions: [
      { text: "Opening OPPO CMMS — enter your credentials to begin", showAt: 400 },
      { text: 'Typing username: "admin" — full system access', showAt: 1800 },
      { text: 'Entering password and clicking Sign In', showAt: 3400 },
      { text: "Login successful — redirecting to the factory dashboard", showAt: 5800 },
    ],
    callouts: [
      { x: 50, y: 35, text: "Username field", showAt: 1600, hideAt: 3200, side: "right" },
      { x: 50, y: 50, text: "Password (hidden)", showAt: 3200, hideAt: 5000, side: "right" },
      { x: 50, y: 65, text: "Sign In → Dashboard", showAt: 4600, hideAt: 7000, side: "right" },
    ],
    cursor: [
      { x: 50, y: 38, delay: 900 },
      { x: 50, y: 38, delay: 1600, click: true },
      { x: 50, y: 52, delay: 2800, click: true },
      { x: 50, y: 67, delay: 4200, click: true },
    ],
    zoom: { x: 0, y: 5, scale: 1.35, startAt: 2000 },
  },
  {
    id: "dashboard",
    title: "Dashboard",
    subtitle: "Real-time factory status at a glance",
    screenshot: "screenshots/01-dashboard.png",
    accentColor: "#6366f1",
    duration: 10000,
    features: ["Live KPI cards", "Active downtime alerts", "PM tasks today", "Low-stock warnings", "Team attendance status"],
    actions: [
      { text: "Factory dashboard — complete overview of all active operations", showAt: 400 },
      { text: "Downtime KPI card: total minutes lost this shift and this week", showAt: 2000 },
      { text: "PM Calendar card: tasks scheduled for today, overdue items highlighted", showAt: 4000 },
      { text: "Inventory card: parts below minimum level need urgent reorder", showAt: 6000 },
      { text: "Navigating to Downtime section via the left sidebar", showAt: 8500 },
    ],
    callouts: [
      { x: 25, y: 32, text: "Downtime this week", showAt: 1500, hideAt: 3800 },
      { x: 50, y: 32, text: "PM tasks due today", showAt: 2500, hideAt: 5500 },
      { x: 74, y: 32, text: "Low-stock parts", showAt: 3800, hideAt: 6500 },
      { x: 8,  y: 42, text: "← Sidebar navigation", showAt: 7500, hideAt: 9500, side: "right" },
    ],
    cursor: [
      { x: 26, y: 32, delay: 1000 },
      { x: 50, y: 32, delay: 2500 },
      { x: 74, y: 32, delay: 4000 },
      { x: 8,  y: 42, delay: 7800, click: true },
    ],
    zoom: { x: 5, y: -3, scale: 1.2, startAt: 3000 },
  },
  {
    id: "downtime",
    title: "Downtime Records",
    subtitle: "Log, track and analyze every machine stoppage",
    screenshot: "screenshots/02-downtime.png",
    accentColor: "#ef4444",
    duration: 9000,
    features: ["Machine + line selection", "Category & sub-reason", "Duration auto-calc", "Status: Open / Closed", "Filter by date & machine"],
    actions: [
      { text: "Downtime Records — every machine stoppage logged with full detail", showAt: 400 },
      { text: 'Clicking "+ Record Downtime" to open the entry form', showAt: 1800 },
      { text: "Table shows: machine, line, category, start time, duration, status", showAt: 3500 },
      { text: "Filtering records by date range or machine name", showAt: 5500 },
      { text: "Clicking a row to view details or update the downtime status", showAt: 7500 },
    ],
    callouts: [
      { x: 78, y: 13, text: "+ Record Downtime", showAt: 1600, hideAt: 3200, side: "left" },
      { x: 55, y: 38, text: "Machine & category", showAt: 3200, hideAt: 5200 },
      { x: 76, y: 38, text: "Status badge", showAt: 4200, hideAt: 6500 },
      { x: 40, y: 14, text: "Search & filter", showAt: 6000, hideAt: 8500, side: "right" },
    ],
    cursor: [
      { x: 78, y: 13, delay: 1000, click: true },
      { x: 50, y: 38, delay: 2800 },
      { x: 76, y: 38, delay: 4500 },
      { x: 40, y: 14, delay: 6500, click: true },
    ],
    zoom: { x: 0, y: -2, scale: 1.25, startAt: 3000 },
  },
  {
    id: "downtime-dialog",
    title: "Record Downtime",
    subtitle: "Structured form: machine → category → reason → time",
    screenshot: "screenshots/17-downtime-dialog.png",
    accentColor: "#ef4444",
    duration: 8000,
    features: ["Machine dropdown", "Category + reason fields", "Start / End timestamps", "Duration auto-calculated", "Notes & attachments"],
    actions: [
      { text: "New Downtime Record — select the machine that stopped", showAt: 400 },
      { text: 'Selecting category: "Mechanical" — then choosing the specific reason', showAt: 1800 },
      { text: "Start time auto-filled — adjust if needed; end time marks when fixed", showAt: 3200 },
      { text: "Duration is calculated automatically from timestamps", showAt: 4800 },
      { text: 'Clicking "Save" — record created and dashboard KPIs update instantly', showAt: 6200 },
    ],
    callouts: [
      { x: 50, y: 30, text: "Select machine", showAt: 1000, hideAt: 2800, side: "right" },
      { x: 50, y: 44, text: "Category → Reason", showAt: 2500, hideAt: 4500, side: "right" },
      { x: 50, y: 57, text: "Start & End time", showAt: 4000, hideAt: 5800, side: "right" },
      { x: 63, y: 72, text: "Save record", showAt: 5800, hideAt: 7500, side: "left" },
    ],
    cursor: [
      { x: 50, y: 32, delay: 900, click: true },
      { x: 50, y: 46, delay: 2200, click: true },
      { x: 50, y: 59, delay: 3800, click: true },
      { x: 63, y: 73, delay: 5700, click: true },
    ],
    zoom: { x: 0, y: 0, scale: 1.5, startAt: 1200 },
  },
  {
    id: "inventory",
    title: "Inventory",
    subtitle: "Spare parts catalog with live stock levels",
    screenshot: "screenshots/03-inventory.png",
    accentColor: "#22c55e",
    duration: 9000,
    features: ["Part number & name", "Current stock qty", "Minimum threshold alert", "Location & unit", "Low-stock warnings"],
    actions: [
      { text: "Inventory — every spare part catalogued with stock levels and thresholds", showAt: 400 },
      { text: "Parts marked in red are below minimum — reorder immediately", showAt: 2000 },
      { text: 'Clicking "+ Add Part" to register a new spare part in the catalog', showAt: 3800 },
      { text: "Part number, name, quantity, unit, and storage location all captured", showAt: 5500 },
      { text: "Search by part number or name — filters apply instantly", showAt: 7200 },
    ],
    callouts: [
      { x: 85, y: 13, text: "+ Add Part", showAt: 1200, hideAt: 3500, side: "left" },
      { x: 38, y: 38, text: "Part number & name", showAt: 2500, hideAt: 4500 },
      { x: 66, y: 38, text: "Stock level", showAt: 3000, hideAt: 5500 },
      { x: 79, y: 38, text: "⚠ Below minimum", showAt: 4000, hideAt: 6500 },
      { x: 35, y: 14, text: "Search parts", showAt: 7000, hideAt: 8500, side: "right" },
    ],
    cursor: [
      { x: 85, y: 13, delay: 900, click: true },
      { x: 38, y: 38, delay: 2500 },
      { x: 80, y: 38, delay: 4500 },
      { x: 35, y: 14, delay: 7000, click: true },
    ],
    zoom: { x: 0, y: 0, scale: 1.25, startAt: 3000 },
  },
  {
    id: "inventory-add",
    title: "Add Inventory Item",
    subtitle: "Register new spare parts in the catalog",
    screenshot: "screenshots/18-inventory-add-dialog.png",
    accentColor: "#22c55e",
    duration: 7500,
    features: ["Part number", "Description / name", "Quantity & unit", "Min stock threshold", "Storage location"],
    actions: [
      { text: "New Spare Part — fill in the part details to add it to inventory", showAt: 400 },
      { text: 'Typing part number: "HYD-PUMP-042" — unique identifier', showAt: 1600 },
      { text: 'Name: "Hydraulic Pump Seal" — description for easy search', showAt: 2800 },
      { text: "Setting quantity: 12 units, minimum threshold: 3 units", showAt: 4000 },
      { text: 'Saving — part appears in inventory, alerts fire if qty drops below 3', showAt: 5800 },
    ],
    callouts: [
      { x: 50, y: 30, text: "Part number (unique)", showAt: 1200, hideAt: 2800, side: "right" },
      { x: 50, y: 43, text: "Name / description", showAt: 2500, hideAt: 4000, side: "right" },
      { x: 50, y: 56, text: "Qty + minimum level", showAt: 3800, hideAt: 5500, side: "right" },
      { x: 63, y: 72, text: "Save to inventory", showAt: 5500, hideAt: 7200, side: "left" },
    ],
    cursor: [
      { x: 50, y: 32, delay: 900, click: true },
      { x: 50, y: 45, delay: 2200, click: true },
      { x: 50, y: 58, delay: 3700, click: true },
      { x: 63, y: 73, delay: 5500, click: true },
    ],
    zoom: { x: 0, y: 0, scale: 1.55, startAt: 1200 },
  },
  {
    id: "orders",
    title: "Spare Part Orders",
    subtitle: "Request → Approve → Fulfill — full order workflow",
    screenshot: "screenshots/04-orders.png",
    accentColor: "#f59e0b",
    duration: 8500,
    features: ["Submit requests", "Manager approval", "Fulfilled tracking", "Linked to inventory", "Order history log"],
    actions: [
      { text: "Spare Part Orders — structured workflow from request to fulfillment", showAt: 400 },
      { text: "Maintenance staff submits a request: part, quantity, reason, urgency", showAt: 2000 },
      { text: "Manager reviews and approves or rejects the request with a note", showAt: 3800 },
      { text: "Once approved, inventory team marks order as fulfilled — stock updates", showAt: 5800 },
      { text: "Full order history visible: who requested, approved, and when", showAt: 7500 },
    ],
    callouts: [
      { x: 40, y: 36, text: "Part + quantity", showAt: 1800, hideAt: 3500 },
      { x: 68, y: 36, text: "Status: Pending", showAt: 2500, hideAt: 4500 },
      { x: 82, y: 36, text: "Approve / Reject", showAt: 3800, hideAt: 6000 },
      { x: 40, y: 52, text: "Fulfilled order", showAt: 6000, hideAt: 8000 },
    ],
    cursor: [
      { x: 40, y: 36, delay: 1200 },
      { x: 68, y: 36, delay: 2800 },
      { x: 82, y: 36, delay: 4500, click: true },
      { x: 40, y: 52, delay: 6500 },
    ],
    zoom: { x: 0, y: 0, scale: 1.25, startAt: 3000 },
  },
  {
    id: "pm",
    title: "PM Calendar",
    subtitle: "Recurring preventive maintenance — auto-scheduled, auto-advancing",
    screenshot: "screenshots/05-pm-calendar.png",
    accentColor: "#8b5cf6",
    duration: 9000,
    features: ["Monthly calendar view", "Auto-recurring occurrences", "Due / Overdue / Done status", "Assign to technician", "Mark Done → auto-advances"],
    actions: [
      { text: "PM Calendar — recurring maintenance schedule for every machine on the floor", showAt: 400 },
      { text: "Occurrences are generated automatically from each plan's frequency — daily, weekly, monthly", showAt: 2000 },
      { text: "Overdue tasks are highlighted red — any occurrence before today not yet marked done", showAt: 3800 },
      { text: "Clicking 'Mark Done' records the completion and auto-advances the plan's next due date", showAt: 5500 },
      { text: "Navigate months to see the full forward schedule — no manual entry required", showAt: 7200 },
    ],
    callouts: [
      { x: 40, y: 42, text: "PM task (due today)", showAt: 1800, hideAt: 3800 },
      { x: 62, y: 52, text: "Overdue — needs action", showAt: 3500, hideAt: 5500 },
      { x: 50, y: 65, text: "Mark Done → next date advances", showAt: 5800, hideAt: 7500 },
    ],
    cursor: [
      { x: 40, y: 42, delay: 1200 },
      { x: 62, y: 52, delay: 3200, click: true },
      { x: 50, y: 67, delay: 5500, click: true },
    ],
    zoom: { x: 0, y: 5, scale: 1.25, startAt: 2500 },
  },
  {
    id: "training",
    title: "Training & Exams",
    subtitle: "Courses, tests and certification tracking",
    screenshot: "screenshots/06-training.png",
    accentColor: "#06b6d4",
    duration: 8500,
    features: ["Training courses", "Online exam system", "Pass / Fail tracking", "Score per question", "Certification history"],
    actions: [
      { text: "Training — assign courses and exams to team members", showAt: 400 },
      { text: "Courses listed with completion status per employee", showAt: 1800 },
      { text: 'Clicking "Start Exam" — employee takes the exam directly in the system', showAt: 3500 },
      { text: "Multiple choice questions — system records score and pass/fail result", showAt: 5200 },
      { text: "Certificates issued for passing employees — tied to KPI scorecard", showAt: 7000 },
    ],
    callouts: [
      { x: 45, y: 35, text: "Course name + status", showAt: 1600, hideAt: 3500 },
      { x: 78, y: 35, text: "Start Exam", showAt: 3200, hideAt: 5000 },
      { x: 60, y: 50, text: "Pass / Fail result", showAt: 5500, hideAt: 7200 },
    ],
    cursor: [
      { x: 45, y: 35, delay: 1200 },
      { x: 78, y: 35, delay: 3000, click: true },
      { x: 60, y: 50, delay: 5500 },
    ],
    zoom: { x: 0, y: 0, scale: 1.25, startAt: 2800 },
  },
  {
    id: "kpi",
    title: "KPI Scorecards",
    subtitle: "Composite score per person: attendance, tasks, exams, repairs",
    screenshot: "screenshots/07-kpi.png",
    accentColor: "#10b981",
    duration: 9500,
    features: ["Per-member scorecard", "Attendance weight", "Task completion weight", "Exam score weight", "Repair & PM weight", "Composite % score"],
    actions: [
      { text: "KPI Scorecards — weighted composite score for every team member", showAt: 400 },
      { text: "Attendance score: check-in rate × configured weight (default 20%)", showAt: 2000 },
      { text: "Task score: completed vs assigned tasks × weight (default 25%)", showAt: 3800 },
      { text: "Exam score: average pass rate across all training exams × weight", showAt: 5500 },
      { text: "Repair & PM weight: work order completion drives the remaining score", showAt: 7200 },
    ],
    callouts: [
      { x: 22, y: 38, text: "Attendance score", showAt: 1800, hideAt: 3500 },
      { x: 46, y: 38, text: "Task score", showAt: 3200, hideAt: 5200 },
      { x: 68, y: 38, text: "Exam score", showAt: 4800, hideAt: 6800 },
      { x: 85, y: 38, text: "Final %", showAt: 6500, hideAt: 9000, side: "left" },
    ],
    cursor: [
      { x: 22, y: 38, delay: 1200 },
      { x: 46, y: 38, delay: 3000 },
      { x: 68, y: 38, delay: 5000 },
      { x: 85, y: 38, delay: 7000 },
    ],
    zoom: { x: 3, y: 5, scale: 1.2, startAt: 3000 },
  },
  {
    id: "attendance",
    title: "Attendance",
    subtitle: "Daily check-in / check-out per team member",
    screenshot: "screenshots/08-attendance.png",
    accentColor: "#f97316",
    duration: 8500,
    features: ["Daily check-in/out", "Late arrival tracking", "Absence marking", "Hours worked calc", "Monthly summary"],
    actions: [
      { text: "Attendance — daily presence tracking for every team member", showAt: 400 },
      { text: "Check-in and check-out times recorded — late arrivals flagged", showAt: 1800 },
      { text: "Manager can manually record attendance or correct an entry", showAt: 3500 },
      { text: "Monthly view: absences, late days, total hours worked per person", showAt: 5500 },
      { text: "Attendance data flows directly into the KPI composite score", showAt: 7200 },
    ],
    callouts: [
      { x: 22, y: 40, text: "Team member", showAt: 1500, hideAt: 3200 },
      { x: 46, y: 40, text: "Check-in time", showAt: 2500, hideAt: 4500 },
      { x: 67, y: 40, text: "Check-out time", showAt: 3800, hideAt: 5800 },
      { x: 82, y: 40, text: "Late / Absent badge", showAt: 5500, hideAt: 8000, side: "left" },
    ],
    cursor: [
      { x: 22, y: 40, delay: 1200 },
      { x: 46, y: 40, delay: 2800 },
      { x: 67, y: 40, delay: 4200, click: true },
      { x: 82, y: 40, delay: 6000 },
    ],
    zoom: { x: 0, y: 0, scale: 1.25, startAt: 3000 },
  },
  {
    id: "machines",
    title: "Machine Registry",
    subtitle: "All factory machines with QR codes and full specs",
    screenshot: "screenshots/09-machines.png",
    accentColor: "#64748b",
    duration: 8500,
    features: ["Machine name & model", "Line & location", "QR code generation", "Maintenance history", "Status: Active / Offline"],
    actions: [
      { text: "Machine Registry — complete record of every machine on the factory floor", showAt: 400 },
      { text: "Each machine has: name, model, serial number, line, and location", showAt: 1800 },
      { text: 'Clicking "QR Code" — generate and print the QR for this machine', showAt: 3500 },
      { text: "Scanning a QR code on the floor opens the machine's full history", showAt: 5200 },
      { text: "Machine status links to downtime and PM calendar automatically", showAt: 7000 },
    ],
    callouts: [
      { x: 32, y: 38, text: "Machine name & model", showAt: 1500, hideAt: 3200 },
      { x: 58, y: 38, text: "Line & location", showAt: 2500, hideAt: 4200 },
      { x: 80, y: 38, text: "QR Code button", showAt: 3500, hideAt: 5500, side: "left" },
      { x: 32, y: 55, text: "Maintenance history", showAt: 6000, hideAt: 8000 },
    ],
    cursor: [
      { x: 32, y: 38, delay: 1200 },
      { x: 80, y: 38, delay: 3200, click: true },
      { x: 32, y: 55, delay: 6000 },
    ],
    zoom: { x: 0, y: 0, scale: 1.25, startAt: 2800 },
  },
  {
    id: "changeover",
    title: "Changeover",
    subtitle: "Production changeovers: list, cylinders, calendar",
    screenshot: "screenshots/10-changeover.png",
    accentColor: "#ec4899",
    duration: 8000,
    features: ["Changeover list", "Cylinder inventory", "Changeover calendar", "Duration logging", "Line assignment"],
    actions: [
      { text: "Changeover — manage production line changeovers across three views", showAt: 400 },
      { text: "List view: all changeovers with machine, line, date, and duration", showAt: 1800 },
      { text: 'Switching to "Cylinders" tab — track pneumatic cylinder usage per changeover', showAt: 3500 },
      { text: 'Calendar view: planned changeovers shown on a monthly calendar', showAt: 5500 },
      { text: "Duration tracked in minutes — feeds into production efficiency KPIs", showAt: 7000 },
    ],
    callouts: [
      { x: 25, y: 18, text: "List view", showAt: 1200, hideAt: 3200 },
      { x: 50, y: 18, text: "Cylinders tab", showAt: 3200, hideAt: 5200 },
      { x: 75, y: 18, text: "Calendar view", showAt: 5000, hideAt: 7200 },
    ],
    cursor: [
      { x: 25, y: 18, delay: 1000, click: true },
      { x: 50, y: 18, delay: 3000, click: true },
      { x: 75, y: 18, delay: 5000, click: true },
    ],
    zoom: { x: 0, y: 5, scale: 1.2, startAt: 2500 },
  },
  {
    id: "defects",
    title: "Defects",
    subtitle: "Quality defect reporting with severity and root cause",
    screenshot: "screenshots/11-defects.png",
    accentColor: "#dc2626",
    duration: 8000,
    features: ["Defect type & code", "Severity: Low/Med/High/Critical", "Root cause analysis", "Line & shift filter", "Defect trend charts"],
    actions: [
      { text: "Defects — log and track every quality defect on the production line", showAt: 400 },
      { text: "Each defect records: type, severity, quantity affected, shift, line", showAt: 1800 },
      { text: "Critical severity defects highlighted red — immediate escalation required", showAt: 3500 },
      { text: "Root cause field captures why the defect occurred for analysis", showAt: 5200 },
      { text: "Filter by severity, line, or date to identify recurring defect patterns", showAt: 7000 },
    ],
    callouts: [
      { x: 40, y: 36, text: "Defect type & code", showAt: 1500, hideAt: 3500 },
      { x: 65, y: 36, text: "Severity badge", showAt: 3000, hideAt: 5000 },
      { x: 80, y: 36, text: "Quantity affected", showAt: 4500, hideAt: 6500, side: "left" },
    ],
    cursor: [
      { x: 40, y: 36, delay: 1200 },
      { x: 65, y: 36, delay: 3000 },
      { x: 80, y: 36, delay: 5000 },
    ],
    zoom: { x: 0, y: 0, scale: 1.25, startAt: 3000 },
  },
  {
    id: "broken-machines",
    title: "Broken Machines",
    subtitle: "Repair requests — submit, assign, track, resolve",
    screenshot: "screenshots/12-broken-machines.png",
    accentColor: "#b45309",
    duration: 8000,
    features: ["Submit repair request", "Manager assignment", "Priority levels", "Technician updates", "Resolution log"],
    actions: [
      { text: "Broken Machines — structured repair request workflow for the team", showAt: 400 },
      { text: 'Any team member can submit a request: machine, problem description, photo', showAt: 1800 },
      { text: "Manager assigns the request to a maintenance technician with priority", showAt: 3500 },
      { text: "Technician updates status: In Progress → Waiting Parts → Resolved", showAt: 5200 },
      { text: "Resolution time tracked — feeds into maintenance KPI scoring", showAt: 7000 },
    ],
    callouts: [
      { x: 78, y: 13, text: "+ New Request", showAt: 1500, hideAt: 3200, side: "left" },
      { x: 45, y: 38, text: "Problem description", showAt: 3200, hideAt: 5000 },
      { x: 73, y: 38, text: "Status: In Progress", showAt: 5000, hideAt: 7200 },
    ],
    cursor: [
      { x: 78, y: 13, delay: 1200, click: true },
      { x: 45, y: 38, delay: 3000 },
      { x: 73, y: 38, delay: 5200 },
    ],
    zoom: { x: 0, y: 0, scale: 1.25, startAt: 3000 },
  },
  {
    id: "users",
    title: "User Management",
    subtitle: "Create, edit and assign roles to every system user",
    screenshot: "screenshots/13-users.png",
    accentColor: "#7c3aed",
    duration: 8500,
    features: ["5 role types", "Admin / Manager / Team Leader", "Maintenance / Inventory", "Password reset", "Team assignment"],
    actions: [
      { text: "User Management — create and manage accounts for all factory staff", showAt: 400 },
      { text: "Five roles available: Admin, Manager, Team Leader, Maintenance, Inventory", showAt: 1800 },
      { text: "Each user belongs to a team — Team Leader sees only their team's data", showAt: 3500 },
      { text: "Admin can reset passwords and change roles at any time", showAt: 5200 },
      { text: 'Clicking "+ Add User" to create a new account with role assignment', showAt: 7000 },
    ],
    callouts: [
      { x: 35, y: 36, text: "Username & name", showAt: 1500, hideAt: 3200 },
      { x: 62, y: 36, text: "Role badge", showAt: 3000, hideAt: 5000 },
      { x: 78, y: 36, text: "Edit / Reset PW", showAt: 5000, hideAt: 7200, side: "left" },
      { x: 82, y: 13, text: "+ Add User", showAt: 7000, hideAt: 8500, side: "left" },
    ],
    cursor: [
      { x: 35, y: 36, delay: 1200 },
      { x: 62, y: 36, delay: 3000 },
      { x: 78, y: 36, delay: 5200, click: true },
      { x: 82, y: 13, delay: 7200, click: true },
    ],
    zoom: { x: 0, y: 0, scale: 1.25, startAt: 3000 },
  },
  {
    id: "factory-settings",
    title: "Factory Settings",
    subtitle: "Customize section names, roles, backup, and system config",
    screenshot: "screenshots/14-factory-settings.png",
    accentColor: "#0891b2",
    duration: 9000,
    features: ["Rename sections & roles", "Section access permissions", "Backup & Restore", "Auto daily backup", "OMTP agent config"],
    actions: [
      { text: "Factory Settings — admin-only configuration for the entire system", showAt: 400 },
      { text: "Rename any section: 'Downtime' → 'Machine Stoppage' — reflects everywhere immediately", showAt: 1800 },
      { text: "Section Access matrix: control which roles can view, create, or edit each module", showAt: 3500 },
      { text: "Backup & Restore: download a full JSON backup or restore from a file at any time", showAt: 5500 },
      { text: "Auto-backup runs every midnight — status card shows date, size, and countdown", showAt: 7200 },
    ],
    callouts: [
      { x: 30, y: 36, text: "Section name field", showAt: 1500, hideAt: 3500 },
      { x: 60, y: 36, text: "Access permission matrix", showAt: 3200, hideAt: 5200 },
      { x: 50, y: 52, text: "Backup / Restore buttons", showAt: 5200, hideAt: 7000 },
      { x: 50, y: 65, text: "Auto-backup status card", showAt: 7000, hideAt: 8800 },
    ],
    cursor: [
      { x: 30, y: 36, delay: 1200 },
      { x: 60, y: 36, delay: 3200, click: true },
      { x: 50, y: 52, delay: 5500, click: true },
      { x: 50, y: 65, delay: 7300 },
    ],
    zoom: { x: 0, y: 0, scale: 1.25, startAt: 3000 },
  },
  {
    id: "backup",
    title: "Backup & Restore",
    subtitle: "Full system backup with automatic daily protection",
    screenshot: "screenshots/14-factory-settings.png",
    accentColor: "#3b82f6",
    duration: 8000,
    features: ["Full JSON export", "One-click restore", "Daily auto-backup", "Stores in database", "30+ tables covered"],
    actions: [
      { text: "Backup & Restore — protect your factory data with full system snapshots", showAt: 400 },
      { text: "Download Backup exports a complete JSON file covering all 30+ data tables", showAt: 1800 },
      { text: "Restore from File — upload any previous backup to roll back the entire system", showAt: 3500 },
      { text: "Auto-backup runs every midnight — stored directly in the database", showAt: 5200 },
      { text: "Status card shows last backup date, file size, and countdown to next backup", showAt: 6800 },
    ],
    callouts: [
      { x: 35, y: 45, text: "Download Backup", showAt: 1500, hideAt: 3200, side: "right" },
      { x: 65, y: 45, text: "Restore from File", showAt: 3200, hideAt: 5000, side: "left" },
      { x: 50, y: 62, text: "Auto-backup status card", showAt: 5200, hideAt: 7500 },
    ],
    cursor: [
      { x: 35, y: 45, delay: 1200, click: true },
      { x: 65, y: 45, delay: 3200, click: true },
      { x: 50, y: 62, delay: 5500 },
    ],
    zoom: { x: 0, y: 5, scale: 1.3, startAt: 2000 },
  },
  {
    id: "help",
    title: "Help & Guide",
    subtitle: "Section-by-section guide with embedded tutorial videos",
    screenshot: "screenshots/15-help.png",
    accentColor: "#3b82f6",
    duration: 8000,
    features: ["Animated tutorials per section", "Feature bullet lists", "Role access guide", "What's New log", "Full system walkthrough"],
    actions: [
      { text: "Help Guide — complete reference for every section of the CMMS", showAt: 400 },
      { text: "Each section card shows description, features, and role access info", showAt: 1800 },
      { text: 'Clicking "Watch" on any section plays the animated tutorial for it', showAt: 3500 },
      { text: "Full system walkthrough video available at the top of the page", showAt: 5500 },
      { text: "What's New section logs all recent updates and feature additions", showAt: 7000 },
    ],
    callouts: [
      { x: 50, y: 40, text: "Section card", showAt: 1500, hideAt: 3200 },
      { x: 82, y: 40, text: "Watch tutorial", showAt: 3200, hideAt: 5500, side: "left" },
      { x: 50, y: 60, text: "Feature bullets", showAt: 5500, hideAt: 7500 },
    ],
    cursor: [
      { x: 50, y: 40, delay: 1200 },
      { x: 82, y: 40, delay: 3200, click: true },
      { x: 50, y: 60, delay: 5800 },
    ],
    zoom: { x: 0, y: 5, scale: 1.2, startAt: 2500 },
  },
];
