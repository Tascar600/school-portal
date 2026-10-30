// US dollars are the base currency; others are shown with their code. Negative amounts read -$80.00.
export function money(amount: number | null | undefined, currency = 'USD'): string {
  const n = amount ?? 0;
  const symbol = currency === 'USD' ? '$' : `${currency} `;
  return `${n < 0 ? '-' : ''}${symbol}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function balanceTone(balance: number): 'positive' | 'negative' | 'neutral' {
  if (balance > 0) return 'negative'; // still owing
  if (balance < 0) return 'positive'; // in credit
  return 'neutral';
}
