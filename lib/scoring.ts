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
  const turnPressure = 1 + (Math.max(nextTurn - 1, 0) / Math.max(maxTurns - 1, 1)) * 0.3;

  // 모델이 소심하게 준 변화도 게임에서는 체감되게 만든다.
  const boosted =
    absolute <= 3
      ? absolute + 2
      : absolute <= 12
        ? Math.round(absolute * turnPressure)
        : Math.round(absolute * Math.min(turnPressure, 1.18));

  return clamp(
    sign * boosted,
    -GAME.MAX_AFFECTION_CHANGE_PER_TURN,
    GAME.MAX_AFFECTION_CHANGE_PER_TURN,
  );
}

export function resolveTurnStatus(args: {
  character: Character;
  previousAffection: number;
  change: number;
  nextTurn: number;
  status: string;
}): StatusUpdate {
  const { character, previousAffection, nextTurn, status } = args;
  const change = resolveDynamicChange(args.change, nextTurn, character.maxTurns, status);

  const affection = clamp(
    previousAffection + change,
    GAME.MIN_AFFECTION,
    GAME.MAX_AFFECTION,
  );

  const success = affection >= character.successThreshold;
  const failed = affection <= character.failThreshold;
  const exhaustedTurns = nextTurn >= character.maxTurns;
  const gameOver = success || failed || exhaustedTurns;

  return {
    affection,
    change,
    status,
    success,
    gameOver,
  };
}
