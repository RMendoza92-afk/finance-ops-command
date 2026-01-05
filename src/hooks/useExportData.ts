import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

// Base64 encoded Loya logo (FLI logo)
const LOYA_LOGO_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCABkAGQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//2Q==';

export interface ManagerTracking {
  name: string;
  value: string | number;
  category: string;
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
}

export function useExportData() {
  const generatePDF = (data: ExportableData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Professional color palette
    const navy = { r: 12, g: 35, b: 64 };
    const red = { r: 180, g: 30, b: 30 };
    const gray = { r: 120, g: 120, b: 120 };
    const lightGray = { r: 245, g: 245, b: 245 };

    // ====== CLEAN HEADER ======
    // Logo placeholder box
    doc.setFillColor(navy.r, navy.g, navy.b);
    doc.rect(14, 12, 8, 8, 'F');
    
    // Company name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(navy.r, navy.g, navy.b);
    doc.text('FRED LOYA INSURANCE', 26, 18);
    
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

    // Main data sheet
    const wsData: (string | number)[][] = [
      [data.title],
      [data.subtitle || ''],
      [`Generated: ${data.timestamp}`],
      data.affectsManager ? [`Prepared For: ${data.affectsManager}`] : [],
      [],
    ];

    // Add directive if exists
    if (data.directive) {
      wsData.push(['DIRECTIVE']);
      wsData.push([data.directive]);
      wsData.push([]);
    }

    // Add manager tracking if exists
    if (data.managerTracking && data.managerTracking.length > 0) {
      const highEvalManagers = data.managerTracking.filter(m => m.category === 'high_eval');
      const noEvalTracking = data.managerTracking.filter(m => m.category === 'no_eval');

      if (highEvalManagers.length > 0) {
        wsData.push(['HIGH EVALUATION TOP 10 MANAGERS']);
        wsData.push(['Rank', 'Manager', 'High Eval Amount']);
        highEvalManagers.forEach((manager, idx) => {
          wsData.push([idx + 1, manager.name, String(manager.value)]);
        });
        wsData.push([]);
      }

      if (noEvalTracking.length > 0) {
        wsData.push(['NO EVALUATION TRACKING']);
        wsData.push(['Assigned To', 'Claims Count']);
        noEvalTracking.forEach((item) => {
          wsData.push([item.name, String(item.value)]);
        });
        wsData.push([]);
      }
    }

    // Add summary if exists
    if (data.summary && Object.keys(data.summary).length > 0) {
      wsData.push(['KEY METRICS']);
      wsData.push([]);
      Object.entries(data.summary).forEach(([key, value]) => {
        wsData.push([key, String(value)]);
      });
      wsData.push([]);
    }

    // Add table headers and rows
    wsData.push([]);
    wsData.push(['DETAILED DATA']);
    wsData.push(data.columns);
    data.rows.forEach(row => {
      wsData.push(row.map(cell => typeof cell === 'number' ? cell : String(cell)));
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    const colWidths = data.columns.map((col, i) => {
      const maxLen = Math.max(
        col.length,
        ...data.rows.map(row => String(row[i] || '').length)
      );
      return { wch: Math.min(maxLen + 2, 35) };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Report');

    // Download
    const filename = `${data.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    return filename;
  };

  const exportBoth = (data: ExportableData) => {
    const pdfFile = generatePDF(data);
    const xlsFile = generateExcel(data);
    return { pdfFile, xlsFile };
  };

  return { generatePDF, generateExcel, exportBoth };
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
