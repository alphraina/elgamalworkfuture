import { motion } from "framer-motion";
import type { Section } from "@/data/sections";
import { BrowserFrame } from "./BrowserFrame";
import { ActionSteps } from "./TypingText";

interface SectionSceneProps {
  section: Section;
  index: number;
  total: number;
}

function FeaturePills({ features, accentColor }: { features: string[]; accentColor: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {features.map((f, i) => (
        <motion.span
          key={f}
          className="text-[10px] px-2.5 py-0.5 rounded-full font-medium"
          style={{
            background: `${accentColor}14`,
            border: `1px solid ${accentColor}35`,
            color: accentColor,
            fontFamily: "var(--font-mono)",
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 + i * 0.07, duration: 0.3, ease: "easeOut" }}
        >
          {f}
        </motion.span>
      ))}
    </div>
  );
}

export function SectionScene({ section, index, total }: SectionSceneProps) {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      initial={{ clipPath: "inset(0 100% 0 0)" }}
      animate={{ clipPath: "inset(0 0% 0 0)" }}
      exit={{ clipPath: "inset(0 0 0 100%)", opacity: 0.5 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Top progress bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5 z-20">
        <motion.div
          className="h-full"
          style={{ background: section.accentColor, transformOrigin: "left" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: section.duration / 1000, ease: "linear" }}
        />
      </div>

      {/* Top accent line */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-px z-10"
        style={{ background: `linear-gradient(90deg, transparent, ${section.accentColor}70, transparent)` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Section counter badge */}
      <div className="absolute top-4 left-5 z-20">
        <motion.div
          className="flex items-center gap-1.5 rounded-full px-3 py-1"
          style={{
            background: `${section.accentColor}1a`,
            border: `1px solid ${section.accentColor}45`,
            backdropFilter: "blur(8px)",
          }}
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: section.accentColor }} />
          <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ fontFamily: "var(--font-mono)", color: section.accentColor }}>
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </motion.div>
      </div>

      {/* Main content area */}
      <div className="flex flex-col h-full px-6 pt-12 pb-3 gap-2">

        {/* ─── Title row ─── */}
        <motion.div
          className="flex items-center justify-between flex-shrink-0"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <div>
            <h2
              className="font-bold leading-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.1rem, 2.8vw, 1.85rem)",
                color: "#fff",
                letterSpacing: "-0.025em",
              }}
            >
              {section.title}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#71717a" }}>
              {section.subtitle}
            </p>
          </div>
          {/* Accent icon */}
          <motion.div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ml-4"
            style={{ background: `${section.accentColor}16`, border: `1px solid ${section.accentColor}38` }}
            animate={{ rotate: [0, 4, -4, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-4 h-4 rounded-md" style={{ background: section.accentColor, opacity: 0.85 }} />
          </motion.div>
        </motion.div>

        {/* ─── Feature pills ─── */}
        <motion.div
          className="flex-shrink-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <FeaturePills features={section.features} accentColor={section.accentColor} />
        </motion.div>

        {/* ─── Browser frame ─── */}
        <motion.div
          className="flex-1 min-h-0"
          initial={{ y: 20, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <BrowserFrame section={section} sceneActive={true} />
        </motion.div>

        {/* ─── Action step text ─── */}
        <motion.div
          className="flex-shrink-0"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <ActionSteps steps={section.actions} accentColor={section.accentColor} />
        </motion.div>
      </div>

      {/* Bottom accent line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${section.accentColor}45, transparent)` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      />
    </motion.div>
  );
}
