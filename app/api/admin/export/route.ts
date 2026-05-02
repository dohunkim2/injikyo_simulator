import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminConversationExport, isDatabaseConfigured } from "@/lib/db";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "POSTGRES_URL이 없어 내보낼 서버 기록이 없습니다." },
      { status: 503 },
    );
  }

  try {
    const data = await getAdminConversationExport();
    const filename = `admin-conversation-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const body = JSON.stringify(data, null, 2);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Failed to export admin conversation logs", error);
    const detail = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: `내보내기에 실패했습니다: ${detail}` }, { status: 500 });
  }
}
