import { NextResponse } from "next/server";
import * as z from "zod";

import { appendSessionMessage, isDatabaseConfigured } from "@/lib/db";

const requestSchema = z.object({
  runId: z.string().uuid(),
  role: z.union([z.literal("user"), z.literal("assistant")]),
  content: z.string().min(1).max(1200),
  timestamp: z.number(),
  messageIndex: z.number().int().min(0),
  currentAffection: z.number().int().min(0).max(100),
  turnsUsed: z.number().int().min(0),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());

    if (!isDatabaseConfigured()) {
      return NextResponse.json({
        synced: false,
        error: "POSTGRES_URL이 없어 서버 메시지 저장을 건너뛰었습니다.",
      });
    }

    await appendSessionMessage(body);

    return NextResponse.json({
      synced: true,
      syncedAt: Date.now(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ synced: false, error: "잘못된 요청 형식입니다." }, { status: 400 });
    }

    return NextResponse.json({ synced: false, error: "메시지 저장에 실패했습니다." }, { status: 500 });
  }
}
