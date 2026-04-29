import { NextResponse } from "next/server";

import { getAdminCookieName } from "@/lib/admin-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(getAdminCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });

  return response;
}
