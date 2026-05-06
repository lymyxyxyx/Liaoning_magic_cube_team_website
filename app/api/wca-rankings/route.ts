import { NextRequest, NextResponse } from "next/server";
import { wcaRankingCacheHeaders } from "@/lib/http-cache";
import { getPostgresPool } from "@/lib/postgres";

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
  return value === "average" ? "average" : "single";
}

function cleanGender(value: string | null) {
  return value === "m" || value === "f" ? value : "all";
}

function formatCentiseconds(value: number) {
  const minutes = Math.floor(value / 6000);
  const centiseconds = value % 6000;
  const seconds = centiseconds / 100;
  if (minutes > 0) return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
  return seconds.toFixed(2);
}

function formatResult(eventId: string, value: number) {
  if (eventId === "333fm") return String(value);
  return formatCentiseconds(value);
}

type RawRankingRow = {
  rank: number;
  worldRank: number;
  wcaId: string;
  name: string;
  country: string;
  countryName: string;
  gender: string;
  best: number;
  competitionId: string | null;
  competitionName: string | null;
  date: string | null;
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const event = cleanId(params.get("event"), "333");
  const country = cleanId(params.get("country"), "China");
  const mode = cleanMode(params.get("mode"));
  const gender = cleanGender(params.get("gender"));
  const page = Math.max(1, Math.min(5000, Number(params.get("page") || 1) || 1));
  const offset = (page - 1) * pageSize;
  const genderWhere = gender === "all" ? "" : "AND p.gender = $3";
  const queryParams: (string | number)[] = [event, country];
  if (gender !== "all") queryParams.push(gender);
  queryParams.push(pageSize + 1, offset);
  const limitParam = queryParams.length - 1;
  const offsetParam = queryParams.length;
  const rankingTable = rankingTables[mode];
  const resultColumn = mode === "average" ? "average" : "best";

  const sqlWithCompetition = `
    WITH page_ranks AS (
      SELECT
        r.country_rank::int AS rank,
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
        AND p.country_id = $2
        AND r.country_rank::int > 0
        ${genderWhere}
      ORDER BY r.country_rank::int, r.world_rank::int, r.person_id
      LIMIT $${limitParam} OFFSET $${offsetParam}
    )
    SELECT
      page_ranks.rank,
      page_ranks."worldRank",
      page_ranks."wcaId",
      page_ranks.name,
      page_ranks.country,
      page_ranks."countryName",
      page_ranks.gender,
      page_ranks.best,
      COALESCE(br.competition_id, '') AS "competitionId",
      COALESCE(c.name, br.competition_id, '') AS "competitionName",
      CASE
        WHEN c.id IS NULL THEN ''
        ELSE CONCAT(c.year, '-', LPAD(c.month, 2, '0'), '-', LPAD(c.day, 2, '0'))
      END AS date
    FROM page_ranks
    LEFT JOIN LATERAL (
      SELECT competition_id
      FROM wca_results result
      WHERE result.person_id = page_ranks."wcaId"
        AND result.event_id = page_ranks.event_id
        AND result.${resultColumn} = page_ranks.best::text
        AND result.${resultColumn} NOT IN ('0', '-1', '-2')
      ORDER BY result.year::int DESC, result.month::int DESC, result.day::int DESC, result.competition_id
      LIMIT 1
    ) br ON true
    LEFT JOIN wca_competitions c ON c.id = br.competition_id
    ORDER BY page_ranks.rank, page_ranks."worldRank", page_ranks."wcaId"
  `;

  const fallbackSql = `
    SELECT
      r.country_rank::int AS rank,
      r.world_rank::int AS "worldRank",
      r.person_id AS "wcaId",
      p.name AS name,
      p.country_id AS country,
      COALESCE(cn.name, p.country_id) AS "countryName",
      p.gender AS gender,
      r.best::int AS best,
      '' AS "competitionId",
      '' AS "competitionName",
      '' AS date
    FROM ${rankingTable} r
    JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
    LEFT JOIN wca_countries cn ON cn.id = p.country_id
    WHERE r.event_id = $1
      AND p.country_id = $2
      AND r.country_rank::int > 0
      ${genderWhere}
    ORDER BY r.country_rank::int, r.world_rank::int, r.person_id
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
    result: formatResult(event, row.best),
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
