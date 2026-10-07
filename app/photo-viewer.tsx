'use client';
import {useState,type ReactNode} from 'react';
import {X} from 'lucide-react';
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';

export default function PhotoViewer({photoId,species,className,children}:{photoId:number;species:string;className:string;children:ReactNode}){
 const [failed,setFailed]=useState(false);
 return <Dialog onOpenChange={open=>{if(open)setFailed(false)}}>
  <DialogTrigger asChild><button type="button" className={className} aria-label={`${species}の写真を開く`}>{children}</button></DialogTrigger>
  <DialogContent className="photo-viewer" showCloseButton={false}>
   <header className="photo-viewer-header"><DialogTitle className="photo-viewer-title">{species}の写真</DialogTitle><DialogClose asChild><Button variant="ghost" className="photo-viewer-close" aria-label="写真を閉じる"><X aria-hidden="true"/></Button></DialogClose></header>
   <DialogDescription className="sr-only">写真の拡大表示です。閉じるボタン、右上の×、またはEscキーで元の一覧に戻れます。</DialogDescription>
   <div className="photo-viewer-stage">{failed?<p role="alert">写真を読み込めませんでした。閉じてから、もう一度お試しください。</p>:<img src={`/api/photos/${photoId}`} alt={`${species}の釣果写真`} onError={()=>setFailed(true)}/>}</div>
   <footer className="photo-viewer-footer"><DialogClose asChild><Button variant="outline">閉じる</Button></DialogClose></footer>
  </DialogContent>
 </Dialog>;
}
