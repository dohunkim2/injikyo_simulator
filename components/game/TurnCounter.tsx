type Props = {
  turnCount: number;
  maxTurns: number;
};

export function TurnCounter({ turnCount, maxTurns }: Props) {
  return (
    <div className="rounded-2xl bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur">
      💬 {turnCount}/{maxTurns}
    </div>
  );
}
