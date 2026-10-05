import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=ts.transpileModule(await readFile('app/catch-validation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("from 'valibot'",`from '${import.meta.resolve('valibot')}'`);
const {validateCatch,parseCatch}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const valid={date:'2024-02-29',location:' 海 ',fish:[{species:' アジ ',count:'2',length:''}],method:' 竿 ',memo:' 記録 '};
assert.deepEqual(parseCatch(valid),{date:'2024-02-29',location:'海',fish:[{species:'アジ',count:2,length:null}],method:'竿',memo:'記録',legacy:false});
for(const length of ['',null,undefined,0,999,'12.5'])assert.ok(parseCatch({...valid,fish:[{species:'魚',count:1,length}]}));
for(const date of ['2023-02-29','2024-02-30','2026-04-31','2026-13-01','2026-00-01','2026-01-00','2026-1-01',''])assert.ok(validateCatch({...valid,date}).errors.date);
for(const count of ['',null,undefined,' ',0,-1,1.1,10000,Infinity,'NaN'])assert.ok(validateCatch({...valid,fish:[{species:'魚',count}]}).errors['fish.0.count']);
for(const count of [1,9999,'1','9999'])assert.ok(parseCatch({...valid,fish:[{species:'魚',count}]}));
for(const length of [-1,1000,Infinity,NaN,'abc'])assert.ok(validateCatch({...valid,fish:[{species:'魚',count:1,length}]}).errors['fish.0.length']);
for(const [field,max] of [['location',120],['method',200],['memo',2000]]){
 assert.ok(parseCatch({...valid,[field]:'あ'.repeat(max)}));
 assert.ok(validateCatch({...valid,[field]:'あ'.repeat(max+1)}).errors[field]);
}
assert.ok(parseCatch({...valid,fish:[{species:'魚'.repeat(80),count:1}]}));
assert.ok(validateCatch({...valid,fish:[{species:'魚'.repeat(81),count:1}]}).errors['fish.0.species']);
assert.ok(parseCatch({...valid,fish:Array.from({length:20},(_,i)=>({species:String(i),count:1}))}));
for(const fish of [[],Array.from({length:21},(_,i)=>({species:String(i),count:1}))])assert.ok(validateCatch({...valid,fish}).errors.fish);
const invalid={...valid,date:'',location:' ',fish:[{species:'アジ',count:''},{species:' アジ ',count:0},{species:' ',count:10000}],method:'竿'.repeat(201),memo:'海'.repeat(2001)};
const original=structuredClone(invalid),errors=validateCatch(invalid).errors;
for(const key of ['date','location','fish.0.species','fish.1.species','fish.2.species','fish.0.count','fish.1.count','fish.2.count','method','memo'])assert.ok(errors[key],key);
assert.deepEqual(invalid,original,'Validation must retain the entered values');
assert.deepEqual(validateCatch(valid).errors,{});
assert.deepEqual(parseCatch({date:'2026-10-05',location:'海',species:'魚',count:'1'}),{date:'2026-10-05',location:'海',fish:[{species:'魚',count:1,length:null}],method:'',memo:'',legacy:true});
for(const input of [null,undefined,[],1,'bad'])assert.equal(parseCatch(input),null);
console.log('Catch validation passed: required fields, dates, boundaries, coercion, duplicates by row, legacy payload and preserved input.');
