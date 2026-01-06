/**
 * EXECUTIVE PDF FRAMEWORK
 * ========================
 * Board-Ready Document Standards for C-Suite Review
 * 
 * Every report generated through this framework is assumed to be reviewed by:
 * - Chief Financial Officer (CFO)
 * - Chief Executive Officer (CEO)  
 * - Chief Operating Officer (COO)
 * 
 * QUALITY GATES:
 * - Executive clarity: Key takeaway obvious in 10 seconds
 * - Financial credibility: Numbers, assumptions, conclusions defensible
 * - Visual professionalism: Clean hierarchy, no clutter
 * - Decision usefulness: Actionable insights, not descriptions
 * 
 * If a page would not survive boardroom review, it must be rewritten.
 * Standard: "Would a CFO trust this immediately?"
 */

import { format } from 'date-fns';

// ==================== TYPES ====================

export interface ExecutiveMetric {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  deltaDirection?: 'positive' | 'negative' | 'neutral';
  context?: string;
}

export interface ExecutiveInsight {
  priority: 'critical' | 'high' | 'medium' | 'info';
  headline: string;
  detail?: string;
  action?: string;
}

export interface ExecutiveTableRow {
  cells: (string | number)[];
  highlight?: 'risk' | 'success' | 'warning' | 'header' | 'total';
}

export interface ExecutiveTable {
  title: string;
  headers: string[];
  rows: ExecutiveTableRow[];
  footnote?: string;
}

export interface ExecutiveChart {
  type: 'bar' | 'horizontalBar' | 'donut';
  title: string;
  data: { label: string; value: number; color?: string }[];
}

export interface QuarterlyData {
  quarter: string;
  paid: number;
  paidMonthly: number;
  approved: number;
  approvedMonthly: number;
  variance: number;
}

export interface AppendixSection {
  title: string;
  content?: string;
  table?: ExecutiveTable;
  chart?: ExecutiveChart;
}

export interface ExecutiveReportConfig {
  title: string;
  subtitle?: string;
  reportType: 'STATUS' | 'ANALYSIS' | 'FORECAST' | 'DECISION' | 'ALERT';
  orientation?: 'portrait' | 'landscape';
  classification?: 'CONFIDENTIAL' | 'INTERNAL' | 'RESTRICTED';
  
  // Executive Summary (Page 1 - ALWAYS)
  executiveSummary: {
    keyTakeaway: string; // Must be obvious in 10 seconds
    metrics: ExecutiveMetric[];
    insights: ExecutiveInsight[];
    bottomLine?: string; // CFO/CEO bottom line
  };
  
  // Optional additional content
  tables?: ExecutiveTable[];
  charts?: ExecutiveChart[];
  
  // Quarterly trend data (6 quarters for comprehensive view)
  quarterlyData?: QuarterlyData[];
  
  // Appendix sections for detailed breakdowns
  appendix?: AppendixSection[];
  
  // Force multi-page output with all content
  includeAllContent?: boolean;
}

export interface QualityScore {
  executiveClarity: number;
  financialCredibility: number;
  visualProfessionalism: number;
  decisionUsefulness: number;
  overall: number;
  passed: boolean;
  issues: string[];
}

// ==================== COLOR PALETTE ====================
// Command Center Dark Theme: Black, White, Red, Green

export const EXECUTIVE_COLORS = {
  // Primary palette - Dark command center theme
  navy: [0, 0, 0] as [number, number, number],           // Pure black background
  darkNavy: [18, 18, 18] as [number, number, number],    // Slightly lighter black for cards
  steel: [38, 38, 38] as [number, number, number],       // Dark grey for secondary elements
  
  // Accent colors - Red primary (matches --primary: 0 84% 50%)
  azure: [220, 38, 38] as [number, number, number],      // Red accent (hsl(0, 84%, 50%))
  teal: [220, 38, 38] as [number, number, number],       // Red accent for consistency
  
  // Status colors - Green/Red from theme
  success: [34, 197, 94] as [number, number, number],    // Green (hsl(142, 71%, 45%))
  warning: [245, 158, 11] as [number, number, number],   // Amber warning
  danger: [220, 38, 38] as [number, number, number],     // Red (matches primary)
  critical: [185, 28, 28] as [number, number, number],   // Darker red for critical
  
  // Neutrals - High contrast for dark theme
  white: [255, 255, 255] as [number, number, number],
  lightGray: [38, 38, 38] as [number, number, number],   // Dark bg for alternating rows
  mediumGray: [115, 115, 115] as [number, number, number],
  darkGray: [64, 64, 64] as [number, number, number],
  textPrimary: [255, 255, 255] as [number, number, number],  // White text on dark
  textSecondary: [163, 163, 163] as [number, number, number], // Light grey for secondary
};

// ==================== QUALITY AUDIT ====================

export function auditReportQuality(config: ExecutiveReportConfig): QualityScore {
  const issues: string[] = [];
  let executiveClarity = 10;
  let financialCredibility = 10;
  let visualProfessionalism = 10;
  let decisionUsefulness = 10;

  // === EXECUTIVE CLARITY ===
  
  // Key takeaway must exist and be concise
  if (!config.executiveSummary.keyTakeaway) {
    executiveClarity -= 5;
    issues.push('Missing key takeaway - CFO cannot assess in 10 seconds');
  } else if (config.executiveSummary.keyTakeaway.length > 200) {
    executiveClarity -= 2;
    issues.push('Key takeaway too long - must be scannable');
  }
  
  // Must have metrics
  if (!config.executiveSummary.metrics || config.executiveSummary.metrics.length === 0) {
    executiveClarity -= 3;
    issues.push('No metrics provided - executives need numbers');
  } else if (config.executiveSummary.metrics.length > 6) {
    executiveClarity -= 1;
    issues.push('Too many metrics - focus on 4-6 key figures');
  }
  
  // === FINANCIAL CREDIBILITY ===
  
  // Check for delta/comparison context
  const metricsWithDelta = config.executiveSummary.metrics?.filter(m => m.delta !== undefined) || [];
  if (metricsWithDelta.length === 0) {
    financialCredibility -= 2;
    issues.push('No comparative data - add WoW/MoM/YoY deltas');
  }
  
  // Check for proper labeling
  const metricsWithContext = config.executiveSummary.metrics?.filter(m => m.context || m.deltaLabel) || [];
  if (metricsWithContext.length < config.executiveSummary.metrics?.length / 2) {
    financialCredibility -= 1;
    issues.push('Metrics lack context - add labels explaining significance');
  }
  
  // === VISUAL PROFESSIONALISM ===
  
  // Must have title
  if (!config.title) {
    visualProfessionalism -= 3;
    issues.push('Missing report title');
  }
  
  // Report type should be clear
  if (!config.reportType) {
    visualProfessionalism -= 2;
    issues.push('Report type not specified');
  }
  
  // === DECISION USEFULNESS ===
  
  // Must have actionable insights
  if (!config.executiveSummary.insights || config.executiveSummary.insights.length === 0) {
    decisionUsefulness -= 4;
    issues.push('No insights provided - report is descriptive, not actionable');
  } else {
    const criticalInsights = config.executiveSummary.insights.filter(i => i.priority === 'critical' || i.priority === 'high');
    if (criticalInsights.length === 0) {
      decisionUsefulness -= 1;
      issues.push('No high-priority insights - unclear what needs attention');
    }
    
    const insightsWithActions = config.executiveSummary.insights.filter(i => i.action);
    if (insightsWithActions.length === 0) {
      decisionUsefulness -= 2;
      issues.push('Insights lack recommended actions');
    }
  }
  
  // Bottom line for executives
  if (!config.executiveSummary.bottomLine) {
    decisionUsefulness -= 1;
    issues.push('No bottom line statement - CFO needs clear conclusion');
  }

  const overall = (executiveClarity + financialCredibility + visualProfessionalism + decisionUsefulness) / 4;
  
  return {
    executiveClarity,
    financialCredibility,
    visualProfessionalism,
    decisionUsefulness,
    overall,
    passed: overall >= 9,
    issues,
  };
}

// ==================== REPORT CONTEXT ====================

export interface ReportContext {
  runDate: Date;
  reportPeriod: string;
  reportTime: string;
  weekNumber: number;
  quarter: number;
  fiscalYear: number;
  reportId: string;
  
  // Period detection
  isMonday: boolean;
  isFirstWeekOfMonth: boolean;
  isMonthEnd: boolean;
  isQuarterEnd: boolean;
  isYearEnd: boolean;
  
  // Comparison periods
  comparisons: {
    wow: { label: string; start: string; end: string };
    mom: { label: string; period: string };
    yoy: { label: string; period: string };
    qtd: { label: string; period: string };
    ytd: { label: string; period: string };
  };
}

export function getReportContext(): ReportContext {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const lastWeekStart = new Date(now);
  lastWeekStart.setDate(now.getDate() - 7);
  
  const lastMonthStart = new Date(now);
  lastMonthStart.setMonth(now.getMonth() - 1);
  
  const lastYearStart = new Date(now);
  lastYearStart.setFullYear(now.getFullYear() - 1);
  
  const quarterStartMonth = Math.floor(month / 3) * 3;
  const quarter = Math.floor(month / 3) + 1;
  
  // Fiscal year (assuming July start)
  const fiscalYear = month >= 6 ? year + 1 : year;
  
  // Calculate week number
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  
  // Generate unique report ID
  const reportId = `RPT-${format(now, 'yyyyMMdd')}-${format(now, 'HHmmss')}`;
  
  return {
    runDate: now,
    reportPeriod: format(now, 'MMMM d, yyyy'),
    reportTime: format(now, 'h:mm a'),
    weekNumber,
    quarter,
    fiscalYear,
    reportId,
    
    isMonday: dayOfWeek === 1,
    isFirstWeekOfMonth: dayOfMonth <= 7,
    isMonthEnd: dayOfMonth >= daysInMonth - 2,
    isQuarterEnd: [2, 5, 8, 11].includes(month) && dayOfMonth >= daysInMonth - 5,
    isYearEnd: month === 11 && dayOfMonth >= 25,
    
    comparisons: {
      wow: {
        label: 'vs Last Week',
        start: format(lastWeekStart, 'MMM d'),
        end: format(new Date(lastWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000), 'MMM d'),
      },
      mom: {
        label: 'vs Last Month',
        period: format(lastMonthStart, 'MMMM yyyy'),
      },
      yoy: {
        label: 'vs Prior Year',
        period: format(lastYearStart, 'MMMM yyyy'),
      },
      qtd: {
        label: 'Quarter to Date',
        period: `Q${quarter} ${year}`,
      },
      ytd: {
        label: 'Year to Date',
        period: `FY${fiscalYear}`,
      },
    },
  };
}

// ==================== PDF GENERATION HELPERS ====================

export interface PDFDrawContext {
  doc: any; // jsPDF instance
  pageWidth: number;
  pageHeight: number;
  margins: { left: number; right: number; top: number; bottom: number };
  y: number;
  context: ReportContext;
  config: ExecutiveReportConfig;
}

export function drawExecutiveHeader(ctx: PDFDrawContext): number {
  const { doc, pageWidth, config, context } = ctx;
  
  // Main header bar
  doc.setFillColor(...EXECUTIVE_COLORS.navy);
  doc.rect(0, 0, pageWidth, 32, 'F');
  
  // Accent line
  doc.setFillColor(...EXECUTIVE_COLORS.azure);
  doc.rect(0, 32, pageWidth, 2, 'F');
  
  // Report type badge
  const badgeColor = config.reportType === 'ALERT' ? EXECUTIVE_COLORS.danger :
                     config.reportType === 'DECISION' ? EXECUTIVE_COLORS.warning :
                     EXECUTIVE_COLORS.teal;
  doc.setFillColor(...badgeColor);
  doc.roundedRect(10, 6, 50, 12, 2, 2, 'F');
  doc.setTextColor(...EXECUTIVE_COLORS.white);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(config.reportType, 35, 14, { align: 'center' });
  
  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(config.title.toUpperCase(), 65, 15);
  
  // Subtitle / context
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const subtitle = config.subtitle || 
    (context.isMonday ? 'Weekly Status Report' :
     context.isQuarterEnd ? 'Quarter-End Analysis' :
     context.isMonthEnd ? 'Month-End Report' : 'Status Report');
  doc.text(`${subtitle} | ${context.reportPeriod}`, 65, 23);
  
  // Right side - timestamp and ID
  doc.setFontSize(7);
  doc.text(`${context.reportTime} | Week ${context.weekNumber} | Q${context.quarter}`, pageWidth - 10, 12, { align: 'right' });
  doc.text(`Report ID: ${context.reportId}`, pageWidth - 10, 20, { align: 'right' });
  
  // Classification
  if (config.classification) {
    doc.text(config.classification, pageWidth - 10, 28, { align: 'right' });
  }
  
  return 42; // Return new Y position
}

export function drawKPICard(
  ctx: PDFDrawContext,
  x: number, y: number, 
  width: number, height: number,
  metric: ExecutiveMetric
): void {
  const { doc } = ctx;
  
  // Card shadow
  doc.setFillColor(230, 230, 230);
  doc.roundedRect(x + 1, y + 1, width, height, 3, 3, 'F');
  
  // Card background
  doc.setFillColor(...EXECUTIVE_COLORS.white);
  doc.roundedRect(x, y, width, height, 3, 3, 'F');
  
  // Left accent bar
  const accentColor = metric.deltaDirection === 'positive' ? EXECUTIVE_COLORS.success :
                      metric.deltaDirection === 'negative' ? EXECUTIVE_COLORS.danger :
                      EXECUTIVE_COLORS.azure;
  doc.setFillColor(...accentColor);
  doc.rect(x, y + 3, 3, height - 6, 'F');
  
  // Label
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
  doc.text(metric.label.toUpperCase(), x + 8, y + 10);
  
  // Value
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
  const valueStr = typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value;
  doc.text(valueStr.toString(), x + 8, y + 22);
  
  // Delta / Context
  if (metric.delta !== undefined) {
    const deltaColor = metric.delta >= 0 ? EXECUTIVE_COLORS.success : EXECUTIVE_COLORS.danger;
    const arrow = metric.delta >= 0 ? '▲' : '▼';
    doc.setFontSize(7);
    doc.setTextColor(...deltaColor);
    doc.text(`${arrow} ${Math.abs(metric.delta).toFixed(1)}% ${metric.deltaLabel || ''}`, x + 8, y + 30);
  } else if (metric.context) {
    doc.setFontSize(7);
    doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
    doc.text(metric.context, x + 8, y + 30);
  }
}

export function drawInsightBox(
  ctx: PDFDrawContext,
  x: number, y: number,
  width: number,
  insights: ExecutiveInsight[]
): number {
  const { doc } = ctx;
  
  // Background
  doc.setFillColor(255, 250, 240);
  doc.roundedRect(x, y, width, 8 + insights.length * 14, 3, 3, 'F');
  
  // Border
  doc.setDrawColor(...EXECUTIVE_COLORS.warning);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, width, 8 + insights.length * 14, 3, 3, 'S');
  
  // Header
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.warning);
  doc.text('⚡ KEY INSIGHTS & RECOMMENDED ACTIONS', x + 5, y + 7);
  
  let insightY = y + 14;
  
  insights.forEach((insight, idx) => {
    // Priority indicator
    const priorityColor = insight.priority === 'critical' ? EXECUTIVE_COLORS.critical :
                          insight.priority === 'high' ? EXECUTIVE_COLORS.danger :
                          insight.priority === 'medium' ? EXECUTIVE_COLORS.warning :
                          EXECUTIVE_COLORS.azure;
    doc.setFillColor(...priorityColor);
    doc.circle(x + 8, insightY, 2, 'F');
    
    // Headline
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
    doc.text(insight.headline, x + 14, insightY + 1);
    
    // Action (if exists)
    if (insight.action) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
      doc.text(`→ ${insight.action}`, x + 14, insightY + 7);
      insightY += 14;
    } else {
      insightY += 10;
    }
  });
  
  return y + 8 + insights.length * 14 + 5;
}

export function drawExecutiveTable(
  ctx: PDFDrawContext,
  x: number, y: number,
  table: ExecutiveTable
): number {
  const { doc, pageWidth, margins } = ctx;
  const tableWidth = pageWidth - margins.left - margins.right;
  
  // Calculate column widths - first column gets more space for labels
  const numCols = table.headers.length;
  const firstColWidth = Math.min(tableWidth * 0.2, 35); // First col for labels
  const remainingWidth = tableWidth - firstColWidth - 10;
  const otherColWidth = remainingWidth / (numCols - 1);
  
  const getColX = (idx: number) => {
    if (idx === 0) return x + 3;
    return x + firstColWidth + ((idx - 1) * otherColWidth);
  };
  
  // Title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.navy);
  doc.text(table.title.toUpperCase(), x, y);
  y += 6;
  
  // Header row
  doc.setFillColor(...EXECUTIVE_COLORS.navy);
  doc.rect(x, y, tableWidth, 8, 'F');
  doc.setTextColor(...EXECUTIVE_COLORS.white);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  
  table.headers.forEach((header, idx) => {
    const colX = getColX(idx);
    doc.text(header, colX, y + 6);
  });
  y += 10;
  
  // Data rows
  doc.setFont('helvetica', 'normal');
  
  table.rows.forEach((row, rowIdx) => {
    // Row background
    if (row.highlight === 'total') {
      doc.setFillColor(...EXECUTIVE_COLORS.navy);
      doc.rect(x, y - 2, tableWidth, 8, 'F');
      doc.setTextColor(...EXECUTIVE_COLORS.white);
      doc.setFont('helvetica', 'bold');
    } else if (row.highlight === 'risk') {
      doc.setFillColor(254, 242, 242);
      doc.rect(x, y - 2, tableWidth, 8, 'F');
      doc.setTextColor(...EXECUTIVE_COLORS.danger);
    } else if (row.highlight === 'success') {
      doc.setFillColor(240, 253, 244);
      doc.rect(x, y - 2, tableWidth, 8, 'F');
      doc.setTextColor(...EXECUTIVE_COLORS.success);
    } else if (row.highlight === 'warning') {
      doc.setFillColor(255, 251, 235);
      doc.rect(x, y - 2, tableWidth, 8, 'F');
      doc.setTextColor(...EXECUTIVE_COLORS.warning);
    } else if (rowIdx % 2 === 0) {
      doc.setFillColor(250, 250, 252);
      doc.rect(x, y - 2, tableWidth, 8, 'F');
      doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
    } else {
      doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
    }
    
    doc.setFontSize(6);
    row.cells.forEach((cell, cellIdx) => {
      const colX = getColX(cellIdx);
      const cellStr = typeof cell === 'number' ? cell.toLocaleString() : cell.toString();
      // Truncate long text to prevent overlap
      const maxChars = cellIdx === 0 ? 12 : 10;
      const displayStr = cellStr.length > maxChars ? cellStr.slice(0, maxChars) + '..' : cellStr;
      doc.text(displayStr, colX, y + 4);
    });
    
    // Reset styles
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
    y += 8;
  });
  
  // Footnote
  if (table.footnote) {
    y += 2;
    doc.setFontSize(5);
    doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
    doc.text(table.footnote, x, y);
    y += 4;
  }
  
  return y + 5;
}

export function drawHorizontalBarChart(
  ctx: PDFDrawContext,
  x: number, y: number,
  width: number,
  chart: ExecutiveChart
): number {
  const { doc } = ctx;
  const maxValue = Math.max(...chart.data.map(d => d.value));
  const barHeight = 8;
  const spacing = 12;
  
  // Title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.navy);
  doc.text(chart.title.toUpperCase(), x, y);
  y += 8;
  
  chart.data.forEach((item, idx) => {
    // Label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
    doc.text(item.label, x, y + 5);
    
    // Bar background
    const barX = x + 35;
    const barWidth = width - 70;
    doc.setFillColor(...EXECUTIVE_COLORS.lightGray);
    doc.roundedRect(barX, y, barWidth, barHeight, 2, 2, 'F');
    
    // Bar value
    const valueWidth = (item.value / maxValue) * barWidth;
    const barColor = item.value > maxValue * 0.7 ? EXECUTIVE_COLORS.danger :
                     item.value > maxValue * 0.4 ? EXECUTIVE_COLORS.warning :
                     EXECUTIVE_COLORS.success;
    doc.setFillColor(...barColor);
    doc.roundedRect(barX, y, Math.max(valueWidth, 4), barHeight, 2, 2, 'F');
    
    // Value label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.value.toFixed(1)}%`, barX + barWidth + 5, y + 6);
    
    y += spacing;
  });
  
  return y + 5;
}

export function drawExecutiveFooter(ctx: PDFDrawContext, pageNum: number, totalPages: number): void {
  const { doc, pageWidth, pageHeight, context, config } = ctx;
  
  // Footer background
  doc.setFillColor(...EXECUTIVE_COLORS.lightGray);
  doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
  
  // Classification
  doc.setFontSize(6);
  doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
  doc.text(config.classification || 'CONFIDENTIAL - FOR INTERNAL USE ONLY', 10, pageHeight - 5);
  
  // Report metadata
  doc.text(
    `${context.reportId} | ${context.comparisons.wow.label} | ${context.comparisons.yoy.label}`,
    pageWidth / 2, pageHeight - 5, { align: 'center' }
  );
  
  // Page number
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 10, pageHeight - 5, { align: 'right' });
}

export function drawBottomLine(ctx: PDFDrawContext, x: number, y: number, width: number, text: string): number {
  const { doc } = ctx;
  
  // Box
  doc.setFillColor(240, 249, 255);
  doc.roundedRect(x, y, width, 18, 3, 3, 'F');
  doc.setDrawColor(...EXECUTIVE_COLORS.azure);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, width, 18, 3, 3, 'S');
  
  // Icon and label
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.navy);
  doc.text('📊 BOTTOM LINE:', x + 5, y + 8);
  
  // Text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
  doc.text(text, x + 45, y + 8);
  
  return y + 25;
}

// ==================== QUARTERLY DATA TABLE ====================

export function drawQuarterlyTable(
  ctx: PDFDrawContext,
  x: number, y: number,
  data: QuarterlyData[]
): number {
  const { doc, pageWidth, margins } = ctx;
  const tableWidth = pageWidth - margins.left - margins.right;
  
  // Title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.navy);
  doc.text('QUARTERLY EXPERT SPEND ANALYSIS (6 QUARTERS)', x, y);
  y += 6;
  
  // Headers
  const headers = ['Quarter', 'Paid', 'Monthly Avg', 'Approved', 'Monthly Avg', 'Variance'];
  const colWidths = [32, 28, 28, 28, 28, 28];
  
  doc.setFillColor(...EXECUTIVE_COLORS.navy);
  doc.rect(x, y, tableWidth, 8, 'F');
  doc.setTextColor(...EXECUTIVE_COLORS.white);
  doc.setFontSize(7);
  
  let colX = x + 2;
  headers.forEach((header, idx) => {
    doc.text(header, colX, y + 6);
    colX += colWidths[idx];
  });
  y += 10;
  
  // Data rows
  doc.setFont('helvetica', 'normal');
  let totalPaid = 0;
  let totalApproved = 0;
  
  data.forEach((row, rowIdx) => {
    totalPaid += row.paid;
    totalApproved += row.approved;
    
    // Alternating row background
    if (rowIdx % 2 === 0) {
      doc.setFillColor(250, 250, 252);
      doc.rect(x, y - 2, tableWidth, 8, 'F');
    }
    
    colX = x + 2;
    doc.setFontSize(7);
    
    // Quarter
    doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
    doc.text(row.quarter, colX, y + 4);
    colX += colWidths[0];
    
    // Paid
    doc.setTextColor(...EXECUTIVE_COLORS.success);
    doc.text(formatCurrency(row.paid, true), colX, y + 4);
    colX += colWidths[1];
    
    // Paid Monthly
    doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
    doc.text(formatCurrency(row.paidMonthly, true), colX, y + 4);
    colX += colWidths[2];
    
    // Approved
    doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
    doc.text(formatCurrency(row.approved, true), colX, y + 4);
    colX += colWidths[3];
    
    // Approved Monthly
    doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
    doc.text(formatCurrency(row.approvedMonthly, true), colX, y + 4);
    colX += colWidths[4];
    
    // Variance with color coding
    const varColor = row.variance >= 0 ? EXECUTIVE_COLORS.success : EXECUTIVE_COLORS.danger;
    doc.setTextColor(...varColor);
    doc.text(`${row.variance >= 0 ? '+' : ''}${formatCurrency(row.variance, true)}`, colX, y + 4);
    
    y += 8;
  });
  
  // Totals row
  doc.setFillColor(...EXECUTIVE_COLORS.navy);
  doc.rect(x, y - 2, tableWidth, 8, 'F');
  doc.setTextColor(...EXECUTIVE_COLORS.white);
  doc.setFont('helvetica', 'bold');
  
  colX = x + 2;
  doc.text('6Q TOTAL', colX, y + 4);
  colX += colWidths[0];
  doc.text(formatCurrency(totalPaid, true), colX, y + 4);
  colX += colWidths[1] + colWidths[2];
  doc.text(formatCurrency(totalApproved, true), colX, y + 4);
  colX += colWidths[3] + colWidths[4];
  const totalVariance = totalPaid - totalApproved;
  doc.text(`${totalVariance >= 0 ? '+' : ''}${formatCurrency(totalVariance, true)}`, colX, y + 4);
  
  return y + 12;
}

// ==================== APPENDIX SECTION ====================

export function drawAppendixSection(
  ctx: PDFDrawContext,
  x: number, y: number,
  section: AppendixSection
): number {
  const { doc, pageWidth, margins } = ctx;
  
  // Section title
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.navy);
  doc.text(section.title.toUpperCase(), x, y);
  y += 8;
  
  // Content text if present
  if (section.content) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
    const lines = doc.splitTextToSize(section.content, pageWidth - margins.left - margins.right);
    doc.text(lines, x, y);
    y += lines.length * 4 + 6;
  }
  
  // Table if present
  if (section.table) {
    y = drawExecutiveTable(ctx, x, y, section.table);
  }
  
  // Chart if present
  if (section.chart && section.chart.type === 'horizontalBar') {
    y = drawHorizontalBarChart(ctx, x, y, pageWidth - margins.left - margins.right, section.chart);
  }
  
  return y + 5;
}

// ==================== FULL REPORT GENERATOR ====================

export async function generateExecutiveReport(config: ExecutiveReportConfig): Promise<{ 
  success: boolean; 
  filename?: string; 
  qualityScore: QualityScore;
  blob?: Blob;
}> {
  // === QUALITY GATE ===
  const qualityScore = auditReportQuality(config);
  
  if (!qualityScore.passed) {
    console.warn('Report Quality Issues:', qualityScore.issues);
    // Continue but log warning - in production, could block
  }
  
  const { jsPDF } = await import('jspdf');
  const orientation = config.orientation || 'portrait';
  const doc = new jsPDF({ orientation });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const context = getReportContext();
  
  const ctx: PDFDrawContext = {
    doc,
    pageWidth,
    pageHeight,
    margins: { left: 10, right: 10, top: 10, bottom: 15 },
    y: 0,
    context,
    config,
  };
  
  // Helper to add new page with header
  const addNewPage = () => {
    doc.addPage();
    return drawExecutiveHeader(ctx);
  };
  
  // Helper to check if we need a new page
  const checkPageBreak = (neededSpace: number = 60) => {
    if (ctx.y > pageHeight - neededSpace) {
      ctx.y = addNewPage();
    }
  };
  
  // === PAGE 1: EXECUTIVE SUMMARY ===
  
  // Header
  ctx.y = drawExecutiveHeader(ctx);
  
  // Key Takeaway Box
  doc.setFillColor(...EXECUTIVE_COLORS.navy);
  doc.roundedRect(10, ctx.y, pageWidth - 20, 22, 3, 3, 'F');
  doc.setTextColor(...EXECUTIVE_COLORS.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('KEY TAKEAWAY', 15, ctx.y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  // Word wrap the key takeaway
  const maxWidth = pageWidth - 40;
  const lines = doc.splitTextToSize(config.executiveSummary.keyTakeaway, maxWidth);
  doc.text(lines.slice(0, 2), 15, ctx.y + 15);
  ctx.y += 28;
  
  // KPI Cards - 2 rows if more than 4 metrics
  const cardWidth = (pageWidth - 30) / Math.min(config.executiveSummary.metrics.length, 4);
  const cardHeight = 35;
  
  config.executiveSummary.metrics.slice(0, 4).forEach((metric, idx) => {
    drawKPICard(ctx, 10 + (idx * (cardWidth + 3)), ctx.y, cardWidth - 3, cardHeight, metric);
  });
  ctx.y += cardHeight + 8;
  
  // Second row of KPIs if needed
  if (config.executiveSummary.metrics.length > 4) {
    config.executiveSummary.metrics.slice(4, 8).forEach((metric, idx) => {
      drawKPICard(ctx, 10 + (idx * (cardWidth + 3)), ctx.y, cardWidth - 3, cardHeight, metric);
    });
    ctx.y += cardHeight + 8;
  }
  
  // Insights
  if (config.executiveSummary.insights && config.executiveSummary.insights.length > 0) {
    ctx.y = drawInsightBox(ctx, 10, ctx.y, pageWidth - 20, config.executiveSummary.insights.slice(0, 5));
  }
  
  // === PAGE 2+: QUARTERLY DATA (if present) ===
  if (config.quarterlyData && config.quarterlyData.length > 0) {
    checkPageBreak(100);
    ctx.y = drawQuarterlyTable(ctx, 10, ctx.y, config.quarterlyData);
  }
  
  // === TABLES ===
  if (config.tables) {
    config.tables.forEach(table => {
      checkPageBreak(60 + table.rows.length * 10);
      ctx.y = drawExecutiveTable(ctx, 10, ctx.y, table);
    });
  }
  
  // === CHARTS ===
  if (config.charts) {
    config.charts.forEach(chart => {
      checkPageBreak(80);
      if (chart.type === 'horizontalBar') {
        ctx.y = drawHorizontalBarChart(ctx, 10, ctx.y, pageWidth - 20, chart);
      }
    });
  }
  
  // === APPENDIX SECTIONS ===
  if (config.appendix && config.appendix.length > 0) {
    // Add appendix header on new page
    ctx.y = addNewPage();
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...EXECUTIVE_COLORS.navy);
    doc.text('APPENDIX: DETAILED ANALYSIS', 10, ctx.y);
    ctx.y += 12;
    
    config.appendix.forEach((section, idx) => {
      const estimatedHeight = 40 + 
        (section.table ? section.table.rows.length * 10 : 0) +
        (section.chart ? section.chart.data.length * 15 : 0);
      
      checkPageBreak(estimatedHeight);
      
      // Section number
      doc.setFontSize(9);
      doc.setTextColor(...EXECUTIVE_COLORS.azure);
      doc.text(`A${idx + 1}.`, 10, ctx.y);
      
      ctx.y = drawAppendixSection(ctx, 20, ctx.y, section);
    });
  }
  
  // Bottom Line (before footer)
  if (config.executiveSummary.bottomLine) {
    checkPageBreak(30);
    ctx.y = drawBottomLine(ctx, 10, ctx.y, pageWidth - 20, config.executiveSummary.bottomLine);
  }
  
  // Footer for all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawExecutiveFooter(ctx, i, totalPages);
  }
  
  // Generate filename
  const filename = `${config.reportType}-${config.title.replace(/\s+/g, '_')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  
  // Save
  doc.save(filename);
  
  return {
    success: true,
    filename,
    qualityScore,
    blob: doc.output('blob'),
  };
}

// ==================== UTILITY FUNCTIONS ====================

export function formatCurrency(value: number, compact: boolean = false): string {
  if (compact) {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function getDeltaDirection(delta: number): 'positive' | 'negative' | 'neutral' {
  if (delta > 0.5) return 'positive';
  if (delta < -0.5) return 'negative';
  return 'neutral';
}
