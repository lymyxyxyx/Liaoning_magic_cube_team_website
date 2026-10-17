#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- Isolated PostgreSQL service check. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {Pool} = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const schema = `weekly_library_verify_${Date.now()}_${process.pid}`;
  const admin = new Pool({connectionString:process.env.DATABASE_URL});
  const pool = new Pool({connectionString:process.env.DATABASE_URL, options:`-c search_path=${schema}`, max:4});
  const cache = new Map();
  const actual = new Set(['weekly-player-library','weekly-entry-store','weekly-player-scope','weekly-pb-history','weekly-result-version','weekly-result-utils','wca-events','weekly-age-groups','weekly-ranking','weekly-results-import-dates','shenyang-association-grades','weekly-meet-status']);
  function load(name) {
    if (!actual.has(name)) return {};
    if (cache.has(name)) return cache.get(name);
    const exports = {};
    cache.set(name, exports);
    const source = fs.readFileSync(path.join(__dirname,'..','lib',`${name}.ts`),'utf8');
    const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','exports',compiled)((dependency)=>{
      if (dependency === '@/lib/postgres') return {getPostgresPool:()=>pool};
      if (dependency.startsWith('@/lib/')) return load(dependency.slice(6));
      return require(dependency);
    },exports);
    return exports;
  }
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`
      CREATE TABLE weekly_player_library (
        id text PRIMARY KEY, name text NOT NULL, weekly_number int, wca_id text NOT NULL DEFAULT '', wca_id_confirmed bool NOT NULL DEFAULT false,
        gender text NOT NULL DEFAULT '', birth_date text NOT NULL DEFAULT '', age_group_override text NOT NULL DEFAULT '', age_group_is_fuzzy bool NOT NULL DEFAULT false,
        province text NOT NULL DEFAULT '', city text NOT NULL DEFAULT '', source text NOT NULL DEFAULT 'admin_manual', notes text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'active', deactivated_at timestamptz, deactivation_reason text NOT NULL DEFAULT '',
        personal_bests jsonb NOT NULL DEFAULT '{}', personal_bests_average jsonb NOT NULL DEFAULT '{}',
        personal_bests_base jsonb NOT NULL DEFAULT '{}', personal_bests_average_base jsonb NOT NULL DEFAULT '{}',
        updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
      );
      CREATE TABLE weekly_meets(id text PRIMARY KEY, data_version int, starts_at timestamptz);
      CREATE TABLE weekly_events(id text PRIMARY KEY, meet_id text, event_code text);
      CREATE TABLE weekly_results(id serial PRIMARY KEY, meet_id text, event_id text, player_id text, personal_best numeric, average numeric, pb_refreshed bool, pb_average_refreshed bool);
      INSERT INTO weekly_player_library(id,name,notes) VALUES ('A','甲','原备注'),('B','乙','原备注');
      INSERT INTO weekly_meets(id,data_version,starts_at) VALUES ('week',2,now());
      INSERT INTO weekly_events(id,meet_id,event_code) VALUES ('event','week','333');
    `);
    const library = load('weekly-player-library');
    const entry = load('weekly-entry-store');
    const original = await library.listWeeklyPlayerLibrary();
    const a = original.find(player=>player.id==='A');
    const b = original.find(player=>player.id==='B');
    const editedB = await library.updateWeeklyPlayerLibraryEntry({id:'B',expectedVersion:b.identityVersion,patch:{notes:'较新备注'}});
    await library.updateWeeklyPlayerLibraryEntry({id:'A',expectedVersion:a.identityVersion,patch:{city:'沈阳'}});
    assert.equal((await library.findWeeklyPlayerLibraryEntry({id:'B'})).notes,'较新备注');
    await assert.rejects(library.updateWeeklyPlayerLibraryEntry({id:'B',expectedVersion:b.identityVersion,patch:{notes:'旧页面'}}),error=>error.name==='WeeklyPlayerLibraryConflictError');
    await library.saveWeeklyPlayerLibrary([{...a,notes:'旧列表'},{...b,notes:'旧列表'}]);
    assert.equal((await library.findWeeklyPlayerLibraryEntry({id:'B'})).notes,'较新备注');
    console.log('PASS single-player updates preserve other rows and stale versions cannot overwrite them');

    const latestA = await library.findWeeklyPlayerLibraryEntry({id:'A'});
    const manual = await library.updateWeeklyPlayerLibraryEntry({id:'A',expectedVersion:latestA.identityVersion,patch:{personalBests:{'333':10},personalBestAverages:{'333':12}}});
    assert.equal(manual.personalBests['333'],10);
    assert.equal(manual.personalBestAverages['333'],12);
    const bases = (await pool.query("SELECT personal_bests_base,personal_bests_average_base FROM weekly_player_library WHERE id='A'")).rows[0];
    assert.equal(bases.personal_bests_base['333'],10);
    assert.equal(bases.personal_bests_average_base['333'],12);
    await pool.query("INSERT INTO weekly_results(meet_id,event_id,player_id,personal_best,average) VALUES ('week','event','A',9,11)");
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await entry.lockWeeklyResultWrites(client);
      await entry.refreshWeeklyPlayerPersonalBestForEvent(client,'A','333');
      await client.query('COMMIT');
    } finally { client.release(); }
    const derived = await library.findWeeklyPlayerLibraryEntry({id:'A'});
    assert.equal(derived.personalBests['333'],9);
    assert.equal(derived.personalBestAverages['333'],11);
    const improved = await library.updateWeeklyPlayerLibraryEntry({id:'A',expectedVersion:derived.identityVersion,patch:{personalBests:{'333':8},personalBestAverages:{'333':10}}});
    assert.equal(improved.personalBests['333'],8);
    assert.equal(improved.personalBestAverages['333'],10);
    assert.equal((await pool.query("SELECT personal_bests_base->>'333' AS best FROM weekly_player_library WHERE id='A'")).rows[0].best,'8');
    console.log('PASS manual single and average PB survive recomputation; history can still improve PB');

    const inactive = await library.updateWeeklyPlayerLibraryEntry({id:'B',expectedVersion:editedB.identityVersion,patch:{status:'inactive',deactivationReason:'重复档案'}});
    assert.equal(inactive.status,'inactive');
    assert.equal(inactive.deactivationReason,'重复档案');
    assert.equal((await library.listWeeklyEligiblePlayers()).some(player=>player.id==='B'),false);
    const restored = await library.updateWeeklyPlayerLibraryEntry({id:'B',expectedVersion:inactive.identityVersion,patch:{status:'active'}});
    assert.equal(restored.status,'active');
    assert.equal((await library.listWeeklyEligiblePlayers()).some(player=>player.id==='B'),true);
    console.log('PASS deactivation persists with reason, removes eligibility, and can be reversed');
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
