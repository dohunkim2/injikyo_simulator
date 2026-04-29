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
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
    finish_reason?: string;
  }>;
  error?: {
    message?: string;
  };
};

import { GAME } from "./constants";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(response: Response, fallbackMs: number) {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return fallbackMs;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(5_000, Math.max(fallbackMs, seconds * 1000));
  }

  const retryDate = Date.parse(retryAfter);
  if (Number.isFinite(retryDate)) {
    return Math.min(5_000, Math.max(fallbackMs, retryDate - Date.now()));
  }

  return fallbackMs;
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function isTimeoutError(error: unknown) {
  return error instanceof DOMException && error.name === "TimeoutError";
}

export async function openRouterChat(payload: OpenRouterPayload): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const {
    timeoutMs,
    maxRetries = GAME.OPENROUTER_MAX_RETRIES,
    retryDelayMs = GAME.OPENROUTER_RETRY_DELAY_MS,
    ...openRouterPayload
  } = payload;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY가 설정되지 않았습니다.");
  }

  const attempts = Math.max(1, maxRetries + 1);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL ?? "https://vercel.app",
          "X-Title": "dating-sim",
        },
        body: JSON.stringify(openRouterPayload),
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs ?? GAME.OPENROUTER_TIMEOUT_MS),
      });

      const data = (await response.json().catch(() => ({}))) as OpenRouterResponse;

      if (!response.ok) {
        const message = data.error?.message ?? `OpenRouter 호출에 실패했습니다. status=${response.status}`;
        const canRetry = attempt < attempts && shouldRetryStatus(response.status);
        if (canRetry) {
          const delayMs = getRetryDelay(response, retryDelayMs);
          console.warn(
            `[openrouter] model=${payload.model} attempt=${attempt}/${attempts} status=${response.status} retryIn=${delayMs}ms message=${message}`,
          );
          await wait(delayMs);
          continue;
        }

        throw new Error(message);
      }

      const choice = data.choices?.[0];
      const content = choice?.message?.content;

      if (!content) {
        throw new Error(
          `OpenRouter 응답에서 메시지를 찾을 수 없습니다.${choice?.finish_reason ? ` finish_reason=${choice.finish_reason}` : ""}`,
        );
      }

      return content;
    } catch (error) {
      lastError = error;
      const canRetry = attempt < attempts && (isTimeoutError(error) || error instanceof TypeError);
      if (!canRetry) break;

      console.warn(
        `[openrouter] model=${payload.model} attempt=${attempt}/${attempts} networkOrTimeout retryIn=${retryDelayMs}ms`,
        error,
      );
      await wait(retryDelayMs);
    }
  }

  if (isTimeoutError(lastError)) {
    throw new Error("AI 응답 시간이 초과되었습니다.");
  }

  throw lastError instanceof Error ? lastError : new Error("OpenRouter 호출에 실패했습니다.");
}
