import {authenticate,apiError,ApiError,json} from '../access';
import {getDb} from '../catches/db';
const batchName='demo-catches-20260923';
const owners=['demo-20260923-umi','demo-20260923-nagi','demo-20260923-sora'];
const selection=`owner_id IN (${owners.map(()=>'?').join(',')})`;
export async function canManageDemo(userId:string){return !!await getDb().prepare("SELECT name FROM data_migrations WHERE name='legacy-catches' AND owner_id=?").bind(userId).first()}
async function check(req:Request){const user=await authenticate(req);if(!await canManageDemo(user.userId))throw new ApiError(403,'サイト所有者だけが操作できます。');return user}
async function summary(){const db=getDb();return {count:(await db.prepare(`SELECT COUNT(*) AS count FROM catches WHERE ${selection}`).bind(...owners).first<{count:number}>())!.count,initialized:!!await db.prepare('SELECT name FROM data_migrations WHERE name=?').bind(batchName).first()}}
export async function GET(req:Request){try{await check(req);return json(await summary())}catch(e){return apiError(e)}}
export async function POST(req:Request){try{
 const user=await check(req),db=getDb();
 const now=new Date(),today=new Date(now.getTime()+9*3600000).toISOString().slice(0,10);
 const samples:[number,string,number,string,number][]=[
  [0,'シロギス',8,'三浦海岸',3],[1,'アジ',15,'横浜の堤防',2],[2,'シロギス',5,'館山の砂浜',1],
  [3,'サバ',6,'横須賀の堤防',3],[4,'シロギス',10,'湘南の砂浜',0],[5,'アジ',12,'木更津の堤防',2],
  [6,'メバル',2,'横浜の堤防',1],[8,'アジ',7,'三崎の堤防',3],[12,'カサゴ',3,'横須賀の堤防',0],
  [18,'サバ',9,'木更津の堤防',2],[25,'シロギス',4,'館山の砂浜',1],[35,'メバル',1,'三崎の堤防',0]
 ];
 const statements=owners.map((id,i)=>db.prepare(`INSERT INTO profiles(user_id,display_name,bio) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM data_migrations WHERE name=?) ON CONFLICT(user_id) DO NOTHING`).bind(id,['海辺の釣り人（デモ）','なぎさ（デモ）','そら（デモ）'][i],'表示確認用の架空のプロフィールです。釣果・場所・いいねはすべてダミーデータです。',batchName));
 samples.forEach(([days,species,count,location,likes],i)=>{
  const date=new Date(Date.parse(today+'T00:00:00Z')-days*86400000).toISOString().slice(0,10);
  const posted=new Date(now.getTime()-days*86400000).toISOString();
  statements.push(db.prepare(`INSERT INTO catches(date,location,species,count,length,method,memo,created_at,owner_id) SELECT ?,?,?,?,NULL,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM data_migrations WHERE name=?)`).bind(date,location,species,count,species==='シロギス'?'ちょい投げ':'堤防釣り','【ダミーデータ】表示確認用の架空の釣果です。実際の釣況ではありません。',posted,owners[i%3],batchName));
  for(let j=0;j<likes;j++)statements.push(db.prepare(`INSERT INTO catch_likes(catch_id,user_id) SELECT id,? FROM catches WHERE created_at=? AND owner_id=? AND NOT EXISTS(SELECT 1 FROM data_migrations WHERE name=?) ON CONFLICT DO NOTHING`).bind(owners[j],posted,owners[i%3],batchName));
 });
 statements.push(db.prepare('INSERT INTO data_migrations(name,owner_id) VALUES (?,?) ON CONFLICT(name) DO NOTHING').bind(batchName,user.userId));
 await db.batch(statements);return json(await summary());
}catch(e){return apiError(e)}}
export async function DELETE(req:Request){try{
 const user=await check(req),db=getDb();
 // Exact dedicated demo identities: real user records are never selected.
 const result=await db.batch([
  db.prepare(`DELETE FROM catch_likes WHERE catch_id IN (SELECT id FROM catches WHERE ${selection})`).bind(...owners),
  db.prepare(`DELETE FROM catches WHERE ${selection}`).bind(...owners),
  ...owners.map(id=>db.prepare('DELETE FROM profiles WHERE user_id=? AND NOT EXISTS(SELECT 1 FROM catches WHERE owner_id=?) AND NOT EXISTS(SELECT 1 FROM catch_likes WHERE user_id=?)').bind(id,id,id)),
  db.prepare('INSERT INTO data_migrations(name,owner_id) VALUES (?,?) ON CONFLICT(name) DO NOTHING').bind(batchName,user.userId)
 ]);
 return json({deleted:result[1].meta.changes,...await summary()});
}catch(e){return apiError(e)}}
