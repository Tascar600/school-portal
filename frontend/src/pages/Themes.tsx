import { useState, useEffect } from 'react';
import { themeApi } from '../services/api';

const themeCSS = (t: any) => t.light ? `
  --primary: ${t.color};
  --primary-glow: ${t.color}44;
  --bg: ${t.bg};
  --card-bg: rgba(255,255,255,0.85);
  --card-border: rgba(0,0,0,0.1);
  --text: #1a1a2e;
  --text-dim: #6b7280;
  --neon: ${t.neon || t.color};
  --neon-glow: ${(t.neon || t.color)}44;
  --navbar-bg: rgba(255,255,255,0.9);
  --input-bg: rgba(0,0,0,0.04);
  --select-option-bg: #ffffff;
  --modal-bg: rgba(255,255,255,0.96);
  --th-bg: rgba(37,99,235,0.1);
  --row-hover-bg: rgba(0,0,0,0.03);
  --btn-bg: rgba(0,0,0,0.04);
  --grid-color: rgba(0,0,0,0.04);
  --body-glow-1: rgba(37,99,235,0.1);
  --body-glow-2: rgba(99,102,241,0.08);
  --body-glow-3: rgba(59,130,246,0.06);
` : `
  --primary: ${t.color};
  --primary-glow: ${t.color}66;
  --bg: ${t.bg};
  --card-bg: rgba(255,255,255,0.06);
  --card-border: rgba(255,255,255,0.1);
  --text: #e0e0ff;
  --text-dim: #8888aa;
  --neon: ${t.neon || t.color};
  --neon-glow: ${(t.neon || t.color)}55;
  --navbar-bg: rgba(10,10,30,0.85);
  --input-bg: rgba(255,255,255,0.04);
  --select-option-bg: #1a1a3e;
  --modal-bg: rgba(15,15,40,0.95);
  --th-bg: rgba(0,240,255,0.05);
  --row-hover-bg: rgba(255,255,255,0.03);
  --btn-bg: rgba(255,255,255,0.04);
  --grid-color: rgba(255,255,255,0.02);
  --body-glow-1: rgba(0,240,255,0.05);
  --body-glow-2: rgba(100,0,255,0.05);
  --body-glow-3: rgba(0,200,100,0.03);
`;

export default function Themes() {
  const [themes, setThemes] = useState<any[]>([]);
  const [currentTheme, setCurrentTheme] = useState<any>({ theme: 'default', accent_color: '#00f0ff' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    themeApi.list().then(r => setThemes(r.data));
    themeApi.get().then(r => setCurrentTheme(r.data)).catch(() => {});
  }, []);

  const applyTheme = async (t: any) => {
    try {
      await themeApi.update({ theme: t.id, accent_color: t.color });
      setCurrentTheme({ theme: t.id, accent_color: t.color });
      document.documentElement.style.cssText = themeCSS(t);
      document.body.style.background = t.bg;
      setMsg(`Theme activated: ${t.name}`);
    } catch (err: any) { setMsg(err.response?.data?.message || 'Error'); }
  };

  useEffect(() => {
    if (currentTheme && themes.length > 0) {
      const t = themes.find((th: any) => th.id === currentTheme.theme);
      if (t) {
        document.documentElement.style.cssText = themeCSS(t);
        document.body.style.background = t.bg;
      }
    }
  }, [currentTheme, themes]);

  return (
    <div>
      <h1>✦ Theme Matrix</h1>
      {msg && <div className="alert alert-info">{msg}</div>}

      <div className="card">
        <h2>Choose Your Reality</h2>
        <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
          Select a visual theme to customize your portal experience. 16 futuristic themes available.
        </p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          {themes.map((t: any) => (
            <div
              key={t.id}
              onClick={() => applyTheme(t)}
              style={{
                background: t.bg,
                border: `2px solid ${currentTheme.theme === t.id ? t.color : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 16,
                padding: '1.25rem 0.75rem',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: currentTheme.theme === t.id ? `0 0 30px ${t.color}44` : 'none',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: `linear-gradient(135deg, ${t.color}, ${t.neon || t.color})`,
                margin: '0 auto 0.75rem',
                boxShadow: `0 0 20px ${t.color}66`,
              }} />
              <strong style={{ color: t.color, fontSize: '0.85rem' }}>{t.name}</strong>
              {currentTheme.theme === t.id && (
                <div style={{
                  color: t.color, fontSize: '1.2rem', marginTop: 4,
                  textShadow: `0 0 10px ${t.color}`,
                }}>✦</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Current Configuration</h2>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: `linear-gradient(135deg, ${currentTheme.accent_color}, ${'#00f0ff'})`,
            boxShadow: `0 0 30px ${currentTheme.accent_color}66`,
          }} />
          <div>
            <p><strong>Theme:</strong> {themes.find((t: any) => t.id === currentTheme.theme)?.name || 'Nexus Blue'}</p>
            <p><strong>Accent:</strong> <span style={{ color: currentTheme.accent_color }}>{currentTheme.accent_color}</span></p>
            <p><strong>Status:</strong> <span className="pulse-dot" /> Active</p>
          </div>
        </div>
      </div>
    </div>
  );
}
