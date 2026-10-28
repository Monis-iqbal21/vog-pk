import {redirect} from 'next/navigation';
import {currentAdmin} from '@/lib/session';
import LoginForm from '@/components/LoginForm';
import {safeReturnPath} from '@/lib/return-path';
export default async function LoginPage({searchParams}){if(await currentAdmin())redirect('/dashboard');const query=await searchParams;return <main id="admin-main" className="login-page"><LoginForm returnTo={safeReturnPath(query.returnTo)} /></main>;}
