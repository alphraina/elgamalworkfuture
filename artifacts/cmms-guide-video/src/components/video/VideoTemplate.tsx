import { AnimatePresence, motion } from "framer-motion";
import { useVideoPlayer } from "@/lib/video";
import { SECTIONS } from "@/data/sections";
import { SectionScene } from "@/components/SectionScene";
import { IntroScene } from "@/components/IntroScene";
import { OutroScene } from "@/components/OutroScene";

// Build durations: intro + all sections + outro
const INTRO_DURATION = 5500;
const OUTRO_DURATION = 7500;

const SCENE_DURATIONS: Record<string, number> = {
  intro: INTRO_DURATION,
  ...Object.fromEntries(SECTIONS.map((s) => [s.id, s.duration])),
  outro: OUTRO_DURATION,
};

function BackgroundGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Grid */}
      <div className="absolute inset-0 grid-bg opacity-100" />
      {/* Radial fade over grid */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(7,7,16,0) 20%, rgba(7,7,16,0.85) 100%)",
        }}
      />
      {/* Top/bottom gradient fades */}
      <div
        className="absolute top-0 left-0 right-0 h-24"
        style={{ background: "linear-gradient(to bottom, #070710, transparent)" }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-24"
        style={{ background: "linear-gradient(to top, #070710, transparent)" }}
      />
      {/* Ambient glow blobs */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: "35vw",
          height: "35vw",
          top: "10%",
          left: "5%",
          background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: "30vw",
          height: "30vw",
          bottom: "10%",
          right: "8%",
          background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />
    </div>
  );
}

// Read optional ?section=downtime URL param to jump to a specific section
function getInitialScene(): number {
  const params = new URLSearchParams(window.location.search);
  const section = params.get("section");
  if (!section) return 0;
  const keys = Object.keys(SCENE_DURATIONS);
  const idx = keys.indexOf(section);
  return idx >= 0 ? idx : 0;
}

export default function VideoTemplate() {
  const { currentSceneKey } = useVideoPlayer({
    durations: SCENE_DURATIONS,
    loop: true,
    initialScene: getInitialScene(),
  });

  const sectionIndex = SECTIONS.findIndex((s) => s.id === currentSceneKey);
  const isSection = sectionIndex >= 0;
  const currentSection = isSection ? SECTIONS[sectionIndex] : null;

  return (
    <div
      className="w-full h-screen overflow-hidden relative"
      style={{ backgroundColor: "#070710" }}
    >
      <BackgroundGrid />

      <AnimatePresence mode="wait">
        {currentSceneKey === "intro" && <IntroScene key="intro" />}

        {isSection && currentSection && (
          <SectionScene
            key={currentSection.id}
            section={currentSection}
            index={sectionIndex}
            total={SECTIONS.length}
          />
        )}

        {currentSceneKey === "outro" && <OutroScene key="outro" />}
      </AnimatePresence>
    </div>
  );
}
