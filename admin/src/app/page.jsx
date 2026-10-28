import {redirect} from 'next/navigation';
import {currentAdmin} from '@/lib/session';
export default async function RootPage(){redirect(await currentAdmin()?'/dashboard':'/login');}
