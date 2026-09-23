import {Fish,Heart,MapPin,CalendarDays} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Avatar} from './profile-dialog';
import {aggregateDiscovery,type DiscoveryEntry,type Period} from './discovery';
type Entry=DiscoveryEntry&{photoIds:number[];owner_id:string;authorName:string;location:string;liked:boolean};
export default function DiscoveryPanel<T extends Entry>({items,days,onDays,now,onSpecies,onProfile,onLike,busyLikes}:{items:T[];days:Period;onDays:(days:Period)=>void;now:Date;onSpecies:(species:string)=>void;onProfile:(id:string)=>void;onLike:(item:T)=>void;busyLikes:Set<number>}){
 const {fish,featured,hasLikes}=aggregateDiscovery(items,days,now);
 return <section className="discovery" aria-label="みんなの釣果のトレンド">
  <div className="discovery-toolbar"><span>最近の釣果をチェック</span><Tabs value={String(days)} onValueChange={v=>onDays(Number(v) as Period)}><TabsList aria-label="ランキングの集計期間"><TabsTrigger value="7">7日間</TabsTrigger><TabsTrigger value="30">30日間</TabsTrigger></TabsList></Tabs></div>
  <section className="fish-ranking" aria-labelledby="fish-ranking-title"><div className="discovery-title"><h2 id="fish-ranking-title">最近釣れている魚 <small>TOP3</small></h2><p>釣行日で集計 · 過去{days}日間</p></div>
   {fish.length?<ol className="ranking-list">{fish.map((row,index)=><li key={row.species}><button onClick={()=>onSpecies(row.species)} aria-label={`${row.species}の釣果を一覧で見る`}><span className="ranking-number">{index+1}</span><span className="ranking-name">{row.species}</span><span className="ranking-count"><strong>{row.records}件</strong><span> · {row.fish}匹</span></span></button></li>)}</ol>:<p className="discovery-empty">過去{days}日間の釣行記録はありません。</p>}
  </section>
  <section aria-labelledby="featured-title"><div className="discovery-title"><h2 id="featured-title">{hasLikes?'注目の釣果':'最近の釣果'}</h2><p>過去{days}日間の投稿{hasLikes?' · いいね順':' · 新着順'}</p></div>
   {featured.length?<div className="featured-grid">{featured.map(item=><article className="featured-card" key={item.id}>
    {item.photoIds?.length?<a className="featured-photo" href={`/api/photos/${item.photoIds[0]}`} target="_blank" rel="noopener noreferrer" aria-label={`${item.species}の写真を開く`}><img src={`/api/photos/${item.photoIds[0]}`} alt={`${item.species}の釣果写真`} loading="lazy"/></a>:<div className="featured-photo photo-fallback" role="img" aria-label="写真なし"><Fish size={48}/></div>}
    <div className="featured-info"><div className="featured-heading"><h3>{item.species}</h3><div className="card-actions"><button className={`like-button ${item.liked?'is-liked':''}`} aria-label={item.liked?'いいねを取り消す':'いいね'} aria-pressed={item.liked} disabled={busyLikes.has(item.id)} onClick={()=>onLike(item)}><Heart size={19} fill={item.liked?'currentColor':'none'}/><span>{item.likeCount}</span></button></div></div>
     <button className="author-button" onClick={()=>onProfile(item.owner_id)}><Avatar name={item.authorName}/><span>{item.authorName}</span></button>
     <p className="featured-date"><CalendarDays size={15}/><time dateTime={item.date}>{item.date.replaceAll('-','/')}</time></p><p className="place"><MapPin size={16}/>{item.location}</p>
    </div></article>)}</div>:<p className="discovery-empty">過去{days}日間の投稿はありません。</p>}
  </section>
 </section>;
}
