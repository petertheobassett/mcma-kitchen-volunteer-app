'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <AdminLoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <main style={wrapperStyle}>
      <form style={formStyle}>
        <h1 style={titleStyle}>Admin Login</h1>
        <p style={helperTextStyle}>
          Whoops, if you are looking to sign up for an event, click{' '}
          <a href="/signup" style={signupLinkStyle}>
            here
          </a>
          .
        </p>
      </form>
    </main>
  );
}

function AdminLoginForm() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = searchParams.get('next') || '/';

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setStatus('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setStatus(result.error || 'Login failed');
        setSubmitting(false);
        return;
      }

      window.location.href = redirectTo;
    } catch {
      setStatus('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <main style={wrapperStyle}>
      <form onSubmit={handleSubmit} style={formStyle}>
        <h1 style={titleStyle}>Admin Login</h1>
        <p style={helperTextStyle}>
          Whoops, if you are looking to sign up for an event, click{' '}
          <a href="/signup" style={signupLinkStyle}>
            here
          </a>
          .
        </p>
        <label htmlFor="password" style={labelStyle}>
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          style={inputStyle}
          autoComplete="current-password"
          required
        />
        <button type="submit" style={buttonStyle} disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
        {status && <p style={statusStyle}>{status}</p>}
      </form>
    </main>
  );
}

const wrapperStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  backgroundColor: '#f4f4f4',
};

const formStyle = {
  width: '100%',
  maxWidth: 360,
  backgroundColor: '#fff',
  borderRadius: 14,
  border: '1px solid #ddd',
  padding: 24,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.07)',
};

const titleStyle = {
  margin: '0 0 14px 0',
  fontSize: '1.4rem',
};

const helperTextStyle = {
  margin: '0 0 12px 0',
  fontSize: '0.9rem',
  lineHeight: 1.4,
  color: '#444',
};

const signupLinkStyle = {
  color: '#0a57d5',
  textDecoration: 'underline',
};

const labelStyle = {
  display: 'block',
  marginBottom: 6,
  fontSize: '0.95rem',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #bbb',
  marginBottom: 14,
};

const buttonStyle = {
  width: '100%',
  border: 'none',
  backgroundColor: '#111',
  color: '#fff',
  borderRadius: 8,
  padding: '10px 12px',
  cursor: 'pointer',
};

const statusStyle = {
  marginTop: 12,
  fontSize: '0.9rem',
  color: '#b00020',
};
