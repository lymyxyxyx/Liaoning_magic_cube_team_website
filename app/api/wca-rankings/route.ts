import { NextRequest, NextResponse } from "next/server";
import { wcaRankingCacheHeaders } from "@/lib/http-cache";
import { getPostgresPool } from "@/lib/postgres";
import { formatWcaAttempt, formatWcaResult } from "@/lib/wca-result-format";

const pageSize = 100;
const rankingTables = {
  single: "wca_ranks_single",
  average: "wca_ranks_average"
};

export const dynamic = "force-dynamic";

function cleanId(value: string | null, fallback: string) {
  const next = value || fallback;
  return /^[A-Za-z0-9_ -]+$/.test(next) ? next : fallback;
}

function cleanMode(value: string | null) {
  return value === "single" ? "single" : "average";
}

function cleanGender(value: string | null) {
  return value === "m" || value === "f" ? value : "all";
}

type RawRankingRow = {
  rank: number;
  worldRank: number;
  wcaId: string;
  name: string;
  country: string;
  countryName: string;
  countryIso2: string | null;
  gender: string;
  best: number;
  competitionId: string | null;
  competitionName: string | null;
  date: string | null;
  value1: number | null;
  value2: number | null;
  value3: number | null;
  value4: number | null;
  value5: number | null;
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const event = cleanId(params.get("event"), "333");
  const country = cleanId(params.get("country"), "China");
  const mode = cleanMode(params.get("mode"));
  const gender = cleanGender(params.get("gender"));
  const page = Math.max(1, Math.min(5000, Number(params.get("page") || 1) || 1));
  const offset = (page - 1) * pageSize;
  const isWorld = country === "WORLD";
  const isContinent = country.startsWith("CONTINENT:");
  const continentId = isContinent ? country.replace("CONTINENT:", "") : "";
  const locationWhere = isWorld
    ? ""
    : isContinent
      ? "AND cn.continent_id = $2"
      : "AND p.country_id = $2";
  const rankColumn = isWorld ? "world_rank" : isContinent ? "continent_rank" : "country_rank";
  const regionParam = isContinent ? continentId : country;
  const queryParams: (string | number)[] = [event];
  if (!isWorld) queryParams.push(regionParam);
  const genderWhere = gender === "all" ? "" : `AND p.gender = $${isWorld ? 2 : 3}`;
  if (gender !== "all") queryParams.push(gender);
  queryParams.push(pageSize + 1, offset);
  const limitParam = queryParams.length - 1;
  const offsetParam = queryParams.length;
  const rankingTable = rankingTables[mode];
  const resultColumn = mode === "average" ? "average" : "best";

  const sqlWithCompetition = `
    WITH page_ranks AS (
      SELECT
        r.${rankColumn}::int AS rank,
        r.world_rank::int AS "worldRank",
        r.person_id AS "wcaId",
        r.event_id,
        r.best::int AS best,
        p.name AS name,
        p.country_id AS country,
        COALESCE(cn.name, p.country_id) AS "countryName",
        cn.iso2 AS "countryIso2",
        p.gender AS gender
      FROM ${rankingTable} r
      JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
      LEFT JOIN wca_countries cn ON cn.id = p.country_id
      WHERE r.event_id = $1
        ${locationWhere}
        AND r.${rankColumn}::int > 0
        ${genderWhere}
      ORDER BY r.${rankColumn}::int, r.world_rank::int, r.person_id
      LIMIT $${limitParam} OFFSET $${offsetParam}
    )
    SELECT
      page_ranks.rank,
      page_ranks."worldRank",
      page_ranks."wcaId",
      page_ranks.name,
      page_ranks.country,
      page_ranks."countryName",
      page_ranks."countryIso2",
      page_ranks.gender,
      page_ranks.best,
      COALESCE(br.competition_id, '') AS "competitionId",
      COALESCE(c.name, br.competition_id, '') AS "competitionName",
      br.value1,
      br.value2,
      br.value3,
      br.value4,
      br.value5,
      CASE
        WHEN c.id IS NULL THEN ''
        ELSE CONCAT(c.year, '-', LPAD(c.month, 2, '0'), '-', LPAD(c.day, 2, '0'))
      END AS date
    FROM page_ranks
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
        ) AS value3
        ,(
          SELECT attempt.value::int
          FROM wca_result_attempts attempt
          WHERE attempt.result_id = result.id AND attempt.attempt_number = '4'
          LIMIT 1
        ) AS value4
        ,(
          SELECT attempt.value::int
          FROM wca_result_attempts attempt
          WHERE attempt.result_id = result.id AND attempt.attempt_number = '5'
          LIMIT 1
        ) AS value5
      FROM wca_results result
      LEFT JOIN wca_competitions result_competition ON result_competition.id = result.competition_id
      WHERE result.person_id = page_ranks."wcaId"
        AND result.event_id = page_ranks.event_id
        AND result.${resultColumn} = page_ranks.best::text
        AND result.${resultColumn} NOT IN ('0', '-1', '-2')
      ORDER BY
        result_competition.year::int DESC NULLS LAST,
        result_competition.month::int DESC NULLS LAST,
        result_competition.day::int DESC NULLS LAST,
        result.competition_id
      LIMIT 1
    ) br ON true
    LEFT JOIN wca_competitions c ON c.id = br.competition_id
    ORDER BY page_ranks.rank, page_ranks."worldRank", page_ranks."wcaId"
  `;

  const fallbackSql = `
    SELECT
      r.${rankColumn}::int AS rank,
      r.world_rank::int AS "worldRank",
      r.person_id AS "wcaId",
      p.name AS name,
      p.country_id AS country,
      COALESCE(cn.name, p.country_id) AS "countryName",
      cn.iso2 AS "countryIso2",
      p.gender AS gender,
      r.best::int AS best,
      '' AS "competitionId",
      '' AS "competitionName",
      '' AS date,
      NULL::int AS value1,
      NULL::int AS value2,
      NULL::int AS value3,
      NULL::int AS value4,
      NULL::int AS value5
    FROM ${rankingTable} r
    JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
    LEFT JOIN wca_countries cn ON cn.id = p.country_id
    WHERE r.event_id = $1
      ${locationWhere}
      AND r.${rankColumn}::int > 0
      ${genderWhere}
    ORDER BY r.${rankColumn}::int, r.world_rank::int, r.person_id
    LIMIT $${limitParam} OFFSET $${offsetParam}
  `;

  let rawRows: RawRankingRow[];
  try {
    const result = await getPostgresPool().query<RawRankingRow>(sqlWithCompetition, queryParams);
    rawRows = result.rows;
  } catch (error) {
    console.error("WCA ranking competition lookup failed; falling back to rank-only query.", error);
    const result = await getPostgresPool().query<RawRankingRow>(fallbackSql, queryParams);
    rawRows = result.rows;
  }

  const rows = rawRows.slice(0, pageSize).map((row) => ({
    ...row,
    result: formatWcaResult(event, row.best, mode),
    resultDetails:
      mode === "average"
        ? [row.value1, row.value2, row.value3]
            .concat([row.value4, row.value5])
            .filter((value): value is number => typeof value === "number")
            .map((value) => formatWcaAttempt(event, value))
        : [],
    competitionId: row.competitionId || "",
    competitionName: row.competitionName || "",
    date: row.date || ""
  }));

  return NextResponse.json(
    {
      rows,
      page,
      pageSize,
      hasNextPage: rawRows.length > pageSize
    },
    { headers: wcaRankingCacheHeaders }
  );
}
