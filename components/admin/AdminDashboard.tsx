"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { AdminSessionDetail, AdminSessionSummary } from "@/lib/types";

type SessionsResponse = {
  configured: boolean;
  sessions: AdminSessionSummary[];
  message?: string;
};

type SessionDetailResponse = {
  session: AdminSessionDetail;
};

type PersonaGroup = {
  characterId: string;
  characterName: string;
  sessions: AdminSessionSummary[];
  activeCount: number;
};

function formatTime(value: string | number | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-rose-600";
}

function shortId(value: string) {
  return value.length > 10 ? `${value.slice(0, 8)}...` : value;
}

export function AdminDashboard() {
  const [sessions, setSessions] = useState<AdminSessionSummary[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminSessionDetail | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const personaGroups = useMemo(() => {
    const groups = new Map<string, PersonaGroup>();

    for (const session of sessions) {
      const current = groups.get(session.characterId) ?? {
        characterId: session.characterId,
        characterName: session.characterName,
        sessions: [],
        activeCount: 0,
      };

      current.sessions.push(session);
      current.activeCount += session.status === "in_progress" ? 1 : 0;
      groups.set(session.characterId, current);
    }

    return Array.from(groups.values()).sort((a, b) => {
      const aLatest = a.sessions[0]?.lastMessageAt ?? "";
      const bLatest = b.sessions[0]?.lastMessageAt ?? "";
      return bLatest.localeCompare(aLatest);
    });
  }, [sessions]);

  const selectedGroup = personaGroups.find((group) => group.characterId === selectedCharacterId);

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/sessions", { cache: "no-store" });

      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }

      const payload = (await response.json().catch(() => null)) as SessionsResponse | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.message ?? `관리자 세션 API 오류 (${response.status})`);
      }

      const nextSessions = payload.sessions ?? [];
      setSessions(nextSessions);
      setMessage(payload.message ?? "");
      setLoading(false);

      setSelectedCharacterId((current) => current ?? nextSessions[0]?.characterId ?? null);
      setSelectedRunId((current) => current ?? nextSessions[0]?.runId ?? null);
    } catch (error) {
      setSessions([]);
      setSelectedCharacterId(null);
      setSelectedRunId(null);
      setDetail(null);
      setMessage(error instanceof Error ? error.message : "관리자 세션 목록을 불러오지 못했습니다.");
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (runId: string) => {
    const response = await fetch(`/api/admin/sessions/${runId}`, { cache: "no-store" });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as SessionDetailResponse;
    setDetail(payload.session);
  }, []);

  useEffect(() => {
    void loadSessions();
    const interval = window.setInterval(() => void loadSessions(), 3000);
    return () => window.clearInterval(interval);
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedRunId) {
      setDetail(null);
      return;
    }

    void loadDetail(selectedRunId);
    const interval = window.setInterval(() => void loadDetail(selectedRunId), 3000);
    return () => window.clearInterval(interval);
  }, [loadDetail, selectedRunId]);

  const handlePersonaSelect = (group: PersonaGroup) => {
    setSelectedCharacterId(group.characterId);
    setSelectedRunId(group.sessions[0]?.runId ?? null);
    setDetail(null);
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  const handleClearLogs = async () => {
    if (clearing) return;

    const confirmed = window.confirm(
      "모든 유저, 대화 로그, 랭킹 기록을 완전히 삭제할까요?",
    );

    if (!confirmed) return;

    setClearing(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/sessions", { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        deletedRuns?: number;
        deletedPlayers?: number;
        error?: string;
      } | null;

      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "로그 삭제에 실패했습니다.");
      }

      setSessions([]);
      setSelectedCharacterId(null);
      setSelectedRunId(null);
      setDetail(null);
      setMessage(
        `대화 로그 ${payload.deletedRuns ?? 0}건과 유저 ${payload.deletedPlayers ?? 0}명의 기록을 모두 삭제했습니다.`,
      );
      await loadSessions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그 삭제에 실패했습니다.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-950 px-6 py-5 text-white">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">Persona Ops</p>
            <h1 className="mt-1 text-2xl font-bold">페르소나별 유저 모니터링</h1>
            <p className="mt-2 text-sm text-white/60">
              페르소나를 고르면 해당 과제를 수행한 유저와 현재 점수, 대화 내역을 확인합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
              홈으로
            </Link>
            <button onClick={handleLogout} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
              로그아웃
            </button>
          </div>
        </header>

        {message ? <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div> : null}

        <div className="space-y-4">
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div>
                <p className="font-semibold text-slate-900">관리자 로그 관리</p>
                <p className="mt-1 text-sm text-slate-500">
                  테스트/발표 전 서버에 저장된 유저, 대화 로그, 랭킹 기록을 전부 초기화합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearLogs}
                disabled={clearing}
                className="rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {clearing ? "삭제 중..." : "전체 로그 초기화"}
              </button>
            </section>

            <div className="grid gap-5 xl:grid-cols-[280px_360px_1fr]">
          <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">페르소나</h2>
              <span className="text-xs text-slate-400">{loading ? "로딩 중" : `${personaGroups.length}개`}</span>
            </div>

            <div className="mt-4 space-y-2">
              {personaGroups.length === 0 && !loading ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">아직 수행 기록이 없습니다.</p>
              ) : null}

              {personaGroups.map((group) => (
                <button
                  key={group.characterId}
                  onClick={() => handlePersonaSelect(group)}
                  className={`w-full rounded-2xl px-4 py-3 text-left ring-1 transition ${
                    selectedCharacterId === group.characterId
                      ? "bg-slate-900 text-white ring-slate-900"
                      : "bg-slate-50 ring-transparent hover:bg-slate-100"
                  }`}
                >
                  <p className="font-semibold">{group.characterName}</p>
                  <p className="mt-2 text-xs opacity-70">
                    유저 {group.sessions.length}명 · 진행 중 {group.activeCount}명
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">유저 목록</h2>
                <p className="mt-1 text-xs text-slate-400">{selectedGroup?.characterName ?? "페르소나를 선택하세요"}</p>
              </div>
              <span className="text-xs text-slate-400">{selectedGroup ? `${selectedGroup.sessions.length}명` : "-"}</span>
            </div>

            <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {selectedGroup?.sessions.map((session) => (
                <button
                  key={session.runId}
                  onClick={() => setSelectedRunId(session.runId)}
                  className={`w-full rounded-2xl px-4 py-3 text-left ring-1 transition ${
                    selectedRunId === session.runId
                      ? "bg-slate-900 text-white ring-slate-900"
                      : "bg-slate-50 ring-transparent hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{session.nickname}</p>
                      <p className="mt-0.5 text-[11px] opacity-60">ID {shortId(session.playerId)}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                        session.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"
                      }`}
                    >
                      {session.status === "completed" ? "완료" : "진행 중"}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <span>점수 {session.currentAffection}</span>
                    <span>턴 {session.turnsUsed}</span>
                    <span>메시지 {session.messageCount}</span>
                  </div>
                  <p className="mt-2 text-xs opacity-60">최근 {formatTime(session.lastMessageAt)}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            {!detail ? (
              <div className="flex min-h-[420px] items-center justify-center text-sm text-slate-500">
                유저를 선택하면 점수와 대화 내역이 표시됩니다.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-xl font-bold">
                      {detail.characterName} · {detail.nickname}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      시작 {formatTime(detail.startedAt)} · 최근 {formatTime(detail.lastMessageAt)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">유저 ID: {detail.playerId}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-400">상태</p>
                      <p className="font-bold">{detail.status === "completed" ? "완료" : "진행 중"}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-400">현재 점수</p>
                      <p className={`font-bold ${scoreTone(detail.currentAffection)}`}>{detail.currentAffection}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-400">턴</p>
                      <p className="font-bold">{detail.turnsUsed}</p>
                    </div>
                  </div>
                </div>

                <div className="max-h-[68vh] space-y-3 overflow-y-auto rounded-3xl bg-[#B2C7D9] p-4">
                  {detail.messages.map((message) => (
                    <div
                      key={`${message.messageIndex}-${message.timestamp}`}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                          message.role === "user" ? "bg-[#FEE500]" : "bg-white"
                        }`}
                      >
                        <p className="mb-1 text-[11px] font-semibold text-slate-400">
                          {message.role === "user" ? "사용자" : detail.characterName}
                        </p>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <p className="mt-1 text-right text-[11px] text-slate-400">{formatTime(message.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
            </div>
          </div>
      </div>
    </main>
  );
}
