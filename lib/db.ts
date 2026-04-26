import { sql } from "@vercel/postgres";

import type { LeaderboardEntry, Message } from "./types";

export type CompleteSessionInput = {
  playerId: string;
  nickname: string;
  characterId: string;
  characterName: string;
  success: boolean;
  finalAffection: number;
  turnsUsed: number;
  messages: Message[];
};

export function isDatabaseConfigured() {
  return Boolean(process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING);
}

export async function ensureTables() {
  if (!isDatabaseConfigured()) {
    throw new Error("POSTGRES_URL이 설정되지 않았습니다.");
  }

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

  await sql`
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id UUID NOT NULL REFERENCES conversation_runs(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL
    )
  `;
}

export async function saveCompletedSession(input: CompleteSessionInput) {
  await ensureTables();

  await sql`
    INSERT INTO players (id, nickname)
    VALUES (${input.playerId}, ${input.nickname})
    ON CONFLICT (id)
    DO UPDATE SET nickname = EXCLUDED.nickname, updated_at = NOW()
  `;

  const runResult = await sql<{ id: string }>`
    INSERT INTO conversation_runs (
      player_id,
      character_id,
      character_name,
      success,
      final_affection,
      turns_used
    )
    VALUES (
      ${input.playerId},
      ${input.characterId},
      ${input.characterName},
      ${input.success},
      ${input.finalAffection},
      ${input.turnsUsed}
    )
    RETURNING id
  `;

  const runId = runResult.rows[0]?.id;

  if (!runId) {
    throw new Error("저장된 세션 ID를 찾을 수 없습니다.");
  }

  for (const message of input.messages) {
    await sql`
      INSERT INTO conversation_messages (run_id, role, content, sent_at)
      VALUES (
        ${runId},
        ${message.role},
        ${message.content},
        ${new Date(message.timestamp).toISOString()}
      )
    `;
  }

  return { runId };
}

export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  await ensureTables();

  const result = await sql<{
    player_id: string;
    nickname: string;
    total_runs: number;
    success_count: number;
    best_affection: number;
    average_affection: number;
    latest_played_at: string;
  }>`
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
    GROUP BY p.id, p.nickname
    ORDER BY success_count DESC, best_affection DESC, average_affection DESC, latest_played_at ASC
    LIMIT ${limit}
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
