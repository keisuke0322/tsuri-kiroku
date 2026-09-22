'use client';
import {useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
export type Profile={userId:string;displayName:string;bio:string};
export function Avatar({name}:{name:string}){return <span className="avatar" aria-hidden="true">{Array.from(name.trim())[0]||'釣'}</span>}
export default function ProfileDialog({profile,editable,onClose,onSave}:{profile:Profile;editable:boolean;onClose:()=>void;onSave:(name:string,bio:string)=>Promise<void>}){
 const [name,setName]=useState(profile.displayName),[bio,setBio]=useState(profile.bio),[saving,setSaving]=useState(false),[error,setError]=useState('');
 return <Dialog open onOpenChange={open=>{if(!open&&!saving)onClose()}}><DialogContent><DialogHeader><DialogTitle>{editable?'プロフィールを編集':'プロフィール'}</DialogTitle></DialogHeader><div className="profile-heading"><Avatar name={editable?name:profile.displayName}/><strong>{profile.displayName}</strong></div>{editable?<form className="entry-form" onSubmit={async e=>{e.preventDefault();setSaving(true);setError('');try{await onSave(name,bio);onClose()}catch(e){setError(e instanceof Error?e.message:'保存できませんでした。')}finally{setSaving(false)}}}><label>表示名（姓 名）<Input placeholder="例：山田 太郎" value={name} required maxLength={50} onChange={e=>setName(e.target.value)}/></label><label>自己紹介<textarea value={bio} maxLength={500} onChange={e=>setBio(e.target.value)} placeholder="好きな釣りや、最近の釣行について"/><small>{Array.from(bio).length} / 500</small></label>{error&&<p role="alert">{error}</p>}<Button disabled={saving} type="submit">{saving?'保存中…':'保存する'}</Button></form>:<p className="profile-bio">{profile.bio||'自己紹介はまだありません。'}</p>}</DialogContent></Dialog>
}
