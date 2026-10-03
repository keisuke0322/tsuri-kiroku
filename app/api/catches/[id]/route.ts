import {getDb,parseCatch} from '../db';
import {getBucket,validId} from '../photos';
import {authenticate,ownedCatch,json,apiError} from '../../access';
export async function PUT(req:Request,ctx:{params:Promise<{id:string}>}){try{
 const user=await authenticate(req),id=validId((await ctx.params).id);if(!id)return json({error:'記録が見つかりません。'},400);
 await ownedCatch(id,user.userId);const body=await req.json() as Record<string,unknown>,v=parseCatch(body);if(!v)return json({error:'入力内容を確認してください。'},400);
 const db=getDb(),photos=await db.prepare('SELECT id,species FROM catch_photos WHERE catch_id=? ORDER BY id').bind(id).all<{id:number,species:string|null}>();
 const assignments=new Map<number,string>();
 if(Array.isArray(body.photoAssignments))for(const raw of body.photoAssignments){if(!raw||typeof raw!=='object')return json({error:'写真の魚種を確認してください。'},400);const p=raw as Record<string,unknown>,photoId=Number(p.photoId),species=String(p.species||'').trim();if(!Number.isInteger(photoId)||!v.fish.some(f=>f.species===species)||assignments.has(photoId))return json({error:'写真の魚種を確認してください。'},400);assignments.set(photoId,species)}
 if(v.legacy)for(const photo of photos.results)assignments.set(photo.id,v.fish[0].species);
 if(photos.results.some(photo=>!assignments.has(photo.id))||[...assignments.keys()].some(photoId=>!photos.results.some(p=>p.id===photoId)))return json({error:'すべての写真に魚種を設定してください。'},400);
 const requestedFeatured=body.featuredPhotoId==null?null:Number(body.featuredPhotoId);if(requestedFeatured!==null&&(!Number.isInteger(requestedFeatured)||!photos.results.some(p=>p.id===requestedFeatured)))return json({error:'代表写真を確認してください。'},400);
 const featured=v.legacy?(await db.prepare('SELECT featured_photo_id AS id FROM catches WHERE id=?').bind(id).first<{id:number|null}>())?.id??null:requestedFeatured,first=v.fish[0];
 const statements=[db.prepare('DELETE FROM catch_fish WHERE catch_id=?').bind(id),...v.fish.map((fish,index)=>db.prepare('INSERT INTO catch_fish (catch_id,species,count,length,sort_order) VALUES (?,?,?,?,?)').bind(id,fish.species,fish.count,fish.length,index)),...photos.results.map(photo=>db.prepare('UPDATE catch_photos SET species=? WHERE id=? AND catch_id=?').bind(assignments.get(photo.id),photo.id,id)),db.prepare('UPDATE catches SET date=?,location=?,species=?,count=?,length=?,method=?,memo=?,featured_photo_id=? WHERE id=? AND owner_id=?').bind(v.date,v.location,first.species,first.count,first.length,v.method,v.memo,featured,id,user.userId)];
 await db.batch(statements);return json({ok:true});
}catch(e){return apiError(e)}}
export async function DELETE(req:Request,ctx:{params:Promise<{id:string}>}){try{
 const user=await authenticate(req),id=validId((await ctx.params).id);if(!id)return json({error:'記録が見つかりません。'},400);await ownedCatch(id,user.userId);
 const db=getDb(),photos=await db.prepare('SELECT object_key FROM catch_photos WHERE catch_id=?').bind(id).all<{object_key:string}>();
 if(photos.results.length)await getBucket().delete(photos.results.map(p=>p.object_key));
 await db.batch([db.prepare('DELETE FROM catch_likes WHERE catch_id=?').bind(id),db.prepare('DELETE FROM catch_photos WHERE catch_id=?').bind(id),db.prepare('DELETE FROM catches WHERE id=? AND owner_id=?').bind(id,user.userId)]);
 return json({ok:true});
}catch(e){return apiError(e)}}
