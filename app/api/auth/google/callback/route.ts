import {authConfig,authHeaders,cookie,readCookie,randomToken,tokenHash,verifyGoogleIdToken,SESSION_SECONDS} from '../../../../auth';
import {getDb} from '../../../catches/db';
export async function GET(req:Request){
 const config=authConfig(),responseHeaders=new Headers(authHeaders);
 responseHeaders.append('Set-Cookie',cookie('oauth','',0));
 try{
  const url=new URL(req.url),state=url.searchParams.get('state');
  if(url.origin!==config.origin||!state||!/^[a-f0-9]{64}$/.test(state)||state!==readCookie(req.headers,'oauth'))throw Error('Invalid state');
  const now=Math.floor(Date.now()/1000),db=getDb();
  const transaction=await db.prepare('DELETE FROM oauth_transactions WHERE state_hash=? AND expires_at>? RETURNING verifier,nonce').bind(await tokenHash(state),now).first<{verifier:string;nonce:string}>();
  if(!transaction||url.searchParams.has('error')||!url.searchParams.get('code'))throw Error('Expired or cancelled login');
  if(!config.GOOGLE_CLIENT_ID||!config.GOOGLE_CLIENT_SECRET)throw Error('Missing configuration');
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.GOOGLE_CLIENT_ID,client_secret:config.GOOGLE_CLIENT_SECRET,code:url.searchParams.get('code')!,code_verifier:transaction.verifier,grant_type:'authorization_code',redirect_uri:config.origin+'/api/auth/google/callback'}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Code exchange failed');
  const tokens=await response.json() as {id_token?:string};
  if(!tokens.id_token)throw Error('Missing identity');
  const user=await verifyGoogleIdToken(tokens.id_token,transaction.nonce),session=randomToken();
  const oldSession=readCookie(req.headers,'session');
  await db.batch([
   db.prepare('INSERT INTO profiles(user_id,display_name,bio) VALUES (?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(user.userId,user.fullName,''),
   db.prepare('DELETE FROM auth_sessions WHERE expires_at<=? OR token_hash=?').bind(now,await tokenHash(oldSession)),
   db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await tokenHash(session),user.userId,now+SESSION_SECONDS)
  ]);
  responseHeaders.append('Set-Cookie',cookie('session',session,SESSION_SECONDS));
  responseHeaders.set('Location',config.origin+'/');
  return new Response(null,{status:303,headers:responseHeaders});
 }catch{
  // Never log the authorization code, cookies, tokens, or Google's error body.
  console.error('Google login callback failed');
  responseHeaders.set('Location',config.origin+'/?login_error=1');
  return new Response(null,{status:303,headers:responseHeaders});
 }
}
