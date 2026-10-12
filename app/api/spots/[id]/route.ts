import {getDb} from '../../catches/db';
import {authenticate,json,apiError,ApiError} from '../../access';
import {parsePosition} from '../../../fishing-position';
export async function PUT(req:Request,ctx:{params:Promise<{id:string}>}){try{
 const user=await authenticate(req),id=Number((await ctx.params).id),db=getDb();
 if(!Number.isSafeInteger(id)||id<1)throw new ApiError(400,'釣り場を確認してください。');
 const old=await db.prepare('SELECT id FROM fishing_spots WHERE id=? AND owner_id=?').bind(id,user.userId).first();
 if(!old)throw new ApiError(404,'釣り場が見つかりません。');
 const body=await req.json() as Record<string,unknown>,position=parsePosition({...body,source:'map'}),name=typeof body.name==='string'?body.name.trim():'';
 if(!position||!name||name.length>120||typeof body.favorite!=='boolean')throw new ApiError(400,'釣り場名・位置を確認してください。');
 await db.prepare('UPDATE fishing_spots SET name=?,latitude=?,longitude=?,favorite=? WHERE id=? AND owner_id=?').bind(name,position.latitude,position.longitude,Number(body.favorite),id,user.userId).run();
 return json({ok:true});
}catch(e){return apiError(e)}}
