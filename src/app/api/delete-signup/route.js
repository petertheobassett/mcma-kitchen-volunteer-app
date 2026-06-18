import { requireAdmin } from '@/lib/admin-auth';
import {
  createSheetsClient,
  getEventsSheetName,
  getSheetRange,
  getVolunteerSignupsSheetName,
} from '@/lib/google-sheets';
import { formatUsPhone, isIsoDate, normalizeText } from '@/lib/input-security';

export async function POST(req) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const sheetRow = Number(body?.sheetRow);
    const name = normalizeText(body?.name, 100);
    const phone = formatUsPhone(body?.phone);
    const eventName = normalizeText(body?.eventName, 150);
    const eventDate = typeof body?.eventDate === 'string' ? body.eventDate.trim() : '';

    if (
      !Number.isInteger(sheetRow) ||
      sheetRow < 2 ||
      !name ||
      !phone ||
      !eventName ||
      !isIsoDate(eventDate)
    ) {
      return Response.json({ error: 'Invalid signup row' }, { status: 400 });
    }

    const sheets = createSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const signupsSheetName = await getVolunteerSignupsSheetName(sheets, spreadsheetId);
    const eventsSheetName = await getEventsSheetName(sheets, spreadsheetId);

    const [metadata, eventsResponse] = await Promise.all([
      sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties(sheetId,title)',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: getSheetRange(eventsSheetName, 'A2:Y1000'),
      }),
    ]);

    const signupsSheet = (metadata.data.sheets || []).find(
      (sheet) => sheet.properties?.title === signupsSheetName,
    );
    const eventsSheet = (metadata.data.sheets || []).find(
      (sheet) => sheet.properties?.title === eventsSheetName,
    );

    const signupsSheetId = signupsSheet?.properties?.sheetId;
    const eventsSheetId = eventsSheet?.properties?.sheetId;
    if (!Number.isInteger(signupsSheetId) || !Number.isInteger(eventsSheetId)) {
      return Response.json({ error: 'Unable to locate signups sheet' }, { status: 500 });
    }

    const eventRows = eventsResponse.data.values || [];
    const eventMatch = findAssignedVolunteerRow({
      rows: eventRows,
      eventName,
      eventDate,
      volunteerName: name,
      volunteerPhone: phone,
    });

    if (eventMatch) {
      const updates = [
        {
          range: getSheetRange(eventsSheetName, `${columnToLetter(eventMatch.volunteerColumn + 1)}${eventMatch.sheetRow}`),
          values: [['']],
        },
        {
          range: getSheetRange(eventsSheetName, `${columnToLetter(eventMatch.volunteerColumn + 2)}${eventMatch.sheetRow}`),
          values: [['']],
        },
        {
          range: getSheetRange(eventsSheetName, `${columnToLetter(eventMatch.attendanceColumn + 1)}${eventMatch.sheetRow}`),
          values: [['']],
        },
      ];

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates,
        },
      });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: signupsSheetId,
                dimension: 'ROWS',
                startIndex: sheetRow - 1,
                endIndex: sheetRow,
              },
            },
          },
        ],
      },
    });

    return Response.json({
      status: 'OK',
      sheetRow,
      removedFromSchedule: !!eventMatch,
    });
  } catch (err) {
    console.error('❌ delete-signup error:', err);
    return Response.json({ error: 'Failed to delete signup record' }, { status: 500 });
  }
}

function findAssignedVolunteerRow({ rows, eventName, eventDate, volunteerName, volunteerPhone }) {
  const volunteerColumns = [6, 8, 10, 12, 14, 16];
  const attendanceColumns = [19, 20, 21, 22, 23, 24];
  const normalizedEventName = normalizeLoose(eventName);
  const normalizedEventDate = toIsoDate(eventDate);
  const normalizedVolunteerName = normalizeLoose(volunteerName);
  const normalizedVolunteerPhone = String(volunteerPhone || '').trim();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (toIsoDate(row[0]) !== normalizedEventDate || normalizeLoose(row[1]) !== normalizedEventName) {
      continue;
    }

    for (let slot = 0; slot < volunteerColumns.length; slot += 1) {
      const volunteerColumn = volunteerColumns[slot];
      const phoneColumn = volunteerColumn + 1;
      const rowVolunteerName = normalizeLoose(row[volunteerColumn]);
      const rowVolunteerPhone = String(row[phoneColumn] || '').trim();

      if (
        rowVolunteerName === normalizedVolunteerName &&
        (!normalizedVolunteerPhone || rowVolunteerPhone === normalizedVolunteerPhone)
      ) {
        return {
          sheetRow: index + 2,
          volunteerColumn,
          attendanceColumn: attendanceColumns[slot],
        };
      }
    }
  }

  return null;
}

function normalizeLoose(value) {
  return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function toIsoDate(value) {
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
}

function columnToLetter(columnNumber) {
  let column = columnNumber;
  let letter = '';
  while (column > 0) {
    const mod = (column - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    column = Math.floor((column - mod) / 26);
  }
  return letter;
}
