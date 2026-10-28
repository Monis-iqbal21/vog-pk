import {NextResponse} from 'next/server';
import {safeReturnPath} from './lib/return-path';

// Context forwarding only. Sessions and permissions are verified in the server
// data boundary and NestJS, never by assuming a browser cookie is trustworthy.
export function proxy(request){
 const headers=new Headers(request.headers);
 headers.set('x-vog-admin-return-to',safeReturnPath(request.nextUrl.pathname+request.nextUrl.search));
 return NextResponse.next({request:{headers}});
}
export const config={matcher:['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|vog-logo.png).*)']};
