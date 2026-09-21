import {getDb,fail} from '../../catches/db';
import {getBucket,validId} from '../../catches/photos';
export async function GET(_req:Request,ctx:{params:Promise<{photoId:string}>}){
 const id=validId((await ctx.params).photoId);if(!id)return new Response(null,{status:404});
 try{const photo=await getDb().prepare('SELECT object_key,content_type FROM catch_photos WHERE id=?').bind(id).first<{object_key:string,content_type:string}>();if(!photo)return new Response(null,{status:404});const object=await getBucket().get(photo.object_key);if(!object)return new Response(null,{status:404});return new Response(object.body,{headers:{'Content-Type':photo.content_type,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}})}catch(e){return fail(e)}
}
