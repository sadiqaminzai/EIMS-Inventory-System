// Heavy libs (jspdf, html2canvas, exceljs) are dynamically imported inside the
// export functions so they are only fetched when the user actually exports —
// keeping them out of the initial app bundle.

// Shared model for Print / PDF / Excel so every report renders with the same
// well-designed header (logo, company info, title, print date-time) and summary.
export interface ReportExportColumn {
  key: string;
  label: string;
}

export interface ReportSummaryCard {
  label: string;
  value: string;
}

export interface ReportExportModel {
  company: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string; // data URL preferred (required for PDF/Excel embedding)
  };
  reportTitle: string;
  printDateTime: string;
  reportPeriod?: string;
  filters: string[];
  columns: ReportExportColumn[];
  rows: string[][]; // already display-formatted, aligned to columns
  summaryCards: ReportSummaryCard[]; // flat list (used for Excel + PDF/Print summary)
  landscape: boolean;
}

export const escapeHtml = (value: string): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Fetch a remote image and return a data URL (so logos embed in PDF/Excel without CORS taint). */
export const toDataUrl = async (url?: string): Promise<string | undefined> => {
  if (!url) return undefined;
  if (url.startsWith('data:image/')) return url;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
};

const reportStyles = (landscape: boolean): string => `
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111827; font-family: Arial, Helvetica, sans-serif; }
  body { padding: 12mm; }
  .page { width: 100%; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 10px; }
  .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .logo { width: 72px; height: 72px; object-fit: contain; }
  .brand-info { border-left: 4px solid #111827; padding-left: 10px; min-width: 0; }
  .company { font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1.15; }
  .meta { font-size: 12px; color: #374151; margin-top: 4px; }
  .meta-line { font-size: 12px; color: #374151; margin-top: 4px; }
  .contact-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
  .contact-chip { display: inline-block; padding: 3px 8px; border: 1px solid #d1d5db; border-radius: 999px; background: #f9fafb; font-size: 11px; color: #1f2937; }
  .title { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; text-align: right; }
  .report-period { margin: 0 0 10px 0; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); display: flex; align-items: center; gap: 10px; white-space: nowrap; overflow: hidden; }
  .period-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #4b5563; flex-shrink: 0; }
  .period-value { font-size: 13px; font-weight: 600; color: #111827; text-overflow: ellipsis; overflow: hidden; }
  .filters { margin: 0 0 12px 0; padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12px; color: #374151; display: grid; gap: 4px; }
  .summary { margin: 12px 0 0 0; display: grid; grid-template-columns: repeat(${landscape ? 6 : 3}, minmax(0, 1fr)); gap: 12px; }
  .summary-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 18px; background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%); min-width: 0; }
  .summary-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; white-space: nowrap; }
  .summary-value { margin-top: 4px; font-size: 16px; font-weight: 700; color: #111827; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; font-weight: 700; text-transform: uppercase; }
  tr, td, th { page-break-inside: avoid; break-inside: avoid; }
  thead { display: table-header-group; }
`;

const reportBody = (m: ReportExportModel): string => {
  const { company, columns, rows } = m;
  const contactChips = (company.phone || company.email)
    ? `<div class="contact-row">${company.phone ? `<span class="contact-chip">Phone: ${escapeHtml(company.phone)}</span>` : ''}${company.email ? `<span class="contact-chip">Email: ${escapeHtml(company.email)}</span>` : ''}</div>`
    : '';

  const summary = m.summaryCards.length
    ? `<div class="summary">${m.summaryCards
        .map((card) => `<div class="summary-card"><div class="summary-label">${escapeHtml(card.label)}</div><div class="summary-value">${escapeHtml(card.value)}</div></div>`)
        .join('')}</div>`
    : '';

  const tbody = rows.length === 0
    ? `<tr><td colspan="${columns.length}" style="text-align:center; font-style:italic; color:#6b7280; padding:16px;">No records found</td></tr>`
    : rows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
        .join('');

  return `
    <div class="page">
      <div class="header">
        <div class="brand">
          ${company.logo ? `<img class="logo" src="${company.logo}" alt="Logo" />` : ''}
          <div class="brand-info">
            <div class="company">${escapeHtml(company.name)}</div>
            ${company.address ? `<div class="meta-line">${escapeHtml(company.address)}</div>` : ''}
            ${contactChips}
          </div>
        </div>
        <div>
          <div class="title">${escapeHtml(m.reportTitle)}</div>
          <div class="meta" style="text-align:right;">Printed: ${escapeHtml(m.printDateTime)}</div>
        </div>
      </div>
      ${m.reportPeriod ? `<div class="report-period"><span class="period-label">Report Period</span><span class="period-value">${escapeHtml(m.reportPeriod)}</span></div>` : ''}
      ${m.filters.length ? `<div class="filters">${m.filters.map((item) => `<div>${escapeHtml(item)}</div>`).join('')}</div>` : ''}
      <table>
        <thead><tr>${m.columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
      ${summary}
    </div>
  `;
};

/** Full standalone HTML document — used by the Print window. */
export const buildReportHtmlDocument = (m: ReportExportModel): string => `
  <html>
    <head>
      <title>${escapeHtml(m.reportTitle)}</title>
      <style>${reportStyles(m.landscape)}</style>
    </head>
    <body>${reportBody(m)}</body>
  </html>
`;

/** Render the report (identical to Print) into a paginated PDF, fully client-side. */
export const exportReportToPdf = async (m: ReportExportModel, filename: string): Promise<void> => {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const widthPx = m.landscape ? 1123 : 794; // A4 @ ~96dpi
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = `${widthPx}px`;
  container.style.background = '#fff';
  container.innerHTML = `<style>${reportStyles(m.landscape)}</style>${reportBody(m)}`;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const pdf = new jsPDF({ orientation: m.landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * pageW) / canvas.width;
    const imgData = canvas.toDataURL('image/png');

    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
      heightLeft -= pageH;
    }
    pdf.save(filename);
  } finally {
    container.remove();
  }
};

const saveBuffer = (buffer: ArrayBuffer, filename: string, mime: string): void => {
  const blob = new Blob([buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const DARK = 'FF111827';
const HEADER_FILL = 'FF1F2937';
const ZEBRA_FILL = 'FFF9FAFB';
const LABEL_GRAY = 'FF6B7280';

/** Styled .xlsx export mirroring the report header, table and summary. */
export const exportReportToXlsx = async (m: ReportExportModel, filename: string): Promise<void> => {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = m.company.name || 'EIMS';
  wb.created = new Date();

  const sheetName = (m.reportTitle || 'Report').replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Report';
  const ws = wb.addWorksheet(sheetName, {
    pageSetup: { orientation: m.landscape ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', ySplit: 0 }],
  });

  const colCount = Math.max(1, m.columns.length);
  const lastCol = colCount;

  // Optional logo (embedded top-right)
  if (m.company.logo && m.company.logo.startsWith('data:image/')) {
    try {
      const ext = m.company.logo.startsWith('data:image/png') ? 'png' : 'jpeg';
      const imageId = wb.addImage({ base64: m.company.logo, extension: ext as 'png' | 'jpeg' });
      ws.addImage(imageId, { tl: { col: lastCol - 1, row: 0 }, ext: { width: 90, height: 90 } });
    } catch {
      // ignore logo failures
    }
  }

  let r = 1;
  const mergeAcross = (row: number, from = 1, to = lastCol) =>
    ws.mergeCells(row, from, row, to);

  // Company name
  mergeAcross(r);
  let cell = ws.getCell(r, 1);
  cell.value = m.company.name;
  cell.font = { bold: true, size: 16, color: { argb: DARK } };
  r += 1;

  if (m.company.address) {
    mergeAcross(r);
    ws.getCell(r, 1).value = m.company.address;
    ws.getCell(r, 1).font = { size: 10, color: { argb: LABEL_GRAY } };
    r += 1;
  }
  if (m.company.phone || m.company.email) {
    mergeAcross(r);
    ws.getCell(r, 1).value = [m.company.phone, m.company.email].filter(Boolean).join('   |   ');
    ws.getCell(r, 1).font = { size: 10, color: { argb: LABEL_GRAY } };
    r += 1;
  }

  r += 1; // spacer
  // Report title
  mergeAcross(r);
  cell = ws.getCell(r, 1);
  cell.value = m.reportTitle.toUpperCase();
  cell.font = { bold: true, size: 13, color: { argb: 'FF2563EB' } };
  r += 1;

  mergeAcross(r);
  ws.getCell(r, 1).value = `Printed: ${m.printDateTime}`;
  ws.getCell(r, 1).font = { size: 10, color: { argb: LABEL_GRAY } };
  r += 1;

  if (m.reportPeriod) {
    mergeAcross(r);
    ws.getCell(r, 1).value = `Report Period: ${m.reportPeriod}`;
    ws.getCell(r, 1).font = { size: 10, bold: true, color: { argb: DARK } };
    r += 1;
  }
  for (const f of m.filters) {
    mergeAcross(r);
    ws.getCell(r, 1).value = f;
    ws.getCell(r, 1).font = { size: 10, color: { argb: LABEL_GRAY } };
    r += 1;
  }

  r += 1; // spacer

  // Header row
  const headerRow = ws.getRow(r);
  m.columns.forEach((col, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = col.label;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    c.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  });
  headerRow.height = 22;
  const headerRowNumber = r;
  r += 1;

  // Data rows
  if (m.rows.length === 0) {
    mergeAcross(r);
    const c = ws.getCell(r, 1);
    c.value = 'No records found';
    c.font = { italic: true, color: { argb: LABEL_GRAY } };
    c.alignment = { horizontal: 'center' };
    r += 1;
  } else {
    m.rows.forEach((row, idx) => {
      const dataRow = ws.getRow(r);
      m.columns.forEach((_, i) => {
        const c = dataRow.getCell(i + 1);
        const raw = row[i] ?? '';
        const asNum = Number(raw.replace(/,/g, ''));
        c.value = raw !== '' && raw !== '-' && Number.isFinite(asNum) && /^[-\d,.]+$/.test(raw) ? asNum : raw;
        c.font = { size: 10, color: { argb: DARK } };
        if (idx % 2 === 1) {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_FILL } };
        }
        c.border = {
          top: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };
      });
      r += 1;
    });
  }

  // Auto-ish column widths from header + content
  m.columns.forEach((col, i) => {
    let max = col.label.length;
    for (const row of m.rows) {
      max = Math.max(max, String(row[i] ?? '').length);
    }
    ws.getColumn(i + 1).width = Math.min(40, Math.max(10, max + 2));
  });
  ws.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: lastCol },
  };

  // Summary cards
  if (m.summaryCards.length) {
    r += 1;
    mergeAcross(r);
    ws.getCell(r, 1).value = 'SUMMARY';
    ws.getCell(r, 1).font = { bold: true, size: 11, color: { argb: DARK } };
    r += 1;
    for (const card of m.summaryCards) {
      ws.getCell(r, 1).value = card.label;
      ws.getCell(r, 1).font = { size: 10, color: { argb: LABEL_GRAY } };
      ws.getCell(r, 2).value = card.value;
      ws.getCell(r, 2).font = { bold: true, size: 11, color: { argb: DARK } };
      r += 1;
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  saveBuffer(buffer as ArrayBuffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
};
