import { getPostgresPool } from "@/lib/postgres";
import { getWcaEventName } from "@/lib/wca-events";
import { weeklyV2PlayerSourceSql } from "@/lib/weekly-player-scope";

export const WEEKLY_OVERALL_RESULTS_START = 340;

export type WeeklyOverallResultEvent = {
  eventCode: string;
  eventName: string;
  format: string;
  countEvent: boolean;
};

export type WeeklyOverallResultRow = {
  rank: number;
  playerId: string;
  playerName: string;
  weeklyNumber: number | null;
  wcaId: string;
  gender: string;
  score: number;
  ageGroup: string;
  meetTitle: string;
  weekNumber: number;
  dateLabel: string;
  participationWeeks: number;
};

export async function listWeeklyOverallResultEvents(): Promise<WeeklyOverallResultEvent[]> {
  const { rows } = await getPostgresPool().query<{ event_code: string; format: string }>(
    `SELECT event.event_code, MODE() WITHIN GROUP (ORDER BY event.format) AS format
       FROM weekly_results result
       JOIN weekly_events event ON event.id = result.event_id AND event.meet_id = result.meet_id
       JOIN weekly_meets meet ON meet.id = result.meet_id
       JOIN weekly_player_library library ON library.id = result.player_id
      WHERE meet.data_version = 2
        AND meet.id <> 'weekly-test-entry'
        AND meet.week_number >= $1
        AND result.average >= CASE WHEN event.event_code LIKE 'bigstack%' THEN 0 ELSE 0.01 END
        AND ${weeklyV2PlayerSourceSql("library")}
      GROUP BY event.event_code
      ORDER BY event.event_code`,
    [WEEKLY_OVERALL_RESULTS_START]
  );

  return rows.map((row) => {
    const countEvent = row.event_code.startsWith("bigstack");
    const baseName = getWcaEventName(row.event_code);
    return {
      eventCode: row.event_code,
      eventName: countEvent ? `大堆${baseName}` : baseName,
      format: row.format,
      countEvent
    };
  });
}

export async function listWeeklyOverallResults(event: WeeklyOverallResultEvent): Promise<WeeklyOverallResultRow[]> {
  const direction = event.countEvent ? "DESC" : "ASC";
  const { rows } = await getPostgresPool().query<{
    rank: string;
    player_id: string;
    player_name: string;
    weekly_number: number | null;
    wca_id: string | null;
    gender: string | null;
    score: string;
    age_group: string | null;
    meet_title: string;
    week_number: number;
    date_label: string;
    participation_weeks: number;
  }>(
    `WITH eligible AS (
       SELECT result.player_id, result.average AS score, result.age_group,
              meet.title AS meet_title, meet.week_number, meet.date_label, meet.starts_at
         FROM weekly_results result
         JOIN weekly_events weekly_event ON weekly_event.id = result.event_id AND weekly_event.meet_id = result.meet_id
         JOIN weekly_meets meet ON meet.id = result.meet_id
        WHERE meet.data_version = 2
          AND meet.id <> 'weekly-test-entry'
          AND meet.week_number >= $1
          AND weekly_event.event_code = $2
          AND result.player_id IS NOT NULL
          AND result.average >= CASE WHEN $3::boolean THEN 0 ELSE 0.01 END
     ), best AS (
       SELECT DISTINCT ON (player_id) player_id, score, age_group, meet_title, week_number, date_label
         FROM eligible
        ORDER BY player_id, score ${direction}, starts_at ASC
     ), participation AS (
       SELECT result.player_id, COUNT(DISTINCT result.meet_id)::integer AS weeks
         FROM weekly_results result
         JOIN weekly_meets meet ON meet.id = result.meet_id
         JOIN weekly_player_library participant ON participant.id = result.player_id
        WHERE meet.data_version = 2
          AND meet.id <> 'weekly-test-entry'
          AND meet.week_number >= $1
          AND result.player_id IS NOT NULL
          AND result.average >= 0
          AND ${weeklyV2PlayerSourceSql("participant")}
        GROUP BY result.player_id
     )
     SELECT RANK() OVER (ORDER BY best.score ${direction})::text AS rank,
            library.id AS player_id, library.name AS player_name,
            library.weekly_number, NULLIF(library.wca_id, '') AS wca_id,
            COALESCE(NULLIF(library.gender, ''), '未知') AS gender,
            best.score::text, best.age_group, best.meet_title, best.week_number, best.date_label,
            COALESCE(participation.weeks, 0)::integer AS participation_weeks
       FROM best
       JOIN weekly_player_library library ON library.id = best.player_id
       LEFT JOIN participation ON participation.player_id = best.player_id
      WHERE ${weeklyV2PlayerSourceSql("library")}
      ORDER BY best.score ${direction}, library.name ASC`,
    [WEEKLY_OVERALL_RESULTS_START, event.eventCode, event.countEvent]
  );

  return rows.map((row) => ({
    rank: Number(row.rank),
    playerId: row.player_id,
    playerName: row.player_name,
    weeklyNumber: row.weekly_number,
    wcaId: row.wca_id || "",
    gender: row.gender === "男" || row.gender === "女" ? row.gender : "未知",
    score: Number(row.score),
    ageGroup: row.age_group || "",
    meetTitle: row.meet_title,
    weekNumber: row.week_number,
    dateLabel: row.date_label,
    participationWeeks: row.participation_weeks
  }));
}
