import { getPostgresPool } from "@/lib/postgres";
import { getWcaEventName } from "@/lib/wca-events";

// 第29至38周是首批连续纳入的十期周赛。此日期是固定起点，后续
// 周赛会继续累积，早于该范围的旧录入不会追溯进入省榜。
export const WEEKLY_PROVINCIAL_RANKING_START = "2026-07-13T00:00:00+08:00";
export const WEEKLY_PROVINCIAL_RANKING_NOTE = "统计自2026年第29周起的周赛成绩，取个人历史最好平均。";

export type WeeklyProvincialRankingRow = {
  rank: number;
  playerId: string;
  playerName: string;
  playerSlug: string;
  gender: "男" | "女";
  average: number;
  meetTitle: string;
  dateLabel: string;
};

export type WeeklyProvincialRankingEvent = { eventCode: string; eventName: string };

const averageFormats = ["avg5", "best3", "avg3"];

export async function listWeeklyProvincialRankingEvents(): Promise<WeeklyProvincialRankingEvent[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<{ event_code: string }>(
    `SELECT DISTINCT event.event_code
       FROM weekly_results result
       JOIN weekly_events event ON event.id = result.event_id AND event.meet_id = result.meet_id
       JOIN weekly_meets meet ON meet.id = result.meet_id
      WHERE meet.data_version = 2
        AND meet.starts_at >= $1::timestamptz
        AND event.format = ANY($2::text[])
        AND result.average > 0
      ORDER BY event.event_code`,
    [WEEKLY_PROVINCIAL_RANKING_START, averageFormats]
  );
  return rows.map((row) => ({ eventCode: row.event_code, eventName: getWcaEventName(row.event_code) }));
}

export async function listWeeklyProvincialRankings(eventCode: string): Promise<WeeklyProvincialRankingRow[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<{
    rank: string;
    player_id: string;
    player_name: string;
    player_slug: string;
    gender: string;
    average: string;
    meet_title: string;
    date_label: string;
  }>(
    `WITH eligible AS (
       SELECT result.player_id, result.player_name, result.player_slug, result.gender,
              result.average, meet.title AS meet_title, meet.date_label, meet.starts_at
         FROM weekly_results result
         JOIN weekly_events event ON event.id = result.event_id AND event.meet_id = result.meet_id
         JOIN weekly_meets meet ON meet.id = result.meet_id
        WHERE meet.data_version = 2
          AND meet.starts_at >= $1::timestamptz
          AND event.event_code = $2
          AND event.format = ANY($3::text[])
          AND result.average > 0
          AND result.player_id IS NOT NULL
     ), best AS (
       SELECT DISTINCT ON (player_id) player_id, player_name, player_slug, gender, average, meet_title, date_label
         FROM eligible
        ORDER BY player_id, average ASC, starts_at ASC
     )
     SELECT RANK() OVER (ORDER BY average ASC)::text AS rank, player_id, player_name, player_slug, gender,
            average::text, meet_title, date_label
       FROM best
      ORDER BY average ASC, player_name ASC`,
    [WEEKLY_PROVINCIAL_RANKING_START, eventCode, averageFormats]
  );
  return rows.map((row) => ({
    rank: Number(row.rank),
    playerId: row.player_id,
    playerName: row.player_name,
    playerSlug: row.player_slug,
    gender: row.gender === "女" ? "女" : "男",
    average: Number(row.average),
    meetTitle: row.meet_title,
    dateLabel: row.date_label
  }));
}

export async function getWeeklyProvincialRanks(eventCode: string, playerIds: string[]) {
  if (!playerIds.length) return new Map<string, number>();
  const rankings = await listWeeklyProvincialRankings(eventCode);
  const wanted = new Set(playerIds);
  return new Map(rankings.filter((row) => wanted.has(row.playerId)).map((row) => [row.playerId, row.rank]));
}
