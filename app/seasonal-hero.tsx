'use client';
import {useSyncExternalStore} from 'react';
import {Plus,ChevronRight} from 'lucide-react';

export function seasonForDate(date:Date){
 const month=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',month:'numeric'}).format(date));
 return month>=3&&month<=5?'spring':month>=6&&month<=8?'summer':month>=9&&month<=11?'autumn':'winter';
}
const descriptions={
 spring:'春・3〜5月。春の海で、新しい一匹に出会う。水温が上がり、魚たちが動き出す季節。心躍る春の釣りを、記録に残そう。この季節の主な魚：アオリイカ、メバル、マダイ。',
 summer:'夏・6〜8月。夏の海で、思い出が増えていく。青い海、強い日差し、にぎやかな魚たち。家族や仲間との釣りの記録に残そう。この季節の主な魚：シロギス、アジ、サバ。',
 autumn:'秋・9〜11月。秋の海で、狙う一匹との駆け引き。魚たちが活発に動く、絶好の釣りシーズン。実りの秋の釣りを、記録に残そう。この季節の主な魚：タチウオ、アオリイカ、ブリ。',
 winter:'冬・12〜2月。冬の海で、じっくりと向き合う。澄んだ空気と冷たい海。魚たちの力強い一瞬を、記録に残そう。この季節の主な魚：メバル、カサゴ、クロダイ。'
};
// Keep server HTML neutral; read the browser clock after hydration.
const subscribeToClock=()=>()=>{};
const currentSeason=()=>seasonForDate(new Date());
const serverSeason=()=>null;
export default function SeasonalHero({onRecord,onView}:{onRecord:()=>void;onView:()=>void}){
 const season=useSyncExternalStore<ReturnType<typeof seasonForDate>|null>(subscribeToClock,currentSeason,serverSeason);
 return <section className="seasonal-hero" aria-label="季節の釣り"><div className="seasonal-hero-art">
 {season&&<img src={`/images/hero/hero-${season}.webp`} alt={descriptions[season]} width={1671} height={941} fetchPriority="high"/>}
 </div><div className="seasonal-hero-actions"><button data-cy="record-catch" type="button" className="hero-record" onClick={onRecord}><Plus aria-hidden="true"/>釣果を記録する</button><button type="button" className="hero-view" onClick={onView}>釣果を見る<ChevronRight aria-hidden="true"/></button></div></section>;
}
