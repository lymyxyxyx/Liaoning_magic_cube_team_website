import assert from "node:assert/strict";
import test from "node:test";
import { formatWeeklyEntryPeriod } from "../lib/weekly-entry-period.ts";

test("entry period always shows Beijing time in server and browser timezones", () => {
  const original = process.env.TZ;
  try {
    for (const timezone of ["UTC", "Asia/Shanghai", "America/Los_Angeles"]) {
      process.env.TZ = timezone;
      assert.equal(formatWeeklyEntryPeriod({ startsAt: "2026-09-13T16:00:00Z", endsAt: "2026-09-20T15:59:59Z" }), "北京时间 2026年9月14日 00:00 开放 · 2026年9月20日 24:00 截止");
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("missing or invalid entry windows use a stable label instead of the current date", () => {
  assert.equal(formatWeeklyEntryPeriod({dateLabel:"历史周赛"}), "历史周赛");
  assert.equal(formatWeeklyEntryPeriod({startsAt:"invalid", endsAt:"invalid"}), "日期待定");
  assert.equal(formatWeeklyEntryPeriod({startsAt:"2026-09-14T00:00:00+08:00", endsAt:"2026-09-14T18:30:00+08:00"}), "北京时间 2026年9月14日 00:00 开放 · 2026年9月14日 18:30 截止");
});
