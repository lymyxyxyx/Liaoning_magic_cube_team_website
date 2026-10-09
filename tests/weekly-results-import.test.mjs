import assert from "node:assert/strict";
import test from "node:test";
import { parseResultInput } from "../lib/weekly-result-utils.ts";
import * as resultUtils from "../lib/weekly-result-utils.ts";
import * as wcaEvents from "../lib/wca-events.ts";
import { readFileSync } from "node:fs";
import ts from "typescript";

test("result parsing accepts familiar Chinese competition terms", () => {
  assert.equal(parseResultInput("1分02秒34"), 6234);
  assert.equal(parseResultInput("12.34秒"), 1234);
  assert.equal(parseResultInput("弃权"), "DNF");
  assert.equal(parseResultInput("未参赛"), "DNS");
});

test("big-stack import accepts a final count and previews it as a number", () => {
  const source = readFileSync(new URL("../lib/weekly-results-import.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const dependencies = { "@/lib/wca-events": wcaEvents, "@/lib/weekly-result-utils": resultUtils };
  new Function("require", "exports", compiled)((name) => {
    assert.ok(dependencies[name], `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports);
  const [row] = exports.normalizePastedWeeklyResults("王小明\t120", { eventCode: "bigstack333", format: "best1" });
  assert.deepEqual(row.errors, []);
  assert.deepEqual(row.attempts, [12000]);
  assert.equal(exports.previewResultSummary([row]).display[0].averageText, "120");
  const [invalid] = exports.normalizePastedWeeklyResults("王小明\t1:20", { eventCode: "bigstackmirror", format: "best1" });
  assert.ok(invalid.errors.length > 0);
});

function loadParser() {
  const source = readFileSync(new URL("../lib/weekly-results-import.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const dependencies = { "@/lib/wca-events": wcaEvents, "@/lib/weekly-result-utils": resultUtils };
  new Function("require", "exports", compiled)((name) => dependencies[name], exports);
  return exports.normalizePastedWeeklyResults;
}

test("tab imports preserve blank identities and reject blank attempt cells", () => {
  const parse = loadParser();
  const [valid] = parse("\t\t王小明\t10\t11\t12\t13\t14", { eventCode: "333", format: "avg5" });
  assert.equal(valid.playerName, "王小明");
  assert.equal(valid.playerId, "");
  assert.equal(valid.wcaId, "");
  assert.deepEqual(valid.errors, []);
  const [missing] = parse("王小明\t10\t11\t\t13\t14", { eventCode: "333", format: "avg5" });
  assert.ok(missing.errors.length > 0);
  const [trailing] = parse("王小明\t10\t11\t12\t13\t", { eventCode: "333", format: "avg5" });
  assert.ok(trailing.errors.length > 0);
});

test("identity and rank columns respect one- and three-attempt formats", () => {
  const parse = loadParser();
  const [count] = parse("123\t\t王小明\t120", { eventCode: "bigstack333", format: "best1" });
  assert.equal(count.playerId, "123");
  assert.equal(count.playerName, "王小明");
  assert.deepEqual(count.attempts, [12000]);
  const [ranked] = parse("1\t123\t\t王小明\t10\t11\t12", { eventCode: "333", format: "best3" });
  assert.equal(ranked.playerId, "123");
  assert.equal(ranked.playerName, "王小明");
  assert.deepEqual(ranked.attempts, [1000, 1100, 1200]);
  assert.deepEqual(ranked.errors, []);
});

test("time parsing rejects alternate number syntax, malformed minutes and integer overflow", () => {
  for (const invalid of ["1e2", "0x10", "1.5:20", ":20", "1:", "1:60", "21474836.48", "99999999999999999999"]) {
    assert.throws(() => parseResultInput(invalid), invalid);
  }
  assert.equal(parseResultInput(".12"), 12);
  assert.equal(parseResultInput("1:02.34"), 6234);
});
