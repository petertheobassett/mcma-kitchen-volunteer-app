import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE_NAME, adminSessionCookieOptions } from '@/lib/admin-auth';

export async function POST() {
  const response = NextResponse.json({ status: 'OK' });
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, '', {
    ...adminSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
