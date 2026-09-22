import {ensureProfile} from './api/access';
import FishingLog from './fishing-log';
import {getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath} from './chatgpt-auth';
import {Waves} from 'lucide-react';
export const dynamic='force-dynamic';
export default async function Home(){
 const user=await getChatGPTUser();
 if(!user)return <div className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark"><Waves size={23}/></span>釣果ノート</div></header><main className="login-panel"><img src="/shirogisu.png" alt="シロギスを釣り上げる釣り人"/><h1>釣果を残して、分かち合おう。</h1><p>ログインして釣果を記録したり、みんなの釣果にいいねを付けたりできます。</p><a className="add-button" href={chatGPTSignInPath('/')} target="_top">ChatGPTでログイン</a></main></div>;
 let initialName=user.fullName||'釣り人';
 try{initialName=(await ensureProfile(user)).displayName}catch{/* The client displays a retryable storage error. */}
 return <FishingLog userId={user.userId} initialName={initialName} signOutPath={chatGPTSignOutPath('/')} signInPath={chatGPTSignInPath('/')}/>;
}
