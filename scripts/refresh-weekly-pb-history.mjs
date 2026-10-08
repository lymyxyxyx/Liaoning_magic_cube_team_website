#!/usr/bin/env node
// Recompute v2 PBs/badges using the same service as edits/imports.
// Default is dry run (transactions rolled back). Pass --apply after backup.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import pg from 'pg';
const require = createRequire(import.meta.url);
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pool = new pg.Pool({connectionString:process.env.DATABASE_URL});
const actual = new Set(['weekly-result-version','weekly-pb-history','weekly-result-utils','wca-events','weekly-age-groups','weekly-ranking','weekly-results-import-dates','weekly-player-scope','shenyang-association-grades']);
const cache = new Map();
function load(name) {
  if(cache.has(name)) return cache.get(name);
  const exports = {}; cache.set(name,exports);
  const compiled = ts.transpileModule(readFileSync(path.join(project,'lib',`${name}.ts`),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports',compiled)((dependency)=>{
    if(dependency==='@/lib/postgres') return {getPostgresPool:()=>pool};
    if(dependency.startsWith('@/lib/')) return actual.has(dependency.slice(6)) ? load(dependency.slice(6)) : {};
    return require(dependency);
  },exports);
  return exports;
}
async function main() {
  assert(process.env.DATABASE_URL,'DATABASE_URL is required');
  const apply = process.argv.includes('--apply');
  const {refreshWeeklyPlayerPersonalBestForEvent} = load('weekly-entry-store');
  const pairs=await pool.query(`SELECT DISTINCT wr.player_id, we.event_code FROM weekly_results wr
    JOIN weekly_events we ON we.id=wr.event_id AND we.meet_id=wr.meet_id
    JOIN weekly_meets wm ON wm.id=wr.meet_id
    JOIN weekly_player_library pl ON pl.id=wr.player_id
    WHERE wm.data_version=2 AND wm.id<>'weekly-test-entry' AND pl.status='active'
      AND pl.source IN ('players_excel_import','admin_manual')
    ORDER BY wr.player_id,we.event_code`);
  let changedBadges=0;
  for(const pair of pairs.rows){
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM weekly_player_library WHERE id=$1 FOR UPDATE',[pair.player_id]);
      const before=await client.query(`SELECT wr.id,wr.pb_refreshed,wr.pb_average_refreshed,wr.updated_at::text AS version FROM weekly_results wr JOIN weekly_events we ON we.id=wr.event_id WHERE wr.player_id=$1 AND we.event_code=$2`,[pair.player_id,pair.event_code]);
      await refreshWeeklyPlayerPersonalBestForEvent(client,pair.player_id,pair.event_code);
      const after=await client.query(`SELECT wr.id,wr.pb_refreshed,wr.pb_average_refreshed,wr.updated_at::text AS version FROM weekly_results wr JOIN weekly_events we ON we.id=wr.event_id WHERE wr.player_id=$1 AND we.event_code=$2`,[pair.player_id,pair.event_code]);
      const old=new Map(before.rows.map(row=>[row.id,row]));
      for(const row of after.rows){
        assert.equal(row.version,old.get(row.id).version,'PB refresh must preserve edit/rollback versions');
        if(row.pb_refreshed!==old.get(row.id).pb_refreshed || row.pb_average_refreshed!==old.get(row.id).pb_average_refreshed)changedBadges++;
      }
      await client.query(apply?'COMMIT':'ROLLBACK');
    } catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  console.log(JSON.stringify({mode:apply?'applied':'dry-run',playerEvents:pairs.rowCount,changedBadges}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1}).finally(()=>pool.end());
