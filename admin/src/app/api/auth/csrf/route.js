import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {randomBytes} from 'node:crypto';
import {adminConfig,cookieOptions} from '@/lib/config';
export async function GET(request){
 const cfg=adminConfig(),origin=request.headers.get('origin');
 if(origin&&origin!==cfg.origin||request.headers.get('sec-fetch-site')==='cross-site')return NextResponse.json({message:'Request origin rejected.'},{status:403});
 const existing=(await cookies()).get(cfg.csrfCookie)?.value;
 const token=existing&&/^[a-f0-9]{64}$/.test(existing)?existing:randomBytes(32).toString('hex');
 const response=NextResponse.json({csrfToken:token},{headers:{'Cache-Control':'no-store'}});
 response.cookies.set(cfg.csrfCookie,token,{...cookieOptions(cfg.secure),maxAge:28800});return response;
}
