import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminSessions, isDatabaseConfigured } from "@/lib/db";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      sessions: [],
      message: "POSTGRES_URL이 없어 관리자 기록 조회가 비활성화되어 있습니다.",
    });
  }

  try {
    const sessions = await getAdminSessions(50);
    return NextResponse.json({ configured: true, sessions });
  } catch {
    return NextResponse.json(
      { configured: false, sessions: [], message: "세션 목록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
