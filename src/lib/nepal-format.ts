// NPR currency and South Asian number formatting

/**
 * Format number using South Asian grouping (last 3, then groups of 2)
 * 1500000 → "15,00,000"
 */
export function formatSANumber(n: number): string {
  const parts = n.toFixed(0).split('.');
  let intPart = parts[0];
  const isNeg = intPart.startsWith('-');
  if (isNeg) intPart = intPart.slice(1);

  if (intPart.length <= 3) return (isNeg ? '-' : '') + intPart;

  const last3 = intPart.slice(-3);
  let remaining = intPart.slice(0, -3);
  const groups: string[] = [];
  
  while (remaining.length > 0) {
    groups.unshift(remaining.slice(-2));
    remaining = remaining.slice(0, -2);
  }

  return (isNeg ? '-' : '') + groups.join(',') + ',' + last3;
}

interface FormatNPROptions {
  showSymbol?: boolean;
  compact?: boolean;
  decimals?: number;
}

/**
 * Format amount as NPR with South Asian grouping
 * formatNPR(52000) → "NPR 52,000.00"
 * formatNPR(1500000) → "NPR 15,00,000.00"
 * formatNPR(1500000, { compact: true }) → "NPR 15 Lakh"
 */
export function formatNPR(amount: number, options: FormatNPROptions = {}): string {
  const { showSymbol = true, compact = false, decimals = 2 } = options;
  const prefix = showSymbol ? 'NPR ' : '';

  if (compact) {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    if (abs >= 10000000) return `${prefix}${sign}${(abs / 10000000).toFixed(1)} Crore`;
    if (abs >= 100000) return `${prefix}${sign}${(abs / 100000).toFixed(1)} Lakh`;
    if (abs >= 1000) return `${prefix}${sign}${(abs / 1000).toFixed(1)}K`;
    return `${prefix}${sign}${abs.toFixed(decimals)}`;
  }

  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const intPart = Math.floor(abs);
  const decPart = abs.toFixed(decimals).split('.')[1];

  return `${prefix}${sign}${formatSANumber(intPart)}.${decPart}`;
}

/**
 * Format amount for display (shorter, no prefix for tables)
 */
export function formatAmount(amount: number): string {
  return formatNPR(amount, { showSymbol: false });
}
