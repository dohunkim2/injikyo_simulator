"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AnalysisReport } from "@/components/analysis/AnalysisReport";
import { LeaderboardPanel } from "@/components/game/LeaderboardPanel";
import { getCharacters } from "@/lib/characters";
import { storage } from "@/lib/storage";
import type { StyleAnalysis } from "@/lib/types";

export default function AnalysisPage() {
  const initialAnalysis = storage.load()?.analysis ?? null;
  const canAnalyze = storage.isAllCompleted(getCharacters().map((character) => character.id));

  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(initialAnalysis);
  const [loading, setLoading] = useState(!initialAnalysis && canAnalyze);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading) {
      return;
    }

    const run = async () => {
      try {
        const response = await fetch("/api/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(storage.getAllConversations()),
        });

        if (!response.ok) {
          throw new Error("분석을 생성하지 못했습니다.");
        }

        const payload = (await response.json()) as StyleAnalysis;
        storage.saveAnalysis(payload);
        setAnalysis(payload);
      } catch (analysisError) {
        setError(analysisError instanceof Error ? analysisError.message : "분석에 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [loading]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] p-6 text-slate-600">
        대화 스타일을 분석하는 중...
      </main>
    );
  }

  if (!analysis) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] p-6">
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
          <p className="font-semibold text-slate-900">
            {error || "아직 모든 캐릭터 공략이 끝나지 않았어요."}
          </p>
          <Link href="/" className="mt-4 inline-block rounded-full bg-slate-900 px-5 py-3 text-white">
            홈으로 가기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">대화 스타일 인바디</p>
            <h1 className="text-3xl font-bold">나의 연애 대화 리포트</h1>
          </div>
          <Link href="/" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
            홈으로
          </Link>
        </div>
        <AnalysisReport analysis={analysis} />
        <div className="mt-5">
          <LeaderboardPanel />
        </div>
      </div>
    </main>
  );
}
