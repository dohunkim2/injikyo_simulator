import { NextResponse } from "next/server";
import { z } from "zod";

import { openRouterChat } from "@/lib/api";
import { getCharacterById } from "@/lib/characters";
import { GAME } from "@/lib/constants";
import type { CharacterFeedback, Message } from "@/lib/types";

const requestSchema = z.object({
  characterId: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.union([z.literal("user"), z.literal("assistant")]),
      content: z.string().min(1),
      timestamp: z.number().optional(),
    }),
  ),
  success: z.boolean(),
  finalAffection: z.number(),
  turnsUsed: z.number().int().min(0),
});

function fallbackFeedback(args: {
  characterId: string;
  success: boolean;
  finalAffection: number;
  turnsUsed: number;
  messages: Message[];
}): CharacterFeedback {
  const userLines = args.messages.filter((message) => message.role === "user");

  return {
    characterId: args.characterId,
    success: args.success,
    finalAffection: args.finalAffection,
    turnsUsed: args.turnsUsed,
    bestLine: userLines[0]?.content ?? "대화를 시작했다",
    worstLine: userLines[userLines.length - 1]?.content ?? "아쉽게 흐름이 끊겼다",
    summary: args.success ? "분위기를 잘 끌어올린 공략" : "가능성은 있었지만 마무리가 아쉬움",
  };
}

function extractJsonBlock(raw: string) {
  const match = raw.match(/\{[\s\S]*\}/);
  return match?.[0];
}

function normalizeMessages(messages: z.infer<typeof requestSchema>["messages"]): Message[] {
  return messages.map((message) => ({
    ...message,
    timestamp: message.timestamp ?? Date.now(),
  }));
}

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema> | null = null;

  try {
    body = requestSchema.parse(await request.json());
    const character = getCharacterById(body.characterId);

    if (!character) {
      return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
    }

    const formattedMessages = body.messages
      .map((message) => `${message.role === "user" ? "사용자" : character.name}: ${message.content}`)
      .join("\n");

    const raw = await openRouterChat({
      model: GAME.FEEDBACK_MODEL,
      messages: [
        {
          role: "system",
          content: "당신은 연애 시뮬레이션 코치입니다. 반드시 JSON만 반환하세요.",
        },
        {
          role: "user",
          content: `아래는 연애 시뮬레이션에서 사용자와 "${character.name}"의 대화입니다.
미션: ${character.mission}
결과: ${body.success ? "성공" : "실패"} (최종 호감도 ${body.finalAffection}/100)

[대화 내역]
${formattedMessages}

아래 JSON으로만 응답하세요. JSON 외 다른 텍스트 없이:
{
  "summary": "한줄 요약 (20자 이내)",
  "bestLine": "사용자의 가장 좋았던 발언 원문",
  "worstLine": "사용자의 가장 안 좋았던 발언 원문"
}`,
        },
      ],
      max_tokens: GAME.AI_MAX_TOKENS,
      temperature: 0.6,
    });

    const jsonBlock = extractJsonBlock(raw);

    if (!jsonBlock) {
      return NextResponse.json(
        fallbackFeedback({
          characterId: body.characterId,
          success: body.success,
          finalAffection: body.finalAffection,
          turnsUsed: body.turnsUsed,
          messages: normalizeMessages(body.messages),
        }),
      );
    }

    const parsed = JSON.parse(jsonBlock) as Pick<
      CharacterFeedback,
      "summary" | "bestLine" | "worstLine"
    >;

    return NextResponse.json({
      characterId: body.characterId,
      success: body.success,
      finalAffection: body.finalAffection,
      turnsUsed: body.turnsUsed,
      summary: parsed.summary,
      bestLine: parsed.bestLine,
      worstLine: parsed.worstLine,
    } satisfies CharacterFeedback);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
    }

    if (body) {
      return NextResponse.json(
        fallbackFeedback({
          characterId: body.characterId,
          success: body.success,
          finalAffection: body.finalAffection,
          turnsUsed: body.turnsUsed,
          messages: normalizeMessages(body.messages ?? []),
        }),
      );
    }

    return NextResponse.json({ error: "피드백 생성에 실패했습니다." }, { status: 500 });
  }
}
