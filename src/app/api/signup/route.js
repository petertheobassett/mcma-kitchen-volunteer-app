import { Resend } from 'resend';
import {
  escapeHtml,
  escapeIcsText,
  formatUsPhone,
  isIsoDate,
  normalizeEmail,
  normalizeText,
  sanitizeForSheetCell,
} from '@/lib/input-security';
import { rateLimit } from '@/lib/rate-limit';
import {
  createSheetsClient,
  getEventsSheetName,
  getSheetRange,
  getVolunteerSignupsSheetName,
} from '@/lib/google-sheets';
import {
  EVENT_TIME_ZONE,
  formatCalendarDateTime,
  formatEventTimeRange,
  getEventScheduleFromRow,
} from '@/lib/event-schedule';

const RECAPTCHA_ACTION = 'submit';
const CAPTCHA_TOKEN_MAX_AGE_MS = 5 * 60 * 1000;
const DEFAULT_CAPTCHA_SCORE_THRESHOLD = 0.5;

function generateICS({ eventName, name, email, schedule }) {
  const now = new Date();
  const { start, end } = schedule;
  const formatUtc = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  return `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MCMA Kitchen//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
X-WR-TIMEZONE:${EVENT_TIME_ZONE}
BEGIN:VEVENT
DTSTART;TZID=${EVENT_TIME_ZONE}:${formatCalendarDateTime(start)}
DTEND;TZID=${EVENT_TIME_ZONE}:${formatCalendarDateTime(end)}
DTSTAMP:${formatUtc(now)}
SUMMARY:MCMA Kitchen - ${escapeIcsText(eventName)}
DESCRIPTION:Thanks for volunteering, ${escapeIcsText(name)}!
ORGANIZER;CN=MCMA Kitchen:mailto:${escapeIcsText(process.env.ADMIN_EMAIL || '')}
ATTENDEE;CN=${escapeIcsText(name)};RSVP=TRUE:mailto:${escapeIcsText(email)}
LOCATION:MCMA Kitchen
UID:${Date.now()}@mcmakitchen.org
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR
  `.trim();
}

function getGoogleCalendarURL({ eventName, name, schedule }) {
  const { start, end } = schedule;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `MCMA Kitchen - ${eventName}`,
    dates: `${formatCalendarDateTime(start)}/${formatCalendarDateTime(end)}`,
    ctz: EVENT_TIME_ZONE,
    details: `Volunteer sign-up for ${eventName}. Thanks, ${name}!`,
    location: 'MCMA Kitchen',
  });

  return `https://www.google.com/calendar/render?${params.toString()}`;
}

function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown-ip';
}

function isAllowedCaptchaHostname(hostname) {
  const configured = (process.env.RECAPTCHA_ALLOWED_HOSTNAMES || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  if (configured.length === 0) return true;
  return configured.includes(String(hostname || '').toLowerCase());
}

function hasFreshCaptchaTimestamp(challengeTimestamp) {
  if (!challengeTimestamp) return false;
  const issuedAt = Date.parse(challengeTimestamp);
  if (Number.isNaN(issuedAt)) return false;
  const ageMs = Date.now() - issuedAt;
  return ageMs >= 0 && ageMs <= CAPTCHA_TOKEN_MAX_AGE_MS;
}

function findEventMatch(rows, eventName, eventDate) {
  const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const volunteersNeededIndex = 3;
  const volunteerColumns = [6, 8, 10, 12, 14, 16];
  const normalizedEventName = normalize(eventName);
  const toIsoDate = (value) => {
    if (!value) return '';
    if (!Number.isNaN(Number(value))) {
      const base = new Date(1899, 11, 30);
      const parsed = new Date(base.getTime() + Number(value) * 24 * 60 * 60 * 1000);
      return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
    }
    const [year, month, day] = String(value).split('-').map(Number);
    if (!year || !month || !day) return '';
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
  };

  const match = rows.find((row) => {
    const rowDate = toIsoDate(row[0]);
    const rowName = normalize(row[1]);
    return rowDate === eventDate && rowName === normalizedEventName;
  });

  if (!match) return { found: false, spotsLeft: 0, row: null };

  const requestedVolunteers = Number.parseInt(String(match[volunteersNeededIndex] || '').trim(), 10);
  const volunteersNeeded = Number.isFinite(requestedVolunteers)
    ? Math.max(0, Math.min(volunteerColumns.length, requestedVolunteers))
    : volunteerColumns.length;

  const filledSpots = volunteerColumns.reduce((count, column) => {
    return match[column]?.trim() ? count + 1 : count;
  }, 0);

  return {
    found: true,
    spotsLeft: Math.max(0, volunteersNeeded - filledSpots),
    row: match,
  };
}

function isDuplicateSignup(rows, eventName, eventDate, name, email) {
  const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const normalizedEventName = normalize(eventName);
  const normalizedEventDate = String(eventDate || '').trim();
  const normalizedName = normalize(name);
  const normalizedEmail = normalize(email);

  return rows.some((row) => {
    const rowEventName = normalize(row[1]);
    const rowEventDate = String(row[2] || '').trim();
    const rowName = normalize(row[3]);
    const rowEmail = normalize(row[5]);

    if (rowEventName !== normalizedEventName || rowEventDate !== normalizedEventDate) {
      return false;
    }

    return rowEmail === normalizedEmail || rowName === normalizedName;
  });
}

export async function POST(request) {
  const clientIp = getClientIp(request);
  const limiter = rateLimit({
    key: `signup:${clientIp}`,
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });

  if (!limiter.allowed) {
    return Response.json({ error: 'Too many signup attempts. Please try again later.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const eventName = normalizeText(body?.eventName, 150);
    const eventDate = typeof body?.eventDate === 'string' ? body.eventDate.trim() : '';
    const name = normalizeText(body?.name, 100);
    const formattedPhone = formatUsPhone(body?.phone);
    const email = normalizeEmail(body?.email);
    const token = normalizeText(body?.token, 5000);

    if (!eventName || !isIsoDate(eventDate) || !name || !formattedPhone || !email || !token) {
      return Response.json({ error: 'Invalid signup fields' }, { status: 400 });
    }

    const captchaRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: token,
      }),
    });

    if (!captchaRes.ok) {
      return Response.json({ error: 'CAPTCHA verification unavailable' }, { status: 502 });
    }

    const captchaResult = await captchaRes.json();
    const scoreThreshold = Number(process.env.RECAPTCHA_MIN_SCORE || DEFAULT_CAPTCHA_SCORE_THRESHOLD);
    const hasValidScore = typeof captchaResult.score === 'number' && captchaResult.score >= scoreThreshold;
    const hasValidAction = captchaResult.action === RECAPTCHA_ACTION;
    const hasValidHostname = isAllowedCaptchaHostname(captchaResult.hostname);
    const hasValidTimestamp = hasFreshCaptchaTimestamp(captchaResult.challenge_ts);

    if (!captchaResult.success || !hasValidScore || !hasValidAction || !hasValidHostname || !hasValidTimestamp) {
      console.warn('CAPTCHA verification failed', {
        success: captchaResult.success,
        action: captchaResult.action,
        hostname: captchaResult.hostname,
        score: captchaResult.score,
      });
      return Response.json({ error: 'Failed CAPTCHA verification' }, { status: 403 });
    }

    const sheets = createSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const eventsSheetName = await getEventsSheetName(sheets, sheetId);
    const signupsSheetName = await getVolunteerSignupsSheetName(sheets, sheetId);

    const [eventsResponse, signupsResponse] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: getSheetRange(eventsSheetName, 'A2:S1000'),
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: getSheetRange(signupsSheetName, 'A2:F1000'),
      }),
    ]);

    const eventRows = eventsResponse.data.values || [];
    const signupRows = signupsResponse.data.values || [];
    const eventMatch = findEventMatch(eventRows, eventName, eventDate);
    if (!eventMatch.found) {
      return Response.json({ error: 'Selected event is no longer available' }, { status: 400 });
    }
    if (eventMatch.spotsLeft <= 0) {
      return Response.json({ error: 'Selected event is full' }, { status: 409 });
    }
    if (isDuplicateSignup(signupRows, eventName, eventDate, name, email)) {
      return Response.json({ error: 'You are already signed up for this event.' }, { status: 409 });
    }

    const now = new Date();
    const formattedTimestamp = now.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      weekday: 'long',
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const [year, month, day] = eventDate.split('-').map(Number);
    const parsedEventDate = new Date(year, month - 1, day, 12, 0, 0);
    const formattedEventDate = parsedEventDate.toLocaleDateString('en-US', {
      timeZone: 'America/Los_Angeles',
      weekday: 'long',
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
    });
    const schedule = getEventScheduleFromRow(eventDate, eventMatch.row);
    const formattedEventTime = formatEventTimeRange(schedule);

    const newRow = [
      sanitizeForSheetCell(formattedTimestamp),
      sanitizeForSheetCell(eventName),
      sanitizeForSheetCell(eventDate),
      sanitizeForSheetCell(name),
      sanitizeForSheetCell(formattedPhone),
      sanitizeForSheetCell(email),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: getSheetRange(signupsSheetName, 'A:F'),
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [newRow],
      },
    });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const calendarICS = generateICS({ eventName, name, email, schedule });
    const googleCalendarLink = getGoogleCalendarURL({ eventName, name, schedule });
    const logo = 'https://mcma.s3.us-east-1.amazonaws.com/mcmaLogo.png';
    const adminEmail = process.env.ADMIN_EMAIL || 'hello@mcmakitchen.com';

    const htmlEventName = escapeHtml(eventName);
    const htmlName = escapeHtml(name);
    const htmlPhone = escapeHtml(formattedPhone);
    const htmlEmail = escapeHtml(email);
    const htmlFormattedEventDate = escapeHtml(formattedEventDate);
    const htmlFormattedEventTime = escapeHtml(formattedEventTime);

    const volunteerHeading = 'Thank you for signing up!';
    const volunteerIntro = `<p style="font-size:14px; color:#444; text-align:center; max-width:360px; margin:0 auto 24px;">
      We are excited to have you join us in the kitchen. Below are the details of your volunteer shift.
    </p>`;

    const volunteerHTML = `
      <div style="font-family:sans-serif; background:#fff; padding:24px; border-radius:12px; border:1px solid #ddd; max-width:480px; margin:0 auto;">
        <div style="text-align:center;">
          <img src="${logo}" alt="MCMA Logo" style="max-width:100px; margin-bottom:16px;" />
        </div>
        ${volunteerIntro}
        <h2 style="text-align:center; color:#000;">${volunteerHeading}</h2>
        <p><strong>Event:</strong> ${htmlEventName}</p>
        <p><strong>Date:</strong> ${htmlFormattedEventDate}</p>
        <p><strong>Time:</strong> ${htmlFormattedEventTime}</p>
        <p><strong>Name:</strong> ${htmlName}</p>
        <p><strong>Phone:</strong> ${htmlPhone}</p>
        <p><strong>Email:</strong> <a href="mailto:${htmlEmail}" style="color:#007bff; text-decoration:none;">${htmlEmail}</a></p>
        <div style="margin-top:24px; display:flex; gap:8px;">
          <a href="${googleCalendarLink}" style="background:#007bff; color:#fff; padding:10px 16px; text-decoration:none; border-radius:6px; font-weight:bold;">Add to Google Calendar</a>
          <a href="cid:calendar" style="background:#333; color:#fff; padding:10px 16px; text-decoration:none; border-radius:6px; font-weight:bold;">Add to Apple Calendar</a>
        </div>
      </div>
    `;

    const adminHeading = 'Someone just signed up to help.';
    const adminHTML = volunteerHTML
      .replace(volunteerIntro, '')
      .replace(volunteerHeading, adminHeading);

    const plainText = `
Thanks for signing up!

Event: ${eventName}
Date: ${formattedEventDate}
Time: ${formattedEventTime}
Name: ${name}
Phone: ${formattedPhone}
Email: ${email}
`;

    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `MCMA Kitchen - Thanks for signing up for ${eventName} on ${formattedEventDate}`,
      html: volunteerHTML,
      text: plainText,
      reply_to: adminEmail,
      attachments: [
        {
          filename: 'mcma-volunteer.ics',
          content: calendarICS,
          contentType: 'text/calendar',
          contentDisposition: 'inline',
          cid: 'calendar',
        },
      ],
    });

    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: adminEmail,
      subject: `New MCMA Volunteer Sign-Up: ${name} for ${eventName}`,
      html: adminHTML,
      text: plainText,
      reply_to: adminEmail,
    });

    return Response.json({
      status: 'OK',
      submitted: { eventName, formattedEventDate, formattedEventTime, name, formattedPhone, email },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return Response.json({ error: 'Unable to process signup' }, { status: 500 });
  }
}
