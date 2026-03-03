import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const protectedRoutes = [
  '/upload',
  '/profile',
  '/subscriptions',
  '/library',
  '/notifications',
  '/suspended',
  '/studio',
  '/admin',
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const { supabase, response } = await updateSession(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route),
  );

  if (!user && isProtected) {
    const redirectUrl = new URL('/sign-in', request.url);
    redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && !pathname.startsWith('/api')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('suspended')
      .eq('id', user.id)
      .maybeSingle();

    const isSuspended = Boolean(profile?.suspended);

    if (isSuspended && pathname !== '/suspended') {
      return NextResponse.redirect(new URL('/suspended', request.url));
    }

    if (!isSuspended && pathname === '/suspended') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
