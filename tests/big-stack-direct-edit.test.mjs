import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function makeEditor({ linkedPlayerId = 'player-1', playerVersion = 'new-player-version', playerWcaId = '2026QUAN10' } = {}) {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql.includes('FROM weekly_big_stack_records WHERE id=$1 FOR UPDATE')) return { rows: [{ version: 'record-version', player_id: linkedPlayerId }] };
      if (sql.includes('FROM weekly_player_library WHERE weekly_number=$1')) return { rows: [{ id: 'player-1', version: playerVersion, wca_id: playerWcaId }] };
      if (sql.includes('SELECT updated_at::text AS version FROM weekly_big_stack_records')) return { rows: [{ version: 'record-version' }] };
      return { rows: [] };
    },
    release() {}
  };
  let saved;
  const dependencies = {
    '@/lib/postgres': { getPostgresPool: () => ({ connect: async () => client }) },
    '@/lib/big-stack': { updateBigStackRecord: async (_id, input) => { saved = input; return input; } },
    '@/lib/weekly-result-version': { assertWeeklyResultVersion: (current, expected) => {
      if (current !== expected) throw new Error('version conflict');
    } },
    '@/lib/weekly-player-identity': { updateWeeklyPlayerIdentity: async () => { throw new Error('unexpected identity change'); } }
  };
  const exports = {};
  const source = readFileSync(new URL('../lib/big-stack-direct-edit.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', compiled)(name => dependencies[name], exports);
  return { edit: exports.editBigStackRecordDirectly, calls, getSaved: () => saved };
}

test('score-only edits accept a stale player version while retaining the record version check', async () => {
  const editor = makeEditor();
  await editor.edit('record-1', { expectedVersion: 'record-version', weeklyNumber: 175, playerVersion: 'old-player-version', playerId: 'player-1', wcaId: '2026QUAN10', name: '全梓铭', eventId: '333', solveCount: 175 });
  assert.equal(editor.getSaved().solveCount, 175);
  assert.equal(editor.getSaved().playerId, 'player-1');
  assert(editor.calls.includes('COMMIT'));
  await assert.rejects(editor.edit('record-1', { expectedVersion: 'old-record-version', weeklyNumber: 175, playerVersion: 'old-player-version', playerId: 'player-1', wcaId: '2026QUAN10', name: '全梓铭', eventId: '333', solveCount: 175 }), /version conflict/);
});

test('identity changes still require the current player version', async () => {
  const editor = makeEditor({ linkedPlayerId: null });
  await assert.rejects(editor.edit('record-1', { expectedVersion: 'record-version', weeklyNumber: 175, playerVersion: 'old-player-version', playerId: 'player-1', wcaId: '2026QUAN10', name: '全梓铭', eventId: '333', solveCount: 175 }), /version conflict/);
  assert(editor.calls.includes('ROLLBACK'));
});

test('a record with no displayed number retains its stored player link', async () => {
  const editor = makeEditor();
  await editor.edit('record-1', { expectedVersion: 'record-version', weeklyNumber: null, playerId: 'player-1', wcaId: '2026QUAN10', name: '全梓铭', eventId: '333', solveCount: 175 });
  assert.equal(editor.getSaved().playerId, 'player-1');
});
