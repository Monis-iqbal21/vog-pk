import {requireAdmin} from '@/lib/session';
import AdminShell from '@/components/AdminShell';
export default async function ProtectedLayout({children}){const user=await requireAdmin();return <AdminShell user={user}>{children}</AdminShell>;}
