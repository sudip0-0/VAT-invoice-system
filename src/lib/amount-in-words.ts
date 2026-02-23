// Convert number to English words (South Asian style: Lakh, Crore)

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function twoDigits(n: number): string {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
}

function threeDigits(n: number): string {
  if (n === 0) return '';
  if (n < 100) return twoDigits(n);
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '');
}

/**
 * Convert a number to English words using South Asian grouping.
 * amountInWords(1523456.50) → "Fifteen Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paisa Only"
 */
export function amountInWords(amount: number): string {
  if (amount === 0) return 'Zero Only';

  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100);

  if (intPart === 0 && decPart === 0) return 'Zero Only';

  let words = '';

  if (intPart > 0) {
    const crore = Math.floor(intPart / 10000000);
    const lakh = Math.floor((intPart % 10000000) / 100000);
    const thousand = Math.floor((intPart % 100000) / 1000);
    const remainder = intPart % 1000;

    const parts: string[] = [];
    if (crore > 0) parts.push(twoDigits(crore) + ' Crore');
    if (lakh > 0) parts.push(twoDigits(lakh) + ' Lakh');
    if (thousand > 0) parts.push(twoDigits(thousand) + ' Thousand');
    if (remainder > 0) parts.push(threeDigits(remainder));

    words = parts.join(' ');
  }

  if (decPart > 0) {
    const paisaWords = twoDigits(decPart);
    words = words
      ? `${words} and ${paisaWords} Paisa`
      : `${paisaWords} Paisa`;
  }

  return (isNeg ? 'Minus ' : '') + words + ' Only';
}
