import {json,apiError,privateHeaders} from '../../access';
import {getUser} from '../../../auth';
import {getDb} from '../../catches/db';
import {getBucket,validId} from '../../catches/photos';
export async function GET(req:Request,ctx:{params:Promise<{photoId:string}>}){
 try { const user=await getUser(req);
 const id=validId((await ctx.params).photoId);if(!id)return json({error:'写真が見つかりません。'},404);
 try{const photo=await getDb().prepare('SELECT ph.object_key,ph.content_type FROM catch_photos ph JOIN catches c ON c.id=ph.catch_id JOIN profiles p ON p.user_id=c.owner_id WHERE ph.id=? AND (?=1 OR c.guest_public=1)').bind(id,Number(!!user)).first<{object_key:string,content_type:string}>();if(!photo)return json({error:'写真が見つかりません。'},404);const object=await getBucket().get(photo.object_key);if(!object)return json({error:'写真が見つかりません。'},404);return new Response(object.body,{headers:{'Content-Type':photo.content_type,...privateHeaders,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}})}catch(e){return apiError(e)}
 }catch(e){return apiError(e)}
}
