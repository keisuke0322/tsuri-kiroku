import assert from 'node:assert/strict';
const origin=process.env.APP_ORIGIN;
assert.ok(origin?.startsWith('https://'));
const page=await fetch(origin,{redirect:'error',signal:AbortSignal.timeout(20000)});
assert.equal(page.status,200);assert.match(await page.text(),/Googleでログイン/);
for(const path of ['/api/catches','/api/profile']){
 const response=await fetch(origin+path,{redirect:'error',signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,401,`${path} must reject unauthenticated access`);
 assert.match(response.headers.get('cache-control')||'',/no-store/);
}
console.log('Login page and API authentication checks passed.');
