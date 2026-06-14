import { motion } from "framer-motion";
import { charVariants, charContainerVariants } from "@/lib/video";

function AnimChars({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <motion.span
      variants={charContainerVariants}
      initial="hidden"
      animate="visible"
      style={{ display: "inline-block" }}
      transition={{ delayChildren: delay }}
    >
      {text.split("").map((ch, i) => (
        <motion.span key={i} variants={charVariants} style={{ display: "inline-block" }}>
          {ch === " " ? "\u00a0" : ch}
        </motion.span>
      ))}
    </motion.span>
  );
}

export function IntroScene() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ scale: 1.08, opacity: 0, filter: "blur(20px)" }}
      transition={{ duration: 0.8, ease: "circOut" }}
    >
      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center text-center px-8">

        {/* OPPO badge */}
        <motion.div
          className="mb-6 flex items-center gap-2 rounded-full px-5 py-2"
          style={{
            background: "rgba(59,130,246,0.12)",
            border: "1px solid rgba(59,130,246,0.35)",
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.2 }}
        >
          <motion.div
            className="w-2 h-2 rounded-full bg-blue-400"
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <span
            className="text-xs font-semibold tracking-[0.2em] uppercase text-blue-400"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            OPPO Factory Management
          </span>
        </motion.div>

        {/* Main title */}
        <h1
          className="font-black leading-none mb-4"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(3rem, 9vw, 6.5rem)",
            letterSpacing: "-0.04em",
            color: "#fff",
          }}
        >
          <AnimChars text="CMMS" delay={0.4} />
        </h1>

        <motion.div
          className="h-1 rounded-full mb-6"
          style={{ background: "linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)", width: "40%" }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />

        <motion.p
          className="text-xl mb-3 font-light"
          style={{ color: "#a1a1aa", fontFamily: "var(--font-body)" }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.1 }}
        >
          Computerized Maintenance Management System
        </motion.p>

        <motion.p
          className="text-base"
          style={{ color: "#52525b", fontFamily: "var(--font-body)" }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.4 }}
        >
          Complete system walkthrough — 18 sections
        </motion.p>

        {/* Feature pills */}
        <motion.div
          className="flex flex-wrap gap-2 justify-center mt-8"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.8 }}
        >
          {["Downtime", "PM Calendar", "KPI", "Inventory", "Training", "Machines", "Attendance", "Defects"].map((f, i) => (
            <span
              key={f}
              className="text-xs px-3 py-1 rounded-full"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#71717a",
                fontFamily: "var(--font-mono)",
                animationDelay: `${i * 0.05}s`,
              }}
            >
              {f}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Animated corner accents */}
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute w-16 h-16"
          style={{
            top: i < 2 ? "3vh" : "auto",
            bottom: i >= 2 ? "3vh" : "auto",
            left: i % 2 === 0 ? "3vw" : "auto",
            right: i % 2 === 1 ? "3vw" : "auto",
            borderTop: i < 2 ? "2px solid rgba(59,130,246,0.4)" : "none",
            borderBottom: i >= 2 ? "2px solid rgba(59,130,246,0.4)" : "none",
            borderLeft: i % 2 === 0 ? "2px solid rgba(59,130,246,0.4)" : "none",
            borderRight: i % 2 === 1 ? "2px solid rgba(59,130,246,0.4)" : "none",
          }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.6 + i * 0.1 }}
        />
      ))}
    </motion.div>
  );
}
