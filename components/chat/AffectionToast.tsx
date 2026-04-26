type Props = {
  value: number;
};

export function AffectionToast({ value }: Props) {
  const positive = value >= 0;
  const dramatic = Math.abs(value) >= 15;

  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 animate-[toast-up_1.2s_ease-out_forwards] rounded-full px-4 py-2 font-bold text-white shadow-lg ${
        dramatic ? "text-lg" : "text-sm"
      } ${
        positive
          ? dramatic
            ? "bg-gradient-to-r from-pink-500 to-rose-500"
            : "bg-pink-500"
          : dramatic
            ? "bg-gradient-to-r from-indigo-600 to-violet-600"
            : "bg-indigo-500"
      }`}
    >
      {positive ? `+${value} ♥ ${dramatic ? "두근!" : ""}` : `${value} 💔 ${dramatic ? "싸늘..." : ""}`}
    </div>
  );
}
