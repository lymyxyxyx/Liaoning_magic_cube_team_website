import { getPostgresPool } from "@/lib/postgres";
import type { PoolClient } from "pg";
import { getWcaEventName, isWcaEventId } from "@/lib/wca-events";
import { getWeeklyAgeGroup } from "@/lib/weekly-age-groups";
import {
  calculateResultByFormat,
  formatResult,
  getWeeklyResultFormat,
  parseResultInput,
  resultValueToSeconds,
  secondsToResultValue,
  type ResultValue,
  type WeeklyResultFormat
} from "@/lib/weekly-result-utils";
import { weeklyMeets } from "@/lib/weekly";
import { getMofang602SeedWeeklyPlayers, listWeeklyPlayerLibrary } from "@/lib/weekly-player-library";

export type WeeklyMeetOption = {
  id: string;
  slug: string;
  title: string;
  dateLabel: string;
};

export type WeeklyPlayer = {
  id: string;
  name: string;
  slug: string;
  wcaId: string;
  gender: "男" | "女";
  province: string;
  city: string;
  birthDate: string;
  ageGroup: string;
  ageGroupIsFuzzy?: boolean;
};

export type WeeklyEnteredResult = {
  id: number;
  rank: number;
  player: WeeklyPlayer;
  best: ResultValue;
  average: ResultValue;
  attempts: ResultValue[];
  detail: string;
};

type WeeklyPlayerRow = {
  id: string;
  name: string;
  slug: string;
  wca_id: string;
  gender: string;
  province: string;
  city: string;
  birth_date: string;
};

type WeeklyResultRow = {
  id: number;
  rank: number;
  player_name: string;
  player_slug: string;
  gender: string;
  age_group: string | null;
  average: string;
  personal_best: string;
};

type WeeklyAttemptRow = {
  result_id: number;
  seq: number;
  value: string | null;
};

const testWeeklyMeet: WeeklyMeetOption = {
  id: "weekly-test-entry",
  slug: "test-entry",
  title: "测试周赛（成绩录入调试用）",
  dateLabel: "调试用"
};

export async function ensureWeeklyEntryTables() {
  const pool = getPostgresPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS weekly_players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL DEFAULT '',
      wca_id TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT '男',
      province TEXT NOT NULL DEFAULT '辽宁',
      city TEXT NOT NULL DEFAULT '',
      birth_date TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query("ALTER TABLE weekly_players ADD COLUMN IF NOT EXISTS birth_date TEXT NOT NULL DEFAULT ''");
  await pool.query("CREATE INDEX IF NOT EXISTS weekly_players_name_idx ON weekly_players (name)");
}

export async function listWeeklyMeetOptions(): Promise<WeeklyMeetOption[]> {
  try {
    const pool = getPostgresPool();
    const { rows } = await pool.query<WeeklyMeetOption>(
      `SELECT id, slug, title, date_label AS "dateLabel"
       FROM weekly_meets
       ORDER BY week_number DESC, created_at DESC`
    );
    if (rows.length > 0) return withTestMeet(rows);
  } catch {
    // Local development can run without DATABASE_URL; keep selectors usable from bundled weekly data.
  }

  return withTestMeet(
    weeklyMeets.map((meet) => ({
      id: meet.id,
      slug: meet.slug,
      title: meet.title,
      dateLabel: meet.dateLabel
    }))
  );
}

export async function searchWeeklyPlayers(query: string): Promise<WeeklyPlayer[]> {
  const q = query.trim();
  try {
    const libraryPlayers = await listWeeklyPlayerLibrary();
    return libraryPlayers
      .filter((player) => !q || player.name.includes(q))
      .map((player) => ({
        id: player.id,
        name: player.name,
        slug: "",
        wcaId: player.wcaId || "",
        gender: player.gender === "女" ? ("女" as const) : ("男" as const),
        province: player.province,
        city: player.city,
        birthDate: player.birthDate,
        ageGroup: getWeeklyAgeGroup(player.birthDate) || player.ageGroup || "",
        ageGroupIsFuzzy: Boolean(player.ageGroupIsFuzzy)
      }))
      .slice(0, 20);
  } catch {
    return getMofang602SeedWeeklyPlayers()
      .filter((player) => !q || player.name.includes(q))
      .map((player) => ({
        id: player.id,
        name: player.name,
        slug: "",
        wcaId: player.wcaId || "",
        gender: player.gender === "女" ? ("女" as const) : ("男" as const),
        province: player.province,
        city: player.city,
        birthDate: player.birthDate,
        ageGroup: getWeeklyAgeGroup(player.birthDate) || player.ageGroup || "",
        ageGroupIsFuzzy: Boolean(player.ageGroupIsFuzzy)
      }))
      .slice(0, 20);
  }
}

export async function createWeeklyPlayer(input: {
  name: string;
  wcaId?: string;
  gender?: "男" | "女";
  province?: string;
  city?: string;
  birthDate?: string;
  ageGroup?: string;
  ageGroupIsFuzzy?: boolean;
}) {
  await ensureWeeklyEntryTables();
  const name = input.name.trim();
  if (!name) throw new Error("请填写选手姓名");

  const pool = getPostgresPool();
  const slug = slugifyName(name);
  const id = `weekly-player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const { rows } = await pool.query<WeeklyPlayerRow>(
    `INSERT INTO weekly_players (id, name, slug, wca_id, gender, province, city, birth_date, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
     RETURNING *`,
    [
      id,
      name,
      slug,
      input.wcaId?.trim() || "",
      input.gender === "女" ? "女" : "男",
      input.province?.trim() || "辽宁",
      input.city?.trim() || "",
      input.birthDate?.trim() || ""
    ]
  );
  return mapPlayerRow(rows[0]);
}

export async function listWeeklyResults(meetIdOrSlug: string, eventId: string, format: string = "avg5"): Promise<WeeklyEnteredResult[]> {
  if (!isWcaEventId(eventId)) throw new Error("项目不正确");
  const formatConfig = getWeeklyResultFormat(format);

  const pool = getPostgresPool();
  const meet = await resolveWeeklyMeet(meetIdOrSlug);
  if (!meet) throw new Error("周赛不存在");

  const eventKey = getWeeklyEventKey(meet.id, eventId, formatConfig.id);
  const { rows } = await pool.query<WeeklyResultRow>(
    `SELECT * FROM weekly_results
     WHERE meet_id = $1 AND event_id = $2
     ORDER BY
       CASE WHEN average < 0 THEN 1 ELSE 0 END,
       average ASC,
       CASE WHEN personal_best < 0 THEN 1 ELSE 0 END,
       personal_best ASC,
       player_name ASC`,
    [meet.id, eventKey]
  );
  const resultIds = rows.map((row) => row.id);
  const attempts =
    resultIds.length > 0
      ? await pool.query<WeeklyAttemptRow>("SELECT * FROM weekly_attempts WHERE result_id = ANY($1) ORDER BY result_id, seq", [resultIds])
      : { rows: [] };
  const attemptsByResult = groupBy(attempts.rows, (row) => row.result_id);

  return rows.map((row, index) => {
    const attemptValues = (attemptsByResult.get(row.id) || []).map((attempt) => secondsToResultValue(attempt.value));
    return {
      id: row.id,
      rank: index + 1,
      player: {
        id: row.player_slug ? `code:${row.player_slug}` : row.player_name,
        name: row.player_name,
        slug: row.player_slug,
        wcaId: "",
        gender: row.gender === "女" ? "女" : "男",
        province: "辽宁",
        city: "",
        birthDate: "",
        ageGroup: row.age_group || "",
        ageGroupIsFuzzy: false
      },
      best: secondsToResultValue(row.personal_best),
      average: secondsToResultValue(row.average),
      attempts: attemptValues,
      detail: attemptValues.map(formatResult).join(" / ")
    };
  });
}

export async function saveWeeklyResult(input: {
  meetId: string;
  eventId: string;
  format: WeeklyResultFormat;
  player: WeeklyPlayer;
  attempts: string[];
}) {
  if (!isWcaEventId(input.eventId)) throw new Error("项目不正确");
  const formatConfig = getWeeklyResultFormat(input.format);
  if (!input.player?.name?.trim()) throw new Error("请选择选手");
  if (!Array.isArray(input.attempts) || input.attempts.length !== formatConfig.attemptCount) {
    throw new Error(`必须录入 ${formatConfig.attemptCount} 次成绩`);
  }

  const parsedAttempts = input.attempts.map(parseResultInput);
  const calculated = calculateResultByFormat(parsedAttempts, formatConfig.id);
  const meet = input.meetId === testWeeklyMeet.id ? await ensureTestWeeklyMeet() : await resolveWeeklyMeet(input.meetId);
  if (!meet) throw new Error("周赛不存在");

  const pool = getPostgresPool();
  const client = await pool.connect();
  const eventKey = getWeeklyEventKey(meet.id, input.eventId, formatConfig.id);
  const eventName = getWcaEventName(input.eventId);
  const playerName = input.player.name.trim();
  const playerSlug = input.player.slug || (input.player.id.startsWith("code:") ? input.player.id.slice(5) : "");
  const playerAgeGroup = getWeeklyAgeGroup(input.player.birthDate) || input.player.ageGroup || "";

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO weekly_events (id, meet_id, kind, title, event_name, group_name, is_all_around, seq)
       VALUES ($1,$2,$3,$4,$5,NULL,FALSE,$6)
       ON CONFLICT (id, meet_id) DO UPDATE SET title = EXCLUDED.title, event_name = EXCLUDED.event_name`,
      [eventKey, meet.id, "other", `${eventName} · ${formatConfig.name}`, eventName, eventOrder(input.eventId)]
    );

    const existing = await client.query<{ id: number }>(
      "SELECT id FROM weekly_results WHERE meet_id = $1 AND event_id = $2 AND player_name = $3 LIMIT 1",
      [meet.id, eventKey, playerName]
    );

    let resultId = existing.rows[0]?.id;
    if (resultId) {
      await client.query(
        `UPDATE weekly_results
         SET player_slug = $1, gender = $2, age_group = $3, average = $4, personal_best = $5
         WHERE id = $6`,
        [
          playerSlug,
          input.player.gender === "女" ? "女" : "男",
          playerAgeGroup || null,
          resultValueToSeconds(calculated.average),
          resultValueToSeconds(calculated.best),
          resultId
        ]
      );
      await client.query("DELETE FROM weekly_attempts WHERE result_id = $1", [resultId]);
    } else {
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO weekly_results
          (event_id, meet_id, rank, player_name, player_slug, gender, age_group, level, grade, average, personal_best, pb_refreshed)
         VALUES ($1,$2,0,$3,$4,$5,$6,'','',$7,$8,FALSE)
         RETURNING id`,
        [
          eventKey,
          meet.id,
          playerName,
          playerSlug,
          input.player.gender === "女" ? "女" : "男",
          playerAgeGroup || null,
          resultValueToSeconds(calculated.average),
          resultValueToSeconds(calculated.best)
        ]
      );
      resultId = inserted.rows[0].id;
    }

    for (const [index, attempt] of parsedAttempts.entries()) {
      await client.query("INSERT INTO weekly_attempts (result_id, seq, value) VALUES ($1,$2,$3)", [
        resultId,
        index + 1,
        resultValueToSeconds(attempt)
      ]);
    }

    await rerankWeeklyEvent(client, meet.id, eventKey);
    await client.query("COMMIT");
    return calculated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function resolveWeeklyMeet(idOrSlug: string) {
  const pool = getPostgresPool();
  const { rows } = await pool.query<{ id: string; slug: string; yearWeek: number }>(
    `SELECT id, slug, year_week AS "yearWeek"
     FROM weekly_meets
     WHERE id = $1 OR slug = $1
     LIMIT 1`,
    [idOrSlug]
  );
  return rows[0] || null;
}

async function ensureTestWeeklyMeet() {
  const pool = getPostgresPool();
  await pool.query(
    `INSERT INTO weekly_meets
      (id, slug, title, week_number, year, year_week, published_at, event, date_label, summary, pb_note, three_age_intro)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title,
           date_label = EXCLUDED.date_label,
           summary = EXCLUDED.summary`,
    [
      testWeeklyMeet.id,
      testWeeklyMeet.slug,
      testWeeklyMeet.title,
      0,
      2026,
      0,
      null,
      "三阶",
      testWeeklyMeet.dateLabel,
      "用于调试周赛成绩录入流程，不作为正式周赛展示依据。",
      "测试数据可随时覆盖或清理。",
      "测试周赛不拆分年龄组。"
    ]
  );
  return resolveWeeklyMeet(testWeeklyMeet.id);
}

async function rerankWeeklyEvent(client: PoolClient, meetId: string, eventId: string) {
  const { rows } = await client.query<{ id: number }>(
    `SELECT id FROM weekly_results
     WHERE meet_id = $1 AND event_id = $2
     ORDER BY
       CASE WHEN average < 0 THEN 1 ELSE 0 END,
       average ASC,
       CASE WHEN personal_best < 0 THEN 1 ELSE 0 END,
       personal_best ASC,
       player_name ASC`,
    [meetId, eventId]
  );

  for (const [index, row] of rows.entries()) {
    await client.query("UPDATE weekly_results SET rank = $1 WHERE id = $2", [index + 1, row.id]);
  }
}

function getWeeklyEventKey(meetId: string, eventId: string, format: string) {
  return `${meetId}-wca-${eventId}-${format}`;
}

function mapPlayerRow(row: WeeklyPlayerRow): WeeklyPlayer {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    wcaId: row.wca_id,
    gender: row.gender === "女" ? "女" : "男",
    province: row.province || "辽宁",
    city: row.city || "",
    birthDate: row.birth_date || "",
    ageGroup: getWeeklyAgeGroup(row.birth_date || ""),
    ageGroupIsFuzzy: false
  };
}

function slugifyName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function eventOrder(eventId: string) {
  const order = ["333", "222", "444", "555", "666", "777", "333oh", "pyram", "skewb", "clock", "minx", "sq1", "mirror", "maple", "individual", "team", "bigstack100", "bigstack300"];
  const index = order.indexOf(eventId);
  return index >= 0 ? index : 100;
}

function withTestMeet(meets: WeeklyMeetOption[]) {
  return [testWeeklyMeet, ...meets.filter((meet) => meet.id !== testWeeklyMeet.id)];
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const itemKey = key(item);
    const group = map.get(itemKey) || [];
    group.push(item);
    map.set(itemKey, group);
  }
  return map;
}
