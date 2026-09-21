import { NextResponse, type NextRequest } from 'next/server';

/**
 * The chosen language travels either in the URL (?lang=hi) — so that links can
 * be shared and bookmarked — or in a cookie for the plain URLs.  The middleware
 * normalises both into an `x-lang` request header that server components read
 * through lib/lang.ts.
 */
export function middleware(request: NextRequest) {
  const param = request.nextUrl.searchParams.get('lang');
  const cookie = request.cookies.get('lang')?.value;
  const valid = (v: string | null | undefined): v is 'en' | 'hi' | 'mr' =>
    v === 'en' || v === 'hi' || v === 'mr';
  const lang = valid(param) ? param : valid(cookie) ? cookie : 'en';

  const headers = new Headers(request.headers);
  headers.set('x-lang', lang);

  const response = NextResponse.next({ request: { headers } });
  if (valid(param) && param !== cookie) {
    response.cookies.set('lang', param, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
