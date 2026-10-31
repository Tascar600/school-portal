// The one line at the bottom of every page (and, through Layout, of every printed sheet).
// The backend repeats this text on every PDF and Excel print setup (utils/pdfBrand.ts).
export const DEVELOPER_CREDIT = 'For all your system development contact 0710325831';

export default function DeveloperFooter() {
  return <footer className="dev-footer no-print">{DEVELOPER_CREDIT}</footer>;
}
