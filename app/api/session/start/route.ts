import { NextResponse } from "next/server";
import * as z from "zod";

import { isDatabaseConfigured, startSession } from "@/lib/db";

const requestSchema = z.object({
  playerId: z.string().min(1),
  nickname: z.string().min(1).max(16),
  characterId: z.string().min(1),
  characterName: z.string().min(1),
  currentAffection: z.number().int().min(0).max(100),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());

    if (!isDatabaseConfigured()) {
      return NextResponse.json({
        synced: false,
        error: "POSTGRES_URL이 없어 서버 세션 시작을 건너뛰었습니다.",
      });
    }

    const { runId } = await startSession(body);

    return NextResponse.json({
      synced: true,
      runId,
      syncedAt: Date.now(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ synced: false, error: "잘못된 요청 형식입니다." }, { status: 400 });
    }

    return NextResponse.json({ synced: false, error: "세션 시작에 실패했습니다." }, { status: 500 });
  }
}
