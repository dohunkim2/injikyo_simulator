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
import type { Character, CharacterFeedback, ChatState, Message, SessionSaveStatus, StatusUpdate } from "@/lib/types";
import { createInitialChatState } from "@/lib/utils";

type ChatApiResponse = {
  message: string;
  status: StatusUpdate;
};

type SessionStartResponse = SessionSaveStatus;

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
  const [headerImage, setHeaderImage] = useState(character.profileImage);
  const bottomRef = useRef<HTMLDivElement | null>(null);

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

  const ensureServerRunId = async (state: ChatState) => {
    if (state.serverRunId) {
      return state.serverRunId;
    }

    const playerProfile = storage.getOrCreatePlayerProfile();
    const response = await fetch("/api/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: playerProfile.playerId,
        nickname: playerProfile.nickname,
        characterId: character.id,
        characterName: character.name,
        currentAffection: state.affection,
      }),
    });

    const payload = (await response.json().catch(() => null)) as SessionStartResponse | null;

    if (!response.ok || !payload?.synced || !payload.runId) {
      return undefined;
    }

    return payload.runId;
  };

  const appendServerMessage = async (args: {
    runId?: string;
    message: Message;
    messageIndex: number;
    currentAffection: number;
    turnsUsed: number;
  }) => {
    if (!args.runId) return;

    await fetch("/api/session/append", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: args.runId,
        role: args.message.role,
        content: args.message.content,
        timestamp: args.message.timestamp,
        messageIndex: args.messageIndex,
        currentAffection: args.currentAffection,
        turnsUsed: args.turnsUsed,
      }),
    }).catch(() => null);
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
    let activeRunId = chatState.serverRunId;

    try {
      const runId = await ensureServerRunId(chatState);
      activeRunId = runId;
      const pendingState = { ...chatState, serverRunId: runId, messages: nextMessages };
      setChatState(pendingState);
      storage.saveChatState(character.id, pendingState);

      await appendServerMessage({
        runId,
        message: userMessage,
        messageIndex: previousMessages.length,
        currentAffection: chatState.affection,
        turnsUsed: chatState.turnCount,
      });

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
        serverRunId: runId,
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
      await appendServerMessage({
        runId,
        message: assistantMessage,
        messageIndex: nextMessages.length,
        currentAffection: nextState.affection,
        turnsUsed: nextState.turnCount,
      });
      setToastValue(payload.status.change);

      if (payload.status.gameOver) {
        setShowGameOver(true);
        void finishGame(finalMessages, nextState);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "메시지 전송에 실패했습니다.");
      const restoredState = { ...chatState, serverRunId: activeRunId, messages: previousMessages };
      setChatState(restoredState);
      storage.saveChatState(character.id, restoredState);
    } finally {
      setTyping(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-[#B2C7D9] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 bg-[#a9bfd2] px-4 py-3 shadow-sm">
          <button
            onClick={() => router.push("/")}
            className="rounded-full bg-white/70 p-2 text-slate-700"
            aria-label="뒤로가기"
          >
            <ChevronLeft size={18} />
          </button>
          <Image
            src={headerImage}
            alt={character.name}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full bg-white/70 object-cover"
            onError={() => setHeaderImage("/characters/default-avatar.svg")}
          />
          <div>
            <p className="font-semibold">{character.name}</p>
            <p className="text-xs text-slate-600">{character.occupation}</p>
          </div>
        </header>

        <div className="sticky top-[68px] z-10 space-y-2 px-4 py-3">
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

        <section className="flex-1 space-y-4 px-4 pb-6 pt-2">
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
              characterImage={character.profileImage}
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
                characterImage={character.profileImage}
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
