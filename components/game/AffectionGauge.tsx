type Props = {
  affection: number;
  change?: number;
};

export function AffectionGauge({ affection, change = 0 }: Props) {
  const isBigMove = Math.abs(change) >= 12;
  const directionColor =
    change > 0 ? "text-pink-500" : change < 0 ? "text-indigo-500" : "text-slate-500";

  return (
    <div
      className={`rounded-2xl bg-white/80 p-3 shadow-sm backdrop-blur transition ${
        isBigMove ? "scale-[1.01] ring-2 ring-pink-200" : ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-700">
        <span>♥ 호감도</span>
        <span className="flex items-center gap-2">
          {change !== 0 ? (
            <span className={`font-bold ${directionColor}`}>
              {change > 0 ? `+${change}` : change}
            </span>
          ) : null}
          {affection}/100
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white">
        <div
          className={`h-full rounded-full bg-[linear-gradient(90deg,#FF6B6B,#FF8E8E)] transition-all duration-700 ${
            isBigMove ? "animate-pulse" : ""
          }`}
          style={{ width: `${affection}%` }}
        />
      </div>
    </div>
  );
}
