import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function load(name, pool) {
  const exports = {};
  const compiled = ts.transpileModule(fs.readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "exports", compiled)((dependency) => dependency === "@/lib/postgres" ? { getPostgresPool: () => pool } : dependency.startsWith("@/lib/") ? load(dependency.slice(6), pool) : require(dependency), exports);
  return exports;
}
function fixture(identities = [], records = []) {
  const pool = { query: async (sql) => ({ rows: sql.includes("FROM weekly_player_library") ? identities : records }) };
  return load("big-stack", pool);
}
const identities = [{ id: "A", name: "同名选手", wca_id: "2018AAAA01" }, { id: "B", name: "同名选手", wca_id: "2019BBBB01" }];
const existing = { id: "record-A", name: "同名选手", event_code: "333", solve_count: 100, player_id: "A", wca_id: "2018AAAA01", result_version: "v1" };
const input = { eventId: "333", mode: "merge", rows: [{ rowNumber: 2, name: "同名选手", count: 120, playerId: "B", wcaId: "2019BBBB01" }] };

test("different bound identities cannot fall back to the same name", async () => {
  const preview = await fixture(identities, [existing]).previewBigStackImport(input);
  assert.equal(preview.rows[0].action, "ambiguous");
  assert.ok(preview.errors.length);
  assert.equal(preview.rows[0].existingRecordId, undefined);
});
test("conflicting or nonexistent explicit identifiers block import", async () => {
  for (const row of [{ ...input.rows[0], playerId: "A" }, { ...input.rows[0], playerId: "missing" }]) {
    assert.ok((await fixture(identities).previewBigStackImport({ ...input, rows: [row] })).errors.length);
  }
});
test("an explicit ID or WCA ID cannot be assigned to a different name", async () => {
  const store = fixture(identities);
  for (const row of [
    { rowNumber: 2, name: "另一位选手", count: 120, playerId: "A" },
    { rowNumber: 2, name: "另一位选手", count: 120, wcaId: "2018AAAA01" }
  ]) {
    const preview = await store.previewBigStackImport({ ...input, rows: [row] });
    assert.ok(preview.errors.length);
  }
});
test("a confirmed identity can merge into an unbound unique record", async () => {
  const preview = await fixture(identities, [{ ...existing, player_id: null, wca_id: "" }]).previewBigStackImport(input);
  assert.deepEqual(preview.errors, []);
  assert.equal(preview.rows[0].existingRecordId, existing.id);
  assert.equal(preview.rows[0].action, "improved");
});
test("lower PBs are ignored, and two import rows cannot target one existing record", async () => {
  const store = fixture(identities, [existing]);
  const row = { rowNumber: 2, name: "同名选手", count: 80, playerId: "A" };
  assert.equal((await store.previewBigStackImport({ ...input, rows: [row] })).rows[0].action, "lower");
  const duplicate = await store.previewBigStackImport({ ...input, rows: [row, { ...row, rowNumber: 3 }] });
  assert.ok(duplicate.errors.length);
});
test("preview token changes for the file, project, mode or current record version", async () => {
  const store = fixture(identities, [existing]);
  const token = (await store.previewBigStackImport(input)).token;
  for (const change of [{ eventId: "222" }, { mode: "baseline" }, { rows: [{ ...input.rows[0], count: 121 }] }]) {
    assert.notEqual((await store.previewBigStackImport({ ...input, ...change })).token, token);
  }
  assert.notEqual((await fixture(identities, [{ ...existing, result_version: "v2" }]).previewBigStackImport(input)).token, token);
});
test("baseline validates names, count range, dates and empty input before writes", async () => {
  const store = fixture();
  for (const rows of [[], [{ rowNumber: 2, name: "测试", count: 10001 }], [{ rowNumber: 2, name: "测试", count: 1, achievedAt: "2026-02-30" }]]) {
    assert.ok((await store.previewBigStackImport({ ...input, mode: "baseline", rows })).errors.length);
  }
});
test("public DTO excludes notes, binding IDs and editing versions", () => {
  const publicRecord = fixture().publicBigStackRecord({ ...existing, name: "测试", eventId: "333", solveCount: 100, note: "内部备注", playerId: "A", matchedPlayerId: "A", playerVersion: "secret-version", genderOverride: "男", weeklyNumber: 53, matchedWcaId: "2018AAAA01", gender: "男", updatedAt: "today", version: "v1", meetId: "private" });
  for (const key of ["note", "playerId", "matchedPlayerId", "playerVersion", "genderOverride", "updatedAt", "version", "meetId", "achievedAt", "meetTitle", "sourceLabel", "weeklyNumber"]) assert.equal(key in publicRecord, false);
  assert.equal(publicRecord.solveCount, 100);
  assert.equal(publicRecord.gender, "男");
  assert.equal(publicRecord.wcaId, "2018AAAA01");
});
test("Excel rejects blank scores and impossible dates while keeping explicit zero", async () => {
  const parser = load("big-stack-xlsx");
  const result = await parser.parseBigStackWorkbook(fs.readFileSync(new URL("fixtures/big-stack-validation.xlsx", import.meta.url)));
  assert.equal(result.errors.length, 3);
  assert.deepEqual(result.rows.map(({ name, count }) => ({ name, count })), [{ name: "明确零分", count: 0 }]);
});
test("small compressed files with oversized worksheet content are rejected", async () => {
  const buffer = fs.readFileSync(new URL("fixtures/big-stack-oversize.xlsx", import.meta.url));
  assert.ok(buffer.length < 30000);
  await assert.rejects(load("big-stack-xlsx").parseBigStackWorkbook(buffer), /解压内容过大/);
});
test("an ID without a WCA ID cannot claim another player's known WCA identity", async () => {
  const players = [{ ...identities[0], wca_id: "" }, identities[1]];
  const preview = await fixture(players).previewBigStackImport({ ...input, rows: [{ ...input.rows[0], playerId: "A" }] });
  assert.ok(preview.errors.length);
});
