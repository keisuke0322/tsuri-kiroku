import {canManageDemo} from './api/demo-data/route';
import {ensureProfile} from './api/access';
import FishingLog from './fishing-log';
import {getUser} from './auth';
import {Waves} from 'lucide-react';
export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<{login_error?:string}>}){
 const loginFailed=!!(await searchParams).login_error;
 const user=await getUser();
 if(!user)return <div className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark"><Waves size={23}/></span>釣果ノート</div></header><main className="login-panel"><img src="/shirogisu.png" alt="シロギスを釣り上げる釣り人"/><h1>釣果を残して、分かち合おう。</h1><p>ログインして釣果を記録したり、みんなの釣果にいいねを付けたりできます。</p>{loginFailed&&<p role="alert">ログインできませんでした。もう一度お試しください。</p>}<a className="add-button" href="/api/auth/google" target="_top">Googleでログイン</a></main></div>;
 let initialName=user.fullName||'釣り人';
 try{initialName=(await ensureProfile(user)).displayName}catch{/* The client displays a retryable storage error. */}
 return <FishingLog canManageDemo={await canManageDemo(user.userId)} userId={user.userId} initialName={initialName} signOutPath="/api/auth/logout" signInPath="/api/auth/google"/>;
}
