import { NextResponse } from "next/server";

import { getLeaderboardByCharacter, isDatabaseConfigured } from "@/lib/db";

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({
        configured: false,
        characters: [],
        message: "POSTGRES_URL이 없어 공용 랭킹이 비활성화되어 있습니다.",
      });
    }

    const characters = await getLeaderboardByCharacter();
    const totalEntries = characters.reduce((sum, group) => sum + group.entries.length, 0);

    return NextResponse.json({
      configured: true,
      characters,
      message: totalEntries === 0 ? "완료된 서버 저장 기록이 아직 없습니다." : undefined,
    });
  } catch (error) {
    console.error("Leaderboard load failed", error);
    return NextResponse.json(
      {
        configured: false,
        characters: [],
        message: error instanceof Error ? error.message : "랭킹을 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
