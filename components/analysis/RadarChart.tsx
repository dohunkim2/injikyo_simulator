import { COLORS } from "@/lib/constants";
import type { StyleAnalysis } from "@/lib/types";

const labels: Array<keyof StyleAnalysis["radar"]> = [
  "charm",
  "wit",
  "empathy",
  "confidence",
  "timing",
  "naturalness",
];

const labelMap: Record<(typeof labels)[number], string> = {
  charm: "매력도",
  wit: "위트",
  empathy: "공감력",
  confidence: "자신감",
  timing: "타이밍",
  naturalness: "자연스러움",
};

type Props = {
  radar: StyleAnalysis["radar"];
};

export function RadarChart({ radar }: Props) {
  const center = 140;
  const radius = 90;

  const points = labels.map((label, index) => {
    const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2;
    const value = radar[label] / 100;
    const x = center + Math.cos(angle) * radius * value;
    const y = center + Math.sin(angle) * radius * value;
    return `${x},${y}`;
  });

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <svg viewBox="0 0 280 280" className="mx-auto w-full max-w-[320px]">
        {[1, 0.75, 0.5, 0.25].map((scale) => (
          <polygon
            key={scale}
            points={labels
              .map((_, index) => {
                const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2;
                const x = center + Math.cos(angle) * radius * scale;
                const y = center + Math.sin(angle) * radius * scale;
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="#E5E7EB"
          />
        ))}
        {labels.map((label, index) => {
          const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          const tx = center + Math.cos(angle) * (radius + 28);
          const ty = center + Math.sin(angle) * (radius + 28);

          return (
            <g key={label}>
              <line x1={center} y1={center} x2={x} y2={y} stroke="#E5E7EB" />
              <text x={tx} y={ty} textAnchor="middle" fontSize="12" fill="#64748B">
                {labelMap[label]}
              </text>
            </g>
          );
        })}
        <polygon points={points.join(" ")} fill={COLORS.radarFill} stroke={COLORS.radarStroke} strokeWidth="2" />
      </svg>
    </div>
  );
}
