import { motion } from "framer-motion";

export function OutroScene() {
  const features = [
    { label: "Downtime", color: "#ef4444" },
    { label: "PM Calendar", color: "#8b5cf6" },
    { label: "Inventory", color: "#22c55e" },
    { label: "Training", color: "#06b6d4" },
    { label: "KPI", color: "#10b981" },
    { label: "Attendance", color: "#f97316" },
    { label: "Machines", color: "#64748b" },
    { label: "Changeover", color: "#ec4899" },
    { label: "Defects", color: "#dc2626" },
    { label: "Orders", color: "#f59e0b" },
    { label: "Users", color: "#7c3aed" },
    { label: "Audit Log", color: "#0891b2" },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.9, ease: "circOut" }}
    >
      <div className="relative z-10 flex flex-col items-center text-center px-8 max-w-3xl">
        <motion.div
          className="mb-6 text-4xl"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 350, damping: 20, delay: 0.2 }}
        >
          ✓
        </motion.div>

        <motion.h2
          className="font-black mb-3"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 6vw, 4rem)",
            letterSpacing: "-0.03em",
            color: "#fff",
          }}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          OPPO CMMS
        </motion.h2>

        <motion.div
          className="h-0.5 rounded-full mb-5 w-32"
          style={{ background: "linear-gradient(90deg, #3b82f6, #8b5cf6)" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.7, delay: 0.6 }}
        />

        <motion.p
          className="text-lg mb-2"
          style={{ color: "#a1a1aa" }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.75 }}
        >
          Full-featured factory management — all in one system
        </motion.p>

        <motion.div
          className="flex flex-wrap gap-2 justify-center mt-8"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.0 }}
        >
          {features.map((f, i) => (
            <motion.span
              key={f.label}
              className="text-xs px-3 py-1.5 rounded-full font-medium"
              style={{
                background: `${f.color}18`,
                border: `1px solid ${f.color}40`,
                color: f.color,
                fontFamily: "var(--font-mono)",
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20, delay: 1.1 + i * 0.04 }}
            >
              {f.label}
            </motion.span>
          ))}
        </motion.div>

        <motion.p
          className="text-sm mt-10"
          style={{ color: "#3f3f46", fontFamily: "var(--font-mono)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.8 }}
        >
          OPPO CMMS — Built for precision manufacturing
        </motion.p>
      </div>
    </motion.div>
  );
}
