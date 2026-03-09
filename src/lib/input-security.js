const CONTROL_CHARACTERS_REGEX = /[\u0000-\u001f\u007f]/g;
const SHEET_FORMULA_PREFIX_REGEX = /^[=+\-@]/;

export function normalizeText(value, maxLength = 200) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(CONTROL_CHARACTERS_REGEX, '').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > maxLength) return null;
  return cleaned;
}

export function normalizeEmail(value) {
  const cleaned = normalizeText(value, 254);
  if (!cleaned) return null;
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
  return isValidEmail ? cleaned.toLowerCase() : null;
}

export function formatUsPhone(value) {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length !== 10) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isIsoDate(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export function sanitizeForSheetCell(value) {
  const cleaned = String(value ?? '')
    .replace(CONTROL_CHARACTERS_REGEX, '')
    .trim();
  if (!cleaned) return '';
  if (SHEET_FORMULA_PREFIX_REGEX.test(cleaned)) return `'${cleaned}`;
  return cleaned;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeIcsText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}
