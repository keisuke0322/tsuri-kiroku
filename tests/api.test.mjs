// Real route handlers and generated SQL, with dispatch identity and R2 simulated.
// Run: node --experimental-vm-modules tests/api.test.mjs
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const sqlite=new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
const migrations=(await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort();
for(const f of migrations.slice(0,2))sqlite.exec(await readFile('drizzle/'+f,'utf8'));
sqlite.exec("INSERT INTO catches (id,date,location,species,count,created_at) VALUES (77,'2026-09-13','保存済みの釣り場','キス',3,'unchanged'); INSERT INTO catch_photos(id,catch_id,object_key,content_type,created_at) VALUES (77,77,'preserved-photo','image/jpeg','unchanged')");
const before=sqlite.prepare('SELECT * FROM catches WHERE id=77').get(),photoBefore=sqlite.prepare('SELECT * FROM catch_photos WHERE id=77').get();
for(const f of migrations.slice(2))sqlite.exec(await readFile('drizzle/'+f,'utf8'));
const {owner_id,...after}=sqlite.prepare('SELECT * FROM catches WHERE id=77').get();
assert.deepEqual({...before},after);assert.equal(owner_id,null);assert.deepEqual(sqlite.prepare('SELECT * FROM catch_photos WHERE id=77').get(),photoBefore);
sqlite.exec("DELETE FROM catches WHERE id=77; DELETE FROM sqlite_sequence WHERE name IN ('catches','catch_photos')");
let identity=new Headers();
const objects=new Map();
const db={prepare(sql){let args=[];const statement={bind(...v){args=v;return statement},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){const result=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}},async execute(){return sql.trim().startsWith('SELECT')?{...await statement.all(),meta:{changes:0}}:statement.run()}};return statement},async batch(statements){sqlite.exec('BEGIN');try{const rows=[];for(const s of statements)rows.push(await s.execute());sqlite.exec('COMMIT');return rows}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const bucket={async put(key,bytes){objects.set(key,new Uint8Array(bytes))},async get(key){return objects.has(key)?{body:objects.get(key)}:null},async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])objects.delete(key)}};
const context=vm.createContext({console,Response,Request,Headers,File,URL,crypto,Uint8Array});
const modules=new Map();
function synthetic(id,exports){const m=new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v)},{context,identifier:id});modules.set(id,m);return m}
synthetic('next/headers',{headers:async()=>identity});
synthetic('next/navigation',{redirect:()=>{throw Error('Unexpected redirect')}});
synthetic('cloudflare:workers',{env:{DB:db,BUCKET:bucket}});
async function load(file){if(modules.has(file))return modules.get(file);const code=ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;const m=new vm.SourceTextModule(code,{context,identifier:file});modules.set(file,m);await m.link(async(spec,ref)=>modules.get(spec)||load(resolve(dirname(ref.identifier),spec+'.ts')));return m}
async function route(path){const m=await load(resolve('app/api/'+path+'/route.ts'));if(m.status==='linked')await m.evaluate();return m.namespace}
const catches=await route('catches'),entry=await route('catches/[id]'),profile=await route('profile'),publicProfile=await route('profiles/[userId]'),likes=await route('catches/[id]/like'),claim=await route('profile/claim-legacy'),photos=await route('catches/[id]/photos'),photoDelete=await route('catches/[id]/photos/[photoId]'),photoGet=await route('photos/[photoId]');
const url='https://tsuri-kiroku.keisuke0322.chatgpt.site';
function request(path,method='GET',body,origin=url){return new Request(url+'/api/'+path,{method,headers:{...(method!=='GET'?{Origin:origin}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})}
const params=(id='1',photoId='1',userId='owner')=>({params:Promise.resolve({id,photoId,userId})});
function user(id,email='someone@example.com',name=''){identity=new Headers({'oai-authenticated-user-id':id,'oai-authenticated-user-email':email,...(name?{'oai-authenticated-user-full-name':encodeURIComponent(name),'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'}:{})})}
let checks=0;
async function status(response,expected){const r=await response;assert.equal(r.status,expected);assert.match(r.headers.get('cache-control'),/no-store/);checks++;return r}
const valid={date:'2026-09-20',location:'海岸',species:'シロギス',count:2,length:15,method:'投げ釣り',memo:'晴れ'};
for(const [mod,method,path] of [[catches,'GET','catches'],[catches,'POST','catches'],[entry,'PUT','catches/1'],[entry,'DELETE','catches/1'],[profile,'GET','profile'],[profile,'PUT','profile'],[publicProfile,'GET','profiles/owner'],[likes,'PUT','catches/1/like'],[likes,'DELETE','catches/1/like'],[claim,'POST','profile/claim-legacy'],[photos,'POST','catches/1/photos'],[photoDelete,'DELETE','catches/1/photos/1'],[photoGet,'GET','photos/1']])await status(mod[method](request(path,method),params()),401);
user('first');await status(claim.POST(request('profile/claim-legacy','POST')),403);
const first=await (await status(profile.GET(request('profile')),200)).json();assert.equal(first.displayName,'釣り人');assert.ok(!('email' in first));
user('owner','keisuke0322@gmail.com','釣り好き');
await status(profile.PUT(request('profile','PUT',{displayName:' ',bio:''})),400);
await status(profile.PUT(request('profile','PUT',{displayName:'あ'.repeat(51),bio:''})),400);
await status(profile.PUT(request('profile','PUT',{displayName:'釣人',bio:'あ'.repeat(501)})),400);
await status(profile.PUT(request('profile','PUT',{displayName:'海の人',bio:'キス釣りが好き'})),200);
assert.equal((await (await profile.GET(request('profile'))).json()).displayName,'海の人');
sqlite.exec("INSERT INTO catches (date,location,species,count,created_at) VALUES ('2026-09-13','三浦','キス',1,'original')");
const migration=await (await status(claim.POST(request('profile/claim-legacy','POST')),200)).json();assert.equal(migration.ownerId,'owner');assert.equal(migration.migrated,1);assert.equal(migration.remaining,0);
assert.equal((await (await claim.POST(request('profile/claim-legacy','POST'))).json()).migrated,0);
await status(catches.POST(request('catches','POST',valid,'https://evil.example')),403);
await status(catches.POST(request('catches','POST',valid,'null')),403);
await status(catches.POST(new Request(url+'/api/catches',{method:'POST',body:JSON.stringify(valid)})),403);
await status(catches.POST(request('catches','POST',valid)),201);
user('other','other@example.com','別の人');
await status(entry.PUT(request('catches/1','PUT',valid),params()),403);
await status(entry.DELETE(request('catches/1','DELETE'),params()),403);
await status(photos.POST(request('catches/1/photos','POST'),params()),403);
await status(photoDelete.DELETE(request('catches/1/photos/1','DELETE'),params()),403);
await status(claim.POST(request('profile/claim-legacy','POST')),403);
for(let i=0;i<2;i++){const r=await (await status(likes.PUT(request('catches/1/like','PUT'),params()),200)).json();assert.equal(r.likeCount,1);assert.equal(r.liked,true)}
user('owner','keisuke0322@gmail.com');
assert.equal((await (await likes.PUT(request('catches/1/like','PUT'),params())).json()).likeCount,2);
for(let i=0;i<2;i++){const r=await (await status(likes.DELETE(request('catches/1/like','DELETE'),params()),200)).json();assert.equal(r.likeCount,1);assert.equal(r.liked,false)}
const listing=await (await status(catches.GET(request('catches')),200)).json();assert.equal(listing.length,2);assert.equal(listing.find(x=>x.id===1).likeCount,1);assert.equal(listing[0].authorName,'海の人');assert.ok(!JSON.stringify(listing).includes('@'));
const pub=await (await status(publicProfile.GET(request('profiles/owner'),params()),200)).json();assert.deepEqual(Object.keys(pub).sort(),['bio','displayName','userId']);
objects.set('photo',new Uint8Array([255,216,255]));sqlite.exec("INSERT INTO catch_photos(catch_id,object_key,content_type,created_at) VALUES (1,'photo','image/jpeg','original')");
await status(photoGet.GET(request('photos/1'),params()),200);
user('other');await status(photoGet.GET(request('photos/1'),params()),200);
identity=new Headers();await status(photoGet.GET(request('photos/1'),params()),401);
user('owner','keisuke0322@gmail.com');await status(entry.DELETE(request('catches/1','DELETE'),params()),200);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM catch_likes WHERE catch_id=1').get().n,0);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM catch_photos WHERE catch_id=1').get().n,0);assert.equal(objects.size,0);
await status(likes.PUT(request('catches/1/like','PUT'),params()),404);
await status(photoGet.GET(request('photos/1'),params()),404);
await status(entry.PUT(request('catches/2','PUT',{...valid,memo:'更新'}),params('2')),200);
assert.equal(sqlite.prepare('SELECT memo FROM catches WHERE id=2').get().memo,'更新');
sqlite.exec("DELETE FROM data_migrations WHERE name='owner-name-family-first'; UPDATE profiles SET display_name='圭介 高山' WHERE user_id='owner'");
await status(catches.GET(request('catches')),200);
assert.equal((await (await profile.GET(request('profile'))).json()).displayName,'高山 圭介');
const names=await (await catches.GET(request('catches'))).json();assert.equal(names[0].authorName,'高山 圭介');
await profile.PUT(request('profile','PUT',{displayName:'好きな表示名',bio:''}));
await catches.GET(request('catches'));
assert.equal((await (await profile.GET(request('profile'))).json()).displayName,'好きな表示名','A later manual edit must survive the one-time name correction');
console.log(`${checks} route checks passed: auth, CSRF, profiles, ownership, legacy migration, photos, idempotent likes, cascade cleanup.`);
