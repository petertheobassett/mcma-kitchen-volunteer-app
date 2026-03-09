import { google } from 'googleapis';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const { row, index, checked } = await req.json();
    const parsedRow = Number(row);
    const parsedIndex = Number(index);

    if (
      !Number.isInteger(parsedRow) ||
      !Number.isInteger(parsedIndex) ||
      parsedRow < 2 ||
      parsedRow > 1000 ||
      parsedIndex < 18 ||
      parsedIndex > 23 ||
      typeof checked !== 'boolean'
    ) {
      return Response.json({ error: 'Invalid attendance payload' }, { status: 400 });
    }

    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = '2025 Schedule of Events';
    const cell = `${sheetName}!${columnToLetter(parsedIndex)}${parsedRow}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: cell,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[checked ? '👍' : '']],
      },
    });

    return new Response(JSON.stringify({ status: 'OK', cell }), { status: 200 });
  } catch (err) {
    console.error('❌ Google Sheets error:', err);
    return new Response(JSON.stringify({ error: 'Failed to update attendance' }), {
      status: 500,
    });
  }
}

function columnToLetter(col) {
  let letter = '';
  while (col > 0) {
    const mod = (col - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    col = Math.floor((col - mod) / 26);
  }
  return letter;
}
