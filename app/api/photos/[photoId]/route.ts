import {authenticate,json,apiError,privateHeaders} from '../../access';
import {getDb} from '../../catches/db';
import {getBucket,validId} from '../../catches/photos';
export async function GET(req:Request,ctx:{params:Promise<{photoId:string}>}){
 try { await authenticate(req);
 const id=validId((await ctx.params).photoId);if(!id)return json({error:'写真が見つかりません。'},404);
 try{const photo=await getDb().prepare('SELECT object_key,content_type FROM catch_photos WHERE id=?').bind(id).first<{object_key:string,content_type:string}>();if(!photo)return json({error:'写真が見つかりません。'},404);const object=await getBucket().get(photo.object_key);if(!object)return json({error:'写真が見つかりません。'},404);return new Response(object.body,{headers:{'Content-Type':photo.content_type,...privateHeaders,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}})}catch(e){return apiError(e)}
 }catch(e){return apiError(e)}
}
