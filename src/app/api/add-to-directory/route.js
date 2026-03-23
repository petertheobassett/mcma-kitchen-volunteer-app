import { requireAdmin } from '@/lib/admin-auth';
import { formatUsPhone, normalizeEmail, normalizeText, sanitizeForSheetCell } from '@/lib/input-security';
import { createSheetsClient } from '@/lib/google-sheets';

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

    const directoryRange = 'Volunteer Directory!A2:C1000';
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
        range: `Volunteer Directory!A${sheetRow}`,
        values: [[sanitizeForSheetCell(name)]],
      },
      {
        range: `Volunteer Directory!B${sheetRow}`,
        values: [[sanitizeForSheetCell(formattedPhone)]],
      },
      {
        range: `Volunteer Directory!C${sheetRow}`,
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
