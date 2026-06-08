import { requireAdmin } from '@/lib/admin-auth';
import { formatUsPhone, normalizeEmail, normalizeText, sanitizeForSheetCell } from '@/lib/input-security';
import {
  createSheetsClient,
  getSheetRange,
  getVolunteerDirectorySheetName,
} from '@/lib/google-sheets';

export async function POST(req) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const name = normalizeText(body?.name, 100);
    const formattedPhone = formatUsPhone(body?.phone);
    const email = normalizeEmail(body?.email);

    if (!name || !formattedPhone || !email) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const sheets = createSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const directorySheetName = await getVolunteerDirectorySheetName(sheets, spreadsheetId);

    const directoryRange = getSheetRange(directorySheetName, 'A2:C1000');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: directoryRange,
    });

    const existing = response.data.values || [];
    const normalizedName = name.trim().toLowerCase();

    const rowIndex = existing.findIndex(row => (row[0] || '').trim().toLowerCase() === normalizedName);
    const sheetRow = rowIndex !== -1 ? rowIndex + 2 : existing.length + 2;

    const updates = [
      {
        range: getSheetRange(directorySheetName, `A${sheetRow}`),
        values: [[sanitizeForSheetCell(name)]],
      },
      {
        range: getSheetRange(directorySheetName, `B${sheetRow}`),
        values: [[sanitizeForSheetCell(formattedPhone)]],
      },
      {
        range: getSheetRange(directorySheetName, `C${sheetRow}`),
        values: [[sanitizeForSheetCell(email)]],
      },
    ];

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates,
      },
    });

    return Response.json({
      message: rowIndex !== -1 ? 'Updated existing volunteer' : 'Added new volunteer',
      phoneUpdated: rowIndex !== -1,
    });
  } catch (err) {
    console.error('❌ add-to-directory error:', err);
    return Response.json({ error: 'Failed to update volunteer directory' }, { status: 500 });
  }
}
