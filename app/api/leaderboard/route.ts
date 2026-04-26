import { NextResponse } from "next/server";

import { getLeaderboard, isDatabaseConfigured } from "@/lib/db";

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({
        configured: false,
        entries: [],
        message: "POSTGRES_URL이 없어 공용 랭킹이 비활성화되어 있습니다.",
      });
    }

    const entries = await getLeaderboard(10);

    return NextResponse.json({
      configured: true,
      entries,
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: false,
        entries: [],
        message: error instanceof Error ? error.message : "랭킹을 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
