import { readdir } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";

const allowedExtensions = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  const charactersDir = path.join(process.cwd(), "public", "characters");
  const files = await readdir(charactersDir).catch(() => []);
  const options = files
    .filter((file) => allowedExtensions.has(path.extname(file).toLowerCase()))
    .sort()
    .map((file) => `/characters/${file}`);

  return NextResponse.json({ options });
}
