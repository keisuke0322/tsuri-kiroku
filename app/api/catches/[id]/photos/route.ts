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
  const form=await req.formData(),file=form.get('photo');if(!(file instanceof File))return json({error:'写真を選んでください。'},400);
  if(file.size===0||file.size>LIMIT)return json({error:'写真は1枚8MB以下にしてください。'},413);
  const bytes=new Uint8Array(await file.arrayBuffer()),type=photoType(bytes);if(!type)return json({error:'JPEG、PNG、WebP、HEIC形式の写真を選んでください。'},400);
  const key=`catches/${id}/${crypto.randomUUID()}`;
  await bucket.put(key,bytes,{httpMetadata:{contentType:type}});
  try{const saved=await db.prepare('INSERT INTO catch_photos (catch_id,object_key,content_type,created_at) VALUES (?,?,?,?)').bind(id,key,type,new Date().toISOString()).run();return json({id:saved.meta.last_row_id},201)}
  catch(e){await bucket.delete(key);throw e}
 }catch(e){return apiError(e)}
 }catch(e){return apiError(e)}
}
