import { useTheme, THEMES } from '../contexts/ThemeContext';

// Four looks only. Each card previews the colours it will use.
const SWATCH: Record<string, { bg: string; surface: string; text: string; bar: string }> = {
  system: { bg: '#f3eddb', surface: '#fffdf5', text: '#1c2a21', bar: '#1f5a2e' },
  light: { bg: '#f4f5f6', surface: '#ffffff', text: '#15201a', bar: '#1f5a2e' },
  dark: { bg: '#14181b', surface: '#1c2227', text: '#e7ece9', bar: '#0f1a13' },
  black: { bg: '#000000', surface: '#0b0d0c', text: '#f2f5f3', bar: '#000000' },
};

export default function Themes() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <div className="page-head"><div><h1>Appearance</h1><p>Choose how the portal looks on this computer. Your choice is remembered for your account.</p></div></div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {THEMES.map((t) => {
          const s = SWATCH[t.id];
          const selected = theme === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setTheme(t.id)} aria-pressed={selected}
              style={{ textAlign: 'left', cursor: 'pointer', padding: 0, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit',
                border: selected ? '3px solid var(--primary)' : '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: s.bg, padding: '0.7rem' }}>
                <div style={{ background: s.bar, height: 14, borderRadius: 3, borderBottom: '3px solid #b8902a', marginBottom: 8 }} />
                <div style={{ background: s.surface, color: s.text, borderRadius: 4, padding: '0.5rem 0.6rem', fontSize: '0.78rem', border: '1px solid rgba(128,128,128,0.25)' }}>
                  <strong>Fees collected</strong><br />$1,570.50
                </div>
              </div>
              <div style={{ padding: '0.75rem 0.9rem' }}>
                <strong>{t.name}</strong>{selected && <span className="badge badge-success" style={{ marginLeft: 8 }}>In use</span>}
                <p className="small muted" style={{ marginTop: 4 }}>{t.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
