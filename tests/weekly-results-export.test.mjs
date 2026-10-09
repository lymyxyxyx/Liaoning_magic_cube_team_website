import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as resultUtils from "../lib/weekly-result-utils.ts";
import * as wcaEvents from "../lib/wca-events.ts";
import * as importDates from "../lib/weekly-results-import-dates.ts";

test("export keeps the current-round best separate from the player's lifetime PB", async () => {
  const rows = [];
  const pool = { query: async (query) => ({ rows: query.includes("FROM weekly_meets")
    ? [{ id: "week", slug: "week", data_version: 2 }]
    : query.includes("FROM weekly_events")
      ? [{ event_code: "333", format: "avg5", attempt_count: 5, enabled: true }]
      : [] }) };
  const dependencies = {
    "@/lib/postgres": { getPostgresPool: () => pool },
    "@/lib/wca-events": wcaEvents,
    "@/lib/weekly-result-utils": resultUtils,
    "@/lib/weekly-results-import-dates": importDates,
    "@/lib/weekly-player-scope": { weeklyV2ActivePlayerSql: () => "TRUE" },
    "@/lib/weekly-entry-store": { listWeeklyResults: async () => [{ player: {}, attempts: [1000], best: 1000, personalBest: 800, sourcePersonalBest: 900 }] },
    "@/lib/weekly-results-xlsx": { createWeeklyResultsExport: (_, results) => { rows.push(...results); return Buffer.alloc(0); } }
  };
  const source = readFileSync(new URL("../lib/weekly-results-import-store.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)((name) => name === "node:crypto" ? {} : dependencies[name] || {}, exports);
  await exports.getWeeklyResultsExport("week");
  assert.equal(rows[0].best, "10.00");
  assert.equal(rows[0].personalBest, "8.00");
});
