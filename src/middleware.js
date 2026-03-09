import { NextResponse } from 'next/server';

const ADMIN_SESSION_COOKIE_NAME = 'mcma_admin_session';
const PROTECTED_PATHS = new Set([
  '/',
  '/admin/review-signups',
  '/api/get-events',
  '/api/update-attendance',
  '/api/signups-overview',
  '/api/add-to-directory',
  '/api/confirm-to-event',
]);

function hasValidSession(request) {
  const expectedToken = process.env.ADMIN_SESSION_TOKEN || '';
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value || '';
  return Boolean(expectedToken) && token === expectedToken;
}

export function middleware(request) {
  const { pathname, search } = request.nextUrl;
  const isLoginPage = pathname === '/admin/login';
  const isProtected = PROTECTED_PATHS.has(pathname);
  const isApiRoute = pathname.startsWith('/api/');
  const isAuthenticated = hasValidSession(request);

  if (isLoginPage && isAuthenticated) {
    const redirectTarget = request.nextUrl.searchParams.get('next') || '/';
    return NextResponse.redirect(new URL(redirectTarget, request.url));
  }

  if (!isProtected || isAuthenticated) {
    return NextResponse.next();
  }

  if (isApiRoute) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/admin/login', request.url);
  loginUrl.searchParams.set('next', `${pathname}${search || ''}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/',
    '/admin/login',
    '/admin/review-signups',
    '/api/get-events',
    '/api/update-attendance',
    '/api/signups-overview',
    '/api/add-to-directory',
    '/api/confirm-to-event',
  ],
};
