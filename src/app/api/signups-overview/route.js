import { requireAdmin } from '@/lib/admin-auth';
import {
  createSheetsClient,
  getEventsSheetName,
  getVolunteerDirectorySheetName,
  getVolunteerSignupsSheetName,
} from '@/lib/google-sheets';

export async function GET(request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const sheets = createSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const eventsSheetName = await getEventsSheetName(sheets, spreadsheetId);
    const signupsSheetName = await getVolunteerSignupsSheetName(sheets, spreadsheetId);
    const directorySheetName = await getVolunteerDirectorySheetName(sheets, spreadsheetId);

    const [signupsRes, directoryRes, eventsRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: signupsSheetName }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: directorySheetName }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: eventsSheetName }),
    ]);

    const signups = signupsRes.data.values?.slice(1) || [];
    const directory = directoryRes.data.values?.slice(1) || [];
    const events = eventsRes.data.values || [];

    const eventRows = events.slice(1).filter(row => row[0]?.trim() && row[1]?.trim());
    const volunteersNeededIndex = 3;
    const volunteerCols = [6, 8, 10, 12, 14, 16];

    const normalize = str =>
      (str || '').replace(/\s+/g, ' ').trim().toLowerCase();

    const toISODate = (val) => {
      if (!val) return '';
      if (typeof val === 'number' && !isNaN(val)) {
        // fallback: serial date
        const base = new Date(1899, 11, 30);
        const parsed = new Date(base.getTime() + val * 24 * 60 * 60 * 1000);
        return parsed.toISOString().slice(0, 10);
      }
      const [yyyy, m, d] = String(val).split('-');
      if (!yyyy || !m || !d) return '';
      const parsed = new Date(+yyyy, +m - 1, +d);
      return isNaN(parsed) ? '' : parsed.toISOString().slice(0, 10);
    };    

    const getVolunteerHistory = (volunteerName) => {
      const normalized = normalize(volunteerName);
      for (const row of eventRows) {
        for (const col of volunteerCols) {
          const cell = row[col]?.trim().toLowerCase();
          if (cell === normalized) {
            return {
              lastEvent: row[1],
              lastDate: toISODate(row[0]),
            };
          }
        }
      }
      return null;
    };

    const getSpotsLeft = (eventName, eventDate) => {
      const normalizedName = normalize(eventName);
      const normalizedDate = toISODate(eventDate);
      const match = eventRows.find(row => {
        const rowName = normalize(row[1]);
        const rowDate = toISODate(row[0]);
        return rowName === normalizedName && rowDate === normalizedDate;
      });
      if (!match) return 0;

      const requestedVolunteers = Number.parseInt(
        String(match[volunteersNeededIndex] || '').trim(),
        10
      );
      const volunteersNeeded = Number.isFinite(requestedVolunteers)
        ? Math.max(0, Math.min(volunteerCols.length, requestedVolunteers))
        : volunteerCols.length;

      let filled = 0;
      for (const col of volunteerCols) {
        if (match[col]?.trim()) filled++;
      }

      return Math.max(0, volunteersNeeded - filled);
    };

    const enriched = signups.map(([timestamp, eventName, eventDate, name, phone, email], index) => {
      const safeName = (name || '').trim();
      const safePhone = (phone || '').trim();
      const safeEmail = (email || '').trim();
      const normalizedName = normalize(safeName);
      const directoryRow = directory.find((row) => normalize(row[0]) === normalizedName);

      const currentPhone = directoryRow?.[1]?.trim() || '';
      const currentEmail = directoryRow?.[2]?.trim() || '';
      const rating = directoryRow?.[4] ?? '';
      const isInDirectory = !!directoryRow;

      const needsDirectoryUpdate =
        isInDirectory &&
        (currentPhone !== safePhone || currentEmail !== safeEmail);

      const history = getVolunteerHistory(safeName);
      const spotsLeft = getSpotsLeft(eventName, eventDate);

      return {
        id: `signup-row-${index + 2}`,
        name: safeName,
        phone: safePhone,
        email: safeEmail,
        event: eventName || '',
        date: timestamp || '',
        eventDate: toISODate(eventDate),
        rating,
        isInDirectory,
        needsDirectoryUpdate,
        lastEvent: history?.lastEvent || '',
        lastDate: history?.lastDate || '',
        spotsLeft,
      };
    });

    return Response.json(enriched);
  } catch (err) {
    console.error('❌ signups-overview error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch signups overview' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
