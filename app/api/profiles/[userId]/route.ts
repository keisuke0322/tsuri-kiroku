import {authenticate,correctOwnerDisplayName,json,apiError} from '../../access';
import {getDb} from '../../catches/db';
export async function GET(req:Request,ctx:{params:Promise<{userId:string}>}){try{
 await authenticate(req);await correctOwnerDisplayName();const {userId}=await ctx.params;
 const profile=await getDb().prepare('SELECT user_id AS userId,display_name AS displayName,bio FROM profiles WHERE user_id=?').bind(userId).first();
 return profile?json(profile):json({error:'プロフィールが見つかりません。'},404);
}catch(e){return apiError(e)}}
