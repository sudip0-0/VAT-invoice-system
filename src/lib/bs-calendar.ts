// Bikram Sambat calendar data and conversion utilities

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
  2070: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2071: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2073: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2074: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2075: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2077: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2078: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2079: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2080: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2081: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2082: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2083: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2084: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2085: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2086: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2087: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2088: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2089: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2090: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
};

// Reference date: BS 2070-01-01 = AD 2013-04-14
const BS_REF_YEAR = 2070;
const AD_REF_DATE = new Date(2013, 3, 14); // April 14, 2013

function totalDaysInBSYear(year: number): number {
  const data = BS_CALENDAR_DATA[year];
  if (!data) return 365;
  return data.reduce((a, b) => a + b, 0);
}

export function adToBS(date: Date): BSDate {
  const diffDays = Math.floor((date.getTime() - AD_REF_DATE.getTime()) / (1000 * 60 * 60 * 24));
  
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
  return adToBS(new Date());
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
