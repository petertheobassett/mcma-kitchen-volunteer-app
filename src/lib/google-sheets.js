import { google } from 'googleapis';

const LEGACY_EVENTS_SHEET_NAME = '2025 Schedule of Events';
const SCHEDULE_SHEET_PATTERN = /(?:^|\b)(\d{4})?\s*Schedule of Events$/i;
const DEFAULT_SIGNUPS_SHEET_NAME = 'Volunteer Signups';
const SIGNUPS_SHEET_PATTERN = /^Volunteer Signups?$/i;
const DEFAULT_DIRECTORY_SHEET_NAME = 'Volunteer Directory';
const DIRECTORY_SHEET_PATTERN = /^Volunteer Directory$/i;

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function getGooglePrivateKey() {
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
  return stripWrappingQuotes(rawKey.trim()).replace(/\\n/g, '\n');
}

export function createSheetsClient(scopes) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: getGooglePrivateKey(),
    },
    scopes,
  });

  return google.sheets({ version: 'v4', auth });
}

export async function getEventsSheetName(sheets, spreadsheetId) {
  const configuredName = process.env.GOOGLE_EVENTS_SHEET_NAME?.trim();
  if (configuredName) return configuredName;

  const titles = await getSheetTitles(sheets, spreadsheetId);
  const candidates = titles
    .map((title) => {
      const match = title.match(SCHEDULE_SHEET_PATTERN);
      if (!match) return null;

      return {
        title,
        year: match[1] ? Number(match[1]) : null,
      };
    })
    .filter(Boolean);

  if (!candidates.length) return LEGACY_EVENTS_SHEET_NAME;

  const currentYear = new Date().getFullYear();
  const currentYearMatch = candidates.find((candidate) => candidate.year === currentYear);
  if (currentYearMatch) return currentYearMatch.title;

  const latestDatedSheet = candidates
    .filter((candidate) => Number.isInteger(candidate.year))
    .sort((left, right) => right.year - left.year)[0];

  if (latestDatedSheet) return latestDatedSheet.title;

  return candidates[0].title;
}

export async function getVolunteerSignupsSheetName(sheets, spreadsheetId) {
  return getNamedSheet({
    sheets,
    spreadsheetId,
    configuredName: process.env.GOOGLE_SIGNUPS_SHEET_NAME?.trim(),
    fallbackName: DEFAULT_SIGNUPS_SHEET_NAME,
    pattern: SIGNUPS_SHEET_PATTERN,
  });
}

export async function getVolunteerDirectorySheetName(sheets, spreadsheetId) {
  return getNamedSheet({
    sheets,
    spreadsheetId,
    configuredName: process.env.GOOGLE_DIRECTORY_SHEET_NAME?.trim(),
    fallbackName: DEFAULT_DIRECTORY_SHEET_NAME,
    pattern: DIRECTORY_SHEET_PATTERN,
  });
}

async function getNamedSheet({
  sheets,
  spreadsheetId,
  configuredName,
  fallbackName,
  pattern,
}) {
  if (configuredName) return configuredName;

  const titles = await getSheetTitles(sheets, spreadsheetId);
  const match = titles.find((title) => pattern.test(title));
  return match || fallbackName;
}

async function getSheetTitles(sheets, spreadsheetId) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });

  return (metadata.data.sheets || [])
    .map((sheet) => sheet.properties?.title?.trim())
    .filter(Boolean);
}

export function getSheetRange(sheetName, range) {
  return `${sheetName}!${range}`;
}
