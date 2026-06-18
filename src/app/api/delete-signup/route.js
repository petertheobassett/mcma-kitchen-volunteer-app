import { requireAdmin } from '@/lib/admin-auth';
import {
  createSheetsClient,
  getVolunteerSignupsSheetName,
} from '@/lib/google-sheets';

export async function POST(req) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const sheetRow = Number(body?.sheetRow);

    if (!Number.isInteger(sheetRow) || sheetRow < 2) {
      return Response.json({ error: 'Invalid signup row' }, { status: 400 });
    }

    const sheets = createSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const signupsSheetName = await getVolunteerSignupsSheetName(sheets, spreadsheetId);

    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties(sheetId,title)',
    });

    const signupsSheet = (metadata.data.sheets || []).find(
      (sheet) => sheet.properties?.title === signupsSheetName,
    );

    const sheetId = signupsSheet?.properties?.sheetId;
    if (!Number.isInteger(sheetId)) {
      return Response.json({ error: 'Unable to locate signups sheet' }, { status: 500 });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: sheetRow - 1,
                endIndex: sheetRow,
              },
            },
          },
        ],
      },
    });

    return Response.json({ status: 'OK', sheetRow });
  } catch (err) {
    console.error('❌ delete-signup error:', err);
    return Response.json({ error: 'Failed to delete signup record' }, { status: 500 });
  }
}
