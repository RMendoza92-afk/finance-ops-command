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

export interface ExportableData {
  title: string;
  subtitle?: string;
  timestamp: string;
  affectsManager?: string;
  directive?: string;
  managerTracking?: ManagerTracking[];
  summary?: Record<string, string | number>;
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

export function useExportData() {
  const generatePDF = async (data: ExportableData) => {
    // Use LANDSCAPE orientation for more table space
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 28;

    // EXECUTIVE THEME - Black, Light Grey, White, Red, Green
    const darkBg = { r: 0, g: 0, b: 0 };           // Pure Black
    const darkCard = { r: 18, g: 18, b: 18 };      // Near Black
    const darkBorder = { r: 38, g: 38, b: 38 };    // Dark Grey
    const accentRed = { r: 220, g: 38, b: 38 };    // Red 600
    const accentGreen = { r: 34, g: 197, b: 94 };  // Green 500
    const textWhite = { r: 255, g: 255, b: 255 };  // Pure White
    const textMuted = { r: 163, g: 163, b: 163 };  // Light Grey (Neutral 400)
    const textLight = { r: 212, g: 212, b: 212 };  // Lighter Grey (Neutral 300)

    // Fill entire page with dark background
    doc.setFillColor(darkBg.r, darkBg.g, darkBg.b);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // ====== HEADER WITH LOGO ======
    try {
      const logoBase64 = await loadImageAsBase64(loyaLogo);
      doc.addImage(logoBase64, 'JPEG', 14, 8, 50, 14);
    } catch (e) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text('FRED LOYA INSURANCE', 14, 18);
    }
    
    // Accent line - red
    doc.setDrawColor(accentRed.r, accentRed.g, accentRed.b);
    doc.setLineWidth(2);
    doc.line(14, 24, pageWidth - 14, 24);

    yPos = 34;

    // ====== TITLE ======
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
    doc.text(data.title.toUpperCase(), 14, yPos);
    yPos += 8;

    if (data.subtitle) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textLight.r, textLight.g, textLight.b);
      doc.text(data.subtitle, 14, yPos);
      yPos += 6;
    }

    doc.setFontSize(9);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(data.timestamp, 14, yPos);
    
    if (data.affectsManager) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text(`Prepared for: ${data.affectsManager}`, pageWidth - 14, yPos, { align: 'right' });
    }
    yPos += 12;

    // ====== DIRECTIVE ======
    if (data.directive) {
      doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
      doc.rect(14, yPos, pageWidth - 28, 20, 'F');
      
      // Left accent bar - red
      doc.setFillColor(accentRed.r, accentRed.g, accentRed.b);
      doc.rect(14, yPos, 4, 20, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(accentRed.r, accentRed.g, accentRed.b);
      doc.text('DIRECTIVE', 22, yPos + 7);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      const directiveLines = doc.splitTextToSize(data.directive, pageWidth - 50);
      doc.text(directiveLines.slice(0, 2), 22, yPos + 14);
      yPos += 26;
    }

    // ====== MANAGER TRACKING ======
    if (data.managerTracking && data.managerTracking.length > 0) {
      const highEvalManagers = data.managerTracking.filter(m => m.category === 'high_eval');
      const noEvalTracking = data.managerTracking.filter(m => m.category === 'no_eval');

      if (highEvalManagers.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(accentRed.r, accentRed.g, accentRed.b);
        doc.text('HIGH EVALUATION — TOP 10', 14, yPos);
        yPos += 8;

        // Table header
        doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
        doc.rect(14, yPos, pageWidth - 28, 8, 'F');
        doc.setFontSize(8);
        doc.setTextColor(textLight.r, textLight.g, textLight.b);
        doc.text('RANK', 20, yPos + 5.5);
        doc.text('ADJUSTER NAME', 45, yPos + 5.5);
        doc.text('HIGH EVAL TOTAL', pageWidth - 20, yPos + 5.5, { align: 'right' });
        yPos += 10;

        // Table rows
        highEvalManagers.forEach((manager, idx) => {
          if (idx % 2 === 0) {
            doc.setFillColor(darkBorder.r, darkBorder.g, darkBorder.b);
            doc.rect(14, yPos - 4, pageWidth - 28, 7, 'F');
          }
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
          doc.text(String(idx + 1), 20, yPos);
          
          doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
          doc.text(manager.name, 45, yPos);
          
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(accentRed.r, accentRed.g, accentRed.b);
          doc.text(String(manager.value), pageWidth - 20, yPos, { align: 'right' });
          yPos += 7;
        });
        yPos += 8;
      }

      if (noEvalTracking.length > 0) {
        doc.setDrawColor(darkBorder.r, darkBorder.g, darkBorder.b);
        doc.setLineWidth(0.3);
        doc.line(14, yPos, pageWidth - 14, yPos);
        yPos += 8;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(accentRed.r, accentRed.g, accentRed.b);
        doc.text('NO EVALUATION ASSIGNED', 14, yPos);
        yPos += 6;

        noEvalTracking.forEach((item) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
          doc.text(`${item.name}: ${item.value} claims pending evaluation`, 14, yPos);
          yPos += 6;
        });
        yPos += 6;
      }
    }

    // Summary section with metric cards
    if (data.summary && Object.keys(data.summary).length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text('KEY METRICS', 14, yPos);
      yPos += 10;

      const entries = Object.entries(data.summary);
      const maxCols = Math.min(entries.length, 5);
      const cardWidth = (pageWidth - 28 - (maxCols - 1) * 6) / maxCols;
      
      entries.forEach(([key, value], index) => {
        const col = index % maxCols;
        const row = Math.floor(index / maxCols);
        const xPos = 14 + col * (cardWidth + 6);
        const cardY = yPos + row * 30;

        // Dark card with subtle border
        doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
        doc.rect(xPos, cardY, cardWidth, 26, 'F');
        doc.setDrawColor(darkBorder.r, darkBorder.g, darkBorder.b);
        doc.setLineWidth(0.5);
        doc.rect(xPos, cardY, cardWidth, 26, 'S');

        // Value in green for money
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
        doc.text(String(value), xPos + cardWidth / 2, cardY + 12, { align: 'center' });

        // Label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        const truncatedKey = key.length > 22 ? key.substring(0, 20) + '...' : key;
        doc.text(truncatedKey, xPos + cardWidth / 2, cardY + 21, { align: 'center' });
      });

      yPos += Math.ceil(entries.length / maxCols) * 30 + 14;
    }

    // Data Table Section - OPTIMIZED FOR NO CUTOFF
    if (data.columns.length > 0 && data.rows.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text('DETAILED DATA', 14, yPos);
      yPos += 10;

      const tableWidth = pageWidth - 28;
      const colCount = data.columns.length;
      
      // Dynamic column widths based on content
      const colWidths: number[] = data.columns.map((col, i) => {
        const headerLen = col.length;
        const maxDataLen = Math.max(...data.rows.slice(0, 50).map(row => String(row[i] || '').length));
        return Math.max(headerLen, maxDataLen);
      });
      const totalChars = colWidths.reduce((a, b) => a + b, 0);
      const calculatedWidths = colWidths.map(w => (w / totalChars) * tableWidth);
      
      // Ensure minimum width for readability
      const minColWidth = 25;
      const adjustedWidths = calculatedWidths.map(w => Math.max(w, minColWidth));
      const rowHeight = 10;

      // Table header
      doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
      doc.rect(14, yPos, tableWidth, rowHeight, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(textLight.r, textLight.g, textLight.b);
      
      let xOffset = 14;
      data.columns.forEach((col, i) => {
        const maxChars = Math.floor((adjustedWidths[i] - 4) / 2.2);
        const truncated = col.length > maxChars ? col.substring(0, maxChars - 1) + '…' : col;
        doc.text(truncated, xOffset + 3, yPos + 7);
        xOffset += adjustedWidths[i];
      });
      yPos += rowHeight;

      // Table rows with alternating colors
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      const maxY = pageHeight - 25;

      data.rows.forEach((row, rowIdx) => {
        if (yPos > maxY) {
          // Add new page with dark background
          doc.addPage();
          doc.setFillColor(darkBg.r, darkBg.g, darkBg.b);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          yPos = 20;
          
          // Repeat header
          doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
          doc.rect(14, yPos, tableWidth, rowHeight, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(textLight.r, textLight.g, textLight.b);
          
          let xOff = 14;
          data.columns.forEach((col, i) => {
            const maxChars = Math.floor((adjustedWidths[i] - 4) / 2.2);
            const truncated = col.length > maxChars ? col.substring(0, maxChars - 1) + '…' : col;
            doc.text(truncated, xOff + 3, yPos + 7);
            xOff += adjustedWidths[i];
          });
          yPos += rowHeight;
          doc.setFont('helvetica', 'normal');
        }

        // Alternating row colors
        if (rowIdx % 2 === 0) {
          doc.setFillColor(darkBorder.r, darkBorder.g, darkBorder.b);
          doc.rect(14, yPos, tableWidth, rowHeight, 'F');
        }

        // Subtle row separator
        doc.setDrawColor(darkBorder.r, darkBorder.g, darkBorder.b);
        doc.setLineWidth(0.2);
        doc.line(14, yPos + rowHeight, pageWidth - 14, yPos + rowHeight);

        // Row data with proper column alignment
        let xOff = 14;
        row.forEach((cell, i) => {
          const cellText = String(cell);
          const colW = adjustedWidths[i];
          const maxChars = Math.floor((colW - 4) / 2.2);
          const truncated = cellText.length > maxChars ? cellText.substring(0, maxChars - 1) + '…' : cellText;
          
          // Color coding for specific columns
          if (data.columns[i]?.toLowerCase().includes('level') && cellText.toUpperCase() === 'CRITICAL') {
            doc.setTextColor(accentRed.r, accentRed.g, accentRed.b);
          } else if (data.columns[i]?.toLowerCase().includes('exposure') || data.columns[i]?.toLowerCase().includes('$')) {
            doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
          } else {
            doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
          }
          
          doc.text(truncated, xOff + 3, yPos + 7);
          xOff += colW;
        });
        yPos += rowHeight;
      });
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      const footerY = pageHeight - 8;
      
      // Dark footer bar
      doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
      doc.rect(0, footerY - 6, pageWidth, 14, 'F');
      
      doc.setDrawColor(accentRed.r, accentRed.g, accentRed.b);
      doc.setLineWidth(0.5);
      doc.line(14, footerY - 6, pageWidth - 14, footerY - 6);
      
      doc.setFontSize(8);
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text('Fred Loya Insurance • Litigation Command Center • Confidential', 14, footerY);
      doc.setTextColor(textLight.r, textLight.g, textLight.b);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, footerY, { align: 'right' });
    }

    // Download
    const filename = `${data.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
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

  // Generate Executive Command Center PDF
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
  }) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const timestamp = format(new Date(), 'MMMM d, yyyy h:mm a');
    
    // Colors
    const darkBg = { r: 15, g: 23, b: 42 };        // slate-900
    const cardBg = { r: 30, g: 41, b: 59 };        // slate-800
    const textWhite = { r: 255, g: 255, b: 255 };
    const textMuted = { r: 148, g: 163, b: 184 };  // slate-400
    const accentAmber = { r: 251, g: 191, b: 36 }; // amber-400
    const accentRed = { r: 248, g: 113, b: 113 };  // red-400
    const accentGreen = { r: 52, g: 211, b: 153 }; // emerald-400
    const accentBlue = { r: 96, g: 165, b: 250 };  // blue-400
    
    const formatCurrency = (val: number) => {
      if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
      return `$${val.toFixed(0)}`;
    };

    // Background
    doc.setFillColor(darkBg.r, darkBg.g, darkBg.b);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Header
    let yPos = 20;
    try {
      const logoBase64 = await loadImageAsBase64(loyaLogo);
      doc.addImage(logoBase64, 'JPEG', 14, 10, 45, 12);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text('FRED LOYA INSURANCE', 14, 18);
    }

    // Title
    yPos = 32;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
    doc.text('EXECUTIVE COMMAND CENTER', 14, yPos);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(`Real-time portfolio health • ${timestamp}`, 14, yPos + 6);

    // Live badge
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(pageWidth - 50, yPos - 10, 36, 10, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('● LIVE DATA', pageWidth - 48, yPos - 4);

    yPos = 50;

    // === MAIN METRICS CARDS (4 columns) ===
    const cardWidth = (pageWidth - 70) / 4;
    const cardHeight = 50;
    const cardY = yPos;

    // Card 1: Open Reserves
    doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
    doc.roundedRect(14, cardY, cardWidth, cardHeight, 4, 4, 'F');
    doc.setFontSize(8);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('OPEN RESERVES', 20, cardY + 12);
    
    // MoM indicator
    const momColor = metrics.reservesMoM > 0 ? accentRed : accentGreen;
    doc.setTextColor(momColor.r, momColor.g, momColor.b);
    doc.setFontSize(7);
    doc.text(`${metrics.reservesMoM > 0 ? '↑' : '↓'}${Math.abs(metrics.reservesMoM)}% MoM`, 14 + cardWidth - 30, cardY + 12);
    
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
    doc.text(formatCurrency(metrics.totalOpenReserves), 20, cardY + 30);
    
    const yoyColor = metrics.reservesYoY < 0 ? accentGreen : accentRed;
    doc.setFontSize(9);
    doc.setTextColor(yoyColor.r, yoyColor.g, yoyColor.b);
    doc.text(`${metrics.reservesYoY > 0 ? '+' : ''}${metrics.reservesYoY}% YoY`, 20, cardY + 42);

    // Card 2: Pending Eval (Alert Style)
    const card2X = 14 + cardWidth + 14;
    doc.setFillColor(120, 53, 15);  // amber-900
    doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 4, 4, 'F');
    doc.setDrawColor(accentAmber.r, accentAmber.g, accentAmber.b);
    doc.setLineWidth(1.5);
    doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 4, 4, 'S');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentAmber.r, accentAmber.g, accentAmber.b);
    doc.text('⚠ PENDING EVAL', card2X + 6, cardY + 12);
    
    doc.setFontSize(22);
    doc.text(formatCurrency(metrics.pendingEval), card2X + 6, cardY + 30);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${metrics.pendingEvalPct.toFixed(0)}% of reserves without evaluation`, card2X + 6, cardY + 40);

    // Card 3: Closures This Month
    const card3X = card2X + cardWidth + 14;
    doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
    doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 4, 4, 'F');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('CLOSURES THIS MONTH', card3X + 6, cardY + 12);
    
    doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
    doc.setFontSize(7);
    doc.text(`↑ +${metrics.closureTrend}%`, card3X + cardWidth - 25, cardY + 12);
    
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
    doc.text(metrics.closuresThisMonth.toLocaleString(), card3X + 6, cardY + 30);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(`Avg: ${metrics.avgDaysToClose} days`, card3X + 6, cardY + 40);
    doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
    doc.text('↓8d faster', card3X + 45, cardY + 40);

    // Card 4: Aged 365+ (Alert Style)
    const card4X = card3X + cardWidth + 14;
    doc.setFillColor(127, 29, 29);  // red-900
    doc.roundedRect(card4X, cardY, cardWidth, cardHeight, 4, 4, 'F');
    doc.setDrawColor(accentRed.r, accentRed.g, accentRed.b);
    doc.setLineWidth(1.5);
    doc.roundedRect(card4X, cardY, cardWidth, cardHeight, 4, 4, 'S');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentRed.r, accentRed.g, accentRed.b);
    doc.text('🚨 AGED 365+ DAYS', card4X + 6, cardY + 12);
    
    doc.setFontSize(22);
    doc.text(metrics.aged365Count.toLocaleString(), card4X + 6, cardY + 30);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${metrics.aged365Pct}% of inventory • ${formatCurrency(metrics.aged365Reserves)}`, card4X + 6, cardY + 40);
    
    // Progress bar for aged
    doc.setFillColor(50, 20, 20);
    doc.roundedRect(card4X + 6, cardY + 44, cardWidth - 12, 3, 1, 1, 'F');
    doc.setFillColor(accentRed.r, accentRed.g, accentRed.b);
    doc.roundedRect(card4X + 6, cardY + 44, (cardWidth - 12) * (metrics.aged365Pct / 100), 3, 1, 1, 'F');

    // === EVALUATION SUMMARY ROW ===
    yPos = cardY + cardHeight + 16;
    const evalRowWidth = pageWidth - 28;
    const evalCardWidth = evalRowWidth / 3;
    
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(14, yPos, evalRowWidth, 40, 4, 4, 'F');

    // Low Eval
    doc.setFillColor(37, 99, 235, 0.2);
    doc.circle(34, yPos + 20, 10, 'F');
    doc.setFontSize(14);
    doc.setTextColor(accentBlue.r, accentBlue.g, accentBlue.b);
    doc.text('$', 31, yPos + 24);
    
    doc.setFontSize(8);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('LOW EVAL', 50, yPos + 16);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentBlue.r, accentBlue.g, accentBlue.b);
    doc.text(formatCurrency(metrics.lowEval), 50, yPos + 28);

    // Median Eval
    const medX = 14 + evalCardWidth;
    doc.setFillColor(16, 185, 129, 0.2);
    doc.circle(medX + 20, yPos + 20, 10, 'F');
    doc.setFontSize(12);
    doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
    doc.text('◎', medX + 16, yPos + 23);
    
    doc.setFontSize(8);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('MEDIAN EVAL', medX + 36, yPos + 16);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
    doc.text(formatCurrency(metrics.medianEval), medX + 36, yPos + 28);

    // High Eval
    const highX = 14 + evalCardWidth * 2;
    doc.setFillColor(245, 158, 11, 0.2);
    doc.circle(highX + 20, yPos + 20, 10, 'F');
    doc.setFontSize(12);
    doc.setTextColor(accentAmber.r, accentAmber.g, accentAmber.b);
    doc.text('↗', highX + 16, yPos + 23);
    
    doc.setFontSize(8);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('HIGH EVAL', highX + 36, yPos + 16);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentAmber.r, accentAmber.g, accentAmber.b);
    doc.text(formatCurrency(metrics.highEval), highX + 36, yPos + 28);

    // Footer
    yPos = pageHeight - 12;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('FLI Litigation Command Center • Executive Summary', 14, yPos);
    doc.text(`Generated: ${timestamp}`, pageWidth - 70, yPos);

    // Download
    const filename = `Executive_Command_Center_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    doc.save(filename);
    return filename;
  };

  return { generatePDF, generateExcel, exportBoth, generateFullExcel, generateExecutivePDF };
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
