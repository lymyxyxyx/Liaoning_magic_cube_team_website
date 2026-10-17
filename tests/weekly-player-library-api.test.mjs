import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {NextRequest, NextResponse} from 'next/server.js';

class WeeklyPlayerLibraryConflictError extends Error {}
function routes(service={}) {
  const exports={};
  const source=readFileSync(new URL('../app/api/admin/weekly-player-library/route.ts',import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports',compiled)((name)=>{
    const modules={
      'next/server':{NextRequest,NextResponse},
      '@/lib/weekly-admin-auth':{hasWeeklyAdminSession:async()=>true},
      '@/lib/weekly-request-security':{isWeeklySameOrigin:()=>true},
      '@/lib/weekly-player-library':{WeeklyPlayerLibraryConflictError,...service}
    };
    assert(name in modules,`Unexpected dependency ${name}`);
    return modules[name];
  },exports);
  return exports;
}
const request=(method,body)=>new NextRequest('https://example.test/api/admin/weekly-player-library',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

test('old whole-list writes and unversioned profile edits are rejected',async()=>{
  const api=routes({createWeeklyPlayerLibraryEntry:()=>assert.fail('bulk request must not write'),updateWeeklyPlayerLibraryEntry:()=>assert.fail('unversioned request must not write')});
  assert.equal((await api.POST(request('POST',{players:[{id:'A'}]}))).status,400);
  assert.equal((await api.PATCH(request('PATCH',{id:'A',patch:{name:'甲'}}))).status,428);
});

test('a stale player edit returns conflict, while a versioned patch reaches the service',async()=>{
  let received;
  const api=routes({updateWeeklyPlayerLibraryEntry:input=>{received=input;return {id:'A',name:'甲'};}});
  assert.equal((await api.PATCH(request('PATCH',{id:'A',expectedVersion:'exact-version',patch:{city:'沈阳'}}))).status,200);
  assert.equal(received.expectedVersion,'exact-version');
  const conflict=routes({updateWeeklyPlayerLibraryEntry:()=>{throw new WeeklyPlayerLibraryConflictError('stale');}});
  assert.equal((await conflict.PATCH(request('PATCH',{id:'A',expectedVersion:'stale',patch:{city:'沈阳'}}))).status,409);
});
