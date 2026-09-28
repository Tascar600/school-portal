import { Response } from 'express';
import ExcelJS from 'exceljs';

// Shared helper: streams a simple one-sheet Excel workbook as the HTTP response.
// headers: column titles (also used as the object keys via `key`, in order).
// rows: plain objects — each row's values are read out in the same order as `headers`.
export async function sendXlsx(
  res: Response,
  filename: string,
  headers: string[],
  rows: Record<string, any>[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Report');

  sheet.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(12, h.length + 4) }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    const values = headers.map((h) => {
      const v = row[h];
      return v === undefined || v === null ? '' : v;
    });
    sheet.addRow(values);
  }

  const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  await workbook.xlsx.write(res);
  res.end();
}
