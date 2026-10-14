import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as jose from 'jose';
import * as valibot from 'valibot';
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(await readFile('drizzle/'+f,'utf8'));
const db={prepare(query){let args=[];const s={bind(...v){args=v;return s},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}};return s},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}};
const {privateKey,publicKey}=await jose.generateKeyPair('RS256');
const jwk=await jose.exportJWK(publicKey);jwk.kid='test';jwk.alg='RS256';
const localKeys=jose.createLocalJWKSet({keys:[jwk]});
let incoming=new Headers(),idToken='',exchangeRequests=0,failExchange=false;
const env={DB:db,APP_ORIGIN:'https://test.example',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret'};
const objects=new Map();env.BUCKET={async list(){return {objects:[...objects].map(([key,b])=>({key,size:b.length})),truncated:false}},async head(k){return objects.has(k)?{size:objects.get(k).length}:null},async put(k,b){objects.set(k,new Uint8Array(b))},async get(k){return objects.has(k)?{body:objects.get(k)}:null},async delete(keys){for(const k of Array.isArray(keys)?keys:[keys])objects.delete(k)}};
const context=vm.createContext({console,Response,Request,Headers,URL,URLSearchParams,File,FormData,crypto,Uint8Array,TextEncoder,AbortSignal,btoa,fetch:async(url,init)=>{assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(init.method,'POST');assert.ok(init.body.get('code_verifier'));exchangeRequests++;return Response.json(failExchange?{error:'invalid_grant'}:{id_token:idToken},{status:failExchange?400:200})}});
const modules=new Map();
function synthetic(id,exports){const m=new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v)},{context,identifier:id});modules.set(id,m);}
synthetic('valibot',valibot);
synthetic('next/headers',{headers:async()=>incoming});synthetic('cloudflare:workers',{env});synthetic('jose',{...jose,createRemoteJWKSet:()=>localKeys});
async function load(file){
 if(modules.has(file))return modules.get(file);
 const pending=(async()=>{const code=ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return new vm.SourceTextModule(code,{context,identifier:file})})();
 modules.set(file,pending);return pending;
}
async function module(path){const m=await load(resolve(path));if(m.status==='unlinked')await m.link((spec,ref)=>modules.get(spec)||load(resolve(dirname(ref.identifier),spec+'.ts')));if(m.status==='linked')await m.evaluate();return m.namespace;}
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
for(const [mod,method,path] of [[catches,'POST','/api/catches'],[entry,'PUT','/api/catches/1'],[entry,'DELETE','/api/catches/1'],[likes,'PUT','/api/catches/1/like'],[profile,'GET','/api/profile'],[publicProfile,'GET','/api/profiles/owner'],[photoPost,'POST','/api/catches/1/photos'],[photoDelete,'DELETE','/api/catches/1/photos/1']])assert.equal((await mod[method](request(path,method,method==='POST'?valid:undefined),params('1'))).status,401);
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
// Invalid direct POST/PUT requests must leave stored catches, fish and photos unchanged.
const badInputs = [
 {...valid,date:'2026-02-30'}, {...valid,date:'2026-9-01'}, {...valid,date:''},
 {...valid,location:'   '}, {...valid,location:'海'.repeat(121)}, {...valid,species:' '}, {...valid,species:'魚'.repeat(81)},
 ...['',null,0,-1,1.5,10000,'abc'].map(count=>({...valid,count})),
 ...[-1,1000,'abc','Infinity'].map(length=>({...valid,length})),
 {...valid,method:'竿'.repeat(201)}, {...valid,memo:'海'.repeat(2001)},
 {...valid,fish:[]}, {...valid,fish:Array.from({length:21},(_,i)=>({species:String(i),count:1}))},
 {...valid,fish:[{species:'アジ',count:1},{species:' アジ ',count:2}]},
];
for(const input of badInputs){
 const before=sql.prepare('SELECT COUNT(*) n FROM catches').get().n;
 assert.equal((await catches.POST(request('/api/catches','POST',input,owner))).status,400);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM catches').get().n,before);
}
const record=await catches.POST(request('/api/catches','POST',valid,owner));assert.equal(record.status,201);const {id}=await record.json();
for(const input of badInputs){
 const before=JSON.stringify({catches:sql.prepare('SELECT * FROM catches').all(),fish:sql.prepare('SELECT * FROM catch_fish').all()});
 assert.equal((await entry.PUT(request('/api/catches/'+id,'PUT',input,owner),params(id))).status,400);
 assert.equal(JSON.stringify({catches:sql.prepare('SELECT * FROM catches').all(),fish:sql.prepare('SELECT * FROM catch_fish').all()}),before);
}
assert.equal((await entry.PUT(request('/api/catches/'+id,'PUT',{...valid,count:'3',length:0,location:' 海岸 '},owner),params(id))).status,200);
assert.equal(sql.prepare('SELECT length FROM catches WHERE id=?').get(id).length,0);
assert.equal((await photoPost.POST(request(`/api/catches/${id}/photos`,'POST',undefined,other),params(id))).status,403);
const form=new FormData();form.append('photo',new File([new Uint8Array([255,216,255,224])],'test.jpg',{type:'image/jpeg'}));
form.append('species','シロギス');form.append('featured','true');
const uploaded=await photoPost.POST(new Request(env.APP_ORIGIN+`/api/catches/${id}/photos`,{method:'POST',headers:{Origin:env.APP_ORIGIN,Cookie:owner},body:form}),params(id));assert.equal(uploaded.status,201);
const photoId=(await uploaded.json()).id;
assert.equal(sql.prepare('SELECT featured_photo_id FROM catches WHERE id=?').get(id).featured_photo_id,photoId);
const image=await photoGet.GET(request('/api/photos/'+photoId,'GET',undefined,other),params(photoId));assert.equal(image.status,200);assert.match(image.headers.get('cache-control'),/private, no-store/);
assert.equal((await photoGet.GET(request('/api/photos/'+photoId),params(photoId))).status,404);
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
// Map privacy and immutable trip snapshots are exercised against real SQLite migrations.
const spotsApi=await module('app/api/spots/route.ts'),spotApi=await module('app/api/spots/[id]/route.ts');
assert.equal((await spotsApi.GET(request('/api/spots'))).status,401);
const point={latitude:35.123,longitude:139.456,source:'gps'};
const mapped=await catches.POST(request('/api/catches','POST',{...multi,position:point},owner));assert.equal(mapped.status,201);const mappedId=(await mapped.json()).id;
const ownerRows=await (await catches.GET(request('/api/catches','GET',undefined,owner))).json();
const savedPosition=ownerRows.find(x=>x.id===mappedId).position,spotId=savedPosition.spotId;
assert.equal(savedPosition.latitude,point.latitude);
const otherRows=await (await catches.GET(request('/api/catches','GET',undefined,other))).json();assert.equal(otherRows.find(x=>x.id===mappedId).position,null);
assert.equal((await (await spotsApi.GET(request('/api/spots','GET',undefined,other))).json()).length,0);
const savedSpot=(await (await spotsApi.GET(request('/api/spots','GET',undefined,owner))).json()).find(s=>s.id===spotId);
assert.equal((await spotApi.PUT(request('/api/spots/'+spotId,'PUT',{...savedSpot,name:'移動後',latitude:36,favorite:true},other),params(spotId))).status,404);
assert.equal((await spotApi.PUT(request('/api/spots/'+spotId,'PUT',{...savedSpot,favorite:true},owner,'https://evil.example'),params(spotId))).status,403);
assert.equal((await spotApi.PUT(request('/api/spots/'+spotId,'PUT',{...savedSpot,name:'移動後',latitude:36,favorite:true},owner),params(spotId))).status,200);
assert.equal(sql.prepare('SELECT latitude FROM catch_positions WHERE catch_id=?').get(mappedId).latitude,point.latitude);
assert.equal(sql.prepare('SELECT location FROM catches WHERE id=?').get(mappedId).location,multi.location);
const reused=await catches.POST(request('/api/catches','POST',{...multi,location:'移動後',position:{...point,latitude:36,spotId,source:'saved'}},owner));assert.equal(reused.status,201);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM fishing_spots').get().n,1);
for(const bad of [{...point,latitude:91},{...point,longitude:-181},{...point,latitude:'35'}, {...point,latitude:null},{...point,source:'bad'},{...point,spotId:0},{}])assert.equal((await catches.POST(request('/api/catches','POST',{...multi,position:bad},owner))).status,400);
assert.equal((await catches.POST(request('/api/catches','POST',{...multi,position:{...point,spotId}},other))).status,403);
assert.equal((await entry.PUT(request('/api/catches/'+mappedId,'PUT',{...multi,photoAssignments:[],featuredPhotoId:null},owner),params(mappedId))).status,200);
assert.equal(sql.prepare('SELECT latitude FROM catch_positions WHERE catch_id=?').get(mappedId).latitude,point.latitude,'Older client edits preserve positions');
assert.equal((await entry.PUT(request('/api/catches/'+mappedId,'PUT',{...multi,position:null,photoAssignments:[],featuredPhotoId:null},owner),params(mappedId))).status,200);
assert.equal(sql.prepare('SELECT * FROM catch_positions WHERE catch_id=?').get(mappedId),undefined);
// Issue #31: check real API responses for every viewer/visibility combination.
const privacyRows=async session=>(await (await catches.GET(request('/api/catches','GET',undefined,session))).json());
const privacyCreate=await catches.POST(request('/api/catches','POST',{...multi,position:point},owner));
assert.equal(privacyCreate.status,201);const privacyId=(await privacyCreate.json()).id;
const privacyRow=async session=>(await privacyRows(session)).find(x=>x.id===privacyId);
assert.equal((await privacyRow(owner)).locationVisibility,'area','Default is approximate area');
const initialArea=(await privacyRow(other)).publicArea;
assert.deepEqual(JSON.parse(JSON.stringify(initialArea)),{latitude:35.15,longitude:139.45,radius:8000});
assert.equal((await privacyRow(other)).position,null);
assert.ok(!JSON.stringify(await privacyRow(other)).includes('35.123'),'No exact latitude anywhere in the response');
assert.ok(!JSON.stringify(await privacyRow(other)).includes('139.456'),'No exact longitude anywhere in the response');
assert.ok(!Object.hasOwn(await privacyRow(other),'public_latitude'),'Internal columns are not sent');
assert.deepEqual(JSON.parse(JSON.stringify((await privacyRow(other)).publicArea)),JSON.parse(JSON.stringify(initialArea)),'Repeated visits return the same coarse center');
for(const visibility of ['area','exact','private']) {
 const update={...multi,locationVisibility:visibility,photoAssignments:[],featuredPhotoId:null};
 assert.equal((await entry.PUT(request('/api/catches/'+privacyId,'PUT',update,owner),params(privacyId))).status,200);
 const self=await privacyRow(owner),guest=await privacyRow(other);
 assert.equal(self.position.latitude,point.latitude);assert.equal(self.location,multi.location);
 assert.equal(guest.locationVisibility,visibility);
 if(visibility==='exact') {
  assert.equal(guest.position.latitude,point.latitude);assert.equal(guest.position.longitude,point.longitude);
  assert.ok(!Object.hasOwn(guest.position,'spotId'),'Private saved spot IDs never leak');
  assert.equal(guest.publicArea,null);assert.equal(guest.locationHidden,false);
 } else {
  assert.equal(guest.position,null);
  assert.ok(!JSON.stringify(guest).includes('35.123'));assert.ok(!JSON.stringify(guest).includes('139.456'));
  if(visibility==='private'){assert.equal(guest.location,'');assert.equal(guest.locationHidden,true);assert.equal(guest.publicArea,null)}
  else {assert.equal(guest.location,multi.location);assert.ok(guest.publicArea);assert.equal(guest.locationHidden,false)}
 }
}
// Older clients preserve private visibility, including when replacing a position.
assert.equal((await entry.PUT(request('/api/catches/'+privacyId,'PUT',{...multi,position:{...point,latitude:36.123},photoAssignments:[],featuredPhotoId:null},owner),params(privacyId))).status,200);
assert.equal((await privacyRow(other)).locationHidden,true);assert.equal((await privacyRow(owner)).position.latitude,36.123);
for(const invalid of ['',null,'public',1,{},[]]) {
 const before=JSON.stringify(sql.prepare('SELECT * FROM catches WHERE id=?').get(privacyId));
 assert.equal((await catches.POST(request('/api/catches','POST',{...multi,locationVisibility:invalid},owner))).status,400);
 assert.equal((await entry.PUT(request('/api/catches/'+privacyId,'PUT',{...multi,locationVisibility:invalid},owner),params(privacyId))).status,400);
 assert.equal(JSON.stringify(sql.prepare('SELECT * FROM catches WHERE id=?').get(privacyId)),before);
}
assert.equal((await entry.PUT(request('/api/catches/'+privacyId,'PUT',{...multi,locationVisibility:'exact'},other),params(privacyId))).status,403);
// A legacy snapshot has no published area until the owner explicitly saves it.
sql.prepare("UPDATE catches SET location_visibility='area',public_latitude=NULL,public_longitude=NULL WHERE id=?").run(privacyId);
assert.equal((await privacyRow(other)).position,null);assert.equal((await privacyRow(other)).publicArea,null);assert.equal((await privacyRow(other)).location,multi.location);
assert.equal((await entry.PUT(request('/api/catches/'+privacyId,'PUT',{...multi,photoAssignments:[],featuredPhotoId:null},owner),params(privacyId))).status,200);
assert.equal((await privacyRow(other)).publicArea,null,'Older edits do not publish legacy coordinates');
assert.equal((await entry.PUT(request('/api/catches/'+privacyId,'PUT',{...multi,locationVisibility:'area',position:null,photoAssignments:[],featuredPhotoId:null},owner),params(privacyId))).status,200);
assert.equal((await privacyRow(other)).publicArea,null);assert.equal((await privacyRow(owner)).position,null);
const {approximateArea}=await module('app/location-privacy.ts');
for(const latitude of [-90,-89.999,-35.123,0,35.099999999999,35.1,89.999,90])for(const longitude of [-180,-179.999,-139.456,0,139.499999999,179.999,180]) {
 const area=approximateArea({latitude,longitude,source:'map'});
 assert.ok(Math.abs(area.latitude)<=90&&Math.abs(area.longitude)<=180);
 const rad=Math.PI/180,dlat=(latitude-area.latitude)*rad,dlon=(longitude-area.longitude)*rad;
 const a=Math.sin(dlat/2)**2+Math.cos(latitude*rad)*Math.cos(area.latitude*rad)*Math.sin(dlon/2)**2;
 assert.ok(6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))<=area.radius,'The circle contains every point in its cell');
}
console.log('Location privacy passed: three scopes, both identities, defaults, stable coarse areas, boundary coverage, raw-response secrecy, invalid input and legacy compatibility.');
const reusedId=(await reused.json()).id;assert.equal((await entry.DELETE(request('/api/catches/'+reusedId,'DELETE',undefined,owner),params(reusedId))).status,200);
assert.equal(sql.prepare('SELECT * FROM catch_positions WHERE catch_id=?').get(reusedId),undefined);
console.log('Fishing map API passed: private coordinates/spots, CSRF, ownership, coordinate validation, reuse, favorites, immutable snapshots, legacy edits, clear and delete.');
// Guests see only explicitly published posts, even when calling the APIs directly.
const guestList=async()=>{
 const response=await catches.GET(request('/api/catches'));
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);
 assert.match(response.headers.get('vary'),/Cookie/);return response.json();
};
assert.deepEqual(await guestList(),[],'Existing and default posts stay login-only');
assert.equal(sql.prepare('SELECT guest_public FROM catches WHERE id=?').get(id).guest_public,0);
assert.equal((await entry.GET(request('/api/catches/'+id),params(id))).status,404);
assert.equal((await entry.GET(request('/api/catches/'+id,'GET',undefined,other),params(id))).status,200);
const aggregate=await module('app/discovery.ts');
const publishedIds=[];
for(const visibility of ['area','exact','private']) {
 const body={...multi,date:aggregate.japanDate(new Date()),location:'ゲスト公開の場所-'+visibility,memo:'公開のメモ-'+visibility,position:point,locationVisibility:visibility,guestPublic:true};
 const made=await catches.POST(request('/api/catches','POST',body,owner));assert.equal(made.status,201);
 const publicId=(await made.json()).id;publishedIds.push(publicId);
 const data=new FormData();data.append('photo',new File([new Uint8Array([255,216,255,224])],'guest.jpg',{type:'image/jpeg'}));data.append('species','アジ');data.append('featured','true');
 const upload=await photoPost.POST(new Request(env.APP_ORIGIN+`/api/catches/${publicId}/photos`,{method:'POST',headers:{Origin:env.APP_ORIGIN,Cookie:owner},body:data}),params(publicId));assert.equal(upload.status,201);
 const imageId=(await upload.json()).id;
 const detailed=await entry.GET(request('/api/catches/'+publicId),params(publicId));assert.equal(detailed.status,200);
 const row=(await guestList()).find(x=>x.id===publicId);assert.deepEqual(await detailed.json(),row);
 assert.equal(row.guestPublic,true);assert.equal(row.liked,false);assert.equal(row.photos[0].id,imageId);
 for(const internal of ['owner_id','photos_deleting','spotId','guest_public','public_latitude','public_longitude','location_visibility'])assert.ok(!JSON.stringify(row).includes('"'+internal+'"'),'No internal fields in guest DTO');
 if(visibility==='exact'){assert.deepEqual(row.position,{latitude:point.latitude,longitude:point.longitude,source:'map'});assert.equal(row.publicArea,null)}
 else{assert.equal(row.position,null);assert.ok(!JSON.stringify(row).includes(String(point.latitude)));assert.ok(!JSON.stringify(row).includes(String(point.longitude)))}
 if(visibility==='private'){assert.equal(row.location,'');assert.equal(row.locationHidden,true);assert.equal(row.publicArea,null);assert.ok(!JSON.stringify(row).includes(body.location))}
 else{assert.equal(row.location,body.location);assert.equal(row.locationHidden,false);if(visibility==='area')assert.equal(row.publicArea.radius,8000)}
 const photo=await photoGet.GET(request('/api/photos/'+imageId),params(imageId));assert.equal(photo.status,200);assert.match(photo.headers.get('cache-control'),/no-store/);
 // All write routes still reject guests and leave stored rows/objects unchanged.
 const before=JSON.stringify({rows:sql.prepare('SELECT * FROM catches').all(),photos:sql.prepare('SELECT * FROM catch_photos').all(),likes:sql.prepare('SELECT * FROM catch_likes').all(),objects:[...objects.keys()]});
 for(const [mod,method,path,target] of [[catches,'POST','/api/catches',publicId],[entry,'PUT',`/api/catches/${publicId}`,publicId],[entry,'DELETE',`/api/catches/${publicId}`,publicId],[likes,'PUT',`/api/catches/${publicId}/like`,publicId],[likes,'DELETE',`/api/catches/${publicId}/like`,publicId],[photoPost,'POST',`/api/catches/${publicId}/photos`,publicId],[photoDelete,'DELETE',`/api/catches/${publicId}/photos/${imageId}`,imageId],[profile,'PUT','/api/profile',publicId],[spotApi,'PUT','/api/spots/1',1]])assert.equal((await mod[method](request(path,method,body),params(target))).status,401);
 assert.equal(JSON.stringify({rows:sql.prepare('SELECT * FROM catches').all(),photos:sql.prepare('SELECT * FROM catch_photos').all(),likes:sql.prepare('SELECT * FROM catch_likes').all(),objects:[...objects.keys()]}),before);
 // Legacy edits preserve the opt-in; explicit revocation immediately closes list/detail/photo access.
 const edit={...body,photoAssignments:[{photoId:imageId,species:'アジ'}],featuredPhotoId:imageId};delete edit.guestPublic;
 assert.equal((await entry.PUT(request('/api/catches/'+publicId,'PUT',edit,owner),params(publicId))).status,200);
 assert.equal((await guestList()).find(x=>x.id===publicId).guestPublic,true);
 assert.equal((await entry.PUT(request('/api/catches/'+publicId,'PUT',{...edit,guestPublic:false},other),params(publicId))).status,403);
 assert.equal((await entry.PUT(request('/api/catches/'+publicId,'PUT',{...edit,guestPublic:false},owner),params(publicId))).status,200);
 assert.ok(!(await guestList()).some(x=>x.id===publicId));
 assert.equal((await entry.GET(request('/api/catches/'+publicId),params(publicId))).status,404);
 assert.equal((await photoGet.GET(request('/api/photos/'+imageId),params(imageId))).status,404);
 assert.equal((await photoGet.GET(request('/api/photos/'+imageId,'GET',undefined,other),params(imageId))).status,200);
 assert.equal((await entry.PUT(request('/api/catches/'+publicId,'PUT',{...edit,guestPublic:true},owner),params(publicId))).status,200);
}
assert.deepEqual((await guestList()).map(x=>x.id).sort((a,b)=>a-b),publishedIds);
const trending=aggregate.aggregateDiscovery(await guestList(),7,new Date());
assert.equal(trending.fish.find(x=>x.species==='アジ').records,3);
assert.ok(trending.featured.every(x=>publishedIds.includes(x.id)));
for(const invalid of [null,0,1,'true','false',{},[]]) {
 const before=JSON.stringify(sql.prepare('SELECT * FROM catches').all());
 assert.equal((await catches.POST(request('/api/catches','POST',{...valid,guestPublic:invalid},owner))).status,400);
 assert.equal((await entry.PUT(request('/api/catches/'+id,'PUT',{...valid,guestPublic:invalid},owner),params(id))).status,400);
 assert.equal(JSON.stringify(sql.prepare('SELECT * FROM catches').all()),before);
}
const demo=await module('app/api/demo-data/route.ts');
assert.equal((await demo.POST(request('/api/demo-data','POST',{}))).status,401);
assert.equal((await publicProfile.GET(request('/api/profiles/google:owner'),params('google:owner'))).status,401);
assert.equal((await spotsApi.GET(request('/api/spots'))).status,401);
console.log('Guest access passed: opt-in defaults, list/detail/photo authorization, all location scopes, revocation, legacy edits, ranking isolation and unchanged write permissions.');
assert.equal((await logout.POST(request('/api/auth/logout','POST',undefined,owner,'https://evil.example'))).status,403);
assert.equal((await logout.POST(request('/api/auth/logout','POST',undefined,owner))).status,204);assert.equal(await auth.getUser(request('/api/catches','GET',undefined,owner)),null);assert.equal((await profile.GET(request('/api/profile','GET',undefined,owner))).status,401);assert.equal((await catches.GET(request('/api/catches','GET',undefined,owner))).status,200);
sql.prepare('UPDATE auth_sessions SET expires_at=0').run();assert.equal(await auth.getUser(request('/api/catches','GET',undefined,other)),null);assert.equal((await profile.GET(request('/api/profile','GET',undefined,other))).status,401);assert.equal((await catches.GET(request('/api/catches','GET',undefined,other))).status,200);
console.log('Cloudflare auth checks passed: JWT verification, state/nonce/PKCE, replay, expiry, header spoofing, sessions, logout, CSRF, two identities, ownership, profile preservation and idempotent likes.');
