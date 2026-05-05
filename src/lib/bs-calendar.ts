// Bikram Sambat calendar data and conversion utilities
import { nepalNow } from '@/lib/nepal-date';

export interface BSDate {
  year: number;
  month: number; // 1-12
  day: number;
}

export const BS_MONTHS_ENGLISH = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan',
  'Bhadra', 'Ashwin', 'Kartik', 'Mangsir',
  'Poush', 'Magh', 'Falgun', 'Chaitra'
];

// BS calendar data: days in each month for BS years 2070-2090
// Source: Nepal Government calendar standards
export const BS_CALENDAR_DATA: Record<number, number[]> = {
  2070: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2071: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2073: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2074: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2075: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2082: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2083: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2084: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30],
  2085: [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30],
  2086: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2087: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
  2088: [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30],
  2089: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2090: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
};

// Reference date: BS 2070-01-01 = AD 2013-04-14
const BS_REF_YEAR = 2070;
const AD_REF_DATE = new Date(2013, 3, 14); // April 14, 2013

function totalDaysInBSYear(year: number): number {
  const data = BS_CALENDAR_DATA[year];
  if (!data) return 365;
  return data.reduce((a, b) => a + b, 0);
}

export function getDaysInBSMonth(year: number, month: number): number {
  const data = BS_CALENDAR_DATA[year];
  if (!data || month < 1 || month > 12) return 30;
  return data[month - 1];
}

export function bsToAD(bs: BSDate): Date {
  let totalDays = 0;
  // Count days from ref year to target year
  for (let y = BS_REF_YEAR; y < bs.year; y++) {
    totalDays += totalDaysInBSYear(y);
  }
  // Count days from month 1 to target month
  const data = BS_CALENDAR_DATA[bs.year];
  if (data) {
    for (let m = 0; m < bs.month - 1; m++) {
      totalDays += data[m];
    }
  }
  // Add remaining days
  totalDays += bs.day - 1;

  const result = new Date(AD_REF_DATE);
  result.setDate(result.getDate() + totalDays);
  return result;
}

/**
 * Get the day of week (0=Sun, 6=Sat) for a BS date
 */
export function bsDayOfWeek(bs: BSDate): number {
  return bsToAD(bs).getDay();
}

export function adToBS(date: Date): BSDate {
  // Use local date components to avoid timezone issues
  const refLocal = new Date(2013, 3, 14); // April 14, 2013 local
  const dateLocal = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((dateLocal.getTime() - refLocal.getTime()) / (1000 * 60 * 60 * 24));
  
  let bsYear = BS_REF_YEAR;
  let bsMonth = 1;
  let bsDay = 1;
  let remaining = diffDays;

  while (remaining > 0) {
    const data = BS_CALENDAR_DATA[bsYear];
    if (!data) break;
    
    const daysInMonth = data[bsMonth - 1];
    const daysLeft = daysInMonth - bsDay;
    
    if (remaining <= daysLeft) {
      bsDay += remaining;
      remaining = 0;
    } else {
      remaining -= (daysLeft + 1);
      bsMonth++;
      bsDay = 1;
      if (bsMonth > 12) {
        bsMonth = 1;
        bsYear++;
      }
    }
  }

  return { year: bsYear, month: bsMonth, day: bsDay };
}

export function todayBS(): BSDate {
  return adToBS(nepalNow());
}

export function formatBS(bs: BSDate, format: string = 'YYYY MMMM DD'): string {
  return format
    .replace('YYYY', String(bs.year))
    .replace('MMMM', BS_MONTHS_ENGLISH[bs.month - 1])
    .replace('MM', String(bs.month).padStart(2, '0'))
    .replace('DD', String(bs.day).padStart(2, '0'));
}

export function formatBSShort(bs: BSDate): string {
  return `${bs.year}-${String(bs.month).padStart(2, '0')}-${String(bs.day).padStart(2, '0')}`;
}

export function parseBSShort(str: string): BSDate | null {
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

export function getFiscalYear(bs: BSDate): string {
  // Nepal FY starts Shrawan (month 4)
  if (bs.month >= 4) {
    return `${bs.year}/${String(bs.year + 1).slice(2)}`;
  }
  return `${bs.year - 1}/${String(bs.year).slice(2)}`;
}

export function getVATPeriod(bs: BSDate): string {
  return `${bs.year}/${String(bs.month).padStart(2, '0')}`;
}

export function getVATReturnDeadline(vatPeriod: string): string {
  const [yearPart, monthPart] = vatPeriod.split('/');
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!year || !month || month < 1 || month > 12) return '';

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return formatBSShort({ year: nextYear, month: nextMonth, day: 25 });
}

/** Get min/max supported BS years */
export const BS_MIN_YEAR = Math.min(...Object.keys(BS_CALENDAR_DATA).map(Number));
export const BS_MAX_YEAR = Math.max(...Object.keys(BS_CALENDAR_DATA).map(Number));
