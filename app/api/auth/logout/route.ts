import {authHeaders,cookie,readCookie,sameOrigin,tokenHash} from '../../../auth';
import {getDb} from '../../catches/db';
export async function POST(req:Request){
 try{
  if(!sameOrigin(req))return Response.json({error:'この操作はサイト内から行ってください。'},{status:403,headers:authHeaders});
  const token=readCookie(req.headers,'session');
  if(token)await getDb().prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await tokenHash(token)).run();
  const headers=new Headers(authHeaders);headers.append('Set-Cookie',cookie('session','',0));headers.append('Set-Cookie',cookie('oauth','',0));
  return new Response(null,{status:204,headers});
 }catch{return Response.json({error:'ログアウトできませんでした。もう一度お試しください。'},{status:503,headers:authHeaders});}
}
