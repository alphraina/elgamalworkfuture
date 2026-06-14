import { motion, useMotionValue, useSpring, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { CursorWaypoint } from "@/data/sections";

interface AnimatedCursorProps {
  waypoints: CursorWaypoint[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  visible: boolean;
}

function ClickRipple({ x, y, id }: { x: number; y: number; id: number }) {
  return (
    <motion.div
      key={id}
      className="pointer-events-none absolute rounded-full border-2 border-blue-400"
      style={{ left: x - 16, top: y - 16, width: 32, height: 32 }}
      initial={{ scale: 0, opacity: 0.9 }}
      animate={{ scale: 3, opacity: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    />
  );
}

export function AnimatedCursor({ waypoints, containerRef, visible }: AnimatedCursorProps) {
  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const springX = useSpring(cursorX, { stiffness: 280, damping: 28 });
  const springY = useSpring(cursorY, { stiffness: 280, damping: 28 });

  const [clicking, setClicking] = useState(false);
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const rippleId = useRef(0);

  useEffect(() => {
    if (!visible || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Initial position — center
    cursorX.set(rect.width * 0.5);
    cursorY.set(rect.height * 0.5);

    waypoints.forEach((wp) => {
      const t = setTimeout(() => {
        const tx = rect.width  * (wp.x / 100);
        const ty = rect.height * (wp.y / 100);
        animate(cursorX, tx, { duration: 0.7, ease: [0.25, 1, 0.5, 1] });
        animate(cursorY, ty, { duration: 0.7, ease: [0.25, 1, 0.5, 1] });

        if (wp.click) {
          setTimeout(() => {
            setClicking(true);
            setRipples(r => [...r, { x: tx, y: ty, id: ++rippleId.current }]);
            setTimeout(() => setClicking(false), 200);
          }, 700);
        }
      }, wp.delay);
      timers.push(t);
    });

    return () => timers.forEach(clearTimeout);
  }, [waypoints, visible, containerRef]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 30 }}>
      {/* Ripples */}
      {ripples.slice(-4).map(r => (
        <ClickRipple key={r.id} x={r.x} y={r.y} id={r.id} />
      ))}

      {/* Cursor */}
      <motion.div
        className="absolute pointer-events-none"
        style={{ x: springX, y: springY }}
      >
        <motion.svg
          width="22" height="26"
          viewBox="0 0 22 26"
          style={{ x: -3, y: -2 }}
          animate={{ scale: clicking ? 0.82 : 1 }}
          transition={{ duration: 0.1 }}
        >
          <path
            d="M1 1L1 21L6.5 15.5L10.5 24L13.5 22.5L9.5 13.5L17 13.5L1 1Z"
            fill="white"
            stroke="#1e293b"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </motion.svg>
        {clicking && (
          <motion.div
            className="absolute rounded-full bg-blue-400/30"
            style={{ width: 20, height: 20, x: -7, y: -7 }}
            initial={{ scale: 0.5, opacity: 1 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </motion.div>
    </div>
  );
}
