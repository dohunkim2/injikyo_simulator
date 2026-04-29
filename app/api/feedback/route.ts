import { NextResponse } from "next/server";
import * as z from "zod";

import { openRouterChat } from "@/lib/api";
import { GAME } from "@/lib/constants";
import { isDatabaseConfigured, saveFeedbackForRun } from "@/lib/db";
import { getPersonaById } from "@/lib/personas";
import type {
  Character,
  CharacterFeedback,
  EvaluationRubricItem,
  Message,
  RubricFeedbackItem,
} from "@/lib/types";

export const maxDuration = 45;

type FeedbackMessages = Parameters<typeof openRouterChat>[0]["messages"];

const RUBRIC_ITEM_MAX_SCORE = 10;

const requestSchema = z.object({
  characterId: z.string().min(1),
  runId: z.string().uuid().optional(),
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
  errorDetails?: string[];
}): CharacterFeedback {
  const rubricScores = buildFallbackRubricScores(args.character, args.success);
  const maxRubricScore = rubricScores.reduce((sum, item) => sum + item.points, 0);
  const errorSummary = args.errorDetails?.length ? ` 실패 원인: ${args.errorDetails.join(" / ")}` : "";

  return {
    characterId: args.characterId,
    success: args.success,
    finalAffection: args.finalAffection,
    turnsUsed: args.turnsUsed,
    bestLine: "저지 모델 평가 전",
    worstLine: "저지 모델 평가 전",
    summary: "저지 재요청 필요",
    rubricScores,
    totalRubricScore: 0,
    maxRubricScore,
    grade: "F",
    strengths: ["저지 모델 평가가 아직 완료되지 않았습니다."],
    improvements: ["피드백 재요청으로 루브릭 평가를 다시 생성해 주세요."],
    judgeComment: `저지 모델 응답을 받지 못해 평가를 저장하지 않았습니다.${errorSummary}`,
  };
}

function buildFallbackRubricScores(
  character: Character | null | undefined,
  success: boolean,
): RubricFeedbackItem[] {
  return (character?.evaluationRubric ?? []).map((item) => {
    return {
      label: item.label,
      points: RUBRIC_ITEM_MAX_SCORE,
      score: 0,
      criteria: item.criteria,
      evidence: "저지 모델 평가가 아직 완료되지 않았습니다.",
      comment: "피드백 재요청으로 다시 채점할 수 있습니다.",
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "알 수 없는 오류";
}

function parseJsonResponse(raw: string, label: string): Partial<CharacterFeedback> {
  const jsonBlock = extractJsonBlock(raw);

  if (!jsonBlock) {
    throw new Error(`${label} 응답에서 JSON을 찾지 못했습니다.`);
  }

  try {
    return JSON.parse(jsonBlock) as Partial<CharacterFeedback>;
  } catch (error) {
    throw new Error(`${label} JSON 파싱 실패: ${getErrorMessage(error)}`);
  }
}

function splitRubricGroups(items: EvaluationRubricItem[], groupCount: number) {
  if (items.length === 0) return [];

  const size = Math.ceil(items.length / Math.max(1, groupCount));
  const groups: EvaluationRubricItem[][] = [];

  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }

  return groups;
}

function formatRubricCriteria(items: EvaluationRubricItem[]) {
  return items
    .map((item) => `${item.label} ${RUBRIC_ITEM_MAX_SCORE}점 만점 - ${item.criteria}`)
    .join(" / ");
}

function buildRubricMessages({
  commonContext,
  group,
  index,
  total,
}: {
  commonContext: string;
  group: EvaluationRubricItem[];
  index: number;
  total: number;
}): FeedbackMessages {
  return [
    {
      role: "system",
      content:
        "당신은 대화 훈련 루브릭 채점관입니다. 반드시 JSON만 반환하세요. 점수는 관대하게 뭉개지 말고 기준별로 독립 판단하세요.",
    },
    {
      role: "user",
      content: `${commonContext}

아래는 전체 루브릭 중 ${index + 1}/${total} 그룹입니다. 이 그룹의 기준만 채점하세요.
평가 기준: ${formatRubricCriteria(group)}

루브릭 점수만 아래 JSON으로 반환하세요. JSON 외 다른 텍스트 없이:
{
  "rubricScores": [
    {
      "label": "평가 기준의 label 원문",
      "score": 0,
      "evidence": "대화에서 점수 근거가 되는 사용자 발언 원문 또는 해당 발화 없음",
      "comment": "짧은 판정 코멘트"
    }
  ]
}

rubricScores는 이 그룹의 label을 빠짐없이 포함해야 합니다.
모든 score는 0~10 사이 숫자이며, 각 기준은 10점 만점입니다.
점수 기준: 10=탁월함, 8=충분히 좋음, 6=일부 충족, 4=약함, 2=거의 없음, 0=반대/부재.`,
    },
  ];
}

async function runFeedbackEvaluation({
  label,
  messages,
  maxTokens,
  temperature,
}: {
  label: string;
  messages: FeedbackMessages;
  maxTokens: number;
  temperature: number;
}) {
  try {
    const raw = await openRouterChat({
      model: GAME.FEEDBACK_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
      timeoutMs: GAME.FEEDBACK_PRIMARY_TIMEOUT_MS,
    });

    return parseJsonResponse(raw, label);
  } catch (primaryError) {
    try {
      const raw = await openRouterChat({
        model: GAME.CHAT_MODEL_BACKUP,
        messages,
        max_tokens: maxTokens,
        temperature,
        timeoutMs: GAME.FEEDBACK_BACKUP_TIMEOUT_MS,
        maxRetries: 0,
      });

      return parseJsonResponse(raw, `${label} 백업`);
    } catch (backupError) {
      throw new Error(
        `${label} 1차(${GAME.FEEDBACK_MODEL}) 실패: ${getErrorMessage(primaryError)}; 백업(${GAME.CHAT_MODEL_BACKUP}) 실패: ${getErrorMessage(backupError)}`,
      );
    }
  }
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
      points: RUBRIC_ITEM_MAX_SCORE,
      score: clampScore(matched?.score, RUBRIC_ITEM_MAX_SCORE),
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

    const commonContext = `아래는 대화 훈련 시뮬레이션에서 사용자와 "${activeCharacter.name}"의 대화입니다.
과제: ${activeCharacter.mission}
결과: ${body.success ? "성공" : "실패"} (최종 ${activeCharacter.scoreLabel ?? "성공 점수"} ${body.finalAffection}/100)

[대화 내역]
${formattedMessages}`;

    const rubricGroups = splitRubricGroups(activeCharacter.evaluationRubric ?? [], 3);
    const rubricEvaluations = rubricGroups.map((group, index) =>
      runFeedbackEvaluation({
        label: `루브릭 평가 ${index + 1}/${rubricGroups.length}`,
        messages: buildRubricMessages({
          commonContext,
          group,
          index,
          total: rubricGroups.length,
        }),
        maxTokens: Math.min(2200, Math.ceil(GAME.FEEDBACK_MAX_TOKENS * 0.25)),
        temperature: 0.35,
      }),
    );

    const narrativeMessages: FeedbackMessages = [
        {
          role: "system",
          content: "당신은 대화 훈련 결과 리포트 작성자입니다. 반드시 JSON만 반환하세요.",
        },
        {
          role: "user",
          content: `${commonContext}

점수를 제외한 결과 리포트만 아래 JSON으로 반환하세요. JSON 외 다른 텍스트 없이:
{
  "summary": "한줄 요약 (20자 이내)",
  "bestLine": "사용자의 가장 좋았던 발언 원문",
  "worstLine": "사용자의 가장 안 좋았던 발언 원문",
  "strengths": ["잘한 점 1", "잘한 점 2"],
  "improvements": ["개선점 1", "개선점 2"],
  "judgeComment": "인바디 결과지처럼 종합 진단 1~2문장"
}`,
        },
    ];
    const narrativeEvaluation = runFeedbackEvaluation({
      label: "서술 평가",
      messages: narrativeMessages,
      maxTokens: Math.min(2600, Math.floor(GAME.FEEDBACK_MAX_TOKENS * 0.35)),
      temperature: 0.6,
    });

    const [rubricResults, narrativeResult] = await Promise.all([
      Promise.allSettled(rubricEvaluations),
      Promise.resolve(narrativeEvaluation).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ status: "rejected" as const, reason }),
      ),
    ]);

    const rejectedRubrics = rubricResults.flatMap((result, index) =>
      result.status === "rejected" ? [{ index, reason: result.reason }] : [],
    );
    if (rejectedRubrics.length > 0) {
      const errorDetails = rejectedRubrics.map((result) =>
        `루브릭 그룹 ${result.index + 1} 실패: ${getErrorMessage(result.reason)}`,
      );
      if (narrativeResult.status === "rejected") {
        errorDetails.push(`서술 평가 실패: ${getErrorMessage(narrativeResult.reason)}`);
      }

      return NextResponse.json(
        fallbackFeedback({
          characterId: body.characterId,
          success: body.success,
          finalAffection: body.finalAffection,
          turnsUsed: body.turnsUsed,
          messages: normalizeMessages(body.messages),
          character,
          errorDetails,
        }),
      );
    }

    const mergedRubricScores = rubricResults.flatMap((result) =>
      result.status === "fulfilled" && Array.isArray(result.value.rubricScores)
        ? result.value.rubricScores
        : [],
    );
    const parsed: Partial<CharacterFeedback> = {
      rubricScores: mergedRubricScores,
      ...(narrativeResult.status === "fulfilled"
        ? narrativeResult.value
        : {
            judgeComment: `루브릭 평가는 완료됐지만 서술 평가에 실패했습니다. 원인: ${getErrorMessage(narrativeResult.reason)}`,
          }),
    };

    const finalFeedback = normalizeFeedback({ parsed, body, character: activeCharacter });

    const dbConfigured = isDatabaseConfigured();
    if (!body.runId) {
      console.warn(
        `[feedback] runId 없이 호출됨, DB 저장 건너뜀. character=${body.characterId}`,
      );
    } else if (!dbConfigured) {
      console.warn(`[feedback] DB 미설정, runId=${body.runId} 저장 건너뜀`);
    } else {
      try {
        const { updated } = await saveFeedbackForRun(body.runId, finalFeedback);
        if (!updated) {
          console.warn(
            `[feedback] runId=${body.runId}에 해당하는 conversation_runs 행이 없음 (관리자 초기화 직후 또는 런 미생성). 저장 0건.`,
          );
        } else {
          console.log(`[feedback] runId=${body.runId} 인바디 저장 완료`);
        }
      } catch (saveError) {
        console.error("[feedback] 저장 실패", body.runId, saveError);
      }
    }

    return NextResponse.json(finalFeedback);
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
          errorDetails: [`피드백 API 오류: ${getErrorMessage(error)}`],
        }),
      );
    }

    return NextResponse.json({ error: "피드백 생성에 실패했습니다." }, { status: 500 });
  }
}
