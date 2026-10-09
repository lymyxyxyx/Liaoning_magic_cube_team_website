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
  let commitDuringPreview = null;
  const servicePool = {connect:()=>pool.connect(), query:async (...args)=>{
    const result=await pool.query(...args);
    if (commitDuringPreview && String(args[0]).includes("SELECT we.event_code, wr.player_id")) {
      await pool.query("UPDATE weekly_import_batches SET status='committed' WHERE id=$1",[commitDuringPreview]);
      commitDuringPreview=null;
    }
    return result;
  }};
  const actual = new Set(['weekly-result-version','weekly-pb-history','weekly-result-utils','wca-events','weekly-age-groups','weekly-ranking','weekly-results-import-dates','weekly-player-scope','shenyang-association-grades','weekly-meet-status','weekly-entry-store']);
  function load(name) {
    if (cache.has(name)) return cache.get(name);
    const exports = {};
    cache.set(name,exports);
    const source = fs.readFileSync(path.join(__dirname,'..','lib',`${name}.ts`),'utf8');
    const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','exports',compiled)((dependency)=>{
      if (dependency === '@/lib/postgres') return {getPostgresPool:()=>servicePool};
      if (dependency.startsWith('@/lib/')) return actual.has(dependency.slice(6)) ? load(dependency.slice(6)) : {};
      return require(dependency);
    },exports);
    return exports;
  }
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`
      CREATE TABLE weekly_login_rate_limits(key_hash text PRIMARY KEY, failures int NOT NULL, window_started_at timestamptz NOT NULL, blocked_until timestamptz NOT NULL DEFAULT 'epoch');
      CREATE TABLE weekly_meets(id text PRIMARY KEY, data_version int, starts_at timestamptz, title text, date_label text, status text, ends_at timestamptz, is_public bool, published_at text, updated_at timestamptz, slug text, week_number int);
      CREATE TABLE weekly_events(id text PRIMARY KEY, meet_id text, event_code text, format text, enabled bool, kind text, title text, event_name text, group_name text, is_all_around bool, attempt_count int, seq int, updated_at timestamptz);
      CREATE UNIQUE INDEX weekly_verify_event_code ON weekly_events(meet_id,event_code) WHERE event_code IS NOT NULL AND event_code <> '';
      CREATE TABLE weekly_player_library(id text PRIMARY KEY, status text, source text, birth_date text, personal_bests jsonb, personal_bests_average jsonb, personal_bests_base jsonb, personal_bests_average_base jsonb, updated_at timestamptz, name text, wca_id text, gender text, province text, city text);
      CREATE TABLE weekly_import_batches(id text PRIMARY KEY,kind text,filename text,file_sha256 text,status text,raw_row_count int,valid_row_count int,warning_count int,error_count int,preview_jsonb jsonb,commit_manifest_jsonb jsonb,admin_actor text,created_at timestamptz,committed_at timestamptz,rolled_back_at timestamptz);
      CREATE TABLE weekly_results(id serial PRIMARY KEY, meet_id text,event_id text,player_id text,player_name text,age_group text,average numeric,personal_best numeric,rank int,grade text,level text,source text,pb_refreshed bool,pb_average_refreshed bool,updated_at timestamptz DEFAULT clock_timestamp());
      CREATE TABLE weekly_attempts(result_id int,seq int,value numeric,value_centiseconds int,status text);
      CREATE TABLE weekly_result_revisions(id serial PRIMARY KEY,result_id int,action text,reason text,previous_attempts jsonb,next_attempts jsonb,previous_average numeric,next_average numeric,meet_id text,event_id text,player_id text,player_name text);
      INSERT INTO weekly_meets(id,data_version,starts_at) VALUES ('week1',2,'2026-09-14T00:00:00+08:00'),('week2',2,'2026-09-21T00:00:00+08:00');
      INSERT INTO weekly_events(id,meet_id,event_code,format,enabled) VALUES ('event1','week1','333','avg5',true),('event2','week2','333','avg5',true);
      INSERT INTO weekly_player_library(id,status,source,birth_date,personal_bests,personal_bests_average,personal_bests_base,personal_bests_average_base,updated_at) VALUES ('test-player','active','admin_manual','2018-01-01','{"333":8}','{"333":10}','{"333":10}','{"333":15}',now());
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

    const config={id:'week2',title:'隔离测试',dateLabel:'9月21日',startsAt:'2026-09-21T00:00:00+08:00',endsAt:'2026-09-27T23:59:59+08:00',eventConfigs:[{eventId:'333',format:'best3',enabled:true}]};
    await assert.rejects(store.updateWeeklyMeetConfig(config),/已有成绩，不能修改赛制/);
    assert.equal((await pool.query("SELECT format FROM weekly_events WHERE id='event2'")).rows[0].format,'avg5');
    assert.equal((await pool.query("SELECT enabled FROM weekly_events WHERE id='event2'")).rows[0].enabled,true);
    await store.updateWeeklyMeetConfig({...config,eventConfigs:[{eventId:'333',format:'avg5',enabled:true}]});
    await assert.rejects(store.updateWeeklyMeetConfig({...config,startsAt:'2026-09-22T00:00:00+08:00'}),/不能修改开始时间/);
    await assert.rejects(store.updateWeeklyMeetConfig({...config,endsAt:'2026-09-20T00:00:00+08:00'}),/结束日期/);
    await assert.rejects(store.updateWeeklyMeetConfig({...config,eventConfigs:[{eventId:'333',format:'unknown',enabled:true}]}),/赛制不正确/);
    await assert.rejects(store.updateWeeklyMeetConfig({...config,eventConfigs:[{eventId:'333',format:'avg5',enabled:true},{eventId:'333',format:'avg5',enabled:true}]}),/不能重复/);
    console.log('PASS recorded-event format protection, transaction rollback, valid config edit and invalid config rejection');

    await pool.query("INSERT INTO weekly_player_library(id,status,source,birth_date,personal_bests,personal_bests_average,personal_bests_base,personal_bests_average_base) VALUES ('other-player','active','admin_manual','2018-01-01','{}','{}','{}','{}')");
    const other=(await pool.query("INSERT INTO weekly_results(meet_id,event_id,player_id,player_name,age_group,average,personal_best) VALUES ('week2','event2','other-player','另一选手','U10',15,15) RETURNING id,updated_at::text AS version")).rows[0];
    await pool.query("INSERT INTO weekly_attempts SELECT $1,seq,15,1500,'ok' FROM generate_series(1,5) AS seq",[other.id]);
    const current=(await pool.query('SELECT updated_at::text AS version FROM weekly_results WHERE id=2')).rows[0].version;
    const distinct=await Promise.allSettled([
      store.correctWeeklyResult({resultId:2,expectedVersion:current,format:'avg5',attempts:Array(5).fill('14'),reason:'并发重排名'}),
      store.correctWeeklyResult({resultId:other.id,expectedVersion:other.version,format:'avg5',attempts:Array(5).fill('10'),reason:'并发重排名'})
    ]);
    assert.equal(distinct.filter(r=>r.status==='fulfilled').length,2,JSON.stringify(distinct));
    const rankings=(await pool.query("SELECT player_id,rank FROM weekly_results WHERE meet_id='week2' ORDER BY rank")).rows;
    assert.deepEqual(rankings,[{player_id:'other-player',rank:1},{player_id:'test-player',rank:2}]);
    console.log('PASS concurrent corrections for different players both succeed with consistent final ranks');


    await pool.query("INSERT INTO weekly_meets(id,data_version) VALUES ('race',2),('empty',2)");
    const writer=await pool.connect();
    await writer.query('BEGIN');
    await writer.query("SELECT id FROM weekly_meets WHERE id='race' FOR SHARE");
    const deletion=store.deleteEmptyWeeklyMeet('race');
    // Await an actual blocked database lock rather than relying on a sleep.
    let waiting=false;
    for(let i=0;i<100&&!waiting;i++) {
      waiting=(await pool.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'SELECT id FROM weekly_meets%FOR UPDATE') AS waiting")).rows[0].waiting;
    }
    assert.equal(waiting,true,'deletion must wait for the in-flight result transaction');
    await writer.query("INSERT INTO weekly_results(meet_id,event_id,player_id,player_name) VALUES ('race','race-event','test-player','测试')");
    await writer.query('COMMIT');
    writer.release();
    await assert.rejects(deletion,/已有成绩，不能删除/);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM weekly_results WHERE meet_id='race'")).rows[0].count,1);
    await store.deleteEmptyWeeklyMeet('empty');
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM weekly_meets WHERE id='empty'")).rows[0].count,0);
    console.log('PASS meet deletion waits for score writes and refuses the newly populated meet; empty meet deletion succeeds');

    await pool.query("UPDATE weekly_player_library SET name='测试选手'");
    const imports=load('weekly-results-import-store');
    const preview={meetId:'week2',source:'paste',parser:'weekly-results-paste-v1',metadata:{},rows:[],globalWarnings:[],globalErrors:[],rawRowCount:0,validRowCount:0,warningCount:0,errorCount:0};
    await pool.query("INSERT INTO weekly_import_batches(id,kind,status,file_sha256,preview_jsonb,error_count) VALUES ('race-batch','results','parsed','race-hash',$1,0)",[preview]);
    commitDuringPreview='race-batch';
    await assert.rejects(imports.resolveWeeklyResultsImportPlayers({batchId:'race-batch',meetId:'week2',resolutions:[],actor:'test'}),/已被其他操作修改/);
    assert.equal((await pool.query("SELECT status FROM weekly_import_batches WHERE id='race-batch'")).rows[0].status,'committed');
    await pool.query("INSERT INTO weekly_import_batches(id,kind,status,file_sha256,preview_jsonb,error_count) VALUES ('old-batch','results','committed','same-hash',$1,0),('new-batch','results','ready','same-hash',$2,0)",[{...preview,meetId:'week1'},preview]);
    await assert.rejects(imports.commitWeeklyResultsImportBatch({id:'new-batch',meetId:'week2',actor:'test'}),/预览不是完整无错误/);
    await pool.query("UPDATE weekly_import_batches SET preview_jsonb=$1 WHERE id='old-batch'",[preview]);
    await assert.rejects(imports.commitWeeklyResultsImportBatch({id:'new-batch',meetId:'week2',actor:'test'}),/已经成功提交过成绩/);
    console.log('PASS in-flight player resolution cannot reopen a committed batch; duplicate content is scoped to the selected meet');


  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1});
