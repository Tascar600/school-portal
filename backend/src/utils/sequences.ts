import { query, execute } from '../config/database';

// Per-year document numbering, e.g. nextNo('INV', 'INV') -> "INV-2026-00001"
export async function nextNo(seqName: string, prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const key = `${seqName}-${year}`;
  const existing = await query<any[]>('SELECT next_val FROM sequences WHERE name = ?', [key]);
  const next = existing[0]?.next_val || 1;
  if (existing.length > 0) {
    await execute('UPDATE sequences SET next_val = ? WHERE name = ?', [next + 1, key]);
  } else {
    await execute('INSERT INTO sequences (name, next_val) VALUES (?, ?)', [key, next + 1]);
  }
  return `${prefix}-${year}-${String(next).padStart(5, '0')}`;
}
