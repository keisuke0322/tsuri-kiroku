import {authenticate,ownedCatch,json,apiError} from '../../../access';
import {getDb} from '../../db';
import {getBucket,photoType,validId} from '../../photos';
const LIMIT=8*1024*1024;
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){
 try { const user=await authenticate(req);
 const id=validId((await ctx.params).id);if(!id)return json({error:'記録が見つかりません。'},400);
 // Check size before parsing multipart to avoid unbounded images.
 const stated=Number(req.headers.get('content-length')||0);if(stated>LIMIT+65536)return json({error:'写真は1枚8MB以下にしてください。'},413);
 try{
  await ownedCatch(id,user.userId);const db=getDb(),bucket=getBucket();
  const record=await db.prepare('SELECT id FROM catches WHERE id=?').bind(id).first();if(!record)return json({error:'記録が見つかりません。'},404);
  const count=await db.prepare('SELECT COUNT(*) AS n FROM catch_photos WHERE catch_id=?').bind(id).first<{n:number}>();if((count?.n||0)>=6)return json({error:'写真は1件につき6枚までです。'},400);
  const form=await req.formData(),file=form.get('photo'),species=String(form.get('species')||'').trim(),featured=form.get('featured')==='true';if(!(file instanceof File))return json({error:'写真を選んでください。'},400);
  if(!species||!await db.prepare('SELECT id FROM catch_fish WHERE catch_id=? AND species=?').bind(id,species).first())return json({error:'写真の魚種を選んでください。'},400);
  if(file.size===0||file.size>LIMIT)return json({error:'写真は1枚8MB以下にしてください。'},413);
  const bytes=new Uint8Array(await file.arrayBuffer()),type=photoType(bytes);if(!type)return json({error:'JPEG、PNG、WebP、HEIC形式の写真を選んでください。'},400);
  const key=`catches/${id}/${crypto.randomUUID()}`;
  await bucket.put(key,bytes,{httpMetadata:{contentType:type}});
  try{const saved=await db.prepare('INSERT INTO catch_photos (catch_id,object_key,content_type,created_at,species) VALUES (?,?,?,?,?)').bind(id,key,type,new Date().toISOString(),species).run(),photoId=Number(saved.meta.last_row_id),record=await db.prepare('SELECT featured_photo_id AS id FROM catches WHERE id=?').bind(id).first<{id:number|null}>();if(featured||!record?.id)await db.prepare('UPDATE catches SET featured_photo_id=? WHERE id=?').bind(photoId,id).run();return json({id:photoId,species,featured:featured||!record?.id},201)}
  catch(e){await bucket.delete(key);throw e}
 }catch(e){return apiError(e)}
 }catch(e){return apiError(e)}
}
