import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import loyaLogo from '@/assets/fli_logo.jpg';

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
  // ============================================================
  const generatePDF = async (data: ExportableData) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = { l: 12, r: 12, t: 12, b: 12 };
    const contentW = pw - m.l - m.r;
    let y = m.t;

    // Colors - Executive dark theme
    const C = {
      bg: [18, 18, 22] as [number, number, number],
      card: [28, 28, 35] as [number, number, number],
      header: [38, 38, 48] as [number, number, number],
      border: [55, 55, 65] as [number, number, number],
      white: [255, 255, 255] as [number, number, number],
      offWhite: [235, 235, 240] as [number, number, number],
      muted: [140, 140, 155] as [number, number, number],
      red: [220, 60, 60] as [number, number, number],
      green: [45, 180, 90] as [number, number, number],
      amber: [235, 170, 45] as [number, number, number],
      gold: [212, 175, 55] as [number, number, number],
    };

    // Fill background
    doc.setFillColor(...C.bg);
    doc.rect(0, 0, pw, ph, 'F');

    // === HEADER BAR ===
    doc.setFillColor(...C.header);
    doc.rect(0, 0, pw, 22, 'F');

    // Gold accent line
    doc.setFillColor(...C.gold);
    doc.rect(0, 22, pw, 1.5, 'F');

    // Logo
    try {
      const logoBase64 = await loadImageAsBase64(loyaLogo);
      doc.addImage(logoBase64, 'JPEG', m.l, 4, 42, 12);
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

    y = 30;

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
        doc.setFillColor(...C.card);
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
      doc.setFillColor(...C.header);
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
          doc.setFillColor(...C.header);
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
          doc.setFillColor(...C.card);
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

        doc.setFillColor(...C.header);
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
            doc.setFillColor(...C.card);
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
      
      doc.setFillColor(...C.header);
      doc.rect(0, ph - 10, pw, 10, 'F');
      doc.setFillColor(...C.gold);
      doc.rect(0, ph - 10, pw, 0.5, 'F');

      doc.setFontSize(6);
      doc.setTextColor(...C.muted);
      doc.text('CONFIDENTIAL - EXECUTIVE USE ONLY', m.l, ph - 4);
      doc.text('Fred Loya Insurance | Litigation Command Center', pw / 2, ph - 4, { align: 'center' });
      doc.text('Page ' + i + ' of ' + totalPages, pw - m.r, ph - 4, { align: 'right' });
    }

    // Save
    const filename = sanitize(data.title).replace(/[^a-zA-Z0-9]/g, '_') + '_' + format(new Date(), 'yyyyMMdd_HHmm') + '.pdf';
    doc.save(filename);
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
        summaryRows.push([k, String(v)]);
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
      summaryRows.push(['DATA SUMMARY']);
      summaryRows.push(data.columns);
      data.rows.forEach(row => {
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
          adjRows.push([idx + 1, adj.name, String(adj.value)]);
        });

        if (noEval.length > 0) {
          adjRows.push([]);
          adjRows.push(['NO EVALUATION ASSIGNED']);
          adjRows.push(['Assigned To', 'Claims Count']);
          noEval.forEach(item => {
            adjRows.push([item.name, String(item.value)]);
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
        const sheetName = (rawData.sheetName || 'Claims Data ' + (idx + 1)).substring(0, 31);
        const rawRows: (string | number)[][] = [rawData.columns];
        rawData.rows.forEach(row => {
          rawRows.push(row.map(c => typeof c === 'number' ? c : String(c)));
        });

        const rawSheet = XLSX.utils.aoa_to_sheet(rawRows);
        const colWidths = rawData.columns.map((col, i) => {
          const maxLen = Math.max(col.length, ...rawData.rows.slice(0, 100).map(r => String(r[i] || '').length));
          return { wch: Math.min(maxLen + 2, 50) };
        });
        rawSheet['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, rawSheet, sheetName);
      });
    }

    const filename = data.title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_') + '_' + format(new Date(), 'yyyyMMdd_HHmm') + '.xlsx';
    XLSX.writeFile(wb, filename);
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
        rows.push(['DATA']);
        rows.push(data.columns);
        data.rows.forEach(row => {
          rows.push(row.map(c => typeof c === 'number' ? c : String(c)));
        });
      }

      const sheet = XLSX.utils.aoa_to_sheet(rows);
      const safeSheetName = (String(sectionIdx + 1) + '. ' + section.title).substring(0, 31);
      XLSX.utils.book_append_sheet(wb, sheet, safeSheetName);

      // Raw data sheets
      if (data.rawClaimData && data.rawClaimData.length > 0) {
        data.rawClaimData.forEach((rawData, rawIdx) => {
          const rawRows: (string | number)[][] = [rawData.columns];
          rawData.rows.forEach(row => {
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

    // MANAGER ACCOUNTABILITY - Files & Money - Compact rows
    if (breakdowns.highEvalAdjusters.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.gold);
      doc.text('MANAGER ACCOUNTABILITY - FILES & MONEY ON HAND', m.l, y);
      y += 4;

      // Full width table for manager data
      const adjColW = [cw * 0.05, cw * 0.30, cw * 0.20, cw * 0.22, cw * 0.23];
      
      doc.setFillColor(...C.header);
      doc.rect(m.l, y, cw, 5, 'F');
      doc.setFontSize(6);
      doc.setTextColor(...C.muted);
      doc.text('RANK', m.l + 3, y + 3.5);
      doc.text('MANAGER NAME', m.l + adjColW[0] + 3, y + 3.5);
      doc.text('OPEN FILES', m.l + adjColW[0] + adjColW[1] + 3, y + 3.5);
      doc.text('TOTAL RESERVES', m.l + adjColW[0] + adjColW[1] + adjColW[2] + 3, y + 3.5);
      doc.text('HIGH EVAL EXPOSURE', m.l + adjColW[0] + adjColW[1] + adjColW[2] + adjColW[3] + 3, y + 3.5);
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
        doc.text(sanitize(adj.name).substring(0, 28), m.l + adjColW[0] + 3, y + 3);
        
        // Open files
        doc.setTextColor(...C.white);
        const fileCount = adj.files ? String(adj.files) : '-';
        doc.text(fileCount, m.l + adjColW[0] + adjColW[1] + 3, y + 3);
        
        // Total reserves
        doc.setTextColor(...C.amber);
        const reserves = adj.reserves ? adj.reserves : '-';
        doc.text(reserves, m.l + adjColW[0] + adjColW[1] + adjColW[2] + 3, y + 3);
        
        // High eval exposure
        doc.setTextColor(...C.green);
        doc.text(adj.value, m.l + adjColW[0] + adjColW[1] + adjColW[2] + adjColW[3] + 3, y + 3);
        
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

  return {
    generatePDF,
    generateExcel,
    exportBoth,
    generateFullExcel,
    generateExecutivePDF,
    generateExecutivePackage,
  };
}
