import { readFile } from "node:fs/promises";
import { readLocalProfiles } from "@/lib/local-profile-store";
import { getPostgresPool } from "@/lib/postgres";
import { formatWcaResult } from "@/lib/wca-result-format";

type TopAverageRow = {
  name: string;
  wcaId: string;
  best: number;
  gender: string;
};

type China333RankingEntry = {
  wcaId: string;
  name: string;
  gender: string;
  result: string;
};

export type HomeStats = {
  playerCount: number;
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

export async function getHomeStats(): Promise<HomeStats> {
  const profiles = await readLocalProfiles();
  const visibleLiaoningProfiles = profiles.filter((profile) => profile.visible && profile.province === "辽宁");
  const wcaIds = visibleLiaoningProfiles.map((profile) => profile.wcaId).filter((id): id is string => Boolean(id));
  const playerCount = wcaIds.length;

  if (wcaIds.length === 0) {
    return { playerCount };
  }

  try {
    const { rows } = await getPostgresPool().query<TopAverageRow>(
      `
        WITH local_people AS (
          SELECT UNNEST($1::text[]) AS wca_id
        ),
        ranked AS (
          SELECT
            p.name,
            p.wca_id AS "wcaId",
            p.gender,
            r.best::int AS best,
            ROW_NUMBER() OVER (PARTITION BY p.gender ORDER BY r.best::int, r.world_rank::int, p.wca_id) AS gender_rank
          FROM local_people local
          JOIN wca_persons p ON p.wca_id = local.wca_id AND p.sub_id = '1'
          JOIN wca_ranks_average r ON r.person_id = p.wca_id
          WHERE r.event_id = '333'
            AND r.best::int > 0
            AND p.gender IN ('m', 'f')
        )
        SELECT name, "wcaId", gender, best
        FROM ranked
        WHERE gender_rank = 1
      `,
      [wcaIds]
    );

    const topMale = rows.find((row) => row.gender === "m");
    const topFemale = rows.find((row) => row.gender === "f");

    return {
      playerCount,
      topMaleAverage: topMale ? toTopAverage(topMale) : undefined,
      topFemaleAverage: topFemale ? toTopAverage(topFemale) : undefined
    };
  } catch {
    const fallback = await getFallbackTopAverage(wcaIds);
    return {
      playerCount,
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

async function getFallbackTopAverage(wcaIds: string[]) {
  const localWcaIds = new Set(wcaIds);
  const averageRankings = await readChina333AverageRankings();
  const topMale = averageRankings.find((row) => row.gender === "m" && localWcaIds.has(row.wcaId));
  const topFemale = averageRankings.find((row) => row.gender === "f" && localWcaIds.has(row.wcaId));

  return {
    topMaleAverage: topMale ? toFallbackTopAverage(topMale) : undefined,
    topFemaleAverage: topFemale ? toFallbackTopAverage(topFemale) : undefined
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
