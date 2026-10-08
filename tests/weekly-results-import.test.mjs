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
