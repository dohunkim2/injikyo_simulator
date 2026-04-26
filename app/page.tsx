"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useState } from "react";

import { LeaderboardPanel } from "@/components/game/LeaderboardPanel";
import { PlayerProfileCard } from "@/components/game/PlayerProfileCard";
import { CharacterCard } from "@/components/select/CharacterCard";
import { getCharacters } from "@/lib/characters";
import { storage } from "@/lib/storage";
import type { PlayerProfile, SavedData } from "@/lib/types";

const characters = getCharacters();

export default function Home() {
  const [saved, setSaved] = useState<SavedData | null>(() => storage.load());
  const [profile, setProfile] = useState<PlayerProfile>(() => storage.getOrCreatePlayerProfile());
  const allCompleted = storage.isAllCompleted(characters.map((character) => character.id));

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-[2rem] bg-slate-900 px-6 py-8 text-white shadow-lg">
          <p className="text-sm font-medium text-white/70">대화형 연애 시뮬레이션</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight">10턴 안에 썸의 흐름을 만들어보세요</h1>
          <p className="mt-3 text-sm leading-6 text-white/80">
            캐릭터마다 다른 취향과 분위기를 읽고, 자연스럽게 공략에 성공해 보세요.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={allCompleted ? "/analysis" : `/chat/${characters[0]?.id ?? ""}`}
              className="rounded-full bg-[#FEE500] px-5 py-3 text-sm font-semibold text-slate-900"
            >
              {allCompleted ? "🔍 대화 스타일 분석 보기" : "첫 캐릭터 시작하기"}
            </Link>
            <button
              onClick={() => {
                storage.reset();
                setSaved(storage.load());
                setProfile(storage.getOrCreatePlayerProfile());
              }}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white"
            >
              <RotateCcw size={16} />
              기록 초기화
            </button>
          </div>
        </section>

        <PlayerProfileCard
          profile={profile}
          onSave={(nickname) => {
            const nextProfile = storage.updateNickname(nickname);
            setProfile(nextProfile);
            setSaved(storage.load());
          }}
        />

        <section className="space-y-4">
          {characters.map((character) => {
            const progress = saved?.characters[character.id];
            return (
              <CharacterCard
                key={character.id}
                character={character}
                completed={progress?.chatState?.isGameOver}
                success={progress?.chatState?.isSuccess}
              />
            );
          })}
        </section>

        <LeaderboardPanel />
      </div>
    </main>
  );
}
