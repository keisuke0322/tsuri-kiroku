'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';
export default function DemoControls({onChange}:{onChange:()=>Promise<void>}){
 const [state,setState]=useState<{count:number;initialized:boolean}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 async function load(){try{const r=await fetch('/api/demo-data',{cache:'no-store'});if(!r.ok)throw Error();let value=await r.json() as {count:number;initialized:boolean};if(!value.initialized){const seeded=await fetch('/api/demo-data',{method:'POST',cache:'no-store'});if(!seeded.ok)throw Error();value=await seeded.json() as {count:number;initialized:boolean};await onChange()}setState(value);setError(false)}catch{setError(true)}}
 useEffect(()=>{load()},[]);
 async function change(method:'POST'|'DELETE'){
  if(method==='DELETE'&&!confirm('ダミー釣果と関連するいいねをすべて削除します。実際の釣果は残ります。削除しますか？'))return;
  setBusy(true);try{const r=await fetch('/api/demo-data',{method,cache:'no-store'});if(!r.ok)throw Error();const next=await r.json() as {count:number;initialized:boolean};setState(next);await onChange();toast.success(method==='DELETE'?'ダミーデータを削除しました':'ダミー釣果12件を追加しました')}catch{toast.error('操作を完了できませんでした。再度お試しください。');await load()}finally{setBusy(false)}
 }
 if(state?.initialized&&!state.count)return null;
 return <aside className="demo-controls" aria-label="ダミーデータ管理"><p>{state?.count?`表示確認用のダミー釣果：${state.count}件。実際の釣果とは区別して削除できます。`:'表示確認用のダミー釣果を12件追加できます。'}</p>{error?<Button variant="outline" onClick={load}>管理情報を再読み込み</Button>:<Button variant="outline" disabled={busy||!state} onClick={()=>change(state?.count?'DELETE':'POST')}>{busy?'処理中…':state?.count?'ダミーデータを一括削除':'ダミー釣果12件を追加'}</Button>}</aside>;
}
