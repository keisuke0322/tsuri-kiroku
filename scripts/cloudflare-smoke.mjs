import assert from 'node:assert/strict';
const origin=process.env.APP_ORIGIN;
assert.ok(origin?.startsWith('https://'));
const page=await fetch(origin,{redirect:'error',signal:AbortSignal.timeout(20000)});
assert.equal(page.status,200);assert.match(await page.text(),/Googleでログイン/);
const guestPage=await fetch(origin+'/?guest=1',{redirect:'error',signal:AbortSignal.timeout(20000)});
assert.equal(guestPage.status,200);assert.match(await guestPage.text(),/釣果を探す/);
const list=await fetch(origin+'/api/catches',{redirect:'error',signal:AbortSignal.timeout(20000)});
assert.equal(list.status,200);assert.match(list.headers.get('cache-control')||'',/no-store/);
const records=await list.json();assert.ok(Array.isArray(records));
for(const row of records){assert.equal(row.guestPublic,true);assert.ok(!('owner_id' in row));if(row.locationVisibility!=='exact')assert.equal(row.position,null);if(row.locationVisibility==='private'){assert.equal(row.location,'');assert.equal(row.publicArea,null)}}
for(const path of ['/api/profile','/api/spots']){
 const response=await fetch(origin+path,{redirect:'error',signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,401,`${path} must reject unauthenticated access`);
 assert.match(response.headers.get('cache-control')||'',/no-store/);
}
console.log('Login page, guest publication and protected API checks passed.');
