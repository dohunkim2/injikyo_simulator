type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterPayload = {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: unknown;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

import { GAME } from "./constants";

export async function openRouterChat(payload: OpenRouterPayload): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY가 설정되지 않았습니다.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL ?? "https://vercel.app",
      "X-Title": "dating-sim",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(GAME.OPENROUTER_TIMEOUT_MS),
  }).catch((error) => {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("AI 응답 시간이 초과되었습니다.");
    }

    throw error;
  });

  const data = (await response.json()) as OpenRouterResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? "OpenRouter 호출에 실패했습니다.");
  }

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenRouter 응답에서 메시지를 찾을 수 없습니다.");
  }

  return content;
}
