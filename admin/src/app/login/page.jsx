import {redirect} from 'next/navigation';
import {currentAdmin} from '@/lib/session';
import LoginForm from '@/components/LoginForm';
import {safeReturnPath} from '@/lib/return-path';
import {adminConfig} from '@/lib/config';
export default async function LoginPage({searchParams}){
 if(!adminConfig().authEnabled)return <main id="admin-main" className="login-page"><section className="login-panel"><h1>Admin preview</h1><p role="status">Sign-in is disabled. This preview has no isolated authentication backend configured.</p></section></main>;
 if(await currentAdmin())redirect('/dashboard');const query=await searchParams;return <main id="admin-main" className="login-page"><LoginForm returnTo={safeReturnPath(query.returnTo)} /></main>;
}
