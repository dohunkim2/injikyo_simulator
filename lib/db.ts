import { sql } from "@vercel/postgres";

import type {
  AdminSessionDetail,
  AdminSessionSummary,
  CharacterConfig,
  LeaderboardEntry,
  Message,
  PersonaConfigRecord,
  Role,
  SessionStatus,
} from "./types";

export type CompleteSessionInput = {
  runId?: string;
  playerId: string;
  nickname: string;
  characterId: string;
  characterName: string;
  success: boolean;
  finalAffection: number;
  turnsUsed: number;
  messages: Message[];
};

export type StartSessionInput = {
  playerId: string;
  nickname: string;
  characterId: string;
  characterName: string;
  currentAffection: number;
};

export type AppendSessionMessageInput = {
  runId: string;
  role: Role;
  content: string;
  timestamp: number;
  messageIndex: number;
  currentAffection: number;
  turnsUsed: number;
};

export function isDatabaseConfigured() {
  return Boolean(process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING);
}

export async function ensureTables() {
  if (!isDatabaseConfigured()) {
    throw new Error("POSTGRES_URL이 설정되지 않았습니다.");
  }

  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

  await sql`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS conversation_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      character_id TEXT NOT NULL,
      character_name TEXT NOT NULL,
      success BOOLEAN NOT NULL,
      final_affection INTEGER NOT NULL,
      turns_used INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE conversation_runs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed'`;
  await sql`ALTER TABLE conversation_runs ADD COLUMN IF NOT EXISTS current_affection INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE conversation_runs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE conversation_runs ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;

  await sql`
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id UUID NOT NULL REFERENCES conversation_runs(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS message_index INTEGER`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_run_index_key
    ON conversation_messages (run_id, message_index)
    WHERE message_index IS NOT NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS conversation_runs_last_message_idx
    ON conversation_runs (last_message_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS conversation_messages_run_sent_idx
    ON conversation_messages (run_id, sent_at ASC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS persona_configs (
      character_id TEXT PRIMARY KEY,
      config JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function upsertPlayer(playerId: string, nickname: string) {
  await sql`
    INSERT INTO players (id, nickname)
    VALUES (${playerId}, ${nickname})
    ON CONFLICT (id)
    DO UPDATE SET nickname = EXCLUDED.nickname, updated_at = NOW()
  `;
}

export async function startSession(input: StartSessionInput) {
  await ensureTables();
  await upsertPlayer(input.playerId, input.nickname);

  const runResult = await sql<{ id: string }>`
    INSERT INTO conversation_runs (
      player_id,
      character_id,
      character_name,
      success,
      final_affection,
      turns_used,
      status,
      current_affection,
      last_message_at
    )
    VALUES (
      ${input.playerId},
      ${input.characterId},
      ${input.characterName},
      false,
      ${input.currentAffection},
      0,
      'in_progress',
      ${input.currentAffection},
      NOW()
    )
    RETURNING id
  `;

  const runId = runResult.rows[0]?.id;

  if (!runId) {
    throw new Error("저장된 세션 ID를 찾을 수 없습니다.");
  }

  return { runId };
}

export async function appendSessionMessage(input: AppendSessionMessageInput) {
  await ensureTables();

  const sentAt = new Date(input.timestamp).toISOString();

  await sql`
    INSERT INTO conversation_messages (run_id, role, content, sent_at, message_index)
    VALUES (
      ${input.runId},
      ${input.role},
      ${input.content},
      ${sentAt},
      ${input.messageIndex}
    )
    ON CONFLICT (run_id, message_index) WHERE message_index IS NOT NULL
    DO UPDATE SET
      role = EXCLUDED.role,
      content = EXCLUDED.content,
      sent_at = EXCLUDED.sent_at
  `;

  await sql`
    UPDATE conversation_runs
    SET current_affection = ${input.currentAffection},
        final_affection = ${input.currentAffection},
        turns_used = ${input.turnsUsed},
        last_message_at = GREATEST(last_message_at, ${sentAt}::timestamptz)
    WHERE id = ${input.runId}
  `;
}

export async function completeSession(input: Omit<CompleteSessionInput, "messages">) {
  await ensureTables();
  await upsertPlayer(input.playerId, input.nickname);

  if (!input.runId) {
    const { runId } = await startSession({
      playerId: input.playerId,
      nickname: input.nickname,
      characterId: input.characterId,
      characterName: input.characterName,
      currentAffection: input.finalAffection,
    });

    input.runId = runId;
  }

  await sql`
    UPDATE conversation_runs
    SET player_id = ${input.playerId},
        character_id = ${input.characterId},
        character_name = ${input.characterName},
        success = ${input.success},
        final_affection = ${input.finalAffection},
        current_affection = ${input.finalAffection},
        turns_used = ${input.turnsUsed},
        status = 'completed',
        completed_at = COALESCE(completed_at, NOW()),
        last_message_at = NOW()
    WHERE id = ${input.runId}
  `;

  return { runId: input.runId };
}

export async function saveCompletedSession(input: CompleteSessionInput) {
  await ensureTables();

  const { runId } = input.runId
    ? { runId: input.runId }
    : await startSession({
        playerId: input.playerId,
        nickname: input.nickname,
        characterId: input.characterId,
        characterName: input.characterName,
        currentAffection: input.finalAffection,
      });

  for (const [index, message] of input.messages.entries()) {
    await appendSessionMessage({
      runId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      messageIndex: index,
      currentAffection: input.finalAffection,
      turnsUsed: input.turnsUsed,
    });
  }

  await completeSession({ ...input, runId });

  return { runId };
}

export async function getLeaderboard(limit?: number): Promise<LeaderboardEntry[]> {
  await ensureTables();

  type LeaderboardRow = {
    player_id: string;
    nickname: string;
    total_runs: number;
    success_count: number;
    best_affection: number;
    average_affection: number;
    latest_played_at: string;
  };

  const result = limit
    ? await sql<LeaderboardRow>`
      SELECT
        p.id AS player_id,
        p.nickname,
        COUNT(r.id)::int AS total_runs,
        COALESCE(SUM(CASE WHEN r.success THEN 1 ELSE 0 END), 0)::int AS success_count,
        COALESCE(MAX(r.final_affection), 0)::int AS best_affection,
        ROUND(COALESCE(AVG(r.final_affection), 0))::int AS average_affection,
        MAX(r.created_at)::text AS latest_played_at
      FROM players p
      JOIN conversation_runs r ON r.player_id = p.id
      WHERE r.status = 'completed'
      GROUP BY p.id, p.nickname
      ORDER BY success_count DESC, best_affection DESC, average_affection DESC, latest_played_at ASC
      LIMIT ${limit}
    `
    : await sql<LeaderboardRow>`
      SELECT
        p.id AS player_id,
        p.nickname,
        COUNT(r.id)::int AS total_runs,
        COALESCE(SUM(CASE WHEN r.success THEN 1 ELSE 0 END), 0)::int AS success_count,
        COALESCE(MAX(r.final_affection), 0)::int AS best_affection,
        ROUND(COALESCE(AVG(r.final_affection), 0))::int AS average_affection,
        MAX(r.created_at)::text AS latest_played_at
      FROM players p
      JOIN conversation_runs r ON r.player_id = p.id
      WHERE r.status = 'completed'
      GROUP BY p.id, p.nickname
      ORDER BY success_count DESC, best_affection DESC, average_affection DESC, latest_played_at ASC
    `;

  return result.rows.map((row) => ({
    playerId: row.player_id,
    nickname: row.nickname,
    totalRuns: row.total_runs,
    successCount: row.success_count,
    bestAffection: row.best_affection,
    averageAffection: row.average_affection,
    latestPlayedAt: row.latest_played_at,
  }));
}

function toSessionStatus(status: string): SessionStatus {
  return status === "completed" ? "completed" : "in_progress";
}

function mapSessionSummary(row: {
  run_id: string;
  player_id: string;
  nickname: string;
  character_id: string;
  character_name: string;
  status: string;
  success: boolean;
  current_affection: number;
  final_affection: number;
  turns_used: number;
  message_count: number;
  started_at: string;
  completed_at: string | null;
  last_message_at: string;
}): AdminSessionSummary {
  return {
    runId: row.run_id,
    playerId: row.player_id,
    nickname: row.nickname,
    characterId: row.character_id,
    characterName: row.character_name,
    status: toSessionStatus(row.status),
    success: row.success,
    currentAffection: row.current_affection,
    finalAffection: row.final_affection,
    turnsUsed: row.turns_used,
    messageCount: row.message_count,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    lastMessageAt: row.last_message_at,
  };
}

export async function getAdminSessions(limit = 50): Promise<AdminSessionSummary[]> {
  await ensureTables();

  const result = await sql<{
    run_id: string;
    player_id: string;
    nickname: string;
    character_id: string;
    character_name: string;
    status: string;
    success: boolean;
    current_affection: number;
    final_affection: number;
    turns_used: number;
    message_count: number;
    started_at: string;
    completed_at: string | null;
    last_message_at: string;
  }>`
    SELECT
      r.id::text AS run_id,
      r.player_id,
      p.nickname,
      r.character_id,
      r.character_name,
      r.status,
      r.success,
      r.current_affection,
      r.final_affection,
      r.turns_used,
      COUNT(m.id)::int AS message_count,
      r.created_at::text AS started_at,
      r.completed_at::text AS completed_at,
      r.last_message_at::text AS last_message_at
    FROM conversation_runs r
    JOIN players p ON p.id = r.player_id
    LEFT JOIN conversation_messages m ON m.run_id = r.id
    GROUP BY r.id, p.nickname
    ORDER BY r.last_message_at DESC
    LIMIT ${limit}
  `;

  return result.rows.map(mapSessionSummary);
}

export async function getAdminSessionDetail(runId: string): Promise<AdminSessionDetail | null> {
  await ensureTables();

  const summaryResult = await sql<{
    run_id: string;
    player_id: string;
    nickname: string;
    character_id: string;
    character_name: string;
    status: string;
    success: boolean;
    current_affection: number;
    final_affection: number;
    turns_used: number;
    message_count: number;
    started_at: string;
    completed_at: string | null;
    last_message_at: string;
  }>`
    SELECT
      r.id::text AS run_id,
      r.player_id,
      p.nickname,
      r.character_id,
      r.character_name,
      r.status,
      r.success,
      r.current_affection,
      r.final_affection,
      r.turns_used,
      COUNT(m.id)::int AS message_count,
      r.created_at::text AS started_at,
      r.completed_at::text AS completed_at,
      r.last_message_at::text AS last_message_at
    FROM conversation_runs r
    JOIN players p ON p.id = r.player_id
    LEFT JOIN conversation_messages m ON m.run_id = r.id
    WHERE r.id = ${runId}
    GROUP BY r.id, p.nickname
    LIMIT 1
  `;

  const summary = summaryResult.rows[0];

  if (!summary) {
    return null;
  }

  const messagesResult = await sql<{
    id: string;
    role: Role;
    content: string;
    sent_at: string;
    message_index: number | null;
  }>`
    SELECT
      id::text,
      role,
      content,
      sent_at::text,
      message_index
    FROM conversation_messages
    WHERE run_id = ${runId}
    ORDER BY COALESCE(message_index, 2147483647), sent_at ASC
  `;

  return {
    ...mapSessionSummary(summary),
    messages: messagesResult.rows.map((message, index) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: new Date(message.sent_at).getTime(),
      messageIndex: message.message_index ?? index,
    })),
  };
}

export async function getPersonaConfigOverrides(): Promise<PersonaConfigRecord[]> {
  await ensureTables();

  const result = await sql<{
    character_id: string;
    config: CharacterConfig;
    updated_at: string;
  }>`
    SELECT character_id, config, updated_at::text
    FROM persona_configs
    ORDER BY character_id ASC
  `;

  return result.rows.map((row) => ({
    characterId: row.character_id,
    config: row.config,
    updatedAt: row.updated_at,
  }));
}

export async function getPersonaConfigOverride(characterId: string): Promise<PersonaConfigRecord | null> {
  await ensureTables();

  const result = await sql<{
    character_id: string;
    config: CharacterConfig;
    updated_at: string;
  }>`
    SELECT character_id, config, updated_at::text
    FROM persona_configs
    WHERE character_id = ${characterId}
    LIMIT 1
  `;

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    characterId: row.character_id,
    config: row.config,
    updatedAt: row.updated_at,
  };
}

export async function upsertPersonaConfig(characterId: string, config: CharacterConfig) {
  await ensureTables();

  await sql`
    INSERT INTO persona_configs (character_id, config, updated_at)
    VALUES (${characterId}, ${JSON.stringify(config)}::jsonb, NOW())
    ON CONFLICT (character_id)
    DO UPDATE SET config = EXCLUDED.config, updated_at = NOW()
  `;

  return getPersonaConfigOverride(characterId);
}
