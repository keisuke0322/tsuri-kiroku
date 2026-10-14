import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

export async function verifyDeployment(origin,{request=fetch,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=12,delay=5000}={}){
assert.ok(origin?.startsWith('https://'));
// Workers can briefly serve the previous version immediately after deployment.
// Wait for the new pages; authorization failures below always fail immediately.
for(let attempt=0;attempt<attempts;attempt++){
 try{
  const page=await request(origin,{redirect:'error',signal:AbortSignal.timeout(20000)});
  assert.equal(page.status,200);const html=await page.text();
  assert.ok(html.includes('Googleでログイン')&&html.includes('data-cy="guest-entry"'),'Guest entry is not yet available');
  const guestPage=await request(origin+'/?guest=1',{redirect:'error',signal:AbortSignal.timeout(20000)});
  assert.equal(guestPage.status,200);assert.ok((await guestPage.text()).includes('釣果を探す'),'Guest screen is not yet available');
  break;
 }catch(error){if(attempt===attempts-1)throw error;await pause(delay)}
}
const list=await request(origin+'/api/catches',{redirect:'error',signal:AbortSignal.timeout(20000)});
assert.equal(list.status,200);assert.match(list.headers.get('cache-control')||'',/no-store/);
const records=await list.json();assert.ok(Array.isArray(records));
for(const row of records){assert.equal(row.guestPublic,true);assert.ok(!('owner_id' in row));if(row.locationVisibility!=='exact')assert.equal(row.position,null);if(row.locationVisibility==='private'){assert.equal(row.location,'');assert.equal(row.publicArea,null)}}
for(const path of ['/api/profile','/api/spots']){
 const response=await request(origin+path,{redirect:'error',signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,401,`${path} must reject unauthenticated access`);
 assert.match(response.headers.get('cache-control')||'',/no-store/);
}
console.log('Login page, guest publication and protected API checks passed.');
}
if(process.argv[1]===fileURLToPath(import.meta.url))await verifyDeployment(process.env.APP_ORIGIN);
