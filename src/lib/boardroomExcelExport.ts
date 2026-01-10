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

// Legacy format support for existing useExportData consumers
export interface LegacyExportData {
  title: string;
  subtitle?: string;
  timestamp?: string;
  summary?: Record<string, string | number>;
  columns: string[];
  rows: (string | number)[][];
  rawClaimData?: { sheetName?: string; columns: string[]; rows: (string | number)[][] }[];
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

/**
 * Generate a styled Negotiation Activity Summary report
 * Matches the boardroom aesthetic with blue headers and proper formatting
 */
export async function generateNegotiationSummaryExcel(data: {
  totalWithNegotiation: number;
  totalWithoutNegotiation: number;
  totalNegotiationAmount: number;
  avgNegotiationAmount: number;
  staleNegotiations60Plus: number;
  staleNegotiations90Plus: number;
  byType: { type: string; count: number; totalAmount: number }[];
}): Promise<string> {
  const exportData: BoardroomExportData = {
    reportTitle: 'Negotiation Activity Summary',
    asOfDate: format(new Date(), 'MMMM d, yyyy'),
    sections: [
      {
        title: 'Key Metrics',
        metrics: [
          { label: 'Claims with Negotiation', value: data.totalWithNegotiation },
          { label: 'Claims without Negotiation', value: data.totalWithoutNegotiation },
          { label: 'Total Negotiation Amount', value: data.totalNegotiationAmount },
          { label: 'Average Negotiation Amount', value: data.avgNegotiationAmount },
          { label: 'Stale Negotiations (60+ Days)', value: data.staleNegotiations60Plus },
          { label: 'Stale Negotiations (90+ Days)', value: data.staleNegotiations90Plus },
        ]
      },
      {
        title: 'Negotiation by Type',
        table: {
          headers: ['Negotiation Type', 'Count', 'Total Amount'],
          rows: data.byType.map(t => [t.type, t.count, t.totalAmount]),
          highlightLastRow: true
        }
      }
    ],
    filename: `Negotiation_Activity_${format(new Date(), 'yyyyMMdd')}.xlsx`
  };
  
  return generateStyledBoardroomExcel(exportData);
}

/**
 * Generate a styled CP1 Trigger Flags report
 */
export async function generateCP1FlagsExcel(data: {
  totalClaims: number;
  totalFlags: number;
  multiFlag2Plus: number;
  multiFlag3Plus: number;
  flagBreakdown: { flagType: string; count: number; tier: string }[];
  weekOverWeek?: {
    metric: string;
    prior: number | string;
    current: number | string;
    delta: number | string;
    trend: string;
  }[];
}): Promise<string> {
  const sections: BoardroomSection[] = [
    {
      title: 'Key Metrics',
      metrics: [
        { label: 'Total CP1 Claims', value: data.totalClaims },
        { label: 'Active Trigger Flags', value: data.totalFlags },
        { label: 'Multi-Flag Claims (2+)', value: data.multiFlag2Plus },
        { label: 'High-Risk Claims (3+ Flags)', value: data.multiFlag3Plus },
      ]
    },
    {
      title: 'Trigger Flags Breakdown',
      table: {
        headers: ['Flag Type', 'Count', 'Tier'],
        rows: data.flagBreakdown.map(f => [f.flagType, f.count, f.tier]),
        highlightLastRow: false
      }
    }
  ];
  
  if (data.weekOverWeek && data.weekOverWeek.length > 0) {
    sections.push({
      title: 'Week-over-Week Progress',
      table: {
        headers: ['Metric', 'Prior', 'Current', 'Delta', 'Trend'],
        rows: data.weekOverWeek.map(w => [w.metric, w.prior, w.current, w.delta, w.trend]),
        highlightLastRow: false
      }
    });
  }
  
  const exportData: BoardroomExportData = {
    reportTitle: 'CP1 Trigger Flags - Executive Summary',
    asOfDate: format(new Date(), 'MMMM d, yyyy'),
    sections,
    filename: `CP1_Trigger_Flags_${format(new Date(), 'yyyyMMdd')}.xlsx`
  };
  
  return generateStyledBoardroomExcel(exportData);
}

/**
 * Convert legacy export format to boardroom styled Excel
 * Drop-in replacement for generateExcel from useExportData
 */
export async function generateStyledExcelFromLegacy(data: LegacyExportData): Promise<string> {
  const sections: BoardroomSection[] = [];
  
  // Add summary metrics if present
  if (data.summary && Object.keys(data.summary).length > 0) {
    sections.push({
      title: 'Key Metrics',
      metrics: Object.entries(data.summary).map(([label, value]) => ({ label, value }))
    });
  }
  
  // Add main data table
  if (data.columns.length > 0 && data.rows.length > 0) {
    sections.push({
      title: 'Data Summary',
      table: {
        headers: data.columns,
        rows: data.rows,
        highlightLastRow: false
      }
    });
  }
  
  // Add raw claim data sheets as additional sections
  if (data.rawClaimData && data.rawClaimData.length > 0) {
    data.rawClaimData.forEach((rawData) => {
      sections.push({
        title: rawData.sheetName || 'Claims Detail',
        table: {
          headers: rawData.columns,
          rows: rawData.rows,
          highlightLastRow: false
        }
      });
    });
  }
  
  const exportData: BoardroomExportData = {
    reportTitle: data.title,
    asOfDate: data.timestamp || format(new Date(), 'MMMM d, yyyy'),
    sections,
    filename: `${data.title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.xlsx`
  };
  
  return generateStyledBoardroomExcel(exportData);
}

/**
 * Generate styled Excel from simple table data (array of objects)
 */
export async function generateStyledTableExcel(
  title: string,
  data: Record<string, any>[],
  options?: {
    filename?: string;
    summaryMetrics?: { label: string; value: string | number }[];
    highlightLastRow?: boolean;
  }
): Promise<string> {
  if (data.length === 0) {
    throw new Error('No data to export');
  }
  
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => row[h]));
  
  const sections: BoardroomSection[] = [];
  
  if (options?.summaryMetrics && options.summaryMetrics.length > 0) {
    sections.push({
      title: 'Summary',
      metrics: options.summaryMetrics
    });
  }
  
  sections.push({
    title: '',
    table: {
      headers,
      rows,
      highlightLastRow: options?.highlightLastRow
    }
  });
  
  const exportData: BoardroomExportData = {
    reportTitle: title,
    asOfDate: format(new Date(), 'MMMM d, yyyy'),
    sections,
    filename: options?.filename || `${title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.xlsx`
  };
  
  return generateStyledBoardroomExcel(exportData);
}

/**
 * Generate styled Over-Limit Claims export
 */
export async function generateOverLimitExcel(
  state: string,
  claims: { 
    claim_number: string; 
    state: string;
    payment_date: string;
    coverage?: string;
    classification?: string;
    root_cause?: string;
    policy_limit?: number;
    payment_amount: number;
    over_limit_amount: number;
  }[],
  totalOverLimit: number
): Promise<string> {
  const anomalyCount = claims.filter(c => c.classification === 'Anomaly').length;
  const issueCount = claims.filter(c => c.classification === 'Issue').length;
  const anomalyTotal = claims.filter(c => c.classification === 'Anomaly').reduce((sum, c) => sum + c.over_limit_amount, 0);
  const issueTotal = claims.filter(c => c.classification === 'Issue').reduce((sum, c) => sum + c.over_limit_amount, 0);
  
  const exportData: BoardroomExportData = {
    reportTitle: `Over-Limit Claims - ${state}`,
    asOfDate: format(new Date(), 'MMMM d, yyyy'),
    sections: [
      {
        title: 'Summary',
        metrics: [
          { label: 'State', value: state },
          { label: 'Total Claims', value: claims.length },
          { label: 'Total Over-Limit Amount', value: totalOverLimit },
          { label: 'Anomaly Claims', value: anomalyCount },
          { label: 'Anomaly Over-Limit', value: anomalyTotal },
          { label: 'Issue Claims', value: issueCount },
          { label: 'Issue Over-Limit', value: issueTotal },
        ]
      },
      {
        title: 'Claims Detail',
        table: {
          headers: ['Claim Number', 'State', 'Payment Date', 'Coverage', 'Classification', 'Root Cause', 'Policy Limit', 'Payment Amount', 'Over Limit Amount'],
          rows: claims.map(c => [
            c.claim_number,
            c.state,
            c.payment_date,
            c.coverage || 'BI',
            c.classification || 'Issue',
            c.root_cause || '',
            c.policy_limit || 0,
            c.payment_amount,
            c.over_limit_amount
          ]),
          highlightLastRow: false
        }
      }
    ],
    filename: `OverLimit_${state.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.xlsx`
  };
  
  return generateStyledBoardroomExcel(exportData);
}

/**
 * Generate styled RBC/Actuarial export
 */
export async function generateRBCExcel(data: {
  rbcRatio: number;
  lossRatio: number;
  laeRatio: number;
  combinedRatio: number;
  ibnr: number;
  ultimateLoss: number;
  credibility: number;
  developmentFactor: number;
  selectedChange: number;
  triangleData?: { columns: string[]; rows: (string | number)[][] };
  accidentYears?: { accident_year: number; earned_premium: number; net_paid: number; reserves: number; ibnr: number; incurred: number; loss_ratio: number }[];
}): Promise<string> {
  const sections: BoardroomSection[] = [
    {
      title: 'Key Metrics',
      metrics: [
        { label: 'RBC Ratio', value: `${data.rbcRatio.toFixed(0)}%` },
        { label: 'Loss Ratio', value: `${data.lossRatio.toFixed(1)}%` },
        { label: 'LAE Ratio', value: `${data.laeRatio.toFixed(1)}%` },
        { label: 'Combined Ratio', value: `${data.combinedRatio.toFixed(1)}%` },
        { label: 'IBNR Reserve', value: data.ibnr },
        { label: 'Ultimate Loss', value: data.ultimateLoss },
        { label: 'Credibility', value: `${(data.credibility * 100).toFixed(0)}%` },
        { label: 'Development Factor', value: data.developmentFactor.toFixed(3) },
        { label: 'Selected Rate Change', value: `${data.selectedChange >= 0 ? '+' : ''}${data.selectedChange.toFixed(1)}%` },
      ]
    }
  ];
  
  if (data.triangleData && data.triangleData.columns.length > 0) {
    sections.push({
      title: 'Loss Development Triangle',
      table: {
        headers: data.triangleData.columns,
        rows: data.triangleData.rows,
        highlightLastRow: false
      }
    });
  }
  
  if (data.accidentYears && data.accidentYears.length > 0) {
    sections.push({
      title: 'Accident Year Summary',
      table: {
        headers: ['Accident Year', 'Earned Premium', 'Net Paid', 'Reserves', 'IBNR', 'Incurred', 'Loss Ratio'],
        rows: data.accidentYears.map(ay => [
          ay.accident_year,
          ay.earned_premium,
          ay.net_paid,
          ay.reserves,
          ay.ibnr,
          ay.incurred,
          `${ay.loss_ratio.toFixed(2)}%`
        ]),
        highlightLastRow: false
      }
    });
  }
  
  const exportData: BoardroomExportData = {
    reportTitle: 'RBC Performance Monitor',
    asOfDate: format(new Date(), 'MMMM d, yyyy'),
    sections,
    filename: `RBC_Performance_${format(new Date(), 'yyyyMMdd')}.xlsx`
  };
  
  return generateStyledBoardroomExcel(exportData);
}
