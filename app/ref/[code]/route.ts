import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  let normalized = (code || '').trim();
  try {
    normalized = decodeURIComponent(normalized).trim();
  } catch {
    // If the path contains a malformed escape sequence, avoid crashing the route.
    normalized = (code || '').trim();
  }

  if (normalized && !normalized.startsWith('@')) normalized = `@${normalized}`;

  const base = new URL(request.url);
  const url = new URL('/sign-up', base.origin);
  if (normalized) url.searchParams.set('ref', normalized);
  url.searchParams.set('redirect', '/streaks');

  const res = NextResponse.redirect(url);
  const secure = base.protocol === 'https:';
  res.cookies.set('vt_ref', normalized, {
    httpOnly: false,
    sameSite: 'lax',
    secure,
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return res;
}
