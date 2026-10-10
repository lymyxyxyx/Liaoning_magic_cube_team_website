import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
const exports={};
new Function('require','exports',ts.transpileModule(fs.readFileSync(new URL('../lib/big-stack-player-display.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(()=>({}),exports);
const player={id:'A',name:'王曦',weeklyNumber:53,wcaId:'2018WANG01',gender:'男',version:'v1'};
const profile={name:'Xi Wang (王曦)',wcaId:'2018WANG01',gender:'男'};
const record={id:'r1',name:'王曦',eventId:'333',solveCount:100};
const display=(row=record,players=[player],profiles=[profile])=>exports.matchBigStackPlayerDisplay([row],players,profiles)[0];
test('a unique exact Chinese WCA name reuses the ordinary weekly number and profile ID',()=>{
  const result=display();assert.equal(result.weeklyNumber,53);assert.equal(result.matchedWcaId,'2018WANG01');assert.equal(result.gender,'男');assert.equal(record.playerId,undefined);
});
test('partial names and pinyin never produce identity matches',()=>{
  for(const name of ['王','王曦同学','wangxi']){const result=display({...record,name});assert.equal(result.weeklyNumber,undefined);assert.equal(result.matchedWcaId,'');assert.equal(result.gender,'未知');}
});
test('duplicate names leave ambiguous identifiers blank rather than choosing the first person',()=>{
  const result=display(record,[{...player,wcaId:''},{...player,id:'B',weeklyNumber:54,wcaId:''}],[profile,{...profile,wcaId:'2019WANG02',gender:'女'}]);assert.equal(result.weeklyNumber,undefined);assert.equal(result.matchedWcaId,'');assert.equal(result.gender,'未知');
});
test('exact bound IDs resolve same-name players, but missing IDs never fall back by name',()=>{
  const result=display({...record,playerId:'A'},[player,{...player,id:'B',weeklyNumber:54}], [profile]);assert.equal(result.weeklyNumber,53);
  const missing=display({...record,playerId:'missing'},[player],[]);assert.equal(missing.weeklyNumber,undefined);
  const unknownWca=display({...record,wcaId:'2020NONE01'});assert.equal(unknownWca.matchedWcaId,'');assert.equal(unknownWca.gender,'未知');
});
test('conflicting WCA IDs and gender evidence are not silently presented as confirmed facts',()=>{
  const conflict=display({...record,playerId:'A',wcaId:'2019OTHER01'});assert.equal(conflict.weeklyNumber,undefined);assert.equal(conflict.matchedWcaId,'');assert.equal(conflict.gender,'未知');
  assert.equal(display(record,[{...player,gender:'女'}]).gender,'未知');
});
test('an identifier belonging to another name does not expose that person’s number or WCA ID',()=>{
  const wrongPlayer=display({...record,name:'李四',playerId:'A',wcaId:'2018WANG01'});
  assert.equal(wrongPlayer.weeklyNumber,undefined);
  assert.equal(wrongPlayer.matchedWcaId,'');
  assert.equal(wrongPlayer.gender,'未知');
  const wrongWca=display({...record,name:'李四',wcaId:'2018WANG01'});
  assert.equal(wrongWca.matchedWcaId,'');
});
test('administrator gender corrections can be explicitly set or returned to automatic matching',()=>{
  assert.equal(display({...record,genderOverride:'女'}).gender,'女');assert.equal(display({...record,genderOverride:'未知'}).gender,'未知');assert.equal(display({...record,genderOverride:''}).gender,'男');
});
