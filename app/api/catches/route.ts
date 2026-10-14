import {visibilityInput} from './location-privacy';
import {approximateArea} from '../../location-privacy';
import {positionInput,rememberSpot,positionStatement} from './positions';
import {getDb,parseCatch} from './db';
import {authenticate,ensureProfile,json,apiError} from '../access';
import {readCatches} from './read';
import {guestPublicInput} from './guest-public';
export async function GET(req:Request){try{return json(await readCatches(req))}catch(e){return apiError(e)}}
export async function POST(req:Request){try{
 const user=await authenticate(req),body=await req.json() as Record<string,unknown>,v=parseCatch(body);if(!v)return json({error:'入力内容を確認してください。'},400);
 const guestPublic=guestPublicInput(body),visibility=visibilityInput(body),position=await positionInput(body,user.userId);
 await ensureProfile(user);
 const spotId=position?await rememberSpot(position,v.location,user.userId):null;
 const area=visibility==='area'&&position?approximateArea(position):null;
 const db=getDb(),first=v.fish[0],r=await db.prepare('INSERT INTO catches (date,location,species,count,length,method,memo,created_at,owner_id,location_visibility,public_latitude,public_longitude,guest_public) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(v.date,v.location,first.species,first.count,first.length,v.method,v.memo,new Date().toISOString(),user.userId,visibility,area?.latitude??null,area?.longitude??null,Number(guestPublic)).run(),id=Number(r.meta.last_row_id);
 await db.batch([...v.fish.map((fish,index)=>db.prepare('INSERT INTO catch_fish (catch_id,species,count,length,sort_order) VALUES (?,?,?,?,?)').bind(id,fish.species,fish.count,fish.length,index)),...(position?[positionStatement(id,position,spotId)]:[])]);
 return json({id},201);
}catch(e){return apiError(e)}}
