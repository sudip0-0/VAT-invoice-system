/**
 * Nepal timezone utility (UTC+5:45)
 * Ensures all dates reflect Nepal Standard Time regardless of user's browser timezone.
 */

const NEPAL_OFFSET_MINUTES = 5 * 60 + 45; // +5:45

/** Get current Date object adjusted to Nepal time */
export function nepalNow(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utcMs + NEPAL_OFFSET_MINUTES * 60_000);
}

/** Get today's date in Nepal as YYYY-MM-DD string */
export function nepalTodayISO(): string {
  const d = nepalNow();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse a "YYYY-MM-DD" string as a LOCAL date (not UTC).
 * Avoids the common pitfall of `new Date("2025-02-26")` being parsed as UTC midnight,
 * which can shift the date by ±1 day depending on local timezone.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a Date to "YYYY-MM-DD" using LOCAL date components (not toISOString which uses UTC).
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
