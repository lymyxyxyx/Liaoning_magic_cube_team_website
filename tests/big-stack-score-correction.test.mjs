import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('an unchanged identity does not block a big-stack score correction', async () => {
  const statements = [];
  const row = {
    id: 'record-1', name: '全梓铭', event_code: '333', solve_count: 171,
    player_id: 'player-1', wca_id: '2026QUAN10', gender_override: '',
    achieved_at: null, meet_id: null, meet_title: null, source_label: '', note: '',
    updated_at: '2026-10-17', result_version: 'record-version'
  };
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes('FROM weekly_big_stack_records record') && sql.includes('FOR UPDATE')) return { rows: [row] };
      if (sql.includes('UPDATE weekly_big_stack_records')) return { rows: [{ ...row, solve_count: 175, result_version: 'new-version' }] };
      if (sql.includes('FROM weekly_player_library') || sql.includes('SELECT id FROM weekly_big_stack_records')) throw new Error('score correction unexpectedly checked identity or duplicates');
      return { rows: [] };
    },
    release() {}
  };
  const dependencies = {
    'node:crypto': await import('node:crypto'),
    '@/lib/postgres': { getPostgresPool: () => ({ connect: async () => client }) },
    '@/lib/weekly-result-version': { assertWeeklyResultVersion: (current, expected) => assert.equal(current, expected) },
    '@/lib/big-stack-xlsx': { normalizeBigStackSpreadsheetRow: input => input }
  };
  const exports = {};
  const source = readFileSync(new URL('../lib/big-stack.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', compiled)(name => dependencies[name], exports);
  const corrected = await exports.updateBigStackRecord('record-1', {
    expectedVersion: 'record-version', name: '全梓铭', eventId: '333', solveCount: 175,
    playerId: 'player-1', wcaId: '2026QUAN10'
  });
  assert.equal(corrected.solveCount, 175);
  assert(statements.includes('COMMIT'));
});
