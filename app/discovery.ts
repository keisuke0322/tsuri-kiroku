export type DiscoveryEntry = {id:number; date:string; created_at:string; species:string; count:number; likeCount:number};
export type Period = 7 | 30;
const DAY=86_400_000, JST=9*60*60*1000;
export function japanDate(now:Date){return new Date(now.getTime()+JST).toISOString().slice(0,10)}
/** Calendar-day windows are fixed to Japan, independent of the visitor's timezone. */
export function aggregateDiscovery<T extends DiscoveryEntry>(items:T[],days:Period,now=new Date()){
 const today=japanDate(now), start=new Date(Date.parse(today+'T00:00:00+09:00')-(days-1)*DAY);
 const startDate=japanDate(start), species=new Map<string,{species:string;records:number;fish:number}>();
 for(const item of items){
  if(item.date<startDate||item.date>today)continue;
  const row=species.get(item.species)??{species:item.species,records:0,fish:0};
  row.records++;row.fish+=item.count;species.set(item.species,row);
 }
 const fish=[...species.values()].sort((a,b)=>b.records-a.records||b.fish-a.fish||a.species.localeCompare(b.species,'ja')).slice(0,3);
 const recent=items.filter(item=>{const time=Date.parse(item.created_at);return time>=start.getTime()&&time<=now.getTime()});
 const hasLikes=recent.some(item=>item.likeCount>0);
 const featured=[...recent].sort((a,b)=>(hasLikes?b.likeCount-a.likeCount:0)||Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id).slice(0,3);
 return {fish,featured,hasLikes};
}
