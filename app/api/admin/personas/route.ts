import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getPersonas } from "@/lib/personas";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  try {
    const personas = await getPersonas();
    return NextResponse.json({ personas });
  } catch (error) {
    console.error("Failed to load admin personas", error);
    const detail = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: `페르소나 설정을 불러오지 못했습니다: ${detail}`, personas: [] },
      { status: 500 },
    );
  }
}
