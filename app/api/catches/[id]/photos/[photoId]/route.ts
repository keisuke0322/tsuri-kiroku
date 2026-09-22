import {authenticate,ownedCatch,json,apiError} from '../../../../access';
import {getDb} from '../../../db';
import {getBucket,validId} from '../../../photos';
export async function DELETE(req:Request,ctx:{params:Promise<{id:string,photoId:string}>}){
 try { const user=await authenticate(req);
 const {id:rawId,photoId:rawPhotoId}=await ctx.params,id=validId(rawId),photoId=validId(rawPhotoId);if(!id||!photoId)return json({error:'写真が見つかりません。'},400);
 try{await ownedCatch(id,user.userId);const db=getDb();const photo=await db.prepare('SELECT object_key FROM catch_photos WHERE id=? AND catch_id=?').bind(photoId,id).first<{object_key:string}>();if(!photo)return json({error:'写真が見つかりません。'},404);await getBucket().delete(photo.object_key);await db.prepare('DELETE FROM catch_photos WHERE id=? AND catch_id=?').bind(photoId,id).run();return json({ok:true})}catch(e){return apiError(e)}
 }catch(e){return apiError(e)}
}
