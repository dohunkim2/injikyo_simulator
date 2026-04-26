import { GAME, DEFAULT_STATUS_MESSAGE } from "./constants";
import type { AIStatusPayload } from "./types";

function clampChange(value: number) {
  return Math.max(
    -GAME.MAX_AFFECTION_CHANGE_PER_TURN,
    Math.min(GAME.MAX_AFFECTION_CHANGE_PER_TURN, Math.round(value)),
  );
}

export function parseAIResponse(raw: string): {
  message: string;
  aiStatus: AIStatusPayload;
} {
  const statusPattern = /(?:\|\|\|\s*)?STATUS:\s*(\{[\s\S]*?\})(?:\s*\|\|\|)?/;
  const statusMatch = raw.match(statusPattern);
  const message = raw.replace(statusPattern, "").trim();

  if (!statusMatch) {
    return {
      message: message || raw.trim(),
      aiStatus: { change: 0, status: DEFAULT_STATUS_MESSAGE },
    };
  }

  try {
    const parsed = JSON.parse(statusMatch[1]) as Partial<AIStatusPayload>;

    return {
      message: message || "…",
      aiStatus: {
        change: clampChange(Number(parsed.change ?? 0)),
        status:
          typeof parsed.status === "string" && parsed.status.trim().length > 0
            ? parsed.status.trim()
            : DEFAULT_STATUS_MESSAGE,
      },
    };
  } catch {
    return {
      message: message || raw.trim(),
      aiStatus: { change: 0, status: DEFAULT_STATUS_MESSAGE },
    };
  }
}
