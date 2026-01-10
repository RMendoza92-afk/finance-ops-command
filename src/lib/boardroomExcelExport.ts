import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { isCurrencyHeader, isPercentHeader } from './excelUtils';

/**
 * Boardroom-Quality Excel Export
 * Creates professionally styled Excel files with:
 * - Bold titles and section headers
 * - Color-coded header rows (navy blue background, white text)
 * - Alternating row colors for readability
 * - Proper currency formatting with $ symbols
 * - Borders and professional spacing
 */

// Color palette matching boardroom aesthetic
const COLORS = {
  navyBlue: '1F4E79',      // Section headers
  darkBlue: '2E5A8B',      // Table headers
  lightBlue: 'DCE6F1',     // Alternating rows
  white: 'FFFFFF',
  black: '000000',
  darkRed: '8B0000',       // Highlight/accent (like "ACCEPTED SETTLEMENT")
  gold: 'D4AF37',
  lightGray: 'F5F5F5',
  borderGray: 'B4B4B4',
};

export interface BoardroomSection {
  title: string;
  subtitle?: string;
  metrics?: { label: string; value: string | number }[];
  table?: {
    headers: string[];
    rows: (string | number | null | undefined)[][];
    highlightLastRow?: boolean; // Highlight the last row (e.g., totals)
    highlightColumn?: number;   // Column index to apply accent color
  };
}

export interface BoardroomExportData {
  reportTitle: string;
  asOfDate: string;
  sections: BoardroomSection[];
  filename?: string;
}

/**
 * Format a number as currency for Excel display
 */
const formatCurrency = (value: number): string => {
  const absNum = Math.abs(value);
  const formatted = absNum.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
};

/**
 * Format a number with commas
 */
const formatNumber = (value: number): string => {
  return value.toLocaleString('en-US');
};

/**
 * Generate a boardroom-quality Excel file with full styling
 */
export async function generateStyledBoardroomExcel(data: BoardroomExportData): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fred Loya Insurance';
  workbook.created = new Date();
  
  const worksheet = workbook.addWorksheet('Report', {
    properties: { defaultColWidth: 18 }
  });

  let currentRow = 1;

  // === REPORT TITLE ===
  const titleRow = worksheet.getRow(currentRow);
  titleRow.getCell(1).value = data.reportTitle.toUpperCase();
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: COLORS.navyBlue } };
  titleRow.height = 24;
  currentRow++;

  // === AS OF DATE ===
  const dateRow = worksheet.getRow(currentRow);
  dateRow.getCell(1).value = `As of: ${data.asOfDate}`;
  dateRow.getCell(1).font = { italic: true, size: 10, color: { argb: '666666' } };
  currentRow += 2; // Extra blank row

  // === PROCESS EACH SECTION ===
  for (const section of data.sections) {
    // Section Title (bold, navy blue text)
    if (section.title) {
      const sectionTitleRow = worksheet.getRow(currentRow);
      sectionTitleRow.getCell(1).value = section.title.toUpperCase();
      sectionTitleRow.getCell(1).font = { bold: true, size: 11, color: { argb: COLORS.navyBlue } };
      sectionTitleRow.height = 20;
      currentRow++;
    }

    // Key-Value Metrics Table
    if (section.metrics && section.metrics.length > 0) {
      // Metric header row
      const metricHeaderRow = worksheet.getRow(currentRow);
      metricHeaderRow.getCell(1).value = 'Metric';
      metricHeaderRow.getCell(2).value = 'Value';
      
      [1, 2].forEach(col => {
        const cell = metricHeaderRow.getCell(col);
        cell.font = { bold: true, color: { argb: COLORS.white } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.darkBlue }
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: COLORS.borderGray } }
        };
        cell.alignment = { vertical: 'middle' };
      });
      metricHeaderRow.height = 18;
      currentRow++;

      // Metric data rows
      section.metrics.forEach((metric, idx) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = metric.label;
        
        // Format value
        let displayValue: string | number = metric.value;
        if (typeof metric.value === 'number') {
          if (isCurrencyHeader(metric.label)) {
            displayValue = formatCurrency(metric.value);
          } else {
            displayValue = formatNumber(metric.value);
          }
        }
        row.getCell(2).value = displayValue;
        row.getCell(2).alignment = { horizontal: 'right' };
        
        // Alternating row color
        if (idx % 2 === 1) {
          [1, 2].forEach(col => {
            row.getCell(col).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: COLORS.lightGray }
            };
          });
        }
        
        // Light border
        [1, 2].forEach(col => {
          row.getCell(col).border = {
            bottom: { style: 'hair', color: { argb: COLORS.borderGray } }
          };
        });
        
        currentRow++;
      });
      
      currentRow++; // Spacer
    }

    // Data Table
    if (section.table) {
      const { headers, rows, highlightLastRow } = section.table;
      
      // Table header row - BLUE BACKGROUND, WHITE TEXT
      const headerRow = worksheet.getRow(currentRow);
      headers.forEach((header, colIdx) => {
        const cell = headerRow.getCell(colIdx + 1);
        cell.value = header;
        cell.font = { bold: true, color: { argb: COLORS.white }, size: 10 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLORS.navyBlue }
        };
        cell.alignment = { 
          horizontal: colIdx === 0 ? 'left' : 'center',
          vertical: 'middle'
        };
        cell.border = {
          top: { style: 'thin', color: { argb: COLORS.navyBlue } },
          bottom: { style: 'thin', color: { argb: COLORS.navyBlue } },
          left: { style: 'thin', color: { argb: COLORS.navyBlue } },
          right: { style: 'thin', color: { argb: COLORS.navyBlue } }
        };
      });
      headerRow.height = 20;
      currentRow++;

      // Table data rows
      rows.forEach((rowData, rowIdx) => {
        const row = worksheet.getRow(currentRow);
        const isLastRow = rowIdx === rows.length - 1;
        const shouldHighlight = highlightLastRow && isLastRow;
        
        rowData.forEach((cellValue, colIdx) => {
          const cell = row.getCell(colIdx + 1);
          const header = headers[colIdx] || '';
          
          // Format value
          if (cellValue === null || cellValue === undefined) {
            cell.value = '';
          } else if (typeof cellValue === 'number') {
            if (isCurrencyHeader(header) || header.toLowerCase().includes('amount')) {
              cell.value = formatCurrency(cellValue);
            } else if (isPercentHeader(header)) {
              cell.value = `${cellValue.toFixed(1)}%`;
            } else {
              cell.value = formatNumber(cellValue);
            }
          } else {
            cell.value = String(cellValue);
          }
          
          // Alignment
          cell.alignment = { 
            horizontal: colIdx === 0 ? 'left' : (typeof cellValue === 'number' ? 'right' : 'center'),
            vertical: 'middle'
          };
          
          // Highlighted row (dark red, bold) - like "ACCEPTED SETTLEMENT"
          if (shouldHighlight) {
            cell.font = { bold: true, color: { argb: COLORS.darkRed } };
          }
          
          // Alternating row colors (skip if highlighted)
          if (!shouldHighlight && rowIdx % 2 === 1) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: COLORS.lightBlue }
            };
          }
          
          // Borders
          cell.border = {
            bottom: { style: 'hair', color: { argb: COLORS.borderGray } },
            left: { style: 'hair', color: { argb: COLORS.borderGray } },
            right: { style: 'hair', color: { argb: COLORS.borderGray } }
          };
        });
        
        currentRow++;
      });
      
      currentRow++; // Spacer after table
    }
  }

  // === AUTO-FIT COLUMN WIDTHS ===
  worksheet.columns.forEach((column, idx) => {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const cellLength = cell.value ? String(cell.value).length : 0;
      if (cellLength > maxLength) {
        maxLength = Math.min(cellLength, 40);
      }
    });
    column.width = maxLength + 4;
  });

  // Generate filename
  const filename = data.filename || 
    `${data.reportTitle.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;

  // Write to buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return filename;
}

/**
 * Quick helper to generate a simple styled report
 */
export async function generateQuickBoardroomReport(
  title: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  options?: {
    asOfDate?: string;
    highlightLastRow?: boolean;
    filename?: string;
  }
): Promise<string> {
  return generateStyledBoardroomExcel({
    reportTitle: title,
    asOfDate: options?.asOfDate || format(new Date(), 'MMMM d, yyyy'),
    sections: [{
      title: '',
      table: {
        headers,
        rows,
        highlightLastRow: options?.highlightLastRow
      }
    }],
    filename: options?.filename
  });
}
