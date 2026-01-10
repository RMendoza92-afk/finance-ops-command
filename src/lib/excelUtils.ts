import * as XLSX from 'xlsx';

/**
 * Excel Export Utility Functions
 * Ensures numeric values are exported as numbers (not formatted strings)
 * so Excel's SUM and other functions work correctly.
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
 * Auto-format common columns by header name
 */
export function autoFormatByHeaders(ws: XLSX.WorkSheet, headers: string[]) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  headers.forEach((header, colNum) => {
    const headerLower = header.toLowerCase();
    let format: string | null = null;
    
    // Currency columns
    if (
      headerLower.includes('reserve') ||
      headerLower.includes('amount') ||
      headerLower.includes('paid') ||
      headerLower.includes('premium') ||
      headerLower.includes('exposure') ||
      headerLower.includes('eval') ||
      headerLower === 'value' ||
      headerLower.includes('total') && !headerLower.includes('count')
    ) {
      format = EXCEL_FORMATS.CURRENCY;
    }
    
    // Percent columns
    if (
      headerLower.includes('rate') ||
      headerLower.includes('%') ||
      headerLower.includes('percent') ||
      headerLower.includes('pct')
    ) {
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
