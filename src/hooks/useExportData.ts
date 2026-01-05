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

    // VIVID DARK THEME color palette - Executive Grade
    const darkBg = { r: 15, g: 23, b: 42 };        // Slate 900
    const darkCard = { r: 30, g: 41, b: 59 };      // Slate 800
    const darkBorder = { r: 51, g: 65, b: 85 };    // Slate 700
    const accentCyan = { r: 34, g: 211, b: 238 };  // Cyan 400
    const accentGold = { r: 251, g: 191, b: 36 };  // Amber 400
    const accentRed = { r: 248, g: 113, b: 113 };  // Red 400
    const accentGreen = { r: 74, g: 222, b: 128 }; // Green 400
    const textWhite = { r: 248, g: 250, b: 252 };  // Slate 50
    const textMuted = { r: 148, g: 163, b: 184 };  // Slate 400

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
    
    // Gradient-like accent line with cyan
    doc.setDrawColor(accentCyan.r, accentCyan.g, accentCyan.b);
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
      doc.setTextColor(accentCyan.r, accentCyan.g, accentCyan.b);
      doc.text(data.subtitle, 14, yPos);
      yPos += 6;
    }

    doc.setFontSize(9);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(data.timestamp, 14, yPos);
    
    if (data.affectsManager) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(accentGold.r, accentGold.g, accentGold.b);
      doc.text(`Prepared for: ${data.affectsManager}`, pageWidth - 14, yPos, { align: 'right' });
    }
    yPos += 12;

    // ====== DIRECTIVE ======
    if (data.directive) {
      doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
      doc.rect(14, yPos, pageWidth - 28, 20, 'F');
      
      // Left accent bar - vivid cyan
      doc.setFillColor(accentCyan.r, accentCyan.g, accentCyan.b);
      doc.rect(14, yPos, 4, 20, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(accentCyan.r, accentCyan.g, accentCyan.b);
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
        doc.setTextColor(accentGold.r, accentGold.g, accentGold.b);
        doc.text('HIGH EVALUATION — TOP 10', 14, yPos);
        yPos += 8;

        // Table header with gradient effect
        doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
        doc.rect(14, yPos, pageWidth - 28, 8, 'F');
        doc.setFontSize(8);
        doc.setTextColor(accentCyan.r, accentCyan.g, accentCyan.b);
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

    // Summary section with vivid metric cards
    if (data.summary && Object.keys(data.summary).length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(accentGold.r, accentGold.g, accentGold.b);
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

        // Vivid value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(accentCyan.r, accentCyan.g, accentCyan.b);
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
      doc.setTextColor(accentGold.r, accentGold.g, accentGold.b);
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

      // Table header - vivid styling
      doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
      doc.rect(14, yPos, tableWidth, rowHeight, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(accentCyan.r, accentCyan.g, accentCyan.b);
      
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
          doc.setTextColor(accentCyan.r, accentCyan.g, accentCyan.b);
          
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
      
      doc.setDrawColor(accentCyan.r, accentCyan.g, accentCyan.b);
      doc.setLineWidth(0.5);
      doc.line(14, footerY - 6, pageWidth - 14, footerY - 6);
      
      doc.setFontSize(8);
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text('Fred Loya Insurance • Litigation Command Center • Confidential', 14, footerY);
      doc.setTextColor(accentCyan.r, accentCyan.g, accentCyan.b);
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

  return { generatePDF, generateExcel, exportBoth, generateFullExcel };
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
