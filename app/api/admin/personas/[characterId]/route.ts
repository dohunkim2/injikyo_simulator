import { NextResponse } from "next/server";
import * as z from "zod";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { characterConfigSchema, getCharacterById } from "@/lib/characters";
import { isDatabaseConfigured, upsertPersonaConfig } from "@/lib/db";
import { getPersonaById } from "@/lib/personas";

const requestSchema = characterConfigSchema.extend({
  id: z.string().min(1),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ characterId: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  const { characterId } = await params;
  const persona = await getPersonaById(characterId);

  if (!persona) {
    return NextResponse.json({ error: "페르소나를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ persona });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ characterId: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "POSTGRES_URL이 필요합니다." }, { status: 503 });
  }

  const { characterId } = await params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success || parsed.data.id !== characterId || !getCharacterById(characterId)) {
    return NextResponse.json({ error: "잘못된 페르소나 설정입니다." }, { status: 400 });
  }

  if (!parsed.data.profileImage.startsWith("/characters/")) {
    return NextResponse.json({ error: "프리셋 이미지 경로만 사용할 수 있습니다." }, { status: 400 });
  }

  if (parsed.data.imageStages?.some((stage) => !stage.image.startsWith("/characters/"))) {
    return NextResponse.json({ error: "프리셋 이미지 경로만 사용할 수 있습니다." }, { status: 400 });
  }

  const record = await upsertPersonaConfig(characterId, parsed.data);
  const persona = await getPersonaById(characterId);

  return NextResponse.json({ persona, updatedAt: record?.updatedAt ?? null });
}
