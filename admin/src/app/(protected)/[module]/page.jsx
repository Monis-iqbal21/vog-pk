import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireAdmin} from '@/lib/session';
import {modules} from '@/config/modules';
import {backendRequest} from '@/lib/api';
import {cookies} from 'next/headers';
import {adminConfig} from '@/lib/config';
import StaffPanel from '@/components/StaffPanel';
export default async function ModulePage({params}){
 const user=await requireAdmin(),{module:slug}=await params,definition=modules.find(module=>module.path===`/${slug}`);
 if(!definition)notFound();
 if(!user.permissions.includes(definition.permission))return <section className="access-denied"><h1>Access Denied</h1><p>You do not have permission to open this page. Contact the store owner if your access needs to change.</p><Link href="/dashboard">Return to overview</Link></section>;
 if(slug==='dashboard')return <><div className="page-intro"><h1>Welcome, {user.name}</h1><p className="muted">Your workspace for VOGPK store administration.</p><div className="role-list">{user.roles.map(role=><span key={role.code}>{role.name}</span>)}</div></div><section aria-labelledby="quick-access"><h2 id="quick-access">Quick access</h2><div className="quick-grid">{modules.filter(module=>module.path!=='/dashboard'&&user.permissions.includes(module.permission)).map(module=><Link key={module.path} className="quick-link" href={module.path}>{module.title}<span>Open workspace →</span></Link>)}</div></section><section className="metrics-empty"><h2>Store metrics</h2><p>Sales, orders and inventory metrics will appear when those services are connected.</p><span className="status-badge">Not connected yet</span></section></>;
 if(slug==='staff'||slug==='audit-logs'){
  const token=(await cookies()).get(adminConfig().sessionCookie)?.value;
  const result=await backendRequest(slug,{token});
  if(result.status===403)return <section className="access-denied"><h1>Access Denied</h1></section>;
  if(result.status!==200)throw new Error('Unable to load this administration page.');
  if(slug==='staff'){
   const canManage=['staff.manage','roles.manage'].every(code=>user.permissions.includes(code));
   const roles=canManage?await backendRequest('roles',{token}):{status:200,data:[]};if(roles.status!==200)throw new Error('Unable to load roles.');
   return <><h1>Staff & Roles</h1><p className="muted">Manage staff access using predefined roles. Changes end the affected account’s sessions.</p><StaffPanel users={result.data} roles={roles.data} currentId={user.id} canManage={canManage} /></>;
  }
  return <><h1>Audit Logs</h1><p className="muted">The 100 most recent security and access events.</p><div className="table-scroll"><table><thead><tr><th>Time (PKT)</th><th>Action</th><th>Actor</th><th>Resource</th></tr></thead><tbody>{result.data.map(log=><tr key={log.id}><td>{new Intl.DateTimeFormat('en-PK',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Karachi'}).format(new Date(log.createdAt))}</td><td>{log.action}</td><td>{log.actor?.name??'System / unauthenticated'}</td><td>{log.resource}</td></tr>)}</tbody></table></div></>;
 }
 return <><h1>{definition.title}</h1><div className="module-placeholder"><span className="status-badge">Foundation ready</span><h2>{definition.title} is planned for a later phase</h2><p>Your access is verified. Editing, publishing and operational actions for this module have not been implemented yet.</p><Link href="/dashboard">Return to overview</Link></div></>;
}
