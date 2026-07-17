import { getPostgresPool } from "@/lib/postgres";
import type { PoolClient } from "pg";
import { getWcaEventName, isWcaEventId, WEEKLY_DEFAULT_EVENT_IDS } from "@/lib/wca-events";
import { getWeeklyAgeGroup, getWeeklyRankingAgeGroup, getWeeklyRankingAgeGroupOrder } from "@/lib/weekly-age-groups";
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
import { ensureWeeklyPlayerLibraryTable, getMofang602SeedWeeklyPlayers, listWeeklyEligiblePlayers, type WeeklyPersonalBests } from "@/lib/weekly-player-library";
import { matchesWeeklyPlayerQuery } from "@/lib/weekly-player-search";

export type WeeklyMeetOption = {
  id: string;
  slug: string;
  title: string;
  dateLabel: string;
  status?: string;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type WeeklyPlayer = {
  id: string;
  name: string;
  slug: string;
  wcaId: string;
  wcaIdConfirmed?: boolean;
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
  pbRefreshed: boolean;
  pbAverageRefreshed: boolean;
};

export type WeeklyOperationLog = {
  id: number;
  resultId: number;
  action: "created" | "updated" | "corrected" | "deleted";
  playerName: string;
  reason: string;
  previousAverage: number | null;
  nextAverage: number | null;
  createdAt: string;
};

export type WeeklyMeetEventConfig = {
  eventId: string;
  format: WeeklyResultFormat;
  enabled: boolean;
  seq: number;
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
  player_id: string | null;
  source: string;
  wca_id?: string | null;
  wca_id_confirmed?: boolean;
  player_birth_date?: string | null;
  player_age_group?: string | null;
  player_province?: string | null;
  player_city?: string | null;
  pb_refreshed?: boolean;
  pb_average_refreshed?: boolean;
  meet_starts_at?: string | null;
};

type WeeklyAttemptRow = {
  result_id: number;
  seq: number;
  value: string | null;
};

const testWeeklyMeet: WeeklyMeetOption = {
  id: "weekly-test-entry",
  slug: "test-entry",
  title: "当前测试周赛",
  dateLabel: "测试用",
  status: "open"
};

let weeklySchemaPromise: Promise<void> | null = null;

export function ensureWeeklyEntryTables() {
  if (weeklySchemaPromise) return weeklySchemaPromise;

  weeklySchemaPromise = (async () => {
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

    await pool.query("ALTER TABLE weekly_meets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'");
    await pool.query("ALTER TABLE weekly_meets ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ");
    await pool.query("ALTER TABLE weekly_meets ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ");
    await pool.query("ALTER TABLE weekly_events ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'avg5'");
    await pool.query("ALTER TABLE weekly_events ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 5");
    await pool.query("ALTER TABLE weekly_results ADD COLUMN IF NOT EXISTS player_id TEXT");
    await pool.query("ALTER TABLE weekly_results ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'self'");
    await pool.query("ALTER TABLE weekly_results ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()");
    await pool.query("ALTER TABLE weekly_results ADD COLUMN IF NOT EXISTS pb_average_refreshed BOOLEAN NOT NULL DEFAULT FALSE");
    await pool.query("CREATE INDEX IF NOT EXISTS weekly_results_player_id_idx ON weekly_results (player_id)");
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS weekly_results_meet_event_player_idx
      ON weekly_results (meet_id, event_id, player_id)
      WHERE player_id IS NOT NULL
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS weekly_result_revisions (
        id BIGSERIAL PRIMARY KEY,
        result_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        previous_attempts JSONB NOT NULL DEFAULT '[]'::jsonb,
        next_attempts JSONB NOT NULL DEFAULT '[]'::jsonb,
        previous_average NUMERIC(10, 3),
        next_average NUMERIC(10, 3),
        actor TEXT NOT NULL DEFAULT 'admin',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await pool.query("CREATE INDEX IF NOT EXISTS weekly_result_revisions_result_id_idx ON weekly_result_revisions (result_id, created_at DESC)");
    await pool.query("ALTER TABLE weekly_result_revisions ADD COLUMN IF NOT EXISTS meet_id TEXT");
    await pool.query("ALTER TABLE weekly_result_revisions ADD COLUMN IF NOT EXISTS event_id TEXT");
    await pool.query("ALTER TABLE weekly_result_revisions ADD COLUMN IF NOT EXISTS player_id TEXT");
    await pool.query("ALTER TABLE weekly_result_revisions ADD COLUMN IF NOT EXISTS player_name TEXT NOT NULL DEFAULT ''");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS weekly_meet_event_configs (
        meet_id TEXT NOT NULL REFERENCES weekly_meets(id) ON DELETE CASCADE,
        event_id TEXT NOT NULL,
        format TEXT NOT NULL DEFAULT 'avg5',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        seq INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (meet_id, event_id)
      )
    `);
  })().catch((error) => {
    weeklySchemaPromise = null;
    throw error;
  });

  return weeklySchemaPromise;
}

export async function listWeeklyMeetOptions(): Promise<WeeklyMeetOption[]> {
  try {
    const pool = getPostgresPool();
    const { rows } = await pool.query<WeeklyMeetOption>(
      `SELECT id, slug, title, date_label AS "dateLabel", status,
              starts_at AS "startsAt", ends_at AS "endsAt"
       FROM weekly_meets
       ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, week_number DESC, created_at DESC`
    );
    if (rows.length > 0) return withOptionalTestMeet(rows);
  } catch {
    // Local development can run without DATABASE_URL; keep selectors usable from bundled weekly data.
  }

  return withOptionalTestMeet(
    weeklyMeets.map((meet) => ({
      id: meet.id,
      slug: meet.slug,
      title: meet.title,
      dateLabel: meet.dateLabel,
      status: "published"
    }))
  );
}

export async function listWeeklyMeetEventConfigs(meetId: string): Promise<WeeklyMeetEventConfig[]> {
  await ensureWeeklyEntryTables();
  const pool = getPostgresPool();
  const { rows } = await pool.query<{ event_id: string; format: string; enabled: boolean; seq: number }>(
    `SELECT event_id, format, enabled, seq
     FROM weekly_meet_event_configs
     WHERE meet_id = $1
     ORDER BY seq, event_id`,
    [meetId]
  );
  return rows.map((row) => ({
    eventId: row.event_id,
    format: getWeeklyResultFormat(row.format).id,
    enabled: row.enabled,
    seq: row.seq
  }));
}

export async function getWeeklyMeetEntryAvailability(meetIdOrSlug: string) {
  await ensureWeeklyEntryTables();
  const pool = getPostgresPool();
  const { rows } = await pool.query<{ status: string; starts_at: string | null; ends_at: string | null }>(
    `SELECT status, starts_at, ends_at
     FROM weekly_meets
     WHERE id = $1 OR slug = $1
     LIMIT 1`,
    [meetIdOrSlug]
  );
  const meet = rows[0];
  if (!meet) return { canEnter: false, message: "周赛不存在" };
  if (meet.status !== "open") return { canEnter: false, message: "本周赛暂未开放成绩录入" };
  const now = Date.now();
  if (meet.starts_at && new Date(meet.starts_at).getTime() > now) return { canEnter: false, message: "周赛尚未开始" };
  if (meet.ends_at && new Date(meet.ends_at).getTime() < now) return { canEnter: false, message: "本周赛成绩录入已截止" };
  return { canEnter: true, message: "" };
}

export async function createWeeklyMeet() {
  await ensureWeeklyEntryTables();
  const pool = getPostgresPool();
  const { rows } = await pool.query<{ week_number: number }>("SELECT week_number FROM weekly_meets ORDER BY week_number DESC LIMIT 1");
  const weekNumber = (rows[0]?.week_number || 0) + 1;
  const now = new Date();
  const year = now.getFullYear();
  const yearWeek = getIsoWeek(now);
  const id = `weekly-${weekNumber}`;
  const title = `辽宁魔方线上周赛第${weekNumber}周`;
  const dateLabel = `${year}年第${yearWeek}周`;

  await pool.query(
    `INSERT INTO weekly_meets
      (id, slug, title, week_number, year, year_week, event, date_label, summary, pb_note, three_age_intro, status)
     VALUES ($1,$2,$3,$4,$5,$6,'三阶',$7,'','','','draft')`,
    [id, String(weekNumber), title, weekNumber, year, yearWeek, dateLabel]
  );
  await saveWeeklyMeetEventConfigs(pool, id, defaultWeeklyMeetEventConfigs());
  return { id, slug: String(weekNumber), title, dateLabel, status: "draft" } satisfies WeeklyMeetOption;
}

export async function updateWeeklyMeetConfig(input: {
  id: string;
  title: string;
  dateLabel: string;
  status: "draft" | "open" | "closed" | "archived";
  startsAt?: string | null;
  endsAt?: string | null;
  eventConfigs: WeeklyMeetEventConfig[];
}) {
  if (!input.title.trim() || !input.dateLabel.trim()) throw new Error("请填写周赛标题和周期");
  if (!input.eventConfigs.some((item) => item.enabled)) throw new Error("请至少开放一个项目");
  await ensureWeeklyEntryTables();
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE weekly_meets
       SET title = $1, date_label = $2, status = $3, starts_at = $4, ends_at = $5
       WHERE id = $6`,
      [input.title.trim(), input.dateLabel.trim(), input.status, input.startsAt || null, input.endsAt || null, input.id]
    );
    if (updated.rowCount === 0) throw new Error("周赛不存在");
    await saveWeeklyMeetEventConfigs(client, input.id, input.eventConfigs);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function searchWeeklyPlayers(query: string): Promise<WeeklyPlayer[]> {
  const q = query.trim();
  try {
    const libraryPlayers = await listWeeklyEligiblePlayers();
    return libraryPlayers
      .filter((player) => !q || matchesWeeklyPlayerQuery(player, q))
      .map((player) => ({
        id: player.id,
        name: player.name,
        slug: "",
        wcaId: player.wcaId || "",
        wcaIdConfirmed: Boolean(player.wcaIdConfirmed),
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
      .filter((player) => !q || matchesWeeklyPlayerQuery(player, q))
      .map((player) => ({
        id: player.id,
        name: player.name,
        slug: "",
        wcaId: player.wcaId || "",
        wcaIdConfirmed: Boolean(player.wcaIdConfirmed),
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

  await ensureWeeklyEntryTables();
  await ensureWeeklyPlayerLibraryTable();
  const eligiblePlayers = await listWeeklyEligiblePlayers().catch(() => []);
  const pool = getPostgresPool();
  const meet = await resolveWeeklyMeet(meetIdOrSlug);
  if (!meet) throw new Error("周赛不存在");
  await assertWeeklyEventConfig(pool, meet.id, eventId, formatConfig.id);

  const eventKeys = [getWeeklyEventKey(meet.id, eventId, formatConfig.id)];
  if (eventId === "333" && formatConfig.id === "avg5") eventKeys.push("main");
  const { rows } = await pool.query<WeeklyResultRow>(
    `SELECT wr.*, COALESCE(NULLIF(wpl.wca_id, ''), CASE WHEN wr.player_id LIKE 'wca:%' THEN SUBSTRING(wr.player_id FROM 5) ELSE '' END) AS wca_id,
       COALESCE(wpl.birth_date, '') AS player_birth_date,
       COALESCE(wpl.age_group_override, '') AS player_age_group,
       COALESCE(wpl.province, '') AS player_province,
       COALESCE(wpl.city, '') AS player_city,
       COALESCE(wpl.wca_id_confirmed, FALSE) AS wca_id_confirmed,
       wm.starts_at AS meet_starts_at
     FROM weekly_results wr
     LEFT JOIN weekly_player_library wpl ON wpl.id = wr.player_id
     LEFT JOIN weekly_meets wm ON wm.id = wr.meet_id
       WHERE wr.meet_id = $1 AND wr.event_id = ANY($2::text[])
     `,
    [meet.id, eventKeys]
  );
  rows.sort(compareWeeklyResultRows);
  const resultIds = rows.map((row) => row.id);
  const attempts =
    resultIds.length > 0
      ? await pool.query<WeeklyAttemptRow>("SELECT * FROM weekly_attempts WHERE result_id = ANY($1) ORDER BY result_id, seq", [resultIds])
      : { rows: [] };
  const attemptsByResult = groupBy(attempts.rows, (row) => row.result_id);

  const rankByGroup = new Map<string, number>();
  return rows.map((row) => {
    const matchedPlayer = eligiblePlayers.find((player) => player.id === row.player_id) || eligiblePlayers.find((player) => player.name === row.player_name);
    const wcaId = row.wca_id || matchedPlayer?.wcaId || "";
    const rankingAgeGroup = getWeeklyRankingAgeGroup("", row.player_age_group || row.age_group || "", row.meet_starts_at ? new Date(row.meet_starts_at) : new Date());
    const rank = (rankByGroup.get(rankingAgeGroup) || 0) + 1;
    rankByGroup.set(rankingAgeGroup, rank);
    const attemptValues = (attemptsByResult.get(row.id) || []).map((attempt) => secondsToResultValue(attempt.value));
    return {
      id: row.id,
      rank,
      player: {
        id: row.player_id || (row.player_slug ? `code:${row.player_slug}` : row.player_name),
        name: row.player_name,
        slug: row.player_slug,
        wcaId,
        wcaIdConfirmed: Boolean(row.wca_id_confirmed || matchedPlayer?.wcaIdConfirmed),
        gender: row.gender === "女" ? "女" : "男",
        province: row.player_province || matchedPlayer?.province || "辽宁",
        city: row.player_city || matchedPlayer?.city || "",
        birthDate: row.player_birth_date || "",
        ageGroup: rankingAgeGroup,
        ageGroupIsFuzzy: false
      },
      best: secondsToResultValue(row.personal_best),
      average: secondsToResultValue(row.average),
      attempts: attemptValues,
      detail: attemptValues.map(formatResult).join(" / "),
      pbRefreshed: Boolean(row.pb_refreshed),
      pbAverageRefreshed: Boolean(row.pb_average_refreshed)
    };
  });
}

export async function listWeeklyOperationLogs(meetIdOrSlug: string, eventId: string, format: string = "avg5"): Promise<WeeklyOperationLog[]> {
  if (!isWcaEventId(eventId)) throw new Error("项目不正确");
  const formatConfig = getWeeklyResultFormat(format);
  await ensureWeeklyEntryTables();
  const pool = getPostgresPool();
  const meet = await resolveWeeklyMeet(meetIdOrSlug);
  if (!meet) throw new Error("周赛不存在");
  const eventKeys = [getWeeklyEventKey(meet.id, eventId, formatConfig.id)];
  if (eventId === "333" && formatConfig.id === "avg5") eventKeys.push("main");
  const { rows } = await pool.query<{
    id: number;
    result_id: number;
    action: string;
    player_name: string;
    reason: string;
    previous_average: string | null;
    next_average: string | null;
    created_at: string;
  }>(
    `SELECT id, result_id, action, player_name, reason, previous_average, next_average, created_at
     FROM weekly_result_revisions
     WHERE meet_id = $1 AND event_id = ANY($2::text[])
     ORDER BY created_at DESC
     LIMIT 100`,
    [meet.id, eventKeys]
  );
  return rows.map((row) => ({
    id: row.id,
    resultId: row.result_id,
    action: row.action as WeeklyOperationLog["action"],
    playerName: row.player_name || "未知选手",
    reason: row.reason,
    previousAverage: row.previous_average === null ? null : Number(row.previous_average),
    nextAverage: row.next_average === null ? null : Number(row.next_average),
    createdAt: row.created_at
  }));
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
  if (input.eventId === "individual" && formatConfig.id !== "best1") throw new Error("个人全能只允许录入一次连续计时成绩");
  if (input.eventId !== "individual" && formatConfig.id === "best1") throw new Error("常规项目必须录满五次成绩");
  if (!input.player?.name?.trim()) throw new Error("请选择选手");
  if (!Array.isArray(input.attempts) || input.attempts.length !== formatConfig.attemptCount) {
    throw new Error(`必须录入 ${formatConfig.attemptCount} 次成绩`);
  }

  const parsedAttempts = input.attempts.map(parseResultInput);
  const calculated = calculateResultByFormat(parsedAttempts, formatConfig.id);
  await ensureWeeklyEntryTables();
  await ensureWeeklyPlayerLibraryTable();
  const meet = input.meetId === testWeeklyMeet.id ? await ensureTestWeeklyMeet() : await resolveWeeklyMeet(input.meetId);
  if (!meet) throw new Error("周赛不存在");

  const pool = getPostgresPool();
  const client = await pool.connect();
  const eventName = getWcaEventName(input.eventId);
  const playerName = input.player.name.trim();
  const playerSlug = input.player.slug || (input.player.id.startsWith("code:") ? input.player.id.slice(5) : "");
  const pbEventId = getPersonalBestEventId(input.eventId);
  const playerAgeGroup = getWeeklyAgeGroup(input.player.birthDate, meet.startsAt ? new Date(meet.startsAt) : new Date()) || input.player.ageGroup || "";

  try {
    await client.query("BEGIN");
    await assertWeeklyEventConfig(client, meet.id, input.eventId, formatConfig.id);
    const eventKey = await resolveWeeklyEventKey(client, meet.id, input.eventId, formatConfig.id);
    const playerLibrary = await client.query<{ personal_bests: WeeklyPersonalBests | null; personal_bests_average: WeeklyPersonalBests | null }>(
      "SELECT personal_bests, personal_bests_average FROM weekly_player_library WHERE id = $1 FOR UPDATE",
      [input.player.id]
    );
    const storedPersonalBests = playerLibrary.rows[0]?.personal_bests || {};
    const storedAveragePersonalBests = playerLibrary.rows[0]?.personal_bests_average || {};
    const previousPersonalBest = getStoredPersonalBest(storedPersonalBests, pbEventId);
    const previousAveragePersonalBest = getStoredPersonalBest(storedAveragePersonalBests, pbEventId);
    const currentBest = resultValueToSeconds(calculated.best);
    const currentAverage = resultValueToSeconds(calculated.average);
    const pbRefreshed = currentBest >= 0 && (previousPersonalBest === null || currentBest < previousPersonalBest);
    const pbAverageRefreshed = currentAverage >= 0 && (previousAveragePersonalBest === null || currentAverage < previousAveragePersonalBest);
    await client.query(
      `INSERT INTO weekly_events (id, meet_id, kind, title, event_name, group_name, is_all_around, format, attempt_count, seq)
       VALUES ($1,$2,$3,$4,$5,NULL,FALSE,$6,$7,$8)
       ON CONFLICT (id, meet_id) DO UPDATE
       SET title = EXCLUDED.title,
           event_name = EXCLUDED.event_name,
           format = EXCLUDED.format,
           attempt_count = EXCLUDED.attempt_count`,
      [eventKey, meet.id, "other", `${eventName} · ${formatConfig.name}`, eventName, formatConfig.id, formatConfig.attemptCount, eventOrder(input.eventId)]
    );

    const existing = await client.query<{ id: number; average: string }>(
      `SELECT id FROM weekly_results
       WHERE meet_id = $1 AND event_id = $2
         AND (player_id = $3 OR (player_id IS NULL AND player_name = $4))
       ORDER BY player_id NULLS LAST
       LIMIT 1`,
      [meet.id, eventKey, input.player.id, playerName]
    );
    const previousAttempts = existing.rows[0] ? await readWeeklyAttempts(client, existing.rows[0].id) : [];

    let resultId = existing.rows[0]?.id;
    if (resultId) {
      await client.query(
        `UPDATE weekly_results
         SET player_id = $1, player_slug = $2, gender = $3, age_group = $4,
             average = $5, personal_best = $6, pb_refreshed = $7, pb_average_refreshed = $8, source = 'self', updated_at = now()
         WHERE id = $9`,
        [
          input.player.id,
          playerSlug,
          input.player.gender === "女" ? "女" : "男",
          playerAgeGroup || null,
          resultValueToSeconds(calculated.average),
          resultValueToSeconds(calculated.best),
          pbRefreshed,
          pbAverageRefreshed,
          resultId
        ]
      );
      await client.query("DELETE FROM weekly_attempts WHERE result_id = $1", [resultId]);
    } else {
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO weekly_results
          (event_id, meet_id, rank, player_id, player_name, player_slug, gender, age_group, level, grade, average, personal_best, pb_refreshed, pb_average_refreshed, source, updated_at)
         VALUES ($1,$2,0,$3,$4,$5,$6,$7,'','',$8,$9,$10,$11,'self',now())
         RETURNING id`,
        [
          eventKey,
          meet.id,
          input.player.id,
          playerName,
          playerSlug,
          input.player.gender === "女" ? "女" : "男",
          playerAgeGroup || null,
          resultValueToSeconds(calculated.average),
          resultValueToSeconds(calculated.best),
          pbRefreshed,
          pbAverageRefreshed
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

    await client.query(
      `INSERT INTO weekly_result_revisions
        (result_id, action, reason, previous_attempts, next_attempts, previous_average, next_average, meet_id, event_id, player_id, player_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        resultId,
        existing.rows[0] ? "updated" : "created",
        existing.rows[0] ? "成绩录入（覆盖原成绩）" : "成绩录入",
        JSON.stringify(previousAttempts.map(formatResult)),
        JSON.stringify(parsedAttempts.map(formatResult)),
        existing.rows[0]?.average ?? null,
        resultValueToSeconds(calculated.average),
        meet.id,
        eventKey,
        input.player.id,
        playerName
      ]
    );

    await refreshWeeklyPlayerPersonalBest(client, input.player.id, input.eventId, pbEventId);

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

export async function correctWeeklyResult(input: {
  resultId: number;
  format: WeeklyResultFormat;
  attempts: string[];
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("请填写修改原因");

  const formatConfig = getWeeklyResultFormat(input.format);
  if (!Array.isArray(input.attempts) || input.attempts.length !== formatConfig.attemptCount) {
    throw new Error(`必须录入 ${formatConfig.attemptCount} 次成绩`);
  }

  const parsedAttempts = input.attempts.map(parseResultInput);
  const calculated = calculateResultByFormat(parsedAttempts, formatConfig.id);
  await ensureWeeklyEntryTables();
  await ensureWeeklyPlayerLibraryTable();

  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: number; meet_id: string; event_id: string; player_id: string | null; player_name: string; average: string }>(
      "SELECT id, meet_id, event_id, player_id, player_name, average FROM weekly_results WHERE id = $1 FOR UPDATE",
      [input.resultId]
    );
    if (!result.rows[0]) throw new Error("成绩不存在或已被删除");
    const storedFormat = getStoredFormat(result.rows[0].event_id);
    if (storedFormat !== formatConfig.id) throw new Error("修改赛制与原成绩不一致");

    const previousAttempts = await readWeeklyAttempts(client, input.resultId);
    await client.query(
      `UPDATE weekly_results
       SET average = $1, personal_best = $2, pb_refreshed = FALSE, pb_average_refreshed = FALSE, source = 'admin', updated_at = now()
       WHERE id = $3`,
      [resultValueToSeconds(calculated.average), resultValueToSeconds(calculated.best), input.resultId]
    );
    await client.query("DELETE FROM weekly_attempts WHERE result_id = $1", [input.resultId]);
    await insertWeeklyAttempts(client, input.resultId, parsedAttempts);
    await client.query(
      `INSERT INTO weekly_result_revisions
        (result_id, action, reason, previous_attempts, next_attempts, previous_average, next_average, meet_id, event_id, player_id, player_name)
       VALUES ($1,'corrected',$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        input.resultId,
        reason,
        JSON.stringify(previousAttempts.map(formatResult)),
        JSON.stringify(parsedAttempts.map(formatResult)),
        result.rows[0].average,
        resultValueToSeconds(calculated.average),
        result.rows[0].meet_id,
        result.rows[0].event_id,
        result.rows[0].player_id,
        result.rows[0].player_name
      ]
    );
    if (result.rows[0].player_id) {
      const eventId = getEventIdFromStoredKey(result.rows[0].event_id);
      await refreshWeeklyPlayerPersonalBest(client, result.rows[0].player_id, eventId, getPersonalBestEventId(eventId));
    }
    await rerankWeeklyEvent(client, result.rows[0].meet_id, result.rows[0].event_id);
    await client.query("COMMIT");
    return calculated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteWeeklyResult(input: { resultId: number; reason: string }) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("请填写删除原因");

  await ensureWeeklyEntryTables();
  await ensureWeeklyPlayerLibraryTable();
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: number; meet_id: string; event_id: string; player_id: string | null; player_name: string; average: string }>(
      "SELECT id, meet_id, event_id, player_id, player_name, average FROM weekly_results WHERE id = $1 FOR UPDATE",
      [input.resultId]
    );
    if (!result.rows[0]) throw new Error("成绩不存在或已被删除");

    const previousAttempts = await readWeeklyAttempts(client, input.resultId);
    await client.query(
      `INSERT INTO weekly_result_revisions
        (result_id, action, reason, previous_attempts, previous_average, meet_id, event_id, player_id, player_name)
       VALUES ($1,'deleted',$2,$3,$4,$5,$6,$7,$8)`,
      [input.resultId, reason, JSON.stringify(previousAttempts.map(formatResult)), result.rows[0].average, result.rows[0].meet_id, result.rows[0].event_id, result.rows[0].player_id, result.rows[0].player_name]
    );
    await client.query("DELETE FROM weekly_results WHERE id = $1", [input.resultId]);
    if (result.rows[0].player_id) {
      const eventId = getEventIdFromStoredKey(result.rows[0].event_id);
      await refreshWeeklyPlayerPersonalBest(client, result.rows[0].player_id, eventId, getPersonalBestEventId(eventId));
    }
    await rerankWeeklyEvent(client, result.rows[0].meet_id, result.rows[0].event_id);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function resolveWeeklyMeet(idOrSlug: string) {
  const pool = getPostgresPool();
  const { rows } = await pool.query<{ id: string; slug: string; yearWeek: number; startsAt: string | null }>(
    `SELECT id, slug, year_week AS "yearWeek", starts_at AS "startsAt"
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
      (id, slug, title, week_number, year, year_week, status, published_at, event, date_label, summary, pb_note, three_age_intro)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title,
           date_label = EXCLUDED.date_label,
           status = EXCLUDED.status,
           summary = EXCLUDED.summary`,
    [
      testWeeklyMeet.id,
      testWeeklyMeet.slug,
      testWeeklyMeet.title,
      0,
      2026,
      0,
      "open",
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
  const { rows } = await client.query<{ id: number; player_name: string; average: string; personal_best: string; age_group: string; birth_date: string; starts_at: string | null }>(
    `SELECT wr.id, wr.player_name, wr.average, wr.personal_best, wr.age_group, COALESCE(wpl.birth_date, '') AS birth_date, wm.starts_at
     FROM weekly_results wr
     LEFT JOIN weekly_player_library wpl ON wpl.id = wr.player_id
     LEFT JOIN weekly_meets wm ON wm.id = wr.meet_id
     WHERE wr.meet_id = $1 AND wr.event_id = $2`,
    [meetId, eventId]
  );

  rows.sort(compareWeeklyResultRows);
  const rankByGroup = new Map<string, number>();
  for (const row of rows) {
    const group = getWeeklyRankingAgeGroup("", row.age_group || "", row.starts_at ? new Date(row.starts_at) : new Date());
    const rank = (rankByGroup.get(group) || 0) + 1;
    rankByGroup.set(group, rank);
    await client.query("UPDATE weekly_results SET rank = $1 WHERE id = $2", [rank, row.id]);
  }
}

function compareWeeklyResultRows(
  a: { player_name: string; average: string; personal_best: string; age_group: string | null; player_birth_date?: string | null; birth_date?: string | null; player_age_group?: string | null; meet_starts_at?: string | null },
  b: { player_name: string; average: string; personal_best: string; age_group: string | null; player_birth_date?: string | null; birth_date?: string | null; player_age_group?: string | null; meet_starts_at?: string | null }
) {
  const groupA = getWeeklyRankingAgeGroup("", a.player_age_group || a.age_group || "", a.meet_starts_at ? new Date(a.meet_starts_at) : new Date());
  const groupB = getWeeklyRankingAgeGroup("", b.player_age_group || b.age_group || "", b.meet_starts_at ? new Date(b.meet_starts_at) : new Date());
  return getWeeklyRankingAgeGroupOrder(groupA) - getWeeklyRankingAgeGroupOrder(groupB) || compareResultScore(a, b) || a.player_name.localeCompare(b.player_name, "zh-CN");
}

function compareResultScore(a: { average: string; personal_best: string }, b: { average: string; personal_best: string }) {
  const averageA = Number(a.average);
  const averageB = Number(b.average);
  const averageOrder = (averageA < 0 ? 1 : 0) - (averageB < 0 ? 1 : 0) || averageA - averageB;
  if (averageOrder !== 0) return averageOrder;
  const bestA = Number(a.personal_best);
  const bestB = Number(b.personal_best);
  return (bestA < 0 ? 1 : 0) - (bestB < 0 ? 1 : 0) || bestA - bestB;
}

function getPersonalBestEventId(eventId: string): keyof WeeklyPersonalBests {
  if (eventId === "individual") return "allAround";
  if (eventId === "maple") return "maple";
  return eventId as keyof WeeklyPersonalBests;
}

function getStoredPersonalBest(personalBests: WeeklyPersonalBests, eventId: keyof WeeklyPersonalBests) {
  const value = Number(personalBests[eventId]);
  if (Number.isFinite(value) && value > 0) return value;
  // 兼容早期把枫叶成绩误存为 skewb 的 PB 数据。
  if (eventId === "maple") {
    const legacy = Number(personalBests.skewb);
    if (Number.isFinite(legacy) && legacy > 0) return legacy;
  }
  return null;
}

async function readWeeklyAttempts(client: PoolClient, resultId: number): Promise<ResultValue[]> {
  const { rows } = await client.query<WeeklyAttemptRow>(
    "SELECT result_id, seq, value FROM weekly_attempts WHERE result_id = $1 ORDER BY seq",
    [resultId]
  );
  return rows.map((row) => secondsToResultValue(row.value));
}

async function insertWeeklyAttempts(client: PoolClient, resultId: number, attempts: ResultValue[]) {
  for (const [index, attempt] of attempts.entries()) {
    await client.query("INSERT INTO weekly_attempts (result_id, seq, value) VALUES ($1,$2,$3)", [
      resultId,
      index + 1,
      resultValueToSeconds(attempt)
    ]);
  }
}

function defaultWeeklyMeetEventConfigs(): WeeklyMeetEventConfig[] {
  return WEEKLY_DEFAULT_EVENT_IDS.map((eventId, index) => ({
    eventId,
    format: eventId === "individual" ? "best1" : "avg5",
    enabled: true,
    seq: index
  }));
}

async function saveWeeklyMeetEventConfigs(client: Pick<PoolClient, "query">, meetId: string, configs: WeeklyMeetEventConfig[]) {
  await client.query("DELETE FROM weekly_meet_event_configs WHERE meet_id = $1", [meetId]);
  for (const [index, config] of configs.entries()) {
    if (!isWcaEventId(config.eventId)) throw new Error("项目不正确");
    const format = getWeeklyResultFormat(config.format).id;
    if (config.eventId === "individual" && format !== "best1") throw new Error("个人全能只允许使用单次赛制");
    if (config.eventId !== "individual" && format === "best1") throw new Error("常规项目不能使用单次赛制");
    await client.query(
      `INSERT INTO weekly_meet_event_configs (meet_id, event_id, format, enabled, seq)
       VALUES ($1,$2,$3,$4,$5)`,
      [meetId, config.eventId, format, config.enabled, config.seq ?? index]
    );
  }
}

function getIsoWeek(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getWeeklyEventKey(meetId: string, eventId: string, format: string) {
  return `${meetId}-wca-${eventId}-${format}`;
}

async function assertWeeklyEventConfig(client: Pick<PoolClient, "query">, meetId: string, eventId: string, format: WeeklyResultFormat) {
  const configured = await client.query<{ event_id: string; format: string; enabled: boolean }>(
    "SELECT event_id, format, enabled FROM weekly_meet_event_configs WHERE meet_id = $1",
    [meetId]
  );
  const configRows = configured.rows;
  const config = configRows.length > 0
    ? configRows.find((row) => row.event_id === eventId)
    : defaultWeeklyMeetEventConfigs().find((item) => item.eventId === eventId);
  if (!config || !config.enabled) throw new Error("本项目未在本场周赛开放");
  if (getWeeklyResultFormat(config.format).id !== format) throw new Error("本项目赛制与周赛配置不一致");
}

async function resolveWeeklyEventKey(client: Pick<PoolClient, "query">, meetId: string, eventId: string, format: WeeklyResultFormat) {
  if (eventId === "333" && format === "avg5") {
    const legacy = await client.query("SELECT 1 FROM weekly_events WHERE meet_id = $1 AND id = 'main' LIMIT 1", [meetId]);
    if (legacy.rowCount) return "main";
  }
  return getWeeklyEventKey(meetId, eventId, format);
}

function getEventIdFromStoredKey(eventKey: string) {
  if (eventKey === "main") return "333";
  const match = eventKey.match(/-wca-([^-]+)-/);
  if (!match || !isWcaEventId(match[1])) throw new Error("成绩项目不正确");
  return match[1];
}

async function refreshWeeklyPlayerPersonalBest(
  client: Pick<PoolClient, "query">,
  playerId: string,
  eventId: string,
  pbEventId: keyof WeeklyPersonalBests
) {
  const library = await client.query<{
    personal_bests: WeeklyPersonalBests | null;
    personal_bests_average: WeeklyPersonalBests | null;
    personal_bests_base: WeeklyPersonalBests | null;
    personal_bests_average_base: WeeklyPersonalBests | null;
  }>(
    "SELECT personal_bests, personal_bests_average, personal_bests_base, personal_bests_average_base FROM weekly_player_library WHERE id = $1 FOR UPDATE",
    [playerId]
  );
  if (!library.rows[0]) return;

  const row = library.rows[0];
  const baseBest = row.personal_bests_base && Object.keys(row.personal_bests_base).length > 0 ? row.personal_bests_base : row.personal_bests || {};
  const baseAverage = row.personal_bests_average_base && Object.keys(row.personal_bests_average_base).length > 0 ? row.personal_bests_average_base : row.personal_bests_average || {};
  const results = await client.query<{ personal_best: string; average: string }>(
    `SELECT personal_best, average
     FROM weekly_results
     WHERE player_id = $1
       AND (event_id LIKE $2 OR ($3 AND event_id = 'main'))`,
    [playerId, `%-wca-${eventId}-%`, eventId === "333"]
  );
  const resultBest = results.rows.map((item) => Number(item.personal_best)).filter((value) => Number.isFinite(value) && value >= 0);
  const resultAverage = results.rows.map((item) => Number(item.average)).filter((value) => Number.isFinite(value) && value >= 0);
  const bestCandidates = [Number(baseBest[pbEventId]), ...resultBest].filter((value) => Number.isFinite(value) && value > 0);
  const averageCandidates = [Number(baseAverage[pbEventId]), ...resultAverage].filter((value) => Number.isFinite(value) && value > 0);
  const nextBest = { ...(row.personal_bests || {}) };
  const nextAverage = { ...(row.personal_bests_average || {}) };
  if (bestCandidates.length > 0) nextBest[pbEventId] = Math.min(...bestCandidates);
  else delete nextBest[pbEventId];
  if (averageCandidates.length > 0) nextAverage[pbEventId] = Math.min(...averageCandidates);
  else delete nextAverage[pbEventId];
  await client.query(
    `UPDATE weekly_player_library
     SET personal_bests = $1::jsonb, personal_bests_average = $2::jsonb,
         personal_bests_base = CASE WHEN personal_bests_base = '{}'::jsonb THEN $4::jsonb ELSE personal_bests_base END,
         personal_bests_average_base = CASE WHEN personal_bests_average_base = '{}'::jsonb THEN $5::jsonb ELSE personal_bests_average_base END,
         updated_at = now()
     WHERE id = $3`,
    [JSON.stringify(nextBest), JSON.stringify(nextAverage), playerId, JSON.stringify(baseBest), JSON.stringify(baseAverage)]
  );
}

function getStoredFormat(eventKey: string): WeeklyResultFormat {
  if (eventKey === "main") return "avg5";
  const format = eventKey.split("-").at(-1);
  return getWeeklyResultFormat(format).id;
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

function withOptionalTestMeet(meets: WeeklyMeetOption[]) {
  return process.env.WEEKLY_TEST_MODE === "true" ? [testWeeklyMeet, ...meets] : meets;
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
