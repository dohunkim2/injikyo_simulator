import { RadarChart } from "./RadarChart";
import { StyleBadge } from "./StyleBadge";

import { getGradeColor } from "@/lib/utils";
import type { StyleAnalysis } from "@/lib/types";

type Props = {
  analysis: StyleAnalysis;
};

export function AnalysisReport({ analysis }: Props) {
  return (
    <div className="space-y-5">
      <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className="flex h-28 w-28 items-center justify-center rounded-full text-5xl font-bold text-white"
            style={{ backgroundColor: getGradeColor(analysis.overallGrade) }}
          >
            {analysis.overallGrade}
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{analysis.overallScore}점</p>
            <p className="mt-1 text-sm text-slate-500">{analysis.overallComment}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StyleBadge label="Primary Style" styleType={analysis.primaryStyle} />
        <StyleBadge label="Secondary Style" styleType={analysis.secondaryStyle} />
      </div>

      <RadarChart radar={analysis.radar} />

      <div className="grid gap-4 md:grid-cols-3">
        <InfoList title="강점" items={analysis.strengths} />
        <InfoList title="약점" items={analysis.weaknesses} />
        <InfoList title="패턴" items={analysis.patterns} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {analysis.characterResults.map((result) => (
          <div key={result.characterId} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-900">{result.characterName}</p>
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                  result.success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                }`}
              >
                {result.success ? "성공" : "실패"}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">최종 호감도 {result.finalAffection}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{result.keyMoment}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-sm">
        <p className="text-sm font-semibold text-white/70">핵심 조언</p>
        <p className="mt-2 leading-7">{analysis.advice}</p>
      </div>
    </div>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <p className="font-semibold text-slate-900">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}
