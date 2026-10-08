import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyPbHistory } from "../lib/weekly-pb-history.ts";
const row = (id, best, average) => ({ id, best, average });

test("PB badges follow competition order, strict improvements, and independent average records", () => {
  const result = buildWeeklyPbHistory([row(1, 11, 14), row(2, 9, 13), row(3, 9, 12), row(4, -1, -2)], 10, 15);
  assert.deepEqual(result, {best:9, average:12, flags:[
    {id:1,pbRefreshed:false,pbAverageRefreshed:true}, {id:2,pbRefreshed:true,pbAverageRefreshed:true},
    {id:3,pbRefreshed:false,pbAverageRefreshed:true}, {id:4,pbRefreshed:false,pbAverageRefreshed:false}
  ]});
});

test("correcting an earlier record slower restores a later week's PB badge", () => {
  const initial = [row(1, 8, 10), row(2, 9, 11)];
  assert.equal(buildWeeklyPbHistory(initial, 12, 15).flags[1].pbRefreshed, false);
  const corrected = [row(1, 10, 13), row(2, 9, 11)];
  assert.equal(buildWeeklyPbHistory(corrected, 12, 15).flags[1].pbRefreshed, true);
  assert.equal(buildWeeklyPbHistory(corrected, 12, 15).flags[1].pbAverageRefreshed, true);
});

test("deleting or rolling back an earlier result recomputes later badges and restores baseline if empty", () => {
  assert.deepEqual(buildWeeklyPbHistory([row(2, 9, 11)], 12, 15).flags, [{id:2,pbRefreshed:true,pbAverageRefreshed:true}]);
  assert.deepEqual(buildWeeklyPbHistory([], 12, 15), {best:12,average:15,flags:[]});
});

test("big-stack PBs improve upward, accept zero, and ignore invalid results", () => {
  const result = buildWeeklyPbHistory([row(1,0,0),row(2,100,100),row(3,100,100),row(4,-1,NaN)], null, null, true);
  assert.equal(result.best,100);
  assert.deepEqual(result.flags.map(r=>r.pbRefreshed), [true,true,false,false]);
});
