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
  width?: number; // percentage of page width (default 45 for side-by-side)
}

export interface ExportableData {
  title: string;
  subtitle?: string;
  timestamp: string;
  affectsManager?: string;
  directive?: string;
  managerTracking?: ManagerTracking[];
  summary?: Record<string, string | number>;
  // NEW: Dashboard-style visuals with bullet insights
  dashboardVisuals?: DashboardVisual[];
  bulletInsights?: string[];
  // NEW: Charts for visual representation
  charts?: PDFChart[];
  columns: string[];
  rows: (string | number)[][];
  // Raw underlying claim data for Excel export
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

// Sanitize text - remove special characters that cause PDF issues
const sanitizeText = (text: string): string => {
  if (!text) return '';
  return String(text)
    .replace(/[\u2018\u2019]/g, "'")  // Smart quotes to straight
    .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes
    .replace(/\u2026/g, '...')        // Ellipsis to dots
    .replace(/\u2013/g, '-')          // En dash
    .replace(/\u2014/g, '--')         // Em dash
    .replace(/\u00A0/g, ' ')          // Non-breaking space
    .replace(/[^\x20-\x7E\n]/g, '');  // Remove non-printable ASCII
};

// Format currency cleanly without special characters
const formatCurrencyClean = (value: number): string => {
  if (value >= 1000000) {
    return '$' + (value / 1000000).toFixed(1) + 'M';
  } else if (value >= 1000) {
    return '$' + Math.round(value / 1000).toLocaleString() + 'K';
  }
  return '$' + value.toLocaleString();
};

export function useExportData() {
  const generatePDF = async (data: ExportableData) => {
    // LANDSCAPE for better table display
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    // Clean color scheme - professional dark theme
    const colors = {
      bg: { r: 15, g: 15, b: 15 },
      cardBg: { r: 25, g: 25, b: 25 },
      headerBg: { r: 35, g: 35, b: 35 },
      border: { r: 60, g: 60, b: 60 },
      white: { r: 255, g: 255, b: 255 },
      gray: { r: 180, g: 180, b: 180 },
      lightGray: { r: 220, g: 220, b: 220 },
      red: { r: 220, g: 50, b: 50 },
      green: { r: 50, g: 180, b: 100 },
      amber: { r: 220, g: 160, b: 40 },
    };

    // Background
    doc.setFillColor(colors.bg.r, colors.bg.g, colors.bg.b);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // === HEADER ===
    try {
      const logoBase64 = await loadImageAsBase64(loyaLogo);
      doc.addImage(logoBase64, 'JPEG', margin, yPos - 5, 45, 12);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(colors.white.r, colors.white.g, colors.white.b);
      doc.text('FRED LOYA INSURANCE', margin, yPos + 5);
    }

    // Red accent line
    doc.setDrawColor(colors.red.r, colors.red.g, colors.red.b);
    doc.setLineWidth(1.5);
    doc.line(margin, yPos + 12, pageWidth - margin, yPos + 12);
    yPos += 22;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(colors.white.r, colors.white.g, colors.white.b);
    doc.text(sanitizeText(data.title.toUpperCase()), margin, yPos);
    yPos += 8;

    // Subtitle
    if (data.subtitle) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.lightGray.r, colors.lightGray.g, colors.lightGray.b);
      doc.text(sanitizeText(data.subtitle), margin, yPos);
      yPos += 5;
    }

    // Timestamp and manager
    doc.setFontSize(9);
    doc.setTextColor(colors.gray.r, colors.gray.g, colors.gray.b);
    doc.text(sanitizeText(data.timestamp), margin, yPos);
    if (data.affectsManager) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.white.r, colors.white.g, colors.white.b);
      doc.text('Prepared for: ' + sanitizeText(data.affectsManager), pageWidth - margin, yPos, { align: 'right' });
    }
    yPos += 10;

    // === DIRECTIVE (if present) ===
    if (data.directive) {
      doc.setFillColor(colors.cardBg.r, colors.cardBg.g, colors.cardBg.b);
      doc.rect(margin, yPos, pageWidth - 2 * margin, 16, 'F');
      doc.setFillColor(colors.red.r, colors.red.g, colors.red.b);
      doc.rect(margin, yPos, 3, 16, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(colors.red.r, colors.red.g, colors.red.b);
      doc.text('DIRECTIVE', margin + 8, yPos + 6);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(colors.white.r, colors.white.g, colors.white.b);
      const directiveLines = doc.splitTextToSize(sanitizeText(data.directive), pageWidth - 2 * margin - 16);
      doc.text(directiveLines.slice(0, 2), margin + 8, yPos + 12);
      yPos += 20;
    }

    // === KEY METRICS (Summary) ===
    if (data.summary && Object.keys(data.summary).length > 0) {
      const entries = Object.entries(data.summary);
      const cols = Math.min(entries.length, 5);
      const cardW = (pageWidth - 2 * margin - (cols - 1) * 6) / cols;
      const cardH = 28;

      entries.slice(0, 10).forEach(([key, value], idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = margin + col * (cardW + 6);
        const y = yPos + row * (cardH + 6);

        // Card background
        doc.setFillColor(colors.cardBg.r, colors.cardBg.g, colors.cardBg.b);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F');
        
        // Left accent
        doc.setFillColor(colors.green.r, colors.green.g, colors.green.b);
        doc.rect(x, y, 3, cardH, 'F');

        // Label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(colors.gray.r, colors.gray.g, colors.gray.b);
        const label = sanitizeText(key).substring(0, 20);
        doc.text(label, x + 8, y + 8);

        // Value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(colors.white.r, colors.white.g, colors.white.b);
        doc.text(sanitizeText(String(value)), x + 8, y + 20);
      });

      yPos += Math.ceil(entries.length / cols) * (cardH + 6) + 8;
    }

    // === BULLET INSIGHTS ===
    if (data.bulletInsights && data.bulletInsights.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(colors.amber.r, colors.amber.g, colors.amber.b);
      doc.text('KEY INSIGHTS', margin, yPos);
      yPos += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(colors.white.r, colors.white.g, colors.white.b);
      
      data.bulletInsights.slice(0, 6).forEach((insight, idx) => {
        const bulletText = (idx + 1) + '. ' + sanitizeText(insight).substring(0, 120);
        doc.text(bulletText, margin + 4, yPos);
        yPos += 6;
      });
      yPos += 6;
    }

    // === DATA TABLE ===
    if (data.columns.length > 0 && data.rows.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(colors.white.r, colors.white.g, colors.white.b);
      doc.text('DATA', margin, yPos);
      yPos += 8;

      const tableW = pageWidth - 2 * margin;
      const colCount = data.columns.length;
      const colW = tableW / colCount;
      const rowH = 8;

      // Header row
      doc.setFillColor(colors.headerBg.r, colors.headerBg.g, colors.headerBg.b);
      doc.rect(margin, yPos, tableW, rowH, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(colors.lightGray.r, colors.lightGray.g, colors.lightGray.b);
      
      data.columns.forEach((col, i) => {
        const x = margin + i * colW + 3;
        const maxLen = Math.floor(colW / 2.5);
        const text = sanitizeText(col).substring(0, maxLen);
        doc.text(text, x, yPos + 5.5);
      });
      yPos += rowH;

      // Data rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      const maxY = pageHeight - 20;
      
      data.rows.forEach((row, rowIdx) => {
        // Page break check
        if (yPos > maxY) {
          doc.addPage();
          doc.setFillColor(colors.bg.r, colors.bg.g, colors.bg.b);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          yPos = margin;
          
          // Repeat header
          doc.setFillColor(colors.headerBg.r, colors.headerBg.g, colors.headerBg.b);
          doc.rect(margin, yPos, tableW, rowH, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(colors.lightGray.r, colors.lightGray.g, colors.lightGray.b);
          data.columns.forEach((col, i) => {
            const x = margin + i * colW + 3;
            const maxLen = Math.floor(colW / 2.5);
            doc.text(sanitizeText(col).substring(0, maxLen), x, yPos + 5.5);
          });
          yPos += rowH;
          doc.setFont('helvetica', 'normal');
        }

        // Alternating row colors
        if (rowIdx % 2 === 0) {
          doc.setFillColor(colors.cardBg.r, colors.cardBg.g, colors.cardBg.b);
          doc.rect(margin, yPos, tableW, rowH, 'F');
        }

        // Row data
        doc.setTextColor(colors.white.r, colors.white.g, colors.white.b);
        row.forEach((cell, i) => {
          const x = margin + i * colW + 3;
          const maxLen = Math.floor(colW / 2.5);
          const text = sanitizeText(String(cell)).substring(0, maxLen);
          doc.text(text, x, yPos + 5.5);
        });
        yPos += rowH;
      });
    }

    // === FOOTER on all pages ===
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      const footerY = pageHeight - 8;
      
      doc.setFillColor(colors.cardBg.r, colors.cardBg.g, colors.cardBg.b);
      doc.rect(0, footerY - 4, pageWidth, 12, 'F');
      
      doc.setDrawColor(colors.red.r, colors.red.g, colors.red.b);
      doc.setLineWidth(0.5);
      doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
      
      doc.setFontSize(7);
      doc.setTextColor(colors.gray.r, colors.gray.g, colors.gray.b);
      doc.text('Fred Loya Insurance - Litigation Command Center - Confidential', margin, footerY);
      doc.text('Page ' + i + ' of ' + totalPages, pageWidth - margin, footerY, { align: 'right' });
    }

    // Save
    const filename = sanitizeText(data.title).replace(/\s+/g, '_') + '_' + format(new Date(), 'yyyyMMdd_HHmm') + '.pdf';
    doc.save(filename);
    
    return filename;
  };

  const generateExcel = (data: ExportableData) => {
    const wb = XLSX.utils.book_new();

    // ====== SUMMARY SHEET ======
    const summaryData: (string | number)[][] = [
      [data.title],
      [data.subtitle || ''],
      [`Generated: ${data.timestamp}`],
      data.affectsManager ? [`Prepared For: ${data.affectsManager}`] : [],
      [],
    ];

    // Add directive if exists
    if (data.directive) {
      summaryData.push(['DIRECTIVE']);
      summaryData.push([data.directive]);
      summaryData.push([]);
    }

    // Add manager tracking if exists
    if (data.managerTracking && data.managerTracking.length > 0) {
      const highEvalManagers = data.managerTracking.filter(m => m.category === 'high_eval');
      const noEvalTracking = data.managerTracking.filter(m => m.category === 'no_eval');

      if (highEvalManagers.length > 0) {
        summaryData.push(['HIGH EVALUATION TOP 10 MANAGERS']);
        summaryData.push(['Rank', 'Manager', 'High Eval Amount']);
        highEvalManagers.forEach((manager, idx) => {
          summaryData.push([idx + 1, manager.name, String(manager.value)]);
        });
        summaryData.push([]);
      }

      if (noEvalTracking.length > 0) {
        summaryData.push(['NO EVALUATION TRACKING']);
        summaryData.push(['Assigned To', 'Claims Count']);
        noEvalTracking.forEach((item) => {
          summaryData.push([item.name, String(item.value)]);
        });
        summaryData.push([]);
      }
    }

    // Add summary if exists
    if (data.summary && Object.keys(data.summary).length > 0) {
      summaryData.push(['KEY METRICS']);
      summaryData.push([]);
      Object.entries(data.summary).forEach(([key, value]) => {
        summaryData.push([key, String(value)]);
      });
      summaryData.push([]);
    }

    // Add table headers and rows
    summaryData.push([]);
    summaryData.push(['REPORT DATA']);
    summaryData.push(data.columns);
    data.rows.forEach(row => {
      summaryData.push(row.map(cell => typeof cell === 'number' ? cell : String(cell)));
    });

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

    // Set column widths for summary
    const summaryColWidths = data.columns.map((col, i) => {
      const maxLen = Math.max(
        col.length,
        ...data.rows.map(row => String(row[i] || '').length)
      );
      return { wch: Math.min(maxLen + 2, 40) };
    });
    summarySheet['!cols'] = summaryColWidths;

    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // ====== RAW CLAIM DATA SHEETS ======
    if (data.rawClaimData && data.rawClaimData.length > 0) {
      data.rawClaimData.forEach((rawData, index) => {
        const sheetName = rawData.sheetName || `Claim Data ${index + 1}`;
        const rawRows: (string | number)[][] = [rawData.columns];
        
        rawData.rows.forEach(row => {
          rawRows.push(row.map(cell => typeof cell === 'number' ? cell : String(cell)));
        });

        const rawSheet = XLSX.utils.aoa_to_sheet(rawRows);

        // Set column widths
        const rawColWidths = rawData.columns.map((col, i) => {
          const maxLen = Math.max(
            col.length,
            ...rawData.rows.slice(0, 100).map(row => String(row[i] || '').length)
          );
          return { wch: Math.min(maxLen + 2, 50) };
        });
        rawSheet['!cols'] = rawColWidths;

        // Truncate sheet name to 31 chars (Excel limit)
        const safeSheetName = sheetName.substring(0, 31);
        XLSX.utils.book_append_sheet(wb, rawSheet, safeSheetName);
      });
    }

    // Download
    const filename = `${data.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    return filename;
  };

  const exportBoth = async (data: ExportableData) => {
    const pdfFile = await generatePDF(data);
    const xlsFile = generateExcel(data);
    return { pdfFile, xlsFile };
  };

  // Generate a comprehensive Excel workbook with multiple sections
  const generateFullExcel = (sections: { title: string; data: ExportableData }[]) => {
    const wb = XLSX.utils.book_new();

    sections.forEach((section, sectionIndex) => {
      const { title, data } = section;
      
      // ====== SECTION SUMMARY SHEET ======
      const summaryData: (string | number)[][] = [
        [data.title],
        [data.subtitle || ''],
        [`Generated: ${data.timestamp}`],
        data.affectsManager ? [`Prepared For: ${data.affectsManager}`] : [],
        [],
      ];

      // Add summary metrics
      if (data.summary && Object.keys(data.summary).length > 0) {
        summaryData.push(['KEY METRICS']);
        Object.entries(data.summary).forEach(([key, value]) => {
          summaryData.push([key, String(value)]);
        });
        summaryData.push([]);
      }

      // Add report data
      if (data.columns.length > 0 && data.rows.length > 0) {
        summaryData.push(['REPORT DATA']);
        summaryData.push(data.columns);
        data.rows.forEach(row => {
          summaryData.push(row.map(cell => typeof cell === 'number' ? cell : String(cell)));
        });
      }

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      const safeSheetName = `${sectionIndex + 1}. ${title}`.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, summarySheet, safeSheetName);

      // ====== RAW CLAIM DATA SHEETS FOR THIS SECTION ======
      if (data.rawClaimData && data.rawClaimData.length > 0) {
        data.rawClaimData.forEach((rawData, rawIndex) => {
          const rawRows: (string | number)[][] = [rawData.columns];
          rawData.rows.forEach(row => {
            rawRows.push(row.map(cell => typeof cell === 'number' ? cell : String(cell)));
          });

          const rawSheet = XLSX.utils.aoa_to_sheet(rawRows);
          
          // Set column widths
          const rawColWidths = rawData.columns.map((col, i) => {
            const maxLen = Math.max(
              col.length,
              ...rawData.rows.slice(0, 100).map(row => String(row[i] || '').length)
            );
            return { wch: Math.min(maxLen + 2, 50) };
          });
          rawSheet['!cols'] = rawColWidths;

          const rawSheetName = `${sectionIndex + 1}.${rawIndex + 1} ${rawData.sheetName || 'Data'}`.substring(0, 31);
          XLSX.utils.book_append_sheet(wb, rawSheet, rawSheetName);
        });
      }
    });

    // Download
    const filename = `Executive_Dashboard_Full_Export_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    return filename;
  };

  // Generate Executive Command Center PDF - Matching Dashboard Layout
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
    reservesMoM: number;
    reservesYoY: number;
    lowEval: number;
    medianEval: number;
    highEval: number;
  }, granularData?: {
    byAge: { age: string; claims: number; openReserves: number; lowEval: number; highEval: number }[];
    byQueue: { queue: string; openReserves: number; lowEval: number; highEval: number; noEvalCount: number }[];
    byTypeGroup: { typeGroup: string; reserves: number }[];
    highEvalAdjusters: { name: string; value: string }[];
    quarterlyData?: { quarter: string; paid: number; paidMonthly: number; approved: number; approvedMonthly: number; variance: number }[];
  }) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const timestamp = format(new Date(), 'MMMM d, yyyy h:mm a');
    
    // EXECUTIVE THEME - Matches dashboard exactly
    const darkBg = { r: 9, g: 9, b: 11 };             // Zinc-950
    const cardBg = { r: 24, g: 24, b: 27 };           // Zinc-900
    const darkBorder = { r: 39, g: 39, b: 42 };       // Zinc-800
    const textWhite = { r: 250, g: 250, b: 250 };     // Zinc-50
    const textMuted = { r: 161, g: 161, b: 170 };     // Zinc-400
    const textLight = { r: 212, g: 212, b: 216 };     // Zinc-300
    const accentRed = { r: 239, g: 68, b: 68 };       // Red-500
    const accentGreen = { r: 34, g: 197, b: 94 };     // Green-500
    const accentAmber = { r: 245, g: 158, b: 11 };    // Amber-500
    const accentYellow = { r: 250, g: 204, b: 21 };   // Yellow-400
    
    const formatCurrency = (val: number) => {
      if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
      return `$${val.toFixed(0)}`;
    };

    // === PAGE 1: Executive Summary ===
    doc.setFillColor(darkBg.r, darkBg.g, darkBg.b);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Header with logo
    let yPos = 12;
    try {
      const logoBase64 = await loadImageAsBase64(loyaLogo);
      doc.addImage(logoBase64, 'JPEG', 14, 8, 45, 13);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text('FRED LOYA INSURANCE', 14, 16);
    }

    // Title section - matching dashboard header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
    doc.text('Litigation Command Center', 65, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('2025 Portfolio', 65, 20);

    // Live badge
    doc.setFillColor(accentGreen.r, accentGreen.g, accentGreen.b);
    doc.roundedRect(pageWidth - 45, 10, 32, 10, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('● LIVE', pageWidth - 40, 16);

    yPos = 30;

    // === EXECUTIVE COMMAND CENTER HEADER ===
    doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
    doc.roundedRect(14, yPos, pageWidth - 28, 22, 3, 3, 'F');
    doc.setDrawColor(darkBorder.r, darkBorder.g, darkBorder.b);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, yPos, pageWidth - 28, 22, 3, 3, 'S');
    
    // Yellow accent bar
    doc.setFillColor(accentYellow.r, accentYellow.g, accentYellow.b);
    doc.rect(14, yPos, 4, 22, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
    doc.text('EXECUTIVE COMMAND CENTER', 24, yPos + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('Litigation Intelligence Dashboard', 24, yPos + 18);
    doc.text(timestamp, pageWidth - 80, yPos + 14);

    yPos += 28;

    // === EXPENSE BREAKDOWN BAR ===
    doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
    doc.roundedRect(14, yPos, pageWidth - 28, 45, 3, 3, 'F');
    
    // Title row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
    doc.text('2025 YTD BI Spend: $395M Total', 20, yPos + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('Litigation Expenses: $19M • Through November 2025', 20, yPos + 18);
    
    // Right side breakdown
    doc.setFontSize(8);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('$19M EXPENSE BREAKDOWN', pageWidth - 70, yPos + 8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
    doc.text('$5.68M Expert', pageWidth - 70, yPos + 16);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('vs', pageWidth - 45, yPos + 16);
    doc.setTextColor(accentRed.r, accentRed.g, accentRed.b);
    doc.text('$13.32M Waste', pageWidth - 38, yPos + 16);
    
    // Progress bar
    const barY = yPos + 26;
    const barWidth = pageWidth - 48;
    const expertPct = 30;
    
    doc.setFillColor(accentGreen.r, accentGreen.g, accentGreen.b);
    doc.roundedRect(20, barY, barWidth * (expertPct / 100), 8, 2, 2, 'F');
    doc.setFillColor(accentRed.r, accentRed.g, accentRed.b);
    doc.roundedRect(20 + barWidth * (expertPct / 100), barY, barWidth * ((100 - expertPct) / 100), 8, 2, 2, 'F');
    
    doc.setFontSize(7);
    doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
    doc.text('$5.68M', 20 + (barWidth * expertPct / 200), barY + 5.5);
    doc.text('$13.32M', 20 + barWidth * (expertPct / 100) + (barWidth * (100 - expertPct) / 200) - 8, barY + 5.5);
    
    // Labels
    doc.setFontSize(7);
    doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
    doc.text('30% Strategic', 20, barY + 16);
    doc.setTextColor(accentRed.r, accentRed.g, accentRed.b);
    doc.text('70% Reactive', pageWidth - 48, barY + 16);

    yPos += 50;

    // === KPI CARDS ROW ===
    const kpiWidth = (pageWidth - 70) / 5;
    const kpiHeight = 38;
    
    const kpis = [
      { label: 'TOTAL BI SPEND', value: '$395M', sub: 'All Bodily Injury YTD', color: textWhite },
      { label: 'LIT EXPENSES', value: '$19M', sub: 'Litigation portion', color: accentGreen },
      { label: 'EXPERT SPEND', value: '$5.68M', sub: '$516K avg/month', color: accentGreen },
      { label: 'REACTIVE WASTE', value: '$13.32M', sub: 'Pre-lit ATR + Lit fees', color: accentRed },
      { label: 'WASTE RATIO', value: '2.3x', sub: '$1 expert = $2.34 waste', color: accentYellow },
    ];
    
    kpis.forEach((kpi, i) => {
      const x = 14 + i * (kpiWidth + 14);
      doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
      doc.roundedRect(x, yPos, kpiWidth, kpiHeight, 3, 3, 'F');
      
      doc.setFontSize(7);
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text(kpi.label, x + 6, yPos + 10);
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(kpi.color.r, kpi.color.g, kpi.color.b);
      doc.text(kpi.value, x + 6, yPos + 24);
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text(kpi.sub, x + 6, yPos + 32);
    });

    yPos += kpiHeight + 10;

    // === QUARTERLY TABLE ===
    doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
    doc.roundedRect(14, yPos, pageWidth - 28, 58, 3, 3, 'F');
    
    // Yellow accent bar
    doc.setFillColor(accentYellow.r, accentYellow.g, accentYellow.b);
    doc.rect(14, yPos, 4, 58, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(accentYellow.r, accentYellow.g, accentYellow.b);
    doc.text('2025 LITIGATION EXPERT SPEND BY QUARTER', 24, yPos + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('YTD through November — Paid vs Approved', 24, yPos + 17);
    
    // Table header
    const tableY = yPos + 22;
    const cols = ['Quarter', 'Paid', 'Paid Monthly Avg', 'Approved', 'Approved Monthly Avg', 'Variance'];
    const colWidths = [40, 50, 50, 50, 50, 40];
    let colX = 24;
    
    doc.setFontSize(7);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    cols.forEach((col, i) => {
      doc.text(col, colX, tableY);
      colX += colWidths[i];
    });
    
    // Table data
    const quarterlyData = granularData?.quarterlyData || [
      { quarter: 'Q1 2025', paid: 1553080, paidMonthly: 517693, approved: 2141536, approvedMonthly: 713845, variance: -588456 },
      { quarter: 'Q2 2025', paid: 1727599, paidMonthly: 575866, approved: 1680352, approvedMonthly: 560117, variance: 47247 },
      { quarter: 'Q3 2025', paid: 1383717, paidMonthly: 461239, approved: 1449627, approvedMonthly: 483209, variance: -65910 },
      { quarter: 'Q4 2025', paid: 1016756, paidMonthly: 508378, approved: 909651, approvedMonthly: 454826, variance: 107105 },
    ];
    
    quarterlyData.forEach((row, i) => {
      const rowY = tableY + 8 + i * 8;
      colX = 24;
      
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text(row.quarter, colX, rowY);
      colX += colWidths[0];
      
      doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
      doc.text(`$${(row.paid / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, colX, rowY);
      colX += colWidths[1];
      
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text(`$${row.paidMonthly.toLocaleString()}`, colX, rowY);
      colX += colWidths[2];
      
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text(`$${row.approved.toLocaleString()}`, colX, rowY);
      colX += colWidths[3];
      
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text(`$${row.approvedMonthly.toLocaleString()}`, colX, rowY);
      colX += colWidths[4];
      
      const varColor = row.variance >= 0 ? accentGreen : accentRed;
      doc.setTextColor(varColor.r, varColor.g, varColor.b);
      doc.text(`${row.variance >= 0 ? '+' : ''}$${Math.abs(row.variance).toLocaleString()}`, colX, rowY);
    });

    // Footer
    const footerY = pageHeight - 8;
    doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
    doc.rect(0, footerY - 6, pageWidth, 14, 'F');
    doc.setDrawColor(accentRed.r, accentRed.g, accentRed.b);
    doc.setLineWidth(0.5);
    doc.line(14, footerY - 6, pageWidth - 14, footerY - 6);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('Fred Loya Insurance • Litigation Command Center • Confidential', 14, footerY);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.text('Page 1 of 2', pageWidth - 30, footerY);

    // === PAGE 2: Reserves & Evaluation Detail ===
    doc.addPage();
    doc.setFillColor(darkBg.r, darkBg.g, darkBg.b);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    yPos = 14;
    
    // Header continuation
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
    doc.text('RESERVES & EVALUATION DETAIL', 14, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(timestamp, pageWidth - 80, yPos);

    yPos = 26;

    // === RESERVES SUMMARY CARDS ===
    const resCardWidth = (pageWidth - 56) / 4;
    const resCardHeight = 36;
    
    const resCards = [
      { label: 'OPEN RESERVES', value: formatCurrency(metrics.totalOpenReserves), trend: `${metrics.reservesMoM > 0 ? '+' : ''}${metrics.reservesMoM}% MoM`, trendColor: metrics.reservesMoM > 0 ? accentRed : accentGreen },
      { label: 'PENDING EVAL', value: formatCurrency(metrics.pendingEval), trend: `${metrics.pendingEvalPct.toFixed(0)}% uneval`, trendColor: accentAmber },
      { label: 'AGED 365+ DAYS', value: metrics.aged365Count.toLocaleString(), trend: `${metrics.aged365Pct}% of inventory`, trendColor: accentRed },
      { label: 'CLOSURES/MONTH', value: metrics.closuresThisMonth.toLocaleString(), trend: `+${metrics.closureTrend}% trend`, trendColor: accentGreen },
    ];
    
    resCards.forEach((card, i) => {
      const x = 14 + i * (resCardWidth + 14);
      doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
      doc.roundedRect(x, yPos, resCardWidth, resCardHeight, 3, 3, 'F');
      
      doc.setFontSize(7);
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text(card.label, x + 6, yPos + 10);
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text(card.value, x + 6, yPos + 22);
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(card.trendColor.r, card.trendColor.g, card.trendColor.b);
      doc.text(card.trend, x + 6, yPos + 30);
    });

    yPos += resCardHeight + 10;

    // === EVALUATION BREAKDOWN ===
    const evalWidth = (pageWidth - 42) / 3;
    
    doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
    doc.roundedRect(14, yPos, pageWidth - 28, 32, 3, 3, 'F');
    
    const evalItems = [
      { label: 'LOW EVAL', value: formatCurrency(metrics.lowEval), color: accentGreen },
      { label: 'MEDIAN EVAL', value: formatCurrency(metrics.medianEval), color: textWhite },
      { label: 'HIGH EVAL', value: formatCurrency(metrics.highEval), color: accentRed },
    ];
    
    evalItems.forEach((item, i) => {
      const x = 24 + i * evalWidth;
      doc.setFillColor(item.color.r, item.color.g, item.color.b);
      doc.circle(x + 8, yPos + 16, 6, 'F');
      
      doc.setFontSize(8);
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text(item.label, x + 20, yPos + 12);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(item.color.r, item.color.g, item.color.b);
      doc.text(item.value, x + 20, yPos + 24);
    });

    yPos += 40;

    // === BY AGE TABLE ===
    if (granularData?.byAge) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text('RESERVES BY AGE', 14, yPos);
      yPos += 8;
      
      // Table header
      doc.setFillColor(darkBorder.r, darkBorder.g, darkBorder.b);
      doc.rect(14, yPos, pageWidth - 28, 8, 'F');
      doc.setFontSize(7);
      doc.setTextColor(textLight.r, textLight.g, textLight.b);
      const ageColWidths = [50, 30, 50, 40, 40, 40];
      let ageX = 18;
      ['Age Bucket', 'Claims', 'Open Reserves', 'Low Eval', 'High Eval', 'Gap'].forEach((h, i) => {
        doc.text(h, ageX, yPos + 5.5);
        ageX += ageColWidths[i];
      });
      yPos += 10;
      
      granularData.byAge.forEach((row, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(24, 24, 27);
          doc.rect(14, yPos - 1, pageWidth - 28, 7, 'F');
        }
        
        ageX = 18;
        doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
        doc.text(row.age, ageX, yPos + 4);
        ageX += ageColWidths[0];
        doc.text(row.claims.toLocaleString(), ageX, yPos + 4);
        ageX += ageColWidths[1];
        doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
        doc.text(formatCurrency(row.openReserves), ageX, yPos + 4);
        ageX += ageColWidths[2];
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.text(formatCurrency(row.lowEval), ageX, yPos + 4);
        ageX += ageColWidths[3];
        doc.text(formatCurrency(row.highEval), ageX, yPos + 4);
        ageX += ageColWidths[4];
        const gap = row.openReserves - row.highEval;
        doc.setTextColor(accentAmber.r, accentAmber.g, accentAmber.b);
        doc.text(formatCurrency(gap), ageX, yPos + 4);
        yPos += 7;
      });
    }

    yPos += 8;

    // === BY QUEUE TABLE ===
    if (granularData?.byQueue && yPos < pageHeight - 50) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text('RESERVES BY QUEUE', 14, yPos);
      yPos += 8;
      
      doc.setFillColor(darkBorder.r, darkBorder.g, darkBorder.b);
      doc.rect(14, yPos, pageWidth - 28, 8, 'F');
      doc.setFontSize(7);
      doc.setTextColor(textLight.r, textLight.g, textLight.b);
      const qColWidths = [40, 50, 40, 40, 35, 35];
      let qX = 18;
      ['Queue', 'Open Reserves', 'Low Eval', 'High Eval', 'No Eval #', '% Total'].forEach((h, i) => {
        doc.text(h, qX, yPos + 5.5);
        qX += qColWidths[i];
      });
      yPos += 10;
      
      const totalRes = granularData.byQueue.reduce((s, q) => s + q.openReserves, 0);
      granularData.byQueue.slice(0, 6).forEach((row, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(24, 24, 27);
          doc.rect(14, yPos - 1, pageWidth - 28, 7, 'F');
        }
        
        qX = 18;
        doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
        doc.text(row.queue, qX, yPos + 4);
        qX += qColWidths[0];
        doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
        doc.text(formatCurrency(row.openReserves), qX, yPos + 4);
        qX += qColWidths[1];
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.text(formatCurrency(row.lowEval), qX, yPos + 4);
        qX += qColWidths[2];
        doc.text(formatCurrency(row.highEval), qX, yPos + 4);
        qX += qColWidths[3];
        doc.setTextColor(accentAmber.r, accentAmber.g, accentAmber.b);
        doc.text(row.noEvalCount.toString(), qX, yPos + 4);
        qX += qColWidths[4];
        const pct = ((row.openReserves / totalRes) * 100).toFixed(1);
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.text(`${pct}%`, qX, yPos + 4);
        yPos += 7;
      });
    }

    // Footer page 2
    const footer2Y = pageHeight - 8;
    doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
    doc.rect(0, footer2Y - 6, pageWidth, 14, 'F');
    doc.setDrawColor(accentRed.r, accentRed.g, accentRed.b);
    doc.setLineWidth(0.5);
    doc.line(14, footer2Y - 6, pageWidth - 14, footer2Y - 6);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('Fred Loya Insurance • Litigation Command Center • Confidential', 14, footer2Y);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.text('Page 2 of 2', pageWidth - 30, footer2Y);

    const filename = `Executive_Command_Center_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    doc.save(filename);
    return filename;
  };

  // Generate Executive Package: PDF summary + Excel with granular data
  const generateExecutivePackage = async (metrics: {
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
  }, granularData: {
    byAge: { age: string; claims: number; openReserves: number; lowEval: number; highEval: number }[];
    byQueue: { queue: string; openReserves: number; lowEval: number; highEval: number; noEvalCount: number }[];
    byTypeGroup: { typeGroup: string; reserves: number }[];
    highEvalAdjusters: { name: string; value: string }[];
    quarterlyData?: { quarter: string; paid: number; paidMonthly: number; approved: number; approvedMonthly: number; variance: number }[];
  }) => {
    const timestamp = format(new Date(), 'MMMM d, yyyy h:mm a');
    const dateStamp = format(new Date(), 'yyyyMMdd_HHmm');
    
    // Generate Excel with granular data
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: Executive Summary
    const summaryData: (string | number)[][] = [
      ['EXECUTIVE COMMAND CENTER - SUMMARY'],
      [`Generated: ${timestamp}`],
      [],
      ['KEY PERFORMANCE INDICATORS'],
      [],
      ['Metric', 'Value', 'Trend'],
      ['Total Open Reserves', `$${(metrics.totalOpenReserves / 1000000).toFixed(1)}M`, `${metrics.reservesMoM > 0 ? '+' : ''}${metrics.reservesMoM}% MoM`],
      ['Pending Evaluation', `$${(metrics.pendingEval / 1000000).toFixed(1)}M`, `${metrics.pendingEvalPct.toFixed(0)}% of reserves`],
      ['Low Eval Total', `$${(metrics.lowEval / 1000000).toFixed(1)}M`, ''],
      ['Median Eval', `$${(metrics.medianEval / 1000000).toFixed(1)}M`, ''],
      ['High Eval Total', `$${(metrics.highEval / 1000000).toFixed(1)}M`, ''],
      [],
      ['CLOSURES'],
      ['Closures This Month', metrics.closuresThisMonth, `+${metrics.closureTrend}% trend`],
      ['Average Days to Close', metrics.avgDaysToClose, ''],
      [],
      ['AGING ALERTS'],
      ['Claims 365+ Days', metrics.aged365Count, `${metrics.aged365Pct}% of inventory`],
      ['Reserves 365+ Days', `$${(metrics.aged365Reserves / 1000000).toFixed(1)}M`, ''],
      [],
      ['YEAR OVER YEAR'],
      ['Reserves YoY', `${metrics.reservesYoY > 0 ? '+' : ''}${metrics.reservesYoY}%`, ''],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Executive Summary');
    
    // Sheet 2: Reserves by Age Bucket
    const ageData: (string | number)[][] = [
      ['RESERVES BY AGE BUCKET'],
      [`Generated: ${timestamp}`],
      [],
      ['Age Bucket', 'Claims', 'Open Reserves', 'Low Eval', 'High Eval', 'Gap (No Eval)'],
    ];
    granularData.byAge.forEach(row => {
      const gap = row.openReserves - row.highEval;
      ageData.push([row.age, row.claims, row.openReserves, row.lowEval, row.highEval, gap]);
    });
    // Totals row
    const ageTotals = granularData.byAge.reduce((acc, row) => ({
      claims: acc.claims + row.claims,
      reserves: acc.reserves + row.openReserves,
      low: acc.low + row.lowEval,
      high: acc.high + row.highEval,
    }), { claims: 0, reserves: 0, low: 0, high: 0 });
    ageData.push([]);
    ageData.push(['TOTAL', ageTotals.claims, ageTotals.reserves, ageTotals.low, ageTotals.high, ageTotals.reserves - ageTotals.high]);
    
    const ageSheet = XLSX.utils.aoa_to_sheet(ageData);
    ageSheet['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ageSheet, 'By Age Bucket');
    
    // Sheet 3: Reserves by Queue/Type
    const queueData: (string | number)[][] = [
      ['RESERVES BY QUEUE'],
      [`Generated: ${timestamp}`],
      [],
      ['Queue', 'Open Reserves', 'Low Eval', 'High Eval', 'No Eval Count', '% of Total'],
    ];
    const totalReserves = granularData.byQueue.reduce((sum, q) => sum + q.openReserves, 0);
    granularData.byQueue.forEach(row => {
      const pct = totalReserves > 0 ? ((row.openReserves / totalReserves) * 100).toFixed(1) + '%' : '0%';
      queueData.push([row.queue, row.openReserves, row.lowEval, row.highEval, row.noEvalCount, pct]);
    });
    const queueSheet = XLSX.utils.aoa_to_sheet(queueData);
    queueSheet['!cols'] = [{ wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, queueSheet, 'By Queue');
    
    // Sheet 4: Full Type Group Breakdown
    const typeData: (string | number)[][] = [
      ['RESERVES BY TYPE GROUP'],
      [`Generated: ${timestamp}`],
      [],
      ['Type Group', 'Reserves', '% of Total'],
    ];
    const typeTotal = granularData.byTypeGroup.reduce((sum, t) => sum + t.reserves, 0);
    granularData.byTypeGroup.forEach(row => {
      const pct = typeTotal > 0 ? ((row.reserves / typeTotal) * 100).toFixed(2) + '%' : '0%';
      typeData.push([row.typeGroup, row.reserves, pct]);
    });
    typeData.push([]);
    typeData.push(['TOTAL', typeTotal, '100%']);
    const typeSheet = XLSX.utils.aoa_to_sheet(typeData);
    typeSheet['!cols'] = [{ wch: 15 }, { wch: 18 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, typeSheet, 'By Type Group');
    
    // Sheet 5: High Eval Adjusters (Full List)
    const adjusterData: (string | number)[][] = [
      ['HIGH EVALUATION ADJUSTERS - COMPLETE LIST'],
      [`Generated: ${timestamp}`],
      [],
      ['Rank', 'Adjuster Name', 'High Eval Amount'],
    ];
    granularData.highEvalAdjusters.forEach((adj, idx) => {
      adjusterData.push([idx + 1, adj.name, adj.value]);
    });
    const adjusterSheet = XLSX.utils.aoa_to_sheet(adjusterData);
    adjusterSheet['!cols'] = [{ wch: 8 }, { wch: 35 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, adjusterSheet, 'High Eval Adjusters');
    
    // Save Excel
    const excelFilename = `Executive_Command_Center_Data_${dateStamp}.xlsx`;
    XLSX.writeFile(wb, excelFilename);
    
    // Generate PDF with granular data
    await generateExecutivePDF(metrics, granularData);
    
    return { pdf: `Executive_Command_Center_${dateStamp}.pdf`, excel: excelFilename };
  };

  return { generatePDF, generateExcel, exportBoth, generateFullExcel, generateExecutivePDF, generateExecutivePackage };
}

// Export type definitions for different dashboard sections
export type ExportSection = 
  | 'kpi-spend'
  | 'quarterly-expert'
  | 'cost-curve'
  | 'expert-vs-reactive'
  | 'executive-review'
  | 'claim-detail'
  | 'open-inventory'
  | 'litigation-discipline'
  | 'expert-matching';
