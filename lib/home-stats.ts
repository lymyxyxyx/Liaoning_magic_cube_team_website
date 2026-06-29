import { readFile } from "node:fs/promises";
import { readLocalProfiles } from "@/lib/local-profile-store";
import { getPostgresPool } from "@/lib/postgres";
import { formatWcaResult } from "@/lib/wca-result-format";

type TopAverageRow = {
  name: string;
  wcaId: string;
  best: number;
  gender: string;
  city?: string;
};

type China333RankingEntry = {
  wcaId: string;
  name: string;
  gender: string;
  result: string;
};

export type HomeStats = {
  playerCount: number;
  cities: HomeCityStats[];
  topMaleAverage?: {
    name: string;
    wcaId: string;
    result: string;
  };
  topFemaleAverage?: {
    name: string;
    wcaId: string;
    result: string;
  };
};

export type HomeCityStats = {
  city: string;
  playerCount: number;
  topMaleAverage?: HomeTopAverage;
  topFemaleAverage?: HomeTopAverage;
};

type HomeTopAverage = {
  name: string;
  wcaId: string;
  result: string;
};

export async function getHomeStats(): Promise<HomeStats> {
  const profiles = await readLocalProfiles();
  const visibleLiaoningProfiles = profiles.filter((profile) => profile.visible && profile.province === "辽宁");
  const wcaIds = visibleLiaoningProfiles.map((profile) => profile.wcaId).filter((id): id is string => Boolean(id));
  const playerCount = wcaIds.length;
  const cities = buildBaseCityStats(visibleLiaoningProfiles);

  if (wcaIds.length === 0) {
    return { playerCount, cities };
  }

  try {
    const { rows } = await getPostgresPool().query<TopAverageRow>(
      `
        WITH local_people AS (
          SELECT *
          FROM jsonb_to_recordset($1::jsonb) AS local(wca_id text, city text)
        ),
        ranked AS (
          SELECT
            local.city,
            p.name,
            p.wca_id AS "wcaId",
            p.gender,
            r.best::int AS best,
            ROW_NUMBER() OVER (PARTITION BY p.gender ORDER BY r.best::int, r.world_rank::int, p.wca_id) AS province_gender_rank,
            ROW_NUMBER() OVER (PARTITION BY local.city, p.gender ORDER BY r.best::int, r.world_rank::int, p.wca_id) AS city_gender_rank
          FROM local_people local
          JOIN wca_persons p ON p.wca_id = local.wca_id AND p.sub_id = '1'
          JOIN wca_ranks_average r ON r.person_id = p.wca_id
          WHERE r.event_id = '333'
            AND r.best::int > 0
            AND p.gender IN ('m', 'f')
        )
        SELECT name, "wcaId", gender, best, NULL::text AS city
        FROM ranked
        WHERE province_gender_rank = 1
        UNION ALL
        SELECT name, "wcaId", gender, best, city
        FROM ranked
        WHERE city_gender_rank = 1
      `,
      [JSON.stringify(visibleLiaoningProfiles.filter((profile) => profile.wcaId).map((profile) => ({ wca_id: profile.wcaId, city: profile.city })))]
    );

    const provinceRows = rows.filter((row) => !row.city);
    const cityRows = rows.filter((row) => row.city);
    const topMale = provinceRows.find((row) => row.gender === "m");
    const topFemale = provinceRows.find((row) => row.gender === "f");

    return {
      playerCount,
      cities: mergeCityTopAverages(cities, cityRows),
      topMaleAverage: topMale ? toTopAverage(topMale) : undefined,
      topFemaleAverage: topFemale ? toTopAverage(topFemale) : undefined
    };
  } catch {
    const fallback = await getFallbackTopAverage(visibleLiaoningProfiles);
    return {
      playerCount,
      cities: mergeCityTopAverages(cities, fallback.cityRows),
      topMaleAverage: fallback.topMaleAverage,
      topFemaleAverage: fallback.topFemaleAverage
    };
  }
}

function toTopAverage(row: TopAverageRow) {
  return {
    name: row.name,
    wcaId: row.wcaId,
    result: formatWcaResult("333", row.best, "average")
  };
}

async function getFallbackTopAverage(profiles: Array<{ wcaId?: string; city: string }>) {
  const wcaIdToCity = new Map(profiles.filter((profile) => profile.wcaId).map((profile) => [profile.wcaId as string, profile.city]));
  const localWcaIds = new Set(wcaIdToCity.keys());
  const averageRankings = await readChina333AverageRankings();
  const topMale = averageRankings.find((row) => row.gender === "m" && localWcaIds.has(row.wcaId));
  const topFemale = averageRankings.find((row) => row.gender === "f" && localWcaIds.has(row.wcaId));
  const seenCityGender = new Set<string>();
  const cityRows: TopAverageRow[] = [];

  for (const row of averageRankings) {
    const city = wcaIdToCity.get(row.wcaId);
    if (!city || (row.gender !== "m" && row.gender !== "f")) continue;
    const key = `${city}-${row.gender}`;
    if (seenCityGender.has(key)) continue;
    seenCityGender.add(key);
    cityRows.push({
      city,
      gender: row.gender,
      name: row.name,
      wcaId: row.wcaId,
      best: parseFallbackResult(row.result)
    });
  }

  return {
    topMaleAverage: topMale ? toFallbackTopAverage(topMale) : undefined,
    topFemaleAverage: topFemale ? toFallbackTopAverage(topFemale) : undefined,
    cityRows
  };
}

async function readChina333AverageRankings() {
  try {
    const raw = await readFile(`${process.cwd()}/data/wca_china_333_rankings.json`, "utf8");
    const parsed = JSON.parse(raw) as { average?: China333RankingEntry[] };
    return Array.isArray(parsed.average) ? parsed.average : [];
  } catch {
    return [];
  }
}

function toFallbackTopAverage(row: China333RankingEntry) {
  return {
    name: row.name,
    wcaId: row.wcaId,
    result: row.result
  };
}

function buildBaseCityStats(profiles: Array<{ wcaId?: string; city: string }>) {
  const byCity = new Map<string, HomeCityStats>();
  for (const profile of profiles) {
    if (!profile.wcaId) continue;
    const city = profile.city || "其他";
    const existing = byCity.get(city);
    if (existing) {
      existing.playerCount += 1;
    } else {
      byCity.set(city, { city, playerCount: 1 });
    }
  }
  return [...byCity.values()].sort((a, b) => a.city.localeCompare(b.city, "zh-CN"));
}

function mergeCityTopAverages(cities: HomeCityStats[], rows: TopAverageRow[]) {
  const byCity = new Map(cities.map((city) => [city.city, { ...city }]));
  for (const row of rows) {
    if (!row.city) continue;
    const city = byCity.get(row.city) || { city: row.city, playerCount: 0 };
    if (row.gender === "m") city.topMaleAverage = toTopAverage(row);
    if (row.gender === "f") city.topFemaleAverage = toTopAverage(row);
    byCity.set(row.city, city);
  }
  return [...byCity.values()].sort((a, b) => a.city.localeCompare(b.city, "zh-CN"));
}

function parseFallbackResult(result: string) {
  const numeric = Number(result);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}
