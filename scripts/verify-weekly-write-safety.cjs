#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS loader runs transpiled TypeScript services in an isolated database fixture. */
// Optional PostgreSQL integration checks. All fixtures live in a disposable
// schema with a schema-only search_path; no production tables are read/written.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {Pool} = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const schema = `weekly_verify_${Date.now()}_${process.pid}`;
  const admin = new Pool({connectionString:process.env.DATABASE_URL});
  const pool = new Pool({connectionString:process.env.DATABASE_URL, options:`-c search_path=${schema}`, max:4});
  const cache = new Map();
  const actual = new Set(['weekly-result-version','weekly-pb-history','weekly-result-utils','wca-events','weekly-age-groups','weekly-ranking','weekly-results-import-dates','weekly-player-scope','shenyang-association-grades']);
  function load(name) {
    if (cache.has(name)) return cache.get(name);
    const exports = {};
    cache.set(name,exports);
    const source = fs.readFileSync(path.join(__dirname,'..','lib',`${name}.ts`),'utf8');
    const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','exports',compiled)((dependency)=>{
      if (dependency === '@/lib/postgres') return {getPostgresPool:()=>pool};
      if (dependency.startsWith('@/lib/')) return actual.has(dependency.slice(6)) ? load(dependency.slice(6)) : {};
      return require(dependency);
    },exports);
    return exports;
  }
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`
      CREATE TABLE weekly_login_rate_limits(key_hash text PRIMARY KEY, failures int NOT NULL, window_started_at timestamptz NOT NULL, blocked_until timestamptz NOT NULL DEFAULT 'epoch');
      CREATE TABLE weekly_meets(id text PRIMARY KEY, data_version int, starts_at timestamptz);
      CREATE TABLE weekly_events(id text PRIMARY KEY, meet_id text, event_code text, format text, enabled bool);
      CREATE TABLE weekly_player_library(id text PRIMARY KEY, status text, source text, birth_date text, personal_bests jsonb, personal_bests_average jsonb, personal_bests_base jsonb, personal_bests_average_base jsonb, updated_at timestamptz);
      CREATE TABLE weekly_results(id serial PRIMARY KEY, meet_id text,event_id text,player_id text,player_name text,age_group text,average numeric,personal_best numeric,rank int,grade text,level text,source text,pb_refreshed bool,pb_average_refreshed bool,updated_at timestamptz DEFAULT clock_timestamp());
      CREATE TABLE weekly_attempts(result_id int,seq int,value numeric,value_centiseconds int,status text);
      CREATE TABLE weekly_result_revisions(id serial PRIMARY KEY,result_id int,action text,reason text,previous_attempts jsonb,next_attempts jsonb,previous_average numeric,next_average numeric,meet_id text,event_id text,player_id text,player_name text);
      INSERT INTO weekly_meets VALUES ('week1',2,'2026-09-14T00:00:00+08:00'),('week2',2,'2026-09-21T00:00:00+08:00');
      INSERT INTO weekly_events VALUES ('event1','week1','333','avg5',true),('event2','week2','333','avg5',true);
      INSERT INTO weekly_player_library VALUES ('test-player','active','admin_manual','2018-01-01','{"333":8}','{"333":10}','{"333":10}','{"333":15}',now());
      INSERT INTO weekly_results(meet_id,event_id,player_id,player_name,age_group,average,personal_best,rank,pb_refreshed,pb_average_refreshed)
      VALUES ('week1','event1','test-player','测试选手','U10',10,8,1,true,true),('week2','event2','test-player','测试选手','U10',11,9,1,false,false);
      INSERT INTO weekly_attempts SELECT 1,seq,10,1000,'ok' FROM generate_series(1,5) AS seq;
    `);
    const limiter=load('weekly-login-rate-limit');
    const request={headers:new Headers()};
    const {key}=await limiter.getWeeklyLoginRateLimit(request);
    for(let i=0;i<4;i++) assert.equal(await limiter.recordWeeklyLoginFailure(key),0);
    assert.equal(await limiter.recordWeeklyLoginFailure(key),60);
    cache.delete('weekly-login-rate-limit');
    const reloaded=load('weekly-login-rate-limit');
    assert.equal((await reloaded.getWeeklyLoginRateLimit(request)).allowed,false);
    await pool.query("UPDATE weekly_login_rate_limits SET blocked_until=now()-interval '1 second' WHERE key_hash=$1",[key]);
    assert.equal(await reloaded.recordWeeklyLoginFailure(key),0);
    assert.equal((await pool.query('SELECT failures FROM weekly_login_rate_limits WHERE key_hash=$1',[key])).rows[0].failures,1);
    await reloaded.clearWeeklyLoginFailures(key);
    await Promise.all(Array.from({length:12},()=>reloaded.recordWeeklyLoginFailure(key)));
    assert.equal((await reloaded.getWeeklyLoginRateLimit(request)).allowed,false);
    assert.equal((await pool.query('SELECT failures FROM weekly_login_rate_limits WHERE key_hash=$1',[key])).rows[0].failures,5);
    console.log('PASS PostgreSQL login persistence, expired lock reset and concurrent failure counting');

    const store=load('weekly-entry-store');
    const version=(await pool.query('SELECT updated_at::text AS version FROM weekly_results WHERE id=1')).rows[0].version;
    const laterVersion=(await pool.query('SELECT updated_at::text AS version FROM weekly_results WHERE id=2')).rows[0].version;
    const writes=await Promise.allSettled([12,13].map(score=>store.correctWeeklyResult({resultId:1,expectedVersion:version,format:'avg5',attempts:Array(5).fill(String(score)),reason:'隔离测试'})));
    assert.equal(writes.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(writes.find(r=>r.status==='rejected').reason.name,'WeeklyResultConflictError');
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM weekly_result_revisions')).rows[0].count,1);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM weekly_attempts WHERE result_id=1')).rows[0].count,5);
    await assert.rejects(store.deleteWeeklyResult({resultId:1,expectedVersion:version,reason:'过期删除'}),e=>e.name==='WeeklyResultConflictError');
    const later=(await pool.query('SELECT *,updated_at::text AS version FROM weekly_results WHERE id=2')).rows[0];
    assert.equal(later.pb_refreshed,true);
    assert.equal(later.pb_average_refreshed,true);
    assert.equal(later.version,laterVersion);
    const fresh=(await pool.query('SELECT updated_at::text AS version FROM weekly_results WHERE id=1')).rows[0].version;
    await store.deleteWeeklyResult({resultId:1,expectedVersion:fresh,reason:'隔离测试清理'});
    const library=(await pool.query('SELECT personal_bests,personal_bests_average FROM weekly_player_library')).rows[0];
    assert.equal(library.personal_bests['333'],9);
    assert.equal(library.personal_bests_average['333'],11);
    console.log('PASS two concurrent corrections, stale delete prevention, later PB badge rebuild and rollback-safe versions');
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1});
