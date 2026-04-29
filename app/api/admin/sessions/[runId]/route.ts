import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { deleteAdminSession, getAdminSessionDetail, isDatabaseConfigured } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "POSTGRES_URL이 없어 관리자 기록 조회가 비활성화되어 있습니다." },
      { status: 503 },
    );
  }

  const { runId } = await params;
  const session = await getAdminSessionDetail(runId);

  if (!session) {
    return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ session });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "POSTGRES_URL이 없어 삭제할 서버 기록이 없습니다." }, { status: 503 });
  }

  try {
    const { runId } = await params;
    const result = await deleteAdminSession(runId);

    if (!result.deleted) {
      return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, deletedRunId: runId });
  } catch (error) {
    console.error("Failed to delete admin session", error);
    const detail = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: `세션 삭제에 실패했습니다: ${detail}` }, { status: 500 });
  }
}
