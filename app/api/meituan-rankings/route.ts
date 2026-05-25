import { NextRequest, NextResponse } from "next/server";
import { wcaRankingCacheHeaders } from "@/lib/http-cache";
import { getVisibleMeituanProfiles } from "@/lib/meituan-profiles";
import { getPostgresPool } from "@/lib/postgres";
import { formatWcaAttempt, formatWcaResult } from "@/lib/wca-result-format";

const pageSize = 100;
const rankingTables = {
  single: "wca_ranks_single",
  average: "wca_ranks_average"
};

export const dynamic = "force-dynamic";

type RankingMode = keyof typeof rankingTables;
type Gender = "all" | "m" | "f";
type MemberScope = "all" | "current";

type RawMeituanRankingRow = {
  officialRank: number;
  worldRank: number;
  genderOfficialRank: number | null;
  genderWorldRank: number | null;
  wcaId: string;
  name: string;
  country: string;
  countryName: string;
  gender: string;
  best: number;
  competitionId: string | null;
  competitionName: string | null;
  date: string | null;
  value1: number | null;
  value2: number | null;
  value3: number | null;
};

function cleanId(value: string | null, fallback: string) {
  const next = value || fallback;
  return /^[A-Za-z0-9_ -]+$/.test(next) ? next : fallback;
}

function cleanMode(value: string | null): RankingMode {
  return value === "single" ? "single" : "average";
}

function cleanGender(value: string | null): Gender {
  return value === "m" || value === "f" ? value : "all";
}

function cleanMemberScope(value: string | null): MemberScope {
  return value === "current" ? "current" : "all";
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const event = cleanId(params.get("event"), "333");
  const mode = cleanMode(params.get("mode"));
  const gender = cleanGender(params.get("gender"));
  const memberScope = cleanMemberScope(params.get("memberScope"));
  const page = Math.max(1, Math.min(5000, Number(params.get("page") || 1) || 1));
  const offset = (page - 1) * pageSize;
  const profiles = getVisibleMeituanProfiles(memberScope);
  const profileByWcaId = new Map(profiles.map((profile) => [profile.wcaId, profile]));
  const wcaIds = Array.from(profileByWcaId.keys());

  if (wcaIds.length === 0) {
    return NextResponse.json(
      {
        rows: [],
        page,
        pageSize,
        hasNextPage: false,
        memberCount: 0
      },
      { headers: wcaRankingCacheHeaders }
    );
  }

  const rankingTable = rankingTables[mode];
  const resultColumn = mode === "average" ? "average" : "best";
  const genderWhere = gender === "all" ? "" : "AND p.gender = $3";
  const queryParams: (string | string[] | number)[] = [event, wcaIds];
  if (gender !== "all") queryParams.push(gender);
  queryParams.push(pageSize + 1, offset);
  const limitParam = queryParams.length - 1;
  const offsetParam = queryParams.length;
  const genderRankCtes =
    gender === "all"
      ? ""
      : `
    , gender_country_ranks AS (
      SELECT
        gender_rank.person_id,
        gender_person.country_id,
        (RANK() OVER (PARTITION BY gender_person.country_id ORDER BY gender_rank.best::int))::int AS "genderOfficialRank"
      FROM ${rankingTable} gender_rank
      JOIN wca_persons gender_person ON gender_person.wca_id = gender_rank.person_id AND gender_person.sub_id = '1'
      WHERE gender_rank.event_id = $1
        AND gender_person.gender = $3
        AND gender_rank.country_rank::int > 0
        AND gender_rank.best::int > 0
    )
    , gender_world_ranks AS (
      SELECT
        gender_rank.person_id,
        (RANK() OVER (ORDER BY gender_rank.best::int))::int AS "genderWorldRank"
      FROM ${rankingTable} gender_rank
      JOIN wca_persons gender_person ON gender_person.wca_id = gender_rank.person_id AND gender_person.sub_id = '1'
      WHERE gender_rank.event_id = $1
        AND gender_person.gender = $3
        AND gender_rank.world_rank::int > 0
        AND gender_rank.best::int > 0
    )
      `;
  const genderRankSelect =
    gender === "all"
      ? `
        NULL::int AS "genderOfficialRank",
        NULL::int AS "genderWorldRank",
      `
      : `
        gender_country_ranks."genderOfficialRank",
        gender_world_ranks."genderWorldRank",
      `;
  const genderRankJoins =
    gender === "all"
      ? ""
      : `
    LEFT JOIN gender_country_ranks
      ON gender_country_ranks.person_id = page_ranks."wcaId"
      AND gender_country_ranks.country_id = page_ranks.country
    LEFT JOIN gender_world_ranks ON gender_world_ranks.person_id = page_ranks."wcaId"
      `;
  const sqlWithCompetition = `
    WITH page_ranks AS (
      SELECT
        r.country_rank::int AS "officialRank",
        r.world_rank::int AS "worldRank",
        r.person_id AS "wcaId",
        r.event_id,
        r.best::int AS best,
        p.name AS name,
        p.country_id AS country,
        COALESCE(cn.name, p.country_id) AS "countryName",
        p.gender AS gender
      FROM ${rankingTable} r
      JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
      LEFT JOIN wca_countries cn ON cn.id = p.country_id
      WHERE r.event_id = $1
        AND r.person_id = ANY($2::text[])
        AND r.country_rank::int > 0
        ${genderWhere}
      ORDER BY r.best::int, r.world_rank::int, r.person_id
      LIMIT $${limitParam} OFFSET $${offsetParam}
    )
    ${genderRankCtes}
    SELECT
      page_ranks."officialRank",
      page_ranks."worldRank",
      page_ranks."wcaId",
      page_ranks.name,
      page_ranks.country,
      page_ranks."countryName",
      page_ranks.gender,
      page_ranks.best,
      ${genderRankSelect}
      COALESCE(br.competition_id, '') AS "competitionId",
      COALESCE(c.name, br.competition_id, '') AS "competitionName",
      br.value1,
      br.value2,
      br.value3,
      CASE
        WHEN c.id IS NULL THEN ''
        ELSE CONCAT(c.year, '-', LPAD(c.month, 2, '0'), '-', LPAD(c.day, 2, '0'))
      END AS date
    FROM page_ranks
    ${genderRankJoins}
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
    ORDER BY page_ranks.best, page_ranks."worldRank", page_ranks."wcaId"
  `;

  let resultRows: RawMeituanRankingRow[];
  let dbUnavailable = false;
  try {
    const result = await getPostgresPool().query<RawMeituanRankingRow>(sqlWithCompetition, queryParams);
    resultRows = result.rows;
  } catch (error) {
    console.error("Meituan ranking lookup failed.", error);
    resultRows = [];
    dbUnavailable = true;
  }

  const rows = resultRows.slice(0, pageSize).map((row, index) => ({
    ...row,
    rank: offset + index + 1,
    memberStatus: profileByWcaId.get(row.wcaId)?.status || "former",
    genderGroupRank: gender === "all" ? null : offset + index + 1,
    result: formatWcaResult(event, row.best, mode),
    resultDetails:
      event === "333fm" && mode === "average"
        ? [row.value1, row.value2, row.value3]
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
      hasNextPage: resultRows.length > pageSize,
      memberCount: wcaIds.length,
      dbUnavailable
    },
    { headers: wcaRankingCacheHeaders }
  );
}
