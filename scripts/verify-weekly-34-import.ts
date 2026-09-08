#!/usr/bin/env node
/** One-off P0-3D database acceptance fixture. Never use against production. */
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import {
  commitWeeklyResultsImportBatch,
  createWeeklyResultsImportPreview,
  resolveWeeklyResultsImportPlayers,
  rollbackWeeklyResultsImportBatch
} from "@/lib/weekly-results-import-store";
import { getWeeklyRankingAgeGroup } from "@/lib/weekly-age-groups";

type SourceAverage = { eventCode: string; playerName: string; attempts: string[]; excelAverage: string; calculatedAverage: string; matches: boolean };
type SourceReport = { totals: { uniquePlayers: number; events: number; results: number; attempts: number }; averageChecks: SourceAverage[] };
type PlayerFixture = { id: string; name: string; gender: "男" | "女"; birthDate: string };

const eventConfigs = [
  ["333", "三阶"],
  ["222", "二阶"],
  ["pyram", "金字塔"],
  ["maple", "枫叶"],
  ["mirror", "镜面"]
] as const;

const sourceGenders: Record<string, "男" | "女"> = {
  "丁宥安": "男", "万如初": "女", "佟林骋": "男", "吴晓可": "女", "张千慧": "女", "张晋铭": "男",
  "李恒恺": "男", "李梓源": "男", "李沐远": "男", "李禹诺": "男", "李轩伊": "女", "牟婉宁": "女",
  "王子睿": "男", "王晗谕": "女", "钟欣妍": "女", "韩沐廷": "男", "马启航": "男", "黄梓墨": "男"
};

// These are explicit fixture-admin decisions, used only to reconcile the
// source-row evidence with the selected canonical player snapshot. They are
// deliberately outside the converter and the shared importer.
const selectedPlayerNameToSourceName: Record<string, string> = { "陈祉圻": "陈祉行" };

async function main() {
  const [xlsxPath, reportPath] = process.argv.slice(2);
  if (!xlsxPath || !reportPath) throw new Error("Usage: DATABASE_URL=... node verify-weekly-34-import.js <standard.xlsx> <standard.xlsx.report.json>");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const report = JSON.parse(await readFile(reportPath, "utf8")) as SourceReport;
  assert(JSON.stringify(report.totals) === JSON.stringify({ uniquePlayers: 20, events: 5, results: 40, attempts: 200 }), "unexpected converter report totals");
  assert(report.averageChecks.length === 40 && report.averageChecks.every((item) => item.matches), "converter average evidence is incomplete");

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const database = await pool.query<{ database: string; user: string }>("SELECT current_database() AS database, current_user AS user");
  assert(database.rows[0]?.database === "lncubing_weekly_test", `refusing non-test database: ${database.rows[0]?.database || "unknown"}`);

  const token = randomUUID().slice(0, 8);
  const meetId = `p0-3d-week34-${token}`;
  const sentinelMeetId = `p0-3d-sentinel-${token}`;
  const playerPrefix = `p0-3d-${token}`;
  const actor = "p0-3d-test-admin";
  const playerIds = new Map<string, string>();
  const batches: string[] = [];
  let activeBatchId = "";
  const allFixturePlayerIds: string[] = [];
  const cleanupPlayerIds: string[] = [];
  try {
    await createMeetAndEvents(pool, meetId, "test-2026-week-34", "P0-3D 测试：2026年第34周（非生产日期）", false);
    const sentinelPlayerId = `${playerPrefix}-sentinel`;
    cleanupPlayerIds.push(sentinelPlayerId);
    await createSentinel(pool, sentinelMeetId, sentinelPlayerId);
    const sourceNames = [...new Set(report.averageChecks.map((item) => item.playerName))].sort();
    for (const name of sourceNames.filter((item) => item !== "杨雯博" && item !== "陈祉行")) {
      const id = `${playerPrefix}-${playerIds.size + 1}`;
      playerIds.set(name, id);
      allFixturePlayerIds.push(id);
      cleanupPlayerIds.push(id);
      await insertPlayer(pool, { id, name, gender: sourceGenders[name] || "男", birthDate: birthDateFor(name) });
    }
    const chenCandidateId = `${playerPrefix}-chen-candidate`;
    playerIds.set("陈祉行", chenCandidateId);
    allFixturePlayerIds.push(chenCandidateId);
    cleanupPlayerIds.push(chenCandidateId);
    await insertPlayer(pool, { id: chenCandidateId, name: "陈祉圻", gender: "男", birthDate: "" });

    const standard = await readFile(xlsxPath);
    const initial = await createWeeklyResultsImportPreview({ meetId, filename: "2026-week-34-standard.xlsx", buffer: standard, actor });
    batches.push(initial.id);
    assert(initial.preview.rawRowCount === 40 && initial.preview.validRowCount === 0, "initial preview did not require identity review");
    assert(new Set(initial.preview.rows.filter((row) => row.matchStatus === "exact_name").map((row) => row.playerName)).size === 18, "initial preview must expose exactly 18 unique exact-name candidates");
    const yang = initial.preview.rows.find((row) => row.playerName === "杨雯博");
    const chen = initial.preview.rows.find((row) => row.playerName === "陈祉行");
    assert(yang?.matchStatus === "unmatched" && !yang.matchedPlayerId, "杨雯博 must remain unmatched before an administrator decision");
    assert(chen?.matchStatus === "similar_name" && !chen.matchedPlayerId && chen.candidates.some((candidate) => candidate.name === "陈祉圻"), "陈祉行 must remain a non-automatic similar-name candidate");

    const yangId = `${playerPrefix}-yang-manual`;
    playerIds.set("杨雯博", yangId);
    allFixturePlayerIds.push(yangId);
    cleanupPlayerIds.push(yangId);
    await insertPlayer(pool, { id: yangId, name: "杨雯博", gender: "男", birthDate: "" });
    const decisions = initial.preview.rows.map((row) => ({ sourceRow: row.sourceRow, playerId: playerIds.get(row.playerName) || "" }));
    assert(decisions.every((item) => item.playerId), "every source row must have an explicit fixture decision");
    const resolved = await resolveWeeklyResultsImportPlayers({ batchId: initial.id, meetId, resolutions: decisions, actor });
    assert(resolved.status === "ready" && resolved.preview.validRowCount === 40 && resolved.preview.errorCount === 0, "resolved preview is not ready");
    activeBatchId = resolved.id;

    const committed = await commitWeeklyResultsImportBatch({ id: resolved.id, meetId, actor });
    assert(committed?.status === "committed" && committed.commitManifest.resultIds?.length === 40, "first batch did not commit 40 manifest results");
    await verifyCommittedImport(pool, meetId, resolved.id, report);
    await assertDuplicateCommitBlocked(meetId, standard, decisions, actor, batches);

    const rolledBack = await rollbackWeeklyResultsImportBatch({ id: resolved.id, meetId, actor });
    activeBatchId = "";
    assert(rolledBack?.status === "rolled_back", "first batch did not roll back");
    await verifyRollback(pool, meetId, sentinelMeetId, allFixturePlayerIds);

    // A rolled-back file may be submitted again. This proves the conversion can
    // re-enter the same formal preview -> commit -> rollback route.
    const repeat = await createWeeklyResultsImportPreview({ meetId, filename: "2026-week-34-standard-repeat.xlsx", buffer: standard, actor });
    batches.push(repeat.id);
    const repeatReady = await resolveWeeklyResultsImportPlayers({ batchId: repeat.id, meetId, resolutions: decisions, actor });
    assert(repeatReady.status === "ready", "repeat preview was not ready after rollback");
    activeBatchId = repeatReady.id;
    const repeatCommitted = await commitWeeklyResultsImportBatch({ id: repeatReady.id, meetId, actor });
    assert(repeatCommitted?.status === "committed", "repeat commit after rollback failed");
    const repeatRolledBack = await rollbackWeeklyResultsImportBatch({ id: repeatReady.id, meetId, actor });
    activeBatchId = "";
    assert(repeatRolledBack?.status === "rolled_back", "repeat rollback failed");
    await verifyRollback(pool, meetId, sentinelMeetId, allFixturePlayerIds);

    console.log(JSON.stringify({
      ok: true,
      database: database.rows[0],
      fixture: { meetId, events: 5, players: 20, results: 40, attempts: 200 },
      administratorDecisions: {
        杨雯博: "在初始 preview 中保持 unmatched；管理员新建正式测试 player 后，显式选择该 player。",
        陈祉行: "初始 preview 仅显示 陈祉圻 为 similar_name；管理员显式选择 陈祉圻，未发生自动合并。"
      },
      ageValidation: "李轩伊源快照为 U10，fixture 出生日期在测试 meet 日期下计算为 U12，作为 warning 记录且未覆盖 birth_date；张晋铭、王晗谕生日为空，result age_group 保持 null。",
      batches: { first: resolved.id, duplicateCommitBlocked: true, repeat: repeatReady.id },
      cleanup: "completed"
    }, null, 2));
  } finally {
    if (activeBatchId) {
      try { await rollbackWeeklyResultsImportBatch({ id: activeBatchId, meetId, actor }); } catch { /* direct fixture cleanup below remains safe */ }
    }
    await cleanup(pool, meetId, sentinelMeetId, cleanupPlayerIds, batches);
    await pool.end();
  }
}

async function createMeetAndEvents(pool: pg.Pool, meetId: string, slug: string, title: string, sentinel: boolean) {
  await pool.query(
    `INSERT INTO weekly_meets (id, slug, title, week_number, year, year_week, event, date_label, summary, pb_note, three_age_intro, status, starts_at, ends_at, is_public, data_version)
     VALUES ($1,$2,$3,34,2026,34,'三阶','测试配置：2026-08-17 至 2026-08-23','P0-3D database fixture','','','closed','2026-08-17T00:00:00+08:00','2026-08-23T23:59:59+08:00',FALSE,2)`,
    [meetId, slug, title]
  );
  const configs = sentinel ? [["333", "三阶"]] as const : eventConfigs;
  for (const [index, [eventCode, eventName]] of configs.entries()) {
    await pool.query(
      `INSERT INTO weekly_events (id, meet_id, kind, title, event_name, event_code, format, attempt_count, enabled, seq)
       VALUES ($1,$2,'other',$3,$4,$5,'avg5',5,TRUE,$6)`,
      [`${meetId}-wca-${eventCode}-avg5`, meetId, `${eventName} · 五次取平均`, eventName, eventCode, index]
    );
  }
}

async function insertPlayer(pool: pg.Pool, player: PlayerFixture) {
  await pool.query(
    `INSERT INTO weekly_player_library
       (id, name, gender, birth_date, province, city, source, notes, status,
        personal_bests, personal_bests_average, personal_bests_base, personal_bests_average_base)
     VALUES ($1,$2,$3,$4,'辽宁','沈阳','p0-3d fixture','P0-3D temporary fixture','active',
             '{"333":999}'::jsonb, '{"333":999}'::jsonb, '{"333":999}'::jsonb, '{"333":999}'::jsonb)`,
    [player.id, player.name, player.gender, player.birthDate]
  );
}

async function createSentinel(pool: pg.Pool, meetId: string, playerId: string) {
  await createMeetAndEvents(pool, meetId, `p0-3d-sentinel-${meetId.slice(-8)}`, "P0-3D sentinel (temporary)", true);
  await insertPlayer(pool, { id: playerId, name: "P0-3D 非本批哨兵", gender: "男", birthDate: "" });
  const result = await pool.query<{ id: number }>(
    `INSERT INTO weekly_results (event_id, meet_id, rank, player_id, player_name, gender, average, personal_best, source)
     VALUES ($1,$2,1,$3,'P0-3D 非本批哨兵','男',10,9,'fixture_sentinel') RETURNING id`,
    [`${meetId}-wca-333-avg5`, meetId, playerId]
  );
  await pool.query("INSERT INTO weekly_attempts (result_id, seq, value, value_centiseconds, status) VALUES ($1,1,9,900,'ok')", [result.rows[0].id]);
}

async function verifyCommittedImport(pool: pg.Pool, meetId: string, batchId: string, report: SourceReport) {
  const counts = await pool.query<{ results: number; attempts: number }>(
    `SELECT COUNT(DISTINCT wr.id)::int AS results, COUNT(wa.*)::int AS attempts
       FROM weekly_results wr LEFT JOIN weekly_attempts wa ON wa.result_id = wr.id
      WHERE wr.meet_id = $1 AND wr.import_batch_id = $2`, [meetId, batchId]
  );
  assert(counts.rows[0]?.results === 40 && counts.rows[0]?.attempts === 200, "canonical result/attempt count mismatch after commit");
  const perEvent = await pool.query<{ event_code: string; count: number }>(
    `SELECT we.event_code, COUNT(*)::int AS count FROM weekly_results wr JOIN weekly_events we ON we.id = wr.event_id AND we.meet_id = wr.meet_id
      WHERE wr.meet_id = $1 GROUP BY we.event_code ORDER BY we.event_code`, [meetId]
  );
  assert(JSON.stringify(perEvent.rows) === JSON.stringify([
    { event_code: "222", count: 6 }, { event_code: "333", count: 19 }, { event_code: "maple", count: 6 }, { event_code: "mirror", count: 2 }, { event_code: "pyram", count: 7 }
  ]), "per-event result counts mismatch");
  const rows = await pool.query<{ event_code: string; player_name: string; average: string; personal_best: string; pb_refreshed: boolean; pb_average_refreshed: boolean; age_group: string | null; birth_date: string }>(
    `SELECT we.event_code, wr.player_name, wr.average::text, wr.personal_best::text, wr.pb_refreshed, wr.pb_average_refreshed, wr.age_group, p.birth_date
       FROM weekly_results wr JOIN weekly_events we ON we.id = wr.event_id AND we.meet_id = wr.meet_id
       JOIN weekly_player_library p ON p.id = wr.player_id WHERE wr.meet_id = $1`, [meetId]
  );
  assert(rows.rows.length === 40, "average verification rows missing");
  const expected = new Map(report.averageChecks.map((item) => [`${item.eventCode}:${item.playerName}`, toCentiseconds(item.excelAverage)]));
  for (const row of rows.rows) {
    const sourceName = selectedPlayerNameToSourceName[row.player_name] || row.player_name;
    assert(toCentiseconds(row.average) === expected.get(`${row.event_code}:${sourceName}`), `average mismatch: ${row.player_name}/${row.event_code}`);
    assert(row.pb_refreshed && row.pb_average_refreshed, `PB flags missing: ${row.player_name}/${row.event_code}`);
  }
  const attempts = await pool.query<{ status: string; value_centiseconds: number | null }>(
    "SELECT wa.status, wa.value_centiseconds FROM weekly_attempts wa JOIN weekly_results wr ON wr.id = wa.result_id WHERE wr.meet_id = $1", [meetId]
  );
  assert(attempts.rows.length === 200 && attempts.rows.every((row) => row.status === "ok" && Number.isInteger(row.value_centiseconds)), "canonical attempt status/value validation failed");
  await verifyRanks(pool, meetId);
  await verifyPlayerPbs(pool, meetId);
  const li = rows.rows.find((row) => row.player_name === "李轩伊" && row.event_code === "333");
  assert(li?.age_group === "U12", "李轩伊 must derive U12 from fixture birth date rather than retain Excel U10");
  for (const name of ["张晋铭", "王晗谕"]) assert(rows.rows.filter((row) => row.player_name === name).every((row) => row.birth_date === "" && row.age_group === null), `${name} must not be inferred as adult`);
}

async function verifyRanks(pool: pg.Pool, meetId: string) {
  const rows = await pool.query<{ event_code: string; rank: number; average: string; personal_best: string; player_name: string; birth_date: string; age_group: string | null }>(
    `SELECT we.event_code, wr.rank, wr.average::text, wr.personal_best::text, wr.player_name, p.birth_date, wr.age_group
       FROM weekly_results wr JOIN weekly_events we ON we.id = wr.event_id AND we.meet_id = wr.meet_id
       JOIN weekly_player_library p ON p.id = wr.player_id WHERE wr.meet_id = $1`, [meetId]
  );
  assert(rows.rows.every((row) => Number(row.average) >= 0 && Number(row.personal_best) >= 0), "DNF/DNS was generated unexpectedly");
  const grouped = new Map<string, number[]>();
  for (const row of rows.rows) {
    const group = `${row.event_code}:${getWeeklyRankingAgeGroup(row.birth_date || "", row.age_group || "", new Date("2026-08-17T00:00:00+08:00"))}`;
    grouped.set(group, [...(grouped.get(group) || []), row.rank]);
  }
  for (const [group, ranks] of grouped) assert(JSON.stringify([...ranks].sort((a, b) => a - b)) === JSON.stringify(Array.from({ length: ranks.length }, (_, index) => index + 1)), `non-continuous rank sequence in ${group}`);
}

async function verifyPlayerPbs(pool: pg.Pool, meetId: string) {
  const rows = await pool.query<{ player_id: string; event_code: string; best: string; average: string; personal_bests: Record<string, number>; personal_bests_average: Record<string, number> }>(
    `SELECT wr.player_id, we.event_code, MIN(wr.personal_best)::text AS best, MIN(wr.average)::text AS average,
            p.personal_bests, p.personal_bests_average
       FROM weekly_results wr JOIN weekly_events we ON we.id = wr.event_id AND we.meet_id = wr.meet_id
       JOIN weekly_player_library p ON p.id = wr.player_id
      WHERE wr.meet_id = $1 GROUP BY wr.player_id, we.event_code, p.personal_bests, p.personal_bests_average`, [meetId]
  );
  for (const row of rows.rows) {
    assert(Number(row.personal_bests[row.event_code]) === Number(row.best), `single PB must be keyed by player_id + ${row.event_code}`);
    assert(Number(row.personal_bests_average[row.event_code]) === Number(row.average), `average PB must be keyed by player_id + ${row.event_code}`);
  }
}

async function assertDuplicateCommitBlocked(meetId: string, standard: Buffer, decisions: Array<{ sourceRow: number; playerId: string }>, actor: string, batches: string[]) {
  const duplicate = await createWeeklyResultsImportPreview({ meetId, filename: "2026-week-34-standard-copy.xlsx", buffer: standard, actor });
  batches.push(duplicate.id);
  const blockedPreview = await resolveWeeklyResultsImportPlayers({ batchId: duplicate.id, meetId, resolutions: decisions, actor });
  assert(blockedPreview.status === "needs_review" && blockedPreview.preview.rows.every((row) => row.errors.some((message) => message.startsWith("已有成绩"))), "same-file duplicate was not blocked by existing canonical results");
  let blocked = false;
  try { await commitWeeklyResultsImportBatch({ id: blockedPreview.id, meetId, actor }); } catch (error) { blocked = error instanceof Error && error.message.includes("只有 ready 状态"); }
  assert(blocked, "blocked duplicate preview unexpectedly reached a commit");
}

async function verifyRollback(pool: pg.Pool, meetId: string, sentinelMeetId: string, playerIds: string[]) {
  const removed = await pool.query<{ results: number; attempts: number }>(
    `SELECT COUNT(DISTINCT wr.id)::int AS results, COUNT(wa.*)::int AS attempts
       FROM weekly_results wr LEFT JOIN weekly_attempts wa ON wa.result_id = wr.id WHERE wr.meet_id = $1`, [meetId]
  );
  assert(removed.rows[0]?.results === 0 && removed.rows[0]?.attempts === 0, "rolled-back results or attempts remain");
  const retained = await pool.query<{ events: number; players: number; sentinel_results: number; sentinel_attempts: number }>(
    `SELECT (SELECT COUNT(*)::int FROM weekly_events WHERE meet_id = $1) AS events,
            (SELECT COUNT(*)::int FROM weekly_player_library WHERE id = ANY($2::text[])) AS players,
            (SELECT COUNT(*)::int FROM weekly_results WHERE meet_id = $3) AS sentinel_results,
            (SELECT COUNT(*)::int FROM weekly_attempts wa JOIN weekly_results wr ON wr.id = wa.result_id WHERE wr.meet_id = $3) AS sentinel_attempts`,
    [meetId, playerIds, sentinelMeetId]
  );
  assert(JSON.stringify(retained.rows[0]) === JSON.stringify({ events: 5, players: 20, sentinel_results: 1, sentinel_attempts: 1 }), "rollback changed retained fixture or non-batch sentinel data");
  const pbs = await pool.query<{ personal_bests: Record<string, unknown>; personal_bests_average: Record<string, unknown> }>(
    "SELECT personal_bests, personal_bests_average FROM weekly_player_library WHERE id = ANY($1::text[])", [playerIds]
  );
  assert(pbs.rows.every((row) => Number(row.personal_bests?.["333"]) === 999 && Number(row.personal_bests_average?.["333"]) === 999 && Object.keys(row.personal_bests || {}).length === 1 && Object.keys(row.personal_bests_average || {}).length === 1), "PB state was not restored to the fixture baseline after rollback");
}

async function cleanup(pool: pg.Pool, meetId: string, sentinelMeetId: string, playerIds: string[], batches: string[]) {
  await pool.query("DELETE FROM weekly_attempts WHERE result_id IN (SELECT id FROM weekly_results WHERE meet_id = ANY($1::text[]))", [[meetId, sentinelMeetId]]);
  await pool.query("DELETE FROM weekly_results WHERE meet_id = ANY($1::text[])", [[meetId, sentinelMeetId]]);
  await pool.query("DELETE FROM weekly_events WHERE meet_id = ANY($1::text[])", [[meetId, sentinelMeetId]]);
  await pool.query("DELETE FROM weekly_meets WHERE id = ANY($1::text[])", [[meetId, sentinelMeetId]]);
  await pool.query("DELETE FROM weekly_import_batches WHERE id = ANY($1::text[])", [batches]);
  await pool.query("DELETE FROM weekly_player_library WHERE id = ANY($1::text[])", [playerIds]);
}

function birthDateFor(name: string) {
  if (name === "李轩伊") return "2015-07-01"; // yields U12 at the explicitly configured test meet date
  if (name === "张晋铭" || name === "王晗谕") return "";
  return "2017-01-01";
}

function toCentiseconds(value: string) {
  const parts = value.split(":");
  const seconds = parts.length === 2 ? Number(parts[0]) * 60 + Number(parts[1]) : Number(parts[0]);
  return Math.round(seconds * 100);
}

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.stack || error.message : error); process.exit(1); });
