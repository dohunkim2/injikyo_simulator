import { NextResponse } from "next/server";

import { getPersonaById } from "@/lib/personas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ characterId: string }> },
) {
  const { characterId } = await params;
  const persona = await getPersonaById(characterId);

  if (!persona) {
    return NextResponse.json({ error: "페르소나를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ persona });
}
