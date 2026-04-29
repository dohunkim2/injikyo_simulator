import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getPersonas } from "@/lib/personas";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  const personas = await getPersonas();
  return NextResponse.json({ personas });
}
