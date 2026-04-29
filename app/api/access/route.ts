import { NextResponse } from "next/server";
import * as z from "zod";

const chatKeywordEnvByCharacterId: Record<string, string | undefined> = {
  "reconciliation-swings": process.env.CHAT_ACCESS_KEYWORD_SWINGS,
  "persuasion-professor-ahn": process.env.CHAT_ACCESS_KEYWORD_COMEDU,
  "love-mt-walk": process.env.CHAT_ACCESS_KEYWORD_DUGEUN,
  "refusal-cha-eunwoo": process.env.CHAT_ACCESS_KEYWORD_CHA_EUNWOO,
};

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
        ? chatKeywordEnvByCharacterId[body.characterId]
        : process.env.RESET_ACCESS_KEYWORD;

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
