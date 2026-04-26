import { COLORS } from "./constants";
import type { Character, ChatState, StyleAnalysis } from "./types";

export function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

export function getDifficultyStars(difficulty: number) {
  return "★".repeat(difficulty) + "☆".repeat(Math.max(0, 3 - difficulty));
}

export function getGradeColor(grade: StyleAnalysis["overallGrade"]) {
  if (grade === "S") return COLORS.gradeS;
  if (grade === "A") return COLORS.gradeA;
  if (grade === "B") return COLORS.gradeB;
  if (grade === "C") return COLORS.gradeC;
  if (grade === "D") return COLORS.gradeD;
  return COLORS.gradeF;
}

export function createInitialChatState(character: Character): ChatState {
  return {
    characterId: character.id,
    messages: [],
    affection: character.startAffection,
    turnCount: 0,
    maxTurns: character.maxTurns,
    isSuccess: false,
    isGameOver: false,
    lastChange: 0,
    statusMessage: "아직 분위기를 탐색하는 중이다",
    startedAt: Date.now(),
  };
}

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
