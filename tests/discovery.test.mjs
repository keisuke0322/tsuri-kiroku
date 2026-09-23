import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
async function module(path){const code=ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))}
const {aggregateDiscovery,japanDate}=await module('app/discovery.ts');
const {updateLikeOptimistically}=await module('app/optimistic-like.ts');
const now=new Date('2026-09-23T15:00:00Z'); // Sep 24 midnight in Japan.
assert.equal(japanDate(now),'2026-09-24');
assert.equal(japanDate(new Date(now-1)),'2026-09-23');
const entry=(id,overrides={})=>({id,date:'2026-09-24',created_at:'2026-09-24T00:00:00+09:00',species:'アジ',count:1,likeCount:0,...overrides});
const edges=[entry(1,{date:'2026-09-18',created_at:'2026-09-17T15:00:00Z'}),entry(2,{date:'2026-09-17',created_at:'2026-09-17T14:59:59Z'}),entry(3,{date:'2026-09-25',created_at:'2026-09-24T00:00:01+09:00'}),entry(4,{date:'2026-08-26',created_at:'2026-08-25T15:00:00Z'}),entry(5,{date:'2026-08-25',created_at:'2026-08-25T14:59:59Z'})];
assert.equal(aggregateDiscovery(edges,7,now).fish[0].records,1);
assert.deepEqual(aggregateDiscovery(edges,7,now).featured.map(x=>x.id),[1]);
assert.equal(aggregateDiscovery(edges,30,now).fish[0].records,3);
assert.deepEqual(aggregateDiscovery(edges,30,now).featured.map(x=>x.id),[1,2,4]);
const rows=[entry(1,{count:3}),entry(2,{count:2}),entry(3,{species:'イワシ',count:20}),entry(4,{species:'カサゴ',count:6}),entry(5,{species:'カサゴ',count:4}),entry(6,{species:'イワシ',count:1}),entry(7,{species:'エソ',count:21}),entry(8,{species:'エソ',count:0})];
assert.deepEqual(aggregateDiscovery(rows,7,now).fish,[{species:'イワシ',records:2,fish:21},{species:'エソ',records:2,fish:21},{species:'カサゴ',records:2,fish:10}]);
const posts=[entry(1,{likeCount:2,created_at:'2026-09-20T00:00:00Z'}),entry(2,{likeCount:2,created_at:'2026-09-21T00:00:00Z'}),entry(3,{likeCount:5}),entry(4)];
assert.deepEqual(aggregateDiscovery(posts,7,now).featured.map(x=>x.id),[3,2,1]);
assert.equal(aggregateDiscovery(posts,7,now).hasLikes,true);
const zero=posts.map(x=>({...x,likeCount:0}));
assert.equal(aggregateDiscovery(zero,7,now).hasLikes,false);
assert.deepEqual(aggregateDiscovery(zero,7,now).featured.map(x=>x.id),[4,3,2]);
for(const n of [0,1,2])assert.equal(aggregateDiscovery(zero.slice(0,n),7,now).featured.length,n);
assert.deepEqual(aggregateDiscovery([],7,now).fish,[]);
// Fishing date and posting date deliberately use independent windows.
assert.equal(aggregateDiscovery([entry(9,{date:'2020-01-01'})],7,now).featured.length,1);
assert.equal(aggregateDiscovery([entry(9,{created_at:'2020-01-01T00:00:00Z'})],7,now).fish.length,1);
let items=zero, reject;
const update=updateLikeOptimistically({liked:false,likeCount:0},state=>{items=items.map(x=>x.id===1?{...x,...state}:x)},()=>new Promise((_,r)=>reject=r));
assert.equal(aggregateDiscovery(items,7,now).featured[0].id,1);
assert.equal(aggregateDiscovery(items,7,now).hasLikes,true);
reject(Error('offline'));await assert.rejects(update);
assert.equal(aggregateDiscovery(items,7,now).hasLikes,false);
assert.deepEqual(aggregateDiscovery(items,7,now).featured.map(x=>x.id),[4,3,2]);
console.log('Discovery passed: JST boundaries, periods, exclusions, counts, ties, top 3, empty/few, independent dates, optimistic ranking and rollback.');
