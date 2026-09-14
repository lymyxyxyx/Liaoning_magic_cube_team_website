import assert from "node:assert/strict";
import test from "node:test";
import { createWeeklyResultsExport } from "../lib/weekly-results-xlsx.ts";

test("weekly result export creates a readable Excel workbook with the exported score table", () => {
  const workbook = createWeeklyResultsExport(
    { slug: "2026-week-36", weekNumber: 350, title: "第350周周赛", startDate: "2026-09-07", endDate: "2026-09-13" },
    [{ eventCode: "333", format: "avg5", rank: 1, playerId: "player-1", wcaId: "", playerName: "陈小明", gender: "男", ageGroup: "U10", level: "中级", grade: "★★", average: "12.34", best: "11.20", personalBest: "11.20", pbRefreshed: true, attempts: ["12.34", "12.50", "12.18", "12.60", "12.41"] }]
  );

  assert.equal(workbook.subarray(0, 4).toString("hex"), "504b0304");
  assert.match(workbook.toString("utf8"), /成绩导出/);
  assert.match(workbook.toString("utf8"), /陈小明/);
});
