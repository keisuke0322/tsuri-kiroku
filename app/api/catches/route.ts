import {getDb,parseCatch} from './db';
import {authenticate,ensureProfile,json,apiError} from '../access';
export async function GET(req:Request){try{
 const user=await authenticate(req),db=getDb();
 const r=await db.prepare(`SELECT c.*,p.display_name AS authorName,
 (SELECT COUNT(*) FROM catch_likes l WHERE l.catch_id=c.id) AS likeCount,
 EXISTS(SELECT 1 FROM catch_likes l WHERE l.catch_id=c.id AND l.user_id=?) AS liked
 FROM catches c JOIN profiles p ON p.user_id=c.owner_id ORDER BY c.date DESC,c.id DESC`).bind(user.userId).all();
 const fish=await db.prepare('SELECT id,catch_id,species,count,length,sort_order FROM catch_fish ORDER BY catch_id,sort_order,id').all<{id:number,catch_id:number,species:string,count:number,length:number|null,sort_order:number}>();
 const photos=await db.prepare('SELECT id,catch_id,species FROM catch_photos ORDER BY id').all<{id:number,catch_id:number,species:string|null}>();
 return json(r.results.map(row=>{const rows=fish.results.filter(f=>f.catch_id===row.id),fallback=[{id:0,catch_id:Number(row.id),species:String(row.species),count:Number(row.count),length:row.length==null?null:Number(row.length),sort_order:0}],catchFish=rows.length?rows:fallback,catchPhotos=photos.results.filter(p=>p.catch_id===row.id).map(p=>({id:p.id,species:p.species||catchFish[0].species}));return {...row,liked:!!row.liked,fish:catchFish.map(({id,species,count,length})=>({id,species,count,length})),photos:catchPhotos,photoIds:catchPhotos.map(p=>p.id)}}));
}catch(e){return apiError(e)}}
export async function POST(req:Request){try{
 const user=await authenticate(req),v=parseCatch(await req.json());if(!v)return json({error:'入力内容を確認してください。'},400);
 await ensureProfile(user);
 const db=getDb(),first=v.fish[0],r=await db.prepare('INSERT INTO catches (date,location,species,count,length,method,memo,created_at,owner_id) VALUES (?,?,?,?,?,?,?,?,?)').bind(v.date,v.location,first.species,first.count,first.length,v.method,v.memo,new Date().toISOString(),user.userId).run(),id=Number(r.meta.last_row_id);
 await db.batch(v.fish.map((fish,index)=>db.prepare('INSERT INTO catch_fish (catch_id,species,count,length,sort_order) VALUES (?,?,?,?,?)').bind(id,fish.species,fish.count,fish.length,index)));
 return json({id},201);
}catch(e){return apiError(e)}}
