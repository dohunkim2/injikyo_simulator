import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { buildAdminInbodyImageZip } from "@/lib/admin-inbody-export";
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
    const { archive, imageCount, skippedCount } = await buildAdminInbodyImageZip(data);
    const filename = `admin-inbody-images-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;

    return new NextResponse(archive, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Inbody-Image-Count": `${imageCount}`,
        "X-Inbody-Skipped-Count": `${skippedCount}`,
      },
    });
  } catch (error) {
    console.error("Failed to export admin inbody images", error);
    const detail = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: `인바디 이미지 내보내기에 실패했습니다: ${detail}` }, { status: 500 });
  }
}
