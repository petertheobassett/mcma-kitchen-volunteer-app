export const EVENT_TIME_ZONE = 'America/Los_Angeles';
export const EVENT_START_TIME_COLUMN_INDEX = 17;
export const EVENT_END_TIME_COLUMN_INDEX = 18;

const DEFAULT_EVENT_DURATION_HOURS = 3;
const DEFAULT_EVENT_START_MINUTE = 30;
const DEFAULT_SATURDAY_START_HOUR = 10;
const DEFAULT_WEEKDAY_START_HOUR = 16;

function parseIsoDateParts(eventDate) {
  const [year, month, day] = String(eventDate).split('-').map(Number);
  return { year, month, day };
}

function isValidDateParts({ year, month, day }) {
  return Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day);
}

function buildTimeParts(hour, minute) {
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function getDefaultEventSchedule(eventDate) {
  const { year, month, day } = parseIsoDateParts(eventDate);
  const weekday = new Date(year, month - 1, day).getDay();
  const startHour = weekday === 6 ? DEFAULT_SATURDAY_START_HOUR : DEFAULT_WEEKDAY_START_HOUR;

  return {
    start: { year, month, day, hour: startHour, minute: DEFAULT_EVENT_START_MINUTE },
    end: {
      year,
      month,
      day,
      hour: startHour + DEFAULT_EVENT_DURATION_HOURS,
      minute: DEFAULT_EVENT_START_MINUTE,
    },
  };
}

export function parseSheetTimeValue(value) {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const numeric = Number(raw);
  if (!Number.isNaN(numeric) && numeric >= 0 && numeric < 1) {
    const totalMinutes = Math.round(numeric * 24 * 60);
    return buildTimeParts(Math.floor(totalMinutes / 60) % 24, totalMinutes % 60);
  }

  const timeMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] || '0');
    const meridiem = timeMatch[3]?.toUpperCase() || null;

    if (meridiem) {
      if (hour === 12) hour = 0;
      if (meridiem === 'PM') hour += 12;
    }

    return buildTimeParts(hour, minute);
  }

  const parsedDate = new Date(`2000-01-01 ${raw}`);
  if (!Number.isNaN(parsedDate.getTime())) {
    return buildTimeParts(parsedDate.getHours(), parsedDate.getMinutes());
  }

  return null;
}

export function getEventSchedule(eventDate, startTimeValue, endTimeValue) {
  const fallback = getDefaultEventSchedule(eventDate);
  const dateParts = parseIsoDateParts(eventDate);
  if (!isValidDateParts(dateParts)) return fallback;

  const parsedStart = parseSheetTimeValue(startTimeValue);
  const parsedEnd = parseSheetTimeValue(endTimeValue);

  const start = parsedStart
    ? { ...dateParts, ...parsedStart }
    : fallback.start;

  const end = parsedEnd
    ? { ...dateParts, ...parsedEnd }
    : parsedStart
      ? {
          ...dateParts,
          hour: (parsedStart.hour + DEFAULT_EVENT_DURATION_HOURS) % 24,
          minute: parsedStart.minute,
        }
      : fallback.end;

  return { start, end };
}

export function getEventScheduleFromRow(eventDate, row = []) {
  return getEventSchedule(
    eventDate,
    row[EVENT_START_TIME_COLUMN_INDEX],
    row[EVENT_END_TIME_COLUMN_INDEX],
  );
}

export function formatCalendarDateTime({ year, month, day, hour, minute }) {
  return `${String(year).padStart(4, '0')}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}00`;
}

export function formatDisplayTime({ hour, minute }) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function formatEventTimeRange(schedule) {
  if (!schedule?.start || !schedule?.end) return '';
  return `${formatDisplayTime(schedule.start)} - ${formatDisplayTime(schedule.end)}`;
}
