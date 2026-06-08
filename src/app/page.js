'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedRow, setUpdatedRow] = useState(null);
  const [updatedMessage, setUpdatedMessage] = useState('');

  useEffect(() => {
    fetch('/api/get-events')
      .then(res => {
        if (res.status === 401) {
          window.location.href = '/admin/login?next=/';
          return [];
        }
        return res.json();
      })
      .then(data => {
        setEvents(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Fetch failed:', err);
        setLoading(false);
      });
  }, []);

  function toggleAttendance(row, index, checked) {
    fetch('/api/update-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        row,
        index,
        checked
      }),
    })
    .then(res => {
      if (res.status === 401) {
        window.location.href = '/admin/login?next=/';
        return { status: 'UNAUTHORIZED' };
      }
      return res.json();
    })
    .then(data => {
      if (data.status === 'UNAUTHORIZED') return;

      if (data.status === 'OK') {
        setUpdatedRow(row);
        setUpdatedMessage('Attendance saved ✔');

        // ✅ Re-fetch the updated event data
        fetch('/api/get-events')
          .then(res => {
            if (res.status === 401) {
              window.location.href = '/admin/login?next=/';
              return [];
            }
            return res.json();
          })
          .then(data => setEvents(data || []));
      } else {
        setUpdatedRow(row);
        setUpdatedMessage('Error saving attendance');
      }

      setTimeout(() => setUpdatedRow(null), 2000);
    })
    .catch(() => {
      setUpdatedRow(row);
      setUpdatedMessage('Network error');
      setTimeout(() => setUpdatedRow(null), 2000);
    });
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const pastEvents = [];
  const futureEvents = [];

  if (Array.isArray(events)) {
    events.forEach((eventObj, index) => {
      const [yyyy, mm, dd] = eventObj.date.split('-').map(Number);
      const parsedDate = new Date(yyyy, mm - 1, dd);
      if (isNaN(parsedDate) || parsedDate.getFullYear() < 2000) return;

      const eventDay = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
      const row = [...eventObj.raw, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];

      const eventData = {
        row,
        rowIndex: index,
        parsedDate,
      };

      if (eventDay >= today) {
        futureEvents.push(eventData);
      } else {
        pastEvents.push(eventData);
      }
    });

    futureEvents.sort((a, b) => a.parsedDate - b.parsedDate);
    pastEvents.sort((a, b) => b.parsedDate - a.parsedDate);
  }

  function renderEventGroup(eventsList, title, color) {
    const ATTENDANCE_COLUMN_START = 19;
    const isPast = color === 'black';

    return (
      <>
        <h3 className={`section-title ${isPast ? 'past' : 'future'}`}>{title}</h3>
        {eventsList.map(({ row, rowIndex, parsedDate }) => {
          const formattedDate = parsedDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          const [
            , eventName = '', expected = '', volunteersNeeded = '', lead = '', leadPhone = '',
            vol1 = '', phone1 = '', vol2 = '', phone2 = '',
            vol3 = '', phone3 = '', vol4 = '', phone4 = '',
            vol5 = '', phone5 = '', vol6 = '', phone6 = '',
            att1 = '', att2 = '', att3 = '', att4 = '', att5 = '', att6 = ''
          ] = row;

          const sheetRow = rowIndex + 2;

          return (
            <div key={rowIndex} className="event-card" style={{ ...eventCardStyle, marginTop: rowIndex === 0 ? 24 : 12 }}>
              <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '1.05em', textAlign: 'center' }}>
                {eventName}<br />
                <span style={{ fontWeight: 400, display: 'inline-block', marginTop: '4px', marginBottom: '4px' }}>
                  ({formattedDate})
                </span>
                {expected && (
                  <div style={{ marginTop: '6px', fontSize: '0.95em' }}>
                    Expected attendees: {expected}
                  </div>
                )}
                {volunteersNeeded && (
                  <div style={{ marginTop: '6px', fontSize: '0.95em' }}>
                    Volunteers needed: {volunteersNeeded}
                  </div>
                )}
                {lead && (
                  <div style={{ marginTop: '10px', marginBottom: '20px', fontSize: '0.95em' }}>
                    Kitchen lead: {lead}<br />
                    {leadPhone && (
                      <a href={`sms:${leadPhone}`} style={{ color: '#0079c2', textDecoration: 'none', display: 'inline-block', marginTop: '10px' }}>
                        {leadPhone}
                      </a>
                    )}
                  </div>
                )}
              </div>

              {[
                [vol1, phone1, att1], [vol2, phone2, att2],
                [vol3, phone3, att3], [vol4, phone4, att4],
                [vol5, phone5, att5], [vol6, phone6, att6]
              ].map(([vol, phone, att], i) => (
                vol ? (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={att.trim() === '👍'}
                        onChange={e => toggleAttendance(sheetRow, ATTENDANCE_COLUMN_START + i, e.target.checked)}
                      /> {vol}
                    </label>
                    {phone && (
                      <a href={`sms:${phone}`} style={buttonStyle}>{phone}</a>
                    )}
                  </div>
                ) : null
              ))}

              {updatedRow === sheetRow && (
                <div style={inlineToastStyle}>{updatedMessage}</div>
              )}
            </div>
          );
        })}
      </>
    );
  }

  if (loading) {
    return (
      <div style={loaderWrapper}>
        <div style={spinnerStyle} />
        <style jsx global>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
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
          <h2 style={titleStyle}>Volunteer Dashboard</h2>
        </div>

        {renderEventGroup(futureEvents, '🔵 Upcoming Events', 'navy')}
        {renderEventGroup(pastEvents, '⚫ Past Events', 'black')}

        <style jsx global>{`
          body {
            background-color: #f4f4f4;
            color: #000;
            transition: background-color 0.3s ease, color 0.3s ease;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }

          .event-card {
            background-color: #ffffff;
            border: 1px solid #e5e5e5;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.05);
            color: #000000;
          }

          .section-title {
            margin-top: 40px;
            font-size: 1.25em;
            font-weight: 600;
          }

          .section-title.future {
            color: navy;
          }

          .section-title.past {
            color: black;
          }

          @media (prefers-color-scheme: dark) {
            body {
              background-color: #121212;
              color: #ffffff;
            }

            .event-card {
              background-color: #1e1e1e;
              border-color: #333;
              color: #ffffff;
            }

            .section-title.future {
              color: #66aaff;
            }

            .section-title.past {
              color: #ccc;
            }

            a[href^="sms:"] {
              background-color: #2980b9 !important;
              color: white !important;
            }
          }
        `}</style>
      </div>
    </>
  );
}

// Styles
const pageWrapper = { maxWidth: 720, margin: '0 auto', padding: 32 };
const titleStyle = { textAlign: 'center', fontSize: '1.8em', fontWeight: 600 };
const eventCardStyle = { padding: 24, borderRadius: 16, border: '1px solid', boxShadow: '0 8px 30px rgba(0,0,0,0.05)', marginBottom: 32 };
const buttonStyle = { marginLeft: 'auto', background: '#0079c2', color: 'white', padding: '6px 12px', borderRadius: '8px', textDecoration: 'none', fontSize: '0.9em', fontFamily: 'monospace', transition: 'background-color 0.2s ease' };
const inlineToastStyle = { marginTop: '16px', backgroundColor: '#ff0003', color: '#fff', padding: '8px 16px', borderRadius: '6px', fontSize: '0.95em', textAlign: 'center' };
const loaderWrapper = { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f4f4' };
const spinnerStyle = { width: '36px', height: '36px', border: '3px solid rgba(0, 0, 0, 0.1)', borderTop: '3px solid rgba(0, 0, 0, 0.7)', borderRadius: '50%', animation: 'spin 1s linear infinite' };
