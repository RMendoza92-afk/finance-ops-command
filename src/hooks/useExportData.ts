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
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 28;

    // Professional color palette
    const navy = { r: 12, g: 35, b: 64 };
    const red = { r: 180, g: 30, b: 30 };
    const gray = { r: 120, g: 120, b: 120 };
    const lightGray = { r: 245, g: 245, b: 245 };

    // ====== HEADER WITH LOGO ======
    try {
      const logoBase64 = await loadImageAsBase64(loyaLogo);
      doc.addImage(logoBase64, 'JPEG', 14, 8, 50, 14);
    } catch (e) {
      // Fallback text if logo fails
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(navy.r, navy.g, navy.b);
      doc.text('FRED LOYA INSURANCE', 14, 18);
    }
    
    // Thin accent line
    doc.setDrawColor(red.r, red.g, red.b);
    doc.setLineWidth(1.5);
    doc.line(14, 24, pageWidth - 14, 24);

    yPos = 34;

    // ====== TITLE ======
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(navy.r, navy.g, navy.b);
    doc.text(data.title.toUpperCase(), 14, yPos);
    yPos += 8;

    if (data.subtitle) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(gray.r, gray.g, gray.b);
      doc.text(data.subtitle, 14, yPos);
      yPos += 6;
    }

    doc.setFontSize(8);
    doc.setTextColor(gray.r, gray.g, gray.b);
    doc.text(data.timestamp, 14, yPos);
    
    if (data.affectsManager) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(navy.r, navy.g, navy.b);
      doc.text(`Prepared for: ${data.affectsManager}`, pageWidth - 14, yPos, { align: 'right' });
    }
    yPos += 10;

    // ====== DIRECTIVE ======
    if (data.directive) {
      doc.setFillColor(lightGray.r, lightGray.g, lightGray.b);
      doc.rect(14, yPos, pageWidth - 28, 18, 'F');
      
      // Left accent bar
      doc.setFillColor(red.r, red.g, red.b);
      doc.rect(14, yPos, 3, 18, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(red.r, red.g, red.b);
      doc.text('DIRECTIVE', 20, yPos + 6);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(navy.r, navy.g, navy.b);
      const directiveLines = doc.splitTextToSize(data.directive, pageWidth - 40);
      doc.text(directiveLines.slice(0, 2), 20, yPos + 12);
      yPos += 24;
    }

    // ====== MANAGER TRACKING ======
    if (data.managerTracking && data.managerTracking.length > 0) {
      const highEvalManagers = data.managerTracking.filter(m => m.category === 'high_eval');
      const noEvalTracking = data.managerTracking.filter(m => m.category === 'no_eval');

      if (highEvalManagers.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(navy.r, navy.g, navy.b);
        doc.text('HIGH EVALUATION — TOP 10', 14, yPos);
        yPos += 6;

        // Table header
        doc.setFillColor(navy.r, navy.g, navy.b);
        doc.rect(14, yPos, pageWidth - 28, 6, 'F');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text('RANK', 18, yPos + 4);
        doc.text('ADJUSTER NAME', 34, yPos + 4);
        doc.text('HIGH EVAL TOTAL', pageWidth - 18, yPos + 4, { align: 'right' });
        yPos += 8;

        // Table rows
        highEvalManagers.forEach((manager, idx) => {
          if (idx % 2 === 0) {
            doc.setFillColor(lightGray.r, lightGray.g, lightGray.b);
            doc.rect(14, yPos - 3, pageWidth - 28, 6, 'F');
          }
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(gray.r, gray.g, gray.b);
          doc.text(String(idx + 1), 18, yPos);
          
          doc.setTextColor(navy.r, navy.g, navy.b);
          doc.text(manager.name, 34, yPos);
          
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(red.r, red.g, red.b);
          doc.text(String(manager.value), pageWidth - 18, yPos, { align: 'right' });
          yPos += 6;
        });
        yPos += 6;
      }

      if (noEvalTracking.length > 0) {
        doc.setDrawColor(gray.r, gray.g, gray.b);
        doc.setLineWidth(0.2);
        doc.line(14, yPos, pageWidth - 14, yPos);
        yPos += 6;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(red.r, red.g, red.b);
        doc.text('NO EVALUATION ASSIGNED', 14, yPos);
        yPos += 5;

        noEvalTracking.forEach((item) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(navy.r, navy.g, navy.b);
          doc.text(`${item.name}: ${item.value} claims pending evaluation`, 14, yPos);
          yPos += 5;
        });
        yPos += 4;
      }
    }

    // Summary section with cards
    if (data.summary && Object.keys(data.summary).length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(navy.r, navy.g, navy.b);
      doc.text('KEY METRICS', 14, yPos);
      yPos += 8;

      const entries = Object.entries(data.summary);
      const cardWidth = (pageWidth - 28 - (entries.length - 1) * 4) / Math.min(entries.length, 4);
      
      entries.forEach(([key, value], index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);
        const xPos = 14 + col * (cardWidth + 4);
        const cardY = yPos + row * 28;

        doc.setFillColor(lightGray.r, lightGray.g, lightGray.b);
        doc.rect(xPos, cardY, cardWidth, 24, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(navy.r, navy.g, navy.b);
        doc.text(String(value), xPos + cardWidth / 2, cardY + 10, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(gray.r, gray.g, gray.b);
        const truncatedKey = key.length > 18 ? key.substring(0, 16) + '...' : key;
        doc.text(truncatedKey, xPos + cardWidth / 2, cardY + 18, { align: 'center' });
      });

      yPos += Math.ceil(entries.length / 4) * 28 + 12;
    }

    // Data Table Section
    if (data.columns.length > 0 && data.rows.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(navy.r, navy.g, navy.b);
      doc.text('DETAILED DATA', 14, yPos);
      yPos += 8;

      const tableWidth = pageWidth - 28;
      const colCount = data.columns.length;
      const colWidth = tableWidth / colCount;
      const rowHeight = 9;

      // Table header
      doc.setFillColor(navy.r, navy.g, navy.b);
      doc.rect(14, yPos, tableWidth, rowHeight, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      
      data.columns.forEach((col, i) => {
        const xPos = 14 + i * colWidth + 3;
        const truncated = col.length > 15 ? col.substring(0, 13) + '...' : col;
        doc.text(truncated, xPos, yPos + 6);
      });
      yPos += rowHeight;

      // Table rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      data.rows.forEach((row, rowIdx) => {
        if (yPos > 265) {
          doc.addPage();
          yPos = 25;
          
          doc.setFillColor(navy.r, navy.g, navy.b);
          doc.rect(14, yPos, tableWidth, rowHeight, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          data.columns.forEach((col, i) => {
            const xPos = 14 + i * colWidth + 3;
            const truncated = col.length > 15 ? col.substring(0, 13) + '...' : col;
            doc.text(truncated, xPos, yPos + 6);
          });
          yPos += rowHeight;
          doc.setFont('helvetica', 'normal');
        }

        if (rowIdx % 2 === 0) {
          doc.setFillColor(lightGray.r, lightGray.g, lightGray.b);
          doc.rect(14, yPos, tableWidth, rowHeight, 'F');
        }

        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.line(14, yPos + rowHeight, pageWidth - 14, yPos + rowHeight);

        doc.setTextColor(navy.r, navy.g, navy.b);
        row.forEach((cell, i) => {
          const xPos = 14 + i * colWidth + 3;
          const cellText = String(cell);
          const maxChars = Math.floor((colWidth - 6) / 2);
          const truncated = cellText.length > maxChars ? cellText.substring(0, maxChars - 2) + '...' : cellText;
          doc.text(truncated, xPos, yPos + 6);
        });
        yPos += rowHeight;
      });
    }

    // Footer
    const footerY = 285;
    doc.setDrawColor(navy.r, navy.g, navy.b);
    doc.setLineWidth(0.3);
    doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);
    
    doc.setFontSize(7);
    doc.setTextColor(gray.r, gray.g, gray.b);
    doc.text('Fred Loya Insurance • Litigation Command Center • Confidential', 14, footerY);
    doc.text(`Page 1 of ${doc.getNumberOfPages()}`, pageWidth - 14, footerY, { align: 'right' });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(gray.r, gray.g, gray.b);
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
