import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface ExportableData {
  title: string;
  subtitle?: string;
  timestamp: string;
  affectsManager?: string; // Who this report affects/is prepared for
  summary?: Record<string, string | number>;
  columns: string[];
  rows: (string | number)[][];
}

export function useExportData() {
  const generatePDF = (data: ExportableData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 25;

    // Colors
    const primaryColor = { r: 15, g: 23, b: 42 }; // Slate 900
    const accentColor = { r: 220, g: 38, b: 38 }; // Red 600
    const mutedColor = { r: 100, g: 116, b: 139 }; // Slate 500
    const lightBg = { r: 248, g: 250, b: 252 }; // Slate 50
    const borderColor = { r: 226, g: 232, b: 240 }; // Slate 200

    // Header bar
    doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.rect(0, 0, pageWidth, 18, 'F');

    // Logo/Brand text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('LITIGATION DISCIPLINE COMMAND CENTER', 14, 12);

    // Report type badge
    doc.setFillColor(accentColor.r, accentColor.g, accentColor.b);
    doc.roundedRect(pageWidth - 50, 5, 36, 8, 2, 2, 'F');
    doc.setFontSize(7);
    doc.text('EXECUTIVE REPORT', pageWidth - 32, 10, { align: 'center' });

    // Main Title
    yPos = 32;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.text(data.title, 14, yPos);
    yPos += 8;

    // Subtitle
    if (data.subtitle) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
      doc.text(data.subtitle, 14, yPos);
      yPos += 6;
    }

    // Timestamp
    doc.setFontSize(9);
    doc.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
    doc.text(`Generated: ${data.timestamp}`, 14, yPos);
    
    // Affects/Prepared For - Right aligned
    if (data.affectsManager) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      doc.text(`Prepared For: ${data.affectsManager}`, pageWidth - 14, yPos, { align: 'right' });
    }
    yPos += 12;

    // Divider line
    doc.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
    doc.setLineWidth(0.5);
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 10;

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
