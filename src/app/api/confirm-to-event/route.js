import { google } from 'googleapis';
import { requireAdmin } from '@/lib/admin-auth';
import {
  formatUsPhone,
  isIsoDate,
  normalizeText,
  sanitizeForSheetCell,
} from '@/lib/input-security';

export async function POST(req) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const name = normalizeText(body?.name, 100);
    const phone = formatUsPhone(body?.phone);
    const eventName = normalizeText(body?.eventName, 150);
    const eventDate = body?.eventDate;

    if (!name || !phone || !eventName || !isIsoDate(eventDate)) {
      return Response.json({ error: 'Invalid required fields' }, { status: 400 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = '2025 Schedule of Events!A1:Q1000';

    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = result.data.values;
    const data = rows.slice(1); // skip header

    const toISODate = (val) => {
      if (!val) return '';
      if (!isNaN(val)) {
        // fallback for serial dates
        const base = new Date(1899, 11, 30);
        const parsed = new Date(base.getTime() + Number(val) * 24 * 60 * 60 * 1000);
        return parsed.toISOString().slice(0, 10);
      }
      const [yyyy, m, d] = String(val).split('-');
      if (!yyyy || !m || !d) return '';
      const parsed = new Date(+yyyy, +m - 1, +d);
      return isNaN(parsed) ? '' : parsed.toISOString().slice(0, 10);
    };

    const normalizedDate = toISODate(eventDate);
    const normalize = str => (str || '').replace(/\s+/g, ' ').trim().toLowerCase();

    const matchIndex = data.findIndex(row => {
      const rowDate = toISODate(row[0]);
      const rowName = normalize(row[1]);
      return rowDate === normalizedDate && rowName === normalize(eventName);
    });

    if (matchIndex === -1) {
      return Response.json({ message: 'Event not found', notFound: true }, { status: 404 });
    }

    const row = data[matchIndex];
    const volunteerCols = [5, 7, 9, 11, 13, 15];

    let emptyCol = null;
    for (const col of volunteerCols) {
      const val = row[col]?.trim();
      if (!val) {
        emptyCol = col;
        break;
      }
    }

    if (emptyCol === null) {
      return Response.json({ message: 'Event is full', full: true });
    }

    const sheetRow = matchIndex + 2;
    const nameCol = String.fromCharCode(65 + emptyCol);
    const phoneCol = String.fromCharCode(65 + emptyCol + 1);

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          {
            range: `2025 Schedule of Events!${nameCol}${sheetRow}`,
            values: [[sanitizeForSheetCell(name)]],
          },
          {
            range: `2025 Schedule of Events!${phoneCol}${sheetRow}`,
            values: [[sanitizeForSheetCell(phone)]],
          },
        ],
      },
    });

    return Response.json({ message: 'Confirmed to event', success: true });
  } catch (error) {
    console.error('Sheet write error:', error);
    return Response.json({ error: 'Failed to confirm volunteer' }, { status: 500 });
  }
}
