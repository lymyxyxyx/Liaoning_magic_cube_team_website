import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBigStackEditPayload } from '../lib/big-stack-edit-payload.ts';

const record = {
  name: '测试选手', eventId: '333', solveCount: 175, version: 'score-v1',
  playerId: undefined, wcaId: undefined, weeklyNumber: 509,
  matchedWcaId: '2026TEST01', matchedPlayerId: 'player-1', playerVersion: 'player-v2',
  meetId: null, sourceLabel: '', note: ''
};

test('score edits never submit automatically matched identities', () => {
  const payload = buildBigStackEditPayload(record, '509', false, '');
  assert.equal(payload.solveCount, 175);
  assert.equal(payload.expectedVersion, 'score-v1');
  assert.equal(payload.playerId, undefined);
  assert.equal(payload.wcaId, undefined);
  for (const field of ['weeklyNumber', 'playerVersion', 'matchedWcaId', 'matchedPlayerId']) {
    assert.equal(Object.hasOwn(payload, field), false);
  }
});

test('explicit identity edits submit the chosen binding and its own version', () => {
  const payload = buildBigStackEditPayload({ ...record, playerId: 'player-1', wcaId: '2026TEST01' }, '509', true, '核对绑定');
  assert.equal(payload.weeklyNumber, 509);
  assert.equal(payload.wcaId, '2026TEST01');
  assert.equal(payload.playerVersion, 'player-v2');
  assert.equal(buildBigStackEditPayload(record, '', true, '').weeklyNumber, null);
});
