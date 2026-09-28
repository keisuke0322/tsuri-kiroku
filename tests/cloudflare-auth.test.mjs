import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as jose from 'jose';
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(await readFile('drizzle/'+f,'utf8'));
const db={prepare(query){let args=[];const s={bind(...v){args=v;return s},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}};return s},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}};
const {privateKey,publicKey}=await jose.generateKeyPair('RS256');
const jwk=await jose.exportJWK(publicKey);jwk.kid='test';jwk.alg='RS256';
const localKeys=jose.createLocalJWKSet({keys:[jwk]});
let incoming=new Headers(),idToken='',exchangeRequests=0,failExchange=false;
const env={DB:db,APP_ORIGIN:'https://test.example',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret'};
const objects=new Map();env.BUCKET={async put(k,b){objects.set(k,new Uint8Array(b))},async get(k){return objects.has(k)?{body:objects.get(k)}:null},async delete(keys){for(const k of Array.isArray(keys)?keys:[keys])objects.delete(k)}};
const context=vm.createContext({console,Response,Request,Headers,URL,URLSearchParams,File,FormData,crypto,Uint8Array,TextEncoder,AbortSignal,btoa,fetch:async(url,init)=>{assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(init.method,'POST');assert.ok(init.body.get('code_verifier'));exchangeRequests++;return Response.json(failExchange?{error:'invalid_grant'}:{id_token:idToken},{status:failExchange?400:200})}});
const modules=new Map();
function synthetic(id,exports){const m=new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v)},{context,identifier:id});modules.set(id,m);}
synthetic('next/headers',{headers:async()=>incoming});synthetic('cloudflare:workers',{env});synthetic('jose',{...jose,createRemoteJWKSet:()=>localKeys});
async function load(file){if(modules.has(file))return modules.get(file);const code=ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;const m=new vm.SourceTextModule(code,{context,identifier:file});modules.set(file,m);await m.link((spec,ref)=>modules.get(spec)||load(resolve(dirname(ref.identifier),spec+'.ts')));return m;}
async function module(path){const m=await load(resolve(path));if(m.status==='linked')await m.evaluate();return m.namespace;}
const auth=await module('app/auth.ts'),start=await module('app/api/auth/google/route.ts'),callback=await module('app/api/auth/google/callback/route.ts'),logout=await module('app/api/auth/logout/route.ts');
const catches=await module('app/api/catches/route.ts'),entry=await module('app/api/catches/[id]/route.ts'),likes=await module('app/api/catches/[id]/like/route.ts'),profile=await module('app/api/profile/route.ts'),publicProfile=await module('app/api/profiles/[userId]/route.ts');
function request(path,method='GET',body,session='',origin=env.APP_ORIGIN){return new Request(env.APP_ORIGIN+path,{method,headers:{...(method!=='GET'?{Origin:origin}:{}),Cookie:session,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}
const params=id=>({params:Promise.resolve({id:String(id),photoId:String(id),userId:id})});
const photoGet=await module('app/api/photos/[photoId]/route.ts'),photoPost=await module('app/api/catches/[id]/photos/route.ts'),photoDelete=await module('app/api/catches/[id]/photos/[photoId]/route.ts');
const valid={date:'2026-09-27',location:'海岸',species:'シロギス',count:2};
async function sign(nonce,extra={}){return new jose.SignJWT({nonce,email_verified:true,family_name:'高山',given_name:'圭介',...extra}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://accounts.google.com').setAudience(env.GOOGLE_CLIENT_ID).setSubject(extra.sub||'owner').setIssuedAt().setExpirationTime('5m').sign(privateKey);}
async function begin(){const r=await start.GET(request('/api/auth/google'));assert.equal(r.status,302);assert.match(r.headers.get('set-cookie'),/HttpOnly; SameSite=Lax; Max-Age=600; Secure/);const u=new URL(r.headers.get('location'));assert.equal(u.searchParams.get('code_challenge_method'),'S256');return {u,c:r.headers.get('set-cookie').split(';')[0],state:u.searchParams.get('state'),nonce:u.searchParams.get('nonce')};}
async function finish(flow,token){idToken=token;return callback.GET(new Request(env.APP_ORIGIN+'/api/auth/google/callback?code=one-use&state='+flow.state,{headers:{Cookie:flow.c}}));}
async function login(sub='owner'){const f=await begin(),r=await finish(f,await sign(f.nonce,{sub}));assert.equal(r.headers.get('location'),env.APP_ORIGIN+'/');const c=r.headers.getSetCookie().find(v=>v.startsWith('__Host-tsuri_session='));assert.ok(c);return c.split(';')[0];}
// Spoofed Sites headers do not authenticate an independently hosted Worker.
incoming=new Headers({'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'});assert.equal(await auth.getUser(),null);
for(const [mod,method,path] of [[catches,'GET','/api/catches'],[catches,'POST','/api/catches'],[entry,'PUT','/api/catches/1'],[entry,'DELETE','/api/catches/1'],[likes,'PUT','/api/catches/1/like'],[profile,'GET','/api/profile'],[publicProfile,'GET','/api/profiles/owner'],[photoGet,'GET','/api/photos/1'],[photoPost,'POST','/api/catches/1/photos'],[photoDelete,'DELETE','/api/catches/1/photos/1']])assert.equal((await mod[method](request(path,method,method==='POST'?valid:undefined),params('1'))).status,401);
let f=await begin();let r=await callback.GET(request('/api/auth/google/callback?state='+f.state+'&code=x'));assert.equal(exchangeRequests,0);assert.match(r.headers.get('location'),/login_error/);
r=await finish(f,await sign('wrong-nonce'));assert.match(r.headers.get('location'),/login_error/);assert.equal(sql.prepare('SELECT COUNT(*) n FROM auth_sessions').get().n,0);
await finish(f,await sign(f.nonce));assert.equal(exchangeRequests,1,'State is single use');
f=await begin();sql.prepare('UPDATE oauth_transactions SET expires_at=0').run();r=await finish(f,await sign(f.nonce));assert.match(r.headers.get('location'),/login_error/);assert.equal(exchangeRequests,1);
for(const extra of [{email_verified:false}]){f=await begin();r=await finish(f,await sign(f.nonce,extra));assert.match(r.headers.get('location'),/login_error/);}
for(const token of [await new jose.SignJWT({nonce:'n',email_verified:true}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://evil.example').setAudience('test-client').setSubject('owner').setIssuedAt().setExpirationTime('5m').sign(privateKey),await new jose.SignJWT({nonce:'n',email_verified:true}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://accounts.google.com').setAudience('wrong-client').setSubject('owner').setIssuedAt().setExpirationTime('5m').sign(privateKey)])await assert.rejects(auth.verifyGoogleIdToken(token,'n'));
f=await begin();failExchange=true;r=await finish(f,'');failExchange=false;assert.match(r.headers.get('location'),/login_error/);
const owner=await login(),other=await login('other');
assert.equal(sql.prepare('SELECT display_name FROM profiles WHERE user_id=?').get('google:owner').display_name,'高山 圭介');
assert.ok(!sql.prepare('SELECT token_hash FROM auth_sessions WHERE token_hash=?').get(owner.split('=')[1]),'Only hash is persisted');
const expired=await new jose.SignJWT({nonce:'n',email_verified:true}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://accounts.google.com').setAudience('test-client').setSubject('owner').setIssuedAt(1).setExpirationTime(2).sign(privateKey);
await assert.rejects(auth.verifyGoogleIdToken(expired,'n'));
const forgedParts=(await sign('n')).split('.');forgedParts[2]=(forgedParts[2][0]==='A'?'B':'A')+forgedParts[2].slice(1);await assert.rejects(auth.verifyGoogleIdToken(forgedParts.join('.'),'n'));
const record=await catches.POST(request('/api/catches','POST',valid,owner));assert.equal(record.status,201);const {id}=await record.json();
assert.equal((await photoPost.POST(request(`/api/catches/${id}/photos`,'POST',undefined,other),params(id))).status,403);
const form=new FormData();form.append('photo',new File([new Uint8Array([255,216,255,224])],'test.jpg',{type:'image/jpeg'}));
form.append('species','シロギス');form.append('featured','true');
const uploaded=await photoPost.POST(new Request(env.APP_ORIGIN+`/api/catches/${id}/photos`,{method:'POST',headers:{Origin:env.APP_ORIGIN,Cookie:owner},body:form}),params(id));assert.equal(uploaded.status,201);
const photoId=(await uploaded.json()).id;
assert.equal(sql.prepare('SELECT featured_photo_id FROM catches WHERE id=?').get(id).featured_photo_id,photoId);
const image=await photoGet.GET(request('/api/photos/'+photoId,'GET',undefined,other),params(photoId));assert.equal(image.status,200);assert.match(image.headers.get('cache-control'),/private, no-store/);
assert.equal((await photoGet.GET(request('/api/photos/'+photoId),params(photoId))).status,401);
assert.equal((await photoDelete.DELETE(request(`/api/catches/${id}/photos/${photoId}`,'DELETE',undefined,other),{params:Promise.resolve({id:String(id),photoId:String(photoId)})})).status,403);
const multi={date:'2026-09-28',location:'港',fish:[{species:'アジ',count:3,length:18},{species:'サバ',count:2,length:24}],method:'サビキ',memo:''};
const multiCreated=await catches.POST(request('/api/catches','POST',multi,owner));assert.equal(multiCreated.status,201);const multiId=(await multiCreated.json()).id;
const listed=await (await catches.GET(request('/api/catches','GET',undefined,owner))).json(),multiRow=listed.find(x=>x.id===multiId);assert.deepEqual(multiRow.fish.map(x=>[x.species,x.count]),[['アジ',3],['サバ',2]]);
async function uploadFishPhoto(species,featured=false){const data=new FormData();data.append('photo',new File([new Uint8Array([255,216,255,224])],species+'.jpg',{type:'image/jpeg'}));data.append('species',species);data.append('featured',String(featured));return photoPost.POST(new Request(env.APP_ORIGIN+`/api/catches/${multiId}/photos`,{method:'POST',headers:{Origin:env.APP_ORIGIN,Cookie:owner},body:data}),params(multiId))}
const ajiPhoto=await (await uploadFishPhoto('アジ')).json(),sabaPhoto=await (await uploadFishPhoto('サバ',true)).json();assert.equal(sql.prepare('SELECT featured_photo_id FROM catches WHERE id=?').get(multiId).featured_photo_id,sabaPhoto.id);
const changed={...multi,photoAssignments:[{photoId:ajiPhoto.id,species:'サバ'},{photoId:sabaPhoto.id,species:'アジ'}],featuredPhotoId:ajiPhoto.id};assert.equal((await entry.PUT(request('/api/catches/'+multiId,'PUT',changed,owner),params(multiId))).status,200);assert.equal(sql.prepare('SELECT featured_photo_id FROM catches WHERE id=?').get(multiId).featured_photo_id,ajiPhoto.id);assert.equal(sql.prepare('SELECT species FROM catch_photos WHERE id=?').get(ajiPhoto.id).species,'サバ');
for(const method of ['PUT','DELETE'])assert.equal((await entry[method](request('/api/catches/'+id,method,method==='PUT'?valid:undefined,other),params(id))).status,403);
assert.equal((await catches.POST(request('/api/catches','POST',valid,owner,'https://evil.example'))).status,403);
for(let i=0;i<2;i++)assert.equal((await likes.PUT(request(`/api/catches/${id}/like`,'PUT',undefined,other),params(id))).status,200);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM catch_likes').get().n,1);
for(let i=0;i<2;i++)await likes.DELETE(request(`/api/catches/${id}/like`,'DELETE',undefined,other),params(id));
assert.equal(sql.prepare('SELECT COUNT(*) n FROM catch_likes').get().n,0);
await profile.PUT(request('/api/profile','PUT',{displayName:'釣り好き',bio:'海'},owner));await login();assert.equal(sql.prepare('SELECT display_name FROM profiles WHERE user_id=?').get('google:owner').display_name,'釣り好き');
const publicData=await (await publicProfile.GET(request('/api/profiles/google:owner','GET',undefined,other),params('google:owner'))).json();assert.ok(!('email' in publicData));
assert.equal((await logout.POST(request('/api/auth/logout','POST',undefined,owner,'https://evil.example'))).status,403);
assert.equal((await logout.POST(request('/api/auth/logout','POST',undefined,owner))).status,204);assert.equal((await catches.GET(request('/api/catches','GET',undefined,owner))).status,401);
sql.prepare('UPDATE auth_sessions SET expires_at=0').run();assert.equal((await catches.GET(request('/api/catches','GET',undefined,other))).status,401);
console.log('Cloudflare auth checks passed: JWT verification, state/nonce/PKCE, replay, expiry, header spoofing, sessions, logout, CSRF, two identities, ownership, profile preservation and idempotent likes.');
