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

function isPlaceholder(bio: string): boolean {
  if (!bio || bio.length < 20) return true;
  const generic = [
    "宇宙爆速社领航队成员",
    "宇宙爆速社启航队成员",
    "魔域梦之队成员（葫芦岛）",
    "魔域梦之队成员，参加多场省内外赛事",
    "未来星之队成员，奇艺魔方格",
    "主修三速，三单",
  ];
  return generic.some((p) => bio.includes(p));
}

function rankLevel(wr: number): string {
  if (wr === 1) return "世界冠军";
  if (wr <= 3) return `世界第${wr}`;
  if (wr <= 10) return "世界级";
  if (wr <= 50) return "亚洲级";
  if (wr <= 200) return "国家级";
  return "";
}

export async function enrichMembers(
  items: { wcaId: string; teamName: string; currentBio: string }[]
): Promise<Map<string, EnrichmentOutput>> {
  const result = new Map<string, EnrichmentOutput>();
  const targets = items.filter((i) => isPlaceholder(i.currentBio));
  const ids = [...new Set(targets.map((i) => i.wcaId))];
  if (ids.length === 0) return result;

  try {
    const pool = getPostgresPool();
    const [sr, ar] = await Promise.all([
      pool.query(
        `SELECT person_id, event_id, best, world_rank, continent_rank
         FROM wca_ranks_single
         WHERE person_id = ANY($1::text[]) AND best::int > 0
         ORDER BY person_id, world_rank::int`,
        [ids]
      ),
      pool.query(
        `SELECT person_id, event_id, best, world_rank, continent_rank
         FROM wca_ranks_average
         WHERE person_id = ANY($1::text[]) AND best::int > 0
         ORDER BY person_id, world_rank::int`,
        [ids]
      ),
    ]);

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

    for (const item of targets) {
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
      const specialties = scored.slice(0, 3).map((s) => EVENT_NAMES[s.eid] || s.eid);

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

        const level = rankLevel(t.wr);
        const parts: string[] = [];

        if (level) {
          parts.push(`${ename}${level}选手`);
        } else {
          parts.push(`${ename}选手`);
        }

        const rankParts: string[] = [];
        if (awr && awr <= 500) {
          let r = `${ename}平均世界第${awr}`;
          if (acr && acr <= 10) r += `、亚洲第${acr}`;
          rankParts.push(r);
        } else if (swr && swr <= 500) {
          let r = `${ename}单次世界第${swr}`;
          if (scr && scr <= 10) r += `、亚洲第${scr}`;
          rankParts.push(r);
        }
        if (rankParts.length > 0) parts.push(rankParts.join("，"));

        const times: string[] = [];
        if (abest != null) times.push(`平均最佳 ${formatWcaResult(t.eid, abest, "average")}`);
        if (sbest != null) times.push(`单次最佳 ${formatWcaResult(t.eid, sbest, "single")}`);
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
