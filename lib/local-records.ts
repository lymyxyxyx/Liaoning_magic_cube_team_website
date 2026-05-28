import { getCubingCompetitionNameZhByWcaId } from "@/lib/cubing-competition-name";
import { formatWcaEventName } from "@/lib/format";
import { readLocalProfiles } from "@/lib/local-profile-store";
import { getPostgresPool } from "@/lib/postgres";
import { formatWcaAttempt, formatWcaResult } from "@/lib/wca-result-format";

type RecordMode = "single" | "average";

type RawRecordRow = {
  mode: RecordMode;
  eventId: string;
  eventName: string;
  eventRank: number;
  wcaId: string;
  name: string;
  gender: string;
  province: string;
  city: string;
  best: number;
  worldRank: number;
  countryRank: number;
  competitionId: string | null;
  competitionName: string | null;
  date: string | null;
  value1: number | null;
  value2: number | null;
  value3: number | null;
  value4: number | null;
  value5: number | null;
};

export type LocalRecordResult = {
  mode: RecordMode;
  value: string;
  personName: string;
  wcaId: string;
  gender: string;
  province: string;
  city: string;
  worldRank: number;
  countryRank: number;
  competitionId: string;
  competitionName: string;
  competitionNameZh: string;
  date: string;
  attempts: string[];
};

export type LocalRecordEvent = {
  eventId: string;
  eventName: string;
  eventNameZh: string;
  eventRank: number;
  single?: LocalRecordResult;
  average?: LocalRecordResult;
};

function buildRecordSql(tableName: "wca_ranks_single" | "wca_ranks_average", mode: RecordMode) {
  const resultColumn = mode === "average" ? "average" : "best";
  return `
    WITH local_profiles AS (
      SELECT *
      FROM jsonb_to_recordset($1::jsonb)
        AS profile(wca_id text, province text, city text)
    )
    SELECT DISTINCT ON (rank.event_id)
      $2::text AS mode,
      rank.event_id AS "eventId",
      COALESCE(event.name, rank.event_id) AS "eventName",
      COALESCE(event.rank::int, 9999) AS "eventRank",
      rank.person_id AS "wcaId",
      person.name AS name,
      person.gender AS gender,
      local_profiles.province AS province,
      local_profiles.city AS city,
      rank.best::int AS best,
      rank.world_rank::int AS "worldRank",
      rank.country_rank::int AS "countryRank",
      COALESCE(best_result.competition_id, '') AS "competitionId",
      COALESCE(competition.name, best_result.competition_id, '') AS "competitionName",
      best_result.value1,
      best_result.value2,
      best_result.value3,
      best_result.value4,
      best_result.value5,
      CASE
        WHEN competition.id IS NULL THEN ''
        ELSE CONCAT(competition.year, '-', LPAD(competition.month, 2, '0'), '-', LPAD(competition.day, 2, '0'))
      END AS date
    FROM local_profiles
    JOIN ${tableName} rank ON rank.person_id = local_profiles.wca_id
    JOIN wca_persons person ON person.wca_id = rank.person_id AND person.sub_id = '1'
    LEFT JOIN wca_events event ON event.id = rank.event_id
    LEFT JOIN LATERAL (
      SELECT
        result.competition_id,
        (
          SELECT attempt.value::int
          FROM wca_result_attempts attempt
          WHERE attempt.result_id = result.id AND attempt.attempt_number = '1'
          LIMIT 1
        ) AS value1,
        (
          SELECT attempt.value::int
          FROM wca_result_attempts attempt
          WHERE attempt.result_id = result.id AND attempt.attempt_number = '2'
          LIMIT 1
        ) AS value2,
        (
          SELECT attempt.value::int
          FROM wca_result_attempts attempt
          WHERE attempt.result_id = result.id AND attempt.attempt_number = '3'
          LIMIT 1
        ) AS value3,
        (
          SELECT attempt.value::int
          FROM wca_result_attempts attempt
          WHERE attempt.result_id = result.id AND attempt.attempt_number = '4'
          LIMIT 1
        ) AS value4,
        (
          SELECT attempt.value::int
          FROM wca_result_attempts attempt
          WHERE attempt.result_id = result.id AND attempt.attempt_number = '5'
          LIMIT 1
        ) AS value5
      FROM wca_results result
      LEFT JOIN wca_competitions result_competition ON result_competition.id = result.competition_id
      WHERE result.person_id = rank.person_id
        AND result.event_id = rank.event_id
        AND result.${resultColumn} = rank.best
        AND result.${resultColumn} NOT IN ('0', '-1', '-2')
      ORDER BY
        result_competition.year::int DESC NULLS LAST,
        result_competition.month::int DESC NULLS LAST,
        result_competition.day::int DESC NULLS LAST,
        result.competition_id
      LIMIT 1
    ) best_result ON true
    LEFT JOIN wca_competitions competition ON competition.id = best_result.competition_id
    WHERE rank.best::int > 0
      AND rank.world_rank::int > 0
      AND rank.country_rank::int > 0
    ORDER BY rank.event_id, rank.world_rank::int, rank.best::int, rank.person_id
  `;
}

export async function getLiaoningRecords(): Promise<LocalRecordEvent[]> {
  const localProfiles = await readLocalProfiles();
  const profiles = localProfiles
    .filter((profile) => profile.visible && profile.wcaId)
    .map((profile) => ({
      wca_id: profile.wcaId,
      province: profile.province,
      city: profile.city
    }));

  if (profiles.length === 0) return [];

  const pool = getPostgresPool();
  const [singleResult, averageResult] = await Promise.all([
    pool.query<RawRecordRow>(buildRecordSql("wca_ranks_single", "single"), [JSON.stringify(profiles), "single"]),
    pool.query<RawRecordRow>(buildRecordSql("wca_ranks_average", "average"), [JSON.stringify(profiles), "average"])
  ]);

  const events = new Map<string, LocalRecordEvent>();

  for (const row of [...singleResult.rows, ...averageResult.rows]) {
    const current =
      events.get(row.eventId) ||
      ({
        eventId: row.eventId,
        eventName: row.eventName,
        eventNameZh: formatWcaEventName(row.eventId, row.eventName),
        eventRank: row.eventRank
      } satisfies LocalRecordEvent);

    current[row.mode] = normalizeRecord(row);
    events.set(row.eventId, current);
  }

  return Array.from(events.values()).sort((a, b) => a.eventRank - b.eventRank || a.eventId.localeCompare(b.eventId));
}

function normalizeRecord(row: RawRecordRow): LocalRecordResult {
  const competitionId = row.competitionId || "";
  const competitionName = row.competitionName || "";
  const attempts = [row.value1, row.value2, row.value3, row.value4, row.value5]
    .filter((value): value is number => typeof value === "number")
    .map((value) => formatWcaAttempt(row.eventId, value));

  return {
    mode: row.mode,
    value: formatWcaResult(row.eventId, row.best, row.mode),
    personName: row.name,
    wcaId: row.wcaId,
    gender: row.gender,
    province: row.province,
    city: row.city,
    worldRank: row.worldRank,
    countryRank: row.countryRank,
    competitionId,
    competitionName,
    competitionNameZh: getCubingCompetitionNameZhByWcaId(competitionId, competitionName) || competitionName,
    date: row.date || "",
    attempts
  };
}
