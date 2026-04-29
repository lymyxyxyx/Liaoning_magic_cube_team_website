import { NextRequest, NextResponse } from "next/server";
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
  return seconds.toFixed(2).replace(/\.?0+$/, "");
}

function formatResult(eventId: string, value: number) {
  if (eventId === "333fm") return String(value);
  return formatCentiseconds(value);
}

type RawLocalRankingRow = {
  officialRank: number;
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
  const wcaIds = selectedProfiles.map((profile) => profile.wcaId);

  if (wcaIds.length === 0) {
    return NextResponse.json({
      rows: [],
      page,
      pageSize,
      hasNextPage: false,
      provinces,
      cities
    });
  }

  const localInfo = new Map(selectedProfiles.map((profile) => [profile.wcaId, profile]));
  const queryParams: (string | string[] | number)[] = [event, wcaIds];
  if (gender !== "all") queryParams.push(gender);
  queryParams.push(pageSize + 1, offset);
  const limitParam = queryParams.length - 1;
  const offsetParam = queryParams.length;
  const rankingTable = rankingTables[mode];
  const sql = `
    SELECT
      r.country_rank::int AS "officialRank",
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
    JOIN wca_persons p ON p.wca_id = r.person_id
    LEFT JOIN wca_countries cn ON cn.id = p.country_id
    WHERE r.event_id = $1
      AND r.person_id = ANY($2::text[])
      ${genderWhere}
    ORDER BY r.best::int, r.world_rank::int, r.person_id
    LIMIT $${limitParam} OFFSET $${offsetParam}
  `;

  const { rows: rawRows } = await getPostgresPool().query<RawLocalRankingRow>(sql, queryParams);
  const rows = rawRows.slice(0, pageSize).map((row, index) => {
    const profile = localInfo.get(row.wcaId);
    return {
      ...row,
      rank: offset + index + 1,
      result: formatResult(event, row.best),
      competitionId: row.competitionId || "",
      competitionName: row.competitionName || "",
      date: row.date || "",
      province: profile?.province || province,
      city: profile?.city || city
    };
  });

  return NextResponse.json({
    rows,
    page,
    pageSize,
    hasNextPage: rawRows.length > pageSize,
    provinces,
    cities
  });
}
