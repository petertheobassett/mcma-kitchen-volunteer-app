import { requireAdmin } from '@/lib/admin-auth';
import { createSheetsClient, getEventsSheetName, getSheetRange } from '@/lib/google-sheets';

export async function GET(request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const sheets = createSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const eventsSheetName = await getEventsSheetName(sheets, sheetId);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: getSheetRange(eventsSheetName, 'A2:Z1000'),
    });

    const rows = response.data.values || [];

    const events = rows.map((row, i) => {
      // ✅ Ensure row includes all columns A–Z (26 columns)
      const padded = [...row];
      while (padded.length < 26) padded.push('');

      const rawDate = padded[0];
      const name = padded[1];

      if (!rawDate || !name) return null;

      // Parse and normalize date from raw yyyy-m-d
      const [yyyy, m, d] = rawDate.split('-');
      const mm = m.padStart(2, '0');
      const dd = d.padStart(2, '0');

      const parsedDate = new Date(+yyyy, +mm - 1, +dd, 12);
      if (isNaN(parsedDate)) return null;

      const iso = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;

      return {
        raw: padded,
        date: iso,
        label: `${parsedDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })} – ${name}`,
      };
    }).filter(Boolean);

    return new Response(JSON.stringify(events), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('❌ Error in /api/get-events:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch events' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
