"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { LeaderboardPanel } from "@/components/game/LeaderboardPanel";
import { getCharacterById } from "@/lib/characters";
import { storage } from "@/lib/storage";

export default function ResultPage() {
  const params = useParams<{ characterId: string }>();
  const character = useMemo(() => getCharacterById(params.characterId ?? ""), [params.characterId]);
  const [saved] = useState(() => storage.load());

  const record = useMemo(() => {
    if (!character) return undefined;
    return saved?.characters[character.id];
  }, [character, saved]);
  

  if (!character || !record?.chatState) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] p-6">
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
          <p className="font-semibold text-slate-900">아직 저장된 결과가 없어요.</p>
          <Link href="/" className="mt-4 inline-block rounded-full bg-slate-900 px-5 py-3 text-white">
            홈으로 가기
          </Link>
        </div>
      </main>
    );
  }

  const { chatState, feedback } = record;
  const sync = record.serverSync;

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-5">
        <section
          className={`rounded-[2rem] p-6 text-white shadow-lg ${
            chatState.isSuccess ? "bg-emerald-500" : "bg-rose-500"
          }`}
        >
          <p className="text-sm font-medium text-white/75">{character.name} 공략 결과</p>
          <h1 className="mt-2 text-3xl font-bold">{chatState.isSuccess ? "성공했어요" : "이번엔 실패했어요"}</h1>
          <p className="mt-3 text-sm text-white/90">최종 호감도 {chatState.affection} / 100</p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <HighlightCard title="Best Line" value={feedback?.bestLine ?? "기록 없음"} />
          <HighlightCard title="Worst Line" value={feedback?.worstLine ?? "기록 없음"} />
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <p className="text-sm font-semibold text-slate-400">한줄 요약</p>
          <p className="mt-3 text-lg font-semibold text-slate-900">{feedback?.summary ?? "결과를 정리하는 중이에요."}</p>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            사용한 턴 수 {chatState.turnCount} / {chatState.maxTurns}
          </p>
          <div
            className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
              sync?.synced
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {sync?.synced
              ? "공용 랭킹에 저장되었습니다."
              : sync?.error ?? "서버 랭킹 저장 상태를 아직 확인하지 못했습니다."}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <p className="font-semibold text-slate-900">대화 다시 보기</p>
          <div className="mt-4 space-y-3">
            {chatState.messages.map((message, index) => (
              <div
                key={`${message.timestamp}-${index}`}
                className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user" ? "bg-[#FEE500] text-slate-900" : "bg-slate-100 text-slate-700"
                }`}
              >
                {message.content}
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
            다른 캐릭터 도전하기
          </Link>
          <Link
            href={`/chat/${character.id}`}
            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
          >
            대화 화면 보기
          </Link>
        </div>

        <LeaderboardPanel />
      </div>
    </main>
  );
}

function HighlightCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <p className="text-sm font-semibold text-slate-400">{title}</p>
      <p className="mt-3 text-sm leading-6 text-slate-800">{value}</p>
    </div>
  );
}
