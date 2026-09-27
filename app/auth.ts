import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {createRemoteJWKSet, jwtVerify} from 'jose';
import {getDb} from './api/catches/db';

export type AppUser = {userId: string; fullName: string | null};
type AuthEnv = {APP_ORIGIN?: string; GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string};
const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export const SESSION_SECONDS = 30 * 86400;
export const authHeaders = {'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer'};
export function authConfig() {
  const config = env as unknown as AuthEnv;
  if (!config.APP_ORIGIN) throw Error('APP_ORIGIN is not configured');
  const origin = new URL(config.APP_ORIGIN);
  if (origin.origin !== config.APP_ORIGIN || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost','127.0.0.1'].includes(origin.hostname)))) throw Error('Invalid APP_ORIGIN');
  return {...config, origin:origin.origin, secure:origin.protocol==='https:'};
}
export function cookieName(kind: 'session'|'oauth') {return (authConfig().secure?'__Host-':'')+'tsuri_'+kind;}
export function cookie(kind: 'session'|'oauth', value: string, maxAge: number) {
  return `${cookieName(kind)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${authConfig().secure?'; Secure':''}`;
}
export function readCookie(h: Headers, kind:'session'|'oauth') {
  const name=cookieName(kind)+'=';
  return h.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name))?.slice(name.length) || '';
}
export function randomToken() {return Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');}
export async function tokenHash(token:string) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),v=>v.toString(16).padStart(2,'0')).join('');}
export async function pkceChallenge(verifier:string) {
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export async function getUser(req?:Request):Promise<AppUser|null> {
  const value=readCookie(req?.headers ?? await headers(),'session');
  if(!/^[a-f0-9]{64}$/.test(value))return null;
  return getDb().prepare(`SELECT s.user_id AS userId,p.display_name AS fullName FROM auth_sessions s
    JOIN profiles p ON p.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`)
    .bind(await tokenHash(value),Math.floor(Date.now()/1000)).first<AppUser>();
}
export function sameOrigin(req:Request) {
  return new URL(req.url).origin===authConfig().origin && req.headers.get('origin')===authConfig().origin && req.headers.get('sec-fetch-site')!=='cross-site';
}
export async function verifyGoogleIdToken(idToken:string, nonce:string) {
  const {GOOGLE_CLIENT_ID}=authConfig();
  if(!GOOGLE_CLIENT_ID)throw Error('Google login is not configured');
  const {payload}=await jwtVerify(idToken,keys,{issuer:['https://accounts.google.com','accounts.google.com'],audience:GOOGLE_CLIENT_ID,algorithms:['RS256'],requiredClaims:['sub','exp','iat','nonce']});
  if(payload.nonce!==nonce || !payload.sub || payload.email_verified!==true)throw Error('Invalid Google identity');
  if(payload.azp && payload.azp!==GOOGLE_CLIENT_ID)throw Error('Invalid authorized party');
  const parts=[payload.family_name,payload.given_name].filter((v):v is string=>typeof v==='string'&&!!v.trim());
  const name=parts.length?parts.join(' '):typeof payload.name==='string'?payload.name:'釣り人';
  return {userId:'google:'+payload.sub,fullName:Array.from(name.trim()||'釣り人').slice(0,50).join('')};
}
