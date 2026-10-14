import {getUser} from '../../auth';
import {getDb} from './db';
import {initializePhotoStorage} from './photo-storage';
import {ApiError} from '../access';

/** Every related query applies the same publication boundary before serialization. */
export async function readCatches(req:Request,id?:number) {
 const user=await getUser(req),db=getDb(),viewer=user?.userId??null;
 const filter=`${user?'1=1':'c.guest_public=1'}${id===undefined?'':' AND c.id=?'}`;
 const ids=id===undefined?[]:[id];
 if(user)try{await initializePhotoStorage()}catch(error){if(!(error instanceof ApiError))console.error('Photo inventory will resume on the next request',error)}
 const r=await db.prepare(`SELECT c.*,p.display_name AS authorName,
 (SELECT COUNT(*) FROM catch_likes l WHERE l.catch_id=c.id) AS likeCount,
 EXISTS(SELECT 1 FROM catch_likes l WHERE l.catch_id=c.id AND l.user_id=?) AS liked
 FROM catches c JOIN profiles p ON p.user_id=c.owner_id WHERE ${filter} ORDER BY c.date DESC,c.id DESC`).bind(viewer,...ids).all();
 const fish=await db.prepare(`SELECT f.id,f.catch_id,f.species,f.count,f.length FROM catch_fish f JOIN catches c ON c.id=f.catch_id WHERE ${filter} ORDER BY f.catch_id,f.sort_order,f.id`).bind(...ids).all<{id:number;catch_id:number;species:string;count:number;length:number|null}>();
 const photos=await db.prepare(`SELECT ph.id,ph.catch_id,ph.species FROM catch_photos ph JOIN catches c ON c.id=ph.catch_id WHERE ${filter} ORDER BY ph.id`).bind(...ids).all<{id:number;catch_id:number;species:string|null}>();
 const positions=await db.prepare(`SELECT cp.* FROM catch_positions cp JOIN catches c ON c.id=cp.catch_id WHERE ${filter} AND (c.owner_id=? OR c.location_visibility='exact')`).bind(...ids,viewer).all<{catch_id:number;spot_id:number|null;latitude:number;longitude:number;source:string}>();
 return r.results.map(row=>{
  const rows=fish.results.filter(f=>f.catch_id===row.id),catchFish=rows.length?rows:[{id:0,species:String(row.species),count:Number(row.count),length:row.length==null?null:Number(row.length)}];
  const catchPhotos=photos.results.filter(p=>p.catch_id===row.id).map(p=>({id:p.id,species:p.species||catchFish[0].species}));
  const p=positions.results.find(p=>p.catch_id===row.id),own=!!user&&row.owner_id===viewer,hidden=!own&&row.location_visibility==='private';
  const {location_visibility,public_latitude,public_longitude,guest_public,...shared}=row;
  // Guest DTOs contain only public display data, never internal owner IDs or storage state.
  const display=user?shared:{id:row.id,date:row.date,species:row.species,count:row.count,length:row.length,method:row.method,memo:row.memo,created_at:row.created_at,featured_photo_id:row.featured_photo_id,authorName:row.authorName,likeCount:row.likeCount};
  return {...display,guestPublic:guest_public===1,location:hidden?'':row.location,locationVisibility:location_visibility,locationHidden:hidden,
   publicArea:location_visibility==='area'&&public_latitude!=null&&public_longitude!=null?{latitude:public_latitude,longitude:public_longitude,radius:8000}:null,
   position:p?{latitude:p.latitude,longitude:p.longitude,source:own?p.source:'map',...(own?{spotId:p.spot_id}:{})}:null,
   liked:!!user&&!!row.liked,fish:catchFish.map(({id,species,count,length})=>({id,species,count,length})),photos:catchPhotos,photoIds:catchPhotos.map(p=>p.id)};
 });
}
