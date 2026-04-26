import { NextResponse } from "next/server";
import { z } from "zod";

import { openRouterChat } from "@/lib/api";
import { getCharacterById } from "@/lib/characters";
import { GAME } from "@/lib/constants";
import { buildSystemPrompt } from "@/lib/prompt-builder";
import { resolveTurnStatus } from "@/lib/scoring";
import { parseAIResponse } from "@/lib/status-parser";

const messageSchema = z.object({
  role: z.union([z.literal("user"), z.literal("assistant")]),
  content: z.string().min(1),
  timestamp: z.number().optional(),
});

const requestSchema = z.object({
  characterId: z.string().min(1),
  messages: z.array(messageSchema),
  newMessage: z.string().min(1),
  currentAffection: z.number(),
  currentTurn: z.number().int().min(0),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const character = getCharacterById(body.characterId);

    if (!character) {
      return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
    }

    const raw = await openRouterChat({
      model: character.model,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(character, body.currentTurn, body.currentAffection),
        },
        ...body.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        { role: "user", content: body.newMessage },
      ],
      max_tokens: GAME.AI_MAX_TOKENS,
      temperature: GAME.AI_TEMPERATURE,
    });

    const { message, aiStatus } = parseAIResponse(raw);
    const status = resolveTurnStatus({
      character,
      previousAffection: body.currentAffection,
      change: aiStatus.change,
      status: aiStatus.status,
      nextTurn: body.currentTurn + 1,
    });

    return NextResponse.json({ message, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "채팅 요청 처리에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
