export type Role = "user" | "assistant";

export type AffectionRule = {
  trigger: string;
  range: [number, number];
};

export type EvaluationRubricItem = {
  label: string;
  points: number;
  criteria: string;
};

export type CharacterImageStage = {
  minScore: number;
  image: string;
  label: string;
};

export interface CharacterConfig {
  id: string;
  name: string;
  profileImage: string;
  imageStages?: CharacterImageStage[];
  age: number;
  occupation: string;
  shortDescription: string;
  personality: string[];
  speechStyle: string;
  situation: string;
  mission: string;
  openingLine?: string;
  scoreLabel?: string;
  theory?: string;
  personaBrief?: string;
  initialState?: string;
  successCriteria?: string;
  failureCriteria?: string;
  evaluationRubric?: EvaluationRubricItem[];
  difficulty: 1 | 2 | 3;
  model?: string;
  startAffection?: number;
  successThreshold?: number;
  failThreshold?: number;
  maxTurns?: number;
  likes: AffectionRule[];
  dislikes: AffectionRule[];
}

export interface Character
  extends Omit<
    CharacterConfig,
    "model" | "startAffection" | "successThreshold" | "failThreshold" | "maxTurns"
  > {
  model: string;
  startAffection: number;
  successThreshold: number;
  failThreshold: number;
  maxTurns: number;
}

export interface Message {
  role: Role;
  content: string;
  timestamp: number;
}

export interface StoredMessage extends Message {
  id?: string;
  messageIndex: number;
}

export interface AIStatusPayload {
  change: number;
  status: string;
}

export interface StatusUpdate extends AIStatusPayload {
  affection: number;
  success: boolean;
  gameOver: boolean;
}

export interface ChatState {
  characterId: string;
  messages: Message[];
  affection: number;
  turnCount: number;
  maxTurns: number;
  isSuccess: boolean;
  isGameOver: boolean;
  lastChange: number;
  statusMessage: string;
  startedAt: number;
  endedAt?: number;
  serverRunId?: string;
}

export interface CharacterFeedback {
  characterId: string;
  success: boolean;
  finalAffection: number;
  turnsUsed: number;
  bestLine: string;
  worstLine: string;
  summary: string;
  rubricScores?: RubricFeedbackItem[];
  totalRubricScore?: number;
  maxRubricScore?: number;
  grade?: "S" | "A" | "B" | "C" | "D" | "F";
  strengths?: string[];
  improvements?: string[];
  judgeComment?: string;
}

export interface RubricFeedbackItem {
  label: string;
  points: number;
  score: number;
  criteria: string;
  evidence: string;
  comment: string;
}

export interface PlayerProfile {
  playerId: string;
  nickname: string;
  createdAt: number;
}

export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  totalRuns: number;
  successCount: number;
  bestAffection: number;
  averageAffection: number;
  latestPlayedAt: string;
}

export type SessionStatus = "in_progress" | "completed";

export interface AdminSessionSummary {
  runId: string;
  playerId: string;
  nickname: string;
  characterId: string;
  characterName: string;
  status: SessionStatus;
  success: boolean;
  currentAffection: number;
  finalAffection: number;
  turnsUsed: number;
  messageCount: number;
  startedAt: string;
  completedAt: string | null;
  lastMessageAt: string;
}

export interface AdminSessionDetail extends AdminSessionSummary {
  messages: StoredMessage[];
}

export interface PersonaConfigRecord {
  characterId: string;
  config: CharacterConfig;
  updatedAt: string;
}

export interface SessionSaveStatus {
  synced: boolean;
  runId?: string;
  error?: string;
  syncedAt?: number;
}

export type StyleType = {
  name: string;
  emoji: string;
  description: string;
};

export interface StyleAnalysis {
  radar: {
    charm: number;
    wit: number;
    empathy: number;
    confidence: number;
    timing: number;
    naturalness: number;
  };
  overallGrade: "S" | "A" | "B" | "C" | "D" | "F";
  overallScore: number;
  primaryStyle: StyleType;
  secondaryStyle: StyleType;
  strengths: string[];
  weaknesses: string[];
  patterns: string[];
  characterResults: {
    characterId: string;
    characterName: string;
    success: boolean;
    finalAffection: number;
    keyMoment: string;
  }[];
  overallComment: string;
  advice: string;
}

export interface SavedData {
  playerProfile?: PlayerProfile;
  characters: Record<
    string,
    {
      chatState: ChatState;
      feedback?: CharacterFeedback;
      completedAt?: number;
      serverSync?: SessionSaveStatus;
    }
  >;
  analysis?: StyleAnalysis;
  createdAt: number;
}

export interface CompletedConversation {
  characterId: string;
  characterName: string;
  mission: string;
  success: boolean;
  finalAffection: number;
  messages: Message[];
}

export interface AllConversationsPayload {
  allConversations: CompletedConversation[];
}
