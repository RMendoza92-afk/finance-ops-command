import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import loyaLogo from '@/assets/fli_logo.jpg';
import { supabase } from '@/integrations/supabase/client';
import { 
  autoFormatByHeaders, 
  formatCurrencyDisplay, 
  formatPercentDisplay, 
  isCurrencyHeader, 
  isPercentHeader,
  EXCEL_FORMATS
} from '@/lib/excelUtils';

// Log download to database (fire and forget)
const logDownload = async (reportType: string, reportName: string, fileFormat: string, rowCount?: number, metadata?: object) => {
  try {
    await supabase.from('report_downloads').insert([
      {
        report_type: reportType,
        report_name: reportName,
        file_format: fileFormat,
        row_count: rowCount,
        metadata: metadata as unknown as null,
      },
    ]);
  } catch (e) {
    console.warn('Failed to log download:', e);
  }
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export interface ManagerTracking {
  name: string;
  value: string | number;
  category: string;
}

export interface RawClaimData {
  columns: string[];
  rows: (string | number)[][];
  sheetName?: string;
}

export interface DashboardVisual {
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
}

export interface ChartData {
  label: string;
  value: number;
  color?: 'red' | 'green' | 'blue' | 'amber' | 'muted';
}

export interface PDFChart {
  type: 'bar' | 'horizontalBar' | 'pie' | 'donut';
  title: string;
  data: ChartData[];
  width?: number;
}

export interface ExportableData {
  title: string;
  subtitle?: string;
  timestamp: string;
  affectsManager?: string;
  directive?: string;
  managerTracking?: ManagerTracking[];
  summary?: Record<string, string | number>;
  dashboardVisuals?: DashboardVisual[];
  bulletInsights?: string[];
  charts?: PDFChart[];
  columns: string[];
  rows: (string | number)[][];
  rawClaimData?: RawClaimData[];
}

// Helper to load image as base64
const loadImageAsBase64 = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = src;
  });
};

// Sanitize text for PDF - remove problematic characters
const sanitize = (text: string): string => {
  if (!text) return '';
  return String(text)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E\n]/g, '');
};

const extractTeamNumber = (teamValue: unknown): string => {
  const s = String(teamValue ?? '').trim();
  const m = s.match(/\b(\d{1,3})\b/);
  return m?.[1] ?? '';
};

const withTeamNumberColumn = (input: { columns: string[]; rows: (string | number)[][] }) => {
  const columns = [...(input.columns || [])];
  const rows = input.rows || [];

  // Find an existing Team column ("Team", "Team Group", etc.)
  const teamIdx = columns.findIndex((c) => /\bteam\b/i.test(c) || /team\s*group/i.test(c));
  const hasTeamNumber = columns.some((c) => /^team\s*#$/i.test(c) || /^team\s*number$/i.test(c));

  if (teamIdx < 0 || hasTeamNumber) return { columns, rows };

  const nextColumns = [...columns];
  nextColumns.splice(teamIdx + 1, 0, 'Team #');

  const nextRows = rows.map((r) => {
    const arr = [...r];
    const teamNum = extractTeamNumber(arr[teamIdx]);
    arr.splice(teamIdx + 1, 0, teamNum);
    return arr;
  });

  return { columns: nextColumns, rows: nextRows };
};

// Format number with commas
const fmtNum = (n: number): string => n.toLocaleString();

// Format currency
const fmtCurrency = (n: number, compact = false): string => {
  if (compact) {
    if (n >= 1000000000) return '$' + (n / 1000000000).toFixed(1) + 'B';
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + (n / 1000).toFixed(0) + 'K';
  }
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export function useExportData() {
  // ============================================================
  // EXECUTIVE PDF GENERATOR - CEO/COO/CFO Level
  // Standardized Dark Theme - Board Ready
  // ============================================================
  const generatePDF = async (data: ExportableData) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = { l: 12, r: 12, t: 12, b: 12 };
    const contentW = pw - m.l - m.r;
    let y = m.t;

    // Colors - Executive dark theme (matches boardReadyPDFGenerator)
    const C = {
      bg: [12, 12, 12] as [number, number, number],
      headerBg: [22, 22, 22] as [number, number, number],
      rowDark: [18, 18, 18] as [number, number, number],
      rowLight: [24, 24, 24] as [number, number, number],
      border: [45, 45, 45] as [number, number, number],
      white: [255, 255, 255] as [number, number, number],
      offWhite: [240, 240, 240] as [number, number, number],
      muted: [140, 140, 140] as [number, number, number],
      red: [220, 38, 38] as [number, number, number],
      green: [16, 185, 129] as [number, number, number],
      amber: [245, 158, 11] as [number, number, number],
      gold: [212, 175, 55] as [number, number, number],
    };

    // Fill background
    doc.setFillColor(...C.bg);
    doc.rect(0, 0, pw, ph, 'F');

    // === HEADER BAR ===
    doc.setFillColor(...C.headerBg);
    doc.rect(0, 0, pw, 22, 'F');

    // Gold accent line
    doc.setFillColor(...C.gold);
    doc.rect(0, 22, pw, 1, 'F');

    // Logo - constrained aspect ratio (original is ~3:1 ratio)
    try {
      const logoBase64 = await loadImageAsBase64(loyaLogo);
      // Use fixed dimensions that maintain aspect ratio: height 12mm, width ~36mm (3:1)
      doc.addImage(logoBase64, 'JPEG', m.l, 4, 36, 12);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...C.white);
      doc.text('FRED LOYA INSURANCE', m.l, 12);
    }

    // Report classification
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.gold);
    doc.text('EXECUTIVE BRIEFING', pw - m.r, 10, { align: 'right' });
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text('CONFIDENTIAL', pw - m.r, 16, { align: 'right' });

    y = 28;

    // === TITLE SECTION ===
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...C.white);
    doc.text(sanitize(data.title.toUpperCase()), m.l, y);
    y += 7;

    if (data.subtitle) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.offWhite);
      doc.text(sanitize(data.subtitle), m.l, y);
      y += 5;
    }

    // Metadata line
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    const metaLine = `Report Date: ${sanitize(data.timestamp)}${data.affectsManager ? ' | Prepared For: ' + sanitize(data.affectsManager) : ''}`;
    doc.text(metaLine, m.l, y);
    y += 10;

    // === EXECUTIVE SUMMARY METRICS ===
    if (data.summary && Object.keys(data.summary).length > 0) {
      const entries = Object.entries(data.summary);
      const colCount = Math.min(entries.length, 5);
      const cardW = (contentW - (colCount - 1) * 8) / colCount;
      const cardH = 32;

      entries.slice(0, colCount).forEach(([label, value], idx) => {
        const x = m.l + idx * (cardW + 8);

        // Card with gold accent
        doc.setFillColor(...C.rowDark);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F');
        doc.setFillColor(...C.gold);
        doc.rect(x, y, 3, cardH, 'F');

        // Label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...C.muted);
        doc.text(sanitize(label).toUpperCase(), x + 8, y + 10);

        // Value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...C.white);
        doc.text(sanitize(String(value)), x + 8, y + 24);
      });
      y += cardH + 10;
    }

    // === KEY INSIGHTS ===
    if (data.bulletInsights && data.bulletInsights.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C.gold);
      doc.text('KEY FINDINGS', m.l, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.offWhite);

      data.bulletInsights.slice(0, 4).forEach((insight, idx) => {
        const bullet = String(idx + 1) + '. ' + sanitize(insight).substring(0, 130);
        doc.text(bullet, m.l + 2, y);
        y += 5;
      });
      y += 6;
    }

    // === DATA TABLE ===
    if (data.columns.length > 0 && data.rows.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C.gold);
      doc.text('DATA SUMMARY', m.l, y);
      y += 6;

      const colCount = data.columns.length;
      const colWidths = data.columns.map((col, i) => {
        const headerLen = col.length;
        const maxDataLen = Math.max(...data.rows.slice(0, 50).map(r => String(r[i] || '').length));
        return Math.max(headerLen, maxDataLen);
      });
      const totalChars = colWidths.reduce((a, b) => a + b, 0);
      const widths = colWidths.map(w => Math.max((w / totalChars) * contentW, 28));
      const rowH = 7;

      // Header
      doc.setFillColor(...C.headerBg);
      doc.rect(m.l, y, contentW, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);

      let xOff = m.l + 2;
      data.columns.forEach((col, i) => {
        const maxChars = Math.floor(widths[i] / 2.2);
        doc.text(sanitize(col).substring(0, maxChars).toUpperCase(), xOff, y + 5);
        xOff += widths[i];
      });
      y += rowH;

      // Rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      const maxY = ph - 18;

      data.rows.forEach((row, rowIdx) => {
        if (y > maxY) {
          // New page
          doc.addPage();
          doc.setFillColor(...C.bg);
          doc.rect(0, 0, pw, ph, 'F');
          y = m.t;

          // Repeat header
          doc.setFillColor(...C.headerBg);
          doc.rect(m.l, y, contentW, rowH, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(...C.muted);
          xOff = m.l + 2;
          data.columns.forEach((col, i) => {
            const maxChars = Math.floor(widths[i] / 2.2);
            doc.text(sanitize(col).substring(0, maxChars).toUpperCase(), xOff, y + 5);
            xOff += widths[i];
          });
          y += rowH;
          doc.setFont('helvetica', 'normal');
        }

        // Alternating rows
        if (rowIdx % 2 === 0) {
          doc.setFillColor(...C.rowDark);
          doc.rect(m.l, y, contentW, rowH, 'F');
        }

        xOff = m.l + 2;
        row.forEach((cell, i) => {
          doc.setTextColor(...C.offWhite);
          const maxChars = Math.floor(widths[i] / 2.2);
          doc.text(sanitize(String(cell)).substring(0, maxChars), xOff, y + 5);
          xOff += widths[i];
        });
        y += rowH;
      });
    }

    // === ADJUSTER TRACKING (if present) ===
    if (data.managerTracking && data.managerTracking.length > 0) {
      const highEval = data.managerTracking.filter(m => m.category === 'high_eval').slice(0, 10);
      
      if (highEval.length > 0 && y < ph - 60) {
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...C.gold);
        doc.text('TOP 10 HIGH EVALUATION ADJUSTERS', m.l, y);
        y += 6;

        const colW = (contentW - 40) / 2;

        doc.setFillColor(...C.headerBg);
        doc.rect(m.l, y, contentW, 6, 'F');
        doc.setFontSize(7);
        doc.setTextColor(...C.muted);
        doc.text('RANK', m.l + 2, y + 4);
        doc.text('ADJUSTER NAME', m.l + 20, y + 4);
        doc.text('HIGH EVAL AMOUNT', m.l + 20 + colW, y + 4);
        y += 6;

        doc.setFont('helvetica', 'normal');
        highEval.forEach((adj, idx) => {
          if (idx % 2 === 0) {
            doc.setFillColor(...C.rowDark);
            doc.rect(m.l, y, contentW, 6, 'F');
          }
          doc.setTextColor(...C.muted);
          doc.text(String(idx + 1), m.l + 2, y + 4);
          doc.setTextColor(...C.offWhite);
          doc.text(sanitize(adj.name).substring(0, 35), m.l + 20, y + 4);
          doc.setTextColor(...C.green);
          doc.text(sanitize(String(adj.value)), m.l + 20 + colW, y + 4);
          y += 6;
        });
      }
    }

    // === FOOTER ===
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      doc.setFillColor(...C.headerBg);
      doc.rect(0, ph - 10, pw, 10, 'F');
      doc.setFillColor(...C.gold);
      doc.rect(0, ph - 10, pw, 0.5, 'F');

      doc.setFontSize(6);
      doc.setTextColor(...C.muted);
      doc.text('CONFIDENTIAL - EXECUTIVE USE ONLY', m.l, ph - 4);
      doc.text('Fred Loya Insurance | Discipline Command Center', pw / 2, ph - 4, { align: 'center' });
      doc.text('Page ' + i + ' of ' + totalPages, pw - m.r, ph - 4, { align: 'right' });
    }

    // Save
    const filename = sanitize(data.title).replace(/[^a-zA-Z0-9]/g, '_') + '_' + format(new Date(), 'yyyyMMdd_HHmm') + '.pdf';
    const pdfBlob = doc.output('blob');
    downloadBlob(pdfBlob, filename);
    // Log download (fire and forget)
    logDownload('pdf', data.title, 'pdf', data.rows.length, { hasCharts: !!data.charts, hasInsights: !!data.bulletInsights });
    
    return filename;
  };

  // ============================================================
  // EXCEL GENERATOR - With Raw Claims Data
  // ============================================================
  const generateExcel = (data: ExportableData) => {
    const wb = XLSX.utils.book_new();

    // === EXECUTIVE SUMMARY SHEET ===
    const summaryRows: (string | number)[][] = [
      [data.title],
      [data.subtitle || ''],
      ['Generated: ' + data.timestamp],
      data.affectsManager ? ['Prepared For: ' + data.affectsManager] : [],
      [],
    ];

    if (data.directive) {
      summaryRows.push(['DIRECTIVE']);
      summaryRows.push([data.directive]);
      summaryRows.push([]);
    }

    if (data.summary && Object.keys(data.summary).length > 0) {
      summaryRows.push(['KEY METRICS']);
      summaryRows.push(['Metric', 'Value']);
      Object.entries(data.summary).forEach(([k, v]) => {
        // Keep numbers as numbers for Excel SUM compatibility
        summaryRows.push([k, typeof v === 'number' ? v : v]);
      });
      summaryRows.push([]);
    }

    if (data.bulletInsights && data.bulletInsights.length > 0) {
      summaryRows.push(['KEY FINDINGS']);
      data.bulletInsights.forEach((insight, idx) => {
        summaryRows.push([String(idx + 1), insight]);
      });
      summaryRows.push([]);
    }

    if (data.columns.length > 0 && data.rows.length > 0) {
      const normalized = withTeamNumberColumn({ columns: data.columns, rows: data.rows });

      summaryRows.push(['DATA SUMMARY']);
      summaryRows.push(normalized.columns);
      normalized.rows.forEach(row => {
        summaryRows.push(row.map(c => typeof c === 'number' ? c : String(c)));
      });
    }

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Executive Summary');

    // === ADJUSTER TRACKING SHEET ===
    if (data.managerTracking && data.managerTracking.length > 0) {
      const highEval = data.managerTracking.filter(m => m.category === 'high_eval');
      const noEval = data.managerTracking.filter(m => m.category === 'no_eval');

      if (highEval.length > 0) {
        const adjRows: (string | number)[][] = [
          ['ADJUSTER HIGH EVALUATION TRACKING'],
          ['Generated: ' + data.timestamp],
          [],
          ['Rank', 'Adjuster Name', 'High Eval Amount'],
        ];
        highEval.forEach((adj, idx) => {
          // Keep value as number if it's numeric for Excel SUM
          const numValue = typeof adj.value === 'number' ? adj.value : 
            (typeof adj.value === 'string' && !isNaN(parseFloat(adj.value.replace(/[$,]/g, ''))) 
              ? parseFloat(adj.value.replace(/[$,]/g, '')) 
              : adj.value);
          adjRows.push([idx + 1, adj.name, numValue]);
        });

        if (noEval.length > 0) {
          adjRows.push([]);
          adjRows.push(['NO EVALUATION ASSIGNED']);
          adjRows.push(['Assigned To', 'Claims Count']);
          noEval.forEach(item => {
            // Keep value as number if it's numeric for Excel SUM
            const numValue = typeof item.value === 'number' ? item.value : 
              (typeof item.value === 'string' && !isNaN(parseFloat(item.value.replace(/[$,]/g, ''))) 
                ? parseFloat(item.value.replace(/[$,]/g, '')) 
                : item.value);
            adjRows.push([item.name, numValue]);
          });
        }

        const adjSheet = XLSX.utils.aoa_to_sheet(adjRows);
        adjSheet['!cols'] = [{ wch: 10 }, { wch: 35 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(wb, adjSheet, 'Adjuster Tracking');
      }
    }

    // === RAW CLAIM DATA SHEETS ===
    if (data.rawClaimData && data.rawClaimData.length > 0) {
      data.rawClaimData.forEach((rawData, idx) => {
        const normalized = withTeamNumberColumn({ columns: rawData.columns, rows: rawData.rows });
        const sheetName = (rawData.sheetName || 'Claims Data ' + (idx + 1)).substring(0, 31);

        const rawRows: (string | number)[][] = [normalized.columns];
        normalized.rows.forEach(row => {
          rawRows.push(row.map(c => typeof c === 'number' ? c : String(c)));
        });

        const rawSheet = XLSX.utils.aoa_to_sheet(rawRows);
        
        // Apply Excel number formats based on headers
        autoFormatByHeaders(rawSheet, normalized.columns);
        
        const colWidths = normalized.columns.map((col, i) => {
          const maxLen = Math.max(col.length, ...normalized.rows.slice(0, 100).map(r => String(r[i] || '').length));
          return { wch: Math.min(maxLen + 2, 50) };
        });
        rawSheet['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, rawSheet, sheetName);
      });
    }

    // Apply formatting to summary sheet based on data columns
    if (data.columns.length > 0) {
      autoFormatByHeaders(summarySheet, data.columns);
    }

    const filename = data.title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_') + '_' + format(new Date(), 'yyyyMMdd_HHmm') + '.xlsx';
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const xlsxBlob = new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlob(xlsxBlob, filename);
    // Log download (fire and forget)
    const totalRows = data.rows.length + (data.rawClaimData?.reduce((sum, r) => sum + r.rows.length, 0) || 0);
    logDownload('excel', data.title, 'xlsx', totalRows, { hasRawData: !!data.rawClaimData });
    
    return filename;
  };

  // Export both PDF and Excel
  const exportBoth = async (data: ExportableData) => {
    const pdfFile = await generatePDF(data);
    const xlsFile = generateExcel(data);
    return { pdfFile, xlsFile };
  };

  // Generate full Excel with multiple sections
  const generateFullExcel = (sections: { title: string; data: ExportableData }[]) => {
    const wb = XLSX.utils.book_new();

    sections.forEach((section, sectionIdx) => {
      const { data } = section;
      const rows: (string | number)[][] = [
        [data.title],
        [data.subtitle || ''],
        ['Generated: ' + data.timestamp],
        [],
      ];

      if (data.summary && Object.keys(data.summary).length > 0) {
        rows.push(['KEY METRICS']);
        Object.entries(data.summary).forEach(([k, v]) => {
          rows.push([k, String(v)]);
        });
        rows.push([]);
      }

      if (data.columns.length > 0 && data.rows.length > 0) {
        const normalized = withTeamNumberColumn({ columns: data.columns, rows: data.rows });

        rows.push(['DATA']);
        rows.push(normalized.columns);
        normalized.rows.forEach(row => {
          rows.push(row.map(c => typeof c === 'number' ? c : String(c)));
        });
      }

      const sheet = XLSX.utils.aoa_to_sheet(rows);
      const safeSheetName = (String(sectionIdx + 1) + '. ' + section.title).substring(0, 31);
      XLSX.utils.book_append_sheet(wb, sheet, safeSheetName);

      // Raw data sheets
      if (data.rawClaimData && data.rawClaimData.length > 0) {
        data.rawClaimData.forEach((rawData, rawIdx) => {
          const normalized = withTeamNumberColumn({ columns: rawData.columns, rows: rawData.rows });

          const rawRows: (string | number)[][] = [normalized.columns];
          normalized.rows.forEach(row => {
            rawRows.push(row.map(c => typeof c === 'number' ? c : String(c)));
          });
          const rawSheet = XLSX.utils.aoa_to_sheet(rawRows);
          const rawName = (String(sectionIdx + 1) + '.' + String(rawIdx + 1) + ' ' + (rawData.sheetName || 'Data')).substring(0, 31);
          XLSX.utils.book_append_sheet(wb, rawSheet, rawName);
        });
      }
    });

    const filename = 'Executive_Full_Export_' + format(new Date(), 'yyyyMMdd_HHmm') + '.xlsx';
    XLSX.writeFile(wb, filename);
    return filename;
  };

  // ============================================================
  // EXECUTIVE PDF GENERATOR - Dashboard Style
  // ============================================================
  const generateExecutivePDF = async (metrics: {
    totalOpenReserves: number;
    pendingEval: number;
    pendingEvalPct: number;
    closuresThisMonth: number;
    avgDaysToClose: number;
    closureTrend: number;
    aged365Count: number;
    aged365Reserves: number;
    aged365Pct: number;
    litigationCount: number;
    litigationReserves: number;
    litigationPct: number;
  }) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = { l: 12, r: 12, t: 10, b: 10 };
    const cw = pw - m.l - m.r;

    const C = {
      bg: [18, 18, 22] as [number, number, number],
      card: [28, 28, 35] as [number, number, number],
      header: [38, 38, 48] as [number, number, number],
      white: [255, 255, 255] as [number, number, number],
      offWhite: [235, 235, 240] as [number, number, number],
      muted: [140, 140, 155] as [number, number, number],
      red: [220, 60, 60] as [number, number, number],
      green: [45, 180, 90] as [number, number, number],
      amber: [235, 170, 45] as [number, number, number],
      gold: [212, 175, 55] as [number, number, number],
    };

    doc.setFillColor(...C.bg);
    doc.rect(0, 0, pw, ph, 'F');

    // Header
    doc.setFillColor(...C.header);
    doc.rect(0, 0, pw, 20, 'F');
    doc.setFillColor(...C.gold);
    doc.rect(0, 20, pw, 1.2, 'F');

    try {
      const logoBase64 = await loadImageAsBase64(loyaLogo);
      doc.addImage(logoBase64, 'JPEG', m.l, 3.5, 38, 11);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...C.white);
      doc.text('FRED LOYA INSURANCE', m.l, 11);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.gold);
    doc.text('EXECUTIVE COMMAND CENTER', pw - m.r, 9, { align: 'right' });
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(format(new Date(), 'MMMM d, yyyy'), pw - m.r, 15, { align: 'right' });

    let y = 28;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...C.white);
    doc.text('CLAIMS INVENTORY BRIEFING', m.l, y);
    y += 10;

    // KPI Cards - 4 across
    const kpis = [
      { label: 'TOTAL OPEN RESERVES', value: fmtCurrency(metrics.totalOpenReserves, true), color: C.gold },
      { label: 'PENDING EVALUATION', value: fmtNum(metrics.pendingEval), sub: metrics.pendingEvalPct + '% of inventory', color: C.amber },
      { label: 'AGED 365+ DAYS', value: fmtNum(metrics.aged365Count), sub: fmtCurrency(metrics.aged365Reserves, true) + ' reserves', color: C.red },
      { label: 'LITIGATION MATTERS', value: fmtNum(metrics.litigationCount), sub: fmtCurrency(metrics.litigationReserves, true) + ' exposure', color: C.green },
    ];

    const cardW = (cw - 24) / 4;
    const cardH = 35;

    kpis.forEach((kpi, idx) => {
      const x = m.l + idx * (cardW + 8);

      doc.setFillColor(...C.card);
      doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F');
      doc.setFillColor(...kpi.color);
      doc.rect(x, y, 3, cardH, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text(kpi.label, x + 8, y + 10);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(...C.white);
      doc.text(kpi.value, x + 8, y + 24);

      if (kpi.sub) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...kpi.color);
        doc.text(kpi.sub, x + 8, y + 31);
      }
    });

    y += cardH + 15;

    // Secondary metrics
    const row2 = [
      { label: 'Closures This Month', value: fmtNum(metrics.closuresThisMonth), trend: metrics.closureTrend > 0 ? '+' + metrics.closureTrend + '%' : metrics.closureTrend + '%' },
      { label: 'Avg Days to Close', value: String(metrics.avgDaysToClose) },
      { label: 'Aged % of Total', value: metrics.aged365Pct + '%' },
      { label: 'Litigation % of Reserves', value: metrics.litigationPct + '%' },
    ];

    doc.setFillColor(...C.card);
    doc.rect(m.l, y, cw, 22, 'F');
    doc.setFillColor(...C.gold);
    doc.rect(m.l, y, cw, 0.5, 'F');

    const secW = cw / 4;
    row2.forEach((item, idx) => {
      const x = m.l + idx * secW;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text(item.label.toUpperCase(), x + 8, y + 8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...C.white);
      doc.text(item.value, x + 8, y + 17);

      if (item.trend) {
        doc.setFontSize(8);
        const trendColor = item.trend.startsWith('+') ? C.green : C.red;
        doc.setTextColor(trendColor[0], trendColor[1], trendColor[2]);
        doc.text(item.trend, x + 40, y + 17);
      }
    });

    // Footer
    doc.setFillColor(...C.header);
    doc.rect(0, ph - 10, pw, 10, 'F');
    doc.setFillColor(...C.gold);
    doc.rect(0, ph - 10, pw, 0.5, 'F');
    doc.setFontSize(6);
    doc.setTextColor(...C.muted);
    doc.text('CONFIDENTIAL - EXECUTIVE USE ONLY', m.l, ph - 4);
    doc.text('Page 1 of 1', pw - m.r, ph - 4, { align: 'right' });

    const filename = 'Executive_Command_Center_' + format(new Date(), 'yyyyMMdd_HHmm') + '.pdf';
    doc.save(filename);
    return filename;
  };

  // Executive package generator - accepts metrics and breakdown data
  const generateExecutivePackage = async (
    metrics: {
      totalOpenReserves: number;
      pendingEval: number;
      pendingEvalPct: number;
      closuresThisMonth: number;
      avgDaysToClose: number;
      closureTrend: number;
      aged365Count: number;
      aged365Reserves: number;
      aged365Pct: number;
      reservesMoM: number;
      reservesYoY: number;
      lowEval: number;
      medianEval: number;
      highEval: number;
    },
    breakdowns: {
      byAge: { age: string; claims: number; openReserves: number; lowEval: number; highEval: number }[];
      byQueue: { queue: string; openReserves: number; lowEval: number; highEval: number }[];
      byTypeGroup: { typeGroup: string; reserves: number }[];
      highEvalAdjusters: { name: string; value: string; files?: number; reserves?: string }[];
      quarterlyData: { quarter: string; paid: number; approved: number; variance: number }[];
    }
  ) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = { l: 12, r: 12, t: 10, b: 10 };
    const cw = pw - m.l - m.r;

    const C = {
      bg: [18, 18, 22] as [number, number, number],
      card: [28, 28, 35] as [number, number, number],
      header: [38, 38, 48] as [number, number, number],
      white: [255, 255, 255] as [number, number, number],
      offWhite: [235, 235, 240] as [number, number, number],
      muted: [140, 140, 155] as [number, number, number],
      red: [220, 60, 60] as [number, number, number],
      green: [45, 180, 90] as [number, number, number],
      amber: [235, 170, 45] as [number, number, number],
      gold: [212, 175, 55] as [number, number, number],
    };

    // PAGE 1: Executive Summary
    doc.setFillColor(...C.bg);
    doc.rect(0, 0, pw, ph, 'F');

    // Header
    doc.setFillColor(...C.header);
    doc.rect(0, 0, pw, 20, 'F');
    doc.setFillColor(...C.gold);
    doc.rect(0, 20, pw, 1.2, 'F');

    // Logo - constrained aspect ratio (original is ~3:1 ratio)
    try {
      const logoBase64 = await loadImageAsBase64(loyaLogo);
      // Use fixed dimensions that maintain aspect ratio: height 10mm, width ~30mm (3:1)
      doc.addImage(logoBase64, 'JPEG', m.l, 4, 30, 10);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...C.white);
      doc.text('FRED LOYA INSURANCE', m.l, 11);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.gold);
    doc.text('CLAIMS INVENTORY PACKAGE', pw - m.r, 9, { align: 'right' });
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(format(new Date(), 'MMMM d, yyyy'), pw - m.r, 15, { align: 'right' });

    let y = 28;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...C.white);
    doc.text('OPEN INVENTORY EXECUTIVE SUMMARY', m.l, y);
    y += 10;

    // KPI Cards
    const kpis = [
      { label: 'TOTAL OPEN RESERVES', value: fmtCurrency(metrics.totalOpenReserves, true), color: C.gold },
      { label: 'PENDING EVALUATION', value: fmtNum(metrics.pendingEval), color: C.amber },
      { label: 'AGED 365+ DAYS', value: fmtNum(metrics.aged365Count), color: C.red },
      { label: 'AVG DAYS TO CLOSE', value: String(metrics.avgDaysToClose), color: C.green },
    ];

    const cardW = (cw - 24) / 4;
    const cardH = 24; // Reduced from 30

    kpis.forEach((kpi, idx) => {
      const x = m.l + idx * (cardW + 8);
      doc.setFillColor(...C.card);
      doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F');
      doc.setFillColor(...kpi.color);
      doc.rect(x, y, 3, cardH, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...C.muted);
      doc.text(kpi.label, x + 8, y + 8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...C.white);
      doc.text(kpi.value, x + 8, y + 18);
    });

    y += cardH + 6; // Reduced gap

    // Secondary row - more compact
    const row2 = [
      { label: 'Closures This Month', value: fmtNum(metrics.closuresThisMonth) },
      { label: 'Aged % of Total', value: metrics.aged365Pct + '%' },
      { label: 'Low Evaluation', value: fmtCurrency(metrics.lowEval, true) },
      { label: 'High Evaluation', value: fmtCurrency(metrics.highEval, true) },
    ];

    doc.setFillColor(...C.card);
    doc.rect(m.l, y, cw, 14, 'F'); // Reduced from 18

    const secW = cw / 4;
    row2.forEach((item, idx) => {
      const x = m.l + idx * secW;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...C.muted);
      doc.text(item.label.toUpperCase(), x + 6, y + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...C.white);
      doc.text(item.value, x + 6, y + 11);
    });

    y += 18; // Reduced gap

    // Age breakdown table - compact
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.gold);
    doc.text('RESERVES BY AGE BUCKET', m.l, y);
    y += 4;

    const ageHeaders = ['Age Bucket', 'Claims', 'Open Reserves', 'Low Eval', 'High Eval'];
    const ageColW = cw / 5;

    doc.setFillColor(...C.header);
    doc.rect(m.l, y, cw, 5, 'F'); // Reduced from 6
    doc.setFontSize(6);
    doc.setTextColor(...C.muted);
    ageHeaders.forEach((h, i) => {
      doc.text(h.toUpperCase(), m.l + i * ageColW + 3, y + 3.5);
    });
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    breakdowns.byAge.slice(0, 5).forEach((row, idx) => { // Show only 5 age buckets
      if (idx % 2 === 0) {
        doc.setFillColor(...C.card);
        doc.rect(m.l, y, cw, 4.5, 'F'); // Reduced from 6
      }
      doc.setTextColor(...C.offWhite);
      doc.text(row.age, m.l + 3, y + 3);
      doc.text(fmtNum(row.claims), m.l + ageColW + 3, y + 3);
      doc.text(fmtCurrency(row.openReserves, true), m.l + 2 * ageColW + 3, y + 3);
      doc.text(fmtCurrency(row.lowEval, true), m.l + 3 * ageColW + 3, y + 3);
      doc.text(fmtCurrency(row.highEval, true), m.l + 4 * ageColW + 3, y + 3);
      y += 4.5;
    });

    y += 5; // Reduced gap

    // MANAGER ACCOUNTABILITY - High Eval Exposure - Compact rows
    if (breakdowns.highEvalAdjusters.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.gold);
      doc.text('MANAGER ACCOUNTABILITY - HIGH EVALUATION EXPOSURE', m.l, y);
      y += 4;

      // Simplified 3-column table: Rank, Name, High Eval Amount
      const adjColW = [cw * 0.08, cw * 0.52, cw * 0.40];
      
      doc.setFillColor(...C.header);
      doc.rect(m.l, y, cw, 5, 'F');
      doc.setFontSize(6);
      doc.setTextColor(...C.muted);
      doc.text('RANK', m.l + 3, y + 3.5);
      doc.text('MANAGER NAME', m.l + adjColW[0] + 3, y + 3.5);
      doc.text('HIGH EVAL EXPOSURE', m.l + adjColW[0] + adjColW[1] + 3, y + 3.5);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      breakdowns.highEvalAdjusters.slice(0, 10).forEach((adj, idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(...C.card);
          doc.rect(m.l, y, cw, 4, 'F');
        }
        
        // Rank
        doc.setTextColor(...C.muted);
        doc.text(String(idx + 1), m.l + 3, y + 3);
        
        // Adjuster name
        doc.setTextColor(...C.offWhite);
        doc.text(sanitize(adj.name).substring(0, 40), m.l + adjColW[0] + 3, y + 3);
        
        // High eval exposure (use value which contains the formatted amount)
        doc.setTextColor(...C.green);
        doc.text(adj.value, m.l + adjColW[0] + adjColW[1] + 3, y + 3);
        
        y += 4;
      });
    }

    // Footer
    doc.setFillColor(...C.header);
    doc.rect(0, ph - 10, pw, 10, 'F');
    doc.setFillColor(...C.gold);
    doc.rect(0, ph - 10, pw, 0.5, 'F');
    doc.setFontSize(6);
    doc.setTextColor(...C.muted);
    doc.text('CONFIDENTIAL - EXECUTIVE USE ONLY', m.l, ph - 4);
    doc.text('Fred Loya Insurance | Claims Inventory Package', pw / 2, ph - 4, { align: 'center' });
    doc.text('Page 1', pw - m.r, ph - 4, { align: 'right' });

    // Save
    const filename = 'Claims_Inventory_Package_' + format(new Date(), 'yyyyMMdd_HHmm') + '.pdf';
    doc.save(filename);
    return filename;
  };

  // ============================================================
  // PREMIUM C-SUITE EXECUTIVE BRIEFING - Multi-Page PDF
  // Modern, gradient-rich, board-ready document
  // ============================================================
  const generateCSuiteBriefing = async (data: {
    totalClaims: number;
    totalReserves: number;
    cp1Rate: string;
    cp1Count?: number;
    aged365Plus: number;
    aged365Reserves: number;
    noEvalCount: number;
    noEvalReserves: number;
    decisionsCount: number;
    decisionsExposure: number;
    biSpend2026: number;
    biSpend2025: number;
    dataDate: string;
    delta?: { change: number; changePercent: number; reservesChange: number; reservesChangePercent: number };
    // Fatality & Severity
    fatalityCount?: number;
    fatalityReserves?: number;
    surgeryCount?: number;
    hospitalizationCount?: number;
  }) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = { l: 15, r: 15, t: 15, b: 15 };
    const cw = pw - m.l - m.r;

    // Premium color palette
    const C = {
      // Core brand
      bg: [10, 10, 14] as [number, number, number],
      headerBg: [18, 18, 24] as [number, number, number],
      card: [24, 24, 32] as [number, number, number],
      cardAlt: [32, 32, 42] as [number, number, number],
      // Text
      white: [255, 255, 255] as [number, number, number],
      offWhite: [240, 240, 245] as [number, number, number],
      muted: [120, 120, 140] as [number, number, number],
      // Accents
      gold: [212, 175, 55] as [number, number, number],
      goldDark: [180, 140, 40] as [number, number, number],
      emerald: [16, 185, 129] as [number, number, number],
      emeraldDark: [5, 150, 105] as [number, number, number],
      red: [220, 38, 38] as [number, number, number],
      amber: [245, 158, 11] as [number, number, number],
      blue: [59, 130, 246] as [number, number, number],
      purple: [139, 92, 246] as [number, number, number],
    };

    // Helper to draw gradient rectangle (simulated with layers)
    const drawGradientRect = (x: number, y: number, w: number, h: number, colorTop: [number, number, number], colorBot: [number, number, number], steps = 10) => {
      const stepH = h / steps;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const r = Math.round(colorTop[0] + (colorBot[0] - colorTop[0]) * t);
        const g = Math.round(colorTop[1] + (colorBot[1] - colorTop[1]) * t);
        const b = Math.round(colorTop[2] + (colorBot[2] - colorTop[2]) * t);
        doc.setFillColor(r, g, b);
        doc.rect(x, y + i * stepH, w, stepH + 0.5, 'F');
      }
    };

    // ════════════════════════════════════════════════════════════════════════
    // PAGE 1: EXECUTIVE SUMMARY
    // ════════════════════════════════════════════════════════════════════════
    
    // Full page dark background
    doc.setFillColor(...C.bg);
    doc.rect(0, 0, pw, ph, 'F');

    // Top accent bar with gradient
    drawGradientRect(0, 0, pw, 3, C.gold, C.goldDark);

    // Header section with logo
    doc.setFillColor(...C.headerBg);
    doc.rect(0, 3, pw, 35, 'F');

    // Logo - constrained aspect ratio (original is ~3:1 ratio)
    try {
      const logoBase64 = await loadImageAsBase64(loyaLogo);
      // Use fixed dimensions that maintain aspect ratio: height 16mm, width ~48mm (3:1)
      doc.addImage(logoBase64, 'JPEG', m.l, 10, 48, 16);
    } catch { /* skip logo */ }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...C.white);
    doc.text('EXECUTIVE PORTFOLIO BRIEFING', m.l + 55, 18);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.gold);
    doc.text('Fred Loya Insurance | Discipline Command Center', m.l + 55, 26);

    // Right side info
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text('CONFIDENTIAL', pw - m.r, 14, { align: 'right' });
    doc.setTextColor(...C.offWhite);
    doc.text(format(new Date(), 'MMMM d, yyyy'), pw - m.r, 22, { align: 'right' });
    doc.setTextColor(...C.muted);
    doc.text('Data: ' + sanitize(data.dataDate), pw - m.r, 30, { align: 'right' });

    // Gold separator
    doc.setFillColor(...C.gold);
    doc.rect(0, 38, pw, 1, 'F');

    let y = 48;

    // STATUS BANNER
    const hasRisk = data.noEvalCount > 5000 || data.aged365Plus > 3000 || data.decisionsCount > 100;
    const bannerColors = hasRisk ? { top: C.amber, bot: [200, 130, 10] as [number, number, number] } : { top: C.emerald, bot: C.emeraldDark };
    const statusText = hasRisk ? 'PORTFOLIO REQUIRES ATTENTION' : 'PORTFOLIO HEALTH: STABLE';
    
    drawGradientRect(m.l, y, cw, 16, bannerColors.top, bannerColors.bot);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...C.bg);
    doc.text(statusText, pw / 2, y + 10.5, { align: 'center' });
    y += 24;

    // ═══════════════════════════════════════════════════════════════════
    // PRIMARY METRICS - 4 Column Cards
    // ═══════════════════════════════════════════════════════════════════
    
    const cardW = (cw - 18) / 4;
    const cardH = 42;
    
    const primaryMetrics = [
      { 
        label: 'OPEN CLAIMS', 
        value: fmtNum(data.totalClaims), 
        sub: data.delta ? `${data.delta.change >= 0 ? '+' : ''}${data.delta.change} MoM` : 'Active inventory',
        color: C.emerald,
        trend: data.delta?.change || 0,
      },
      { 
        label: 'TOTAL RESERVES', 
        value: fmtCurrency(data.totalReserves, true), 
        sub: data.delta ? `${data.delta.reservesChangePercent >= 0 ? '+' : ''}${data.delta.reservesChangePercent.toFixed(1)}% change` : 'Gross exposure',
        color: C.emerald,
        trend: data.delta?.reservesChangePercent || 0,
      },
      { 
        label: 'CP1 RATE', 
        value: data.cp1Rate + '%', 
        sub: data.cp1Count?.toLocaleString() + ' claims',
        color: parseFloat(data.cp1Rate) >= 30 ? C.emerald : C.amber,
        trend: 0,
      },
      { 
        label: 'DECISIONS PENDING', 
        value: fmtNum(data.decisionsCount), 
        sub: fmtCurrency(data.decisionsExposure, true) + ' exposure',
        color: data.decisionsCount > 100 ? C.red : data.decisionsCount > 50 ? C.amber : C.emerald,
        trend: 0,
      },
    ];

    primaryMetrics.forEach((metric, idx) => {
      const x = m.l + idx * (cardW + 6);
      
      // Card background with subtle gradient
      doc.setFillColor(...C.card);
      doc.roundedRect(x, y, cardW, cardH, 3, 3, 'F');
      
      // Left accent bar
      doc.setFillColor(...metric.color);
      doc.rect(x, y + 2, 3, cardH - 4, 'F');

      // Label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text(metric.label, x + 10, y + 10);

      // Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...C.white);
      doc.text(metric.value, x + 10, y + 26);

      // Subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const subColor = metric.trend < 0 ? C.emerald : metric.trend > 0 ? C.red : C.muted;
      doc.setTextColor(...subColor);
      doc.text(metric.sub, x + 10, y + 35);
    });

    y += cardH + 12;

    // ═══════════════════════════════════════════════════════════════════
    // RISK INDICATORS - 3 Column Layout
    // ═══════════════════════════════════════════════════════════════════
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.gold);
    doc.text('RISK INDICATORS', m.l, y);
    y += 8;

    const riskCardW = (cw - 12) / 3;
    const riskCardH = 38;

    const risks = [
      { 
        label: '🔴 FATALITY CLAIMS', 
        count: fmtNum(data.fatalityCount || 0), 
        exposure: fmtCurrency(data.fatalityReserves || 0, true),
        pct: data.totalClaims > 0 ? (((data.fatalityCount || 0) / data.totalClaims) * 100).toFixed(2) + '%' : '0%',
        level: (data.fatalityCount || 0) > 0 ? 'critical' : 'normal',
        icon: '💀',
      },
      { 
        label: 'NO EVALUATION', 
        count: fmtNum(data.noEvalCount), 
        exposure: fmtCurrency(data.noEvalReserves, true),
        pct: ((data.noEvalCount / data.totalClaims) * 100).toFixed(0) + '%',
        level: data.noEvalCount > 5000 ? 'critical' : data.noEvalCount > 2000 ? 'warning' : 'normal',
        icon: '⚠',
      },
      { 
        label: 'AGED 365+ DAYS', 
        count: fmtNum(data.aged365Plus), 
        exposure: fmtCurrency(data.aged365Reserves, true),
        pct: ((data.aged365Plus / data.totalClaims) * 100).toFixed(0) + '%',
        level: data.aged365Plus > 3000 ? 'critical' : data.aged365Plus > 1500 ? 'warning' : 'normal',
        icon: '⏱',
      },
    ];

    risks.forEach((risk, idx) => {
      const x = m.l + idx * (riskCardW + 6);
      
      const bgColor = risk.level === 'critical' ? [45, 20, 20] as [number, number, number] : 
                      risk.level === 'warning' ? [45, 38, 20] as [number, number, number] : C.card;
      const accentColor = risk.level === 'critical' ? C.red : risk.level === 'warning' ? C.amber : C.emerald;
      
      doc.setFillColor(...bgColor);
      doc.roundedRect(x, y, riskCardW, riskCardH, 3, 3, 'F');
      
      // Status indicator circle
      doc.setFillColor(...accentColor);
      doc.circle(x + 10, y + 10, 4, 'F');

      // Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.white);
      doc.text(risk.label, x + 18, y + 12);

      // Count
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(...accentColor);
      doc.text(risk.count, x + 10, y + 26);

      // Details
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text(risk.exposure + ' | ' + risk.pct, x + 10, y + 33);
    });

    y += riskCardH + 12;

    // ═══════════════════════════════════════════════════════════════════
    // ACTION ITEMS
    // ═══════════════════════════════════════════════════════════════════
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.gold);
    doc.text('RECOMMENDED EXECUTIVE ACTIONS', m.l, y);
    y += 8;

    const actions: string[] = [];
    if ((data.fatalityCount || 0) > 0) actions.push('FATALITY ALERT: ' + fmtNum(data.fatalityCount || 0) + ' fatality claims (' + fmtCurrency(data.fatalityReserves || 0, true) + ' exposure) require immediate executive review');
    if (data.noEvalCount > 2000) actions.push('PRIORITY: Clear ' + fmtNum(data.noEvalCount) + ' pending evaluations within 48-72 hours');
    if (data.aged365Plus > 1500) actions.push('ESCALATION: Review ' + fmtNum(data.aged365Plus) + ' aged claims for resolution strategy');
    if (data.decisionsCount > 0) actions.push('DECISIONS: ' + fmtNum(data.decisionsCount) + ' claims requiring executive decision (' + fmtCurrency(data.decisionsExposure, true) + ' exposure)');
    if (parseFloat(data.cp1Rate) < 30) actions.push('OPTIMIZATION: CP1 rate at ' + data.cp1Rate + '% - target 35%+ through early settlement');
    if (actions.length === 0) actions.push('MAINTAIN: Continue standard portfolio monitoring cadence');

    doc.setFillColor(...C.card);
    doc.roundedRect(m.l, y, cw, actions.length * 10 + 8, 3, 3, 'F');
    
    actions.forEach((action, idx) => {
      const isHigh = action.startsWith('PRIORITY') || action.startsWith('ESCALATION') || action.startsWith('FATALITY');
      const circleColor = isHigh ? C.red : C.gold;
      doc.setFillColor(...circleColor);
      doc.circle(m.l + 8, y + 8 + idx * 10, 2, 'F');
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.offWhite);
      doc.text(sanitize(action), m.l + 15, y + 10 + idx * 10);
    });

    // Footer
    doc.setFillColor(...C.headerBg);
    doc.rect(0, ph - 14, pw, 14, 'F');
    doc.setFillColor(...C.gold);
    doc.rect(0, ph - 14, pw, 0.5, 'F');
    
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text('CONFIDENTIAL - C-SUITE DISTRIBUTION ONLY', m.l, ph - 6);
    doc.text('Fred Loya Insurance | Claims Portfolio Executive Briefing', pw / 2, ph - 6, { align: 'center' });
    doc.text('Page 1 of 1', pw - m.r, ph - 6, { align: 'right' });

    // Save
    const filename = 'CSuite_Executive_Briefing_' + format(new Date(), 'yyyyMMdd_HHmm') + '.pdf';
    doc.save(filename);
    
    logDownload('pdf', 'C-Suite Executive Briefing', 'pdf', 1, { level: 'executive', premium: true });
    
    return filename;
  };

  // ============================================================
  // PREMIUM C-SUITE EXCEL - Multi-Sheet Executive Workbook
  // ============================================================
  const generateCSuiteExcel = (data: {
    totalClaims: number;
    totalReserves: number;
    cp1Rate: string;
    cp1Count: number;
    aged365Plus: number;
    aged365Reserves: number;
    aged181to365: number;
    noEvalCount: number;
    noEvalReserves: number;
    decisionsCount: number;
    decisionsExposure: number;
    lowEval: number;
    highEval: number;
    biSpend2026: number;
    biSpend2025: number;
    dataDate: string;
    // Fatality & Severity
    fatalityCount?: number;
    fatalityReserves?: number;
    surgeryCount?: number;
    hospitalizationCount?: number;
    // Week-over-Week comparison (optional)
    priorWeek?: {
      totalClaims: number;
      totalReserves: number;
      cp1Rate: string;
      noEvalCount: number;
      aged365Plus: number;
      dataDate: string;
    };
    // Raw claim data for management action
    rawClaims?: Array<{
      claimNumber: string;
      claimant: string;
      coverage: string;
      days: number;
      ageBucket: string;
      typeGroup: string;
      openReserves: number;
      lowEval: number;
      highEval: number;
      cp1Flag: string;
      adjuster: string;
      areaNumber: string;
      fatality?: boolean;
      surgery?: boolean;
      hospitalization?: boolean;
    }>;
  }) => {
    const wb = XLSX.utils.book_new();

    // ═══════════════════════════════════════════════════════════════
    // SHEET 1: EXECUTIVE DASHBOARD
    // ═══════════════════════════════════════════════════════════════
    const dashboardRows: (string | number)[][] = [
      ['┌─────────────────────────────────────────────────────────────────────────────┐'],
      ['│  C-SUITE PORTFOLIO BRIEFING                                                │'],
      ['│  Fred Loya Insurance                                                       │'],
      ['│  ' + format(new Date(), 'MMMM d, yyyy') + '  |  Data: ' + data.dataDate + '  |  CONFIDENTIAL            │'],
      ['└─────────────────────────────────────────────────────────────────────────────┘'],
      [''],
      ['PORTFOLIO SNAPSHOT'],
      ['Metric', 'Value', 'Status'],
      ['Total Claims', data.totalClaims.toLocaleString(), ''],
      ['Reserves', fmtCurrency(data.totalReserves, false), ''],
      ['Evaluation Range', fmtCurrency(data.lowEval, false) + ' - ' + fmtCurrency(data.highEval, false), ''],
      ['CP1 Rate', data.cp1Rate + '% (' + (data.cp1Count || 0).toLocaleString() + ' claims)', parseFloat(data.cp1Rate) >= 30 ? 'OK' : 'CRITICAL'],
      [''],
      ['RISK AREAS'],
      ['Category', 'Count', 'Exposure', 'Alert'],
      ['Fatality', data.fatalityCount || 0, fmtCurrency(data.fatalityReserves || 0, false), (data.fatalityCount || 0) > 0 ? 'CRITICAL' : '-'],
      ['Surgery', data.surgeryCount || 0, '-', (data.surgeryCount || 0) > 50 ? 'ELEVATED' : '-'],
      ['Hospitalization', data.hospitalizationCount || 0, '-', (data.hospitalizationCount || 0) > 100 ? 'ELEVATED' : '-'],
      ['No Evaluation', data.noEvalCount.toLocaleString(), fmtCurrency(data.noEvalReserves, false), data.noEvalCount > 2000 ? 'HIGH' : '-'],
      ['Aged 365+', data.aged365Plus.toLocaleString(), fmtCurrency(data.aged365Reserves, false), data.aged365Plus > 1500 ? 'HIGH' : '-'],
      ['Pending Decisions', data.decisionsCount, fmtCurrency(data.decisionsExposure, false), data.decisionsCount > 100 ? 'REVIEW' : '-'],
      [''],
      ['SPEND TREND'],
      ['Period', 'Amount'],
      ['2025 Full Year', fmtCurrency(data.biSpend2025, false)],
      ['2026 YTD', fmtCurrency(data.biSpend2026, false)],
      ['2026 Projected', fmtCurrency(data.biSpend2026 * 12, false)],
      [''],
      ['ACTION ITEMS'],
    ];

    if ((data.fatalityCount || 0) > 0) dashboardRows.push(['CRITICAL: ' + (data.fatalityCount || 0) + ' fatality claims require immediate review']);
    if (data.noEvalCount > 2000) dashboardRows.push(['HIGH: Clear ' + data.noEvalCount.toLocaleString() + ' pending evaluations']);
    if (data.aged365Plus > 1500) dashboardRows.push(['HIGH: Review ' + data.aged365Plus.toLocaleString() + ' aged claims']);
    if (data.decisionsCount > 0) dashboardRows.push(['MEDIUM: ' + data.decisionsCount + ' claims pending decision']);
    if (parseFloat(data.cp1Rate) < 30) dashboardRows.push(['CRITICAL: CP1 rate below target (' + data.cp1Rate + '% vs 35%)']);
    
    dashboardRows.push(['']);
    dashboardRows.push(['─────────────────────────────────────────────────────────────────────────────']);
    dashboardRows.push(['Confidential - C-Suite Distribution Only']);

    const dashSheet = XLSX.utils.aoa_to_sheet(dashboardRows);
    dashSheet['!cols'] = [{ wch: 25 }, { wch: 22 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, dashSheet, 'Executive Summary');

    // SHEET 2: RISK DETAIL
    const riskRows: (string | number)[][] = [
      ['RISK ANALYSIS'],
      [format(new Date(), 'MMMM d, yyyy')],
      [''],
      ['Category', 'Metric', 'Value', 'Threshold', 'Status'],
      ['Fatality', 'Count', data.fatalityCount || 0, 0, (data.fatalityCount || 0) > 0 ? 'CRITICAL' : 'OK'],
      ['Fatality', 'Exposure', fmtCurrency(data.fatalityReserves || 0, false), '-', '-'],
      ['Severity', 'Surgery', data.surgeryCount || 0, 50, (data.surgeryCount || 0) > 50 ? 'ELEVATED' : 'OK'],
      ['Severity', 'Hospitalization', data.hospitalizationCount || 0, 100, (data.hospitalizationCount || 0) > 100 ? 'ELEVATED' : 'OK'],
      [''],
      ['Evaluation', 'No Eval Count', data.noEvalCount.toLocaleString(), '2,000', data.noEvalCount > 2000 ? 'HIGH' : 'OK'],
      ['Evaluation', 'No Eval Exposure', fmtCurrency(data.noEvalReserves, false), '-', '-'],
      [''],
      ['Aging', '365+ Days', data.aged365Plus.toLocaleString(), '1,500', data.aged365Plus > 1500 ? 'HIGH' : 'OK'],
      ['Aging', '365+ Exposure', fmtCurrency(data.aged365Reserves, false), '-', '-'],
      ['Aging', '181-365 Days', data.aged181to365.toLocaleString(), '-', 'MONITORING'],
      [''],
      ['CP1', 'Rate', data.cp1Rate + '%', '35%', parseFloat(data.cp1Rate) >= 35 ? 'ON TARGET' : 'CRITICAL'],
      ['CP1', 'Count', (data.cp1Count || 0).toLocaleString(), '-', '-'],
      [''],
      ['Decisions', 'Pending', data.decisionsCount, 50, data.decisionsCount > 50 ? 'ELEVATED' : 'OK'],
      ['Decisions', 'Exposure', fmtCurrency(data.decisionsExposure, false), '-', '-'],
    ];

    const riskSheet = XLSX.utils.aoa_to_sheet(riskRows);
    riskSheet['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, riskSheet, 'Risk Detail');

    // SHEET 3: FINANCIALS
    const trendRows: (string | number)[][] = [
      ['FINANCIAL SUMMARY'],
      [format(new Date(), 'MMMM d, yyyy')],
      [''],
      ['RESERVES'],
      ['Category', 'Amount', '% of Total'],
      ['Total', fmtCurrency(data.totalReserves, false), '100%'],
      ['Low Evaluation', fmtCurrency(data.lowEval, false), ((data.lowEval / data.totalReserves) * 100).toFixed(1) + '%'],
      ['High Evaluation', fmtCurrency(data.highEval, false), ((data.highEval / data.totalReserves) * 100).toFixed(1) + '%'],
      ['No Evaluation', fmtCurrency(data.noEvalReserves, false), ((data.noEvalReserves / data.totalReserves) * 100).toFixed(1) + '%'],
      [''],
      ['BI LITIGATION'],
      ['Period', 'Amount', 'Note'],
      ['2025 Actual', fmtCurrency(data.biSpend2025, false), ''],
      ['2026 YTD', fmtCurrency(data.biSpend2026, false), 'January'],
      ['2026 Projected', fmtCurrency(data.biSpend2026 * 12, false), 'Annualized'],
    ];

    const trendSheet = XLSX.utils.aoa_to_sheet(trendRows);
    trendSheet['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, trendSheet, 'Financials');

    // SHEET 4: WEEK-OVER-WEEK COMPARISON
    const pw = data.priorWeek;
    const wowRows: (string | number)[][] = [
      ['WEEK-OVER-WEEK COMPARISON'],
      [format(new Date(), 'MMMM d, yyyy')],
      [''],
      ['Metric', 'Current', 'Prior Week', 'Change', 'Direction'],
    ];

    if (pw) {
      const claimsDelta = data.totalClaims - pw.totalClaims;
      const reservesDelta = data.totalReserves - pw.totalReserves;
      const cp1Delta = parseFloat(data.cp1Rate) - parseFloat(pw.cp1Rate);
      const noEvalDelta = data.noEvalCount - pw.noEvalCount;
      const aged365Delta = data.aged365Plus - pw.aged365Plus;

      wowRows.push(
        ['Data As Of', data.dataDate, pw.dataDate, '-', '-'],
        [''],
        ['Total Claims', data.totalClaims.toLocaleString(), pw.totalClaims.toLocaleString(), (claimsDelta >= 0 ? '+' : '') + claimsDelta.toLocaleString(), claimsDelta > 0 ? 'UP' : claimsDelta < 0 ? 'DOWN' : 'FLAT'],
        ['Total Reserves', fmtCurrency(data.totalReserves, false), fmtCurrency(pw.totalReserves, false), (reservesDelta >= 0 ? '+' : '') + fmtCurrency(reservesDelta, false), reservesDelta > 0 ? 'UP' : reservesDelta < 0 ? 'DOWN' : 'FLAT'],
        ['CP1 Rate', data.cp1Rate + '%', pw.cp1Rate + '%', (cp1Delta >= 0 ? '+' : '') + cp1Delta.toFixed(1) + '%', cp1Delta > 0 ? 'IMPROVING' : cp1Delta < 0 ? 'DECLINING' : 'FLAT'],
        ['No Evaluation', data.noEvalCount.toLocaleString(), pw.noEvalCount.toLocaleString(), (noEvalDelta >= 0 ? '+' : '') + noEvalDelta.toLocaleString(), noEvalDelta < 0 ? 'IMPROVING' : noEvalDelta > 0 ? 'WORSENING' : 'FLAT'],
        ['Aged 365+', data.aged365Plus.toLocaleString(), pw.aged365Plus.toLocaleString(), (aged365Delta >= 0 ? '+' : '') + aged365Delta.toLocaleString(), aged365Delta < 0 ? 'IMPROVING' : aged365Delta > 0 ? 'WORSENING' : 'FLAT'],
        [''],
        ['SUMMARY'],
        ['Net Claims Movement', claimsDelta >= 0 ? '+' + claimsDelta : claimsDelta, '', '', claimsDelta > 100 ? 'ELEVATED INTAKE' : claimsDelta < -100 ? 'STRONG CLOSURES' : 'NORMAL'],
        ['Reserve Movement', fmtCurrency(reservesDelta, false), '', '', Math.abs(reservesDelta) > 5000000 ? 'SIGNIFICANT' : 'NORMAL'],
        [''],
        [''],
        ['RAW DATA - CURRENT PERIOD'],
        ['Metric', 'Value'],
        ['Data Date', data.dataDate],
        ['Total Open Claims', data.totalClaims],
        ['Total Reserves', data.totalReserves],
        ['Low Evaluation', data.lowEval],
        ['High Evaluation', data.highEval],
        ['CP1 Count', data.cp1Count || 0],
        ['CP1 Rate', parseFloat(data.cp1Rate)],
        ['No Eval Count', data.noEvalCount],
        ['No Eval Reserves', data.noEvalReserves],
        ['Aged 365+ Count', data.aged365Plus],
        ['Aged 365+ Reserves', data.aged365Reserves],
        ['Aged 181-365 Count', data.aged181to365],
        ['Decisions Pending', data.decisionsCount],
        ['Decisions Exposure', data.decisionsExposure],
        ['Fatality Count', data.fatalityCount || 0],
        ['Fatality Reserves', data.fatalityReserves || 0],
        ['Surgery Count', data.surgeryCount || 0],
        ['Hospitalization Count', data.hospitalizationCount || 0],
        ['BI Spend 2025', data.biSpend2025],
        ['BI Spend 2026 YTD', data.biSpend2026],
        [''],
        ['RAW DATA - PRIOR PERIOD'],
        ['Metric', 'Value'],
        ['Data Date', pw.dataDate],
        ['Total Open Claims', pw.totalClaims],
        ['Total Reserves', pw.totalReserves],
        ['CP1 Rate', parseFloat(pw.cp1Rate)],
        ['No Eval Count', pw.noEvalCount],
        ['Aged 365+ Count', pw.aged365Plus],
      );
    } else {
      wowRows.push(
        [''],
        ['Prior week data not available.'],
        [''],
        ['To enable WoW comparison, upload the prior week inventory snapshot.'],
        [''],
        [''],
        ['RAW DATA - CURRENT PERIOD'],
        ['Metric', 'Value'],
        ['Data Date', data.dataDate],
        ['Total Open Claims', data.totalClaims],
        ['Total Reserves', data.totalReserves],
        ['Low Evaluation', data.lowEval],
        ['High Evaluation', data.highEval],
        ['CP1 Count', data.cp1Count || 0],
        ['CP1 Rate', parseFloat(data.cp1Rate)],
        ['No Eval Count', data.noEvalCount],
        ['No Eval Reserves', data.noEvalReserves],
        ['Aged 365+ Count', data.aged365Plus],
        ['Aged 365+ Reserves', data.aged365Reserves],
        ['Aged 181-365 Count', data.aged181to365],
        ['Decisions Pending', data.decisionsCount],
        ['Decisions Exposure', data.decisionsExposure],
        ['Fatality Count', data.fatalityCount || 0],
        ['Fatality Reserves', data.fatalityReserves || 0],
        ['Surgery Count', data.surgeryCount || 0],
        ['Hospitalization Count', data.hospitalizationCount || 0],
        ['BI Spend 2025', data.biSpend2025],
        ['BI Spend 2026 YTD', data.biSpend2026],
      );
    }

    const wowSheet = XLSX.utils.aoa_to_sheet(wowRows);
    wowSheet['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wowSheet, 'WoW Comparison');

    // SHEET 5: RAW CLAIM DATA (for management action)
    if (data.rawClaims && data.rawClaims.length > 0) {
      const claimRows: (string | number | boolean)[][] = [
        ['CLAIM-LEVEL DATA'],
        [format(new Date(), 'MMMM d, yyyy') + ' | ' + data.rawClaims.length + ' claims'],
        [''],
        ['Claim #', 'Claimant', 'Coverage', 'Days', 'Age', 'Type Group', 'Reserves', 'Low Eval', 'High Eval', 'CP1', 'Adjuster', 'Area', 'Fatality', 'Surgery', 'Hosp'],
      ];

      // Sort by reserves descending for prioritization
      const sortedClaims = [...data.rawClaims].sort((a, b) => b.openReserves - a.openReserves);

      for (const claim of sortedClaims) {
        claimRows.push([
          claim.claimNumber,
          claim.claimant,
          claim.coverage,
          claim.days,
          claim.ageBucket,
          claim.typeGroup,
          claim.openReserves,
          claim.lowEval,
          claim.highEval,
          claim.cp1Flag,
          claim.adjuster,
          claim.areaNumber,
          claim.fatality ? 'YES' : '',
          claim.surgery ? 'YES' : '',
          claim.hospitalization ? 'YES' : '',
        ]);
      }

      const claimsSheet = XLSX.utils.aoa_to_sheet(claimRows);
      claimsSheet['!cols'] = [
        { wch: 14 }, { wch: 20 }, { wch: 8 }, { wch: 6 }, { wch: 10 },
        { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 6 },
        { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 6 },
      ];
      XLSX.utils.book_append_sheet(wb, claimsSheet, 'Claim Detail');
    }

    const sheetCount = data.rawClaims?.length ? 5 : 4;
    const filename = 'CSuite_Portfolio_Briefing_' + format(new Date(), 'yyyyMMdd_HHmm') + '.xlsx';
    XLSX.writeFile(wb, filename);
    
    logDownload('excel', 'C-Suite Portfolio Briefing', 'xlsx', sheetCount, { level: 'executive', sheets: sheetCount });
    
    return filename;
  };

  // ============================================================
  // CSV GENERATOR - With formatted $ and % values
  // ============================================================
  const generateCSV = (data: ExportableData, includeFormatting = true) => {
    const rows: string[][] = [];
    
    // Header info
    rows.push([data.title]);
    rows.push([data.subtitle || '']);
    rows.push(['Generated: ' + data.timestamp]);
    rows.push([]);
    
    // Summary metrics
    if (data.summary && Object.keys(data.summary).length > 0) {
      rows.push(['KEY METRICS']);
      rows.push(['Metric', 'Value']);
      Object.entries(data.summary).forEach(([k, v]) => {
        let formattedValue = String(v);
        if (includeFormatting && typeof v === 'number') {
          // Check if key suggests currency
          if (isCurrencyHeader(k)) {
            formattedValue = formatCurrencyDisplay(v);
          } else if (isPercentHeader(k)) {
            formattedValue = formatPercentDisplay(v);
          }
        }
        rows.push([k, formattedValue]);
      });
      rows.push([]);
    }
    
    // Data table
    if (data.columns.length > 0 && data.rows.length > 0) {
      rows.push(['DATA']);
      rows.push(data.columns);
      
      data.rows.forEach(row => {
        const formattedRow = row.map((cell, idx) => {
          if (!includeFormatting || typeof cell !== 'number') {
            return String(cell ?? '');
          }
          
          const header = data.columns[idx] || '';
          if (isCurrencyHeader(header)) {
            return formatCurrencyDisplay(cell);
          }
          if (isPercentHeader(header)) {
            return formatPercentDisplay(cell);
          }
          return String(cell);
        });
        rows.push(formattedRow);
      });
    }
    
    // Convert to CSV string
    const csvContent = rows.map(row => 
      row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma or newline
        const escaped = String(cell).replace(/"/g, '""');
        return escaped.includes(',') || escaped.includes('\n') || escaped.includes('"') 
          ? `"${escaped}"` 
          : escaped;
      }).join(',')
    ).join('\n');
    
    const filename = data.title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_') + '_' + format(new Date(), 'yyyyMMdd_HHmm') + '.csv';
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(csvBlob, filename);
    
    logDownload('csv', data.title, 'csv', data.rows.length, { formatted: includeFormatting });
    
    return filename;
  };

  // ============================================================
  // BOARDROOM EXCEL GENERATOR - Premium styled exports
  // Professional formatting with section headers, borders, colors
  // ============================================================
  interface BoardroomSection {
    title: string;
    subtitle?: string;
    metrics?: { label: string; value: string | number }[];
    table?: {
      headers: string[];
      rows: (string | number)[][];
      highlightColumn?: number; // Column index to highlight (e.g., totals)
      highlightRows?: number[]; // Row indices to highlight (e.g., totals, special)
    };
  }

  interface BoardroomExcelData {
    reportTitle: string;
    asOfDate: string;
    sections: BoardroomSection[];
    filename?: string;
  }

  const generateBoardroomExcel = (data: BoardroomExcelData) => {
    const wb = XLSX.utils.book_new();
    const rows: (string | number | null)[][] = [];
    
    // Track row indices for styling reference
    let rowIdx = 0;
    const sectionHeaderRows: number[] = [];
    const tableHeaderRows: number[] = [];
    const highlightedDataRows: number[] = [];
    const metricRows: number[] = [];
    
    // === REPORT HEADER ===
    rows.push([data.reportTitle.toUpperCase()]);
    rowIdx++;
    rows.push(['As of: ' + data.asOfDate]);
    rowIdx++;
    rows.push([]); // Empty row
    rowIdx++;

    // === PROCESS EACH SECTION ===
    data.sections.forEach((section) => {
      // Section title (like "KEY METRICS", "NEGOTIATION BY TYPE")
      if (section.title) {
        sectionHeaderRows.push(rowIdx);
        rows.push([section.title.toUpperCase()]);
        rowIdx++;
      }
      
      // Key-value metrics (like the top summary)
      if (section.metrics && section.metrics.length > 0) {
        rows.push(['Metric', 'Value']);
        tableHeaderRows.push(rowIdx);
        rowIdx++;
        
        section.metrics.forEach((metric) => {
          metricRows.push(rowIdx);
          const formattedValue = typeof metric.value === 'number' 
            ? (isCurrencyHeader(metric.label) 
                ? formatCurrencyDisplay(metric.value)
                : metric.value.toLocaleString())
            : metric.value;
          rows.push([metric.label, formattedValue]);
          rowIdx++;
        });
        rows.push([]); // Spacer
        rowIdx++;
      }
      
      // Data table
      if (section.table) {
        tableHeaderRows.push(rowIdx);
        rows.push(section.table.headers);
        rowIdx++;
        
        section.table.rows.forEach((row, dataRowIdx) => {
          // Check if this row should be highlighted
          const isHighlighted = section.table?.highlightRows?.includes(dataRowIdx);
          if (isHighlighted) {
            highlightedDataRows.push(rowIdx);
          }
          
          // Format values
          const formattedRow = row.map((cell, colIdx) => {
            if (cell === null || cell === undefined) return '';
            if (typeof cell === 'number') {
              const header = section.table?.headers[colIdx] || '';
              if (isCurrencyHeader(header) || header.toLowerCase().includes('amount')) {
                return formatCurrencyDisplay(cell);
              }
              return cell.toLocaleString();
            }
            return cell;
          });
          
          rows.push(formattedRow);
          rowIdx++;
        });
        
        rows.push([]); // Spacer after table
        rowIdx++;
      }
    });

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // === COLUMN WIDTHS - Professional spacing ===
    const maxCols = Math.max(...rows.map(r => r?.length || 0));
    const colWidths: { wch: number }[] = [];
    
    for (let c = 0; c < maxCols; c++) {
      let maxLen = 10; // Minimum width
      rows.forEach(row => {
        if (row && row[c] !== null && row[c] !== undefined) {
          const len = String(row[c]).length;
          if (len > maxLen) maxLen = Math.min(len, 45);
        }
      });
      colWidths.push({ wch: maxLen + 3 }); // Add padding
    }
    ws['!cols'] = colWidths;
    
    // === ROW HEIGHTS for headers ===
    const rowHeights: { hpt?: number }[] = [];
    rows.forEach((_, idx) => {
      if (idx === 0) {
        rowHeights.push({ hpt: 22 }); // Main title
      } else if (sectionHeaderRows.includes(idx)) {
        rowHeights.push({ hpt: 20 }); // Section headers
      } else if (tableHeaderRows.includes(idx)) {
        rowHeights.push({ hpt: 18 }); // Table headers
      } else {
        rowHeights.push({ hpt: 16 }); // Data rows
      }
    });
    ws['!rows'] = rowHeights;

    // Add sheet and save
    XLSX.utils.book_append_sheet(wb, ws, 'Report');

    const filename = data.filename || 
      data.reportTitle.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_') + '_' + format(new Date(), 'yyyyMMdd_HHmm') + '.xlsx';
    
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const xlsxBlob = new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlob(xlsxBlob, filename);
    
    logDownload('boardroom_excel', data.reportTitle, 'xlsx', rows.length, { 
      sections: data.sections.length,
      style: 'boardroom'
    });
    
    return filename;
  };

  // ============================================================
  // FORMATTED CSV GENERATOR - Boardroom style with clear sections
  // Clean, professional CSV for manual Excel opening
  // ============================================================
  const generateBoardroomCSV = (data: BoardroomExcelData) => {
    const rows: string[][] = [];
    
    // === REPORT HEADER ===
    rows.push([data.reportTitle.toUpperCase()]);
    rows.push(['As of: ' + data.asOfDate]);
    rows.push([]);

    // === PROCESS EACH SECTION ===
    data.sections.forEach((section) => {
      // Section title
      if (section.title) {
        rows.push([section.title.toUpperCase()]);
      }
      
      // Key-value metrics
      if (section.metrics && section.metrics.length > 0) {
        rows.push(['Metric', 'Value']);
        
        section.metrics.forEach((metric) => {
          const formattedValue = typeof metric.value === 'number' 
            ? (isCurrencyHeader(metric.label) 
                ? formatCurrencyDisplay(metric.value)
                : metric.value.toLocaleString())
            : String(metric.value);
          rows.push([metric.label, formattedValue]);
        });
        rows.push([]);
      }
      
      // Data table
      if (section.table) {
        rows.push(section.table.headers);
        
        section.table.rows.forEach((row) => {
          const formattedRow = row.map((cell, colIdx) => {
            if (cell === null || cell === undefined) return '';
            if (typeof cell === 'number') {
              const header = section.table?.headers[colIdx] || '';
              if (isCurrencyHeader(header) || header.toLowerCase().includes('amount')) {
                return formatCurrencyDisplay(cell);
              }
              return cell.toLocaleString();
            }
            return String(cell);
          });
          rows.push(formattedRow);
        });
        
        rows.push([]);
      }
    });

    // Convert to CSV string with proper escaping
    const csvContent = rows.map(row => 
      row.map(cell => {
        const escaped = String(cell ?? '').replace(/"/g, '""');
        return escaped.includes(',') || escaped.includes('\n') || escaped.includes('"') 
          ? `"${escaped}"` 
          : escaped;
      }).join(',')
    ).join('\n');
    
    const filename = data.filename?.replace('.xlsx', '.csv') ||
      data.reportTitle.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_') + '_' + format(new Date(), 'yyyyMMdd_HHmm') + '.csv';
    
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(csvBlob, filename);
    
    logDownload('boardroom_csv', data.reportTitle, 'csv', rows.length, { 
      sections: data.sections.length,
      style: 'boardroom'
    });
    
    return filename;
  };

  // Format a single value for display in exports
  const formatExportValue = (value: number | string | null | undefined, header: string): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      if (isCurrencyHeader(header)) return formatCurrencyDisplay(value);
      if (isPercentHeader(header)) return formatPercentDisplay(value);
    }
    return String(value);
  };

  return {
    generatePDF,
    generateExcel,
    generateCSV,
    exportBoth,
    generateFullExcel,
    generateExecutivePDF,
    generateExecutivePackage,
    generateCSuiteBriefing,
    generateCSuiteExcel,
    generateBoardroomExcel,
    generateBoardroomCSV,
    formatExportValue,
  };
}
