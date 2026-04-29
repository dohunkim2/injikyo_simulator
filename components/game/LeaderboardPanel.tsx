"use client";

import { useEffect, useState } from "react";

import type { CharacterLeaderboard, CharacterLeaderboardEntry } from "@/lib/types";

type LeaderboardResponse = {
  configured: boolean;
  characters: CharacterLeaderboard[];
  message?: string;
};

const TOP_N = 5;

export function LeaderboardPanel() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const response = await fetch("/api/leaderboard", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as LeaderboardResponse | null;

        if (!response.ok || !payload) {
          throw new Error(payload?.message ?? `랭킹 API 오류 (${response.status})`);
        }

        setData(payload);
        setActiveCharacterId((current) => current ?? payload.characters[0]?.characterId ?? null);
      } catch (error) {
        setData({
          configured: false,
          characters: [],
          message: error instanceof Error ? error.message : "랭킹을 불러오지 못했습니다.",
        });
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const totalEntries = data?.characters.reduce((sum, group) => sum + group.entries.length, 0) ?? 0;
  const activeGroup = data?.characters.find((group) => group.characterId === activeCharacterId) ?? null;

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Ranking</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">페르소나별 랭킹</h2>
        </div>
        <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-800">상위 {TOP_N}</span>
      </div>

      {loading ? <p className="mt-4 text-sm text-slate-500">랭킹 불러오는 중...</p> : null}

      {!loading && totalEntries === 0 ? (
        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          {data?.message ?? "아직 저장된 랭킹이 없습니다. 첫 번째 기록을 남겨보세요."}
        </div>
      ) : null}

      {!loading && totalEntries > 0 && data ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.characters.map((group) => (
              <button
                key={group.characterId}
                type="button"
                onClick={() => setActiveCharacterId(group.characterId)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  activeCharacterId === group.characterId
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {group.characterName}
                <span className="ml-1.5 opacity-60">{group.entries.length}</span>
              </button>
            ))}
          </div>

          {activeGroup ? (
            <div className="mt-4 space-y-2">
              {activeGroup.entries.slice(0, TOP_N).map((entry, index) => (
                <RankingRow key={entry.playerId} entry={entry} rank={index + 1} />
              ))}
              {activeGroup.entries.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  이 페르소나로 완료된 기록이 없습니다.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function RankingRow({ entry, rank }: { entry: CharacterLeaderboardEntry; rank: number }) {
  const rankBg =
    rank === 1
      ? "bg-amber-400 text-white"
      : rank === 2
        ? "bg-slate-300 text-slate-800"
        : rank === 3
          ? "bg-orange-300 text-white"
          : "bg-slate-900 text-white";

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${rankBg}`}>
        {rank}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="truncate">{entry.nickname}</span>
          {entry.bestSuccess ? (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
              성공
            </span>
          ) : null}
        </p>
        <p className="text-xs text-slate-500">{entry.runsCount}회 도전</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-cyan-600">{entry.bestAffection}</p>
        <p className="text-[11px] text-slate-400">최고 점수</p>
      </div>
    </div>
  );
}
