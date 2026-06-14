import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  AlertTriangle,
  PackageSearch,
  ShoppingCart,
  CalendarClock,
  GraduationCap,
  FileCheck2,
  Activity,
  Factory,
  CheckSquare,
  ClipboardList,
  Users,
  Palmtree,
  QrCode,
  Smartphone,
  Wrench,
  MonitorDot,
  Cpu,
  BarChart3,
  LineChart,
  ShieldCheck,
  Settings2,
  LogOut,
  Database,
  ArrowRight,
  ArrowLeftRight,
  AlertOctagon,
} from "lucide-react";

// --- Configuration ---
const INTRO_DURATION = 2000;
const SCENE_DURATION = 3500;
const OUTRO_DURATION = 2000;

const COLORS = {
  bg: "#0d1117",
  primary: "#3b82f6",
  secondary: "#10b981",
  danger: "#ef4444",
  text: "#ffffff",
  surface: "#1f2937",
  border: "#374151"
};

// --- Mockup UI Components ---
const MockupCards = () => (
  <div className="grid grid-cols-2 gap-4 w-full h-full p-2">
    {[1, 2, 3, 4].map((i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.2 + i * 0.1, type: "spring" }}
        className="bg-gray-800/80 rounded-xl border border-gray-700 p-4 flex flex-col justify-between"
      >
        <div className="w-8 h-8 rounded-full bg-blue-500/20 mb-2" />
        <div className="h-2 w-1/2 bg-gray-600 rounded mb-1" />
        <div className="h-4 w-3/4 bg-blue-400/50 rounded" />
      </motion.div>
    ))}
  </div>
);

const MockupTable = () => (
  <div className="w-full h-full bg-gray-800/80 rounded-xl border border-gray-700 p-4 flex flex-col">
    <div className="flex justify-between border-b border-gray-700 pb-2 mb-2">
      <div className="h-3 w-1/4 bg-gray-600 rounded" />
      <div className="h-3 w-1/4 bg-gray-600 rounded" />
      <div className="h-3 w-1/4 bg-gray-600 rounded" />
    </div>
    <div className="flex-1 space-y-3 mt-2">
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 + i * 0.15 }}
          className="flex justify-between items-center bg-gray-700/30 p-2 rounded"
        >
          <div className="h-2 w-1/5 bg-gray-400 rounded" />
          <div className="h-2 w-1/3 bg-gray-500 rounded" />
          <div className="h-6 w-12 bg-blue-500/30 rounded-full" />
        </motion.div>
      ))}
    </div>
  </div>
);

const MockupChart = () => (
  <div className="w-full h-full bg-gray-800/80 rounded-xl border border-gray-700 p-4 flex items-end justify-between gap-2">
    {[40, 70, 45, 90, 65, 80].map((h, i) => (
      <motion.div
        key={i}
        initial={{ height: 0 }}
        animate={{ height: `${h}%` }}
        transition={{ delay: 0.2 + i * 0.1, duration: 0.8, ease: "easeOut" }}
        className="w-full bg-blue-500 rounded-t-sm"
      />
    ))}
  </div>
);

const MockupForm = () => (
  <div className="w-full h-full bg-gray-800/80 rounded-xl border border-gray-700 p-4 space-y-4">
    {[1, 2, 3].map((i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 + i * 0.1 }}
      >
        <div className="h-2 w-24 bg-gray-500 rounded mb-2" />
        <div className="h-8 w-full bg-gray-900 border border-gray-600 rounded" />
      </motion.div>
    ))}
  </div>
);

const MockupList = () => (
  <div className="w-full h-full bg-gray-800/80 rounded-xl border border-gray-700 p-4 space-y-3">
    {[1, 2, 3, 4].map((i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 + i * 0.1 }}
        className="flex gap-3 items-center"
      >
        <div className={`w-10 h-10 rounded-lg flex-shrink-0 ${i % 2 === 0 ? 'bg-blue-500/20' : 'bg-green-500/20'}`} />
        <div className="flex-1 space-y-2">
          <div className="h-2 w-3/4 bg-gray-400 rounded" />
          <div className="h-2 w-1/2 bg-gray-600 rounded" />
        </div>
      </motion.div>
    ))}
  </div>
);


// --- Data Definitions ---

const SECTIONS = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    bullets: ["Overview cards & KPIs", "License countdown", "Storage usage & quotas"],
    Mockup: MockupCards
  },
  {
    id: "downtime",
    title: "Downtime Records",
    icon: AlertTriangle,
    bullets: ["Log machine incidents", "Categorize & detail reasons", "Track resolution notes"],
    Mockup: MockupTable
  },
  {
    id: "inventory",
    title: "Inventory",
    icon: PackageSearch,
    bullets: ["Spare parts catalog", "Real-time stock levels", "Low-stock alerts"],
    Mockup: MockupTable
  },
  {
    id: "orders",
    title: "Spare Part Orders",
    icon: ShoppingCart,
    bullets: ["Submit part requests", "Approve & reject workflow", "Fulfill inventory orders"],
    Mockup: MockupList
  },
  {
    id: "pm",
    title: "Preventive Maintenance",
    icon: CalendarClock,
    bullets: ["Schedule maintenance plans", "Set frequency rules", "Track completion status"],
    Mockup: MockupList
  },
  {
    id: "training",
    title: "Training Plans",
    icon: GraduationCap,
    bullets: ["Create training sessions", "Track employee attendance", "Link certification exams"],
    Mockup: MockupCards
  },
  {
    id: "exams",
    title: "Training Exams",
    icon: FileCheck2,
    bullets: ["Create MCQ exams", "Assign to employees", "Auto-score & grade results"],
    Mockup: MockupForm
  },
  {
    id: "production",
    title: "Production Capacity",
    icon: Activity,
    bullets: ["Log hourly production counts", "Compare actual vs target", "Manage daily shift setups"],
    Mockup: MockupChart
  },
  {
    id: "defects",
    title: "Defects",
    icon: AlertOctagon,
    bullets: ["Log defective units per line & shift", "Preset & custom defect reasons", "Filter by line, shift, and date"],
    Mockup: MockupTable
  },
  {
    id: "productionLines",
    title: "Production Lines",
    icon: Factory,
    bullets: ["Add & edit factory lines", "Assign line supervisors", "Set capacity targets"],
    Mockup: MockupTable
  },
  {
    id: "tasks",
    title: "Tasks & Alerts",
    icon: CheckSquare,
    bullets: ["Create operational tasks", "Assign priority levels", "Send instant notifications"],
    Mockup: MockupList
  },
  {
    id: "linePlans",
    title: "Daily Line Plans",
    icon: ClipboardList,
    bullets: ["Plan shifts per line", "Assign models & targets", "Allocate operational teams"],
    Mockup: MockupTable
  },
  {
    id: "changeover",
    title: "Changeover",
    icon: ArrowLeftRight,
    bullets: ["Track model changeover tasks", "List · Cylinders · Calendar views", "Visual liquid-fill progress indicators"],
    Mockup: MockupList
  },
  {
    id: "attendance",
    title: "Attendance",
    icon: Users,
    bullets: ["Mark present, absent, leave", "Filter by shift or team", "Export attendance reports"],
    Mockup: MockupTable
  },
  {
    id: "vacation",
    title: "Vacation Requests",
    icon: Palmtree,
    bullets: ["Submit employee leave", "Manager approval workflow", "Sync with attendance"],
    Mockup: MockupList
  },
  {
    id: "machines",
    title: "Machine Registry",
    icon: QrCode,
    bullets: ["Register all machines", "Generate QR codes", "Assign machines to lines"],
    Mockup: MockupCards
  },
  {
    id: "workPhones",
    title: "Work Phones",
    icon: Smartphone,
    bullets: ["Track assigned devices", "Bulk import via CSV", "Quick QR code lookup"],
    Mockup: MockupTable
  },
  {
    id: "brokenMachines",
    title: "Broken Machines",
    icon: Wrench,
    bullets: ["Report critical breakdowns", "Track repair progress", "Mark issues as resolved"],
    Mockup: MockupList
  },
  {
    id: "machineMonitor",
    title: "Machine Monitor",
    icon: MonitorDot,
    bullets: ["Live testing dashboard", "Line → Station hierarchy", "Auto-downtime triggers"],
    Mockup: MockupCards
  },
  {
    id: "machineAnalysis",
    title: "Machine Analysis",
    icon: Cpu,
    bullets: ["Analyze OEE & MTTR", "Review error heatmaps", "Predictive maintenance insights"],
    Mockup: MockupChart
  },
  {
    id: "kpi",
    title: "KPI Report",
    icon: BarChart3,
    bullets: ["Per-member team scorecard", "Attendance · Tasks · Exams · Repairs · PM scores", "Weighted composite score per person"],
    Mockup: MockupCards
  },
  {
    id: "reports",
    title: "Analytics & Reports",
    icon: LineChart,
    bullets: ["MTTR & MTBF charts", "Identify bottleneck machines", "Analyze downtime trends"],
    Mockup: MockupChart
  },
  {
    id: "users",
    title: "User Management",
    icon: ShieldCheck,
    bullets: ["Approve new accounts", "Assign system roles", "Set factory user limits"],
    Mockup: MockupTable
  },
  {
    id: "auditLogs",
    title: "Audit Logs",
    icon: Database,
    bullets: ["Full activity history", "Filter by user or action", "Monitor factory operations"],
    Mockup: MockupTable
  },
  {
    id: "factorySettings",
    title: "Factory Settings",
    icon: Settings2,
    bullets: ["Rename roles & sections", "Configure permission matrix", "Setup OMTP machine agent"],
    Mockup: MockupForm
  }
];

const SCENES = [
  { id: "intro", type: "intro" },
  ...SECTIONS.map(s => ({ ...s, type: "section" })),
  { id: "outro", type: "outro" }
];

export default function CmmsGuideVideo() {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const advanceScene = () => {
      setCurrentSceneIndex((prev) => {
        const next = (prev + 1) % SCENES.length;
        return next;
      });
    };

    const currentScene = SCENES[currentSceneIndex];
    let duration = SCENE_DURATION;
    if (currentScene.type === "intro") duration = INTRO_DURATION;
    if (currentScene.type === "outro") duration = OUTRO_DURATION;

    timer = setTimeout(advanceScene, duration);

    return () => clearTimeout(timer);
  }, [currentSceneIndex]);

  const scene = SCENES[currentSceneIndex] as any;
  const progress = (currentSceneIndex / (SCENES.length - 1)) * 100;

  // Render Background Elements
  const renderBackground = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Blueprint Grid */}
      <div 
        className="absolute inset-0 opacity-[0.03]" 
        style={{ 
          backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '4vw 4vw'
        }}
      />
      {/* Floating Orbs */}
      <motion.div 
        className="absolute w-[40vw] h-[40vw] rounded-full bg-blue-600/10 blur-[100px]"
        animate={{
          x: ["-10%", "110%", "-10%"],
          y: ["-10%", "50%", "-10%"],
        }}
        transition={{ duration: 20, ease: "linear", repeat: Infinity }}
      />
      <motion.div 
        className="absolute w-[30vw] h-[30vw] rounded-full bg-emerald-600/10 blur-[80px]"
        animate={{
          x: ["110%", "-10%", "110%"],
          y: ["50%", "-10%", "50%"],
        }}
        transition={{ duration: 15, ease: "linear", repeat: Infinity }}
      />
    </div>
  );

  return (
    <div className="relative w-full aspect-video bg-[#0d1117] text-white overflow-hidden font-inter select-none shadow-2xl rounded-xl">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
        .font-chakra { font-family: 'Chakra Petch', sans-serif; }
        .font-inter { font-family: 'Inter', sans-serif; }
      `}</style>

      {renderBackground()}

      {/* Main Content Area */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 lg:p-12">
        <AnimatePresence mode="wait">
          {scene.type === "intro" && (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center space-y-6"
            >
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.5)]"
              >
                <Settings2 className="w-12 h-12 text-white" />
              </motion.div>
              <div className="space-y-2">
                <h1 className="text-5xl lg:text-7xl font-chakra font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
                  OPPO Factory CMMS
                </h1>
                <p className="text-xl lg:text-2xl font-inter text-blue-400 font-medium tracking-wide">
                  Admin Complete Guide
                </p>
              </div>
            </motion.div>
          )}

          {scene.type === "section" && (
            <motion.div 
              key={`section-${scene.id}`}
              className="w-full h-full flex flex-col justify-center max-w-6xl mx-auto"
            >
              {/* Top Bar for Section */}
              <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-20">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 bg-gray-800/50 backdrop-blur-md px-4 py-2 rounded-full border border-gray-700/50"
                >
                  {scene.icon && <scene.icon className="w-5 h-5 text-blue-400" />}
                  <span className="font-chakra font-semibold tracking-wide text-sm">{scene.title}</span>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="font-chakra text-gray-500 font-bold tracking-widest text-sm"
                >
                  {String(currentSceneIndex).padStart(2, '0')} / {SECTIONS.length}
                </motion.div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-12 items-center w-full mt-12">
                {/* Left: Text Content */}
                <div className="md:col-span-2 space-y-8">
                  <motion.h2 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="text-4xl lg:text-5xl font-chakra font-bold leading-tight"
                  >
                    {scene.title}
                  </motion.h2>
                  
                  <div className="space-y-4">
                    {scene.bullets?.map((bullet: string, idx: number) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + idx * 0.15, duration: 0.5 }}
                        className="flex items-start gap-3"
                      >
                        <ArrowRight className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <p className="text-gray-300 text-lg lg:text-xl font-inter">{bullet}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Right: UI Mockup */}
                <div className="md:col-span-3 h-[40vh] md:h-[50vh] relative perspective-[1000px]">
                  <motion.div
                    initial={{ opacity: 0, rotateY: 10, x: 40, scale: 0.9 }}
                    animate={{ opacity: 1, rotateY: -5, x: 0, scale: 1 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                    className="w-full h-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-xl transform-gpu"
                  >
                    {scene.Mockup && <scene.Mockup />}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}

          {scene.type === "outro" && (
            <motion.div 
              key="outro"
              initial={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center justify-center text-center space-y-12 w-full h-full"
            >
              <div className="space-y-4">
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl lg:text-6xl font-chakra font-bold"
                >
                  You're ready to manage your factory.
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-xl text-blue-400 font-inter"
                >
                  Log in at your CMMS URL to get started.
                </motion.p>
              </div>

              {/* Icon grid flying in */}
              <div className="flex flex-wrap justify-center max-w-4xl gap-4">
                {SECTIONS.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0, y: Math.random() * 100 - 50, x: Math.random() * 100 - 50 }}
                      animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                      transition={{ delay: 0.8 + i * 0.02, type: "spring", stiffness: 200, damping: 20 }}
                      className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400"
                    >
                      <Icon className="w-5 h-5" />
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-800 z-30">
        <motion.div 
          className="h-full bg-blue-500"
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: "linear" }}
        />
      </div>
    </div>
  );
}
