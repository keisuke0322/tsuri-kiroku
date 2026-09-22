import {getDb,parseCatch} from '../db';
import {getBucket,validId} from '../photos';
import {authenticate,ownedCatch,json,apiError} from '../../access';
export async function PUT(req:Request,ctx:{params:Promise<{id:string}>}){try{
 const user=await authenticate(req),id=validId((await ctx.params).id);if(!id)return json({error:'記録が見つかりません。'},400);
 await ownedCatch(id,user.userId);const v=parseCatch(await req.json());if(!v)return json({error:'入力内容を確認してください。'},400);
 const r=await getDb().prepare('UPDATE catches SET date=?,location=?,species=?,count=?,length=?,method=?,memo=? WHERE id=? AND owner_id=?').bind(v.date,v.location,v.species,v.count,v.length,v.method,v.memo,id,user.userId).run();return json({ok:r.meta.changes>0});
}catch(e){return apiError(e)}}
export async function DELETE(req:Request,ctx:{params:Promise<{id:string}>}){try{
 const user=await authenticate(req),id=validId((await ctx.params).id);if(!id)return json({error:'記録が見つかりません。'},400);await ownedCatch(id,user.userId);
 const db=getDb(),photos=await db.prepare('SELECT object_key FROM catch_photos WHERE catch_id=?').bind(id).all<{object_key:string}>();
 if(photos.results.length)await getBucket().delete(photos.results.map(p=>p.object_key));
 await db.batch([db.prepare('DELETE FROM catch_likes WHERE catch_id=?').bind(id),db.prepare('DELETE FROM catch_photos WHERE catch_id=?').bind(id),db.prepare('DELETE FROM catches WHERE id=? AND owner_id=?').bind(id,user.userId)]);
 return json({ok:true});
}catch(e){return apiError(e)}}
