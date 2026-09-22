import {NextResponse} from 'next/server';
export function middleware(){
 const response=NextResponse.next();
 response.headers.set('Cache-Control','private, no-store');
 return response;
}
export const config={matcher:['/','/api/:path*']};
