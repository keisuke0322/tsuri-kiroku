import {canManageDemo} from './api/demo-data/route';
import {ensureProfile} from './api/access';
import FishingLog from './fishing-log';
import {getUser} from './auth';
import LoginScreen from './login-screen';
export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<{login_error?:string}>}){
 const loginFailed=!!(await searchParams).login_error;
 const user=await getUser();
 if(!user)return <LoginScreen loginFailed={loginFailed}/>;
 let initialName=user.fullName||'釣り人';
 try{initialName=(await ensureProfile(user)).displayName}catch{/* The client displays a retryable storage error. */}
 return <FishingLog canManageDemo={await canManageDemo(user.userId)} userId={user.userId} initialName={initialName} signOutPath="/api/auth/logout" signInPath="/api/auth/google"/>;
}
