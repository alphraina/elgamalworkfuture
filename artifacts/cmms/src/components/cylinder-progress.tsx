import React from "react";

export function CylinderProgress({
  progress,
  status,
  id,
  size = "sm",
}: {
  progress: number;
  status: string;
  id: number | string;
  size?: "sm" | "lg";
}) {
  const clamp = Math.max(0, Math.min(100, progress));
  const w = size === "lg" ? 80 : 56;
  const bodyH = size === "lg" ? 140 : 100;
  const totalH = size === "lg" ? 180 : 130;
  const capRy = size === "lg" ? 8 : 6;
  const fillHeight = (clamp / 100) * bodyH;
  const uid = `cyl-${id}`;

  const color =
    status === "completed" ? "#22c55e"
    : status === "cancelled" ? "#6b7280"
    : clamp < 30 ? "#ef4444"
    : clamp < 70 ? "#f59e0b"
    : "#22c55e";

  const cx = w / 2;
  const bodyY = capRy / 2;

  return (
    <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id={`${uid}-clip`}>
          <rect x="2" y={bodyY + (bodyH - fillHeight)} width={w - 4} height={fillHeight} />
        </clipPath>
        <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="50%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(222 16% 10%)" />
          <stop offset="40%" stopColor="hsl(222 16% 17%)" />
          <stop offset="100%" stopColor="hsl(222 16% 8%)" />
        </linearGradient>
        <filter id={`${uid}-glow`}>
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect x="2" y={bodyY} width={w - 4} height={bodyH} rx="8" ry="8"
        fill={`url(#${uid}-body)`} stroke="hsl(222 16% 25%)" strokeWidth="1.5" />

      {clamp > 0 && (
        <rect x="2" y={bodyY + (bodyH - fillHeight)} width={w - 4} height={fillHeight}
          rx={fillHeight >= bodyH ? 8 : 0}
          fill={`url(#${uid}-fill)`}
          filter={`url(#${uid}-glow)`}
          clipPath={`url(#${uid}-clip)`}
        />
      )}
      {clamp > 0 && (
        <rect x="2" y={bodyY + bodyH - 12} width={w - 4} height={12}
          fill={`url(#${uid}-fill)`} clipPath={`url(#${uid}-clip)`} />
      )}

      <rect x={size === "lg" ? 9 : 6} y={bodyY + 2} width={size === "lg" ? 16 : 12} height={bodyH - 4} rx="6"
        fill="white" opacity="0.04" />

      <ellipse cx={cx} cy={bodyY} rx={cx - 2} ry={capRy}
        fill="hsl(222 16% 20%)" stroke="hsl(222 16% 30%)" strokeWidth="1.5" />
      <ellipse cx={cx} cy={bodyY + bodyH} rx={cx - 2} ry={capRy}
        fill="hsl(222 16% 16%)" stroke="hsl(222 16% 25%)" strokeWidth="1.5" />

      {[0, 25, 50, 75, 100].map((tick) => {
        const y = bodyY + (bodyH - (tick / 100) * bodyH);
        return (
          <line key={tick} x1={w - 5} y1={y} x2={w - 1} y2={y}
            stroke="hsl(222 16% 35%)" strokeWidth="1" />
        );
      })}

      {clamp > 0 && clamp < 100 && (
        <line x1="2" y1={bodyY + (bodyH - fillHeight)} x2={w - 2} y2={bodyY + (bodyH - fillHeight)}
          stroke={color} strokeWidth="1.5" opacity="0.6" clipPath={`url(#${uid}-clip)`} />
      )}

      <text
        x={cx} y={bodyY + bodyH / 2}
        textAnchor="middle" dominantBaseline="middle"
        fill="white"
        fontSize={size === "lg" ? 18 : 13}
        fontWeight="bold"
        fontFamily="'Chakra Petch', monospace"
        opacity="0.95"
      >
        {clamp}%
      </text>
    </svg>
  );
}
