'use client';
import {useRef,useState,type ReactNode,type PointerEvent} from 'react';
import {ChevronLeft,ChevronRight,X} from 'lucide-react';
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';

type Photo={id:number;species:string};
type Fish={species:string;count:number;length:number|null};
export default function PhotoViewer({photos,initialPhotoId,fish,date,location,className,children}:{photos:readonly Photo[];initialPhotoId:number;fish:readonly Fish[];date:string;location:string;className:string;children:ReactNode}){
 const initialIndex=Math.max(0,photos.findIndex(photo=>photo.id===initialPhotoId));
 const [index,setIndex]=useState(initialIndex),[failedPhoto,setFailedPhoto]=useState<number|null>(null);
 const gesture=useRef<{id:number;x:number;y:number}|null>(null);
 const currentIndex=Math.min(index,photos.length-1),photo=photos[currentIndex],trigger=photos[initialIndex];
 if(!photo||!trigger)return null;
 const details=fish.find(row=>row.species===photo.species);
 function move(delta:number){setFailedPhoto(null);setIndex(i=>(Math.min(i,photos.length-1)+delta+photos.length)%photos.length)}
 function startSwipe(e:PointerEvent<HTMLDivElement>){gesture.current=e.pointerType==='touch'&&e.isPrimary?{id:e.pointerId,x:e.clientX,y:e.clientY}:null}
 function finishSwipe(e:PointerEvent<HTMLDivElement>){
  const start=gesture.current;gesture.current=null;
  if(!start||start.id!==e.pointerId||photos.length<2||(window.visualViewport?.scale??1)>1)return;
  const dx=e.clientX-start.x,dy=e.clientY-start.y;
  if(Math.abs(dx)>=48&&Math.abs(dx)>Math.abs(dy)*1.5)move(dx<0?1:-1);
 }
 return <Dialog onOpenChange={open=>{gesture.current=null;if(open){setIndex(initialIndex);setFailedPhoto(null)}}}>
  <DialogTrigger asChild><button type="button" className={className} aria-label={`${trigger.species}の写真を開く`}>{children}</button></DialogTrigger>
  <DialogContent className="photo-viewer" showCloseButton={false} onKeyDown={e=>{if(photos.length>1&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();move(e.key==='ArrowRight'?1:-1)}}}>
   <header className="photo-viewer-header"><DialogTitle className="photo-viewer-title">{photo.species}の写真</DialogTitle><DialogClose asChild><Button variant="ghost" className="photo-viewer-close" aria-label="写真を閉じる"><X aria-hidden="true"/></Button></DialogClose></header>
   <DialogDescription className="sr-only">同じ釣果の写真を表示します。複数枚の場合は前後ボタン、左右キー、またはスワイプで切り替えられます。閉じるボタン、右上の×、またはEscキーで元の一覧に戻れます。</DialogDescription>
   <div className="photo-viewer-stage" onPointerDown={startSwipe} onPointerUp={finishSwipe} onPointerCancel={()=>{gesture.current=null}}>{failedPhoto===photo.id?<p role="alert">写真を読み込めませんでした。別の写真に切り替えるか、閉じてからもう一度お試しください。</p>:<img key={photo.id} src={`/api/photos/${photo.id}`} alt={`${photo.species}の釣果写真`} onError={()=>setFailedPhoto(photo.id)}/>}</div>
   <div className="photo-viewer-details" aria-live="polite"><p className="photo-viewer-fish"><strong>{photo.species}</strong>{details&&<span>{details.count}匹</span>}{details?.length!=null&&<span>最大 {details.length}cm</span>}</p><p className="photo-viewer-location"><time dateTime={date}>{date.replaceAll('-','/')}</time><span>{location}</span></p></div>
   <footer className="photo-viewer-footer"><div className="photo-viewer-navigation">{photos.length>1&&<Button variant="outline" className="photo-viewer-arrow" aria-label="前の写真" onClick={()=>move(-1)}><ChevronLeft aria-hidden="true"/></Button>}<span className="photo-viewer-count" aria-live="polite" aria-atomic="true">{currentIndex+1} / {photos.length}枚</span>{photos.length>1&&<Button variant="outline" className="photo-viewer-arrow" aria-label="次の写真" onClick={()=>move(1)}><ChevronRight aria-hidden="true"/></Button>}</div><DialogClose asChild><Button variant="outline">閉じる</Button></DialogClose></footer>
  </DialogContent>
 </Dialog>;
}
