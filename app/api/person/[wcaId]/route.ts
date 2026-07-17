import { NextRequest, NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres";
import { readLocalProfiles } from "@/lib/local-profile-store";
import { getCubingCompetitionNameZhByWcaId } from "@/lib/cubing-competition-name";

export const dynamic = "force-dynamic";

type PersonInfo = {
  wcaId: string;
  name: string;
  countryId: string;
  countryName: string;
  continentId: string;
  gender: string;
};

type RankRow = {
  eventId: string;
  best: number;
  worldRank: number;
  continentRank: number;
  countryRank: number;
};

type ResultRow = {
  competitionId: string;
  competitionName: string;
  competitionNameZh?: string | null;
  eventId: string;
  roundTypeId: string;
  pos: number;
  best: number;
  average: number;
  date: string;
  value1: number;
  value2: number;
  value3: number;
  value4: number;
  value5: number;
};

type MedalRow = {
  eventId: string;
  gold: number;
  silver: number;
  bronze: number;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ wcaId: string }> }
) {
  const { wcaId: rawWcaId } = await params;
  const wcaId = rawWcaId.toUpperCase();

  if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) {
    return NextResponse.json({ error: "Invalid WCA ID" }, { status: 400 });
  }

  try {
    const profiles = await readLocalProfiles();
    const localProfile = profiles.find(
      (p) => p.wcaId?.toUpperCase() === wcaId
    );

    if (!localProfile || !localProfile.wcaId) {
      return NextResponse.json({ error: "该选手不在辽宁选手库中" }, { status: 404 });
    }

    const province = localProfile.province;
    const city = localProfile.city;

    const pool = getPostgresPool();

    const personResult = await pool.query<PersonInfo>(
      `SELECT p.wca_id AS "wcaId", p.name, p.country_id AS "countryId",
              COALESCE(cn.name, p.country_id) AS "countryName",
              cn.continent_id AS "continentId",
              p.gender
       FROM wca_persons p
       LEFT JOIN wca_countries cn ON cn.id = p.country_id
       WHERE p.wca_id = $1 AND p.sub_id = '1'
       LIMIT 1`,
      [wcaId]
    );

    if (personResult.rows.length === 0) {
      return NextResponse.json({ error: "WCA 数据库中未找到该选手" }, { status: 404 });
    }

    const person = personResult.rows[0];

    const competitionCountResult = await pool.query<{ count: number }>(
      `SELECT COUNT(DISTINCT competition_id)::int AS count
       FROM wca_results
       WHERE person_id = $1`,
      [wcaId]
    );
    const competitionCount = competitionCountResult.rows[0]?.count ?? 0;

    const careerResult = await pool.query<{ firstDate: string; lastDate: string }>(
      `SELECT
         MIN(CONCAT(c.year, '-', LPAD(c.month, 2, '0'), '-', LPAD(c.day, 2, '0'))) AS "firstDate",
         MAX(CONCAT(c.year, '-', LPAD(c.month, 2, '0'), '-', LPAD(c.day, 2, '0'))) AS "lastDate"
       FROM wca_results r
       JOIN wca_competitions c ON c.id = r.competition_id
       WHERE r.person_id = $1`,
      [wcaId]
    );
    const career = careerResult.rows[0];

    const [singleRanks, averageRanks] = await Promise.all([
      pool.query<RankRow>(
        `SELECT event_id AS "eventId", best::int AS best,
                world_rank::int AS "worldRank",
                continent_rank::int AS "continentRank",
                country_rank::int AS "countryRank"
         FROM wca_ranks_single
         WHERE person_id = $1 AND best::int > 0
         ORDER BY event_id`,
        [wcaId]
      ),
      pool.query<RankRow>(
        `SELECT event_id AS "eventId", best::int AS best,
                world_rank::int AS "worldRank",
                continent_rank::int AS "continentRank",
                country_rank::int AS "countryRank"
         FROM wca_ranks_average
         WHERE person_id = $1 AND best::int > 0
         ORDER BY event_id`,
        [wcaId]
      )
    ]);

    const provinceWcaIds = profiles
      .filter((p) => p.province === province && p.wcaId)
      .map((p) => p.wcaId as string);

    const cityWcaIds = profiles
      .filter((p) => p.city === city && p.province === province && p.wcaId)
      .map((p) => p.wcaId as string);

    const [provinceSingleResult, provinceAverageResult, citySingleResult, cityAverageResult] =
      await Promise.all([
        provinceWcaIds.length > 0
          ? pool.query<{ eventId: string; rank: number }>(
              `SELECT sub.event_id AS "eventId", sub.rank::int AS rank
               FROM (
                 SELECT r.event_id, r.person_id,
                        ROW_NUMBER() OVER (PARTITION BY r.event_id ORDER BY r.best::int, r.world_rank::int, r.person_id) AS rank
                 FROM wca_ranks_single r
                 JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
                 WHERE p.wca_id = ANY($1::text[]) AND r.best::int > 0
               ) sub
               WHERE sub.person_id = $2`,
              [provinceWcaIds, wcaId]
            )
          : { rows: [] },
        provinceWcaIds.length > 0
          ? pool.query<{ eventId: string; rank: number }>(
              `SELECT sub.event_id AS "eventId", sub.rank::int AS rank
               FROM (
                 SELECT r.event_id, r.person_id,
                        ROW_NUMBER() OVER (PARTITION BY r.event_id ORDER BY r.best::int, r.world_rank::int, r.person_id) AS rank
                 FROM wca_ranks_average r
                 JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
                 WHERE p.wca_id = ANY($1::text[]) AND r.best::int > 0
               ) sub
               WHERE sub.person_id = $2`,
              [provinceWcaIds, wcaId]
            )
          : { rows: [] },
        cityWcaIds.length > 0
          ? pool.query<{ eventId: string; rank: number }>(
              `SELECT sub.event_id AS "eventId", sub.rank::int AS rank
               FROM (
                 SELECT r.event_id, r.person_id,
                        ROW_NUMBER() OVER (PARTITION BY r.event_id ORDER BY r.best::int, r.world_rank::int, r.person_id) AS rank
                 FROM wca_ranks_single r
                 JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
                 WHERE p.wca_id = ANY($1::text[]) AND r.best::int > 0
               ) sub
               WHERE sub.person_id = $2`,
              [cityWcaIds, wcaId]
            )
          : { rows: [] },
        cityWcaIds.length > 0
          ? pool.query<{ eventId: string; rank: number }>(
              `SELECT sub.event_id AS "eventId", sub.rank::int AS rank
               FROM (
                 SELECT r.event_id, r.person_id,
                        ROW_NUMBER() OVER (PARTITION BY r.event_id ORDER BY r.best::int, r.world_rank::int, r.person_id) AS rank
                 FROM wca_ranks_average r
                 JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
                 WHERE p.wca_id = ANY($1::text[]) AND r.best::int > 0
               ) sub
               WHERE sub.person_id = $2`,
              [cityWcaIds, wcaId]
            )
          : { rows: [] }
      ]);

    const provinceSingleRanks = new Map(provinceSingleResult.rows.map((r) => [r.eventId, r.rank]));
    const provinceAverageRanks = new Map(provinceAverageResult.rows.map((r) => [r.eventId, r.rank]));
    const citySingleRanks = new Map(citySingleResult.rows.map((r) => [r.eventId, r.rank]));
    const cityAverageRanks = new Map(cityAverageResult.rows.map((r) => [r.eventId, r.rank]));

    const medalsResult = await pool.query<MedalRow>(
      `SELECT
         r.event_id AS "eventId",
         COUNT(*) FILTER (WHERE r.round_type_id = 'f' AND r.pos = '1')::int AS gold,
         COUNT(*) FILTER (WHERE r.round_type_id = 'f' AND r.pos = '2')::int AS silver,
         COUNT(*) FILTER (WHERE r.round_type_id = 'f' AND r.pos = '3')::int AS bronze
       FROM wca_results r
       WHERE r.person_id = $1
         AND r.round_type_id = 'f'
         AND r.pos IN ('1', '2', '3')
       GROUP BY r.event_id
       ORDER BY r.event_id`,
      [wcaId]
    );

    const solveAttemptsResult = await pool.query<{ eventId: string; solved: number; total: number }>(
      `SELECT
         event_id AS "eventId",
         COUNT(*) FILTER (WHERE best != '-1' AND best != '-2' AND best != '0')::int AS solved,
         COUNT(*)::int AS total
       FROM wca_results
       WHERE person_id = $1
       GROUP BY event_id
       ORDER BY event_id`,
      [wcaId]
    );

    const resultsResult = await pool.query<ResultRow>(
      `SELECT
         r.competition_id AS "competitionId",
         c.name AS "competitionName",
         r.event_id AS "eventId",
         r.round_type_id AS "roundTypeId",
         r.pos::int AS pos,
         r.best::int AS best,
         r.average::int AS average,
         CONCAT(c.year, '-', LPAD(c.month, 2, '0'), '-', LPAD(c.day, 2, '0')) AS date,
         COALESCE(a1.value, 0)::int AS value1,
         COALESCE(a2.value, 0)::int AS value2,
         COALESCE(a3.value, 0)::int AS value3,
         COALESCE(a4.value, 0)::int AS value4,
         COALESCE(a5.value, 0)::int AS value5
       FROM wca_results r
       JOIN wca_competitions c ON c.id = r.competition_id
       LEFT JOIN LATERAL (SELECT value::int FROM wca_result_attempts WHERE result_id = r.id AND attempt_number = '1') a1 ON true
       LEFT JOIN LATERAL (SELECT value::int FROM wca_result_attempts WHERE result_id = r.id AND attempt_number = '2') a2 ON true
       LEFT JOIN LATERAL (SELECT value::int FROM wca_result_attempts WHERE result_id = r.id AND attempt_number = '3') a3 ON true
       LEFT JOIN LATERAL (SELECT value::int FROM wca_result_attempts WHERE result_id = r.id AND attempt_number = '4') a4 ON true
       LEFT JOIN LATERAL (SELECT value::int FROM wca_result_attempts WHERE result_id = r.id AND attempt_number = '5') a5 ON true
       WHERE r.person_id = $1
       ORDER BY c.year DESC, c.month DESC, c.day DESC, r.event_id, r.pos`,
      [wcaId]
    );

    return NextResponse.json({
      profile: {
        wcaId: person.wcaId,
        name: person.name,
        countryId: person.countryId,
        countryName: person.countryName,
        continentId: person.continentId,
        gender: person.gender,
        competitionCount,
        careerFirst: career?.firstDate ?? null,
        careerLast: career?.lastDate ?? null,
        province,
        city
      },
      singleRanks: singleRanks.rows.map((r) => ({
        eventId: r.eventId,
        best: r.best,
        worldRank: r.worldRank,
        continentRank: r.continentRank,
        countryRank: r.countryRank,
        provinceRank: provinceSingleRanks.get(r.eventId) ?? null,
        cityRank: citySingleRanks.get(r.eventId) ?? null
      })),
      averageRanks: averageRanks.rows.map((r) => ({
        eventId: r.eventId,
        best: r.best,
        worldRank: r.worldRank,
        continentRank: r.continentRank,
        countryRank: r.countryRank,
        provinceRank: provinceAverageRanks.get(r.eventId) ?? null,
        cityRank: cityAverageRanks.get(r.eventId) ?? null
      })),
      medals: medalsResult.rows,
      solveAttempts: solveAttemptsResult.rows,
      results: resultsResult.rows.map((result) => ({
        ...result,
        competitionNameZh: getCubingCompetitionNameZhByWcaId(result.competitionId, result.competitionName)
      }))
    });
  } catch (error) {
    console.error("Person API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
