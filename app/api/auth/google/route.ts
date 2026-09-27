import {authConfig,authHeaders,cookie,randomToken,tokenHash,pkceChallenge} from '../../../auth';
import {getDb} from '../../catches/db';
export async function GET(req:Request){
 try{
  const config=authConfig();
  if(new URL(req.url).origin!==config.origin)return new Response('Invalid origin',{status:400,headers:authHeaders});
  if(!config.GOOGLE_CLIENT_ID||!config.GOOGLE_CLIENT_SECRET)return new Response('Googleログインの設定準備中です。',{status:503,headers:authHeaders});
  const state=randomToken(),verifier=randomToken(),nonce=randomToken(),now=Math.floor(Date.now()/1000);
  await getDb().batch([
   getDb().prepare('DELETE FROM oauth_transactions WHERE expires_at<=?').bind(now),
   getDb().prepare('INSERT INTO oauth_transactions (state_hash,verifier,nonce,expires_at) VALUES (?,?,?,?)').bind(await tokenHash(state),verifier,nonce,now+600)
  ]);
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search=new URLSearchParams({client_id:config.GOOGLE_CLIENT_ID,redirect_uri:config.origin+'/api/auth/google/callback',response_type:'code',scope:'openid profile email',state,nonce,code_challenge:await pkceChallenge(verifier),code_challenge_method:'S256',prompt:'select_account'}).toString();
  return new Response(null,{status:302,headers:{...authHeaders,Location:url.href,'Set-Cookie':cookie('oauth',state,600)}});
 }catch{console.error('Google login initialization failed');return new Response('ログインを開始できませんでした。時間をおいて再試行してください。',{status:503,headers:authHeaders});}
}
