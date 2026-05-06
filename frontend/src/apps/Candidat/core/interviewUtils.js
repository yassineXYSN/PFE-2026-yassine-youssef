export const INTERVIEW_END_FALLBACK_MINUTES = 45;
export const INTERVIEW_JOIN_WINDOW_MINUTES = 10;

export function parseDate(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value, locale, options) {
  const parsed = parseDate(value);
  if (!parsed) return '';
  return parsed.toLocaleDateString(locale, options);
}

export function formatTime(value, locale) {
  const parsed = parseDate(value);
  if (!parsed) return '';
  return parsed.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

export function isJoinableInterview(status, startTime, endTime) {
  const start = parseDate(startTime);
  if (!start) return false;

  const end =
    parseDate(endTime) ||
    new Date(start.getTime() + INTERVIEW_END_FALLBACK_MINUTES * 60_000);
  const now = new Date();
  const statusValue = `${status || ''}`.toLowerCase();

  if (statusValue === 'in_progress') return true;
  if (!['scheduled', 'confirmed'].includes(statusValue)) return false;

  return (
    now >= new Date(start.getTime() - INTERVIEW_JOIN_WINDOW_MINUTES * 60_000) &&
    now <= end
  );
}
