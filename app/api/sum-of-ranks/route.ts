import { NextRequest, NextResponse } from "next/server";
import { wcaRankingCacheHeaders } from "@/lib/http-cache";
import { readLocalProfiles } from "@/lib/local-profile-store";
import { getPostgresPool } from "@/lib/postgres";

const pageSize = 50;
const singleEvents = ["333", "222", "444", "555", "666", "777", "333bf", "333fm", "333oh", "clock", "minx", "pyram", "skewb", "sq1", "444bf", "555bf", "333mbf"];
const averageEvents = singleEvents.filter((eventId) => eventId !== "333mbf");

const eventNames: Record<string, string> = {
  "333": "3x3x3 Cube",
  "222": "2x2x2 Cube",
  "444": "4x4x4 Cube",
  "555": "5x5x5 Cube",
  "666": "6x6x6 Cube",
  "777": "7x7x7 Cube",
  "333bf": "3x3x3 Blindfolded",
  "333fm": "3x3x3 Fewest Moves",
  "333oh": "3x3x3 One-Handed",
  clock: "Clock",
  minx: "Megaminx",
  pyram: "Pyraminx",
  skewb: "Skewb",
  sq1: "Square-1",
  "444bf": "4x4x4 Blindfolded",
  "555bf": "5x5x5 Blindfolded",
  "333mbf": "3x3x3 Multi-Blind"
};

const rankingTables = {
  single: "wca_ranks_single",
  average: "wca_ranks_average"
};

const regionLabels = {
  world: "世界",
  asia: "亚洲",
  china: "中国",
  liaoning: "辽宁"
};

type RankingMode = keyof typeof rankingTables;
type Region = keyof typeof regionLabels;

type RawSumRow = {
  rank: number;
  wcaId: string;
  name: string;
  country: string;
  countryName: string;
  countryIso2: string | null;
  sum: number;
  ranksByEvent: Record<string, number>;
  missingByEvent: Record<string, boolean>;
};

export const dynamic = "force-dynamic";

function cleanMode(value: string | null): RankingMode {
  return value === "single" ? "single" : "average";
}

function cleanRegion(value: string | null): Region {
  return value === "world" || value === "asia" || value === "china" || value === "liaoning" ? value : "world";
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = cleanMode(params.get("type"));
  const region = cleanRegion(params.get("region"));
  const page = Math.max(1, Math.min(500, Number(params.get("page") || 1) || 1));
  const offset = (page - 1) * pageSize;
  const eventIds = mode === "single" ? singleEvents : averageEvents;
  const rankingTable = rankingTables[mode];

  const rawRows = region === "liaoning"
    ? await queryLocalSumOfRanks(rankingTable, eventIds, pageSize + 1, offset)
    : await queryOfficialSumOfRanks(rankingTable, eventIds, region, pageSize + 1, offset);

  const rows = rawRows.slice(0, pageSize).map((row) => ({
    ...row,
    ranksByEvent: row.ranksByEvent || {},
    missingByEvent: row.missingByEvent || {}
  }));

  return NextResponse.json(
    {
      rows,
      page,
      pageSize,
      hasNextPage: rawRows.length > pageSize,
      mode,
      region,
      regionLabel: regionLabels[region],
      events: eventIds.map((id) => ({ id, name: eventNames[id] || id }))
    },
    { headers: wcaRankingCacheHeaders }
  );
}

async function queryOfficialSumOfRanks(rankingTable: string, eventIds: string[], region: Region, limit: number, offset: number) {
  const rankColumn = region === "world" ? "world_rank" : region === "asia" ? "continent_rank" : "country_rank";
  const regionWhere = region === "world" ? "" : region === "asia" ? "AND cn.continent_id = '_Asia'" : "AND p.country_id = 'China'";

  const sql = `
    WITH event_ids AS (
      SELECT * FROM unnest($1::text[]) WITH ORDINALITY AS event_ids(event_id, event_order)
    ),
    filtered_ranks AS (
      SELECT
        r.person_id,
        r.event_id,
        r.${rankColumn}::int AS region_rank,
        p.name,
        p.country_id,
        COALESCE(cn.name, p.country_id) AS country_name,
        cn.iso2 AS country_iso2
      FROM ${rankingTable} r
      JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
      LEFT JOIN wca_countries cn ON cn.id = p.country_id
      JOIN event_ids e ON e.event_id = r.event_id
      WHERE r.${rankColumn}::int > 0
        ${regionWhere}
    ),
    penalties AS (
      SELECT event_id, MAX(region_rank) + 1 AS penalty
      FROM filtered_ranks
      GROUP BY event_id
    ),
    participants AS (
      SELECT DISTINCT person_id, name, country_id, country_name, country_iso2
      FROM filtered_ranks
    ),
    participant_count AS (
      SELECT COUNT(*)::int AS total
      FROM participants
    ),
    scored AS (
      SELECT
        participant.person_id AS "wcaId",
        participant.name,
        participant.country_id AS country,
        participant.country_name AS "countryName",
        participant.country_iso2 AS "countryIso2",
        SUM(COALESCE(rank_row.region_rank, penalty.penalty, participant_count.total + 1))::int AS sum,
        jsonb_object_agg(event_ids.event_id, COALESCE(rank_row.region_rank, penalty.penalty, participant_count.total + 1) ORDER BY event_ids.event_order) AS "ranksByEvent",
        jsonb_object_agg(event_ids.event_id, rank_row.region_rank IS NULL ORDER BY event_ids.event_order) AS "missingByEvent"
      FROM participants participant
      CROSS JOIN event_ids
      CROSS JOIN participant_count
      LEFT JOIN filtered_ranks rank_row ON rank_row.person_id = participant.person_id AND rank_row.event_id = event_ids.event_id
      LEFT JOIN penalties penalty ON penalty.event_id = event_ids.event_id
      GROUP BY participant.person_id, participant.name, participant.country_id, participant.country_name, participant.country_iso2
    ),
    ordered AS (
      SELECT
        ROW_NUMBER() OVER (ORDER BY sum, name, "wcaId")::int AS rank,
        *
      FROM scored
    )
    SELECT *
    FROM ordered
    ORDER BY rank
    LIMIT $2 OFFSET $3
  `;

  const result = await getPostgresPool().query<RawSumRow>(sql, [eventIds, limit, offset]);
  return result.rows;
}

async function queryLocalSumOfRanks(rankingTable: string, eventIds: string[], limit: number, offset: number) {
  const localProfiles = await readLocalProfiles();
  const wcaIds = localProfiles
    .filter((profile) => profile.visible && profile.province === "辽宁" && profile.wcaId)
    .map((profile) => profile.wcaId as string);

  if (wcaIds.length === 0) return [];

  const sql = `
    WITH event_ids AS (
      SELECT * FROM unnest($1::text[]) WITH ORDINALITY AS event_ids(event_id, event_order)
    ),
    local_people AS (
      SELECT unnest($2::text[]) AS person_id
    ),
    raw_ranks AS (
      SELECT
        r.person_id,
        r.event_id,
        r.best::int AS best,
        r.world_rank::int AS world_rank,
        p.name,
        p.country_id,
        COALESCE(cn.name, p.country_id) AS country_name,
        cn.iso2 AS country_iso2
      FROM ${rankingTable} r
      JOIN local_people local_person ON local_person.person_id = r.person_id
      JOIN event_ids e ON e.event_id = r.event_id
      JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
      LEFT JOIN wca_countries cn ON cn.id = p.country_id
    ),
    filtered_ranks AS (
      SELECT
        person_id,
        event_id,
        RANK() OVER (PARTITION BY event_id ORDER BY best)::int AS region_rank,
        name,
        country_id,
        country_name,
        country_iso2
      FROM raw_ranks
    ),
    penalties AS (
      SELECT event_id, MAX(region_rank) + 1 AS penalty
      FROM filtered_ranks
      GROUP BY event_id
    ),
    participants AS (
      SELECT DISTINCT person_id, name, country_id, country_name, country_iso2
      FROM filtered_ranks
    ),
    scored AS (
      SELECT
        participant.person_id AS "wcaId",
        participant.name,
        participant.country_id AS country,
        participant.country_name AS "countryName",
        participant.country_iso2 AS "countryIso2",
        SUM(COALESCE(rank_row.region_rank, penalty.penalty, 1))::int AS sum,
        jsonb_object_agg(event_ids.event_id, COALESCE(rank_row.region_rank, penalty.penalty, 1) ORDER BY event_ids.event_order) AS "ranksByEvent",
        jsonb_object_agg(event_ids.event_id, rank_row.region_rank IS NULL ORDER BY event_ids.event_order) AS "missingByEvent"
      FROM participants participant
      CROSS JOIN event_ids
      LEFT JOIN filtered_ranks rank_row ON rank_row.person_id = participant.person_id AND rank_row.event_id = event_ids.event_id
      LEFT JOIN penalties penalty ON penalty.event_id = event_ids.event_id
      GROUP BY participant.person_id, participant.name, participant.country_id, participant.country_name, participant.country_iso2
    ),
    ordered AS (
      SELECT
        ROW_NUMBER() OVER (ORDER BY sum, name, "wcaId")::int AS rank,
        *
      FROM scored
    )
    SELECT *
    FROM ordered
    ORDER BY rank
    LIMIT $3 OFFSET $4
  `;

  const result = await getPostgresPool().query<RawSumRow>(sql, [eventIds, wcaIds, limit, offset]);
  return result.rows;
}
