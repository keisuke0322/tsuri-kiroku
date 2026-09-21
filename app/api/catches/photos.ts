import { env } from 'cloudflare:workers';
export function getBucket(){const bucket=(env as unknown as {BUCKET?:R2Bucket}).BUCKET;if(!bucket)throw Error('Photo storage unavailable');return bucket}
export function photoType(bytes:Uint8Array):string|null{
 if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x))return 'image/png';
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(4,8))==='ftyp'&&['heic','heix','hevc','hevx','mif1','msf1'].includes(String.fromCharCode(...bytes.slice(8,12))))return 'image/heic';
 return null;
}
export function validId(raw:string){const id=Number(raw);return Number.isSafeInteger(id)&&id>0?id:null}
