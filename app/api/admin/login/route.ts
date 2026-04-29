import { NextResponse } from "next/server";
import * as z from "zod";

import {
  createAdminSessionToken,
  getAdminCookieName,
  getAdminSessionMaxAge,
  isAdminAuthConfigured,
  verifyAdminPassword,
} from "@/lib/admin-auth";

const requestSchema = z.object({
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json({ error: "관리자 인증 환경변수가 설정되지 않았습니다." }, { status: 503 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success || !verifyAdminPassword(parsed.data.password)) {
    return NextResponse.json({ error: "관리자 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getAdminCookieName(), createAdminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: getAdminSessionMaxAge(),
    path: "/",
  });

  return response;
}
