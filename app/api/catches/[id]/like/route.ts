import {authenticate,ensureProfile,json,apiError} from '../../../access';
import {getDb} from '../../db';
import {validId} from '../../photos';
async function change(req:Request,ctx:{params:Promise<{id:string}>},liked:boolean){try{
 const user=await authenticate(req),id=validId((await ctx.params).id);if(!id)return json({error:'記録が見つかりません。'},400);
 const db=getDb();if(!await db.prepare('SELECT id FROM catches WHERE id=? AND owner_id IS NOT NULL').bind(id).first())return json({error:'記録が見つかりません。'},404);
 await ensureProfile(user);
 await db.prepare(liked?'INSERT INTO catch_likes (catch_id,user_id) VALUES (?,?) ON CONFLICT(catch_id,user_id) DO NOTHING':'DELETE FROM catch_likes WHERE catch_id=? AND user_id=?').bind(id,user.userId).run();
 const state=await db.prepare('SELECT COUNT(*) AS likeCount,EXISTS(SELECT 1 FROM catch_likes WHERE catch_id=? AND user_id=?) AS liked FROM catch_likes WHERE catch_id=?').bind(id,user.userId,id).first<{likeCount:number;liked:number}>();
 return json({likeCount:state!.likeCount,liked:!!state!.liked});
}catch(e){return apiError(e)}}
export const PUT=(req:Request,ctx:{params:Promise<{id:string}>})=>change(req,ctx,true);
export const DELETE=(req:Request,ctx:{params:Promise<{id:string}>})=>change(req,ctx,false);
