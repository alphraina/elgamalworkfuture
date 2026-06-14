import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { AnimatedCursor } from "./AnimatedCursor";
import type { Callout, Section } from "@/data/sections";

function CalloutBubble({ callout }: { callout: Callout }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), callout.showAt);
    const hide = setTimeout(() => setVisible(false), callout.hideAt);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [callout.showAt, callout.hideAt]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute z-30 pointer-events-none"
          style={{
            left: `${callout.x}%`,
            top: `${callout.y}%`,
            transform: callout.side === "left" ? "translate(-100%, -50%)" : "translate(4px, -50%)",
          }}
          initial={{ opacity: 0, scale: 0.75, x: callout.side === "left" ? 10 : -10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Arrow */}
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{
              [callout.side === "left" ? "right" : "left"]: -5,
              width: 0,
              height: 0,
              borderTop: "4px solid transparent",
              borderBottom: "4px solid transparent",
              [callout.side === "left" ? "borderLeft" : "borderRight"]: "5px solid rgba(255,255,255,0.18)",
            }}
          />
          {/* Label */}
          <div
            className="rounded-md px-2.5 py-1 text-white whitespace-nowrap"
            style={{
              background: "rgba(15,15,25,0.88)",
              border: "1px solid rgba(255,255,255,0.18)",
              backdropFilter: "blur(8px)",
              fontSize: "0.65rem",
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              letterSpacing: "0.02em",
            }}
          >
            {callout.text}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface BrowserFrameProps {
  section: Section;
  sceneActive: boolean;
}

export function BrowserFrame({ section, sceneActive }: BrowserFrameProps) {
  const innerRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      className="relative w-full rounded-xl overflow-hidden h-full"
      style={{
        boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 40px 100px rgba(0,0,0,0.7), 0 0 60px ${section.accentColor}22`,
      }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 relative flex-shrink-0"
        style={{ background: "#1a1a2e", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
        </div>
        <div
          className="flex-1 mx-3 rounded-md flex items-center gap-2 px-3 py-1"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="w-2.5 h-2.5 rounded-full opacity-50" style={{ background: section.accentColor }} />
          <span style={{ color: "#52525b", fontSize: "0.6rem", fontFamily: "var(--font-mono)" }}>
            oppo-cmms.app/{section.id}
          </span>
        </div>
        <div className="opacity-25 text-white text-xs">↻</div>
      </div>

      {/* Screenshot content area */}
      <div
        ref={innerRef}
        className="relative overflow-hidden flex-1"
        style={{ aspectRatio: "16/9" }}
      >
        {/* Screenshot with zoom/pan */}
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1, x: 0, y: 0 }}
          animate={
            section.zoom && sceneActive
              ? { scale: section.zoom.scale, x: `${section.zoom.x}%`, y: `${section.zoom.y}%` }
              : { scale: 1, x: 0, y: 0 }
          }
          transition={{
            delay: section.zoom ? section.zoom.startAt / 1000 : 0,
            duration: 1.6,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <img
            src={import.meta.env.BASE_URL + section.screenshot}
            alt={section.title}
            className="w-full h-full object-cover object-top"
            draggable={false}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, transparent 55%, rgba(7,7,16,0.35) 100%)",
            }}
          />
        </motion.div>

        {/* Callout bubbles — positioned relative to inner area */}
        {sceneActive && (section.callouts ?? []).map((callout, i) => (
          <CalloutBubble key={i} callout={callout} />
        ))}

        {/* Cursor */}
        <AnimatedCursor
          waypoints={section.cursor}
          containerRef={innerRef}
          visible={sceneActive}
        />

        {/* Scan line */}
        <div className="scan-line" />
      </div>
    </motion.div>
  );
}
