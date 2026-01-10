import * as XLSX from 'xlsx';

/**
 * Excel Export Utility Functions
 * Ensures numeric values are exported as numbers (not formatted strings)
 * so Excel's SUM and other functions work correctly.
 * Also provides formatting for CSV exports with $ and % symbols.
 */

// Number format codes for Excel
export const EXCEL_FORMATS = {
  CURRENCY: '$#,##0',
  CURRENCY_DECIMAL: '$#,##0.00',
  PERCENT: '0.0%',
  PERCENT_INT: '0%',
  NUMBER: '#,##0',
  NUMBER_DECIMAL: '#,##0.00',
};

/**
 * Format a number as currency with $ sign for CSV display
 */
export function formatCurrencyDisplay(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[$,]/g, ''));
  if (isNaN(num)) return String(value);
  
  const absNum = Math.abs(num);
  const formatted = absNum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return num < 0 ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Format a number as currency with decimals for CSV display
 */
export function formatCurrencyDecimalDisplay(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[$,]/g, ''));
  if (isNaN(num)) return String(value);
  
  const absNum = Math.abs(num);
  const formatted = absNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return num < 0 ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Format a number as percentage with % sign for CSV display
 * Expects value as percentage (e.g., 45.5 for 45.5%)
 */
export function formatPercentDisplay(value: number | string | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/%/g, ''));
  if (isNaN(num)) return String(value);
  
  return `${num.toFixed(decimals)}%`;
}

/**
 * Format a number with commas for CSV display
 */
export function formatNumberDisplay(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (isNaN(num)) return String(value);
  
  return num.toLocaleString('en-US');
}

/**
 * Check if a header indicates a currency column
 */
export function isCurrencyHeader(header: string): boolean {
  const h = header.toLowerCase();
  return (
    h.includes('reserve') ||
    h.includes('amount') ||
    h.includes('paid') ||
    h.includes('premium') ||
    h.includes('exposure') ||
    h.includes('eval') ||
    h.includes('spend') ||
    h.includes('budget') ||
    h.includes('cost') ||
    h.includes('value') ||
    h.includes('indemnit') ||
    h.includes('settlement') ||
    h.includes('offer') ||
    h.includes('net ') ||
    h.includes('gross') ||
    h.includes('total') && !h.includes('count') && !h.includes('claims')
  );
}

/**
 * Check if a header indicates a percentage column
 */
export function isPercentHeader(header: string): boolean {
  const h = header.toLowerCase();
  return (
    h.includes('rate') ||
    h.includes('%') ||
    h.includes('percent') ||
    h.includes('pct') ||
    h.includes('ratio')
  );
}

/**
 * Format a row of data based on column headers for CSV export
 * Returns formatted string values with $ and % symbols
 */
export function formatRowForCsv(row: (string | number | null | undefined)[], headers: string[]): string[] {
  return row.map((cell, idx) => {
    if (cell === null || cell === undefined) return '';
    const header = headers[idx] || '';
    
    // Check if it's a currency column
    if (isCurrencyHeader(header) && typeof cell === 'number') {
      return formatCurrencyDisplay(cell);
    }
    
    // Check if it's a percentage column
    if (isPercentHeader(header) && typeof cell === 'number') {
      return formatPercentDisplay(cell);
    }
    
    return String(cell);
  });
}

/**
 * Format entire data array for CSV export with $ and % symbols
 */
export function formatDataForCsv(data: (string | number | null | undefined)[][]): (string | number)[][] {
  if (data.length === 0) return [];
  
  const headers = data[0]?.map(h => String(h || '')) || [];
  
  return data.map((row, rowIdx) => {
    if (rowIdx === 0) return row.map(h => String(h || '')); // Header row unchanged
    return formatRowForCsv(row, headers);
  });
}

/**
 * Apply number formats to specific columns in a worksheet
 * @param ws - The worksheet to format
 * @param columnFormats - Object mapping column letters to format codes
 * @param startRow - Row to start formatting from (default 2, skips header)
 */
export function applyColumnFormats(
  ws: XLSX.WorkSheet,
  columnFormats: Record<string, string>,
  startRow = 2
) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  Object.entries(columnFormats).forEach(([col, format]) => {
    const colNum = XLSX.utils.decode_col(col);
    for (let row = startRow - 1; row <= range.e.r; row++) {
      const cellAddr = XLSX.utils.encode_cell({ r: row, c: colNum });
      const cell = ws[cellAddr];
      if (cell && typeof cell.v === 'number') {
        cell.z = format;
      }
    }
  });
}

/**
 * Create a worksheet from array of arrays, ensuring numbers stay as numbers
 * Automatically converts numeric-looking strings back to numbers
 */
export function createNumericSheet(data: (string | number | null | undefined)[][]): XLSX.WorkSheet {
  // Clean data - ensure numbers are numbers
  const cleanedData = data.map(row => 
    row.map(cell => {
      if (cell === null || cell === undefined) return '';
      if (typeof cell === 'number') return cell;
      
      const str = String(cell);
      
      // Skip if it looks like a formatted string we want to keep (dates, etc)
      if (str.includes('/') || str.includes('-') && !str.startsWith('-')) {
        // Check if it's a date pattern
        if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(str) || /^\d{4}-\d{2}-\d{2}/.test(str)) {
          return str;
        }
      }
      
      // Remove currency formatting and parse
      const currencyMatch = str.match(/^\$?([\d,]+\.?\d*)$/);
      if (currencyMatch) {
        const num = parseFloat(currencyMatch[1].replace(/,/g, ''));
        if (!isNaN(num)) return num;
      }
      
      // Handle negative currency
      const negCurrencyMatch = str.match(/^-?\$?([\d,]+\.?\d*)$/) || str.match(/^\(([\d,$]+\.?\d*)\)$/);
      if (negCurrencyMatch) {
        const numStr = negCurrencyMatch[1].replace(/[$,]/g, '');
        const num = parseFloat(numStr);
        if (!isNaN(num)) {
          return str.startsWith('-') || str.startsWith('(') ? -num : num;
        }
      }
      
      // Return original string if no conversion
      return str;
    })
  );
  
  return XLSX.utils.aoa_to_sheet(cleanedData);
}

/**
 * Create a worksheet from JSON, ensuring numbers stay as numbers
 */
export function createNumericJsonSheet(data: Record<string, unknown>[]): XLSX.WorkSheet {
  // Clean data - ensure numbers are numbers, not formatted strings
  const cleanedData = data.map(row => {
    const newRow: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
      if (typeof value === 'number') {
        newRow[key] = value;
      } else if (typeof value === 'string') {
        // Try to extract number from formatted strings
        const currencyMatch = value.match(/^\$?([\d,]+\.?\d*)$/);
        if (currencyMatch) {
          const num = parseFloat(currencyMatch[1].replace(/,/g, ''));
          if (!isNaN(num)) {
            newRow[key] = num;
            return;
          }
        }
        // Handle negative currency
        if (value.startsWith('-$') || value.startsWith('($')) {
          const numStr = value.replace(/[$,()]/g, '');
          const num = parseFloat(numStr);
          if (!isNaN(num)) {
            newRow[key] = value.startsWith('-') || value.startsWith('(') ? -num : num;
            return;
          }
        }
        newRow[key] = value;
      } else {
        newRow[key] = value;
      }
    });
    return newRow;
  });
  
  return XLSX.utils.json_to_sheet(cleanedData);
}

/**
 * Format currency columns in a worksheet (by column index, 0-based)
 */
export function formatCurrencyColumns(ws: XLSX.WorkSheet, colIndices: number[], startRow = 1) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  colIndices.forEach(colNum => {
    for (let row = startRow; row <= range.e.r; row++) {
      const cellAddr = XLSX.utils.encode_cell({ r: row, c: colNum });
      const cell = ws[cellAddr];
      if (cell && typeof cell.v === 'number') {
        cell.z = EXCEL_FORMATS.CURRENCY;
      }
    }
  });
}

/**
 * Format percent columns in a worksheet (by column index, 0-based)
 * Note: For Excel percentages, values should be decimals (0.5 = 50%)
 */
export function formatPercentColumns(ws: XLSX.WorkSheet, colIndices: number[], startRow = 1) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  colIndices.forEach(colNum => {
    for (let row = startRow; row <= range.e.r; row++) {
      const cellAddr = XLSX.utils.encode_cell({ r: row, c: colNum });
      const cell = ws[cellAddr];
      if (cell && typeof cell.v === 'number') {
        // If value is already a decimal (< 1 or negative), use as-is
        // If it's a whole number percentage (like 45.5), convert to decimal
        if (Math.abs(cell.v) > 1) {
          cell.v = cell.v / 100;
        }
        cell.z = EXCEL_FORMATS.PERCENT;
      }
    }
  });
}

/**
 * Auto-format worksheet columns by header name with Excel number formats
 */
export function autoFormatByHeaders(ws: XLSX.WorkSheet, headers: string[]) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  headers.forEach((header, colNum) => {
    let format: string | null = null;
    
    if (isCurrencyHeader(header)) {
      format = EXCEL_FORMATS.CURRENCY;
    }
    
    if (isPercentHeader(header)) {
      format = EXCEL_FORMATS.PERCENT;
    }
    
    if (format) {
      for (let row = 1; row <= range.e.r; row++) {
        const cellAddr = XLSX.utils.encode_cell({ r: row, c: colNum });
        const cell = ws[cellAddr];
        if (cell && typeof cell.v === 'number') {
          // For percentages, convert if needed
          if (format === EXCEL_FORMATS.PERCENT && Math.abs(cell.v) > 1) {
            cell.v = cell.v / 100;
          }
          cell.z = format;
        }
      }
    }
  });
}

/**
 * Format value based on header for display (CSV/display purposes)
 */
export function formatValueForDisplay(value: number | string | null | undefined, header: string): string {
  if (value === null || value === undefined) return '';
  
  if (typeof value === 'number') {
    if (isCurrencyHeader(header)) {
      return formatCurrencyDisplay(value);
    }
    if (isPercentHeader(header)) {
      return formatPercentDisplay(value);
    }
    return formatNumberDisplay(value);
  }
  
  return String(value);
}

/**
 * Format currency with explicit $ prefix for CSV export
 * Designed for "boardroom-ready" exports that display nicely when opened in Excel manually
 */
export function formatCurrencyForCSV(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[$,]/g, ''));
  if (isNaN(num)) return String(value);
  
  const absNum = Math.abs(num);
  const formatted = absNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  // Explicitly prefix with $ for clear currency display
  return num < 0 ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Format number with thousand separators for CSV
 */
export function formatNumberForCSV(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (isNaN(num)) return String(value);
  
  return num.toLocaleString('en-US');
}

/**
 * Create a boardroom-ready 2D array with formatted values
 * Applies $ formatting to currency columns, % to percent columns
 * Designed for exports that look great when opened in Excel/Sheets
 */
export function formatDataForBoardroom(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string[][] {
  const result: string[][] = [];
  
  // Headers unchanged
  result.push(headers.map(h => String(h)));
  
  // Format each row
  rows.forEach(row => {
    const formattedRow = row.map((cell, idx) => {
      if (cell === null || cell === undefined) return '';
      
      const header = headers[idx] || '';
      
      if (typeof cell === 'number') {
        // Currency columns get $ prefix
        if (isCurrencyHeader(header)) {
          return formatCurrencyForCSV(cell);
        }
        // Percent columns get % suffix
        if (isPercentHeader(header)) {
          return formatPercentDisplay(cell, 2);
        }
        // Other numbers get comma formatting
        return formatNumberForCSV(cell);
      }
      
      return String(cell);
    });
    
    result.push(formattedRow);
  });
  
  return result;
}
