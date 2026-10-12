'use client';
import {useRef,useState,useEffect} from 'react';
import GoogleMap from './google-map';
import {parsePosition,type Position,type Spot} from './fishing-position';
export default function PositionEditor({apiKey,position,onChange,spots=[],onName}:{apiKey:string;position:Position|null;onChange:(p:Position|null)=>void;spots?:Spot[];onName?:(name:string)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[latitude,setLatitude]=useState(''),[longitude,setLongitude]=useState(''),request=useRef(0);
 useEffect(()=>{setLatitude(position?.latitude.toString()??'');setLongitude(position?.longitude.toString()??'')},[position]);
 useEffect(()=>()=>{request.current++},[]);
 function change(p:Position|null){request.current++;setBusy(false);setError('');onChange(p)}
 function locate(){
  if(!navigator.geolocation){setError('現在地に対応していません。地図から指定してください。');return}
  const version=++request.current;setBusy(true);setError('');
  navigator.geolocation.getCurrentPosition(p=>{if(version!==request.current)return;setBusy(false);onChange({latitude:p.coords.latitude,longitude:p.coords.longitude,source:'gps'})},()=>{if(version!==request.current)return;setBusy(false);setError('現在地を取得できませんでした。位置情報の許可を確認するか、地図から指定してください。')},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
 }
 function coordinates(){const p=latitude.trim()&&longitude.trim()?parsePosition({latitude:Number(latitude),longitude:Number(longitude),source:'map',spotId:position?.spotId}):null;if(!p){setError('緯度は−90〜90、経度は−180〜180で両方入力してください。');return}change(p)}
 return <fieldset className="position-editor"><legend>釣り場の位置（任意）</legend>{spots.length>0&&<label>過去の釣り場・お気に入り<select data-cy="past-spot" value="" onChange={e=>{const spot=spots.find(s=>s.id===Number(e.target.value));if(spot){change({latitude:spot.latitude,longitude:spot.longitude,source:'saved',spotId:spot.id});onName?.(spot.name)}}}><option value="">釣り場を選択</option>{[...spots].sort((a,b)=>Number(b.favorite)-Number(a.favorite)).map(s=><option key={s.id} value={s.id}>{s.favorite?'★ ':''}{s.name}</option>)}</select></label>}
 <button type="button" className="map-action" data-cy="get-location" disabled={busy} onClick={locate}>{busy?'現在地を取得中…':'現在地を取得'}</button>
 <GoogleMap apiKey={apiKey} position={position} editable onChange={p=>change({...p,spotId:position?.spotId})}/>
 <details><summary>緯度・経度で指定</summary><div className="map-coordinates"><label>緯度<input data-cy="latitude" type="number" step="any" min="-90" max="90" value={latitude} onChange={e=>setLatitude(e.target.value)}/></label><label>経度<input data-cy="longitude" type="number" step="any" min="-180" max="180" value={longitude} onChange={e=>setLongitude(e.target.value)}/></label><button type="button" data-cy="apply-coordinates" onClick={coordinates}>この場所で登録</button></div></details>
 {error&&<p role="alert">{error}</p>}{position&&<p data-cy="selected-position">選択位置：{position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}<button type="button" onClick={()=>change(null)}>位置を解除</button></p>}
 <p className="photo-help">保存する釣行の全魚種でこの位置を共有します。新しい場所は「過去の釣り場」に保存されます。</p></fieldset>;
}
