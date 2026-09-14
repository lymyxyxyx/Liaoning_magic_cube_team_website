import assert from "node:assert/strict";
import test from "node:test";
import { parseResultInput } from "../lib/weekly-result-utils.ts";

test("result parsing accepts familiar Chinese competition terms", () => {
  assert.equal(parseResultInput("1分02秒34"), 6234);
  assert.equal(parseResultInput("12.34秒"), 1234);
  assert.equal(parseResultInput("弃权"), "DNF");
  assert.equal(parseResultInput("未参赛"), "DNS");
});
