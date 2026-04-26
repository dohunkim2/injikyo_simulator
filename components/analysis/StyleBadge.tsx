import type { StyleType } from "@/lib/types";

type Props = {
  label: string;
  styleType: StyleType;
};

export function StyleBadge({ label, styleType }: Props) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-3xl">{styleType.emoji}</span>
        <div>
          <p className="font-semibold text-slate-900">{styleType.name}</p>
          <p className="text-sm text-slate-600">{styleType.description}</p>
        </div>
      </div>
    </div>
  );
}
