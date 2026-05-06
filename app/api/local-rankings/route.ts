import { NextRequest, NextResponse } from "next/server";
import { wcaRankingCacheHeaders } from "@/lib/http-cache";
import { readLocalProfiles } from "@/lib/local-profile-store";
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

function cleanText(value: string | null, fallback: string) {
  return value || fallback;
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

type RawLocalRankingRow = {
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
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const event = cleanId(params.get("event"), "333");
  const mode = cleanMode(params.get("mode"));
  const gender = cleanGender(params.get("gender"));
  const province = cleanText(params.get("province"), "辽宁");
  const city = cleanText(params.get("city"), "沈阳");
  const scope = params.get("scope") === "province" ? "province" : "city";
  const page = Math.max(1, Math.min(5000, Number(params.get("page") || 1) || 1));
  const offset = (page - 1) * pageSize;
  const genderWhere = gender === "all" ? "" : "AND p.gender = $3";
  const localProfiles = await readLocalProfiles();
  const visibleProfiles = localProfiles.filter((profile) => profile.visible);
  const provinces = Array.from(new Set(visibleProfiles.map((profile) => profile.province)));
  const cities = Array.from(
    new Set(visibleProfiles.filter((profile) => profile.province === province).map((profile) => profile.city))
  );
  const selectedProfiles = visibleProfiles.filter(
    (profile) =>
      profile.province === province &&
      (scope === "province" || profile.city === city)
  );
  const selectedWcaProfiles = selectedProfiles.filter((profile) => profile.wcaId);
  const wcaIds = selectedWcaProfiles.map((profile) => profile.wcaId as string);

  if (wcaIds.length === 0) {
    return NextResponse.json(
      {
        rows: [],
        page,
        pageSize,
        hasNextPage: false,
        provinces,
        cities
      },
      { headers: wcaRankingCacheHeaders }
    );
  }

  const localInfo = new Map(selectedWcaProfiles.map((profile) => [profile.wcaId as string, profile]));
  const queryParams: (string | string[] | number)[] = [event, wcaIds];
  if (gender !== "all") queryParams.push(gender);
  queryParams.push(pageSize + 1, offset);
  const limitParam = queryParams.length - 1;
  const offsetParam = queryParams.length;
  const rankingTable = rankingTables[mode];
  const resultColumn = mode === "average" ? "average" : "best";
  const genderRankSelect =
    gender === "all"
      ? `
        NULL::int AS "genderOfficialRank",
        NULL::int AS "genderWorldRank",
      `
      : `
        (
          SELECT COUNT(*)::int + 1
          FROM ${rankingTable} gender_rank
          JOIN wca_persons gender_person ON gender_person.wca_id = gender_rank.person_id AND gender_person.sub_id = '1'
          WHERE gender_rank.event_id = page_ranks.event_id
            AND gender_person.country_id = page_ranks.country
            AND gender_person.gender = page_ranks.gender
            AND gender_rank.country_rank::int > 0
            AND gender_rank.country_rank::int < page_ranks."officialRank"
        ) AS "genderOfficialRank",
        (
          SELECT COUNT(*)::int + 1
          FROM ${rankingTable} gender_rank
          JOIN wca_persons gender_person ON gender_person.wca_id = gender_rank.person_id AND gender_person.sub_id = '1'
          WHERE gender_rank.event_id = page_ranks.event_id
            AND gender_person.gender = page_ranks.gender
            AND gender_rank.world_rank::int > 0
            AND gender_rank.world_rank::int < page_ranks."worldRank"
        ) AS "genderWorldRank",
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
      CASE
        WHEN c.id IS NULL THEN ''
        ELSE CONCAT(c.year, '-', LPAD(c.month, 2, '0'), '-', LPAD(c.day, 2, '0'))
      END AS date
    FROM page_ranks
    LEFT JOIN LATERAL (
      SELECT result.competition_id
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

  const fallbackSql = `
    SELECT
      r.country_rank::int AS "officialRank",
      r.world_rank::int AS "worldRank",
      r.person_id AS "wcaId",
      p.name AS name,
      p.country_id AS country,
      COALESCE(cn.name, p.country_id) AS "countryName",
      p.gender AS gender,
      r.best::int AS best,
      NULL::int AS "genderOfficialRank",
      NULL::int AS "genderWorldRank",
      '' AS "competitionId",
      '' AS "competitionName",
      '' AS date
    FROM ${rankingTable} r
    JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
    LEFT JOIN wca_countries cn ON cn.id = p.country_id
    WHERE r.event_id = $1
      AND r.person_id = ANY($2::text[])
      AND r.country_rank::int > 0
      ${genderWhere}
    ORDER BY r.best::int, r.world_rank::int, r.person_id
    LIMIT $${limitParam} OFFSET $${offsetParam}
  `;

  let rawRows: RawLocalRankingRow[];
  try {
    const result = await getPostgresPool().query<RawLocalRankingRow>(sqlWithCompetition, queryParams);
    rawRows = result.rows;
  } catch (error) {
    console.error("Local ranking competition lookup failed; falling back to rank-only query.", error);
    const result = await getPostgresPool().query<RawLocalRankingRow>(fallbackSql, queryParams);
    rawRows = result.rows;
  }

  const rows = rawRows.slice(0, pageSize).map((row, index) => {
    const profile = localInfo.get(row.wcaId);
    return {
      ...row,
      rank: offset + index + 1,
      genderLocalRank: gender === "all" ? null : offset + index + 1,
      genderOfficialRank: row.genderOfficialRank,
      genderWorldRank: row.genderWorldRank,
      result: formatResult(event, row.best),
      competitionId: row.competitionId || "",
      competitionName: row.competitionName || "",
      date: row.date || "",
      province: profile?.province || province,
      city: profile?.city || city
    };
  });

  return NextResponse.json(
    {
      rows,
      page,
      pageSize,
      hasNextPage: rawRows.length > pageSize,
      provinces,
      cities
    },
    { headers: wcaRankingCacheHeaders }
  );
}
