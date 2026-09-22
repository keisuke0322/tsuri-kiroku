import {authenticate,ensureProfile,json,apiError} from '../../access';
import {getDb} from '../../catches/db';
// One-time, authenticated migration. The account ID in Sites sharing metadata
// is NOT assumed to be the per-Site identity forwarded by the dispatcher.
export async function POST(req:Request){try{
 const user=await authenticate(req);
 if(user.email.toLowerCase()!=='keisuke0322@gmail.com')return json({error:'この操作はサイト所有者専用です。'},403);
 await ensureProfile(user);const db=getDb();
 const results=await db.batch([
  db.prepare("INSERT INTO data_migrations (name,owner_id) VALUES ('legacy-catches',?) ON CONFLICT(name) DO NOTHING").bind(user.userId),
  db.prepare("UPDATE catches SET owner_id=? WHERE owner_id IS NULL AND EXISTS(SELECT 1 FROM data_migrations WHERE name='legacy-catches' AND owner_id=?)").bind(user.userId,user.userId),
  db.prepare('SELECT COUNT(*) AS remaining FROM catches WHERE owner_id IS NULL')
 ]);
 return json({ownerId:user.userId,migrated:results[1].meta.changes,remaining:(results[2].results[0] as {remaining:number}).remaining});
}catch(e){return apiError(e)}}
