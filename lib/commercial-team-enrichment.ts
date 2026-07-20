import { getPostgresPool } from "@/lib/postgres";
import { formatWcaResult } from "@/lib/wca-result-format";

export type EnrichmentOutput = {
  specialties: string[];
  bio: string;
};

const EVENT_NAMES: Record<string, string> = {
  "333": "三阶速拧",
  "222": "二阶",
  "444": "四阶",
  "555": "五阶",
  "666": "六阶",
  "777": "七阶",
  "333bf": "三盲",
  "333fm": "最少步",
  "333oh": "单手",
  "333mbf": "多盲",
  "clock": "魔表",
  "minx": "五魔方",
  "pyram": "金字塔",
  "skewb": "斜转",
  "sq1": "SQ1",
};

const TEAM_SUFFIX: Record<string, string> = {
  "GAN Gurus": "GAN战队成员。",
  "宇宙爆速社·领航队": "宇宙爆速社领航队成员。",
  "宇宙爆速社·启航队": "宇宙爆速社启航队成员。",
  "魔域战队": "魔域战队成员。",
  "魔域梦之队": "魔域梦之队成员。",
  "未来星之队": "未来星之队成员。",
};

function rankLevel(wr: number): string {
  if (wr === 1) return "世界冠军";
  if (wr <= 3) return `世界第${wr}`;
  if (wr <= 10) return "世界级";
  if (wr <= 50) return "亚洲级";
  if (wr <= 200) return "国家级";
  return "";
}

export async function enrichMembers(
  items: { wcaId: string; teamName: string; gender?: string }[]
): Promise<Map<string, EnrichmentOutput>> {
  const result = new Map<string, EnrichmentOutput>();
  const ids = [...new Set(items.map((i) => i.wcaId))];
  if (ids.length === 0) return result;

  const femaleIds = items.filter((i) => i.gender === "女").map((i) => i.wcaId);

  try {
    const pool = getPostgresPool();
    const [sr, ar, fsr, far] = await Promise.all([
      pool.query(
        `SELECT person_id, event_id, best, world_rank, continent_rank, country_rank
         FROM wca_ranks_single
         WHERE person_id = ANY($1::text[]) AND best::int > 0
         ORDER BY person_id, world_rank::int`,
        [ids]
      ),
      pool.query(
        `SELECT person_id, event_id, best, world_rank, continent_rank, country_rank
         FROM wca_ranks_average
         WHERE person_id = ANY($1::text[]) AND best::int > 0
         ORDER BY person_id, world_rank::int`,
        [ids]
      ),
      femaleIds.length > 0
        ? pool.query(
            `SELECT fws.event_id, fws.person_id,
                    fws.rank AS f_s_wr, COALESCE(fas.rank, 999999) AS f_s_ar, COALESCE(fcs.rank, 999999) AS f_s_cr
             FROM (SELECT r.event_id, r.person_id, ROW_NUMBER() OVER (PARTITION BY r.event_id ORDER BY r.best::int) AS rank
                   FROM wca_ranks_single r JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
                   WHERE p.gender = 'f' AND r.best::int > 0) fws
             LEFT JOIN (SELECT r.event_id, r.person_id, ROW_NUMBER() OVER (PARTITION BY r.event_id ORDER BY r.best::int) AS rank
                        FROM wca_ranks_single r JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
                        JOIN wca_countries c ON c.id = p.country_id
                        WHERE p.gender = 'f' AND r.best::int > 0 AND c.continent_id = '_Asia') fas
               ON fas.event_id = fws.event_id AND fas.person_id = fws.person_id
             LEFT JOIN (SELECT r.event_id, r.person_id, ROW_NUMBER() OVER (PARTITION BY r.event_id ORDER BY r.best::int) AS rank
                        FROM wca_ranks_single r JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
                        WHERE p.gender = 'f' AND r.best::int > 0 AND p.country_id = 'China') fcs
               ON fcs.event_id = fws.event_id AND fcs.person_id = fws.person_id
             WHERE fws.person_id = ANY($1::text[])`,
            [femaleIds]
          )
        : { rows: [] },
      femaleIds.length > 0
        ? pool.query(
            `SELECT fwa.event_id, fwa.person_id,
                    fwa.rank AS f_a_wr, COALESCE(faa.rank, 999999) AS f_a_ar, COALESCE(fca.rank, 999999) AS f_a_cr
             FROM (SELECT r.event_id, r.person_id, ROW_NUMBER() OVER (PARTITION BY r.event_id ORDER BY r.best::int) AS rank
                   FROM wca_ranks_average r JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
                   WHERE p.gender = 'f' AND r.best::int > 0) fwa
             LEFT JOIN (SELECT r.event_id, r.person_id, ROW_NUMBER() OVER (PARTITION BY r.event_id ORDER BY r.best::int) AS rank
                        FROM wca_ranks_average r JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
                        JOIN wca_countries c ON c.id = p.country_id
                        WHERE p.gender = 'f' AND r.best::int > 0 AND c.continent_id = '_Asia') faa
               ON faa.event_id = fwa.event_id AND faa.person_id = fwa.person_id
             LEFT JOIN (SELECT r.event_id, r.person_id, ROW_NUMBER() OVER (PARTITION BY r.event_id ORDER BY r.best::int) AS rank
                        FROM wca_ranks_average r JOIN wca_persons p ON p.wca_id = r.person_id AND p.sub_id = '1'
                        WHERE p.gender = 'f' AND r.best::int > 0 AND p.country_id = 'China') fca
               ON fca.event_id = fwa.event_id AND fca.person_id = fwa.person_id
             WHERE fwa.person_id = ANY($1::text[])`,
            [femaleIds]
          )
        : { rows: [] },
    ]);

    const frMap = new Map<string, Map<string, { s: { wr: number; ar: number; cr: number }; a: { wr: number; ar: number; cr: number } }>>();
    for (const r of fsr.rows) {
      if (!frMap.has(r.person_id)) frMap.set(r.person_id, new Map());
      const emap = frMap.get(r.person_id)!;
      if (!emap.has(r.event_id)) emap.set(r.event_id, { s: { wr: 0, ar: 0, cr: 0 }, a: { wr: 0, ar: 0, cr: 0 } });
      emap.get(r.event_id)!.s = { wr: r.f_s_wr, ar: r.f_s_ar, cr: r.f_s_cr };
    }
    for (const r of far.rows) {
      if (!frMap.has(r.person_id)) frMap.set(r.person_id, new Map());
      const emap = frMap.get(r.person_id)!;
      if (!emap.has(r.event_id)) emap.set(r.event_id, { s: { wr: 0, ar: 0, cr: 0 }, a: { wr: 0, ar: 0, cr: 0 } });
      emap.get(r.event_id)!.a = { wr: r.f_a_wr, ar: r.f_a_ar, cr: r.f_a_cr };
    }

    const sMap = new Map<string, any[]>();
    const aMap = new Map<string, any[]>();
    for (const r of sr.rows) {
      if (!sMap.has(r.person_id)) sMap.set(r.person_id, []);
      sMap.get(r.person_id)!.push(r);
    }
    for (const r of ar.rows) {
      if (!aMap.has(r.person_id)) aMap.set(r.person_id, []);
      aMap.get(r.person_id)!.push(r);
    }

    for (const item of items) {
      const singles = sMap.get(item.wcaId) || [];
      const avgs = aMap.get(item.wcaId) || [];
      if (singles.length === 0 && avgs.length === 0) continue;

      const events = new Map<string, { single?: any; avg?: any }>();
      for (const s of singles) {
        if (!events.has(s.event_id)) events.set(s.event_id, {});
        events.get(s.event_id)!.single = s;
      }
      for (const a of avgs) {
        if (!events.has(a.event_id)) events.set(a.event_id, {});
        events.get(a.event_id)!.avg = a;
      }

      const scored = Array.from(events.entries())
        .map(([eid, d]) => ({
          eid,
          d,
          wr: Math.min(
            d.single ? parseInt(d.single.world_rank) : 999999,
            d.avg ? parseInt(d.avg.world_rank) : 999999
          ),
        }))
        .sort((a, b) => a.wr - b.wr);

      if (scored.length === 0) continue;

      const top = scored.slice(0, 2);

      const tagSet = new Set<string>();
      for (const s of scored.slice(0, 3)) {
        tagSet.add(EVENT_NAMES[s.eid] || s.eid);
      }
      for (const [eid, d] of events) {
        const cnr = Math.min(
          d.single ? parseInt(d.single.country_rank) : 999999,
          d.avg ? parseInt(d.avg.country_rank) : 999999
        );
        if (cnr <= 50) {
          tagSet.add(EVENT_NAMES[eid] || eid);
        }
      }
      const specialties = [...tagSet];

      const suffix = TEAM_SUFFIX[item.teamName] || `${item.teamName}成员。`;
      const lines: string[] = [];

      for (const t of top) {
        const ename = EVENT_NAMES[t.eid] || t.eid;
        const abest = t.d.avg ? parseInt(t.d.avg.best) : null;
        const sbest = t.d.single ? parseInt(t.d.single.best) : null;
        const awr = t.d.avg ? parseInt(t.d.avg.world_rank) : null;
        const swr = t.d.single ? parseInt(t.d.single.world_rank) : null;
        const acr = t.d.avg ? parseInt(t.d.avg.continent_rank) : null;
        const scr = t.d.single ? parseInt(t.d.single.continent_rank) : null;
        const anr = t.d.avg ? parseInt(t.d.avg.country_rank) : null;
        const snr = t.d.single ? parseInt(t.d.single.country_rank) : null;

        const level = rankLevel(t.wr);
        const parts: string[] = [];

        if (level) {
          parts.push(`${ename}${level}选手`);
        } else {
          parts.push(`${ename}选手`);
        }

        const rankParts: string[] = [];
        const showAvg = awr != null && awr <= 200;
        if (showAvg) {
          let r = `${ename}平均世界第${awr}`;
          if (acr && acr <= 10) r += `、亚洲第${acr}`;
          if (anr && anr <= 10) r += `、中国第${anr}`;
          rankParts.push(r);
        } else if (swr && swr <= 200) {
          let r = `${ename}单次世界第${swr}`;
          if (scr && scr <= 10) r += `、亚洲第${scr}`;
          if (snr && snr <= 10) r += `、中国第${snr}`;
          rankParts.push(r);
        } else if (anr && anr <= 200) {
          rankParts.push(`${ename}平均中国第${anr}`);
        } else if (snr && snr <= 200) {
          rankParts.push(`${ename}单次中国第${snr}`);
        }

        // Append female-specific ranking for female members
        if (item.gender === "女") {
          const efr = frMap.get(item.wcaId)?.get(t.eid);
          if (efr) {
            const fw = showAvg ? efr.a.wr : efr.s.wr;
            const fa = showAvg ? efr.a.ar : efr.s.ar;
            const fc = showAvg ? efr.a.cr : efr.s.cr;
            const femRanks: string[] = [];
            if (fw > 0 && fw <= 200) femRanks.push(`女子世界第${fw}`);
            if (fa > 0 && fa <= 200) femRanks.push(`女子亚洲第${fa}`);
            if (fc > 0 && fc <= 200) femRanks.push(`女子中国第${fc}`);
            if (femRanks.length > 0) {
              if (rankParts.length > 0) {
                rankParts[rankParts.length - 1] += `（${femRanks.join("、")}）`;
              } else {
                rankParts.push(femRanks.join("、"));
              }
            }
          }
        }

        if (rankParts.length > 0) parts.push(rankParts.join("，"));

        const times: string[] = [];
        if (abest != null) times.push(`平均最佳 ${formatWcaResult(t.eid, abest, "average")}s`);
        if (sbest != null) times.push(`单次最佳 ${formatWcaResult(t.eid, sbest, "single")}s`);
        if (times.length > 0) times[0] = `个人${times[0]}`;
        if (times.length > 0) parts.push(times.join("、"));

        if (parts.length > 0) lines.push(parts.join("，"));
      }

      if (lines.length > 0) {
        result.set(item.wcaId, { specialties, bio: `${lines.join("。")}。${suffix}` });
      }
    }
  } catch (err) {
    console.error("Failed to enrich commercial team members:", err);
  }

  return result;
}
