'use client';
import {useRef} from 'react';
import {MapPin} from 'lucide-react';
import {Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogClose} from '@/components/ui/dialog';
import GoogleMap from './google-map';
import type {LocationEntry} from './location-privacy';
export default function LocationMapDialog({entry,apiKey}:{entry:LocationEntry;apiKey:string}) {
 const trigger=useRef<HTMLButtonElement>(null);
 if(entry.locationHidden)return <p className="place" data-cy="location-hidden"><MapPin size={16}/>場所は非公開</p>;
 return <Dialog><DialogTrigger asChild><button ref={trigger} type="button" className="place location-map-trigger" data-cy="location-map-trigger" aria-label={`${entry.location}の地図を表示`}><MapPin size={16}/>{entry.location}</button></DialogTrigger>
 <DialogContent className="location-map-dialog" data-cy="location-map-dialog" onCloseAutoFocus={e=>{e.preventDefault();trigger.current?.focus({preventScroll:true})}}><DialogHeader><DialogTitle>{entry.location}</DialogTitle><DialogDescription>{entry.position?'釣行場所':entry.publicArea?'おおよその釣行エリア':'地図情報が未登録です。'}</DialogDescription></DialogHeader>
 {entry.position?<><GoogleMap apiKey={apiKey} points={[{id:entry.id,latitude:entry.position.latitude,longitude:entry.position.longitude,title:entry.location}]}/><p data-cy="location-exact">位置：{entry.position.latitude.toFixed(6)}, {entry.position.longitude.toFixed(6)}</p></>:entry.publicArea?<div data-cy="location-area"><GoogleMap apiKey={apiKey} area={entry.publicArea}/><p className="photo-help">釣行場所を含むおおよそのエリアです。円の中心は実際に釣った地点を示すものではありません。</p></div>:<p data-cy="location-unregistered">この釣行には表示できる地図情報が登録されていません。</p>}
 <DialogClose asChild><button type="button" className="map-action" data-cy="close-location-map">閉じる</button></DialogClose></DialogContent></Dialog>;
}
