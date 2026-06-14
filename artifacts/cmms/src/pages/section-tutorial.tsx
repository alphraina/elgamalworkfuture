import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Play, Pause } from "lucide-react";

// ─── Step type ────────────────────────────────────────────────────────────────
interface TutorialStep {
  label: string;
  desc: string;
  mockup: keyof typeof MOCKUPS;
  annotation?: string;
}

// ─── Mockup components ────────────────────────────────────────────────────────
const Row = ({ cols, accent }: { cols: string[]; accent?: boolean }) => (
  <div className={`flex justify-between items-center px-2 py-1.5 rounded text-[9px] ${accent ? "bg-blue-500/20" : "bg-white/5"} mb-1`}>
    {cols.map((c, i) => (
      <span key={i} className={i === 0 ? "text-white/80 w-24 truncate" : "text-white/40 w-16 text-center truncate"}>{c}</span>
    ))}
  </div>
);

const StatusBadge = ({ label, color }: { label: string; color: string }) => (
  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
);

const TableMockup = () => (
  <div className="w-full h-full flex flex-col gap-1 p-2">
    <div className="flex items-center gap-2 mb-2">
      <div className="h-5 w-20 bg-blue-500/30 rounded text-[9px] text-blue-300 flex items-center justify-center font-medium">+ Add New</div>
      <div className="h-5 flex-1 bg-white/5 rounded border border-white/10" />
      <div className="h-5 w-14 bg-white/5 rounded border border-white/10 text-[9px] text-white/30 flex items-center justify-center">Filter</div>
    </div>
    <div className="flex justify-between px-2 mb-1">
      {["Name", "Status", "Date", "Action"].map(h => (
        <span key={h} className="text-[8px] text-white/30 font-medium w-16 text-center">{h}</span>
      ))}
    </div>
    {[
      ["Machine A - L1", "Open", "Mar 24", "View"],
      ["Machine B - L2", "Resolved", "Mar 23", "View"],
      ["Machine C - L3", "In Progress", "Mar 22", "View"],
    ].map((row, i) => (
      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1 }}
        className="flex justify-between items-center px-2 py-1.5 rounded bg-white/5 hover:bg-white/8 mb-0.5">
        <span className="text-[9px] text-white/70 w-24 truncate">{row[0]}</span>
        <StatusBadge label={row[1]} color={row[1]==="Open"?"bg-red-500/20 text-red-300":row[1]==="Resolved"?"bg-green-500/20 text-green-300":"bg-amber-500/20 text-amber-300"} />
        <span className="text-[9px] text-white/40 w-16 text-center">{row[2]}</span>
        <span className="text-[9px] text-blue-400 w-10 text-center cursor-pointer hover:underline">{row[3]}</span>
      </motion.div>
    ))}
  </div>
);

const FormMockup = () => (
  <div className="w-full h-full flex flex-col gap-2 p-3 bg-white/3 rounded-xl border border-white/10">
    <div className="text-[10px] font-semibold text-white/70 mb-1">New Record</div>
    {[
      ["Machine / Line", "Select..."],
      ["Category / Type", "Select..."],
      ["Description", "Enter details..."],
      ["Date & Time", "2024-03-24  09:00"],
    ].map(([label, placeholder], i) => (
      <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}>
        <div className="text-[8px] text-white/40 mb-0.5">{label}</div>
        <div className="h-6 bg-white/5 border border-white/10 rounded px-2 flex items-center text-[9px] text-white/25">{placeholder}</div>
      </motion.div>
    ))}
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
      className="mt-auto h-6 bg-blue-500/80 rounded flex items-center justify-center text-[9px] font-semibold text-white">
      Save Record
    </motion.div>
  </div>
);

const FilterMockup = () => (
  <div className="w-full h-full flex flex-col gap-1.5 p-2">
    <div className="flex gap-1.5 mb-1">
      {["All Lines", "Mar 2024", "All Status"].map((f, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}
          className={`h-5 px-2 rounded-full text-[8px] flex items-center border ${i===0?"bg-blue-500/20 border-blue-500/40 text-blue-300":"bg-white/5 border-white/10 text-white/40"}`}>
          {f}
        </motion.div>
      ))}
    </div>
    {[
      ["Line 1", "12 records", "green"],
      ["Line 2", "8 records", "amber"],
      ["All Teams", "20 records", "blue"],
    ].map((row, i) => (
      <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.12 }}
        className="flex justify-between items-center px-2 py-1.5 rounded bg-white/5 border border-white/8">
        <span className="text-[9px] text-white/70">{row[0]}</span>
        <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${row[2]==="green"?"bg-green-500/20 text-green-300":row[2]==="amber"?"bg-amber-500/20 text-amber-300":"bg-blue-500/20 text-blue-300"}`}>{row[1]}</span>
      </motion.div>
    ))}
  </div>
);

const CardsMockup = () => (
  <div className="w-full h-full grid grid-cols-2 gap-2 p-2">
    {[
      { label: "Total", val: "247", color: "text-blue-400", bg: "bg-blue-500/10" },
      { label: "Open", val: "12", color: "text-red-400", bg: "bg-red-500/10" },
      { label: "Resolved", val: "201", color: "text-green-400", bg: "bg-green-500/10" },
      { label: "Rate", val: "98.5%", color: "text-amber-400", bg: "bg-amber-500/10" },
    ].map((c, i) => (
      <motion.div key={i} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.1, type: "spring" }}
        className={`${c.bg} rounded-lg border border-white/10 p-3 flex flex-col justify-between`}>
        <div className="text-[8px] text-white/40">{c.label}</div>
        <div className={`text-lg font-bold ${c.color}`}>{c.val}</div>
      </motion.div>
    ))}
  </div>
);

const ChartMockup = () => (
  <div className="w-full h-full p-2 flex flex-col">
    <div className="text-[8px] text-white/30 mb-2">Last 30 days</div>
    <div className="flex-1 flex items-end gap-1 px-1">
      {[30, 55, 40, 70, 45, 85, 60, 90, 50, 75, 65, 80].map((h, i) => (
        <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }}
          transition={{ delay: 0.05 + i * 0.06, duration: 0.6, ease: "easeOut" }}
          className="flex-1 rounded-t-sm"
          style={{ background: `hsl(${210 + i * 5}, 80%, ${40 + h * 0.2}%)` }} />
      ))}
    </div>
    <div className="flex justify-between mt-1">
      {["Mar 1","Mar 8","Mar 15","Mar 22"].map(d => (
        <span key={d} className="text-[7px] text-white/20">{d}</span>
      ))}
    </div>
  </div>
);

const MonitorMockup = () => (
  <div className="w-full h-full p-2 space-y-1.5">
    <div className="text-[8px] text-white/30 font-medium mb-2">Line 1 → Station A</div>
    {[
      { name: "Machine 192.168.1.10", pass: 142, fail: 3, rate: "97.9%", color: "text-green-400" },
      { name: "Machine 192.168.1.11", pass: 98, fail: 12, rate: "89.1%", color: "text-amber-400" },
      { name: "Machine 192.168.1.12", pass: 205, fail: 1, rate: "99.5%", color: "text-green-400" },
    ].map((m, i) => (
      <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.12 }}
        className="flex items-center justify-between bg-white/5 rounded px-2 py-1.5 border border-white/8">
        <span className="text-[8px] text-white/60 w-28 truncate">{m.name}</span>
        <span className="text-[8px] text-green-400">✓ {m.pass}</span>
        <span className="text-[8px] text-red-400">✗ {m.fail}</span>
        <span className={`text-[8px] font-bold ${m.color}`}>{m.rate}</span>
      </motion.div>
    ))}
  </div>
);

const CalendarMockup = () => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const hasEvent = [3, 8, 12, 15, 19, 22, 24, 28];
  return (
    <div className="w-full h-full p-2">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[8px] text-white/50">March 2024</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 bg-white/5 rounded flex items-center justify-center text-[8px] text-white/40">‹</div>
          <div className="w-4 h-4 bg-white/5 rounded flex items-center justify-center text-[8px] text-white/40">›</div>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} className="text-[7px] text-white/25 text-center">{d}</div>
        ))}
        {days.slice(0, 28).map(d => (
          <motion.div key={d} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.01 * d }}
            className={`text-[7px] text-center py-0.5 rounded cursor-pointer ${hasEvent.includes(d) ? "bg-blue-500/30 text-blue-300 font-bold" : d === 24 ? "bg-blue-500 text-white font-bold" : "text-white/40 hover:bg-white/5"}`}>
            {d}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const ScorecardMockup = () => (
  <div className="w-full h-full p-2 space-y-1.5">
    <div className="text-[8px] text-white/30 mb-2">Team KPI — March 2024</div>
    {[
      { name: "Ahmed K.", role: "Maintenance", score: 94, color: "text-green-400 bg-green-500/20" },
      { name: "Sara M.", role: "Team Leader", score: 87, color: "text-amber-400 bg-amber-500/20" },
      { name: "Omar T.", role: "Inventory", score: 72, color: "text-amber-400 bg-amber-500/20" },
      { name: "Nour A.", role: "Maintenance", score: 61, color: "text-red-400 bg-red-500/20" },
    ].map((m, i) => (
      <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.1 }}
        className="flex items-center justify-between bg-white/5 rounded px-2 py-1.5">
        <div>
          <div className="text-[9px] text-white/70">{m.name}</div>
          <div className="text-[7px] text-white/30">{m.role}</div>
        </div>
        <div className={`text-[9px] font-bold px-2 py-0.5 rounded border ${m.color} border-current/30`}>{m.score}%</div>
      </motion.div>
    ))}
  </div>
);

const QRMockup = () => (
  <div className="w-full h-full flex items-center justify-center gap-6 p-2">
    <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, type: "spring" }}
      className="flex flex-col items-center gap-2">
      <div className="w-20 h-20 bg-white rounded-lg p-1">
        <div className="w-full h-full grid grid-cols-5 gap-0.5">
          {Array.from({ length: 25 }, (_, i) => (
            <div key={i} className={`rounded-sm ${[0,1,2,5,10,12,14,19,22,23,24,6,8,16,18].includes(i)?"bg-gray-900":"bg-white"}`} />
          ))}
        </div>
      </div>
      <div className="text-[8px] text-white/50 text-center">Machine A<br/>Scan to lookup</div>
    </motion.div>
    <div className="space-y-1.5">
      {[["Code", "MCH-001"], ["Model", "A300X"], ["Line", "Line 1"], ["Status", "Active"]].map(([k, v], i) => (
        <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
          className="flex gap-2 text-[8px]">
          <span className="text-white/30 w-12">{k}</span>
          <span className="text-white/70 font-medium">{v}</span>
        </motion.div>
      ))}
    </div>
  </div>
);

const CylindersMockup = () => (
  <div className="w-full h-full flex items-end justify-around p-2 pb-4">
    {[
      { label: "L1 CO", pct: 85, color: "#22c55e" },
      { label: "L2 CO", pct: 42, color: "#f59e0b" },
      { label: "L3 CO", pct: 15, color: "#ef4444" },
      { label: "L4 CO", pct: 100, color: "#22c55e" },
    ].map((c, i) => (
      <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 + i * 0.1 }}
        className="flex flex-col items-center gap-1">
        <div className="text-[8px] font-bold" style={{ color: c.color }}>{c.pct}%</div>
        <div className="relative w-8 h-20 rounded-lg overflow-hidden border border-white/10 bg-white/5">
          <motion.div initial={{ height: 0 }} animate={{ height: `${c.pct}%` }} transition={{ delay: 0.3 + i * 0.1, duration: 0.8, ease: "easeOut" }}
            className="absolute bottom-0 w-full rounded-b-lg"
            style={{ background: c.color, opacity: 0.7 }} />
        </div>
        <div className="text-[7px] text-white/30 text-center">{c.label}</div>
      </motion.div>
    ))}
  </div>
);

const WeightsMockup = () => (
  <div className="w-full h-full p-2 space-y-2">
    <div className="text-[8px] text-white/40 mb-1">KPI Weight Configuration</div>
    {[
      { label: "Attendance", val: 30, color: "bg-blue-500" },
      { label: "Tasks", val: 25, color: "bg-green-500" },
      { label: "Exams", val: 20, color: "bg-purple-500" },
      { label: "Repairs", val: 15, color: "bg-amber-500" },
      { label: "PM", val: 10, color: "bg-cyan-500" },
    ].map((w, i) => (
      <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 + i * 0.08 }}>
        <div className="flex justify-between text-[7px] text-white/40 mb-0.5">
          <span>{w.label}</span><span>{w.val}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${w.val * 2}%` }} transition={{ delay: 0.2 + i * 0.08, duration: 0.6 }}
            className={`h-full rounded-full ${w.color}`} />
        </div>
      </motion.div>
    ))}
  </div>
);

const PermissionMockup = () => (
  <div className="w-full h-full p-2">
    <div className="text-[8px] text-white/40 mb-2">Section Access Matrix</div>
    <div className="grid" style={{ gridTemplateColumns: "5rem repeat(4, 1fr)" }}>
      {["", "Admin", "Mgr", "TL", "Maint"].map((h, i) => (
        <div key={i} className="text-[7px] text-white/30 text-center py-0.5 font-medium">{h}</div>
      ))}
      {["Downtime", "Inventory", "PM", "Exams", "KPI"].map((section, ri) => (
        <React.Fragment key={section}>
          <div className="text-[7px] text-white/50 py-1 pr-1 truncate">{section}</div>
          {[true, true, ri < 3, ri < 4].map((allowed, ci) => (
            <motion.div key={ci} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.05 * (ri * 4 + ci) }}
              className="flex items-center justify-center py-1">
              <div className={`w-3 h-3 rounded-sm ${allowed ? "bg-green-500/60" : "bg-white/10"} flex items-center justify-center text-[6px]`}>
                {allowed ? "✓" : ""}
              </div>
            </motion.div>
          ))}
        </React.Fragment>
      ))}
    </div>
  </div>
);

const MOCKUPS = {
  table: TableMockup,
  form: FormMockup,
  filter: FilterMockup,
  cards: CardsMockup,
  chart: ChartMockup,
  monitor: MonitorMockup,
  calendar: CalendarMockup,
  scorecard: ScorecardMockup,
  qr: QRMockup,
  cylinders: CylindersMockup,
  weights: WeightsMockup,
  permissions: PermissionMockup,
};

// ─── Tutorial data (4 steps per section) ─────────────────────────────────────
const SECTION_TUTORIALS: Record<string, TutorialStep[]> = {
  dashboard: [
    { label: "Overview", desc: "Your home screen loads automatically after login. It shows live metrics across all factory modules.", mockup: "cards" },
    { label: "KPI Cards", desc: "Cards show open downtime incidents, pending PM tasks, active production entries, and today's attendance count.", mockup: "cards" },
    { label: "License & Storage", desc: "The license countdown warns you before expiry. The storage bar shows how much of your data quota is used.", mockup: "cards" },
    { label: "Role-Aware", desc: "Each role sees only the metrics relevant to their job. Admins see everything; maintenance sees downtime and PM.", mockup: "cards" },
  ],
  downtime: [
    { label: "View Records", desc: "Open Downtime from the sidebar. You'll see all logged incidents with machine name, category, status, and duration.", mockup: "table" },
    { label: "Log a Downtime", desc: "Click '+ Add New'. Fill in the machine, category (electrical/mechanical/etc.), reason, and start time. Save the record.", mockup: "form" },
    { label: "Filter Records", desc: "Use the filter dropdowns to narrow by machine, production line, category, or date range to find specific incidents.", mockup: "filter" },
    { label: "Resolve an Incident", desc: "Click 'View' on an open record, enter the resolution notes and end time, then mark it as Resolved.", mockup: "table" },
  ],
  inventory: [
    { label: "Parts Catalog", desc: "Open Inventory to see your full spare parts list with part number, name, unit, current stock, and minimum stock.", mockup: "table" },
    { label: "Add a Part", desc: "Click '+ Add New'. Enter the part number, name, unit (pcs/kg/m), current quantity, and minimum stock threshold.", mockup: "form" },
    { label: "Low-Stock Alert", desc: "Parts with stock below the minimum are highlighted in red. Check this daily to reorder before you run out.", mockup: "filter" },
    { label: "Edit or Delete", desc: "Click any part row to edit its details. Admins can delete parts — this removes the entry but keeps order history.", mockup: "table" },
  ],
  orders: [
    { label: "Order List", desc: "Open Spare Part Orders to see all requests. Each order shows the part, quantity, requester, and current status.", mockup: "table" },
    { label: "Submit a Request", desc: "Maintenance: click '+ New Order', select the part from the catalog, enter the quantity needed, and submit.", mockup: "form" },
    { label: "Approve or Reject", desc: "Inventory role: click 'Approve' to confirm the order or 'Reject' with a reason. Approved orders move to Fulfilled.", mockup: "filter" },
    { label: "Mark as Fulfilled", desc: "After parts are issued, the inventory team marks the order Fulfilled. The stock count updates automatically.", mockup: "table" },
  ],
  pm: [
    { label: "PM Plans List", desc: "Open Preventive Maintenance to see all scheduled plans with machine, frequency, assignee, and next due date.", mockup: "table" },
    { label: "Create a PM Plan", desc: "Click '+ New Plan'. Choose the machine, frequency (daily/weekly/monthly), assigned shift, and team. Save it.", mockup: "form" },
    { label: "Mark Completed", desc: "When maintenance runs the plan, click 'Mark Complete'. Overdue plans are highlighted — address those first.", mockup: "filter" },
    { label: "Filter & Email", desc: "Filter by machine or team to see specific plans. Toggle email notifications per plan to alert the assigned tech.", mockup: "table" },
  ],
  training: [
    { label: "Training List", desc: "Open Training Plans to see all sessions with title, trainer, participant count, date, and completion status.", mockup: "table" },
    { label: "Create a Session", desc: "Click '+ New Training'. Add title, trainer name, select participants, set the date and team. Save to notify participants.", mockup: "form" },
    { label: "Track Completion", desc: "After the session, mark it complete and record attendance. Unattended sessions remain open for rescheduling.", mockup: "filter" },
    { label: "Link Exams", desc: "Click a training session and attach a related exam. Participants can take the exam from the Exams module.", mockup: "table" },
  ],
  exams: [
    { label: "Exam List", desc: "Open Training Exams to see all created exams, how many employees have taken each, and the average score.", mockup: "table" },
    { label: "Create an Exam", desc: "Click '+ New Exam'. Add the title, questions with 4 options each, mark the correct answer, and set a passing score threshold.", mockup: "form" },
    { label: "Assign to Employees", desc: "Select the exam and assign it to employees or a team. They'll see a notification and can take it from their account.", mockup: "filter" },
    { label: "View Results", desc: "Click any exam to see each employee's score. The system auto-grades. Admins can view and export all results.", mockup: "scorecard" },
  ],
  production: [
    { label: "Daily Log", desc: "Open Production Capacity. You'll see today's production records per line with actual count, target, and efficiency.", mockup: "table" },
    { label: "Log Hourly Output", desc: "Click '+ Log Production'. Select the line and shift, then enter the actual output count. Compare it to the target.", mockup: "form" },
    { label: "Efficiency View", desc: "Each entry shows the efficiency percentage (actual ÷ target). Red means below target; green is on or above target.", mockup: "chart" },
    { label: "Shift Setup", desc: "Use 'Shift Setup' to set today's model number per line. The machine agent uses this to locate the correct log file folder.", mockup: "filter" },
  ],
  defects: [
    { label: "Defects Log", desc: "Open Defects to see all logged quality defect entries per line, shift, and date with reasons and quantities.", mockup: "table" },
    { label: "Log a Defect", desc: "Click '+ Add Defect'. Choose the production line, shift, date, enter the defective quantity, and select or type a reason.", mockup: "form" },
    { label: "Defect Reasons", desc: "Pick from common reasons (surface defect, assembly error, electrical failure, etc.) or type a custom reason.", mockup: "filter" },
    { label: "Filter & Review", desc: "Filter defects by production line, shift, and date range. Use this data in daily quality review meetings.", mockup: "table" },
  ],
  productionLines: [
    { label: "Lines List", desc: "Open Production Lines to see all configured factory lines with name, team, target capacity, and supervisor.", mockup: "table" },
    { label: "Add a New Line", desc: "Click '+ Add Line'. Enter the line name, department/team, hourly target capacity, minimum capacity, and supervisor.", mockup: "form" },
    { label: "Toggle Active", desc: "Use the Active toggle to hide a line from production entry without deleting its historical records.", mockup: "filter" },
    { label: "Delete a Line", desc: "Click Delete on any line. A confirmation step prevents accidents. Historical records are preserved with a null line reference.", mockup: "table" },
  ],
  tasks: [
    { label: "Task Board", desc: "Open Tasks & Alerts to see all assigned tasks with title, assignee, priority (low/medium/high/critical), and status.", mockup: "table" },
    { label: "Create a Task", desc: "Click '+ New Task'. Fill in title, description, assign to a user, set priority and due date. Save to notify the assignee.", mockup: "form" },
    { label: "Update Status", desc: "The assigned user updates task status: Open → In Progress → Done. Add a completion note when closing the task.", mockup: "filter" },
    { label: "Notifications", desc: "Task creation and status changes send bell notifications to the assignee. They appear in the notification panel at the top right.", mockup: "cards" },
  ],
  linePlans: [
    { label: "Daily Plans", desc: "Open Daily Line Plans to see all production plans for today. Each card shows the line, shift, model, target, and team.", mockup: "table" },
    { label: "Create a Plan", desc: "Click '+ New Plan'. Choose the production line, shift (morning/afternoon/night), model number, planned quantity, and team.", mockup: "form" },
    { label: "Today's Overview", desc: "The top section shows a quick summary of all lines planned for today — check it each morning to confirm coverage.", mockup: "cards" },
    { label: "Edit Plans", desc: "Click any plan to edit the target, model, or team. Plans can be updated during the shift if the model changes.", mockup: "table" },
  ],
  changeover: [
    { label: "Changeover List", desc: "Open Changeover to see all changeover tasks as a table with title, line, date, progress, duration, and status.", mockup: "table" },
    { label: "Create a Task", desc: "Click '+ Add'. Enter the changeover title, assign to a production line, set the target date and planned duration in minutes.", mockup: "form" },
    { label: "Cylinders View", desc: "Switch to the Cylinders view to see visual liquid-fill tanks for each task. Red = low progress, Amber = mid, Green = complete.", mockup: "cylinders" },
    { label: "Calendar View", desc: "Switch to Calendar to see which days have changeover activity. Click any highlighted day to view its tasks.", mockup: "calendar" },
  ],
  attendance: [
    { label: "Attendance Sheet", desc: "Open Attendance to see today's employee list with their current status: Present, Absent, Late, Leave, or Half Day.", mockup: "table" },
    { label: "Mark Attendance", desc: "Click the status button next to each employee's name to set their attendance. Changes save instantly.", mockup: "form" },
    { label: "Filter by Team/Date", desc: "Use the date picker and team filter to view any past day's attendance or compare across departments.", mockup: "filter" },
    { label: "Export Report", desc: "Click Export to download attendance data for the selected period — useful for payroll or HR reporting.", mockup: "table" },
  ],
  vacation: [
    { label: "Requests List", desc: "Open Vacation Requests to see all submitted leave requests with employee name, dates, reason, and status.", mockup: "table" },
    { label: "Submit a Request", desc: "Click '+ Request'. Enter your leave start date, end date, and reason. Submit — your manager is notified immediately.", mockup: "form" },
    { label: "Approve or Reject", desc: "Managers and admins: click Approve or Reject on any pending request. Add a comment when rejecting.", mockup: "filter" },
    { label: "Sync with Attendance", desc: "Approved vacation days appear as Leave in the Attendance module automatically — no manual entry needed.", mockup: "table" },
  ],
  machines: [
    { label: "Machine Registry", desc: "Open Machine Registry to see all registered factory machines with code, name, model, location, and assigned line.", mockup: "table" },
    { label: "Register a Machine", desc: "Click '+ Add Machine'. Fill in the name, machine code, model number, physical location, and assign it to a line/team.", mockup: "form" },
    { label: "QR Code", desc: "Each machine auto-generates a QR code. Click 'QR' on any machine to view and print it. Post it on the machine.", mockup: "qr" },
    { label: "Scan to Lookup", desc: "Use any phone camera to scan a machine's QR code — it opens the machine's record in the CMMS instantly.", mockup: "qr" },
  ],
  workPhones: [
    { label: "Phone Registry", desc: "Open Work Phones to see all assigned phones with employee name, work ID, phone number, color, and PCBA number.", mockup: "table" },
    { label: "Add a Phone", desc: "Click '+ Add'. Enter the employee's work ID, name, phone color, phone number, and PCBA number. Save to register it.", mockup: "form" },
    { label: "Bulk Import via CSV", desc: "Click 'Import CSV' to upload a spreadsheet of phone records all at once. Useful for initial setup or bulk updates.", mockup: "filter" },
    { label: "QR Scan Lookup", desc: "Each phone record generates a QR. Scan it to instantly pull up the phone's full record and assigned employee info.", mockup: "qr" },
  ],
  brokenMachines: [
    { label: "Incident List", desc: "Open Broken Machines to see all reported incidents with machine name, description, reporter, date, and current status.", mockup: "table" },
    { label: "Report a Breakdown", desc: "Click '+ Report'. Select the machine from the registry, describe the issue, and submit. The supervisor is notified.", mockup: "form" },
    { label: "Track Repair", desc: "As repair progresses, update the status: Reported → In Progress → Resolved → Closed. Add notes at each step.", mockup: "filter" },
    { label: "Mark Resolved", desc: "When the machine is fixed, mark it Resolved and enter resolution notes including what was done and parts used.", mockup: "table" },
  ],
  machineMonitor: [
    { label: "Live Dashboard", desc: "Open Machine Monitor to see a real-time grid of all machines organized by Line → Station hierarchy.", mockup: "monitor" },
    { label: "Machine Cards", desc: "Each card shows: total devices tested, pass count, fail count, most recent errors, and last-seen timestamp.", mockup: "cards" },
    { label: "Auto-Downtime", desc: "When the same error repeats more than the configured threshold (default 3×), a downtime record is created automatically.", mockup: "monitor" },
    { label: "Reset & Midnight", desc: "Admins can click 'Reset Data' to clear all readings. Data also resets automatically at midnight for a fresh daily view.", mockup: "table" },
  ],
  machineAnalysis: [
    { label: "Open Analysis", desc: "In Machine Monitor, click any machine card to open its detailed analysis modal — a full analytics dashboard.", mockup: "cards" },
    { label: "KPI Cards & Charts", desc: "Six KPI cards (Total, Pass, Fail, Rate, Cycle Time, Availability) plus 3 donut charts for pass/fail, errors, and shifts.", mockup: "chart" },
    { label: "Error Analysis", desc: "Bar chart ranks top error codes by frequency. The table below shows each error's count, %, first seen, and last seen.", mockup: "chart" },
    { label: "OEE & Heatmap", desc: "OEE panel shows Availability × Performance × Quality. Failure heatmap shows time-of-day × day-of-week failure patterns.", mockup: "chart" },
  ],
  kpi: [
    { label: "Team Scorecard", desc: "Open KPI Report to see each employee's monthly performance scorecard with a composite score from 0–100%.", mockup: "scorecard" },
    { label: "Score Breakdown", desc: "Click any member's row to open their detail modal: sub-scores for attendance, tasks, exams, repairs, PM, and line plans.", mockup: "scorecard" },
    { label: "Configure Weights", desc: "Admins: click the settings icon to adjust KPI weights (e.g. attendance = 30%, tasks = 25%). Changes apply to all calculations.", mockup: "weights" },
    { label: "Filter & Export", desc: "Use the month picker and team filter to compare performance across time periods. Print or export for management review.", mockup: "scorecard" },
  ],
  reports: [
    { label: "Period Selector", desc: "Open Analytics & Reports and choose a period: last 7, 30, 90, 180, or 365 days. All charts update accordingly.", mockup: "chart" },
    { label: "Downtime Trends", desc: "The area chart shows daily downtime hours over the period. The pie chart breaks it down by category (electrical, mechanical, etc.).", mockup: "chart" },
    { label: "Bottleneck Analysis", desc: "The bottleneck table ranks machines by cumulative downtime. Use this to prioritize maintenance investment decisions.", mockup: "table" },
    { label: "OEE & MTTR/MTBF", desc: "OEE gauges show availability per line. MTTR/MTBF bar charts identify which machines take longest to fix or fail most often.", mockup: "chart" },
  ],
  users: [
    { label: "User List", desc: "Open User Management to see all accounts: name, work ID, role, department, status (active/pending/deactivated).", mockup: "table" },
    { label: "Approve New Users", desc: "Self-registered users appear as Pending. Click 'Approve' to activate them or 'Reject' to decline with a reason.", mockup: "filter" },
    { label: "Assign Roles", desc: "Click a user to edit their role (admin/manager/team leader/maintenance/inventory). Role changes take effect on next login.", mockup: "form" },
    { label: "Reset Password", desc: "Click 'Reset Password' on any user to generate a temporary password. The user must change it on first login.", mockup: "table" },
  ],
  auditLogs: [
    { label: "Activity History", desc: "Open Audit Logs to see a full timestamped record of every action taken in your factory's workspace.", mockup: "table" },
    { label: "What's Tracked", desc: "Every create, update, delete, login, and logout is recorded with the user's name, role, affected record, and timestamp.", mockup: "table" },
    { label: "Filter Logs", desc: "Filter by action type (Create/Update/Delete/Login), entity (Machine/User/Task), user, or date range to find specific events.", mockup: "filter" },
    { label: "Delete Entries", desc: "Admins can delete individual log entries or clear all logs. This action itself is also logged for accountability.", mockup: "table" },
  ],
  "factory-settings": [
    { label: "Role & Section Names", desc: "Open Factory Settings. Under the Names tab, rename any role or section to match your factory's terminology.", mockup: "form" },
    { label: "Permission Matrix", desc: "Under Section Access, toggle which roles can see each module and whether they can create, edit, or delete records.", mockup: "permissions" },
    { label: "OMTP Agent Setup", desc: "Open the OMTP tab. Copy your API key and download the cmms_Start.bat launcher to deploy on factory PCs.", mockup: "form" },
    { label: "Column Mapping", desc: "Map your Excel log file's column headers to the expected fields (Pass, Fail, Error Code, Serial, etc.) for each line.", mockup: "form" },
  ],
};

// ─── Main SectionTutorial component ──────────────────────────────────────────
interface Props {
  sectionKey: string;
  onClose: () => void;
}

export function SectionTutorial({ sectionKey, onClose }: Props) {
  const steps = SECTION_TUTORIALS[sectionKey] ?? [];
  const [stepIndex, setStepIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setStepIndex(i => (i + 1) % steps.length), [steps.length]);
  const prev = useCallback(() => setStepIndex(i => (i - 1 + steps.length) % steps.length), [steps.length]);

  useEffect(() => {
    setStepIndex(0);
    setPaused(false);
  }, [sectionKey]);

  useEffect(() => {
    if (paused || steps.length === 0) return;
    const t = setTimeout(next, 3800);
    return () => clearTimeout(t);
  }, [stepIndex, paused, next, steps.length]);

  if (steps.length === 0) return null;

  const step = steps[stepIndex];
  const MockupComp = MOCKUPS[step.mockup];

  return (
    <div className="mt-0 border-t border-white/5">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&display=swap');
        .tut-chakra { font-family: 'Chakra Petch', sans-serif; }
      `}</style>
      <div className="bg-[#0d1117] rounded-b-xl overflow-hidden" style={{ height: 260 }}>
        <div className="relative w-full h-full flex">

          {/* Left — Step info (40%) */}
          <div className="w-2/5 flex flex-col justify-between p-4 border-r border-white/5">
            {/* Step pills */}
            <div className="flex flex-wrap gap-1 mb-2">
              {steps.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setStepIndex(i); setPaused(true); }}
                  className={`h-5 px-2 rounded-full text-[8px] font-medium transition-all border ${i === stepIndex
                    ? "bg-blue-500/30 border-blue-500/50 text-blue-300"
                    : "bg-white/5 border-white/10 text-white/30 hover:text-white/50"
                  }`}
                >
                  Step {i + 1}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={stepIndex} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }} className="flex-1 flex flex-col justify-center">
                <div className="tut-chakra text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">
                  {String(stepIndex + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
                </div>
                <h3 className="tut-chakra text-sm font-bold text-white mb-2 leading-tight">{step.label}</h3>
                <p className="text-[10px] text-white/55 leading-relaxed">{step.desc}</p>
              </motion.div>
            </AnimatePresence>

            {/* Controls */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-1">
                <button onClick={prev} className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5 text-white/50" />
                </button>
                <button onClick={next} className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                  <ChevronRight className="w-3.5 h-3.5 text-white/50" />
                </button>
                <button onClick={() => setPaused(p => !p)}
                  className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                  {paused
                    ? <Play className="w-3 h-3 text-blue-400" />
                    : <Pause className="w-3 h-3 text-white/50" />
                  }
                </button>
              </div>
              <button onClick={onClose} className="flex items-center gap-1 text-[9px] text-white/30 hover:text-white/60 transition-colors">
                <X className="w-3 h-3" /> Close
              </button>
            </div>
          </div>

          {/* Right — Mockup (60%) */}
          <div className="w-3/5 relative overflow-hidden bg-[#0a0e16]">
            {/* Blueprint grid */}
            <div className="absolute inset-0 opacity-[0.025]"
              style={{ backgroundImage: "linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)", backgroundSize: "20px 20px" }} />

            {/* Progress bar */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5">
              {!paused && (
                <motion.div key={`${stepIndex}-bar`} className="h-full bg-blue-500/60"
                  initial={{ width: "0%" }} animate={{ width: "100%" }}
                  transition={{ duration: 3.8, ease: "linear" }} />
              )}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={`mockup-${stepIndex}`}
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 p-3 flex items-center justify-center"
              >
                <div className="w-full h-full">
                  <MockupComp />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
