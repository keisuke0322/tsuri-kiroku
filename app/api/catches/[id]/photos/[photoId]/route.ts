import {getDb,fail} from '../../../db';
import {getBucket,validId} from '../../../photos';
export async function DELETE(_req:Request,ctx:{params:Promise<{id:string,photoId:string}>}){
 const {id:rawId,photoId:rawPhotoId}=await ctx.params,id=validId(rawId),photoId=validId(rawPhotoId);if(!id||!photoId)return Response.json({error:'写真が見つかりません。'},{status:400});
 try{const db=getDb();const photo=await db.prepare('SELECT object_key FROM catch_photos WHERE id=? AND catch_id=?').bind(photoId,id).first<{object_key:string}>();if(!photo)return Response.json({error:'写真が見つかりません。'},{status:404});await getBucket().delete(photo.object_key);await db.prepare('DELETE FROM catch_photos WHERE id=? AND catch_id=?').bind(photoId,id).run();return Response.json({ok:true})}catch(e){return fail(e)}
}
