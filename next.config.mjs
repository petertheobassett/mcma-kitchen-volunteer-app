/** @type {import('next').NextConfig} */
const contentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://mcma.s3.us-east-1.amazonaws.com;
  font-src 'self' data:;
  connect-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/;
  frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`.replace(/\s{2,}/g, ' ').trim();

const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
