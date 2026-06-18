'use client';

import { useEffect, useRef, useState } from 'react';

export default function SignupPage() {
  const [events, setEvents] = useState([]);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [selectedSpotsLeft, setSelectedSpotsLeft] = useState(null);
  const [isEventMenuOpen, setIsEventMenuOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [submittedData, setSubmittedData] = useState(null);
  const eventMenuRef = useRef(null);
  const selectedEvent = events.find(event => event.date === eventDate && event.name === eventName) || null;
  const statusTone = getStatusTone(status);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseYMDToLocal = (dateStr) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    fetch('/api/get-signup-events')
      .then(res => res.json())
      .then(data => {
        const future = data.filter(event => {
          const eventDay = parseYMDToLocal(event.date);
          return eventDay >= today;
        });
        setEvents(future);
      })
      .catch(() => setEvents([]));

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`;
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!eventMenuRef.current?.contains(event.target)) {
        setIsEventMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function formatPhone(input) {
    const digits = input.replace(/\D/g, '').slice(0, 10);
    if (digits.length !== 10) return '';
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function formatEventDate(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatSpotsLeft(spotsLeft) {
    if (spotsLeft === 0) return 'Full';
    if (spotsLeft === 1) return '1 spot left';
    return `${spotsLeft} spots left`;
  }

  function selectEvent(event) {
    if (event.spotsLeft === 0) return;
    setEventDate(event.date);
    setEventName(event.name);
    setSelectedSpotsLeft(event.spotsLeft);
    setIsEventMenuOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(null);

    if (!eventDate || !eventName) {
      setStatus('Please choose an event.');
      return;
    }

    if (selectedSpotsLeft === 0) {
      setStatus('❌ This event is already full. Please choose another.');
      return;
    }

    const formattedPhone = formatPhone(phone);
    if (!formattedPhone) {
      setStatus('❌ Invalid phone number. Please enter 10 digits.');
      return;
    }

    setStatus('Submitting...');

    if (!window.grecaptcha) {
      setStatus('❌ CAPTCHA failed to load. Please try again.');
      return;
    }

    try {
      const token = await window.grecaptcha.execute(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY, { action: 'submit' });

      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName,
          eventDate,
          name,
          phone: formattedPhone,
          email,
          token,
        }),
      });

      const result = await res.json();
      if (res.ok) {
        setStatus('✅ Signed up successfully!');
        setSubmittedData(result.submitted);
        setEventName('');
        setEventDate('');
        setSelectedSpotsLeft(null);
        setName('');
        setPhone('');
        setEmail('');
      } else {
        setStatus(`❌ ${result.error}`);
      }
    } catch (err) {
      setStatus('❌ Something went wrong. Please try again.');
    }
  }

  return (
    <>
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img
            src="https://mcma.s3.us-east-1.amazonaws.com/mcmaLogo.png"
            alt="MCMA Kitchen Logo"
            style={{ maxWidth: 120, marginBottom: 12 }}
          />
          <h2 style={titleStyle}>Kitchen Volunteer Signup</h2>
        </div>

        {submittedData ? (
          <>
            <div className="confirmation-box" style={confirmationBox}>
              <h3 style={confirmationHeadingStyle}>✅ You're signed up!</h3>
              <p><strong>Event:</strong> {submittedData.eventName}</p>
              <p><strong>Date:</strong> {submittedData.formattedEventDate}</p>
              {submittedData.formattedEventTime && <p><strong>Time:</strong> {submittedData.formattedEventTime}</p>}
              <p><strong>Name:</strong> {submittedData.name}</p>
              <p><strong>Phone:</strong> {submittedData.formattedPhone}</p>
              <p><strong>Email:</strong> {submittedData.email}</p>
              <p style={{ marginTop: 20 }}>You’ll receive an email confirmation shortly.</p>
            </div>
            <p style={disclaimerStyle}>
              We respect your privacy. Your information is used only for coordinating volunteers. It will never be sold or shared.
            </p>
          </>
        ) : (
          <>
            <form onSubmit={handleSubmit} style={formStyle}>
              <div style={fieldStyle}>
                <label htmlFor="event" style={labelStyle}>Event</label>
                <div ref={eventMenuRef} style={dropdownStyle}>
                  <button
                    className="event-trigger"
                    id="event"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isEventMenuOpen}
                    onClick={() => setIsEventMenuOpen(open => !open)}
                    style={{
                      ...eventTriggerStyle,
                      borderColor: isEventMenuOpen ? '#6b7280' : eventTriggerStyle.borderColor,
                    }}
                  >
                    {eventDate && eventName ? (
                      <span style={selectedEventStyle}>
                        <span style={selectedEventNameStyle}>{eventName}</span>
                        <span style={selectedEventDateStyle}>{formatEventDate(eventDate)}</span>
                        {selectedEvent?.timeLabel && <span style={selectedEventTimeStyle}>{selectedEvent.timeLabel}</span>}
                      </span>
                    ) : (
                      <span style={placeholderStyle}>Select an event</span>
                    )}
                    <span style={triggerMetaStyle}>
                      {selectedSpotsLeft !== null && (
                        <span
                          style={{
                            ...spotsBadgeStyle,
                            ...(selectedSpotsLeft === 0 ? fullBadgeStyle : openBadgeStyle),
                          }}
                        >
                          {formatSpotsLeft(selectedSpotsLeft)}
                        </span>
                      )}
                      <span style={chevronStyle}>▼</span>
                    </span>
                  </button>

                  {isEventMenuOpen && (
                    <div className="event-list" role="listbox" aria-labelledby="event" style={eventListStyle}>
                      {events.map(event => {
                        const isSelected = event.date === eventDate && event.name === eventName;
                        const isFull = event.spotsLeft === 0;

                        return (
                          <button
                            className="event-option"
                            key={`${event.date}---${event.name}`}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            aria-disabled={isFull}
                            disabled={isFull}
                            onClick={() => selectEvent(event)}
                            style={{
                              ...eventOptionStyle,
                              ...(isSelected ? selectedOptionStyle : {}),
                              ...(isFull ? fullOptionStyle : {}),
                            }}
                          >
                            <span style={eventOptionTextStyle}>
                              <span style={eventOptionNameStyle}>{event.name}</span>
                              <span style={eventOptionDateStyle}>{formatEventDate(event.date)}</span>
                              {event.timeLabel && <span style={eventOptionTimeStyle}>{event.timeLabel}</span>}
                            </span>
                            <span
                              style={{
                                ...spotsBadgeStyle,
                                ...(isFull ? fullBadgeStyle : openBadgeStyle),
                              }}
                            >
                              {formatSpotsLeft(event.spotsLeft)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {selectedSpotsLeft === 0 && (
                  <p style={{ color: 'red', marginTop: 6, fontSize: '0.9em' }}>
                    ❌ This event is full. Please choose another.
                  </p>
                )}
              </div>

              <div style={fieldStyle}>
                <label htmlFor="name" style={labelStyle}>Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <div style={fieldStyle}>
                <label htmlFor="phone" style={labelStyle}>Phone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onBlur={e => {
                    const formatted = formatPhone(e.target.value);
                    if (formatted) setPhone(formatted);
                    else setStatus('❌ Invalid phone number (must be 10 digits)');
                  }}
                  style={inputStyle}
                  required
                />
              </div>

              <div style={fieldStyle}>
                <label htmlFor="email" style={labelStyle}>Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <button type="submit" style={{
                ...buttonStyle,
                backgroundColor: selectedSpotsLeft === 0 ? '#aaa' : buttonStyle.backgroundColor,
                cursor: selectedSpotsLeft === 0 ? 'not-allowed' : 'pointer'
              }} disabled={selectedSpotsLeft === 0}>
                Submit
              </button>

              {status && <p style={{ ...statusMessageStyle, ...statusToneStyles[statusTone] }}>{status}</p>}
            </form>
            <p style={disclaimerStyle}>
              We respect your privacy. Your information is used only for coordinating volunteers. It will never be sold or shared.
            </p>
          </>
        )}

        <style jsx global>{`
          body {
            background-color: #ffffff;
            color: #000000;
            transition: background-color 0.3s ease, color 0.3s ease;
          }

          @media (prefers-color-scheme: dark) {
            body {
              background-color: #121212;
              color: #ffffff;
            }

            form {
              background: #1e1e1e !important;
              border-color: #333 !important;
            }

            input, select {
              background-color: #2a2a2a !important;
              color: #ffffff !important;
              border-color: #444 !important;
            }

            label {
              color: #ccc !important;
            }

            button[type="submit"] {
              background-color: #e0e0e0 !important;
              color: #000 !important;
            }

            .event-trigger {
              background-color: #2a2a2a !important;
              color: #ffffff !important;
              border-color: #444 !important;
            }

            .event-list {
              background-color: #1f1f1f !important;
              border-color: #333 !important;
              box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35) !important;
            }

            .event-option {
              color: #ffffff !important;
            }

            .confirmation-box {
              background: #1f1f1f !important;
              border-color: #333 !important;
            }
          }
        `}</style>
      </div>
    </>
  );
}

function getStatusTone(status) {
  if (!status) return 'neutral';
  if (status.startsWith('✅')) return 'success';
  if (status.startsWith('❌')) return 'error';
  return 'neutral';
}

// Styles
const containerStyle = {
  maxWidth: 540,
  margin: '0 auto',
  padding: 32,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const titleStyle = {
  textAlign: 'center',
  fontSize: '1.8em',
  fontWeight: 600,
  marginBottom: 28,
};

const formStyle = {
  background: '#fff',
  padding: 32,
  borderRadius: 16,
  boxShadow: '0 8px 30px rgba(0,0,0,0.05)',
  border: '1px solid #e5e5e5',
};

const fieldStyle = {
  marginBottom: 20,
};

const labelStyle = {
  display: 'block',
  marginBottom: 6,
  fontSize: '0.95em',
  fontWeight: 500,
  color: '#333',
};

const confirmationHeadingStyle = {
  marginBottom: 16,
  fontSize: '1.7em',
  lineHeight: 1.1,
  fontWeight: 700,
  color: '#166534',
};

const dropdownStyle = {
  position: 'relative',
  zIndex: 3,
};

const eventTriggerStyle = {
  width: '100%',
  minHeight: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '8px 12px',
  fontSize: '1em',
  border: '1px solid #ccc',
  borderRadius: 8,
  outline: 'none',
  backgroundColor: '#fff',
  color: '#111827',
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'border 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
};

const selectedEventStyle = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
};

const selectedEventNameStyle = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontWeight: 600,
};

const selectedEventDateStyle = {
  color: '#6b7280',
  fontSize: '0.86em',
};

const selectedEventTimeStyle = {
  color: '#6b7280',
  fontSize: '0.82em',
};

const placeholderStyle = {
  color: '#6b7280',
};

const triggerMetaStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
};

const eventListStyle = {
  position: 'absolute',
  zIndex: 4,
  top: 'calc(100% + 6px)',
  left: 0,
  right: 0,
  maxHeight: 240,
  overflowY: 'auto',
  padding: 6,
  background: '#fff',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  boxShadow: '0 16px 36px rgba(17, 24, 39, 0.14)',
};

const eventOptionStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 10px',
  border: 'none',
  borderRadius: 8,
  background: 'transparent',
  color: '#111827',
  textAlign: 'left',
  cursor: 'pointer',
};

const selectedOptionStyle = {
  background: '#f3f4f6',
};

const fullOptionStyle = {
  cursor: 'not-allowed',
  opacity: 0.62,
};

const eventOptionTextStyle = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
};

const eventOptionNameStyle = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontWeight: 600,
};

const eventOptionTimeStyle = {
  color: '#6b7280',
  fontSize: '0.82em',
};

const eventOptionDateStyle = {
  color: '#6b7280',
  fontSize: '0.86em',
};

const statusMessageStyle = {
  marginTop: 20,
  padding: '14px 16px',
  borderRadius: 12,
  fontSize: '1.02em',
  fontWeight: 700,
  lineHeight: 1.4,
  border: '1px solid transparent',
};

const statusToneStyles = {
  success: {
    color: '#166534',
    background: '#dcfce7',
    borderColor: '#86efac',
  },
  error: {
    color: '#991b1b',
    background: '#fee2e2',
    borderColor: '#fca5a5',
  },
  neutral: {
    color: '#1f2937',
    background: '#f3f4f6',
    borderColor: '#d1d5db',
  },
};

const spotsBadgeStyle = {
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 72,
  padding: '4px 8px',
  borderRadius: 999,
  fontSize: '0.76em',
  fontWeight: 700,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
};

const openBadgeStyle = {
  color: '#166534',
  background: '#dcfce7',
  border: '1px solid #bbf7d0',
};

const fullBadgeStyle = {
  color: '#991b1b',
  background: '#fee2e2',
  border: '1px solid #fecaca',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '1em',
  border: '1px solid #ccc',
  borderRadius: 8,
  outline: 'none',
  backgroundColor: '#fff',
  color: '#000',
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  transition: 'border 0.2s ease-in-out',
};

const chevronStyle = {
  pointerEvents: 'none',
  fontSize: '0.8em',
  color: '#666',
};

const buttonStyle = {
  width: '100%',
  backgroundColor: '#000',
  color: '#fff',
  border: 'none',
  padding: '12px 0',
  borderRadius: 10,
  fontSize: '1em',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background-color 0.2s ease-in-out',
};

const confirmationBox = {
  background: '#f9f9f9',
  padding: 24,
  borderRadius: 12,
  border: '1px solid #ddd',
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  fontSize: '1em',
  lineHeight: 1.6,
};

const disclaimerStyle = {
  fontSize: '0.85em',
  color: '#666',
  marginTop: 32,
  textAlign: 'center',
  lineHeight: 1.5,
};
