import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const normalized = decodeURIComponent(code || '').trim();

  const url = new URL('/sign-up', 'http://localhost');
  url.searchParams.set('ref', normalized);
  url.searchParams.set('redirect', '/streaks');

  const res = NextResponse.redirect(url.pathname + url.search);
  res.cookies.set('vt_ref', normalized, {
    httpOnly: false,
    sameSite: 'lax',
    secure: true,
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return res;
}

