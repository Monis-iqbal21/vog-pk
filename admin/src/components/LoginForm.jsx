'use client';
import Image from 'next/image';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Eye,EyeOff,LoaderCircle} from 'lucide-react';
import {adminMutation} from '@/lib/client-api';
import {authorizedReturnPath} from '@/lib/return-path';
export default function LoginForm({returnTo='/dashboard'}){
 const [visible,setVisible]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState(false);
 const router=useRouter();
 async function submit(event){event.preventDefault();setError('');setPending(true);const form=new FormData(event.currentTarget);try{const result=await adminMutation('auth/login',{email:form.get('email'),password:form.get('password')});router.replace(authorizedReturnPath(returnTo,result.user.permissions));router.refresh();}catch(error){setError(error.message);setPending(false);}}
 return <section className="login-panel"><Image src="/vog-logo.png" alt="VOGPK" width={180} height={64} className="admin-logo" priority /><p className="eyebrow">Administration</p><h1>Welcome to VOGPK Admin</h1><p className="muted">Sign in with your staff account to manage the store.</p>
  <form onSubmit={submit}><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="username" required maxLength={254} disabled={pending} />
   <label htmlFor="password">Password</label><div className="password-field"><input id="password" name="password" type={visible?'text':'password'} autoComplete="current-password" required maxLength={128} disabled={pending} /><button type="button" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={19} />:<Eye size={19} />}</button></div>
   {error?<p className="form-error" role="alert">{error}</p>:null}<button className="primary-button sign-in" type="submit" disabled={pending}>{pending?<><LoaderCircle className="spinner" size={18} aria-hidden="true" /> Signing in…</>:'Sign In'}</button>
  </form><p className="login-note">Access is provided by the store owner. Contact your owner if you need help signing in.</p>
 </section>;
}
