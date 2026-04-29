"use client";

import { useEffect, useState } from "react";

import type { LeaderboardEntry } from "@/lib/types";

type LeaderboardResponse = {
  configured: boolean;
  entries: LeaderboardEntry[];
  message?: string;
};

export function LeaderboardPanel() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const response = await fetch("/api/leaderboard", { cache: "no-store" });
        const payload = (await response.json()) as LeaderboardResponse;
        setData(payload);
      } catch {
        setData({ configured: false, entries: [], message: "랭킹을 불러오지 못했습니다." });
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Ranking</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">전체 점수 랭킹</h2>
        </div>
        <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-800">전체</span>
      </div>

      {loading ? <p className="mt-4 text-sm text-slate-500">랭킹 불러오는 중...</p> : null}

      {!loading && data && data.entries.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          {data.message ?? "아직 저장된 랭킹이 없습니다. 첫 번째 기록을 남겨보세요."}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {data?.entries.map((entry, index) => (
          <div key={entry.playerId} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
              {index + 1}
            </span>
            <div>
              <p className="font-semibold text-slate-900">{entry.nickname}</p>
              <p className="text-xs text-slate-500">
                성공 {entry.successCount}회 · 평균 {entry.averageAffection}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-cyan-600">{entry.bestAffection}</p>
              <p className="text-[11px] text-slate-400">최고 점수</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
