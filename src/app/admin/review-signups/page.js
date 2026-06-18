'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';

export default function ReviewSignupsPage() {
  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusRow, setStatusRow] = useState(null);
  const [removedRows, setRemovedRows] = useState([]);
  const [fadingRows, setFadingRows] = useState([]);
  const [confirmedRows, setConfirmedRows] = useState([]);
  const [pendingRemoval, setPendingRemoval] = useState(null);

  const getSignupKey = (vol) => vol.id;
  const statusTone = getStatusTone(statusMessage);

  const fetchSignups = async () => {
    try {
      const res = await fetch('/api/signups-overview');
      if (res.status === 401) {
        window.location.href = '/admin/login?next=/admin/review-signups';
        return;
      }
      const data = await res.json();

      if (!Array.isArray(data)) {
        console.error('❌ Invalid API response:', data);
        setStatusRow(null);
        return;
      }

      setSignups([...data].reverse());
    } catch (err) {
      console.error('❌ Network or parse error:', err);
      setStatusRow(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignups();
  }, []);

  const handleConfirm = async (vol, row) => {
    const key = getSignupKey(vol);
    setStatusRow(row);
    setStatusMessage('⏳ Updating contact info...');

    try {
      const dirRes = await fetch('/api/add-to-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: vol.name, phone: vol.phone, email: vol.email }),
      });
      if (dirRes.status === 401) {
        window.location.href = '/admin/login?next=/admin/review-signups';
        return;
      }

      const dirResult = await dirRes.json();
      const dirMsg = dirResult.phoneUpdated
        ? `📇 Contact info updated`
        : dirResult.message || `📇 Already in directory`;

      setStatusMessage(`${dirMsg} – confirming...`);

      const confirmRes = await fetch('/api/confirm-to-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: vol.name,
          phone: vol.phone,
          eventName: vol.event,
          eventDate: vol.eventDate,
        }),
      });
      if (confirmRes.status === 401) {
        window.location.href = '/admin/login?next=/admin/review-signups';
        return;
      }

      const confirmResult = await confirmRes.json();
      const confirmMsg = confirmResult.message || 'Confirmed';

      setStatusMessage(`✅ ${dirMsg} + ${confirmMsg}`);
      setConfirmedRows((prev) => [...prev, key]);

      setTimeout(() => {
        setFadingRows((prev) => [...prev, key]);
      }, 300);

      setTimeout(() => {
        setRemovedRows((prev) => [...prev, key]);
        setFadingRows((prev) => prev.filter((k) => k !== key));
        setStatusRow(null);
        fetchSignups(); // delayed refresh
      }, 700); // animation duration + buffer
    } catch (err) {
      console.error('❌ Confirmation error:', err);
      setStatusMessage('❌ Failed to confirm volunteer.');
      setStatusRow(null);
    }
  };

  const handleClearRecord = async (vol, row) => {
    const key = getSignupKey(vol);
    setStatusRow(row);
    setStatusMessage('⏳ Removing volunteer from the event...');
    setPendingRemoval(null);

    try {
      const res = await fetch('/api/delete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetRow: vol.sheetRow,
          name: vol.name,
          phone: vol.phone,
          eventName: vol.event,
          eventDate: vol.eventDate,
        }),
      });

      if (res.status === 401) {
        window.location.href = '/admin/login?next=/admin/review-signups';
        return;
      }

      const result = await res.json();
      if (!res.ok) {
        setStatusMessage(`❌ ${result.error || 'Failed to remove volunteer from the event.'}`);
        return;
      }

      setStatusMessage('✅ Volunteer removed from Volunteer Signups and Schedule of Events');
      setFadingRows((prev) => [...prev, key]);

      setTimeout(() => {
        setRemovedRows((prev) => [...prev, key]);
        setFadingRows((prev) => prev.filter((k) => k !== key));
        setStatusRow(null);
        fetchSignups();
      }, 700);
    } catch (err) {
      console.error('❌ Clear signup error:', err);
      setStatusMessage('❌ Failed to remove volunteer from the event.');
    }
  };

  const promptRemoval = (vol, row) => {
    setPendingRemoval({ vol, row });
  };

  const dismissRemovalPrompt = () => {
    setPendingRemoval(null);
  };

  function parseYMDToLocal(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function getWeekdayAbbr(dateStr) {
    const date = parseYMDToLocal(dateStr);
    return isNaN(date)
      ? ''
      : date.toLocaleDateString('en-US', {
          weekday: 'short',
          timeZone: 'America/Los_Angeles',
        });
  }

  if (loading) {
    return (
      <div style={loaderWrapper}>
        <div style={spinnerStyle} />
        <style jsx global>{`
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <Header autoCollapse={true} />
      <div style={pageWrapper}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="https://mcma.s3.us-east-1.amazonaws.com/mcmaLogo.png"
            alt="MCMA Kitchen Logo"
            style={{ maxWidth: 120, marginBottom: 12 }}
          />
          <h2 style={titleStyle}>🧑‍🍳 Review Volunteer Signups</h2>
        </div>

        {signups
          .filter((vol) => !removedRows.includes(getSignupKey(vol)))
          .map((vol, i) => {
            const key = getSignupKey(vol);
            const isFading = fadingRows.includes(key);
            const isConfirmed = confirmedRows.includes(key);

            return (
              <div
                key={key}
                className={`event-card ${isFading ? 'fade-out' : ''}`}
                style={{ ...eventCardStyle, position: 'relative' }}
              >
                {isConfirmed && <div style={checkmarkStyle}>✅</div>}

                <div style={{ marginBottom: 12 }}>
                  <strong>{vol.name}</strong>
                  <div style={{ fontSize: '0.9em', marginTop: 6 }}>{vol.email}</div>
                  <div style={{ fontSize: '0.9em', marginTop: 2 }}>📞 {vol.phone}</div>
                  <div style={{ fontSize: '0.9em', marginTop: 6 }}>
                    🗓️ {getWeekdayAbbr(vol.eventDate)} –{' '}
                    {parseYMDToLocal(vol.eventDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      timeZone: 'America/Los_Angeles',
                    })}{' '}
                    – {vol.event}
                  </div>
                  {vol.rating && (
                    <div style={{ fontSize: '0.9em', marginTop: 6 }}>⭐ Rating: {vol.rating}</div>
                  )}
                  {vol.lastEvent && (
                    <div style={{ fontSize: '0.9em', marginTop: 6 }}>
                      🕓 Last: {vol.lastEvent} (
                      {new Date(vol.lastDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'America/Los_Angeles',
                      })}
                      )
                    </div>
                  )}
                  <div style={{ fontSize: '0.9em', marginTop: 6 }}>
                    🧍‍♂️ Spots left: {vol.spotsLeft}
                  </div>
                </div>

                <div style={actionRowStyle}>
                  {vol.spotsLeft === 0 ? (
                    <button disabled style={{ ...buttonStyle('gray'), ...actionButtonStyle }}>
                      ❌ Event Full
                    </button>
                  ) : vol.lastEvent === vol.event ? (
                    <button disabled style={{ ...buttonStyle('green'), ...actionButtonStyle }}>
                      ✅ Volunteer Confirmed
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConfirm(vol, i)}
                      style={{ ...buttonStyle('blue'), ...actionButtonStyle }}
                    >
                      ✅ Confirm to Event
                    </button>
                  )}
                  <button
                    onClick={() => promptRemoval(vol, i)}
                    style={{ ...buttonStyle('red'), ...actionButtonStyle }}
                  >
                    🗑️ Remove From Event
                  </button>
                </div>

                {statusRow === i && (
                  <div style={{ ...inlineStatusStyle, ...inlineStatusToneStyles[statusTone] }}>
                    {statusMessage}
                  </div>
                )}
              </div>
            );
          })}

        {pendingRemoval && (
          <div style={modalBackdropStyle} onClick={dismissRemovalPrompt}>
            <div
              style={modalCardStyle}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="remove-volunteer-title"
            >
              <div style={modalBadgeStyle}>Remove Volunteer</div>
              <h3 id="remove-volunteer-title" style={modalTitleStyle}>
                Remove {pendingRemoval.vol.name} from this event?
              </h3>
              <p style={modalBodyStyle}>
                This will remove them from both <strong>Volunteer Signups</strong> and the matching
                <strong> Schedule of Events</strong> row.
              </p>
              <div style={modalEventSummaryStyle}>
                <div>{pendingRemoval.vol.event}</div>
                <div style={modalEventMetaStyle}>
                  {getWeekdayAbbr(pendingRemoval.vol.eventDate)} {parseYMDToLocal(pendingRemoval.vol.eventDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'America/Los_Angeles',
                  })}
                </div>
              </div>
              <div style={modalActionRowStyle}>
                <button
                  type="button"
                  onClick={dismissRemovalPrompt}
                  style={modalSecondaryButtonStyle}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleClearRecord(pendingRemoval.vol, pendingRemoval.row)}
                  style={modalDangerButtonStyle}
                >
                  Remove From Event
                </button>
              </div>
            </div>
          </div>
        )}

        <style jsx global>{`
          body {
            background-color: #f4f4f4;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial,
              sans-serif;
            color: #000;
          }

          .event-card {
            background-color: #fff;
            border: 1px solid #e5e5e5;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.05);
            margin-bottom: 24px;
            transition: all 300ms ease;
          }

          .fade-out {
            opacity: 0;
            transform: translateY(-10px);
            pointer-events: none;
          }

          @media (prefers-color-scheme: dark) {
            body {
              background-color: #121212;
              color: #fff;
            }

            .event-card {
              background-color: #1e1e1e;
              border-color: #333;
              color: #fff;
            }
          }
        `}</style>
      </div>
    </>
  );
}

function getStatusTone(message) {
  if (!message) return 'neutral';
  if (message.startsWith('✅')) return 'success';
  if (message.startsWith('❌')) return 'error';
  return 'neutral';
}

const pageWrapper = {
  maxWidth: 720,
  margin: '0 auto',
  padding: 24,
};

const titleStyle = {
  textAlign: 'center',
  fontSize: '1.6em',
  fontWeight: 600,
};

const eventCardStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e5e5',
  borderRadius: '16px',
  padding: '24px',
  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.05)',
  marginBottom: '24px',
};

const buttonStyle = (color) => ({
  backgroundColor:
    color === 'green'
      ? '#27ae60'
      : color === 'blue'
      ? '#2980b9'
      : color === 'red'
      ? '#c0392b'
      : color === 'orange'
      ? '#f39c12'
      : '#aaa',
  color: 'white',
  padding: '8px 12px',
  borderRadius: '8px',
  fontSize: '0.95em',
  border: 'none',
  cursor: color === 'gray' ? 'not-allowed' : 'pointer',
});

const actionRowStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
};

const actionButtonStyle = {
  flex: '1 1 220px',
};

const inlineStatusStyle = {
  marginTop: '14px',
  padding: '12px 14px',
  borderRadius: '12px',
  fontSize: '0.93em',
  fontWeight: 600,
  lineHeight: 1.4,
  border: '1px solid transparent',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
};

const inlineStatusToneStyles = {
  success: {
    color: '#166534',
    background: '#ecfdf3',
    borderColor: '#bbf7d0',
  },
  error: {
    color: '#991b1b',
    background: '#fef2f2',
    borderColor: '#fecaca',
  },
  neutral: {
    color: '#1f2937',
    background: '#f8fafc',
    borderColor: '#dbe3ee',
  },
};

const loaderWrapper = {
  height: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f4f4f4',
};

const spinnerStyle = {
  width: '36px',
  height: '36px',
  border: '3px solid rgba(0, 0, 0, 0.1)',
  borderTop: '3px solid rgba(0, 0, 0, 0.7)',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const checkmarkStyle = {
  position: 'absolute',
  top: 10,
  right: 14,
  fontSize: '1.5em',
  opacity: 1,
  transition: 'opacity 0.3s ease',
};

const modalBackdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.38)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  zIndex: 1000,
};

const modalCardStyle = {
  width: '100%',
  maxWidth: '540px',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  borderRadius: '24px',
  padding: '28px',
  boxShadow: '0 30px 80px rgba(15, 23, 42, 0.22)',
};

const modalBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 10px',
  borderRadius: '999px',
  background: '#fef2f2',
  color: '#991b1b',
  border: '1px solid #fecaca',
  fontSize: '0.78em',
  fontWeight: 700,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
};

const modalTitleStyle = {
  margin: '16px 0 10px',
  fontSize: '1.65em',
  lineHeight: 1.15,
  fontWeight: 700,
  color: '#0f172a',
};

const modalBodyStyle = {
  margin: 0,
  fontSize: '1.02em',
  lineHeight: 1.6,
  color: '#475569',
};

const modalEventSummaryStyle = {
  marginTop: '18px',
  padding: '16px 18px',
  borderRadius: '16px',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  color: '#0f172a',
  fontWeight: 600,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
};

const modalEventMetaStyle = {
  marginTop: '6px',
  fontSize: '0.92em',
  fontWeight: 500,
  color: '#64748b',
};

const modalActionRowStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  flexWrap: 'wrap',
  marginTop: '22px',
};

const modalSecondaryButtonStyle = {
  padding: '11px 16px',
  borderRadius: '12px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#334155',
  fontSize: '0.95em',
  fontWeight: 600,
  cursor: 'pointer',
};

const modalDangerButtonStyle = {
  padding: '11px 16px',
  borderRadius: '12px',
  border: '1px solid #b91c1c',
  background: '#c0392b',
  color: '#ffffff',
  fontSize: '0.95em',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 10px 24px rgba(192, 57, 43, 0.22)',
};
