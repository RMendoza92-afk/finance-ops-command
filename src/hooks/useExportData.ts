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

    // Colors - Loya brand colors
    const primaryColor = { r: 0, g: 51, b: 102 }; // Navy blue
    const accentColor = { r: 204, g: 0, b: 0 }; // Loya Red
    const mutedColor = { r: 100, g: 116, b: 139 };
    const lightBg = { r: 248, g: 250, b: 252 };
    const borderColor = { r: 226, g: 232, b: 240 };

    // ====== HEADER WITH LOGO ======
    doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Add Loya logo
    try {
      doc.addImage(LOYA_LOGO_BASE64, 'JPEG', 10, 4, 20, 20);
    } catch (e) {
      // Fallback if logo fails
    }

    // Company name next to logo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('FRED LOYA INSURANCE', 34, 14);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Litigation Discipline Command Center', 34, 21);

    // Report badge
    doc.setFillColor(accentColor.r, accentColor.g, accentColor.b);
    doc.roundedRect(pageWidth - 52, 8, 42, 12, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('EXECUTIVE REPORT', pageWidth - 31, 16, { align: 'center' });

    yPos = 38;

    // ====== TITLE SECTION ======
    doc.setFillColor(lightBg.r, lightBg.g, lightBg.b);
    doc.roundedRect(10, yPos - 4, pageWidth - 20, 24, 3, 3, 'F');
    doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
    doc.setLineWidth(0.5);
    doc.roundedRect(10, yPos - 4, pageWidth - 20, 24, 3, 3, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.text(data.title, 16, yPos + 6);

    if (data.subtitle) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
      doc.text(data.subtitle, 16, yPos + 14);
    }

    // Timestamp right aligned
    doc.setFontSize(8);
    doc.text(`Generated: ${data.timestamp}`, pageWidth - 16, yPos + 6, { align: 'right' });

    if (data.affectsManager) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      doc.text(`Prepared For: ${data.affectsManager}`, pageWidth - 16, yPos + 14, { align: 'right' });
    }

    yPos += 28;

    // ====== DIRECTIVE BOX ======
    if (data.directive) {
      doc.setFillColor(accentColor.r, accentColor.g, accentColor.b);
      doc.roundedRect(10, yPos, pageWidth - 20, 24, 3, 3, 'F');
      
      // White border inside
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.8);
      doc.roundedRect(12, yPos + 2, pageWidth - 24, 20, 2, 2, 'S');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('⚡ DIRECTIVE:', 16, yPos + 10);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const directiveLines = doc.splitTextToSize(data.directive, pageWidth - 60);
      doc.text(directiveLines.slice(0, 2).join(' '), 48, yPos + 10);
      if (directiveLines.length > 2) {
        doc.text(directiveLines.slice(2, 4).join(' '), 16, yPos + 18);
      }
      yPos += 32;
    }

    // ====== MANAGER TRACKING SECTION ======
    if (data.managerTracking && data.managerTracking.length > 0) {
      const highEvalManagers = data.managerTracking.filter(m => m.category === 'high_eval');
      const noEvalTracking = data.managerTracking.filter(m => m.category === 'no_eval');

      if (highEvalManagers.length > 0) {
        // Section header box
        doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
        doc.roundedRect(10, yPos, pageWidth - 20, 10, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text('HIGH EVALUATION TOP 10 MANAGERS', 16, yPos + 7);
        yPos += 14;

        // Managers box
        doc.setFillColor(lightBg.r, lightBg.g, lightBg.b);
        const managersBoxHeight = Math.ceil(highEvalManagers.length / 2) * 10 + 8;
        doc.roundedRect(10, yPos, pageWidth - 20, managersBoxHeight, 2, 2, 'F');
        doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
        doc.setLineWidth(0.3);
        doc.roundedRect(10, yPos, pageWidth - 20, managersBoxHeight, 2, 2, 'S');

        const colWidth = (pageWidth - 36) / 2;
        highEvalManagers.forEach((manager, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const xPos = 16 + col * (colWidth + 8);
          const rowY = yPos + 8 + row * 10;

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
          doc.text(`${idx + 1}. ${manager.name}`, xPos, rowY);
          
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(accentColor.r, accentColor.g, accentColor.b);
          doc.text(String(manager.value), xPos + colWidth - 10, rowY, { align: 'right' });
        });
        yPos += managersBoxHeight + 6;
      }

      if (noEvalTracking.length > 0) {
        // No Eval section box
        doc.setFillColor(255, 240, 240);
        doc.roundedRect(10, yPos, pageWidth - 20, 20, 2, 2, 'F');
        doc.setDrawColor(accentColor.r, accentColor.g, accentColor.b);
        doc.setLineWidth(0.5);
        doc.roundedRect(10, yPos, pageWidth - 20, 20, 2, 2, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(accentColor.r, accentColor.g, accentColor.b);
        doc.text('NO EVALUATION TRACKING', 16, yPos + 8);

        noEvalTracking.forEach((item, idx) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
          doc.text(`Assigned to: ${item.name} — ${item.value} claims require evaluation`, 16, yPos + 16);
        });
        yPos += 26;
      }
    }

    // Summary section with cards
    if (data.summary && Object.keys(data.summary).length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      doc.text('KEY METRICS', 14, yPos);
      yPos += 8;

      const entries = Object.entries(data.summary);
      const cardWidth = (pageWidth - 28 - (entries.length - 1) * 4) / Math.min(entries.length, 4);
      
      entries.forEach(([key, value], index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);
        const xPos = 14 + col * (cardWidth + 4);
        const cardY = yPos + row * 28;

        // Card background
        doc.setFillColor(lightBg.r, lightBg.g, lightBg.b);
        doc.roundedRect(xPos, cardY, cardWidth, 24, 2, 2, 'F');
        
        // Card border
        doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
        doc.setLineWidth(0.3);
        doc.roundedRect(xPos, cardY, cardWidth, 24, 2, 2, 'S');

        // Value (large)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
        const valueStr = String(value);
        doc.text(valueStr, xPos + cardWidth / 2, cardY + 10, { align: 'center' });

        // Label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
        const truncatedKey = key.length > 18 ? key.substring(0, 16) + '...' : key;
        doc.text(truncatedKey, xPos + cardWidth / 2, cardY + 18, { align: 'center' });
      });

      yPos += Math.ceil(entries.length / 4) * 28 + 12;
    }

    // Data Table Section
    if (data.columns.length > 0 && data.rows.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      doc.text('DETAILED DATA', 14, yPos);
      yPos += 8;

      const tableWidth = pageWidth - 28;
      const colCount = data.columns.length;
      const colWidth = tableWidth / colCount;
      const rowHeight = 9;

      // Table header
      doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
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
          
          // Repeat header on new page
          doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
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

        // Alternating row background
        if (rowIdx % 2 === 0) {
          doc.setFillColor(lightBg.r, lightBg.g, lightBg.b);
          doc.rect(14, yPos, tableWidth, rowHeight, 'F');
        }

        // Row border
        doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
        doc.setLineWidth(0.2);
        doc.line(14, yPos + rowHeight, pageWidth - 14, yPos + rowHeight);

        doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
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
    doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
    doc.setLineWidth(0.5);
    doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);
    
    doc.setFontSize(7);
    doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
    doc.text('Litigation Discipline Command Center • Confidential Executive Report', 14, footerY);
    doc.text(`Page 1 of ${doc.getNumberOfPages()}`, pageWidth - 14, footerY, { align: 'right' });

    // Update page numbers on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
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
