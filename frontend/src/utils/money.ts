export function money(amount: number | null | undefined, currency = 'USD'): string {
  const n = amount ?? 0;
  const symbol = currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${n.toFixed(2)}`;
}

export function balanceTone(balance: number): 'positive' | 'negative' | 'neutral' {
  if (balance > 0) return 'negative'; // still owing
  if (balance < 0) return 'positive'; // in credit
  return 'neutral';
}
