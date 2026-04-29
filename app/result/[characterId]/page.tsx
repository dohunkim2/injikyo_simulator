"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LeaderboardPanel } from "@/components/game/LeaderboardPanel";
import { getCharacterById } from "@/lib/characters";
import { storage } from "@/lib/storage";
import type { Character, CharacterFeedback, RubricFeedbackItem } from "@/lib/types";

export default function ResultPage() {
  const params = useParams<{ characterId: string }>();
  const defaultCharacter = useMemo(() => getCharacterById(params.characterId ?? ""), [params.characterId]);
  const [character, setCharacter] = useState<Character | null>(defaultCharacter);
  const [saved, setSaved] = useState<ReturnType<typeof storage.load>>(null);
  const [hydrated, setHydrated] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  useEffect(() => {
    setCharacter(defaultCharacter);

    if (!params.characterId) return;

    const loadPersona = async () => {
      const response = await fetch(`/api/personas/${params.characterId}`, { cache: "no-store" });
      if (!response.ok) return;

      const payload = (await response.json()) as { persona: Character };
      setCharacter(payload.persona);
    };

    void loadPersona();
  }, [defaultCharacter, params.characterId]);

  useEffect(() => {
    setHydrated(true);
    setSaved(storage.load());
    const interval = window.setInterval(() => setSaved(storage.load()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const record = useMemo(() => {
    if (!character) return undefined;
    return saved?.characters[character.id];
  }, [character, saved]);

  const requestFeedback = useCallback(
    async (force = false) => {
      if (!character || !record?.chatState?.isGameOver || (record.feedback && !force) || feedbackLoading) {
        return;
      }

      setFeedbackLoading(true);
      setFeedbackError("");

      try {
        const response = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterId: character.id,
            messages: record.chatState.messages,
            success: record.chatState.isSuccess,
            finalAffection: record.chatState.affection,
            turnsUsed: record.chatState.turnCount,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "결과표 생성에 실패했습니다.");
        }

        const feedbackPayload = (await response.json()) as CharacterFeedback;
        if (isFallbackFeedback(feedbackPayload)) {
          setFeedbackError(feedbackPayload.judgeComment ?? "저지 모델 평가가 완료되지 않았습니다.");
          return;
        }

        storage.saveFeedback(character.id, feedbackPayload);
        setSaved(storage.load());
      } catch (error) {
        setFeedbackError(error instanceof Error ? error.message : "결과표 생성에 실패했습니다.");
      } finally {
        setFeedbackLoading(false);
      }
    },
    [character, feedbackLoading, record],
  );

  useEffect(() => {
    if (!character || !record?.chatState?.isGameOver || record.feedback || feedbackLoading || feedbackError) {
      return;
    }

    void requestFeedback();
  }, [character, record, feedbackLoading, feedbackError, requestFeedback]);
  

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] p-6">
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
          <p className="font-semibold text-slate-900">결과를 불러오는 중이에요.</p>
        </div>
      </main>
    );
  }

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
  const judgeFeedback = isFallbackFeedback(feedback) ? undefined : feedback;
  const sync = record.serverSync;
  const report = buildReport(judgeFeedback, character, chatState.affection);

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex justify-end">
          <Link
            href="/"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200"
          >
            홈으로
          </Link>
        </div>

        <section
          className={`rounded-[2rem] p-6 text-white shadow-lg ${
            chatState.isSuccess ? "bg-emerald-500" : "bg-rose-500"
          }`}
        >
          <p className="text-sm font-medium text-white/75">{character.name} 과제 결과</p>
          <h1 className="mt-2 text-3xl font-bold">{chatState.isSuccess ? "성공했어요" : "이번엔 실패했어요"}</h1>
          <p className="mt-3 text-sm text-white/90">
            최종 {character.scoreLabel ?? "성공 점수"} {chatState.affection} / 100
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <HighlightCard title="Best Line" value={judgeFeedback?.bestLine ?? "기록 없음"} />
          <HighlightCard title="Worst Line" value={judgeFeedback?.worstLine ?? "기록 없음"} />
        </section>

        <section className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-black/5">
          <div className="border-b border-slate-100 bg-slate-950 px-5 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Conversation InBody</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">대화 결과표</h2>
                <p className="mt-1 text-sm text-white/65">
                  {judgeFeedback?.summary ??
                    (feedbackLoading ? "저지 모델이 결과표를 생성하는 중이에요." : "결과를 정리하는 중이에요.")}
                </p>
              </div>
              <div className="flex flex-col items-end gap-3 text-right">
                <p className="text-5xl font-black leading-none">{report.grade}</p>
                <p className="mt-1 text-xs text-white/60">Judge Grade</p>
                <button
                  type="button"
                  disabled={feedbackLoading}
                  onClick={() => void requestFeedback(true)}
                  className="rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-950 shadow-sm disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-white/70"
                >
                  {feedbackLoading ? "재요청 중" : "피드백 재요청"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-5 md:grid-cols-4">
            <MetricCard label={character.scoreLabel ?? "성공 점수"} value={`${chatState.affection}`} suffix="/100" />
            <MetricCard label="루브릭 총점" value={report.total} suffix={`/${report.max}`} />
            <MetricCard label="사용 턴" value={`${chatState.turnCount}`} suffix={`/${chatState.maxTurns}`} />
            <MetricCard label="판정" value={chatState.isSuccess ? "성공" : "실패"} />
          </div>

          <div className="space-y-3 px-5 pb-5">
            <p className="text-sm font-semibold text-slate-900">항목별 프롬프트 지수</p>
            {report.rubricScores.length > 0 ? (
              report.rubricScores.map((item) => <RubricScoreRow key={item.label} item={item} />)
            ) : (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                저장된 루브릭 상세 평가가 없습니다. 다음 완료 기록부터 저지 모델 평가가 표시됩니다.
              </div>
            )}
            {feedbackError ? (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {feedbackError}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 border-t border-slate-100 p-5 md:grid-cols-2">
            <ListCard title="강점" items={report.strengths} tone="good" />
            <ListCard title="개선 포인트" items={report.improvements} tone="warn" />
          </div>

          <div className="px-5 pb-5">
            <div className="rounded-2xl bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-900">
              <b>Judge Comment</b>
              <p className="mt-1">{report.judgeComment}</p>
            </div>
          </div>

          <div
            className={`mx-5 mb-5 rounded-2xl px-4 py-3 text-sm ${
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

function isFallbackFeedback(feedback: CharacterFeedback | undefined) {
  if (!feedback) return false;
  if (feedback.judgeComment?.includes("저지 모델 응답")) return true;
  if (feedback.judgeComment?.includes("임시 결과")) return true;
  return feedback.rubricScores?.some((item) => item.evidence.includes("저지 모델 평가를 불러오지 못했습니다.")) ?? false;
}

function MetricCard({ label, value, suffix = "" }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">
        {value}
        <span className="ml-1 text-sm font-semibold text-slate-400">{suffix}</span>
      </p>
    </div>
  );
}

function RubricScoreRow({ item }: { item: RubricFeedbackItem }) {
  const ratio = item.points > 0 ? Math.min(100, Math.max(0, (item.score / item.points) * 100)) : 0;
  const promptIndex = formatScore(ratio / 10);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{item.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{item.criteria}</p>
        </div>
        <p className="shrink-0 text-sm font-black text-slate-900">
          {promptIndex}
          <span className="text-slate-400">/10</span>
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-600" style={{ width: `${ratio}%` }} />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">
        <b className="text-slate-800">근거</b> {item.evidence}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{item.comment}</p>
    </div>
  );
}

function ListCard({ title, items, tone }: { title: string; items: string[]; tone: "good" | "warn" }) {
  const toneClass = tone === "good" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900";

  return (
    <div className={`rounded-2xl px-4 py-3 ${toneClass}`}>
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 space-y-1 text-sm leading-6">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function buildReport(feedback: CharacterFeedback | undefined, character: Character, finalScore: number) {
  const rubricScores =
    feedback?.rubricScores && feedback.rubricScores.length > 0
      ? feedback.rubricScores
      : (character.evaluationRubric ?? []).map((item) => ({
          label: item.label,
          points: item.points,
          score: 0,
          criteria: item.criteria,
          evidence: "저지 모델 평가가 아직 완료되지 않았습니다.",
          comment: "피드백 재요청을 눌러 다시 채점할 수 있습니다.",
        }));
  const max = feedback?.maxRubricScore ?? rubricScores.reduce((sum, item) => sum + item.points, 0);
  const total = feedback?.totalRubricScore ?? rubricScores.reduce((sum, item) => sum + item.score, 0);

  return {
    rubricScores,
    max: formatScore(max),
    total: formatScore(total),
    grade: feedback?.grade ?? gradeFromRatio(max > 0 ? total / max : finalScore / 100),
    strengths: feedback?.strengths?.length ? feedback.strengths : ["대화를 끝까지 진행했습니다."],
    improvements: feedback?.improvements?.length
      ? feedback.improvements
      : ["다음 완료 기록부터 루브릭 기준 개선점이 표시됩니다."],
    judgeComment: feedback?.judgeComment ?? "저지 모델 상세 평가가 아직 저장되지 않은 기록입니다.",
  };
}

function formatScore(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function gradeFromRatio(ratio: number) {
  if (ratio >= 0.9) return "S";
  if (ratio >= 0.8) return "A";
  if (ratio >= 0.7) return "B";
  if (ratio >= 0.6) return "C";
  if (ratio >= 0.45) return "D";
  return "F";
}
