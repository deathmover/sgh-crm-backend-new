/**
 * Date helpers for calendar-day filtering.
 *
 * `new Date('2026-10-29')` is parsed as UTC midnight, so calling setHours() on it
 * afterwards gives the wrong day on any server whose timezone is not UTC+X
 * (and shifts the day window by the UTC offset on UTC hosts). These helpers
 * always interpret YYYY-MM-DD as a calendar day in the server's local timezone.
 * Set the TZ env var (e.g. TZ=Asia/Kolkata) on cloud hosts so "local" matches
 * the café's wall clock.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse YYYY-MM-DD (or any date string) as local midnight of that calendar day. */
export function parseLocalDate(value: string | Date): Date {
  if (value instanceof Date) {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const match = DATE_ONLY.exec(value.trim());
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfLocalDay(value: string | Date = new Date()): Date {
  return parseLocalDate(value);
}

export function endOfLocalDay(value: string | Date = new Date()): Date {
  const d = parseLocalDate(value);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Inclusive range covering one calendar day (defaults to today). */
export function dayRange(date?: string | Date): { gte: Date; lte: Date } {
  const target = date ?? new Date();
  return { gte: startOfLocalDay(target), lte: endOfLocalDay(target) };
}

/** Inclusive range from the start of `startDate` to the end of `endDate`. */
export function dateRange(startDate: string | Date, endDate: string | Date): { gte: Date; lte: Date } {
  return { gte: startOfLocalDay(startDate), lte: endOfLocalDay(endDate) };
}

/** Local calendar date as YYYY-MM-DD (unlike toISOString, which is UTC). */
export function toLocalDateKey(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
