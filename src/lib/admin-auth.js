import { timingSafeEqual } from 'crypto';

export const ADMIN_SESSION_COOKIE_NAME = 'mcma_admin_session';
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function safeCompare(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isValidAdminPassword(password) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return false;
  return safeCompare(password, expected);
}

export function getAdminSessionToken() {
  return process.env.ADMIN_SESSION_TOKEN || '';
}

export function isValidAdminSession(token) {
  const expected = getAdminSessionToken();
  if (!expected) return false;
  return safeCompare(token, expected);
}

export function requireAdmin(request) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!isValidAdminSession(token)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  };
}
