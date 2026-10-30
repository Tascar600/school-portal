import { useSchool } from '../contexts/SchoolContext';
import { useAuth } from '../contexts/AuthContext';

// Appears only on paper: the school letterhead, a title bar and who printed it and when.
// The page border, crest watermark and footer are drawn once by the Layout on every printed page.
export default function PrintHeader({ title, period, extra }: { title: string; period?: string; extra?: string }) {
  const { school, logoUrl } = useSchool();
  const { user } = useAuth();
  const contact = [school.po_box && `P.O. Box ${school.po_box}`, school.address, school.phone && `Tel: ${school.phone}`, school.email].filter(Boolean).join('  |  ');
  return (
    <div className="print-only">
      <div className="print-letterhead">
        <img src={logoUrl} alt="" />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div className="name">{school.full_name}</div>
          <div className="sub">{[school.district, school.province, school.country].filter(Boolean).join('  ·  ')}</div>
          {contact && <div className="sub">{contact}</div>}
          {school.motto && <div className="motto">{'“'}{school.motto}{'”'}</div>}
        </div>
        <div style={{ width: 62 }} />
      </div>
      <div className="print-title"><span>{title}</span><span>{period}</span></div>
      <div className="print-meta">
        Printed {new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}{user ? ` by ${user.name}` : ''}{extra ? `  ·  ${extra}` : ''}
      </div>
    </div>
  );
}
