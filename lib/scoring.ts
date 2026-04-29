import { GAME } from "./constants";
import type { Character, StatusUpdate } from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function inferZeroChange(status: string, nextTurn: number) {
  const positiveKeywords = ["웃", "흥미", "관심", "호감", "편안", "부드", "즐거", "미소", "가까"];
  const negativeKeywords = ["경직", "차갑", "불편", "부담", "싫", "시큰둥", "어색", "당황", "거리", "굳", "피하"];

  if (positiveKeywords.some((keyword) => status.includes(keyword))) {
    return 3;
  }

  if (negativeKeywords.some((keyword) => status.includes(keyword))) {
    return -3;
  }

  return nextTurn <= 2 ? 2 : 1;
}

function resolveDynamicChange(
  rawChange: number,
  nextTurn: number,
  maxTurns: number,
  status: string,
) {
  const rounded = Math.round(rawChange);

  if (rounded === 0) {
    return inferZeroChange(status, nextTurn);
  }

  const sign = Math.sign(rounded);
  const absolute = Math.abs(rounded);
  const turnPressure = 1 + (Math.max(nextTurn - 1, 0) / Math.max(maxTurns - 1, 1)) * 0.12;

  // 모델이 소심하게 준 변화도 게임에서는 체감되게 만든다.
  const boosted =
    sign > 0
      ? absolute <= 3
        ? absolute + 3
        : absolute <= 9
          ? Math.round(absolute * 1.25)
          : Math.round(absolute * 1.12)
      : absolute <= 3
        ? absolute + 3
        : absolute <= 12
          ? Math.round(absolute * (turnPressure + 0.12))
          : Math.round(absolute * 1.15);

  return clamp(
    sign * boosted,
    -GAME.MAX_AFFECTION_CHANGE_PER_TURN,
    GAME.MAX_AFFECTION_CHANGE_PER_TURN,
  );
}

function inferRedFlagPenalty(characterId: string, userMessage: string) {
  const normalized = userMessage.replace(/\s+/g, " ").trim().toLowerCase();

  const redFlagsByCharacter: Record<string, Array<{ patterns: string[]; penalty: number }>> = {
    "reconciliation-swings-revised": [
      {
        patterns: [
          "형 잘못",
          "선배 잘못",
          "너도 잘못",
          "그쪽도 잘못",
          "잘못도 있",
          "근데 형",
          "그치만 형",
          "나도 억울",
          "팬들 때문에",
          "어쩔 수 없",
          "혹시 내가 잘못",
          "인접권",
          "어깨 밀",
          "형이 그때",
          "돈 얘기",
        ],
        penalty: -28,
      },
      {
        patterns: ["근데", "그치만", "하지만", "오해", "상황이"],
        penalty: -16,
      },
    ],
    "persuasion-professor-ahn-sj": [
      {
        patterns: ["장학금", "취업", "다른 친구", "다른 애", "f 받으면", "올려주세요", "억울"],
        penalty: -22,
      },
    ],
    "love-mt-female-peer": [
      {
        patterns: ["오늘부터 1일", "사귀자 지금", "스킨십", "딴 애", "다른 애", "술김", "키스"],
        penalty: -24,
      },
    ],
    "refusal-cha-eunwoo-fictional": [
      {
        patterns: ["생각해볼게", "빌려줄게", "얼마 필요", "조금은 가능", "나중에 줄게", "일단 줄게"],
        penalty: -26,
      },
    ],
  };

  const matchedRule = redFlagsByCharacter[characterId]?.find((rule) =>
    rule.patterns.some((pattern) => normalized.includes(pattern)),
  );

  return matchedRule?.penalty;
}

export function resolveTurnStatus(args: {
  character: Character;
  previousAffection: number;
  change: number;
  nextTurn: number;
  status: string;
  userMessage?: string;
}): StatusUpdate {
  const { character, previousAffection, nextTurn, status } = args;
  const dynamicChange = resolveDynamicChange(args.change, nextTurn, character.maxTurns, status);
  const redFlagPenalty = args.userMessage
    ? inferRedFlagPenalty(character.id, args.userMessage)
    : undefined;
  const change =
    redFlagPenalty === undefined ? dynamicChange : Math.min(dynamicChange, redFlagPenalty);

  const affection = clamp(
    previousAffection + change,
    GAME.MIN_AFFECTION,
    GAME.MAX_AFFECTION,
  );

  const success = affection >= character.successThreshold;
  const exhaustedTurns = nextTurn >= character.maxTurns;
  const gameOver = exhaustedTurns;

  return {
    affection,
    change,
    status,
    success,
    gameOver,
  };
}
