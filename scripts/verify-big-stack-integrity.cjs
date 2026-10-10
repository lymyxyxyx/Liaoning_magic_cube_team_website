#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- Isolated PostgreSQL fixtures load the TypeScript services. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fromWorkspace = name => require(require.resolve(name, { paths: [process.cwd()] }));
const ts = fromWorkspace('typescript');
const { Pool } = fromWorkspace('pg');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const schema = `big_stack_verify_${Date.now()}_${process.pid}`;
  const admin = new Pool({ connectionString: process.env.DATABASE_URL });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`, max: 4 });
  const cache = new Map();
  function load(name) {
    if (cache.has(name)) return cache.get(name);
    const exports = {};
    cache.set(name, exports);
    const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'lib', `${name}.ts`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'exports', compiled)(dependency => dependency === '@/lib/postgres' ? { getPostgresPool: () => pool } : dependency.startsWith('@/lib/') ? load(dependency.slice(6)) : fromWorkspace(dependency), exports);
    return exports;
  }
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`
      CREATE TABLE weekly_meets(id text PRIMARY KEY,title text);
      CREATE TABLE weekly_player_library(id text PRIMARY KEY,name text,wca_id text);
      CREATE TABLE weekly_big_stack_records(id text PRIMARY KEY,name text NOT NULL,event_code text NOT NULL,solve_count int NOT NULL,player_id text,wca_id text NOT NULL DEFAULT '',achieved_at date,meet_id text,source_label text NOT NULL DEFAULT '',note text NOT NULL DEFAULT '',gender_override text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT clock_timestamp());
      CREATE UNIQUE INDEX big_stack_verify_player ON weekly_big_stack_records(event_code,player_id) WHERE player_id IS NOT NULL AND player_id<>'';
      CREATE UNIQUE INDEX big_stack_verify_wca ON weekly_big_stack_records(event_code,wca_id) WHERE wca_id<>'';
      CREATE TABLE weekly_big_stack_record_revisions(id bigserial PRIMARY KEY,record_id text,action text,reason text,before_record jsonb,after_record jsonb,points_awarded int,import_batch_id text,created_at timestamptz DEFAULT now());
      CREATE TABLE weekly_big_stack_import_batches(id text PRIMARY KEY,filename text,event_code text,mode text,summary jsonb);
      INSERT INTO weekly_player_library VALUES ('A','同名选手','2018AAAA01'),('B','同名选手','2019BBBB01');
    `);
    const store = load('big-stack');
    const initial = await store.createBigStackRecord({ name: '同名选手', eventId: '333', solveCount: 100, playerId: 'A', note: '内部备注' });
    const changes = await Promise.allSettled([110,120].map(solveCount => store.updateBigStackRecord(initial.id, { ...initial, solveCount, expectedVersion: initial.version, reason: '并发验证' })));
    assert.equal(changes.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(changes.find(r=>r.status==='rejected').reason.name,'WeeklyResultConflictError');
    await assert.rejects(store.deleteBigStackRecord(initial.id,'过期删除',initial.version),e=>e.name==='WeeklyResultConflictError');
    assert.equal((await store.listBigStackRecords('333')).length,1);
    console.log('PASS competing updates and stale delete leave the latest record intact');

    const duplicates = await Promise.allSettled([1,2].map(()=>store.createBigStackRecord({ name:'未绑定测试',eventId:'333',solveCount:50 })));
    assert.equal(duplicates.filter(r=>r.status==='fulfilled').length,1);
    await assert.rejects(store.createBigStackRecord({ name:'未绑定测试',eventId:'333',solveCount:50,playerId:'B' }),/已经有/);
    console.log('PASS concurrent unbound creation and accidental duplicate creation with a new binding are blocked');

    const conflicting = await store.previewBigStackImport({eventId:'333',mode:'merge',rows:[{rowNumber:2,name:'同名选手',count:200,playerId:'B'}]});
    assert.ok(conflicting.errors.length);
    await assert.rejects(store.commitBigStackImport({eventId:'333',mode:'merge',rows:[{rowNumber:2,name:'同名选手',count:200,playerId:'B'}],filename:'test.xlsx',expectedPreviewToken:conflicting.token}),/身份不确定/);
    assert.equal((await store.listBigStackRecords('333')).find(r=>r.id===initial.id).playerId,'A');
    console.log('PASS conflicting same-name import cannot replace another bound player');

    const mergeInput = {eventId:'333',mode:'merge',rows:[{rowNumber:2,name:'同名选手',count:200,playerId:'A'}],filename:'test.xlsx'};
    const reviewed = await store.previewBigStackImport(mergeInput);
    const current = (await store.listBigStackRecords('333')).find(r=>r.id===initial.id);
    await store.updateBigStackRecord(current.id,{...current,solveCount:150,expectedVersion:current.version,reason:'预览后更新'});
    await assert.rejects(store.commitBigStackImport({...mergeInput,expectedPreviewToken:reviewed.token}),e=>e.name==='BigStackImportConflictError');
    const refreshed = await store.previewBigStackImport(mergeInput);
    await store.commitBigStackImport({...mergeInput,expectedPreviewToken:refreshed.token});
    assert.equal((await store.listBigStackRecords('333')).find(r=>r.id===initial.id).solveCount,200);
    const lowerInput={...mergeInput,rows:[{...mergeInput.rows[0],count:100}]};
    const lower=await store.previewBigStackImport(lowerInput);
    await store.commitBigStackImport({...lowerInput,expectedPreviewToken:lower.token});
    assert.equal((await store.listBigStackRecords('333')).find(r=>r.id===initial.id).solveCount,200);
    console.log('PASS stale preview is blocked, reviewed PB improvement succeeds and lower scores are ignored');

    const before = await store.listBigStackRecords('333');
    const baseline={eventId:'333',mode:'baseline',rows:[{rowNumber:2,name:'新基线',count:60}],filename:'baseline.xlsx'};
    const preview=await store.previewBigStackImport(baseline);
    const result=await store.commitBigStackImport({...baseline,expectedPreviewToken:preview.token});
    const snapshots=(await pool.query("SELECT before_record FROM weekly_big_stack_record_revisions WHERE action='baseline_removed' AND import_batch_id=$1",[result.batchId])).rows;
    assert.deepEqual(snapshots.map(r=>[r.before_record.id,r.before_record.solve_count,r.before_record.note]).sort(),before.map(r=>[r.id,r.solveCount,r.note]).sort());
    assert.equal(result.records.length,1);
    assert.equal(result.records[0].name,'新基线');
    await assert.rejects(store.commitBigStackImport({...baseline,rows:[{rowNumber:2,name:'坏基线',count:10001}],expectedPreviewToken:preview.token}),/0 到 10000/);
    assert.equal((await store.listBigStackRecords('333'))[0].name,'新基线');
    console.log('PASS baseline stores full replaced snapshots; invalid replacement leaves the board unchanged');
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
