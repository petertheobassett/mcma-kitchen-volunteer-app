import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE_NAME,
  adminSessionCookieOptions,
  getAdminSessionToken,
  isValidAdminPassword,
} from '@/lib/admin-auth';
import { normalizeText } from '@/lib/input-security';
import { rateLimit } from '@/lib/rate-limit';

function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown-ip';
}

export async function POST(request) {
  const clientIp = getClientIp(request);
  const limiter = rateLimit({
    key: `admin-login:${clientIp}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!limiter.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const password = normalizeText(body?.password, 200);
    const sessionToken = getAdminSessionToken();

    if (!password || !sessionToken) {
      return NextResponse.json({ error: 'Invalid login configuration' }, { status: 500 });
    }

    if (!isValidAdminPassword(password)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const response = NextResponse.json({ status: 'OK' });
    response.cookies.set(ADMIN_SESSION_COOKIE_NAME, sessionToken, adminSessionCookieOptions());
    return response;
  } catch (error) {
    console.error('Admin login failed:', error);
    return NextResponse.json({ error: 'Unable to complete login' }, { status: 500 });
  }
}
