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
