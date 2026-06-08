import { createSheetsClient, getEventsSheetName, getSheetRange } from '@/lib/google-sheets';

export async function GET() {
  try {
    const sheets = createSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const eventsSheetName = await getEventsSheetName(sheets, sheetId);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: getSheetRange(eventsSheetName, 'A2:Q1000'),
    });

    const rows = response.data.values || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const volunteersNeededIndex = 3;
    const volunteerCols = [6, 8, 10, 12, 14, 16];

    const events = rows
      .map((row) => {
        const rawDate = row[0];
        const name = row[1];
        if (!rawDate || !name) return null;

        const [yyyy, m, d] = rawDate.split('-');
        const mm = m.padStart(2, '0');
        const dd = d.padStart(2, '0');
        const parsed = new Date(+yyyy, +mm - 1, +dd);

        if (isNaN(parsed)) return null;

        const parsedMidnight = new Date(parsed);
        parsedMidnight.setHours(0, 0, 0, 0);
        if (parsedMidnight < today) return null;

        const requestedVolunteers = Number.parseInt(String(row[volunteersNeededIndex] || '').trim(), 10);
        const volunteersNeeded = Number.isFinite(requestedVolunteers)
          ? Math.max(0, Math.min(volunteerCols.length, requestedVolunteers))
          : volunteerCols.length;

        const filledSpots = volunteerCols.reduce((count, col) => {
          const cell = row[col];
          return cell?.trim() ? count + 1 : count;
        }, 0);

        const spotsLeft = Math.max(0, volunteersNeeded - filledSpots);
        const spotsLeftLabel = spotsLeft === 1 ? '1 spot left' : `${spotsLeft} spots left`;

        return {
          name: name.trim(),
          date: `${parsed.getFullYear()}-${mm}-${dd}`,
          label: `${parsed.toDateString()} – ${name.trim()} (${spotsLeft === 0 ? 'FULL' : spotsLeftLabel})`,
          spotsLeft,
        };
      })
      .filter(Boolean);

    return new Response(JSON.stringify(events), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('❌ Error fetching signup events:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
