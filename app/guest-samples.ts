import type {CatchEntry} from './catch-entry';
import {japanDate} from './discovery';

/** Local examples are never persisted or included in the real catch list. */
export function guestSamples(now:Date):CatchEntry[] {
 return ['シロギス','アジ','メバル'].map((species,index)=>({
  id:-(index+1),date:japanDate(new Date(now.getTime()-index*86400000)),created_at:new Date(now.getTime()-index*86400000).toISOString(),
  location:['サンプルの海岸','サンプルの堤防',''][index],locationVisibility:index===2?'private':'area',locationHidden:index===2,
  position:null,publicArea:null,fish:[{species,count:3-index,length:20+index*2}],
  photos:index===0?[{id:-1,species,src:'/shirogisu.png'}]:[],featured_photo_id:index===0?-1:null,
  method:['ちょい投げ','サビキ','ルアー'][index],memo:'サンプルです。実際の投稿・釣り場・釣果ではありません。',
  authorName:'サンプルの釣り人',likeCount:0,liked:false,guestPublic:true
 }));
}
