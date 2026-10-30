const TONE: Record<string, string> = {
  active: 'success', verified: 'success', paid: 'success', sent: 'success', open: 'success', current: 'info',
  cancelled: 'danger', rejected: 'danger', reversed: 'danger', failed: 'danger', locked: 'danger',
  pending: 'warning', draft: 'warning',
};

export default function StatusBadge({ status }: { status: string }) {
  const tone = TONE[String(status || '').toLowerCase()];
  return <span className={`badge${tone ? ` badge-${tone}` : ''}`}>{status}</span>;
}
