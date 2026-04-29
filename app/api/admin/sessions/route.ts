import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { clearAdminConversationLogs, getAdminSessions, isDatabaseConfigured } from "@/lib/db";

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
  } catch (error) {
    console.error("Failed to load admin sessions", error);
    const detail = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { configured: false, sessions: [], message: `세션 목록을 불러오지 못했습니다: ${detail}` },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "POSTGRES_URL이 없어 삭제할 서버 기록이 없습니다." }, { status: 503 });
  }

  try {
    const result = await clearAdminConversationLogs();
    return NextResponse.json({ ok: true, deletedRuns: result.deletedRuns });
  } catch (error) {
    console.error("Failed to clear admin sessions", error);
    const detail = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: `세션 기록 삭제에 실패했습니다: ${detail}` }, { status: 500 });
  }
}
