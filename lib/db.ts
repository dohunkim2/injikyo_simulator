import { randomUUID } from "crypto";
import postgres from "postgres";

import type {
  AdminSessionDetail,
  AdminSessionSummary,
  CharacterConfig,
  CharacterFeedback,
  LeaderboardEntry,
  Message,
  PersonaConfigRecord,
  Role,
  SessionStatus,
  StoredMessage,
} from "./types";

type QueryResult<T extends postgres.Row> = {
  rows: T[];
};

type PostgresClient = ReturnType<typeof postgres>;
type PostgresTx = postgres.TransactionSql;

const globalForPostgres = globalThis as unknown as {
  postgresClient?: PostgresClient;
  schemaReady?: Promise<void>;
};

function getDatabaseUrl() {
  return process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;
}

function getSqlClient() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error("POSTGRES_URL이 설정되지 않았습니다.");
  }

  if (!globalForPostgres.postgresClient) {
    const isLocal = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
    globalForPostgres.postgresClient = postgres(databaseUrl, {
      max: 5,
      idle_timeout: 30,
      connect_timeout: 10,
      max_lifetime: 60 * 30,
      prepare: false,
      ssl: isLocal ? false : "require",
    });
  }

  return globalForPostgres.postgresClient;
}

async function sql<T extends postgres.Row = postgres.Row>(
  strings: TemplateStringsArray,
  ...values: postgres.ParameterOrFragment<never>[]
): Promise<QueryResult<T>> {
  const rows = await getSqlClient()<T[]>(strings, ...values);
  return { rows };
}

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
  runId?: string;
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
  affectionChange?: number | null;
};

export function isDatabaseConfigured() {
  return Boolean(getDatabaseUrl());
}

export async function ensureTables() {
  if (!isDatabaseConfigured()) {
    throw new Error("POSTGRES_URL이 설정되지 않았습니다.");
  }

  if (globalForPostgres.schemaReady) {
    return globalForPostgres.schemaReady;
  }

  globalForPostgres.schemaReady = ensureTablesUncached().catch((error) => {
    globalForPostgres.schemaReady = undefined;
    throw error;
  });

  return globalForPostgres.schemaReady;
}

async function ensureTablesUncached() {
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
      id UUID PRIMARY KEY,
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
  await sql`ALTER TABLE conversation_runs ADD COLUMN IF NOT EXISTS feedback JSONB`;

  await sql`
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id UUID PRIMARY KEY,
      run_id UUID NOT NULL REFERENCES conversation_runs(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS message_index INTEGER`;
  await sql`ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS affection_change INTEGER`;
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
    CREATE INDEX IF NOT EXISTS conversation_runs_player_character_idx
    ON conversation_runs (player_id, character_id, last_message_at DESC)
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

  await sql`
    CREATE TABLE IF NOT EXISTS admin_state (
      id INT PRIMARY KEY,
      last_cleared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT admin_state_singleton CHECK (id = 1)
    )
  `;

  await sql`
    INSERT INTO admin_state (id, last_cleared_at)
    VALUES (1, NOW())
    ON CONFLICT (id) DO NOTHING
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

  if (input.runId) {
    const existing = await sql<{ id: string; player_id: string; character_id: string }>`
      SELECT id::text, player_id, character_id
      FROM conversation_runs
      WHERE id = ${input.runId}
      LIMIT 1
    `;

    const row = existing.rows[0];
    if (row && row.player_id === input.playerId && row.character_id === input.characterId) {
      return { runId: row.id };
    }
  }

  const newRunId = input.runId ?? randomUUID();

  const runResult = await sql<{ id: string }>`
    INSERT INTO conversation_runs (
      id,
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
      ${newRunId},
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
    ON CONFLICT (id) DO NOTHING
    RETURNING id::text
  `;

  const runId = runResult.rows[0]?.id ?? newRunId;
  return { runId };
}

export async function appendSessionMessage(input: AppendSessionMessageInput) {
  await ensureTables();

  const sentAt = new Date(input.timestamp).toISOString();
  const messageId = randomUUID();

  const affectionChange = input.affectionChange ?? null;

  await getSqlClient().begin(async (tx: PostgresTx) => {
    await tx`
      INSERT INTO conversation_messages (id, run_id, role, content, sent_at, message_index, affection_change)
      VALUES (
        ${messageId},
        ${input.runId},
        ${input.role},
        ${input.content},
        ${sentAt},
        ${input.messageIndex},
        ${affectionChange}
      )
      ON CONFLICT (run_id, message_index) WHERE message_index IS NOT NULL
      DO UPDATE SET
        role = EXCLUDED.role,
        content = EXCLUDED.content,
        sent_at = EXCLUDED.sent_at,
        affection_change = EXCLUDED.affection_change
    `;

    await tx`
      UPDATE conversation_runs
      SET current_affection = ${input.currentAffection},
          final_affection = ${input.currentAffection},
          turns_used = ${input.turnsUsed},
          last_message_at = GREATEST(last_message_at, ${sentAt}::timestamptz)
      WHERE id = ${input.runId}
    `;
  });
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
  await upsertPlayer(input.playerId, input.nickname);

  const runId = input.runId ?? randomUUID();

  await getSqlClient().begin(async (tx: PostgresTx) => {
    await tx`
      INSERT INTO conversation_runs (
        id,
        player_id,
        character_id,
        character_name,
        success,
        final_affection,
        turns_used,
        status,
        current_affection,
        completed_at,
        last_message_at
      )
      VALUES (
        ${runId},
        ${input.playerId},
        ${input.characterId},
        ${input.characterName},
        ${input.success},
        ${input.finalAffection},
        ${input.turnsUsed},
        'completed',
        ${input.finalAffection},
        NOW(),
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        player_id = EXCLUDED.player_id,
        character_id = EXCLUDED.character_id,
        character_name = EXCLUDED.character_name,
        success = EXCLUDED.success,
        final_affection = EXCLUDED.final_affection,
        turns_used = EXCLUDED.turns_used,
        status = 'completed',
        current_affection = EXCLUDED.current_affection,
        completed_at = COALESCE(conversation_runs.completed_at, NOW()),
        last_message_at = NOW()
    `;

    if (input.messages.length > 0) {
      const serializedMessages = JSON.stringify(
        input.messages.map((message, index) => ({
          id: randomUUID(),
          message_index: index,
          role: message.role,
          content: message.content,
          sent_at: new Date(message.timestamp).toISOString(),
        })),
      );

      await tx`
        INSERT INTO conversation_messages (id, run_id, role, content, sent_at, message_index)
        SELECT
          item.id::uuid,
          ${runId}::uuid,
          item.role,
          item.content,
          item.sent_at::timestamptz,
          item.message_index
        FROM jsonb_to_recordset(${serializedMessages}::jsonb) AS item(
          id text,
          role text,
          content text,
          sent_at text,
          message_index int
        )
        ON CONFLICT (run_id, message_index) WHERE message_index IS NOT NULL
        DO UPDATE SET
          role = EXCLUDED.role,
          content = EXCLUDED.content,
          sent_at = EXCLUDED.sent_at
      `;
    }
  });

  return { runId };
}

export type ActiveSessionRecord = {
  runId: string;
  status: SessionStatus;
  currentAffection: number;
  turnsUsed: number;
  messages: StoredMessage[];
};

export async function getActiveSessionForPlayer(
  playerId: string,
  characterId: string,
): Promise<ActiveSessionRecord | null> {
  await ensureTables();

  const runResult = await sql<{
    id: string;
    status: string;
    current_affection: number;
    turns_used: number;
  }>`
    SELECT id::text, status, current_affection, turns_used
    FROM conversation_runs
    WHERE player_id = ${playerId}
      AND character_id = ${characterId}
      AND status = 'in_progress'
    ORDER BY last_message_at DESC
    LIMIT 1
  `;

  const row = runResult.rows[0];
  if (!row) return null;

  const messagesResult = await sql<{
    id: string;
    role: Role;
    content: string;
    sent_at: string;
    message_index: number | null;
    affection_change: number | null;
  }>`
    SELECT id::text, role, content, sent_at::text, message_index, affection_change
    FROM conversation_messages
    WHERE run_id = ${row.id}
    ORDER BY COALESCE(message_index, 2147483647), sent_at ASC
  `;

  return {
    runId: row.id,
    status: toSessionStatus(row.status),
    currentAffection: row.current_affection,
    turnsUsed: row.turns_used,
    messages: messagesResult.rows.map((message, index) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: new Date(message.sent_at).getTime(),
      messageIndex: message.message_index ?? index,
      affectionChange: message.affection_change,
    })),
  };
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
    feedback: CharacterFeedback | null;
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
      r.last_message_at::text AS last_message_at,
      r.feedback AS feedback
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
    affection_change: number | null;
  }>`
    SELECT
      id::text,
      role,
      content,
      sent_at::text,
      message_index,
      affection_change
    FROM conversation_messages
    WHERE run_id = ${runId}
    ORDER BY COALESCE(message_index, 2147483647), sent_at ASC
  `;

  return {
    ...mapSessionSummary(summary),
    feedback: summary.feedback,
    messages: messagesResult.rows.map((message, index) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: new Date(message.sent_at).getTime(),
      messageIndex: message.message_index ?? index,
      affectionChange: message.affection_change,
    })),
  };
}

export async function saveFeedbackForRun(runId: string, feedback: CharacterFeedback) {
  await ensureTables();

  await sql`
    UPDATE conversation_runs
    SET feedback = ${JSON.stringify(feedback)}::jsonb
    WHERE id = ${runId}
  `;
}

export async function clearAdminConversationLogs() {
  await ensureTables();

  const countResult = await sql<{ runs: number; players: number }>`
    SELECT
      (SELECT COUNT(*)::int FROM conversation_runs) AS runs,
      (SELECT COUNT(*)::int FROM players) AS players
  `;
  const deletedRuns = countResult.rows[0]?.runs ?? 0;
  const deletedPlayers = countResult.rows[0]?.players ?? 0;

  await sql`TRUNCATE TABLE conversation_messages, conversation_runs, players RESTART IDENTITY CASCADE`;

  await sql`
    INSERT INTO admin_state (id, last_cleared_at)
    VALUES (1, NOW())
    ON CONFLICT (id) DO UPDATE SET last_cleared_at = NOW()
  `;

  return { deletedRuns, deletedPlayers };
}

export async function getLastClearedAt(): Promise<string | null> {
  await ensureTables();

  const result = await sql<{ last_cleared_at: string }>`
    SELECT last_cleared_at::text FROM admin_state WHERE id = 1 LIMIT 1
  `;

  return result.rows[0]?.last_cleared_at ?? null;
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

