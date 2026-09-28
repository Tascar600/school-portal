const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const GROUPS = ['', ' Thousand', ' Million', ' Billion'];

function threeDigits(n: number): string {
  let s = '';
  if (n >= 100) {
    s += ONES[Math.floor(n / 100)] + ' Hundred';
    n %= 100;
    if (n) s += ' and ';
  }
  if (n >= 20) {
    s += TENS[Math.floor(n / 10)];
    if (n % 10) s += '-' + ONES[n % 10];
  } else if (n > 0) {
    s += ONES[n];
  }
  return s;
}

export function numberToWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  let i = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk) parts.unshift(threeDigits(chunk) + GROUPS[i]);
    n = Math.floor(n / 1000);
    i++;
  }
  return parts.join(' ');
}

export function amountInWords(amount: number, currencyName = 'Dollars', centName = 'Cents'): string {
  const dollars = Math.floor(Math.abs(amount));
  const cents = Math.round((Math.abs(amount) - dollars) * 100);
  let words = `${numberToWords(dollars)} ${currencyName}`;
  if (cents > 0) words += ` and ${numberToWords(cents)} ${centName}`;
  return `${words} Only`;
}
