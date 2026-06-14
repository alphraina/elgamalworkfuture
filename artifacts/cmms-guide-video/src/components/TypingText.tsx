import { useEffect, useState } from "react";

interface TypingTextProps {
  text: string;
  startAt?: number;  // ms delay before typing starts
  speed?: number;    // ms per character
  className?: string;
}

export function TypingText({ text, startAt = 0, speed = 28, className }: TypingTextProps) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const pre = setTimeout(() => {
      const iv = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(iv);
      }, speed);
      return () => clearInterval(iv);
    }, startAt);
    return () => clearTimeout(pre);
  }, [text, startAt, speed]);

  return (
    <span className={className}>
      {displayed}
      {displayed.length < text.length && (
        <span className="inline-block w-[2px] h-[0.85em] align-middle ml-0.5 animate-pulse" style={{ background: "currentColor", opacity: 0.7 }} />
      )}
    </span>
  );
}

/** Sequenced action steps — shows one step at a time */
interface ActionStepsProps {
  steps: Array<{ text: string; showAt: number }>;
  accentColor: string;
}

export function ActionSteps({ steps, accentColor }: ActionStepsProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const safeSteps = steps ?? [];

  useEffect(() => {
    setActiveIndex(-1);
    const timers = safeSteps.map((step, i) =>
      setTimeout(() => setActiveIndex(i), step.showAt)
    );
    return () => timers.forEach(clearTimeout);
  }, [steps]);

  if (activeIndex < 0 || !safeSteps[activeIndex]) return <div className="h-10" />;

  const step = safeSteps[activeIndex];

  return (
    <div
      key={activeIndex}
      className="flex items-start gap-2 px-4 py-2 rounded-lg"
      style={{
        background: `${accentColor}12`,
        border: `1px solid ${accentColor}30`,
      }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 animate-pulse"
        style={{ background: accentColor }}
      />
      <span
        className="text-xs leading-relaxed"
        style={{ color: "#d4d4d8", fontFamily: "var(--font-body)" }}
      >
        <TypingText key={`${activeIndex}-${step.text}`} text={step.text} speed={22} />
      </span>
    </div>
  );
}
