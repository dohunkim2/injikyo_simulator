import { NextResponse } from "next/server";
import * as z from "zod";

import { getActiveSessionForPlayer, isDatabaseConfigured } from "@/lib/db";

const querySchema = z.object({
  playerId: z.string().min(1),
  characterId: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.parse({
      playerId: url.searchParams.get("playerId") ?? "",
      characterId: url.searchParams.get("characterId") ?? "",
    });

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ configured: false, session: null });
    }

    const session = await getActiveSessionForPlayer(parsed.playerId, parsed.characterId);
    return NextResponse.json({ configured: true, session });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ configured: false, session: null, error: "잘못된 요청입니다." }, { status: 400 });
    }

    console.error("Active session lookup failed", error);
    const detail = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { configured: false, session: null, error: `세션 조회에 실패했습니다: ${detail}` },
      { status: 500 },
    );
  }
}
