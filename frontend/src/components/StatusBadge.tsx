const COLORS: Record<string, string> = {
  active: '#4ade80',
  verified: '#4ade80',
  paid: '#4ade80',
  sent: '#4ade80',
  cancelled: '#f87171',
  rejected: '#f87171',
  reversed: '#f87171',
  failed: '#f87171',
  pending: '#fbbf24',
  draft: '#fbbf24',
  locked: '#f87171',
  open: '#4ade80',
};

export default function StatusBadge({ status }: { status: string }) {
  const color = COLORS[status?.toLowerCase()] || '#9ca3af';
  return (
    <span className="badge" style={{ background: `${color}22`, color }}>
      {status}
    </span>
  );
}
