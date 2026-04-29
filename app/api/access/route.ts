import { NextResponse } from "next/server";
import * as z from "zod";

const chatKeywordByCharacterId: Record<string, string> = {
  "reconciliation-swings-revised": "스윙스",
  "persuasion-professor-ahn-sj": "컴에듀",
  "love-mt-female-peer": "두근두근",
  "refusal-cha-eunwoo-fictional": "국세청",
};

const resetKeyword = "미안합니다";

const requestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("chat"),
    characterId: z.string().min(1),
    keyword: z.string().min(1).max(80),
  }),
  z.object({
    type: z.literal("reset"),
    keyword: z.string().min(1).max(80),
  }),
]);

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());

    const expected =
      body.type === "chat"
        ? chatKeywordByCharacterId[body.characterId]
        : resetKeyword;

    if (!expected) {
      return NextResponse.json({ error: "비밀 키워드가 설정되지 않았습니다." }, { status: 500 });
    }

    if (body.keyword.trim() !== expected.trim()) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    }

    return NextResponse.json({ error: "비밀 키워드 확인에 실패했습니다." }, { status: 500 });
  }
}
