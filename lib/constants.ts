import type { StyleType } from "./types";

export const GAME = {
  DEFAULT_MAX_TURNS: 10,
  DEFAULT_START_AFFECTION: 40,
  DEFAULT_SUCCESS_THRESHOLD: 80,
  DEFAULT_FAIL_THRESHOLD: 20,
  MIN_AFFECTION: 0,
  MAX_AFFECTION: 100,
  MAX_AFFECTION_CHANGE_PER_TURN: 30,
  AI_MAX_TOKENS: 300,
  AI_TEMPERATURE: 0.8,
  MAX_MESSAGE_CHARS: 600,
  MAX_MESSAGES_PER_REQUEST: 40,
  OPENROUTER_TIMEOUT_MS: 25_000,
  CHAT_MODEL_FALLBACK: "deepseek/deepseek-v4-flash",
  FEEDBACK_MODEL: "deepseek/deepseek-v4-flash",
  FEEDBACK_MAX_TOKENS: 1400,
  ANALYSIS_MODEL: "deepseek/deepseek-v4-flash",
} as const;

export const STORAGE_KEY = "dating-sim-v1";
export const RESET_LIMIT = 2;
export const RESET_COUNT_STORAGE_KEY = "dating-sim-reset-count-v1";
export const DEFAULT_STATUS_MESSAGE = "표정을 읽기 어렵다";

export const COLORS = {
  chatBg: "#B2C7D9",
  myBubble: "#FEE500",
  otherBubble: "#FFFFFF",
  textPrimary: "#1A1A1A",
  textSecondary: "#888888",
  affectionBar: "linear-gradient(90deg, #FF6B6B, #FF8E8E)",
  affectionUp: "#FF4081",
  affectionDown: "#5C6BC0",
  successGreen: "#4CAF50",
  failRed: "#F44336",
  reportBg: "#F8F9FA",
  gradeS: "#FFD700",
  gradeA: "#4CAF50",
  gradeB: "#2196F3",
  gradeC: "#FF9800",
  gradeD: "#F44336",
  gradeF: "#9E9E9E",
  radarStroke: "#FF6B6B",
  radarFill: "rgba(255,107,107,0.2)",
} as const;

export const STYLE_TYPES: StyleType[] = [
  { name: "다정한 리스너", emoji: "🎧", description: "상대 말에 잘 반응하고 공감을 잘 표현하는 타입" },
  { name: "유머 폭격기", emoji: "🎪", description: "웃긴 말로 분위기를 주도하는 타입" },
  { name: "쿨한 전략가", emoji: "🎯", description: "적절한 타이밍을 계산하며 움직이는 타입" },
  { name: "순수 직진러", emoji: "💘", description: "솔직하고 직접적으로 마음을 표현하는 타입" },
  { name: "밀당 고수", emoji: "🎭", description: "거리를 조절하며 텐션을 만드는 타입" },
  { name: "분위기 메이커", emoji: "🌟", description: "대화 흐름을 자연스럽게 살리는 타입" },
  { name: "수줍은 관찰자", emoji: "👀", description: "조심스럽지만 디테일을 잘 캐치하는 타입" },
] as const;
