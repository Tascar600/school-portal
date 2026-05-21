interface DownloadCSVProps {
  data: Record<string, any>[];
  headers: string[];
  filename: string;
  label?: string;
}

export function PrintButton() {
  return (
    <button className="btn btn-primary" onClick={() => window.print()} style={{ whiteSpace: 'nowrap' }}>
      🖨 Print
    </button>
  );
}

export function DownloadCSV({ data, headers, filename, label = ' CSV' }: DownloadCSVProps) {
  const handleDownload = () => {
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      ),
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button className="btn btn-success" onClick={handleDownload} style={{ whiteSpace: 'nowrap' }}>
      📥{label}
    </button>
  );
}
