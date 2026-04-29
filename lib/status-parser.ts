import { GAME, DEFAULT_STATUS_MESSAGE } from "./constants";
import type { AIStatusPayload } from "./types";

function clampChange(value: number) {
  return Math.max(
    -GAME.MAX_AFFECTION_CHANGE_PER_TURN,
    Math.min(GAME.MAX_AFFECTION_CHANGE_PER_TURN, Math.round(value)),
  );
}

function sanitizeMessage(message: string) {
  return message
    .replace(/[\s\n\r]*[([{（][^()[\]{}（）]*[\])}）][\s\n\r]*/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildAIStatus(parsed: Partial<AIStatusPayload>): AIStatusPayload {
  return {
    change: clampChange(Number(parsed.change ?? 0)),
    status:
      typeof parsed.status === "string" && parsed.status.trim().length > 0
        ? parsed.status.trim()
        : DEFAULT_STATUS_MESSAGE,
  };
}

export function parseAIResponse(raw: string): {
  message: string;
  aiStatus: AIStatusPayload;
} {
  // 1순위: 정식 포맷 (|||STATUS:{...}||| 또는 STATUS:{...})
  const strictPattern = /(?:\|\|\|\s*)?STATUS:\s*(\{[\s\S]*?\})(?:\s*\|\|\|)?/;
  const strictMatch = raw.match(strictPattern);
  if (strictMatch) {
    try {
      const parsed = JSON.parse(strictMatch[1]) as Partial<AIStatusPayload>;
      const message = sanitizeMessage(raw.replace(strictPattern, "").trim());
      return { message: message || "…", aiStatus: buildAIStatus(parsed) };
    } catch {
      // JSON 파싱 실패 시 폴백으로 이어짐
    }
  }

  // 2순위: change 키를 포함한 임의의 JSON 객체 (모델이 ||| 빠뜨리거나 코드펜스로 감싼 경우)
  const jsonObjectPattern = /\{[^{}]*?"change"\s*:\s*-?\d+[^{}]*?\}/;
  const jsonMatch = raw.match(jsonObjectPattern);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<AIStatusPayload>;
      const message = sanitizeMessage(raw.replace(jsonMatch[0], "").replace(/```(?:json)?/gi, "").trim());
      return { message: message || "…", aiStatus: buildAIStatus(parsed) };
    } catch {
      // 다음 폴백
    }
  }

  // 3순위: 본문 어딘가에 "change": N과 "status": "..."가 흩어져 있는 경우
  const changeMatch = raw.match(/"change"\s*:\s*(-?\d+)/);
  if (changeMatch) {
    const statusMatch = raw.match(/"status"\s*:\s*"([^"]*)"/);
    const message = sanitizeMessage(
      raw
        .replace(/"change"\s*:\s*-?\d+\s*,?/g, "")
        .replace(/"status"\s*:\s*"[^"]*"\s*,?/g, "")
        .replace(/[{}|`]/g, "")
        .replace(/STATUS:?/gi, "")
        .trim(),
    );
    return {
      message: message || "…",
      aiStatus: buildAIStatus({
        change: Number(changeMatch[1]),
        status: statusMatch?.[1],
      }),
    };
  }

  // 모든 폴백 실패: 메시지만 살리고 change 0 반환
  return {
    message: sanitizeMessage(raw.trim()) || raw.trim(),
    aiStatus: { change: 0, status: DEFAULT_STATUS_MESSAGE },
  };
}
