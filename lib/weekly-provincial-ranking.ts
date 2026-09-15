import { getPostgresPool } from "@/lib/postgres";
import { getWcaEventName } from "@/lib/wca-events";
import { weeklyV2PlayerSourceSql } from "@/lib/weekly-player-scope";

// 第29至38周是首批连续纳入的十期周赛。此日期是固定起点，后续
// 周赛会继续累积，早于该范围的旧录入不会追溯进入省榜。
export const WEEKLY_PROVINCIAL_RANKING_START = "2026-07-13T00:00:00+08:00";
export const WEEKLY_PROVINCIAL_RANKING_NOTE = "仅统计选手库中省份为辽宁的选手；自2026年第29周起，取个人历史最好平均。年龄组采用选手创造该成绩时的组别，筛选后重新计算组内排名。";

export type WeeklyProvincialRankingRow = {
  rank: number;
  playerId: string;
  playerName: string;
  playerSlug: string;
  weeklyNumber: number | null;
  ageGroup: string;
  gender: "" | "男" | "女";
  wcaId: string;
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
       JOIN weekly_player_library library ON library.id = result.player_id
      WHERE meet.data_version = 2
        AND meet.starts_at >= $1::timestamptz
        AND event.format = ANY($2::text[])
        AND result.average > 0
        AND library.province = '辽宁'
        AND ${weeklyV2PlayerSourceSql("library")}
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
    weekly_number: number | null;
    age_group: string | null;
    gender: string;
    wca_id: string;
    average: string;
    meet_title: string;
    date_label: string;
  }>(
    `WITH eligible AS (
       SELECT result.player_id, result.player_name, result.player_slug, result.gender, result.age_group,
              result.average, meet.title AS meet_title, meet.date_label, meet.starts_at
         FROM weekly_results result
         JOIN weekly_events event ON event.id = result.event_id AND event.meet_id = result.meet_id
         JOIN weekly_meets meet ON meet.id = result.meet_id
         JOIN weekly_player_library library_scope ON library_scope.id = result.player_id
        WHERE meet.data_version = 2
          AND meet.starts_at >= $1::timestamptz
          AND event.event_code = $2
          AND event.format = ANY($3::text[])
          AND result.average > 0
          AND result.player_id IS NOT NULL
          AND library_scope.province = '辽宁'
          AND ${weeklyV2PlayerSourceSql("library_scope")}
     ), best AS (
       SELECT DISTINCT ON (player_id) player_id, player_name, player_slug, gender, age_group, average, meet_title, date_label
         FROM eligible
        ORDER BY player_id, average ASC, starts_at ASC
     )
     SELECT RANK() OVER (ORDER BY best.average ASC)::text AS rank, best.player_id, best.player_name, best.player_slug,
            COALESCE(library.gender, '') AS gender,
            best.age_group, COALESCE(card.source_row_number, NULL)::integer AS weekly_number,
            COALESCE(NULLIF(library.wca_id, ''), NULLIF(card.wca_id, ''), '') AS wca_id,
            best.average::text, best.meet_title, best.date_label
       FROM best
       LEFT JOIN weekly_player_library library ON library.id = best.player_id
       LEFT JOIN LATERAL (
         SELECT source_row_number, wca_id
           FROM weekly_long_card_profiles
          WHERE matched_player_id = best.player_id
          ORDER BY submitted_at DESC, source_row_number DESC
          LIMIT 1
       ) card ON TRUE
      ORDER BY average ASC, player_name ASC`,
    [WEEKLY_PROVINCIAL_RANKING_START, eventCode, averageFormats]
  );
  return rows.map((row) => ({
    rank: Number(row.rank),
    playerId: row.player_id,
    playerName: row.player_name,
    playerSlug: row.player_slug,
    weeklyNumber: row.weekly_number,
    ageGroup: row.age_group || "",
    gender: row.gender === "女" ? "女" : row.gender === "男" ? "男" : "",
    wcaId: row.wca_id || "",
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
