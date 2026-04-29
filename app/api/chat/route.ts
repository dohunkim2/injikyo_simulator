import { NextResponse } from "next/server";
import * as z from "zod";

import { openRouterChat } from "@/lib/api";
import { GAME } from "@/lib/constants";
import { getPersonaById } from "@/lib/personas";
import { buildSystemPrompt } from "@/lib/prompt-builder";
import { resolveTurnStatus } from "@/lib/scoring";
import { parseAIResponse } from "@/lib/status-parser";

export const maxDuration = 30;

const messageSchema = z.object({
  role: z.union([z.literal("user"), z.literal("assistant")]),
  content: z.string().min(1).max(GAME.MAX_MESSAGE_CHARS),
  timestamp: z.number().optional(),
});

const requestSchema = z.object({
  characterId: z.string().min(1),
  messages: z.array(messageSchema).max(GAME.MAX_MESSAGES_PER_REQUEST),
  newMessage: z.string().min(1).max(GAME.MAX_MESSAGE_CHARS),
  currentAffection: z.number().min(0).max(100),
  currentTurn: z.number().int().min(0),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const character = await getPersonaById(body.characterId);

    if (!character) {
      return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
    }

    const messages = [
      {
        role: "system" as const,
        content: buildSystemPrompt(character, body.currentTurn, body.currentAffection),
      },
      ...body.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      { role: "user" as const, content: body.newMessage },
    ];

    const requestPayload = {
      messages,
      max_tokens: GAME.AI_MAX_TOKENS,
      temperature: GAME.AI_TEMPERATURE,
    };

    const raw = await openRouterChat({
      model: character.model,
      ...requestPayload,
    }).catch((error) => {
      if (character.model === GAME.CHAT_MODEL_BACKUP) {
        throw error;
      }

      console.error("Primary chat model failed, retrying backup model", error);
      return openRouterChat({
        model: GAME.CHAT_MODEL_BACKUP,
        ...requestPayload,
      });
    });

    const { message, aiStatus } = parseAIResponse(raw);
    const status = resolveTurnStatus({
      character,
      previousAffection: body.currentAffection,
      change: aiStatus.change,
      status: aiStatus.status,
      nextTurn: body.currentTurn + 1,
      userMessage: body.newMessage,
    });

    return NextResponse.json({ message, status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
    }

    console.error("Chat API failed", error);
    const detail = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: `채팅 요청 처리에 실패했습니다: ${detail}` }, { status: 500 });
  }
}
