import { getPostgresPool } from "@/lib/postgres";
import type { PoolClient } from "pg";
import { getWcaEventName, isWcaEventId, WEEKLY_DEFAULT_EVENT_IDS } from "@/lib/wca-events";
import { getWeeklyAgeGroup, getWeeklyRankingAgeGroup, getWeeklyRankingAgeGroupOrder } from "@/lib/weekly-age-groups";
import { buildWeeklyRankAssignments } from "@/lib/weekly-ranking";
import { weeklyBusinessDate } from "@/lib/weekly-results-import-dates";
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
import { createLibraryPlayerId, listWeeklyEligiblePlayers, type WeeklyPersonalBests } from "@/lib/weekly-player-library";
import { matchesWeeklyPlayerQuery } from "@/lib/weekly-player-search";
import { weeklyV2ActivePlayerSql, weeklyV2PlayerSourceSql } from "@/lib/weekly-player-scope";

export type WeeklyMeetOption = {
  id: string;
  slug: string;
  title: string;
  dateLabel: string;
  status?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  isPublic: boolean;
  dataVersion: number;
};

export type WeeklyHistoryAdminRow = {
  id: string;
  title: string;
  weekNumber: number;
  dateLabel: string;
  status: string;
  resultCount: number;
  competitorCount: number;
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
  matched_wca_id?: string | null;
  matched_wca_id_confirmed?: boolean;
  pb_refreshed?: boolean;
  pb_average_refreshed?: boolean;
  meet_starts_at?: string | null;
};

type WeeklyAttemptRow = {
  result_id: number;
  seq: number;
  value: string | null;
  value_centiseconds: number | null;
  status: string;
};

const testWeeklyMeet: WeeklyMeetOption = {
  id: "weekly-test-entry",
  slug: "test-entry",
  title: "当前测试周赛",
  dateLabel: "测试用",
  status: "open",
  isPublic: false,
  dataVersion: 2
};

export async function listWeeklyMeetOptions(): Promise<WeeklyMeetOption[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<WeeklyMeetOption>(
    `SELECT id, slug, title, date_label AS "dateLabel", status,
            starts_at AS "startsAt", ends_at AS "endsAt",
            is_public AS "isPublic", data_version AS "dataVersion"
     FROM weekly_meets
     ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, week_number DESC, created_at DESC`
  );
  return withOptionalTestMeet(rows);
}

export async function listWeeklyHistoryForAdmin(): Promise<WeeklyHistoryAdminRow[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<{
    id: string; title: string; week_number: number; date_label: string; status: string;
    result_count: string; competitor_count: string;
  }>(
    `SELECT meet.id, meet.title, meet.week_number, meet.date_label, meet.status,
            count(result.id)::text AS result_count,
            count(DISTINCT result.player_id)::text AS competitor_count
       FROM weekly_meets meet
       LEFT JOIN weekly_results result ON result.meet_id = meet.id
      WHERE meet.data_version = 2
      GROUP BY meet.id, meet.title, meet.week_number, meet.date_label, meet.status, meet.starts_at
      ORDER BY meet.starts_at DESC NULLS LAST, meet.week_number DESC
      LIMIT 8`
  );
  return rows.map((row) => ({
    id: row.id, title: row.title, weekNumber: row.week_number, dateLabel: row.date_label,
    status: row.status, resultCount: Number(row.result_count), competitorCount: Number(row.competitor_count)
  }));
}

export async function isWeeklyMeetPubliclyVisible(meetIdOrSlug: string) {
  return Boolean((await getWeeklyMeetVisibility(meetIdOrSlug))?.isPublic);
}

export async function getWeeklyMeetVisibility(meetIdOrSlug: string) {
  const pool = getPostgresPool();
  const { rows } = await pool.query<{ is_public: boolean }>(
    `SELECT is_public
       FROM weekly_meets
      WHERE id = $1 OR slug = $1
      LIMIT 1`,
    [meetIdOrSlug],
  );
  if (!rows[0]) return null;
  return { isPublic: rows[0].is_public };
}

export async function listWeeklyMeetEventConfigs(meetId: string): Promise<WeeklyMeetEventConfig[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<{ event_id: string; format: string; enabled: boolean; seq: number }>(
    `SELECT event_code AS event_id, format, enabled, seq
     FROM weekly_events
     WHERE meet_id = $1 AND event_code IS NOT NULL AND event_code <> ''
     ORDER BY seq, event_code`,
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
  const pool = getPostgresPool();
  const { rows } = await pool.query<{ status: string; starts_at: string | null; ends_at: string | null; data_version: number }>(
    `SELECT status, starts_at, ends_at, data_version
     FROM weekly_meets
     WHERE id = $1 OR slug = $1
     LIMIT 1`,
    [meetIdOrSlug]
  );
  const meet = rows[0];
  if (!meet) return { canEnter: false, message: "周赛不存在" };
  if (meet.data_version !== 2) return { canEnter: false, message: "历史数据 / 只读" };
  if (meet.status !== "open") return { canEnter: false, message: "本周赛暂未开放成绩录入" };
  const now = Date.now();
  if (meet.starts_at && new Date(meet.starts_at).getTime() > now) return { canEnter: false, message: "周赛尚未开始" };
  if (meet.ends_at && new Date(meet.ends_at).getTime() < now) return { canEnter: false, message: "本周赛成绩录入已截止" };
  return { canEnter: true, message: "" };
}

export async function createWeeklyMeet(input: {
  startDate: string;
  endDate: string;
  templateMeetId?: string | null;
  title?: string;
  slug?: string;
  weekNumber?: number;
  status?: "draft" | "open" | "closed" | "archived";
}) {
  const startDate = parseWeeklyDate(input.startDate);
  const endDate = parseWeeklyDate(input.endDate);
  if (!startDate || !endDate) throw new Error("周赛日期格式不正确");
  if (endDate.getTime() < startDate.getTime()) throw new Error("结束日期不能早于开始日期");
  if (endDate.getTime() - startDate.getTime() > 14 * 86400000) throw new Error("周赛周期不能超过 15 天");

  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize allocation so two administrators cannot receive the same week number.
    await client.query("LOCK TABLE weekly_meets IN SHARE ROW EXCLUSIVE MODE");
    const sequence = await client.query<{ week_number: number }>("SELECT COALESCE(MAX(week_number), 0) + 1 AS week_number FROM weekly_meets");
    const weekNumber = input.weekNumber && input.weekNumber > 0 ? Math.floor(input.weekNumber) : Number(sequence.rows[0]?.week_number || 1);
    const startDateValue = formatWeeklyDate(startDate);
    const endDateValue = formatWeeklyDate(endDate);
    const baseId = `weekly-${startDateValue}`;
    const requestedSlug = input.slug?.trim() || baseId;
    const duplicate = await client.query<{ id: string }>("SELECT id FROM weekly_meets WHERE id = $1 OR slug = $2 LIMIT 1", [baseId, requestedSlug]);
    const id = duplicate.rows[0] ? `${baseId}-${Date.now()}` : baseId;
    const slug = requestedSlug === baseId && id !== baseId ? id : requestedSlug;
    const dateLabel = formatWeeklyDateRange(startDate, endDate);
    const title = input.title?.trim() || `辽宁魔方线上周赛 · ${dateLabel}`;
    const status = input.status || "draft";
    const templateConfigs = input.templateMeetId
      ? await client.query<{ event_id: string; format: string; enabled: boolean; seq: number }>(
          `SELECT event_code AS event_id, format, enabled, seq
           FROM weekly_events
           WHERE meet_id = $1 AND event_code IS NOT NULL AND event_code <> ''
           ORDER BY seq, event_code`,
          [input.templateMeetId]
        )
      : { rows: [] };
    const eventConfigs = templateConfigs.rows.length > 0
      ? templateConfigs.rows.map((row) => ({ eventId: row.event_id, format: getWeeklyResultFormat(row.format).id, enabled: row.enabled, seq: row.seq }))
      : defaultWeeklyMeetEventConfigs();

    await client.query(
      `INSERT INTO weekly_meets
        (id, slug, title, week_number, year, year_week, event, date_label, summary, pb_note, three_age_intro,
         status, starts_at, ends_at, is_public, data_version, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'三阶',$7,$8,$9,$10,$11,$12,$13,FALSE,2,now())`,
      [
        id,
        slug,
        title,
        weekNumber,
        startDate.getFullYear(),
        getIsoWeek(startDate),
        dateLabel,
        "本周周赛成绩与排名。",
        "下表中个人 PB 部分标红的为本周刷新的成绩。",
        "三阶为周赛主要项目，项目配置沿用模板周赛。",
        status,
        `${startDateValue}T00:00:00+08:00`,
        `${endDateValue}T23:59:59+08:00`
      ]
    );
    await saveWeeklyMeetEvents(client, id, eventConfigs);
    await client.query("COMMIT");
    return {
      id,
      slug,
      title,
      dateLabel,
      status,
      startsAt: `${startDateValue}T00:00:00+08:00`,
      endsAt: `${endDateValue}T23:59:59+08:00`,
      isPublic: false,
      dataVersion: 2
    } satisfies WeeklyMeetOption;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateWeeklyMeetConfig(input: {
  id: string;
  title: string;
  dateLabel: string;
  status: "draft" | "open" | "closed" | "archived";
  startsAt?: string | null;
  endsAt?: string | null;
  isPublic?: boolean;
  eventConfigs: WeeklyMeetEventConfig[];
}) {
  if (!input.title.trim() || !input.dateLabel.trim()) throw new Error("请填写周赛标题和周期");
  if (!input.eventConfigs.some((item) => item.enabled)) throw new Error("请至少开放一个项目");
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE weekly_meets
       SET title = $1, date_label = $2, status = $3, starts_at = $4, ends_at = $5,
           is_public = COALESCE($6, is_public),
           published_at = CASE WHEN COALESCE($6, is_public) AND NOT is_public THEN now()::text WHEN NOT COALESCE($6, is_public) THEN NULL ELSE published_at END,
           updated_at = now()
       WHERE id = $7 AND data_version = 2`,
      [input.title.trim(), input.dateLabel.trim(), input.status, input.startsAt || null, input.endsAt || null, input.isPublic ?? null, input.id]
    );
    if (updated.rowCount === 0) throw new Error("周赛不存在，或历史数据 / 只读");
    await saveWeeklyMeetEvents(client, input.id, input.eventConfigs);
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
  const name = input.name.trim();
  if (!name) throw new Error("请填写选手姓名");

  const pool = getPostgresPool();
  const wcaId = input.wcaId?.trim().toUpperCase() || "";
  if (wcaId) {
    const duplicate = await pool.query<{ id: string }>(
      `SELECT id FROM weekly_player_library WHERE upper(wca_id) = $1 AND ${weeklyV2PlayerSourceSql()} LIMIT 1`,
      [wcaId]
    );
    if (duplicate.rows[0]) throw new Error("该 WCA ID 已存在或历史数据中存在重复，不能重复绑定");
  }
  const id = createLibraryPlayerId();
  const { rows } = await pool.query<{
    id: string;
    name: string;
    wca_id: string;
    gender: string;
    province: string;
    city: string;
    birth_date: string;
  }>(
    `INSERT INTO weekly_player_library
       (id, name, wca_id, gender, province, city, birth_date, source, status, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'admin_manual','active',now())
     RETURNING id, name, wca_id, gender, province, city, birth_date`,
    [
      id,
      name,
      wcaId,
      input.gender === "女" ? "女" : input.gender === "男" ? "男" : "",
      input.province?.trim() || "",
      input.city?.trim() || "",
      input.birthDate?.trim() || ""
    ]
  );
  const player = rows[0];
  return {
    id: player.id,
    name: player.name,
    slug: "",
    wcaId: player.wca_id,
    gender: player.gender === "女" ? "女" : "男",
    province: player.province,
    city: player.city,
    birthDate: player.birth_date,
    ageGroup: getWeeklyAgeGroup(player.birth_date) || input.ageGroup || "",
    ageGroupIsFuzzy: !player.birth_date && Boolean(input.ageGroup)
  };
}

export async function listWeeklyResults(meetIdOrSlug: string, eventId: string, format: string = "avg5"): Promise<WeeklyEnteredResult[]> {
  if (!isWcaEventId(eventId)) throw new Error("项目不正确");
  const formatConfig = getWeeklyResultFormat(format);

  const eligiblePlayers = await listWeeklyEligiblePlayers();
  const pool = getPostgresPool();
  const meet = await resolveWeeklyMeet(meetIdOrSlug);
  if (!meet) throw new Error("周赛不存在");
  await assertWeeklyEventConfig(pool, meet.id, eventId, formatConfig.id);

  const eventKey = await resolveWeeklyEventKey(pool, meet.id, eventId, formatConfig.id);
  const { rows } = await pool.query<WeeklyResultRow>(
    `SELECT wr.*, COALESCE(NULLIF(wpm.wca_id, ''), NULLIF(wpl.wca_id, ''), CASE WHEN wr.player_id LIKE 'wca:%' THEN SUBSTRING(wr.player_id FROM 5) ELSE '' END) AS wca_id,
       COALESCE(wpl.birth_date, '') AS player_birth_date,
       COALESCE(wpl.age_group_override, '') AS player_age_group,
       COALESCE(wpl.province, '') AS player_province,
       COALESCE(wpl.city, '') AS player_city,
       COALESCE(wpl.wca_id_confirmed, FALSE) OR COALESCE(wpm.status = 'confirmed', FALSE) OR wr.player_id LIKE 'wca:%' AS wca_id_confirmed,
       wm.starts_at AS meet_starts_at
     FROM weekly_results wr
     LEFT JOIN weekly_player_library wpl ON wpl.id = wr.player_id
     LEFT JOIN weekly_player_wca_matches wpm ON wpm.weekly_player_id = wr.player_id AND wpm.status = 'confirmed'
     LEFT JOIN weekly_meets wm ON wm.id = wr.meet_id
       WHERE wr.meet_id = $1 AND wr.event_id = $2
     `,
    [meet.id, eventKey]
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
    const matchedPlayer = eligiblePlayers.find((player) => player.id === row.player_id);
    const wcaId = row.wca_id || matchedPlayer?.wcaId || "";
    const playerBirthDate = row.player_birth_date || matchedPlayer?.birthDate || "";
    const rankingAgeGroup = getWeeklyRankingAgeGroup(playerBirthDate, row.age_group || row.player_age_group || "", row.meet_starts_at ? new Date(row.meet_starts_at) : new Date());
    const rank = (rankByGroup.get(rankingAgeGroup) || 0) + 1;
    rankByGroup.set(rankingAgeGroup, rank);
    const attemptValues = (attemptsByResult.get(row.id) || []).map(attemptRowToResultValue);
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
        birthDate: playerBirthDate,
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
  const pool = getPostgresPool();
  const meet = await resolveWeeklyMeet(meetIdOrSlug);
  if (!meet) throw new Error("周赛不存在");
  const eventKey = await resolveWeeklyEventKey(pool, meet.id, eventId, formatConfig.id);
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
     WHERE meet_id = $1 AND event_id = $2
     ORDER BY created_at DESC
     LIMIT 100`,
    [meet.id, eventKey]
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
  const meet = input.meetId === testWeeklyMeet.id ? await ensureTestWeeklyMeet() : await resolveWeeklyMeet(input.meetId);
  if (!meet) throw new Error("周赛不存在");
  if (meet.dataVersion !== 2) throw new Error("历史数据 / 只读");

  const pool = getPostgresPool();
  const client = await pool.connect();
  const playerName = input.player.name.trim();
  const playerSlug = input.player.slug || (input.player.id.startsWith("code:") ? input.player.id.slice(5) : "");
  const pbEventId = getPersonalBestEventId(input.eventId);
  const playerAgeGroup = getWeeklyAgeGroup(input.player.birthDate, meet.startsAt ? new Date(meet.startsAt) : new Date()) || input.player.ageGroup || "";

  try {
    await client.query("BEGIN");
    await assertWeeklyEventConfig(client, meet.id, input.eventId, formatConfig.id);
    const eventKey = await resolveWeeklyEventKey(client, meet.id, input.eventId, formatConfig.id);
    const playerLibrary = await client.query<{ status: string; personal_bests: WeeklyPersonalBests | null; personal_bests_average: WeeklyPersonalBests | null }>(
      `SELECT status, personal_bests, personal_bests_average FROM weekly_player_library WHERE id = $1 AND ${weeklyV2ActivePlayerSql()} FOR UPDATE`,
      [input.player.id]
    );
    if (!playerLibrary.rows[0]) throw new Error("请选择选手档案库中的选手");
    if (playerLibrary.rows[0].status !== "active") throw new Error("该选手已停用，不能录入新成绩");
    const storedPersonalBests = playerLibrary.rows[0]?.personal_bests || {};
    const storedAveragePersonalBests = playerLibrary.rows[0]?.personal_bests_average || {};
    const previousPersonalBest = getStoredPersonalBest(storedPersonalBests, pbEventId);
    const previousAveragePersonalBest = getStoredPersonalBest(storedAveragePersonalBests, pbEventId);
    const currentBest = resultValueToSeconds(calculated.best);
    const currentAverage = resultValueToSeconds(calculated.average);
    const pbRefreshed = currentBest >= 0 && (previousPersonalBest === null || currentBest < previousPersonalBest);
    const pbAverageRefreshed = currentAverage >= 0 && (previousAveragePersonalBest === null || currentAverage < previousAveragePersonalBest);
    const existing = await client.query<{ id: number; average: string }>(
      `SELECT id FROM weekly_results
       WHERE meet_id = $1 AND event_id = $2
         AND player_id = $3
       LIMIT 1`,
      [meet.id, eventKey, input.player.id]
    );
    if (existing.rows[0]) throw new Error("该选手在本项目已有成绩，请使用成绩修订并填写原因");
    const inserted = await client.query<{ id: number }>(
        `INSERT INTO weekly_results
          (event_id, meet_id, rank, player_id, player_name, player_slug, gender, age_group, level, grade, average, personal_best, pb_refreshed, pb_average_refreshed, source, updated_at)
         VALUES ($1,$2,0,$3,$4,$5,$6,$7,'','',$8,$9,$10,$11,'manual_entry',now())
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
    const resultId = inserted.rows[0].id;

    await insertWeeklyAttempts(client, resultId, parsedAttempts);

    await client.query(
      `INSERT INTO weekly_result_revisions
        (result_id, action, reason, previous_attempts, next_attempts, previous_average, next_average, meet_id, event_id, player_id, player_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        resultId,
        "created",
        "成绩录入",
        JSON.stringify([]),
        JSON.stringify(parsedAttempts.map(formatResult)),
        null,
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
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: number; meet_id: string; event_id: string; player_id: string | null; player_name: string; average: string }>(
      "SELECT id, meet_id, event_id, player_id, player_name, average FROM weekly_results WHERE id = $1 FOR UPDATE",
      [input.resultId]
    );
    if (!result.rows[0]) throw new Error("成绩不存在或已被删除");
    await assertMeetV2(client, result.rows[0].meet_id);
    if (result.rows[0].player_id) await assertWeeklyV2ActivePlayer(client, result.rows[0].player_id);
    const storedFormat = await getStoredFormat(client, result.rows[0].meet_id, result.rows[0].event_id);
    if (storedFormat !== formatConfig.id) throw new Error("修改赛制与原成绩不一致");

    const previousAttempts = await readWeeklyAttempts(client, input.resultId);
    await client.query(
      `UPDATE weekly_results
       SET average = $1, personal_best = $2, pb_refreshed = FALSE, pb_average_refreshed = FALSE, source = 'admin_correction', updated_at = now()
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
      const eventId = await getEventIdFromStoredKey(client, result.rows[0].meet_id, result.rows[0].event_id);
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

  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: number; meet_id: string; event_id: string; player_id: string | null; player_name: string; average: string }>(
      "SELECT id, meet_id, event_id, player_id, player_name, average FROM weekly_results WHERE id = $1 FOR UPDATE",
      [input.resultId]
    );
    if (!result.rows[0]) throw new Error("成绩不存在或已被删除");
    await assertMeetV2(client, result.rows[0].meet_id);
    if (result.rows[0].player_id) await assertWeeklyV2ActivePlayer(client, result.rows[0].player_id);

    const previousAttempts = await readWeeklyAttempts(client, input.resultId);
    await client.query(
      `INSERT INTO weekly_result_revisions
        (result_id, action, reason, previous_attempts, previous_average, meet_id, event_id, player_id, player_name)
       VALUES ($1,'deleted',$2,$3,$4,$5,$6,$7,$8)`,
      [input.resultId, reason, JSON.stringify(previousAttempts.map(formatResult)), result.rows[0].average, result.rows[0].meet_id, result.rows[0].event_id, result.rows[0].player_id, result.rows[0].player_name]
    );
    await client.query("DELETE FROM weekly_results WHERE id = $1", [input.resultId]);
    if (result.rows[0].player_id) {
      const eventId = await getEventIdFromStoredKey(client, result.rows[0].meet_id, result.rows[0].event_id);
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
  const { rows } = await pool.query<{
    id: string;
    slug: string;
    yearWeek: number;
    startsAt: string | null;
    isPublic: boolean;
    dataVersion: number;
  }>(
    `SELECT id, slug, year_week AS "yearWeek", starts_at AS "startsAt",
            is_public AS "isPublic", data_version AS "dataVersion"
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
      (id, slug, title, week_number, year, year_week, status, published_at, event, date_label, summary, pb_note, three_age_intro,
       is_public, data_version, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,FALSE,2,now())
     ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title,
           date_label = EXCLUDED.date_label,
           status = EXCLUDED.status,
           summary = EXCLUDED.summary,
           is_public = FALSE,
           data_version = 2,
           updated_at = now()`,
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
  await saveWeeklyMeetEvents(pool, testWeeklyMeet.id, defaultWeeklyMeetEventConfigs());
  return resolveWeeklyMeet(testWeeklyMeet.id);
}

/**
 * Rebuild the meet-event ranks from the canonical derived result values.
 * Result imports call this same service after their attempts have been saved.
 */
export async function rerankWeeklyEvent(client: PoolClient, meetId: string, eventId: string) {
  const { rows } = await client.query<{ id: number; player_name: string; average: string; personal_best: string; age_group: string; birth_date: string; starts_at: string | null }>(
    `SELECT wr.id, wr.player_name, wr.average, wr.personal_best, wr.age_group, COALESCE(wpl.birth_date, '') AS birth_date, wm.starts_at
     FROM weekly_results wr
     LEFT JOIN weekly_player_library wpl ON wpl.id = wr.player_id
     LEFT JOIN weekly_meets wm ON wm.id = wr.meet_id
     WHERE wr.meet_id = $1 AND wr.event_id = $2`,
    [meetId, eventId]
  );

  const assignments = buildWeeklyRankAssignments(
    rows,
    (row) => getWeeklyRankingAgeGroup(row.birth_date || "", row.age_group || "", row.starts_at ? new Date(`${weeklyBusinessDate(row.starts_at)}T00:00:00`) : new Date()),
    getWeeklyRankingAgeGroupOrder
  );
  for (const assignment of assignments) {
    await client.query("UPDATE weekly_results SET rank = $1 WHERE id = $2", [assignment.rank, assignment.id]);
  }
}

function compareWeeklyResultRows(
  a: { player_name: string; average: string; personal_best: string; age_group: string | null; player_birth_date?: string | null; birth_date?: string | null; player_age_group?: string | null; meet_starts_at?: string | null },
  b: { player_name: string; average: string; personal_best: string; age_group: string | null; player_birth_date?: string | null; birth_date?: string | null; player_age_group?: string | null; meet_starts_at?: string | null }
) {
  const groupA = getWeeklyRankingAgeGroup(a.player_birth_date || a.birth_date || "", a.age_group || a.player_age_group || "", a.meet_starts_at ? new Date(a.meet_starts_at) : new Date());
  const groupB = getWeeklyRankingAgeGroup(b.player_birth_date || b.birth_date || "", b.age_group || b.player_age_group || "", b.meet_starts_at ? new Date(b.meet_starts_at) : new Date());
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
    "SELECT result_id, seq, value, value_centiseconds, status FROM weekly_attempts WHERE result_id = $1 ORDER BY seq",
    [resultId]
  );
  return rows.map(attemptRowToResultValue);
}

async function insertWeeklyAttempts(client: PoolClient, resultId: number, attempts: ResultValue[]) {
  for (const [index, attempt] of attempts.entries()) {
    const status = typeof attempt === "number" ? "ok" : attempt.toLowerCase();
    await client.query(
      `INSERT INTO weekly_attempts (result_id, seq, value, value_centiseconds, status)
       VALUES ($1,$2,$3,$4,$5)`,
      [
      resultId,
      index + 1,
      resultValueToSeconds(attempt),
      typeof attempt === "number" ? attempt : null,
      status
      ]
    );
  }
}

function attemptRowToResultValue(row: WeeklyAttemptRow): ResultValue {
  const centiseconds = row.value_centiseconds;
  if (row.status === "ok" && centiseconds !== null && Number.isInteger(centiseconds) && centiseconds >= 0) {
    return centiseconds;
  }
  if (row.status === "dns") return "DNS";
  if (row.status === "dnf") return "DNF";
  return secondsToResultValue(row.value);
}

function defaultWeeklyMeetEventConfigs(): WeeklyMeetEventConfig[] {
  return WEEKLY_DEFAULT_EVENT_IDS.map((eventId, index) => ({
    eventId,
    format: eventId === "individual" ? "best1" : "avg5",
    enabled: true,
    seq: index
  }));
}

async function saveWeeklyMeetEvents(client: Pick<PoolClient, "query">, meetId: string, configs: WeeklyMeetEventConfig[]) {
  await client.query(
    `UPDATE weekly_events
        SET enabled = FALSE, updated_at = now()
      WHERE meet_id = $1 AND event_code IS NOT NULL AND event_code <> ''`,
    [meetId]
  );
  for (const [index, config] of configs.entries()) {
    if (!isWcaEventId(config.eventId)) throw new Error("项目不正确");
    const format = getWeeklyResultFormat(config.format).id;
    if (config.eventId === "individual" && format !== "best1") throw new Error("个人全能只允许使用单次赛制");
    if (config.eventId !== "individual" && format === "best1") throw new Error("常规项目不能使用单次赛制");
    const eventName = getWcaEventName(config.eventId);
    await client.query(
      `INSERT INTO weekly_events
         (id, meet_id, kind, title, event_name, group_name, is_all_around,
          event_code, format, attempt_count, enabled, seq, updated_at)
       VALUES ($1,$2,'other',$3,$4,NULL,FALSE,$5,$6,$7,$8,$9,now())
       ON CONFLICT (meet_id, event_code)
         WHERE event_code IS NOT NULL AND event_code <> ''
       DO UPDATE SET title = EXCLUDED.title,
                     event_name = EXCLUDED.event_name,
                     format = EXCLUDED.format,
                     attempt_count = EXCLUDED.attempt_count,
                     enabled = EXCLUDED.enabled,
                     seq = EXCLUDED.seq,
                     updated_at = now()`,
      [
        getWeeklyEventKey(meetId, config.eventId, format),
        meetId,
        `${eventName} · ${getWeeklyResultFormat(format).name}`,
        eventName,
        config.eventId,
        format,
        getWeeklyResultFormat(format).attemptCount,
        config.enabled,
        config.seq ?? index
      ]
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

function parseWeeklyDate(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function formatWeeklyDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatWeeklyDateRange(startDate: Date, endDate: Date) {
  return `${formatWeeklyDate(startDate)} 至 ${formatWeeklyDate(endDate)}`;
}

function getWeeklyEventKey(meetId: string, eventId: string, format: string) {
  return `${meetId}-wca-${eventId}-${format}`;
}

async function assertWeeklyEventConfig(client: Pick<PoolClient, "query">, meetId: string, eventId: string, format: WeeklyResultFormat) {
  const configured = await client.query<{ event_code: string; format: string; enabled: boolean }>(
    `SELECT event_code, format, enabled
       FROM weekly_events
      WHERE meet_id = $1 AND event_code = $2
      LIMIT 1`,
    [meetId, eventId]
  );
  const config = configured.rows[0];
  if (!config || !config.enabled) throw new Error("本项目未在本场周赛开放");
  if (getWeeklyResultFormat(config.format).id !== format) throw new Error("本项目赛制与周赛配置不一致");
}

async function resolveWeeklyEventKey(client: Pick<PoolClient, "query">, meetId: string, eventId: string, _format: WeeklyResultFormat) {
  void _format;
  const configured = await client.query<{ id: string }>(
    `SELECT id
       FROM weekly_events
      WHERE meet_id = $1 AND event_code = $2 AND enabled = TRUE
      LIMIT 1`,
    [meetId, eventId]
  );
  if (!configured.rows[0]) throw new Error("本项目未在本场周赛开放，或赛制不一致");
  return configured.rows[0].id;
}

async function getEventIdFromStoredKey(client: Pick<PoolClient, "query">, meetId: string, eventKey: string) {
  const configured = await client.query<{ event_code: string | null }>(
    "SELECT event_code FROM weekly_events WHERE meet_id = $1 AND id = $2 LIMIT 1",
    [meetId, eventKey]
  );
  if (configured.rows[0]?.event_code && isWcaEventId(configured.rows[0].event_code)) {
    return configured.rows[0].event_code;
  }
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
    `SELECT personal_bests, personal_bests_average, personal_bests_base, personal_bests_average_base FROM weekly_player_library WHERE id = $1 AND ${weeklyV2ActivePlayerSql()} FOR UPDATE`,
    [playerId]
  );
  if (!library.rows[0]) throw new Error("选手不属于 weekly v2 active 范围，不能刷新 PB");

  const row = library.rows[0];
  // A base is historical state only. Never bootstrap it from a PB that was
  // computed by an import, otherwise rollback turns the imported PB into base.
  const baseBest = { ...(row.personal_bests_base || {}) };
  const baseAverage = { ...(row.personal_bests_average_base || {}) };
  const results = await client.query<{ personal_best: string; average: string }>(
    `SELECT wr.personal_best, wr.average
       FROM weekly_results wr
       JOIN weekly_events we ON we.id = wr.event_id AND we.meet_id = wr.meet_id
       JOIN weekly_meets wm ON wm.id = wr.meet_id
      WHERE wr.player_id = $1 AND we.event_code = $2 AND wm.data_version = 2`,
    [playerId, eventId]
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
         personal_bests_base = $4::jsonb,
         personal_bests_average_base = $5::jsonb,
         updated_at = now()
     WHERE id = $3`,
    [JSON.stringify(nextBest), JSON.stringify(nextAverage), playerId, JSON.stringify(baseBest), JSON.stringify(baseAverage)]
  );
}

/** Rebuild one player's single and average PB for a configured weekly event. */
export async function refreshWeeklyPlayerPersonalBestForEvent(
  client: Pick<PoolClient, "query">,
  playerId: string,
  eventId: string
) {
  await refreshWeeklyPlayerPersonalBest(client, playerId, eventId, getPersonalBestEventId(eventId));
}

async function getStoredFormat(client: Pick<PoolClient, "query">, meetId: string, eventKey: string): Promise<WeeklyResultFormat> {
  const { rows } = await client.query<{ format: string }>("SELECT format FROM weekly_events WHERE meet_id = $1 AND id = $2", [meetId, eventKey]);
  if (!rows[0]) throw new Error("成绩项目配置不存在");
  return getWeeklyResultFormat(rows[0].format).id;
}

async function assertMeetV2(client: Pick<PoolClient, "query">, meetId: string) {
  const { rows } = await client.query<{ data_version: number }>("SELECT data_version FROM weekly_meets WHERE id = $1 FOR SHARE", [meetId]);
  if (!rows[0]) throw new Error("周赛不存在");
  if (rows[0].data_version !== 2) throw new Error("历史数据 / 只读");
}

async function assertWeeklyV2ActivePlayer(client: Pick<PoolClient, "query">, playerId: string) {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM weekly_player_library WHERE id = $1 AND ${weeklyV2ActivePlayerSql()} FOR UPDATE`,
    [playerId]
  );
  if (!rows[0]) throw new Error("选手不属于 weekly v2 active 范围");
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
