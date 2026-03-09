'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Header({ autoCollapse = false }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Collapse menu on navigation
  useEffect(() => {
    if (!autoCollapse) return;
    const handleRouteChange = () => setOpen(false);
    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('hashchange', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [autoCollapse]);

  const handleToggle = () => setOpen(prev => !prev);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      window.location.href = '/admin/login';
    }
  }

  return (
    <header style={headerStyle}>
      <div style={stickyWrapper}>
        <div style={navBar}>
          <button onClick={handleToggle} style={menuButton} aria-label="Toggle menu">
            {open ? '✕' : '☰'}
          </button>
          <span style={logoText}>MCMA Kitchen</span>
        </div>
        {open && (
          <nav style={{ ...dropdown, animation: 'fadeIn 0.2s ease-out' }}>
            <Link href="/signup" style={linkStyle}>Volunteer Signup</Link>
            <Link href="/admin/review-signups" style={linkStyle}>Review Signups</Link>
            <Link href="/" style={linkStyle}>Dashboard</Link>
            <button onClick={handleLogout} style={logoutButtonStyle} disabled={loggingOut}>
              {loggingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </nav>
        )}
      </div>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-color-scheme: dark) {
          header {
            background-color: #111 !important;
          }
          nav {
            background-color: #222 !important;
          }
          a {
            color: #eee !important;
          }
        }
      `}</style>
    </header>
  );
}

const headerStyle = {
  backgroundColor: '#000',
  color: '#fff',
  padding: '0 24px',
  position: 'sticky',
  top: 0,
  zIndex: 1000,
};

const stickyWrapper = {
  padding: '12px 0',
};

const navBar = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const logoText = {
  fontWeight: 600,
  fontSize: '1.2em',
};

const menuButton = {
  fontSize: '1.5em',
  background: 'none',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
};

const dropdown = {
  marginTop: 12,
  backgroundColor: '#111',
  padding: '12px 0',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const linkStyle = {
  color: '#fff',
  textDecoration: 'none',
  padding: '8px 24px',
  fontSize: '0.95em',
};

const logoutButtonStyle = {
  color: '#fff',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  padding: '8px 24px',
  fontSize: '0.95em',
  cursor: 'pointer',
};
