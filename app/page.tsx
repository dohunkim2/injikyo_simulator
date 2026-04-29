"use client";

import Link from "next/link";
import { BrainCircuit, Gauge, RotateCcw, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { LeaderboardPanel } from "@/components/game/LeaderboardPanel";
import { PlayerProfileCard } from "@/components/game/PlayerProfileCard";
import { CharacterCard } from "@/components/select/CharacterCard";
import { getCharacters } from "@/lib/characters";
import { storage } from "@/lib/storage";
import { useClearEpochCheck } from "@/lib/use-clear-epoch";
import type { Character, PlayerProfile, SavedData } from "@/lib/types";

const defaultCharacters = getCharacters();

export default function Home() {
  useClearEpochCheck();
  const [characters, setCharacters] = useState<Character[]>(defaultCharacters);
  const [saved, setSaved] = useState<SavedData | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [mounted, setMounted] = useState(false);
  const allCompleted = mounted
    ? characters.every((character) => Boolean(saved?.characters[character.id]?.chatState?.isGameOver))
    : false;

  useEffect(() => {
    setMounted(true);
    setSaved(storage.load());
    setProfile(storage.getOrCreatePlayerProfile());

    const loadPersonas = async () => {
      const response = await fetch("/api/personas", { cache: "no-store" });
      if (!response.ok) return;

      const payload = (await response.json()) as { personas: Character[] };
      setCharacters(payload.personas);
    };

    void loadPersonas();
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe,transparent_30%),linear-gradient(180deg,#f8fafc,#eef2ff)] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-8 text-white shadow-xl ring-1 ring-white/10">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -bottom-20 left-8 h-44 w-44 rounded-full bg-violet-500/20 blur-3xl" />

          <div className="relative">
            <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
              Persona Prompt Lab
            </p>
            <h1 className="mt-4 text-3xl font-bold leading-tight">
              페르소나 LLM과 대화하며 프롬프트 대응력을 훈련하세요
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/75">
              화해, 설득, 관계 형성, 거절처럼 까다로운 상황을 10턴 동안 해결해 보세요.
              각 페르소나는 명확한 채점 기준과 레드플래그로 반응하고, 대화 전략에 따라 점수가 달라집니다.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={allCompleted ? "/analysis" : `/chat/${characters[0]?.id ?? ""}`}
                className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/20"
              >
                {allCompleted ? "대화 분석 보기" : "첫 페르소나 시작하기"}
              </Link>
              <button
                onClick={async () => {
                  const phrase = window.prompt("기록을 초기화하려면 비밀 문구를 입력하세요.");
                  if (!phrase) return;

                  const response = await fetch("/api/access", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "reset", keyword: phrase }),
                  });

                  if (!response.ok) {
                    window.alert("비밀 문구가 올바르지 않습니다.");
                    return;
                  }

                  storage.reset();
                  setSaved(storage.load());
                  setProfile(storage.getOrCreatePlayerProfile());
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10"
              >
                <RotateCcw size={16} />
                기록 초기화
              </button>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10"
              >
                관리자
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <InfoCard
            icon={<BrainCircuit size={20} />}
            title="상황형 프롬프트"
            description="페르소나의 감정, 목적, 레드플래그를 읽고 답변을 설계합니다."
          />
          <InfoCard
            icon={<Gauge size={20} />}
            title="실시간 점수"
            description="루브릭 충족 여부와 실수 여부가 턴마다 점수로 반영됩니다."
          />
          <InfoCard
            icon={<ShieldCheck size={20} />}
            title="관리자 피드백"
            description="관리자가 유저별 대화와 점수를 보고 페르소나 기준을 조정할 수 있습니다."
          />
        </section>

        {profile ? (
          <PlayerProfileCard
            profile={profile}
            onSave={(nickname) => {
              const nextProfile = storage.updateNickname(nickname);
              setProfile(nextProfile);
              setSaved(storage.load());
            }}
          />
        ) : null}

        <section className="space-y-4">
          {characters.map((character) => {
            const progress = saved?.characters[character.id];
            return (
              <CharacterCard
                key={character.id}
                character={character}
                completed={mounted ? progress?.chatState?.isGameOver : false}
                success={mounted ? progress?.chatState?.isSuccess : false}
              />
            );
          })}
        </section>

        <LeaderboardPanel />
      </div>
    </main>
  );
}

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl bg-white/80 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-cyan-200">
        {icon}
      </div>
      <p className="mt-3 font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}
