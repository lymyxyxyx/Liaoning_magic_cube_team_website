import { getCubingCompetitionNameZhByWcaId } from "@/lib/cubing-competition-name";
import { readLocalProfiles } from "@/lib/local-profile-store";
import { getPostgresPool } from "@/lib/postgres";

export type LiaoningCompetition = {
  id: string;
  name: string;
  nameZh: string;
  date: string;
  year: number;
  city: string;
  country: string;
  playerCount: number;
  playerNames: string[];
};

type RawCompetitionRow = {
  id: string;
  name: string;
  year: string | null;
  month: string | null;
  day: string | null;
  city: string | null;
  country: string | null;
  playerCount: number;
  playerNames: string[] | null;
};

// Rich query with city/country. The WCA importer creates columns straight from
// the export's TSV headers, and the exact names of the optional location columns
// are not guaranteed across export versions, so a fallback query without them is
// used when this one fails (same defensive pattern as the local-rankings route).
const richSql = `
  SELECT
    c.id AS id,
    c.name AS name,
    c.year AS year,
    c.month AS month,
    c.day AS day,
    c.city_name AS city,
    c.country_id AS country,
    COUNT(DISTINCT r.person_id)::int AS "playerCount",
    array_agg(DISTINCT p.name) AS "playerNames"
  FROM wca_competitions c
  JOIN wca_results r ON r.competition_id = c.id
  JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
  WHERE r.person_id = ANY($1::text[])
  GROUP BY c.id, c.name, c.year, c.month, c.day, c.city_name, c.country_id
  ORDER BY c.year::int DESC NULLS LAST, c.month::int DESC NULLS LAST, c.day::int DESC NULLS LAST, c.id
`;

const fallbackSql = `
  SELECT
    c.id AS id,
    c.name AS name,
    c.year AS year,
    c.month AS month,
    c.day AS day,
    NULL::text AS city,
    NULL::text AS country,
    COUNT(DISTINCT r.person_id)::int AS "playerCount",
    array_agg(DISTINCT p.name) AS "playerNames"
  FROM wca_competitions c
  JOIN wca_results r ON r.competition_id = c.id
  JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
  WHERE r.person_id = ANY($1::text[])
  GROUP BY c.id, c.name, c.year, c.month, c.day
  ORDER BY c.year::int DESC NULLS LAST, c.month::int DESC NULLS LAST, c.day::int DESC NULLS LAST, c.id
`;

function pad(value: string | null) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "";
  return String(num).padStart(2, "0");
}

function formatDate(year: string | null, month: string | null, day: string | null) {
  const y = Number(year);
  if (!Number.isFinite(y) || y <= 0) return "";
  const m = pad(month);
  const d = pad(day);
  return [String(y), m, d].filter(Boolean).join("-");
}

/**
 * WCA competitions that Liaoning local players have competed in, derived from the
 * synced `wca_competitions` / `wca_results` tables joined against the local
 * Liaoning player profiles. Returns an empty list when the database is
 * unavailable (e.g. local dev without DATABASE_URL) so callers never crash.
 */
export async function getLiaoningCompetitions(): Promise<LiaoningCompetition[]> {
  const profiles = await readLocalProfiles();
  const wcaIds = Array.from(
    new Set(
      profiles
        .filter((profile) => profile.visible && profile.wcaId && profile.province === "辽宁")
        .map((profile) => profile.wcaId as string)
    )
  );

  if (wcaIds.length === 0) return [];

  let rows: RawCompetitionRow[];
  try {
    const result = await getPostgresPool().query<RawCompetitionRow>(richSql, [wcaIds]);
    rows = result.rows;
  } catch (richError) {
    try {
      const result = await getPostgresPool().query<RawCompetitionRow>(fallbackSql, [wcaIds]);
      rows = result.rows;
    } catch (fallbackError) {
      console.error("Liaoning competitions query failed.", fallbackError || richError);
      return [];
    }
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    nameZh: getCubingCompetitionNameZhByWcaId(row.id, row.name) || row.name,
    date: formatDate(row.year, row.month, row.day),
    year: Number(row.year) || 0,
    city: row.city || "",
    country: row.country || "",
    playerCount: row.playerCount,
    playerNames: (row.playerNames || []).filter(Boolean).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))
  }));
}
