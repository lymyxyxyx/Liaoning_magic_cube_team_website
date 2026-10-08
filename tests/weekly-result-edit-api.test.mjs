import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {NextRequest, NextResponse} from 'next/server.js';
import {WeeklyResultConflictError} from '../lib/weekly-result-version.ts';
import * as resultUtils from '../lib/weekly-result-utils.ts';

function compile(relative, dependencies) {
  const exports={};
  const compiled=ts.transpileModule(readFileSync(new URL(relative,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports',compiled)((name)=>{assert(name in dependencies,`Unexpected dependency ${name}`);return dependencies[name];},exports);
  return exports;
}
const validation=compile('../lib/weekly-request-validation.ts',{'@/lib/weekly-result-utils':resultUtils});
function routes(service) {
  return compile('../app/api/admin/weekly-results/[id]/route.ts',{
    'next/server':{NextRequest,NextResponse},'@/lib/weekly-result-version':{WeeklyResultConflictError},
    '@/lib/weekly-admin-auth':{hasWeeklyAdminSession:async()=>true},'@/lib/weekly-request-security':{isWeeklySameOrigin:()=>true},
    '@/lib/weekly-request-validation':validation,'@/lib/weekly-entry-store':{correctWeeklyResult:service,deleteWeeklyResult:service}
  });
}
const request=(method,payload)=>new NextRequest('https://example.test/api/admin/weekly-results/1',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
const payload={attempts:Array(5).fill('12'),format:'avg5',reason:'纠正录入'};
const params={params:Promise.resolve({id:'1'})};

test('older admin pages cannot edit or delete without a version',async()=>{
  const api=routes(()=>{assert.fail('unversioned writes must not reach the service');});
  assert.equal((await api.PATCH(request('PATCH',payload),params)).status,428);
  assert.equal((await api.DELETE(request('DELETE',{reason:'重复'}),params)).status,428);
});

test('stale edit and delete conflicts return HTTP 409 rather than a generic validation error',async()=>{
  const api=routes(()=>{throw new WeeklyResultConflictError();});
  for(const method of ['PATCH','DELETE']) {
    const response=await api[method](request(method,{...payload,expectedVersion:'stale'}),params);
    assert.equal(response.status,409);
    assert.match((await response.json()).message,/尚未保存/);
  }
});

test('the read version reaches the write service unchanged',async()=>{
  let seen;
  const api=routes(input=>{seen=input;return {best:1200,average:1200};});
  const version='2026-10-08 10:00:00.123456+00';
  assert.equal((await api.PATCH(request('PATCH',{...payload,expectedVersion:version}),params)).status,200);
  assert.equal(seen.expectedVersion,version);
});
