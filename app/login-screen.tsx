'use client';
import {useEffect,useState} from 'react';
import {Fish} from 'lucide-react';
export function loginTheme(date:Date){return date.getHours()>=6&&date.getHours()<18?'day':'night'}
export default function LoginScreen({loginFailed=false}:{loginFailed?:boolean}){
 const [theme,setTheme]=useState<'day'|'night'|null>(null);
 useEffect(()=>setTheme(loginTheme(new Date())),[]);
 return <main className={`login-scene ${theme?`login-${theme}`:'login-pending'}`}><div className="login-composition">
 <div className="login-art-frame">{theme&&<img className="login-art" width={1670} height={theme==='day'?941:942} fetchPriority="high" src={`/images/login/login-${theme}.webp`} alt="海辺で釣りをする人。魚との出会いが、日常を豊かにする。釣った魚、出かけた場所、あの瞬間をいつでも振り返れる。"/>}</div>
 <section className="google-login-card" aria-labelledby="login-title"><h1 id="login-title"><Fish aria-hidden="true"/>つり記録</h1><p>Googleアカウントでログイン</p><a className="google-login-button" href="/api/auth/google" target="_top"><svg aria-hidden="true" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.42h11a9.4 9.4 0 0 1-4.08 6.18v5.14h6.61c3.87-3.56 6.08-8.82 6.08-14.82Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.82 13.47-4.92l-6.61-5.14C29.04 35.16 26.69 35.9 24 35.9c-5.3 0-9.8-3.58-11.41-8.4H5.77v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.59 27.5a12 12 0 0 1 0-7V15.2H5.77a20 20 0 0 0 0 17.6Z"/><path fill="#EA4335" d="M24 12.1c3 0 5.67 1.03 7.8 3.05l5.85-5.85A19.6 19.6 0 0 0 24 4 20 20 0 0 0 5.77 15.2l6.82 5.3c1.61-4.82 6.11-8.4 11.41-8.4Z"/></svg>Googleでログイン</a>{loginFailed&&<p className="google-login-error" role="alert">ログインできませんでした。もう一度お試しください。</p>}</section></div></main>;
}
