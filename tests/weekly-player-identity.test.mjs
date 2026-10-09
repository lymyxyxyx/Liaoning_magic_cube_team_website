import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync(new URL("../lib/weekly-player-identity.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const service={};
new Function("require","exports",compiled)(()=>({}),service);
const valid={weeklyNumber:45,wcaId:"2019abcd01",wcaIdConfirmed:true,reason:"核对登记资料"};
test("identity editor accepts a fixed positive number and normalizes the WCA ID",()=>{
  assert.deepEqual(service.validateWeeklyPlayerIdentity(valid),{...valid,wcaId:"2019ABCD01"});
});
test("clearing the WCA ID also clears its confirmation",()=>{
  assert.equal(service.validateWeeklyPlayerIdentity({...valid,wcaId:" "}).wcaIdConfirmed,false);
});
test("invalid or missing identity values cannot be saved",()=>{
  for(const patch of [{weeklyNumber:0},{weeklyNumber:1.5},{weeklyNumber:1000000},{weeklyNumber:"45"},{wcaId:"wrong"},{wcaId:null},{wcaIdConfirmed:"true"},{reason:""},{reason:"x".repeat(501)}])assert.throws(()=>service.validateWeeklyPlayerIdentity({...valid,...patch}));
});
