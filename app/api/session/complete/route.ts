import { NextResponse } from "next/server";
import * as z from "zod";

import { GAME } from "@/lib/constants";
import { isDatabaseConfigured, saveCompletedSession } from "@/lib/db";

const requestSchema = z.object({
  runId: z.string().uuid().optional(),
  playerId: z.string().min(1),
  nickname: z.string().min(1).max(16),
  characterId: z.string().min(1),
  characterName: z.string().min(1),
  success: z.boolean(),
  finalAffection: z.number().int().min(0).max(100),
  turnsUsed: z.number().int().min(0),
  messages: z.array(
    z.object({
      role: z.union([z.literal("user"), z.literal("assistant")]),
      content: z.string().min(1).max(GAME.MAX_STORED_MESSAGE_CHARS),
      timestamp: z.number(),
    }),
  ),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());

    if (!isDatabaseConfigured()) {
      return NextResponse.json({
        synced: false,
        error: "POSTGRES_URL이 없어 서버 랭킹 저장을 건너뛰었습니다.",
      });
    }

    const { runId } = await saveCompletedSession(body);

    return NextResponse.json({
      synced: true,
      runId,
      syncedAt: Date.now(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ synced: false, error: "잘못된 요청 형식입니다." }, { status: 400 });
    }

    return NextResponse.json(
      {
        synced: false,
        error: "세션 저장에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
