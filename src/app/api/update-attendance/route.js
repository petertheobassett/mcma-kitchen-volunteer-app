import { google } from 'googleapis';

export async function POST(req) {
  try {
    const { row, index, checked } = await req.json();

    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = '2025 Schedule of Events';

    if (index > 23) {
      return new Response(JSON.stringify({ error: 'Column index exceeds sheet width' }), { status: 400 });
    }

    const cell = `${sheetName}!${columnToLetter(index)}${row}`;

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
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
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
