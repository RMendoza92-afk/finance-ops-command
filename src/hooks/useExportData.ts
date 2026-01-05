import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface ExportableData {
  title: string;
  subtitle?: string;
  timestamp: string;
  summary?: Record<string, string | number>;
  columns: string[];
  rows: (string | number)[][];
}

export function useExportData() {
  const generatePDF = (data: ExportableData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(data.title, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    if (data.subtitle) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(data.subtitle, pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;
    }

    // Timestamp
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(`Generated: ${data.timestamp}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Summary section
    if (data.summary && Object.keys(data.summary).length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text('Summary', 14, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      Object.entries(data.summary).forEach(([key, value]) => {
        doc.text(`${key}: ${value}`, 14, yPos);
        yPos += 6;
      });
      yPos += 10;
    }

    // Table header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    
    const colWidth = (pageWidth - 28) / data.columns.length;
    let xPos = 14;

    // Draw header row
    doc.rect(14, yPos - 5, pageWidth - 28, 8, 'F');
    data.columns.forEach((col, i) => {
      doc.text(col, xPos + 2, yPos);
      xPos += colWidth;
    });
    yPos += 10;

    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    data.rows.forEach((row, rowIdx) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      xPos = 14;
      
      // Alternate row background
      if (rowIdx % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(14, yPos - 4, pageWidth - 28, 7, 'F');
      }

      row.forEach((cell, i) => {
        const cellText = String(cell);
        const truncated = cellText.length > 20 ? cellText.substring(0, 18) + '...' : cellText;
        doc.text(truncated, xPos + 2, yPos);
        xPos += colWidth;
      });
      yPos += 7;
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Litigation Discipline Command Center', pageWidth / 2, 285, { align: 'center' });

    // Download
    const filename = `${data.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    doc.save(filename);
    
    return filename;
  };

  const generateExcel = (data: ExportableData) => {
    const wb = XLSX.utils.book_new();

    // Main data sheet
    const wsData = [
      [data.title],
      [data.subtitle || ''],
      [`Generated: ${data.timestamp}`],
      [],
    ];

    // Add summary if exists
    if (data.summary && Object.keys(data.summary).length > 0) {
      wsData.push(['Summary']);
      Object.entries(data.summary).forEach(([key, value]) => {
        wsData.push([key, String(value)]);
      });
      wsData.push([]);
    }

    // Add table headers and rows
    wsData.push(data.columns);
    data.rows.forEach(row => {
      wsData.push(row.map(cell => String(cell)));
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    const colWidths = data.columns.map((col, i) => {
      const maxLen = Math.max(
        col.length,
        ...data.rows.map(row => String(row[i] || '').length)
      );
      return { wch: Math.min(maxLen + 2, 30) };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Data');

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
  | 'claim-detail';
