import { NextResponse } from "next/server";
import * as z from "zod";

import { openRouterChat } from "@/lib/api";
import { GAME } from "@/lib/constants";
import { getPersonaById } from "@/lib/personas";
import type { Character, CharacterFeedback, Message, RubricFeedbackItem } from "@/lib/types";

export const maxDuration = 30;

const requestSchema = z.object({
  characterId: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.union([z.literal("user"), z.literal("assistant")]),
      content: z.string().min(1).max(GAME.MAX_STORED_MESSAGE_CHARS),
      timestamp: z.number().optional(),
    }),
  ).max(GAME.MAX_MESSAGES_PER_REQUEST),
  success: z.boolean(),
  finalAffection: z.number().min(0).max(100),
  turnsUsed: z.number().int().min(0),
});

function fallbackFeedback(args: {
  characterId: string;
  success: boolean;
  finalAffection: number;
  turnsUsed: number;
  messages: Message[];
  character?: Character | null;
}): CharacterFeedback {
  const userLines = args.messages.filter((message) => message.role === "user");
  const rubricScores = buildFallbackRubricScores(args.character, args.success);
  const maxRubricScore = rubricScores.reduce((sum, item) => sum + item.points, 0);
  const totalRubricScore = rubricScores.reduce((sum, item) => sum + item.score, 0);

  return {
    characterId: args.characterId,
    success: args.success,
    finalAffection: args.finalAffection,
    turnsUsed: args.turnsUsed,
    bestLine: userLines[0]?.content ?? "대화를 시작했다",
    worstLine: userLines[userLines.length - 1]?.content ?? "아쉽게 흐름이 끊겼다",
    summary: args.success ? "분위기를 잘 끌어올린 공략" : "가능성은 있었지만 마무리가 아쉬움",
    rubricScores,
    totalRubricScore,
    maxRubricScore,
    grade: getGradeFromRatio(maxRubricScore > 0 ? totalRubricScore / maxRubricScore : args.finalAffection / 100),
    strengths: args.success ? ["핵심 목표를 비교적 명확히 건드렸습니다."] : ["대화를 끝까지 진행했습니다."],
    improvements: args.success
      ? ["더 구체적인 표현을 넣으면 완성도가 올라갑니다."]
      : ["상대의 핵심 감정과 과제 조건을 더 직접적으로 다뤄보세요."],
    judgeComment: "저지 모델 응답을 받지 못해 기본 기준으로 산출한 임시 결과입니다.",
  };
}

function buildFallbackRubricScores(
  character: Character | null | undefined,
  success: boolean,
): RubricFeedbackItem[] {
  return (character?.evaluationRubric ?? []).map((item) => {
    const ratio = success ? 0.72 : 0.42;
    return {
      label: item.label,
      points: item.points,
      score: roundScore(item.points * ratio),
      criteria: item.criteria,
      evidence: "저지 모델 평가를 불러오지 못했습니다.",
      comment: "기본 점수로 임시 산출했습니다.",
    };
  });
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

function clampScore(value: unknown, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return roundScore(Math.max(0, Math.min(max, numeric)));
}

function getGradeFromRatio(ratio: number): CharacterFeedback["grade"] {
  if (ratio >= 0.9) return "S";
  if (ratio >= 0.8) return "A";
  if (ratio >= 0.7) return "B";
  if (ratio >= 0.6) return "C";
  if (ratio >= 0.45) return "D";
  return "F";
}

function extractJsonBlock(raw: string) {
  const match = raw.match(/\{[\s\S]*\}/);
  return match?.[0];
}

function normalizeMessages(messages: z.infer<typeof requestSchema>["messages"]): Message[] {
  return messages.map((message) => ({
    ...message,
    timestamp: message.timestamp ?? Date.now(),
  }));
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeStringList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 3);
  return items.length > 0 ? items : fallback;
}

function normalizeFeedback(args: {
  parsed: Partial<CharacterFeedback>;
  body: z.infer<typeof requestSchema>;
  character: Character;
}): CharacterFeedback {
  const rubric = args.character.evaluationRubric ?? [];
  const parsedRubrics = Array.isArray(args.parsed.rubricScores) ? args.parsed.rubricScores : [];
  const rubricScores = rubric.map((item, index) => {
    const matched = parsedRubrics.find((entry) => entry?.label === item.label) ?? parsedRubrics[index];
    return {
      label: item.label,
      points: item.points,
      score: clampScore(matched?.score, item.points),
      criteria: item.criteria,
      evidence: normalizeString(matched?.evidence, "대화 내 근거가 충분히 추출되지 않았습니다."),
      comment: normalizeString(matched?.comment, "추가 개선이 필요합니다."),
    };
  });
  const maxRubricScore = rubricScores.reduce((sum, item) => sum + item.points, 0);
  const totalRubricScore = rubricScores.reduce((sum, item) => sum + item.score, 0);
  const ratio = maxRubricScore > 0 ? totalRubricScore / maxRubricScore : args.body.finalAffection / 100;

  return {
    characterId: args.body.characterId,
    success: args.body.success,
    finalAffection: args.body.finalAffection,
    turnsUsed: args.body.turnsUsed,
    summary: normalizeString(args.parsed.summary, "대화 결과 요약 없음"),
    bestLine: normalizeString(args.parsed.bestLine, "좋았던 발언을 찾지 못했습니다."),
    worstLine: normalizeString(args.parsed.worstLine, "아쉬운 발언을 찾지 못했습니다."),
    rubricScores,
    totalRubricScore: roundScore(totalRubricScore),
    maxRubricScore: roundScore(maxRubricScore),
    grade: getGradeFromRatio(ratio),
    strengths: normalizeStringList(args.parsed.strengths, ["상황을 끝까지 이어갔습니다."]),
    improvements: normalizeStringList(args.parsed.improvements, ["루브릭 기준을 더 구체적으로 반영해보세요."]),
    judgeComment: normalizeString(args.parsed.judgeComment, "루브릭 기준으로 종합 평가했습니다."),
  };
}

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema> | null = null;
  let character: Character | null = null;

  try {
    body = requestSchema.parse(await request.json());
    character = await getPersonaById(body.characterId);

    if (!character) {
      return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
    }

    const activeCharacter = character;
    const formattedMessages = body.messages
      .map((message) => `${message.role === "user" ? "사용자" : activeCharacter.name}: ${message.content}`)
      .join("\n");

    const raw = await openRouterChat({
      model: GAME.FEEDBACK_MODEL,
      messages: [
        {
          role: "system",
          content: "당신은 대화 훈련 평가 코치입니다. 반드시 JSON만 반환하세요.",
        },
        {
          role: "user",
          content: `아래는 대화 훈련 시뮬레이션에서 사용자와 "${activeCharacter.name}"의 대화입니다.
과제: ${activeCharacter.mission}
평가 기준: ${activeCharacter.evaluationRubric?.map((item) => `${item.label} ${item.points}점 - ${item.criteria}`).join(" / ") ?? "대화 목표 달성도"}
결과: ${body.success ? "성공" : "실패"} (최종 ${activeCharacter.scoreLabel ?? "성공 점수"} ${body.finalAffection}/100)

[대화 내역]
${formattedMessages}

아래 JSON으로만 응답하세요. JSON 외 다른 텍스트 없이:
{
  "summary": "한줄 요약 (20자 이내)",
  "bestLine": "사용자의 가장 좋았던 발언 원문",
  "worstLine": "사용자의 가장 안 좋았던 발언 원문",
  "rubricScores": [
    {
      "label": "평가 기준의 label 원문",
      "score": 0,
      "evidence": "대화에서 점수 근거가 되는 사용자 발언 또는 결여점",
      "comment": "짧은 판정 코멘트"
    }
  ],
  "strengths": ["잘한 점 1", "잘한 점 2"],
  "improvements": ["개선점 1", "개선점 2"],
  "judgeComment": "인바디 결과지처럼 종합 진단 1~2문장"
}

rubricScores는 위 평가 기준의 label을 빠짐없이 포함해야 합니다. score는 각 기준의 만점(points)을 넘기지 마세요.`,
        },
      ],
      max_tokens: GAME.FEEDBACK_MAX_TOKENS,
      temperature: 0.6,
    });

    const jsonBlock = extractJsonBlock(raw);

    if (!jsonBlock) {
      return NextResponse.json(
        fallbackFeedback({
          characterId: body.characterId,
          success: body.success,
          finalAffection: body.finalAffection,
          turnsUsed: body.turnsUsed,
          messages: normalizeMessages(body.messages),
          character,
        }),
      );
    }

    const parsed = JSON.parse(jsonBlock) as Partial<CharacterFeedback>;

    return NextResponse.json(normalizeFeedback({ parsed, body, character: activeCharacter }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
    }

    if (body) {
      return NextResponse.json(
        fallbackFeedback({
          characterId: body.characterId,
          success: body.success,
          finalAffection: body.finalAffection,
          turnsUsed: body.turnsUsed,
          messages: normalizeMessages(body.messages ?? []),
          character,
        }),
      );
    }

    return NextResponse.json({ error: "피드백 생성에 실패했습니다." }, { status: 500 });
  }
}
