"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AffectionToast } from "@/components/chat/AffectionToast";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { AffectionGauge } from "@/components/game/AffectionGauge";
import { GameOverModal } from "@/components/game/GameOverModal";
import { StatusMessage } from "@/components/game/StatusMessage";
import { TurnCounter } from "@/components/game/TurnCounter";
import { getCharacterById } from "@/lib/characters";
import { storage } from "@/lib/storage";
import type {
  Character,
  CharacterFeedback,
  CharacterImageStage,
  ChatState,
  Message,
  SessionSaveStatus,
  StatusUpdate,
} from "@/lib/types";
import { createInitialChatState } from "@/lib/utils";

type ChatApiResponse = {
  message: string;
  status: StatusUpdate;
};

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function ChatPage() {
  const params = useParams<{ characterId: string }>();
  const defaultCharacter = useMemo(
    () => getCharacterById(params.characterId ?? ""),
    [params.characterId],
  );
  const [character, setCharacter] = useState<Character | null>(defaultCharacter);

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

  if (!character) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#B2C7D9] p-6 text-center">
        <div className="rounded-3xl bg-white p-6 shadow-lg">
          <p className="text-lg font-semibold text-slate-900">존재하지 않는 캐릭터예요.</p>
          <Link href="/" className="mt-4 inline-block rounded-full bg-slate-900 px-5 py-3 text-white">
            홈으로 가기
          </Link>
        </div>
      </main>
    );
  }

  return <ChatScreen key={character.id} character={character} />;
}

function ChatScreen({ character }: { character: Character }) {
  const router = useRouter();
  const [chatState, setChatState] = useState<ChatState>(() => createInitialChatState(character));
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const [toastValue, setToastValue] = useState<number | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [sceneImage, setSceneImage] = useState(character.profileImage);
  const [accessKeyword, setAccessKeyword] = useState("");
  const [accessError, setAccessError] = useState("");
  const [accessLoading, setAccessLoading] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const currentImageStage = useMemo(
    () => getImageStage(character, chatState.affection),
    [character, chatState.affection],
  );

  useEffect(() => {
    queueMicrotask(() => {
      const saved = storage.load()?.characters[character.id]?.chatState;
      const nextState = saved ?? createInitialChatState(character);

      if (!saved) {
        storage.saveChatState(character.id, nextState);
      }

      setChatState(nextState);
      setShowGameOver(nextState.isGameOver);
    });
  }, [character]);

  useEffect(() => {
    if (toastValue === null) return;
    const timeout = window.setTimeout(() => setToastValue(null), 1200);
    return () => window.clearTimeout(timeout);
  }, [toastValue]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatState.messages.length, typing, error]);

  useEffect(() => {
    setSceneImage(currentImageStage.image);
  }, [currentImageStage.image]);

  const handleUnlock = async () => {
    setAccessLoading(true);
    setAccessError("");

    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "chat",
          characterId: character.id,
          keyword: accessKeyword,
        }),
      });

      if (!response.ok) {
        setAccessError("비밀 키워드가 올바르지 않습니다.");
        return;
      }

      setUnlocked(true);
      setAccessKeyword("");
    } catch {
      setAccessError("비밀 키워드를 확인하지 못했습니다.");
    } finally {
      setAccessLoading(false);
    }
  };

  const finishGame = async (messages: Message[], nextState: ChatState) => {
    try {
      const playerProfile = storage.getOrCreatePlayerProfile();
      const feedbackResponse = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: character.id,
          messages,
          success: nextState.isSuccess,
          finalAffection: nextState.affection,
          turnsUsed: nextState.turnCount,
        }),
      });

      if (feedbackResponse.ok) {
        const feedback = (await feedbackResponse.json()) as CharacterFeedback;
        storage.saveFeedback(character.id, feedback);
      }

      const syncResponse = await fetch("/api/session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: playerProfile.playerId,
          nickname: playerProfile.nickname,
          runId: nextState.serverRunId,
          characterId: character.id,
          characterName: character.name,
          success: nextState.isSuccess,
          finalAffection: nextState.affection,
          turnsUsed: nextState.turnCount,
          messages,
        }),
      });

      const serverSync = (await syncResponse.json().catch(() => ({
        synced: false,
        error: "서버 저장 응답을 읽지 못했습니다.",
      }))) as SessionSaveStatus;

      storage.saveServerSync(character.id, {
        ...serverSync,
        syncedAt: serverSync.syncedAt ?? Date.now(),
      });
    } catch {
      storage.saveServerSync(character.id, {
        synced: false,
        error: "서버 저장에 실패했습니다.",
        syncedAt: Date.now(),
      });
    }
  };

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || typing || chatState.isGameOver) return;

    setError("");
    setTyping(true);

    const userMessage: Message = {
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };

    const previousMessages = chatState.messages;
    const nextMessages = [...previousMessages, userMessage];
    setChatState((current) => (current ? { ...current, messages: nextMessages } : current));
    setInput("");

    try {
      const pendingState = { ...chatState, messages: nextMessages };
      setChatState(pendingState);
      storage.saveChatState(character.id, pendingState);

      const requestStartedAt = Date.now();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: character.id,
          messages: previousMessages,
          newMessage: trimmed,
          currentAffection: chatState.affection,
          currentTurn: chatState.turnCount,
        }),
      });
      const elapsed = Date.now() - requestStartedAt;
      const minimumTypingMs = 1100;

      if (elapsed < minimumTypingMs) {
        await wait(minimumTypingMs - elapsed);
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "응답을 불러오지 못했습니다.");
      }

      const payload = (await response.json()) as ChatApiResponse;
      const assistantMessage: Message = {
        role: "assistant",
        content: payload.message,
        timestamp: Date.now(),
      };

      const finalMessages = [...nextMessages, assistantMessage];
      const nextState: ChatState = {
        ...chatState,
        messages: finalMessages,
        affection: payload.status.affection,
        turnCount: chatState.turnCount + 1,
        isSuccess: payload.status.success,
        isGameOver: payload.status.gameOver,
        lastChange: payload.status.change,
        statusMessage: payload.status.status,
        endedAt: payload.status.gameOver ? Date.now() : undefined,
      };

      setChatState(nextState);
      storage.saveChatState(character.id, nextState);
      setToastValue(payload.status.change);

      if (payload.status.gameOver) {
        setShowGameOver(true);
        void finishGame(finalMessages, nextState);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "메시지 전송에 실패했습니다.");
      const restoredState = { ...chatState, messages: previousMessages };
      setChatState(restoredState);
      storage.saveChatState(character.id, restoredState);
    } finally {
      setTyping(false);
    }
  };

  if (!unlocked) {
    return (
      <AccessGate
        value={accessKeyword}
        error={accessError}
        loading={accessLoading}
        onChange={(value) => {
          setAccessKeyword(value);
          setAccessError("");
        }}
        onSubmit={handleUnlock}
      />
    );
  }

  return (
    <main className="relative h-screen overflow-hidden bg-slate-900 text-slate-900">
      <div className="mx-auto grid h-screen max-w-7xl gap-0 lg:grid-cols-[minmax(320px,0.9fr)_minmax(420px,1.1fr)]">
        <aside className="relative hidden h-screen flex-col justify-end overflow-hidden bg-slate-950 p-5 text-white lg:flex lg:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#38bdf8_0,transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.2),rgba(15,23,42,0.95))]" />
          <Image
            src={sceneImage}
            alt={character.name}
            fill
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-contain object-center opacity-85"
            priority
            onError={() => setSceneImage("/characters/default-avatar.svg")}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/10" />
          <div className="relative z-10 rounded-[2rem] bg-white/10 p-5 shadow-2xl ring-1 ring-white/15 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
              {currentImageStage.label}
            </p>
            <h1 className="mt-3 text-3xl font-black">{character.name}</h1>
            <p className="mt-1 text-sm text-white/65">{character.occupation}</p>
            <p className="mt-4 max-h-32 overflow-y-auto text-sm leading-6 text-white/75 lg:max-h-40">
              {character.situation}
            </p>
          </div>
        </aside>

        <div className="flex h-screen min-h-0 flex-col bg-[#B2C7D9]">
        <header className="z-10 flex shrink-0 items-center gap-3 bg-[#a9bfd2] px-4 py-3 shadow-sm">
          <button
            onClick={() => router.push("/")}
            className="rounded-full bg-white/70 p-2 text-slate-700"
            aria-label="뒤로가기"
          >
            <ChevronLeft size={18} />
          </button>
          <Link href="/" className="rounded-full bg-white/60 px-3 py-2 text-xs font-semibold text-slate-700">
            홈
          </Link>
          <Image
            src={sceneImage}
            alt={character.name}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full bg-white/70 object-cover"
            onError={() => setSceneImage("/characters/default-avatar.svg")}
          />
          <div>
            <p className="font-semibold">{character.name}</p>
            <p className="text-xs text-slate-600">{character.occupation}</p>
          </div>
        </header>

        <div className="z-10 shrink-0 space-y-2 px-4 py-3">
          <StatusMessage message={chatState.statusMessage} />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <AffectionGauge
              affection={chatState.affection}
              change={chatState.lastChange}
              label={character.scoreLabel}
            />
            <TurnCounter turnCount={chatState.turnCount} maxTurns={chatState.maxTurns} />
          </div>
        </div>

        <section className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6 pt-2">
          <div className="mx-auto w-fit rounded-full bg-black/10 px-3 py-1 text-xs text-slate-700">
            오늘
          </div>
          <div className="mx-auto max-w-[85%] rounded-2xl bg-[#9FB4C7]/80 px-4 py-3 text-center text-xs leading-5 text-slate-700">
            {character.name}님과의 대화가 시작되었습니다. 과제는 <b>{character.mission}</b>입니다.
          </div>
          {character.openingLine && chatState.messages.length === 0 ? (
            <ChatBubble
              message={{
                role: "assistant",
                content: character.openingLine,
                timestamp: chatState.startedAt,
              }}
              characterName={character.name}
              characterImage={sceneImage}
            />
          ) : null}
          {chatState.messages.length === 0 ? (
            <div className="mx-auto max-w-[85%] rounded-2xl bg-white/70 px-4 py-3 text-center text-xs leading-5 text-slate-600">
              상황: {character.situation}
            </div>
          ) : null}

          {chatState.messages.map((message, index) => {
            const previous = chatState.messages[index - 1];
            const next = chatState.messages[index + 1];
            const showProfile = message.role === "assistant" && previous?.role !== "assistant";
            const showTime = next?.role !== message.role;

            return (
              <ChatBubble
                key={`${message.timestamp}-${index}`}
                message={message}
                characterName={character.name}
                characterImage={sceneImage}
                showProfile={showProfile}
                showTime={showTime}
              />
            );
          })}

          {typing ? <TypingIndicator /> : null}

          {error ? (
            <div className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}
          <div ref={bottomRef} />
        </section>

        <ChatInput
          value={input}
          disabled={typing || chatState.isGameOver}
          onChange={setInput}
          onSubmit={handleSubmit}
        />
        </div>
      </div>

      {toastValue !== null ? <AffectionToast value={toastValue} /> : null}
      <GameOverModal
        open={showGameOver}
        success={chatState.isSuccess}
        characterId={character.id}
        onClose={() => setShowGameOver(false)}
      />
    </main>
  );
}

function AccessGate({
  value,
  error,
  loading,
  onChange,
  onSubmit,
}: {
  value: string;
  error: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-900">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="w-full max-w-sm rounded-[2rem] bg-white p-6 text-center shadow-2xl"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Private Session</p>
        <h1 className="mt-3 text-2xl font-black text-slate-950">비밀 키워드 입력</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          발표 자료에 안내된 키워드를 입력해야 대화를 시작할 수 있습니다.
        </p>
        <input
          value={value}
          type="password"
          autoComplete="off"
          disabled={loading}
          onChange={(event) => onChange(event.target.value)}
          placeholder="비밀 키워드"
          className="mt-5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-center text-base font-semibold outline-none focus:border-slate-900"
        />
        {error ? <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p> : null}
        <div className="mt-5 flex gap-2">
          <Link
            href="/"
            className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            홈으로
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
          >
            {loading ? "확인 중" : "입장"}
          </button>
        </div>
      </form>
    </main>
  );
}

function getImageStage(character: Character, score: number): CharacterImageStage {
  const stages = character.imageStages?.length
    ? [...character.imageStages].sort((a, b) => a.minScore - b.minScore)
    : [
        {
          minScore: 0,
          image: character.profileImage,
          label: "현재 페르소나",
        },
      ];

  return stages.reduce<CharacterImageStage>(
    (selected, stage) => (score >= stage.minScore ? stage : selected),
    stages[0],
  );
}
