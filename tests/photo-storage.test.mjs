import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as valibot from 'valibot';
import {Worker} from 'node:worker_threads';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';

async function ready(storage) { for(let i=0;i<100;i++){try{await storage.initializePhotoStorage();return;}catch(e){if(e.status!==503)throw e;}}throw Error('inventory did not finish'); }
const jpeg = new Uint8Array([255,216,255,224]);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve=r; }); return {promise,resolve}; };
async function fixture(legacy=false,pageSize=1) {
  const sql = new DatabaseSync(':memory:'); sql.exec('PRAGMA foreign_keys=ON');
  const migrations=(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort();
  for (const f of migrations.filter(f=>!f.startsWith('0005'))) sql.exec(await readFile('drizzle/'+f,'utf8'));
  sql.exec("INSERT INTO profiles(user_id,display_name,bio) VALUES ('u1','一',''),('u2','二','');");
  function catchRow(id,owner='u1') {
    sql.prepare('INSERT INTO catches(id,owner_id,date,location,species,count,created_at) VALUES (?,?,?,?,?,?,?)').run(id,owner,'2026-10-07','海','魚',1,'now');
    sql.prepare('INSERT INTO catch_fish(catch_id,species,count,sort_order) VALUES (?,?,?,?)').run(id,'魚',1,0);
  }
  catchRow(1); catchRow(2); catchRow(3,'u2');
  const objects=new Map(), fail={put:false,delete:false,attach:false,featured:false,list:false,afterPut:false};
  if (legacy) {
    for(const [id,key] of [[1,'legacy'],[2,'missing']]) sql.prepare('INSERT INTO catch_photos(catch_id,object_key,content_type,created_at,species) VALUES (?,?,?,?,?)').run(id,key,'image/jpeg','now','魚');
    objects.set('legacy',jpeg); objects.set('orphan',new Uint8Array(7));
  }
  for (const f of migrations.filter(f=>f.startsWith('0005'))) sql.exec(await readFile('drizzle/'+f,'utf8'));
  let queryCount=0;
  const db={prepare(query) {
    let args=[];
    const s={bind(...v){args=v;return s;},async first(){queryCount++;return sql.prepare(query).get(...args)||null;},async all(){queryCount++;return {results:sql.prepare(query).all(...args)};},
      execute(){queryCount++;if(fail.attach&&query.startsWith('INSERT INTO catch_photos'))throw Error('DB insert failure');if(fail.featured&&query.startsWith('UPDATE catches SET featured_photo_id=')){fail.featured=false;throw Error('featured failure');}const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};},async run(){return s.execute();}};
    return s;
  },async batch(statements){sql.exec('BEGIN');try{const results=statements.map(s=>s.execute());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
  let putGate,putStarted;let puts=0;
  const bucket={async list({cursor}) {
    if(fail.list)throw Error('R2 listing failed');
    const all=[...objects].map(([key,b])=>({key,size:b.length}));const i=Number(cursor||0);
    return {objects:all.slice(i,i+pageSize),truncated:i+pageSize<all.length,cursor:String(i+pageSize)};
  },async head(key){const b=objects.get(key);return b?{size:b.length}:null;},
  async put(key,bytes){puts++;putStarted?.resolve();if(putGate)await putGate.promise;if(fail.put)throw Error('R2 put failed');objects.set(key,bytes);if(fail.afterPut)throw Error('R2 put response failed');},
  async get(key){return objects.has(key)?{body:objects.get(key)}:null;},async delete(key){if(fail.delete)throw Error('R2 deletion failed');objects.delete(key);}};
  const logs=[];
  const context=vm.createContext({console:{error:(...x)=>logs.push(x)},Response,Request,Headers,URL,File,FormData,crypto,Uint8Array});
  const modules=new Map();
  function synthetic(name,exports){const m=new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v);},{context,identifier:name});modules.set(name,m);}
  const env={DB:db,BUCKET:bucket};
  synthetic('cloudflare:workers',{env});synthetic('valibot',valibot);
  synthetic(resolve('app/auth.ts'),{getUser:async(req)=>{const userId=req?.headers.get('Cookie');return ['u1','u2'].includes(userId)?{userId,fullName:userId}:null;},sameOrigin:req=>req.headers.get('Origin')==='https://test.example'});
  async function load(file){
    if(modules.has(file))return modules.get(file);
    const pending=(async()=>{
      const code=ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
      return new vm.SourceTextModule(code,{context,identifier:file});
    })();
    modules.set(file,pending);return pending;
  }
  async function module(path){
    const m=await load(resolve(path));
    if(m.status==='unlinked')await m.link((spec,ref)=>modules.get(spec)||load(resolve(dirname(ref.identifier),spec+'.ts')));
    if(m.status==='linked')await m.evaluate();return m.namespace;
  }
  const storage=await module('app/api/catches/photo-storage.ts'),post=await module('app/api/catches/[id]/photos/route.ts'),del=await module('app/api/catches/[id]/photos/[photoId]/route.ts'),entry=await module('app/api/catches/[id]/route.ts'),get=await module('app/api/photos/[photoId]/route.ts'),catches=await module('app/api/catches/route.ts');
  const params=(id,photoId)=>({params:Promise.resolve({id:String(id),photoId:String(photoId)})});
  const request=(method,cookie='u1',body)=>new Request('https://test.example/api/catches',{method,headers:{Cookie:cookie,Origin:'https://test.example'},body});
  const upload=(id=1,cookie='u1')=>{const form=new FormData();form.append('photo',new File([jpeg],'魚.jpg'));form.append('species','魚');return post.POST(request('POST',cookie,form),params(id));};
  const used=()=>sql.prepare('SELECT used_bytes FROM photo_storage_settings').get().used_bytes;
  const limits=(global,user)=>{
    env.PHOTO_STORAGE_GLOBAL_LIMIT_BYTES=String(global);env.PHOTO_STORAGE_USER_LIMIT_BYTES=String(user);
    // Also prepare the persisted snapshot for the raw independent-connection test.
    sql.prepare('UPDATE photo_storage_settings SET global_limit_bytes=?,user_limit_bytes=?').run(global,user);
  };
  const assertAccounting=()=>{
    assert.equal(used(),sql.prepare('SELECT COALESCE(SUM(byte_size),0) AS n FROM photo_storage_objects').get().n);
    for(const row of sql.prepare('SELECT * FROM photo_storage_users').all())assert.equal(row.used_bytes,sql.prepare('SELECT COALESCE(SUM(byte_size),0) AS n FROM photo_storage_objects WHERE owner_id=?').get(row.owner_id).n);
  };
  return {sql,env,objects,fail,storage,entry,catches,get,upload,used,limits,assertAccounting,params,request,del,logs,get queryCount(){return queryCount;},resetQueries(){queryCount=0;},get puts(){return puts;},gate(){putGate=deferred();putStarted=deferred();return {started:putStarted.promise,release:()=>putGate.resolve()};}};
}

test('migration and paginated inventory include actual legacy bytes, missing references and orphan objects',async()=>{
  const f=await fixture(true);assert.equal(f.used(),2*8388608);
  await ready(f.storage);assert.equal(f.used(),11);
  assert.equal(f.sql.prepare('SELECT used_bytes FROM photo_storage_users WHERE owner_id=?').get('u1').used_bytes,4);
  assert.equal(f.sql.prepare('SELECT byte_size FROM photo_storage_objects WHERE object_key=?').get('missing').byte_size,0);
  await ready(f.storage);assert.equal(f.used(),11);f.assertAccounting();
});
test('failed inventory blocks R2 writes and can resume without double accounting',async()=>{
  const f=await fixture(true);f.fail.list=true;assert.equal((await f.upload()).status,503);assert.equal(f.puts,0);
  assert.equal(f.sql.prepare('SELECT initialized FROM photo_storage_settings').get().initialized,0);
  f.fail.list=false;await ready(f.storage);assert.equal((await f.upload()).status,201);assert.equal(f.used(),15);f.assertAccounting();
});
test('decimal global and user boundaries accept equality, reject one extra byte, and include reservations',async()=>{
  const f=await fixture();await ready(f.storage);
  await f.storage.reservePhoto('large','u1',1,100000000);assert.equal(f.used(),100000000);
  await assert.rejects(f.storage.reservePhoto('extra','u1',2,1),/100MB/);
  await f.storage.discardPhoto('large');
  f.sql.prepare("INSERT INTO photo_storage_objects(object_key,byte_size,state,created_at) VALUES ('other',7999999996,'stored','now')").run();
  await f.storage.reservePhoto('exact','u1',1,4);assert.equal(f.used(),8000000000);
  await assert.rejects(f.storage.reservePhoto('overflow','u2',3,1),/8GB/);f.assertAccounting();
});
test('two concurrent uploads cannot oversubscribe global capacity; text and viewing still work',async()=>{
  const f=await fixture();f.limits(4,100);const gate=f.gate(),first=f.upload();await gate.started;
  assert.equal(f.used(),4);const second=await f.upload(3,'u2');assert.equal(second.status,413);assert.match((await second.json()).error,/サイト全体/);assert.equal(f.puts,1);
  gate.release();const result=await first;assert.equal(result.status,201);const photoId=(await result.json()).id;
  assert.equal((await f.get.GET(f.request('GET','u2'),f.params(1,photoId))).status,200);
  assert.equal((await f.catches.POST(f.request('POST','u2',JSON.stringify({date:'2026-10-07',location:'海',fish:[{species:'魚',count:1}]})))).status,201);
  assert.equal((await f.del.DELETE(f.request('DELETE'),f.params(1,photoId))).status,200);assert.equal(f.used(),0);f.assertAccounting();
});
test('concurrent uploads to different records of one user share the user limit',async()=>{
  const f=await fixture();f.limits(100,4);const gate=f.gate(),first=f.upload();await gate.started;
  const second=await f.upload(2);assert.equal(second.status,413);assert.match((await second.json()).error,/あなたの写真保存容量/);
  // A different user still has their own allowance.
  const other=f.upload(3,'u2');gate.release();assert.equal((await first).status,201);assert.equal((await other).status,201);assert.equal(f.used(),8);f.assertAccounting();
});
for(const failure of ['put','afterPut','attach','featured'])test(`${failure} failure rolls back R2, D1, representative image and reservation`,async()=>{
  const f=await fixture();f.fail[failure]=true;assert.equal((await f.upload()).status,500);
  assert.equal(f.used(),0);assert.equal(f.objects.size,0);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM catch_photos').get().n,0);
  assert.equal(f.sql.prepare('SELECT featured_photo_id FROM catches WHERE id=1').get().featured_photo_id,null);f.assertAccounting();
});
test('failed rollback retains charged cleanup row until a later successful retry',async()=>{
  const f=await fixture();f.fail.afterPut=true;f.fail.delete=true;assert.equal((await f.upload()).status,500);
  assert.equal(f.used(),4);assert.equal(f.objects.size,1);assert.equal(f.sql.prepare('SELECT state FROM photo_storage_objects').get().state,'deleting');
  f.limits(4,100);assert.equal((await f.upload(2)).status,413);
  f.fail.delete=false;f.fail.afterPut=false;await f.storage.retryPhotoCleanup();assert.equal(f.used(),0);assert.equal(f.objects.size,0);f.assertAccounting();
});
test('delete then replace removes the old object and returns capacity; repeated cleanup is safe',async()=>{
  const f=await fixture();f.limits(4,4);const photo=(await (await f.upload()).json()).id;
  f.fail.delete=true;assert.equal((await f.del.DELETE(f.request('DELETE'),f.params(1,photo))).status,500);assert.equal(f.used(),4);
  f.fail.delete=false;assert.equal((await f.del.DELETE(f.request('DELETE'),f.params(1,photo))).status,200);assert.equal(f.used(),0);
  const replaced=await f.upload();assert.equal(replaced.status,201);assert.equal(f.objects.size,1);
  const key=f.sql.prepare('SELECT object_key FROM catch_photos').get().object_key;
  await Promise.all([f.storage.discardPhoto(key),f.storage.discardPhoto(key)]);assert.equal(f.used(),0);f.assertAccounting();
});
test('whole-record deletion during an in-flight put prevents late attachment and self-cleans',async()=>{
  const f=await fixture();const gate=f.gate(),pending=f.upload();await gate.started;
  assert.equal((await f.entry.DELETE(f.request('DELETE'),f.params(1))).status,200);assert.equal(f.used(),4,'pending bytes stay charged');
  gate.release();assert.equal((await pending).status,409);assert.equal(f.used(),0);assert.equal(f.objects.size,0);f.assertAccounting();
});
test('whole-record delete failure is retryable and blocks new images on the closing record',async()=>{
  const f=await fixture();await f.upload();f.fail.delete=true;assert.equal((await f.entry.DELETE(f.request('DELETE'),f.params(1))).status,500);
  assert.equal((await f.upload()).status,409);assert.equal(f.used(),4);
  f.fail.delete=false;assert.equal((await f.entry.DELETE(f.request('DELETE'),f.params(1))).status,200);assert.equal(f.used(),0);assert.equal(f.objects.size,0);f.assertAccounting();
});
test('six-photo limit includes in-flight reservations and is enforced by the transaction',async()=>{
  const f=await fixture();await ready(f.storage);
  for(let i=0;i<6;i++)await f.storage.reservePhoto('pending'+i,'u1',1,4);
  await assert.rejects(f.storage.reservePhoto('seventh','u1',1,4),/6枚/);assert.equal(f.used(),24);f.assertAccounting();
});
test('authorization is preserved and unknown in-flight reservations are never timed out unsafely',async()=>{
  const f=await fixture();assert.equal((await f.upload(1,'u2')).status,403);assert.equal((await f.upload(1,'anonymous')).status,401);
  await ready(f.storage);await f.storage.reservePhoto('interrupted','u1',1,4);
  f.sql.prepare("UPDATE photo_storage_objects SET created_at='2000-01-01'").run();await f.storage.retryPhotoCleanup();assert.equal(f.used(),4);f.assertAccounting();
});

test('bulk inventory stays within D1 invocation limits and resumes across multiple requests',async()=>{
  const f=await fixture(false,200);
  for(let i=0;i<351;i++)f.objects.set('object'+String(i).padStart(4,'0'),jpeg);
  for(let i=0;i<2;i++){f.resetQueries();await assert.rejects(f.storage.initializePhotoStorage(),e=>e.status===503);assert.ok(f.queryCount<25,`only ${f.queryCount} D1 queries`);}
  await ready(f.storage);assert.equal(f.used(),351*4);f.assertAccounting();
});
test('maintenance blocks uploads while allowing deletion and text-only creation',async()=>{
  const f=await fixture();const photo=(await(await f.upload()).json()).id;
  f.sql.prepare('UPDATE photo_storage_settings SET maintenance=1').run();assert.equal((await f.upload(2)).status,503);
  assert.equal((await f.del.DELETE(f.request('DELETE'),f.params(1,photo))).status,200);
  assert.equal((await f.catches.POST(f.request('POST','u1',JSON.stringify({date:'2026-10-07',location:'海',fish:[{species:'魚',count:1}]})))).status,201);assert.equal(f.used(),0);
});
test('independent SQLite connections atomically apply environment limits and reserve with exactly one winner',async()=>{
  const f=await fixture();await ready(f.storage);f.limits(100,100);
  const dir=await mkdtemp(join(tmpdir(),'photo-storage-')),path=join(dir,'db.sqlite');
  f.sql.exec("VACUUM INTO '"+path.replaceAll("'","''")+"'");
  const source=`const {parentPort,workerData}=require('node:worker_threads');const {DatabaseSync}=require('node:sqlite');
  const db=new DatabaseSync(workerData.path);db.exec('PRAGMA busy_timeout=10000');
  try{db.exec('BEGIN IMMEDIATE');db.prepare('UPDATE photo_storage_settings SET global_limit_bytes=4,user_limit_bytes=100 WHERE id=1').run();
  db.prepare("INSERT INTO photo_storage_objects(object_key,owner_id,catch_id,byte_size,state,created_at) VALUES (?,'u1',1,4,'reserved','now')").run(workerData.key);db.exec('COMMIT');parentPort.postMessage('ok');}
  catch(e){db.exec('ROLLBACK');parentPort.postMessage(e.message);}finally{db.close();}`;
  try{
    const results=await Promise.all(Array.from({length:6},(_,i)=>new Promise((resolve,reject)=>{const worker=new Worker(source,{eval:true,workerData:{path,key:'race'+i}});worker.once('message',resolve);worker.once('error',reject);})));
    assert.equal(results.filter(x=>x==='ok').length,1);assert.equal(results.filter(x=>x.includes('photo_global_limit')).length,5);
    const db=new DatabaseSync(path);assert.equal(db.prepare('SELECT used_bytes FROM photo_storage_settings').get().used_bytes,4);db.close();
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('inventory errors do not interrupt existing record or image viewing',async()=>{
  const f=await fixture(true);f.fail.list=true;
  const response=await f.catches.GET(f.request('GET'));assert.equal(response.status,200);assert.equal((await response.json()).length,3);
  assert.equal((await f.get.GET(f.request('GET'),f.params(1,1))).status,200);
  assert.equal((await f.upload()).status,503);assert.equal(f.puts,0);
});

test('environment-only limits override the D1 snapshot and enforce both byte boundaries',async()=>{
  const f=await fixture();await ready(f.storage);
  f.env.PHOTO_STORAGE_GLOBAL_LIMIT_BYTES='120000000';f.env.PHOTO_STORAGE_USER_LIMIT_BYTES='80000000';
  await f.storage.reservePhoto('user-exact','u1',1,80000000);
  await assert.rejects(f.storage.reservePhoto('user-over','u1',2,1),/80MB/);
  await f.storage.reservePhoto('global-exact','u2',3,40000000);assert.equal(f.used(),120000000);
  await assert.rejects(f.storage.reservePhoto('global-over','u2',3,1),/0.12GB/);
  assert.equal(f.sql.prepare('SELECT global_limit_bytes,user_limit_bytes FROM photo_storage_settings').get().global_limit_bytes,120000000);
  f.assertAccounting();
});
test('unset environment limits restore decimal defaults and a rejected reservation rolls back the entire batch',async()=>{
  const f=await fixture();await ready(f.storage);
  f.sql.exec('UPDATE photo_storage_settings SET global_limit_bytes=1,user_limit_bytes=1');
  await f.storage.reservePhoto('default','u1',1,4);
  const settings=()=>f.sql.prepare('SELECT global_limit_bytes,user_limit_bytes FROM photo_storage_settings').get();
  assert.deepEqual({...settings()},{global_limit_bytes:8000000000,user_limit_bytes:100000000});
  f.env.PHOTO_STORAGE_GLOBAL_LIMIT_BYTES='3';f.env.PHOTO_STORAGE_USER_LIMIT_BYTES='2';
  await assert.rejects(f.storage.reservePhoto('rejected','u1',2,1),/サイト全体/);
  assert.equal(f.used(),4);assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM photo_storage_objects WHERE object_key='rejected'").get().n,0);
  assert.deepEqual({...settings()},{global_limit_bytes:8000000000,user_limit_bytes:100000000});f.assertAccounting();
});
test('lowering environment limits counts in-flight uploads; zero blocks new images while reading, deletion and text continue',async()=>{
  const f=await fixture();f.env.PHOTO_STORAGE_GLOBAL_LIMIT_BYTES='8';f.env.PHOTO_STORAGE_USER_LIMIT_BYTES='8';
  const gate=f.gate(),first=f.upload();await gate.started;
  f.env.PHOTO_STORAGE_GLOBAL_LIMIT_BYTES='4';assert.equal((await f.upload(3,'u2')).status,413);assert.equal(f.puts,1);
  gate.release();const photo=(await(await first).json()).id;
  f.env.PHOTO_STORAGE_GLOBAL_LIMIT_BYTES='100';f.env.PHOTO_STORAGE_USER_LIMIT_BYTES='0';
  const denied=await f.upload(2);assert.equal(denied.status,413);assert.match((await denied.json()).error,/0MB/);
  assert.equal((await f.get.GET(f.request('GET'),f.params(1,photo))).status,200);
  assert.equal((await f.catches.POST(f.request('POST','u1',JSON.stringify({date:'2026-10-07',location:'海',fish:[{species:'魚',count:1}]})))).status,201);
  assert.equal((await f.del.DELETE(f.request('DELETE'),f.params(1,photo))).status,200);assert.equal(f.used(),0);
  f.env.PHOTO_STORAGE_GLOBAL_LIMIT_BYTES='0';f.env.PHOTO_STORAGE_USER_LIMIT_BYTES='100';assert.equal((await f.upload()).status,413);
  f.env.PHOTO_STORAGE_GLOBAL_LIMIT_BYTES='4';assert.equal((await f.upload()).status,201);f.assertAccounting();
});
test('invalid runtime configuration fails closed without R2 writes or reservations and preserves other operations',async()=>{
  const f=await fixture();const photo=(await(await f.upload()).json()).id;
  for(const key of ['PHOTO_STORAGE_GLOBAL_LIMIT_BYTES','PHOTO_STORAGE_USER_LIMIT_BYTES']) {
    for(const value of ['', '-1', '1.5', '1e9', ' 4 ', 'NaN', 'Infinity', '9007199254740992']) {
      f.env[key]=value;const r=await f.upload(2);assert.equal(r.status,503,`${key}=${value}`);assert.match((await r.json()).error,/設定に問題/);
      assert.equal(f.puts,1);assert.equal(f.used(),4);assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM photo_storage_objects WHERE state='reserved'").get().n,0);
    }
    delete f.env[key];
  }
  f.env.PHOTO_STORAGE_GLOBAL_LIMIT_BYTES='invalid';
  assert.equal((await f.catches.GET(f.request('GET'))).status,200);
  assert.equal((await f.get.GET(f.request('GET'),f.params(1,photo))).status,200);
  assert.equal((await f.catches.POST(f.request('POST','u1',JSON.stringify({date:'2026-10-07',location:'海',fish:[{species:'魚',count:1}]})))).status,201);
  assert.equal((await f.del.DELETE(f.request('DELETE'),f.params(1,photo))).status,200);assert.equal(f.used(),0);f.assertAccounting();
});
test('deployment configuration forwards environment limits, defaults optional values and rejects malformed values',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'photo-config-'));
  try {
    await writeFile(join(dir,'wrangler.jsonc'),await readFile('wrangler.jsonc'));
    await mkdir(join(dir,'cloudflare/environments'),{recursive:true});
    const baseEnv={...process.env,CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),D1_DATABASE_ID:'11111111-1111-4111-8111-111111111111',GOOGLE_CLIENT_ID:'test-only-client'};
    delete baseEnv.PHOTO_STORAGE_GLOBAL_LIMIT_BYTES;delete baseEnv.PHOTO_STORAGE_USER_LIMIT_BYTES;
    const script=resolve('scripts/cloudflare-config.mjs');
    const generate=async(stage,vars={})=>{
      await promisify(execFile)(process.execPath,[script,stage],{cwd:dir,env:{...baseEnv,APP_ORIGIN:`https://tsuri-kiroku-${stage}.test.workers.dev`,...vars}});
      return JSON.parse(await readFile(join(dir,'wrangler.deploy.json'),'utf8'));
    };
    const defaults=await generate('staging',{PHOTO_STORAGE_GLOBAL_LIMIT_BYTES:'',PHOTO_STORAGE_USER_LIMIT_BYTES:''});
    assert.equal(defaults.vars.PHOTO_STORAGE_GLOBAL_LIMIT_BYTES,'8000000000');assert.equal(defaults.vars.PHOTO_STORAGE_USER_LIMIT_BYTES,'100000000');
    const custom=await generate('production',{PHOTO_STORAGE_GLOBAL_LIMIT_BYTES:'7000000000',PHOTO_STORAGE_USER_LIMIT_BYTES:'50000000'});
    assert.equal(custom.vars.PHOTO_STORAGE_GLOBAL_LIMIT_BYTES,'7000000000');assert.equal(custom.vars.PHOTO_STORAGE_USER_LIMIT_BYTES,'50000000');
    const zero=await generate('staging',{PHOTO_STORAGE_GLOBAL_LIMIT_BYTES:'0'});assert.equal(zero.vars.PHOTO_STORAGE_GLOBAL_LIMIT_BYTES,'0');
    for(const key of ['PHOTO_STORAGE_GLOBAL_LIMIT_BYTES','PHOTO_STORAGE_USER_LIMIT_BYTES'])for(const value of ['-1','1.5','1e9',' 4 ','NaN','Infinity','9007199254740992']) {
      await assert.rejects(generate('staging',{[key]:value}),new RegExp('Invalid '+key));
    }
  }finally{await rm(dir,{recursive:true,force:true})}
});
