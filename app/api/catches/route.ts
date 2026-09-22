import {getDb,parseCatch} from './db';
import {authenticate,ensureProfile,json,apiError} from '../access';
export async function GET(req:Request){try{
 const user=await authenticate(req),db=getDb();
 const r=await db.prepare(`SELECT c.*,p.display_name AS authorName,
 (SELECT COUNT(*) FROM catch_likes l WHERE l.catch_id=c.id) AS likeCount,
 EXISTS(SELECT 1 FROM catch_likes l WHERE l.catch_id=c.id AND l.user_id=?) AS liked
 FROM catches c JOIN profiles p ON p.user_id=c.owner_id ORDER BY c.date DESC,c.id DESC`).bind(user.userId).all();
 const photos=await db.prepare('SELECT id,catch_id FROM catch_photos ORDER BY id').all<{id:number,catch_id:number}>();
 return json(r.results.map(row=>({...row,liked:!!row.liked,photoIds:photos.results.filter(p=>p.catch_id===row.id).map(p=>p.id)})));
}catch(e){return apiError(e)}}
export async function POST(req:Request){try{
 const user=await authenticate(req),v=parseCatch(await req.json());if(!v)return json({error:'入力内容を確認してください。'},400);
 await ensureProfile(user);
 const r=await getDb().prepare('INSERT INTO catches (date,location,species,count,length,method,memo,created_at,owner_id) VALUES (?,?,?,?,?,?,?,?,?)').bind(v.date,v.location,v.species,v.count,v.length,v.method,v.memo,new Date().toISOString(),user.userId).run();
 return json({id:r.meta.last_row_id},201);
}catch(e){return apiError(e)}}
