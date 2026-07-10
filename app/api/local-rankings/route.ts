import { NextRequest, NextResponse } from "next/server";
import { wcaRankingCacheHeaders } from "@/lib/http-cache";
import { readLocalProfiles } from "@/lib/local-profile-store";
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

function cleanText(value: string | null, fallback: string) {
  return value || fallback;
}

function cleanMode(value: string | null) {
  return value === "single" ? "single" : "average";
}

function cleanGender(value: string | null) {
  return value === "m" || value === "f" ? value : "all";
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

type LocalRankSnapshotRow = {
  personId: string;
  best: number;
  countryRank: number;
  worldRank: number;
  province: string;
  city: string;
  gender: string;
};

type PreviousRankInfo = {
  localRank: number;
  officialRank: number;
  worldRank: number;
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const event = cleanId(params.get("event"), "333");
  const mode = cleanMode(params.get("mode"));
  const gender = cleanGender(params.get("gender"));
  const province = cleanText(params.get("province"), "辽宁");
  const city = cleanText(params.get("city"), "沈阳");
  const scope = params.get("scope") === "province" ? "province" : "city";
  let page = Math.max(1, Math.min(5000, Number(params.get("page") || 1) || 1));
  const selectedWcaId = (params.get("wcaId") || "").trim().toUpperCase();
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

  if (selectedWcaId && wcaIds.includes(selectedWcaId)) {
    const selectedGender = gender === "all" ? [] : [gender];
    const positionResult = await getPostgresPool().query<{ position: number }>(
      `
        SELECT ranked.position::int
        FROM (
          SELECT
            r.person_id,
            ROW_NUMBER() OVER (ORDER BY r.best::int, r.world_rank::int, r.person_id) AS position
          FROM ${rankingTables[mode]} r
          JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
          WHERE r.event_id = $1
            AND r.person_id = ANY($2::text[])
            AND r.country_rank::int > 0
            ${gender === "all" ? "" : "AND p.gender = $3"}
        ) ranked
        WHERE ranked.person_id = $${gender === "all" ? 3 : 4}
        LIMIT 1
      `,
      [event, wcaIds, ...selectedGender, selectedWcaId]
    );
    const position = positionResult.rows[0]?.position;
    if (position) page = Math.ceil(position / pageSize);
  }

  const offset = (page - 1) * pageSize;

  const localInfo = new Map(selectedWcaProfiles.map((profile) => [profile.wcaId as string, profile]));
  const queryParams: (string | string[] | number)[] = [event, wcaIds];
  if (gender !== "all") queryParams.push(gender);
  queryParams.push(pageSize + 1, offset);
  const limitParam = queryParams.length - 1;
  const offsetParam = queryParams.length;
  const rankingTable = rankingTables[mode];
  const resultColumn = mode === "average" ? "average" : "best";
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
        cn.iso2 AS "countryIso2",
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
      page_ranks."countryIso2",
      page_ranks.gender,
      page_ranks.best,
      ${genderRankSelect}
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
      cn.iso2 AS "countryIso2",
      p.gender AS gender,
      r.best::int AS best,
      NULL::int AS "genderOfficialRank",
      NULL::int AS "genderWorldRank",
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

  const previousRanks = await readPreviousLocalRanks({
    event,
    mode,
    province,
    city,
    scope,
    gender,
    wcaIds
  });

  const rows = rawRows.slice(0, pageSize).map((row, index) => {
    const profile = localInfo.get(row.wcaId);
    const previous = previousRanks.get(row.wcaId);
    const rank = offset + index + 1;
    return {
      ...row,
      rank,
      rankChange: formatRankChange(previous?.localRank, rank),
      officialRankChange: formatRankChange(previous?.officialRank, row.officialRank),
      worldRankChange: formatRankChange(previous?.worldRank, row.worldRank),
      genderLocalRank: gender === "all" ? null : rank,
      genderOfficialRank: row.genderOfficialRank,
      genderWorldRank: row.genderWorldRank,
      result: formatWcaResult(event, row.best, mode),
      resultDetails:
        mode === "average"
          ? [row.value1, row.value2, row.value3, row.value4, row.value5]
              .filter((value): value is number => typeof value === "number")
              .map((value) => formatWcaAttempt(event, value))
          : [],
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

async function readPreviousLocalRanks({
  event,
  mode,
  province,
  city,
  scope,
  gender,
  wcaIds
}: {
  event: string;
  mode: "single" | "average";
  province: string;
  city: string;
  scope: "province" | "city";
  gender: "all" | "m" | "f";
  wcaIds: string[];
}) {
  const previousRanks = new Map<string, PreviousRankInfo>();
  if (wcaIds.length === 0) return previousRanks;

  try {
    const previousExport = await getPostgresPool().query<{ export_date: string }>(
      `
        SELECT DISTINCT export_date
        FROM wca_local_rank_snapshots
        WHERE mode = $1 AND event_id = $2
        ORDER BY export_date DESC
        OFFSET 1
        LIMIT 1
      `,
      [mode, event]
    );
    const previousExportDate = previousExport.rows[0]?.export_date;
    if (!previousExportDate) return previousRanks;

    const result = await getPostgresPool().query<LocalRankSnapshotRow>(
      `
        SELECT
          person_id AS "personId",
          best,
          country_rank AS "countryRank",
          world_rank AS "worldRank",
          province,
          city,
          gender
        FROM wca_local_rank_snapshots
        WHERE export_date = $1
          AND mode = $2
          AND event_id = $3
          AND person_id = ANY($4::text[])
          AND province = $5
          ${scope === "city" ? "AND city = $6" : ""}
          ${gender === "all" ? "" : `AND gender = $${scope === "city" ? 7 : 6}`}
      `,
      [
        previousExportDate,
        mode,
        event,
        wcaIds,
        province,
        ...(scope === "city" ? [city] : []),
        ...(gender === "all" ? [] : [gender])
      ]
    );
    result.rows
      .sort((a, b) => a.best - b.best || a.worldRank - b.worldRank || a.personId.localeCompare(b.personId))
      .forEach((row, index) => {
        previousRanks.set(row.personId, {
          localRank: index + 1,
          officialRank: row.countryRank,
          worldRank: row.worldRank
        });
      });
  } catch {
    return previousRanks;
  }

  return previousRanks;
}

function formatRankChange(previous: number | undefined, current: number | null) {
  if (!previous || typeof current !== "number" || !Number.isFinite(current)) return null;
  return previous - current;
}
