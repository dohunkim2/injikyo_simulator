import { NextResponse } from "next/server";
import { z } from "zod";

import { openRouterChat } from "@/lib/api";
import { GAME, STYLE_TYPES } from "@/lib/constants";
import type { CompletedConversation, StyleAnalysis } from "@/lib/types";

const requestSchema = z.object({
  allConversations: z.array(
    z.object({
      characterId: z.string().min(1),
      characterName: z.string().min(1),
      mission: z.string().min(1),
      success: z.boolean(),
      finalAffection: z.number(),
      messages: z.array(
        z.object({
          role: z.union([z.literal("user"), z.literal("assistant")]),
          content: z.string().min(1),
          timestamp: z.number().optional(),
        }),
      ),
    }),
  ),
});

function gradeFromScore(score: number): StyleAnalysis["overallGrade"] {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

function fallbackAnalysis(allConversations: CompletedConversation[]): StyleAnalysis {
  const count = Math.max(allConversations.length, 1);
  const successCount = allConversations.filter((item) => item.success).length;
  const affectionAvg =
    allConversations.reduce((sum, item) => sum + item.finalAffection, 0) / count;
  const score = Math.round((successCount / count) * 45 + affectionAvg * 0.55);

  return {
    radar: {
      charm: Math.min(100, Math.round(affectionAvg + 5)),
      wit: Math.min(100, Math.round(55 + successCount * 8)),
      empathy: Math.min(100, Math.round(50 + affectionAvg * 0.35)),
      confidence: Math.min(100, Math.round(48 + successCount * 10)),
      timing: Math.min(100, Math.round(45 + successCount * 12)),
      naturalness: Math.min(100, Math.round(52 + affectionAvg * 0.3)),
    },
    overallGrade: gradeFromScore(score),
    overallScore: score,
    primaryStyle: STYLE_TYPES[5],
    secondaryStyle: STYLE_TYPES[0],
    strengths: ["대화 흐름을 이어가는 힘이 있음", "상대마다 톤을 조금씩 조절함"],
    weaknesses: ["결정적인 순간에 조금 급해질 수 있음", "호감 표현의 강약 조절이 더 필요함"],
    patterns: ["초반 분위기 탐색은 안정적임", "후반 승부수 타이밍에서 편차가 있음"],
    characterResults: allConversations.map((conversation) => ({
      characterId: conversation.characterId,
      characterName: conversation.characterName,
      success: conversation.success,
      finalAffection: conversation.finalAffection,
      keyMoment:
        conversation.messages.find((message) => message.role === "user")?.content ??
        "첫 인상이 결과에 영향을 줬다",
    })),
    overallComment:
      "전체적으로 분위기를 읽으면서 대화를 이어가는 힘이 보입니다. 다만 결정적인 순간에 조금만 더 자연스럽게 밀어붙이면 성공률이 더 올라갈 타입입니다.",
    advice: "상대가 편해진 순간에만 한 단계 깊게 들어가 보세요. 초반에는 탐색, 후반에는 명확한 제안이 가장 잘 먹힙니다.",
  };
}

function extractJsonBlock(raw: string) {
  const match = raw.match(/\{[\s\S]*\}/);
  return match?.[0];
}

function normalizeConversations(
  conversations: z.infer<typeof requestSchema>["allConversations"],
): CompletedConversation[] {
  return conversations.map((conversation) => ({
    ...conversation,
    messages: conversation.messages.map((message) => ({
      ...message,
      timestamp: message.timestamp ?? Date.now(),
    })),
  }));
}

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema> | null = null;

  try {
    body = requestSchema.parse(await request.json());

    const raw = await openRouterChat({
      model: GAME.ANALYSIS_MODEL,
      messages: [
        {
          role: "system",
          content: "당신은 대화 스타일 분석 전문가입니다. 반드시 JSON만 응답하세요.",
        },
        {
          role: "user",
          content: `아래는 한 사용자가 3명의 서로 다른 상대와 나눈 대화 내역입니다.
각 대화는 연애 시뮬레이션 게임의 일부이며, 사용자의 대화 스타일과 패턴을 분석해야 합니다.

## 대화 데이터
${JSON.stringify(body.allConversations)}

## 분석 항목 (각 0~100점)
1. 매력도(charm): 상대를 끄는 표현력. 호감을 주는 말을 했는가?
2. 위트(wit): 재치와 유머 감각. 상황에 맞는 센스있는 말을 했는가?
3. 공감력(empathy): 상대의 감정이나 상황을 읽고 반응했는가?
4. 자신감(confidence): 당당하고 주도적으로 대화를 이끌었는가?
5. 타이밍(timing): 적절한 순간에 적절한 말(공략 멘트, 화제 전환 등)을 했는가?
6. 자연스러움(naturalness): 억지스럽거나 작위적이지 않고 자연스러웠는가?

## 대화 스타일 유형 (아래 중 메인 1개 + 서브 1개 선택)
- 다정한 리스너 🎧: 상대 말에 잘 반응하고 공감을 잘 표현하는 타입
- 유머 폭격기 🎪: 웃긴 말로 분위기를 주도하는 타입
- 쿨한 전략가 🎯: 계산적으로 적절한 타이밍에 움직이는 타입
- 순수 직진러 💘: 솔직하고 직접적으로 마음을 표현하는 타입
- 밀당 고수 🎭: 밀고 당기기를 잘 활용하는 타입
- 분위기 메이커 🌟: 대화 흐름을 자연스럽게 만드는 타입
- 수줍은 관찰자 👀: 조심스럽지만 디테일을 잘 캐치하는 타입

## 출력 형식 (JSON만 출력, 다른 텍스트 없이)
{
  "radar": {
    "charm": 0,
    "wit": 0,
    "empathy": 0,
    "confidence": 0,
    "timing": 0,
    "naturalness": 0
  },
  "overallGrade": "S",
  "overallScore": 0,
  "primaryStyle": {
    "name": "스타일 이름",
    "emoji": "이모지",
    "description": "한줄 설명"
  },
  "secondaryStyle": {
    "name": "스타일 이름",
    "emoji": "이모지",
    "description": "한줄 설명"
  },
  "strengths": ["강점1", "강점2"],
  "weaknesses": ["약점1", "약점2"],
  "patterns": ["패턴1", "패턴2"],
  "characterResults": [
    {
      "characterId": "id",
      "characterName": "이름",
      "success": true,
      "finalAffection": 0,
      "keyMoment": "핵심 장면"
    }
  ],
  "overallComment": "2~3문장 종합 평가",
  "advice": "1~2문장 핵심 조언"
}`,
        },
      ],
      max_tokens: 900,
      temperature: 0.7,
    });

    const jsonBlock = extractJsonBlock(raw);
    const normalizedConversations = normalizeConversations(body.allConversations);

    if (!jsonBlock) {
      return NextResponse.json(fallbackAnalysis(normalizedConversations));
    }

    return NextResponse.json(JSON.parse(jsonBlock) as StyleAnalysis);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
    }

    if (body) {
      return NextResponse.json(fallbackAnalysis(normalizeConversations(body.allConversations)));
    }

    return NextResponse.json({ error: "분석 생성에 실패했습니다." }, { status: 500 });
  }
}
