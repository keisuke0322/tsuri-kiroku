import {authenticate,ensureProfile,json,apiError} from '../access';
import {getDb} from '../catches/db';
export async function GET(req:Request){try{
 const user=await authenticate(req),profile=await ensureProfile(user);
 const pending=user.email.toLowerCase()==='keisuke0322@gmail.com'?await getDb().prepare('SELECT COUNT(*) AS n FROM catches WHERE owner_id IS NULL').first<{n:number}>():null;
 return json({...profile,legacyClaimRequired:!!pending?.n});
}catch(e){return apiError(e)}}
export async function PUT(req:Request){try{
 const user=await authenticate(req),value=await req.json() as {displayName?:unknown;bio?:unknown};
 if(!value||typeof value.displayName!=='string'||typeof value.bio!=='string')return json({error:'表示名と自己紹介を確認してください。'},400);
 const displayName=value.displayName.trim(),bio=value.bio.trim();
 if(!displayName||Array.from(displayName).length>50||Array.from(bio).length>500)return json({error:'表示名は1〜50文字、自己紹介は500文字以内で入力してください。'},400);
 await ensureProfile(user);await getDb().prepare('UPDATE profiles SET display_name=?,bio=? WHERE user_id=?').bind(displayName,bio,user.userId).run();
 return json({userId:user.userId,displayName,bio});
}catch(e){return apiError(e)}}
