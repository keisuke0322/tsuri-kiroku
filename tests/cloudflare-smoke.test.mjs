import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyDeployment} from '../scripts/cloudflare-smoke.mjs';
const origin='https://test.example';
const headers={'Cache-Control':'private, no-store'};
function fixture({oldPages=0,neverReady=false,records=[],profileStatus=401}={}){
 let visits=0;const calls=[],pauses=[];
 return {calls,pauses,options:{attempts:3,delay:1,pause:async ms=>{pauses.push(ms)},request:async url=>{
  const path=new URL(url).pathname;calls.push(url);
  if(path==='/'){
   if(!url.includes('?')){visits++;return new Response('Googleでログイン <a data-cy="guest-entry">ゲストで見てみる</a>')}
   return new Response(neverReady||visits<=oldPages?'Googleでログイン':'釣果を探す');
  }
  if(path==='/api/catches')return Response.json(records,{headers});
  return Response.json({}, {status:path==='/api/profile'?profileStatus:401,headers});
 }}};
}
test('deployment waits for the guest screen while an old Worker version is still serving',async()=>{
 const f=fixture({oldPages:1});await verifyDeployment(origin,f.options);
 assert.equal(f.pauses.length,1);assert.equal(f.calls.filter(url=>url.includes('?guest=1')).length,2);
 assert.ok(f.calls.includes(origin+'/api/spots'));
});
test('a guest route that never becomes available fails after bounded retries',async()=>{
 const f=fixture({neverReady:true});await assert.rejects(verifyDeployment(origin,f.options),/Guest screen/);
 assert.equal(f.pauses.length,2);assert.ok(!f.calls.includes(origin+'/api/catches'));
});
test('readiness retries never mask a guest publication or protected API failure',async()=>{
 for(const config of [{records:[{guestPublic:false}]},{records:[{guestPublic:true,owner_id:'private-owner'}]},{records:[{guestPublic:true,locationVisibility:'area',position:{latitude:35,longitude:139}}]},{profileStatus:200}]){
  const f=fixture(config);await assert.rejects(verifyDeployment(origin,f.options));assert.equal(f.pauses.length,0);
 }
});
