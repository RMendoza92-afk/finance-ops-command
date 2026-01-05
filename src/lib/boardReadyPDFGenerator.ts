/**
 * BOARD-READY EXECUTIVE PACKAGE GENERATOR
 * ========================================
 * This module generates STELLAR executive packages for CFO/CEO/COO review.
 * 
 * QUALITY STANDARD: Would a CFO trust this immediately?
 * RULE: If any output would not survive board review, REWRITE IT AUTOMATICALLY.
 * 
 * Every page must:
 * - State financial impact in first 10 seconds
 * - Make the decision obvious without explanation
 * - Be clean, tight, and defensible
 */

import { format } from 'date-fns';
import { 
  ExecutiveReportConfig,
  ExecutiveMetric,
  ExecutiveInsight,
  EXECUTIVE_COLORS,
  getReportContext,
  formatCurrency,
  formatPercent,
  getDeltaDirection,
  QuarterlyData
} from './executivePDFFramework';

// ==================== BOARD-READY TYPES ====================

export interface BoardReadySection {
  id: 'budget' | 'decisions' | 'cp1' | 'inventory';
  title: string;
  financialImpact: string;
  riskLevel: 'critical' | 'elevated' | 'stable' | 'favorable';
  keyMetric: { label: string; value: string; delta?: string };
  actionRequired: string;
  pageStart?: number;
}

export interface ExecutivePackageConfig {
  sections: BoardReadySection[];
  budgetData: BudgetAnalysis;
  decisionsData: DecisionQueue;
  cp1Data: CP1Analysis;
  quarterlyExpertData?: QuarterlyData[];
}

export interface BudgetAnalysis {
  annualBudget: number;
  ytdPaid: number;
  burnRate: number;
  remaining: number;
  projectedBurn: number;
  projectedVariance: number;
  onTrack: boolean;
  yoyChange: number;
  yoyChangePercent: number;
  coverageBreakdown: {
    bi: { name: string; ytd2025: number; ytd2024: number; change: number; claimCount2025: number; claimCount2024: number };
    cl: { name: string; ytd2025: number; ytd2024: number; change: number; claimCount2025: number; claimCount2024: number };
    oc: { name: string; ytd2025: number; ytd2024: number; change: number; claimCount2025: number; claimCount2024: number };
  };
  monthlyData: { month: string; budget: number; actual: number; variance: number }[];
}

export interface DecisionQueue {
  total: number;
  critical: number;
  thisWeek: number;
  statuteDeadlines: number;
  totalExposure: number;
  decisions: {
    matterId: string;
    claimant: string;
    amount: number;
    daysOpen: number;
    lead: string;
    severity: 'critical' | 'high' | 'medium';
    recommendedAction: string;
    department: string;
    type: string;
  }[];
}

export interface CP1Analysis {
  totalClaims: number;
  cp1Count: number;
  cp1Rate: string;
  biCP1Rate: string;
  byCoverage: { coverage: string; total: number; yes: number; noCP: number; cp1Rate: number }[];
  biByAge: { age: string; total: number; yes: number; noCP: number }[];
  biTotal: { total: number; yes: number; noCP: number };
  totals: { grandTotal: number; yes: number; noCP: number };
}

// ==================== BOARD-READY GENERATOR ====================

export async function generateBoardReadyPackage(config: ExecutivePackageConfig): Promise<{
  success: boolean;
  filename: string;
  pageCount: number;
}> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const ctx = getReportContext();
  
  let currentPage = 1;
  const margins = { left: 12, right: 12, top: 15, bottom: 20 };
  
  // Track section page numbers
  const sectionPages: Record<string, number> = {};
  
  // ====================================================================
  // PAGE 1: EXECUTIVE SUMMARY - THE ONLY PAGE MOST EXECUTIVES WILL READ
  // ====================================================================
  
  // Dark background for page 1
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  drawPageHeader(doc, pageWidth, 'EXECUTIVE COMMAND PACKAGE', 'Board-Level Summary', ctx);
  let y = 44;
  
  // CRITICAL BANNER: Financial Impact Statement
  const totalExposure = config.decisionsData.totalExposure + config.budgetData.ytdPaid;
  const criticalCount = config.decisionsData.critical;
  const budgetStatus = config.budgetData.onTrack ? 'ON TRACK' : 'REQUIRES ATTENTION';
  
  // Impact banner - dark red for critical, dark green for ok
  doc.setFillColor(criticalCount > 0 ? 60 : 15, criticalCount > 0 ? 20 : 35, criticalCount > 0 ? 20 : 25);
  doc.roundedRect(margins.left, y, pageWidth - margins.left - margins.right, 28, 3, 3, 'F');
  // Red or green accent border
  doc.setDrawColor(criticalCount > 0 ? 220 : 34, criticalCount > 0 ? 38 : 197, criticalCount > 0 ? 38 : 94);
  doc.setLineWidth(1);
  doc.roundedRect(margins.left, y, pageWidth - margins.left - margins.right, 28, 3, 3, 'S');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('FINANCIAL POSITION', margins.left + 8, y + 8);
  
  doc.setFontSize(14);
  doc.text(
    `${formatCurrency(totalExposure, true)} TOTAL EXPOSURE | ${criticalCount} CRITICAL ITEMS | BUDGET: ${budgetStatus}`,
    margins.left + 8, y + 20
  );
  y += 34;
  
  // 3-Column Executive KPIs
  const kpiWidth = (pageWidth - margins.left - margins.right - 16) / 3;
  const kpis = [
    {
      label: 'CLAIMS SPEND',
      value: formatCurrency(config.budgetData.ytdPaid, true),
      sub: `${config.budgetData.burnRate}% of budget`,
      status: config.budgetData.onTrack ? 'positive' : 'negative'
    },
    {
      label: 'PENDING DECISIONS',
      value: config.decisionsData.total.toString(),
      sub: `${config.decisionsData.critical} critical`,
      status: config.decisionsData.critical > 0 ? 'negative' : 'neutral'
    },
    {
      label: 'CP1 RATE',
      value: config.cp1Data.cp1Rate,
      sub: `${config.cp1Data.cp1Count.toLocaleString()} tendered`,
      status: parseFloat(config.cp1Data.cp1Rate) > 30 ? 'negative' : 'neutral'
    }
  ];
  
  kpis.forEach((kpi, idx) => {
    const x = margins.left + idx * (kpiWidth + 8);
    drawExecutiveKPI(doc, x, y, kpiWidth, 36, kpi);
  });
  y += 44;
  
  // EXECUTIVE DECISION MATRIX
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
  doc.text('EXECUTIVE DECISION MATRIX', margins.left, y);
  y += 6;
  
  // Decision matrix table
  const decisions = [
    {
      domain: 'BUDGET',
      status: config.budgetData.onTrack ? '✓ Good' : '⚠ Over',
      impact: formatCurrency(config.budgetData.projectedVariance, true),
      action: config.budgetData.onTrack ? 'Stay the course' : 'Review BI spend'
    },
    {
      domain: 'DECISIONS',
      status: config.decisionsData.critical > 0 ? `⚠ ${config.decisionsData.critical} Urgent` : '✓ Clear',
      impact: formatCurrency(config.decisionsData.totalExposure, true),
      action: config.decisionsData.critical > 0 ? 'Review today' : 'Routine'
    },
    {
      domain: 'LIMITS',
      status: parseFloat(config.cp1Data.cp1Rate) > 28 ? '⚠ High' : '✓ Normal',
      impact: `${config.cp1Data.cp1Count.toLocaleString()} claims`,
      action: parseFloat(config.cp1Data.cp1Rate) > 28 ? 'Check aged BI' : 'Monitor'
    }
  ];
  
  // Table header - dark red accent
  doc.setFillColor(...EXECUTIVE_COLORS.azure);
  doc.rect(margins.left, y, pageWidth - margins.left - margins.right, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  const colWidths = [35, 45, 50, 56];
  let colX = margins.left + 4;
  ['DOMAIN', 'STATUS', 'EXPOSURE/IMPACT', 'REQUIRED ACTION'].forEach((h, i) => {
    doc.text(h, colX, y + 6);
    colX += colWidths[i];
  });
  y += 10;
  
  // Table rows
  decisions.forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(25, 25, 25);
      doc.rect(margins.left, y - 2, pageWidth - margins.left - margins.right, 10, 'F');
    } else {
      doc.setFillColor(18, 18, 18);
      doc.rect(margins.left, y - 2, pageWidth - margins.left - margins.right, 10, 'F');
    }
    
    colX = margins.left + 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
    doc.text(row.domain, colX, y + 5);
    colX += colWidths[0];
    
    const statusColor = row.status.includes('✓') ? EXECUTIVE_COLORS.success : EXECUTIVE_COLORS.danger;
    doc.setTextColor(...statusColor);
    doc.text(row.status, colX, y + 5);
    colX += colWidths[1];
    
    doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
    doc.setFont('helvetica', 'normal');
    doc.text(row.impact, colX, y + 5);
    colX += colWidths[2];
    
    doc.setFont('helvetica', 'bold');
    doc.text(row.action, colX, y + 5);
    
    y += 10;
  });
  y += 8;
  
  // BOTTOM LINE - The CFO's 10-second read (dark theme with red accent)
  doc.setFillColor(25, 25, 25);
  doc.roundedRect(margins.left, y, pageWidth - margins.left - margins.right, 22, 3, 3, 'F');
  doc.setDrawColor(...EXECUTIVE_COLORS.azure);
  doc.setLineWidth(1);
  doc.roundedRect(margins.left, y, pageWidth - margins.left - margins.right, 22, 3, 3, 'S');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.azure);
  doc.text('CFO BOTTOM LINE:', margins.left + 5, y + 8);
  
  // Generate bottom line based on data - plain English, no jargon
  const bottomLine = generateCFOBottomLine(config);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
  const bottomLines = doc.splitTextToSize(bottomLine, pageWidth - margins.left - margins.right - 40);
  doc.text(bottomLines.slice(0, 2), margins.left + 45, y + 8);
  y += 28;
  
  // TABLE OF CONTENTS
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
  doc.text('DETAILED ANALYSIS', margins.left, y);
  y += 6;
  
  doc.setFillColor(18, 18, 18);
  doc.roundedRect(margins.left, y, pageWidth - margins.left - margins.right, 35, 2, 2, 'F');
  
  const tocItems = [
    { section: '1. BUDGET ANALYSIS', desc: 'Claims spend, coverage breakdown, YoY comparison', page: 2 },
    { section: '2. DECISION QUEUE', desc: 'Pending executive decisions, aging, exposure', page: 3 },
    { section: '3. CP1 LIMITS ANALYSIS', desc: 'Limits tendered by coverage and age', page: 4 },
    { section: '4. QUARTERLY TRENDS', desc: 'Expert spend, historical patterns', page: 5 }
  ];
  
  let tocY = y + 8;
  tocItems.forEach(item => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...EXECUTIVE_COLORS.azure);
    doc.text(item.section, margins.left + 5, tocY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
    doc.text(item.desc, margins.left + 60, tocY);
    doc.text(`Page ${item.page}`, pageWidth - margins.right - 20, tocY);
    tocY += 8;
  });
  
  // Page footer
  drawPageFooter(doc, pageWidth, pageHeight, currentPage, 5, ctx);
  
  // ====================================================================
  // PAGE 2: BUDGET ANALYSIS
  // ====================================================================
  doc.addPage();
  currentPage++;
  sectionPages['budget'] = currentPage;
  
  // Dark background
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  drawPageHeader(doc, pageWidth, 'BUDGET BURN RATE ANALYSIS', `FY${ctx.fiscalYear} Claims Payment Tracking`, ctx);
  y = 44;
  
  // Budget key takeaway - plain executive language
  const budgetTakeaway = config.budgetData.onTrack
    ? `We've spent ${formatCurrency(config.budgetData.ytdPaid, true)} year-to-date. We're on track to finish ${formatCurrency(config.budgetData.projectedVariance, true)} under budget.`
    : `We've spent ${formatCurrency(config.budgetData.ytdPaid, true)} year-to-date. At this pace, we'll be ${formatCurrency(Math.abs(config.budgetData.projectedVariance), true)} over budget by year-end.`;
  
  drawKeyTakeaway(doc, margins.left, y, pageWidth - margins.left - margins.right, budgetTakeaway, config.budgetData.onTrack ? 'positive' : 'negative');
  y += 26;
  
  // Budget metrics row - plain labels
  const budgetMetrics = [
    { label: 'ANNUAL BUDGET', value: formatCurrency(config.budgetData.annualBudget, true), sub: `FY${ctx.fiscalYear}` },
    { label: 'SPENT SO FAR', value: formatCurrency(config.budgetData.ytdPaid, true), sub: `${config.budgetData.yoyChangePercent >= 0 ? '+' : ''}${config.budgetData.yoyChangePercent.toFixed(1)}% vs last year` },
    { label: 'BURN RATE', value: `${config.budgetData.burnRate}%`, sub: 'of annual' },
    { label: 'LEFT TO SPEND', value: formatCurrency(config.budgetData.remaining, true), sub: config.budgetData.onTrack ? 'On track' : 'Tight' }
  ];
  
  const bkWidth = (pageWidth - margins.left - margins.right - 24) / 4;
  budgetMetrics.forEach((m, i) => {
    drawCompactKPI(doc, margins.left + i * (bkWidth + 8), y, bkWidth, 28, m);
  });
  y += 36;
  
  // Coverage breakdown table
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
  doc.text('COVERAGE BREAKDOWN - YoY COMPARISON', margins.left, y);
  y += 6;
  
  // Header - red accent
  doc.setFillColor(...EXECUTIVE_COLORS.azure);
  doc.rect(margins.left, y, pageWidth - margins.left - margins.right, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  const covCols = [40, 35, 35, 35, 35];
  colX = margins.left + 4;
  ['COVERAGE', '2024 YTD', '2025 YTD', 'CHANGE', 'IMPACT'].forEach((h, i) => {
    doc.text(h, colX, y + 6);
    colX += covCols[i];
  });
  y += 10;
  
  // Coverage rows
  const coverages = [
    { ...config.budgetData.coverageBreakdown.bi },
    { ...config.budgetData.coverageBreakdown.cl },
    { ...config.budgetData.coverageBreakdown.oc }
  ];
  
  coverages.forEach((cov, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(25, 25, 25);
      doc.rect(margins.left, y - 2, pageWidth - margins.left - margins.right, 10, 'F');
    } else {
      doc.setFillColor(18, 18, 18);
      doc.rect(margins.left, y - 2, pageWidth - margins.left - margins.right, 10, 'F');
    }
    
    colX = margins.left + 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
    doc.text(cov.name, colX, y + 5);
    colX += covCols[0];
    
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(cov.ytd2024, true), colX, y + 5);
    colX += covCols[1];
    doc.text(formatCurrency(cov.ytd2025, true), colX, y + 5);
    colX += covCols[2];
    
    const changeColor = cov.change > 0 ? EXECUTIVE_COLORS.danger : EXECUTIVE_COLORS.success;
    doc.setTextColor(...changeColor);
    doc.text(`${cov.change >= 0 ? '+' : ''}${formatCurrency(cov.change, true)}`, colX, y + 5);
    colX += covCols[3];
    
    const impact = cov.change > 20000000 ? 'FIX NOW' : cov.change > 0 ? 'WATCH' : 'GOOD';
    doc.text(impact, colX, y + 5);
    
    y += 10;
  });
  
  // Total row
  const totalYtd2024 = coverages.reduce((s, c) => s + c.ytd2024, 0);
  const totalYtd2025 = coverages.reduce((s, c) => s + c.ytd2025, 0);
  const totalChange = totalYtd2025 - totalYtd2024;
  
  // Total row - red accent
  doc.setFillColor(...EXECUTIVE_COLORS.azure);
  doc.rect(margins.left, y - 2, pageWidth - margins.left - margins.right, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  colX = margins.left + 4;
  doc.text('TOTAL', colX, y + 5);
  colX += covCols[0];
  doc.text(formatCurrency(totalYtd2024, true), colX, y + 5);
  colX += covCols[1];
  doc.text(formatCurrency(totalYtd2025, true), colX, y + 5);
  colX += covCols[2];
  doc.text(`${totalChange >= 0 ? '+' : ''}${formatCurrency(totalChange, true)}`, colX, y + 5);
  y += 16;
  
  // Budget insight (dark theme with amber accent border)
  doc.setFillColor(30, 27, 18);
  doc.roundedRect(margins.left, y, pageWidth - margins.left - margins.right, 20, 2, 2, 'F');
  doc.setDrawColor(...EXECUTIVE_COLORS.warning);
  doc.setLineWidth(0.5);
  doc.roundedRect(margins.left, y, pageWidth - margins.left - margins.right, 20, 2, 2, 'S');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.warning);
  doc.text('WHY:', margins.left + 4, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
  const biPct = ((config.budgetData.coverageBreakdown.bi.change / totalChange) * 100).toFixed(0);
  const biClaimDiff = config.budgetData.coverageBreakdown.bi.claimCount2025 - config.budgetData.coverageBreakdown.bi.claimCount2024;
  doc.text(`BI is ${biPct}% of the increase. We're seeing ${biClaimDiff.toLocaleString()} more BI claims than last year.`, margins.left + 22, y + 8);
  doc.text('Next step: Dig into BI severity and litigation to find what changed.', margins.left + 4, y + 16);
  
  drawPageFooter(doc, pageWidth, pageHeight, currentPage, 5, ctx);
  
  // ====================================================================
  // PAGE 3: DECISION QUEUE
  // ====================================================================
  doc.addPage();
  currentPage++;
  sectionPages['decisions'] = currentPage;
  
  // Dark background
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  drawPageHeader(doc, pageWidth, 'PENDING EXECUTIVE DECISIONS', `${config.decisionsData.critical} Critical Items Require Immediate Action`, ctx);
  y = 44;
  
  // Decision takeaway - plain executive language
  const decisionTakeaway = config.decisionsData.critical > 0
    ? `${config.decisionsData.total} matters need your sign-off, worth ${formatCurrency(config.decisionsData.totalExposure, true)}. ${config.decisionsData.critical} are urgent. ${config.decisionsData.thisWeek} are due this week.`
    : `${config.decisionsData.total} matters need your sign-off, worth ${formatCurrency(config.decisionsData.totalExposure, true)}. Nothing urgent right now.`;
  
  drawKeyTakeaway(doc, margins.left, y, pageWidth - margins.left - margins.right, decisionTakeaway, config.decisionsData.critical > 0 ? 'negative' : 'neutral');
  y += 26;
  
  // Decision metrics - plain labels
  const decMetrics = [
    { label: 'PENDING', value: config.decisionsData.total.toString(), sub: 'total' },
    { label: 'URGENT', value: config.decisionsData.critical.toString(), sub: 'need action now' },
    { label: 'DUE THIS WEEK', value: config.decisionsData.thisWeek.toString(), sub: 'next 7 days' },
    { label: 'MONEY AT STAKE', value: formatCurrency(config.decisionsData.totalExposure, true), sub: 'total exposure' }
  ];
  
  decMetrics.forEach((m, i) => {
    drawCompactKPI(doc, margins.left + i * (bkWidth + 8), y, bkWidth, 28, m);
  });
  y += 36;
  
  // Critical decisions table (top 15)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
  doc.text('DECISION QUEUE - BY PRIORITY', margins.left, y);
  y += 6;
  
  // Header - red accent
  doc.setFillColor(...EXECUTIVE_COLORS.azure);
  doc.rect(margins.left, y, pageWidth - margins.left - margins.right, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6);
  const decCols = [28, 42, 28, 22, 30, 36];
  colX = margins.left + 3;
  ['MATTER', 'CLAIMANT', 'LEAD', 'DAYS', 'EXPOSURE', 'ACTION'].forEach((h, i) => {
    doc.text(h, colX, y + 6);
    colX += decCols[i];
  });
  y += 10;
  
  // Decision rows (top 15)
  const topDecisions = config.decisionsData.decisions.slice(0, 15);
  topDecisions.forEach((dec, idx) => {
    const rowColor = dec.severity === 'critical' ? [50, 20, 20] :
                     dec.severity === 'high' ? [45, 35, 15] :
                     idx % 2 === 0 ? [25, 25, 25] : [18, 18, 18];
    doc.setFillColor(rowColor[0], rowColor[1], rowColor[2]);
    doc.rect(margins.left, y - 2, pageWidth - margins.left - margins.right, 8, 'F');
    
    colX = margins.left + 3;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
    
    doc.text(dec.matterId.substring(0, 12), colX, y + 4);
    colX += decCols[0];
    doc.text(dec.claimant.substring(0, 18), colX, y + 4);
    colX += decCols[1];
    doc.text(dec.lead.substring(0, 12), colX, y + 4);
    colX += decCols[2];
    doc.text(dec.daysOpen.toString(), colX, y + 4);
    colX += decCols[3];
    
    const expColor = dec.amount >= 1000000 ? EXECUTIVE_COLORS.danger : EXECUTIVE_COLORS.textPrimary;
    doc.setTextColor(...expColor);
    doc.text(formatCurrency(dec.amount, true), colX, y + 4);
    colX += decCols[4];
    
    doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
    doc.text(dec.recommendedAction.substring(0, 20), colX, y + 4);
    
    y += 8;
  });
  
  if (config.decisionsData.decisions.length > 15) {
    y += 2;
    doc.setFontSize(7);
    doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
    doc.text(`+ ${config.decisionsData.decisions.length - 15} additional decisions (see appendix)`, margins.left, y);
  }
  
  drawPageFooter(doc, pageWidth, pageHeight, currentPage, 5, ctx);
  
  // ====================================================================
  // PAGE 4: CP1 LIMITS ANALYSIS
  // ====================================================================
  doc.addPage();
  currentPage++;
  sectionPages['cp1'] = currentPage;
  
  // Dark background
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  drawPageHeader(doc, pageWidth, 'CP1 LIMITS TENDERED ANALYSIS', 'Policy Limits Exposure by Coverage and Age', ctx);
  y = 44;
  
  // CP1 takeaway - plain executive language
  const cp1Takeaway = `${config.cp1Data.cp1Count.toLocaleString()} claims have hit policy limits (${config.cp1Data.cp1Rate} of our book). Bodily injury is the driver at ${config.cp1Data.biCP1Rate}. Oldest claims are the biggest problem.`;
  
  drawKeyTakeaway(doc, margins.left, y, pageWidth - margins.left - margins.right, cp1Takeaway, parseFloat(config.cp1Data.cp1Rate) > 28 ? 'negative' : 'neutral');
  y += 26;
  
  // CP1 metrics - plain labels
  const cp1Metrics = [
    { label: 'OPEN CLAIMS', value: config.cp1Data.totalClaims.toLocaleString(), sub: 'total book' },
    { label: 'AT LIMITS', value: config.cp1Data.cp1Count.toLocaleString(), sub: 'maxed out' },
    { label: 'LIMITS RATE', value: config.cp1Data.cp1Rate, sub: 'of book' },
    { label: 'BI RATE', value: config.cp1Data.biCP1Rate, sub: 'biggest driver' }
  ];
  
  cp1Metrics.forEach((m, i) => {
    drawCompactKPI(doc, margins.left + i * (bkWidth + 8), y, bkWidth, 28, m);
  });
  y += 36;
  
  // CP1 by Coverage table
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
  doc.text('CP1 RATE BY COVERAGE TYPE', margins.left, y);
  y += 6;
  
  // Header - red accent
  doc.setFillColor(...EXECUTIVE_COLORS.azure);
  doc.rect(margins.left, y, pageWidth - margins.left - margins.right, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  const cp1Cols = [35, 30, 30, 30, 35, 26];
  colX = margins.left + 4;
  ['COVERAGE', 'TOTAL', 'CP1', 'NO CP', 'CP1 RATE', 'SHARE'].forEach((h, i) => {
    doc.text(h, colX, y + 6);
    colX += cp1Cols[i];
  });
  y += 10;
  
  // Coverage rows
  config.cp1Data.byCoverage.forEach((cov, idx) => {
    const rowColor = cov.cp1Rate > 40 ? [50, 20, 20] :
                     cov.cp1Rate > 30 ? [45, 35, 15] :
                     idx % 2 === 0 ? [25, 25, 25] : [18, 18, 18];
    doc.setFillColor(rowColor[0], rowColor[1], rowColor[2]);
    doc.rect(margins.left, y - 2, pageWidth - margins.left - margins.right, 9, 'F');
    
    colX = margins.left + 4;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
    doc.text(cov.coverage, colX, y + 5);
    colX += cp1Cols[0];
    
    doc.setFont('helvetica', 'normal');
    doc.text(cov.total.toLocaleString(), colX, y + 5);
    colX += cp1Cols[1];
    doc.text(cov.yes.toLocaleString(), colX, y + 5);
    colX += cp1Cols[2];
    doc.text(cov.noCP.toLocaleString(), colX, y + 5);
    colX += cp1Cols[3];
    
    const rateColor = cov.cp1Rate > 40 ? EXECUTIVE_COLORS.danger :
                      cov.cp1Rate > 30 ? EXECUTIVE_COLORS.warning :
                      EXECUTIVE_COLORS.success;
    doc.setTextColor(...rateColor);
    doc.setFont('helvetica', 'bold');
    doc.text(`${cov.cp1Rate}%`, colX, y + 5);
    colX += cp1Cols[4];
    
    doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
    doc.setFont('helvetica', 'normal');
    const share = ((cov.yes / config.cp1Data.totals.yes) * 100).toFixed(1);
    doc.text(`${share}%`, colX, y + 5);
    
    y += 9;
  });
  
  // Total row - red accent
  doc.setFillColor(...EXECUTIVE_COLORS.azure);
  doc.rect(margins.left, y - 2, pageWidth - margins.left - margins.right, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  colX = margins.left + 4;
  doc.text('TOTAL', colX, y + 5);
  colX += cp1Cols[0];
  doc.text(config.cp1Data.totals.grandTotal.toLocaleString(), colX, y + 5);
  colX += cp1Cols[1];
  doc.text(config.cp1Data.totals.yes.toLocaleString(), colX, y + 5);
  colX += cp1Cols[2];
  doc.text(config.cp1Data.totals.noCP.toLocaleString(), colX, y + 5);
  colX += cp1Cols[3];
  doc.text(config.cp1Data.cp1Rate, colX, y + 5);
  colX += cp1Cols[4];
  doc.text('100%', colX, y + 5);
  y += 14;
  
  // BI by Age section
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
  doc.text('BODILY INJURY CP1 BY CLAIM AGE', margins.left, y);
  y += 6;
  
  // BI Age header - red accent
  doc.setFillColor(...EXECUTIVE_COLORS.azure);
  doc.rect(margins.left, y, pageWidth - margins.left - margins.right, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  const biAgeCols = [45, 35, 35, 35, 36];
  colX = margins.left + 4;
  ['AGE BUCKET', 'NO CP', 'CP1 YES', 'TOTAL', 'CP1 RATE'].forEach((h, i) => {
    doc.text(h, colX, y + 6);
    colX += biAgeCols[i];
  });
  y += 10;
  
  // BI Age rows
  config.cp1Data.biByAge.forEach((age, idx) => {
    const cp1Rate = (age.yes / age.total) * 100;
    const rowColor = age.age === '365+ Days' ? [50, 20, 20] :
                     idx % 2 === 0 ? [25, 25, 25] : [18, 18, 18];
    doc.setFillColor(rowColor[0], rowColor[1], rowColor[2]);
    doc.rect(margins.left, y - 2, pageWidth - margins.left - margins.right, 9, 'F');
    
    colX = margins.left + 4;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
    doc.text(age.age, colX, y + 5);
    colX += biAgeCols[0];
    
    doc.setFont('helvetica', 'normal');
    doc.text(age.noCP.toLocaleString(), colX, y + 5);
    colX += biAgeCols[1];
    doc.text(age.yes.toLocaleString(), colX, y + 5);
    colX += biAgeCols[2];
    doc.text(age.total.toLocaleString(), colX, y + 5);
    colX += biAgeCols[3];
    
    const rateColor = cp1Rate > 40 ? EXECUTIVE_COLORS.danger :
                      cp1Rate > 30 ? EXECUTIVE_COLORS.warning :
                      EXECUTIVE_COLORS.success;
    doc.setTextColor(...rateColor);
    doc.setFont('helvetica', 'bold');
    doc.text(`${cp1Rate.toFixed(1)}%`, colX, y + 5);
    
    y += 9;
  });
  
  // BI Total - red accent
  doc.setFillColor(...EXECUTIVE_COLORS.azure);
  doc.rect(margins.left, y - 2, pageWidth - margins.left - margins.right, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  colX = margins.left + 4;
  doc.text('BI TOTAL', colX, y + 5);
  colX += biAgeCols[0];
  doc.text(config.cp1Data.biTotal.noCP.toLocaleString(), colX, y + 5);
  colX += biAgeCols[1];
  doc.text(config.cp1Data.biTotal.yes.toLocaleString(), colX, y + 5);
  colX += biAgeCols[2];
  doc.text(config.cp1Data.biTotal.total.toLocaleString(), colX, y + 5);
  colX += biAgeCols[3];
  doc.text(config.cp1Data.biCP1Rate, colX, y + 5);
  
  drawPageFooter(doc, pageWidth, pageHeight, currentPage, 5, ctx);
  
  // ====================================================================
  // PAGE 5: QUARTERLY TRENDS
  // ====================================================================
  if (config.quarterlyExpertData && config.quarterlyExpertData.length > 0) {
    doc.addPage();
    currentPage++;
    sectionPages['quarterly'] = currentPage;
    
    // Dark background
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    drawPageHeader(doc, pageWidth, 'QUARTERLY TREND ANALYSIS', 'Expert Spend & Historical Patterns', ctx);
    y = 44;
    
    // Quarterly data table
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
    doc.text('EXPERT SPEND - 7 QUARTER TREND', margins.left, y);
    y += 6;
    
    // Header - red accent
    doc.setFillColor(...EXECUTIVE_COLORS.azure);
    doc.rect(margins.left, y, pageWidth - margins.left - margins.right, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    const qCols = [32, 32, 32, 32, 32, 26];
    colX = margins.left + 4;
    ['QUARTER', 'PAID', 'MONTHLY AVG', 'APPROVED', 'MONTHLY AVG', 'VARIANCE'].forEach((h, i) => {
      doc.text(h, colX, y + 6);
      colX += qCols[i];
    });
    y += 10;
    
    let totalPaid = 0;
    let totalApproved = 0;
    
    config.quarterlyExpertData.forEach((q, idx) => {
      totalPaid += q.paid;
      totalApproved += q.approved;
      
      if (idx % 2 === 0) {
        doc.setFillColor(25, 25, 25);
        doc.rect(margins.left, y - 2, pageWidth - margins.left - margins.right, 9, 'F');
      } else {
        doc.setFillColor(18, 18, 18);
        doc.rect(margins.left, y - 2, pageWidth - margins.left - margins.right, 9, 'F');
      }
      
      colX = margins.left + 4;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
      doc.text(q.quarter, colX, y + 5);
      colX += qCols[0];
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...EXECUTIVE_COLORS.success);
      doc.text(formatCurrency(q.paid, true), colX, y + 5);
      colX += qCols[1];
      
      doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
      doc.text(formatCurrency(q.paidMonthly, true), colX, y + 5);
      colX += qCols[2];
      
      doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
      doc.text(formatCurrency(q.approved, true), colX, y + 5);
      colX += qCols[3];
      
      doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
      doc.text(formatCurrency(q.approvedMonthly, true), colX, y + 5);
      colX += qCols[4];
      
      const varColor = q.variance >= 0 ? EXECUTIVE_COLORS.success : EXECUTIVE_COLORS.danger;
      doc.setTextColor(...varColor);
      doc.text(`${q.variance >= 0 ? '+' : ''}${formatCurrency(q.variance, true)}`, colX, y + 5);
      
      y += 9;
    });
    
    // Total row - red accent
    doc.setFillColor(...EXECUTIVE_COLORS.azure);
    doc.rect(margins.left, y - 2, pageWidth - margins.left - margins.right, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    colX = margins.left + 4;
    doc.text('7Q TOTAL', colX, y + 5);
    colX += qCols[0];
    doc.text(formatCurrency(totalPaid, true), colX, y + 5);
    colX += qCols[1] + qCols[2];
    doc.text(formatCurrency(totalApproved, true), colX, y + 5);
    colX += qCols[3] + qCols[4];
    doc.text(`${totalPaid - totalApproved >= 0 ? '+' : ''}${formatCurrency(totalPaid - totalApproved, true)}`, colX, y + 5);
    
    drawPageFooter(doc, pageWidth, pageHeight, currentPage, 5, ctx);
  }
  
  // Save the document
  const filename = `Executive_Package_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`;
  doc.save(filename);
  
  return {
    success: true,
    filename,
    pageCount: currentPage
  };
}

// ==================== HELPER FUNCTIONS ====================

function drawPageHeader(doc: any, pageWidth: number, title: string, subtitle: string, ctx: any) {
  // Header bar - black background
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, 30, 'F');
  
  // Accent line
  doc.setFillColor(...EXECUTIVE_COLORS.azure);
  doc.rect(0, 30, pageWidth, 2, 'F');
  
  // Report type badge
  doc.setFillColor(...EXECUTIVE_COLORS.teal);
  doc.roundedRect(10, 6, 45, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('EXECUTIVE', 32.5, 13, { align: 'center' });
  
  // Title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 60, 14);
  
  // Subtitle
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 60, 22);
  
  // Right side
  doc.setFontSize(7);
  doc.text(`${ctx.reportPeriod} | ${ctx.reportTime}`, pageWidth - 10, 12, { align: 'right' });
  doc.text(`Q${ctx.quarter} FY${ctx.fiscalYear} | Week ${ctx.weekNumber}`, pageWidth - 10, 20, { align: 'right' });
}

function drawPageFooter(doc: any, pageWidth: number, pageHeight: number, pageNum: number, totalPages: number, ctx: any) {
  // Dark footer
  doc.setFillColor(12, 12, 12);
  doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
  
  doc.setFontSize(6);
  doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
  doc.text('CONFIDENTIAL - FOR INTERNAL EXECUTIVE USE ONLY', 10, pageHeight - 5);
  doc.text(`Fred Loya Insurance | ${ctx.reportId}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 10, pageHeight - 5, { align: 'right' });
}

function drawKeyTakeaway(doc: any, x: number, y: number, width: number, text: string, status: 'positive' | 'negative' | 'neutral') {
  // Dark themed backgrounds with subtle color tints
  const bgColor = status === 'positive' ? [15, 35, 25] :      // Dark green tint
                  status === 'negative' ? [40, 18, 18] :       // Dark red tint
                  [25, 25, 25];                                 // Neutral dark
  const accentColor = status === 'positive' ? EXECUTIVE_COLORS.success :
                      status === 'negative' ? EXECUTIVE_COLORS.danger :
                      EXECUTIVE_COLORS.azure;
  
  doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
  doc.roundedRect(x, y, width, 20, 3, 3, 'F');
  doc.setFillColor(...accentColor);
  doc.rect(x, y + 3, 4, 14, 'F');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text('KEY TAKEAWAY:', x + 8, y + 8);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
  const lines = doc.splitTextToSize(text, width - 50);
  doc.text(lines.slice(0, 2), x + 45, y + 8);
}

function drawExecutiveKPI(doc: any, x: number, y: number, width: number, height: number, data: { label: string; value: string; sub: string; status: string }) {
  // Dark card with subtle border
  doc.setFillColor(18, 18, 18);
  doc.roundedRect(x, y, width, height, 3, 3, 'F');
  
  // Accent left border
  const accentColor = data.status === 'positive' ? EXECUTIVE_COLORS.success :
                      data.status === 'negative' ? EXECUTIVE_COLORS.danger :
                      EXECUTIVE_COLORS.azure;
  doc.setFillColor(...accentColor);
  doc.rect(x, y + 4, 3, height - 8, 'F');
  
  // Label
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
  doc.text(data.label, x + 8, y + 10);
  
  // Value - white on dark
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
  doc.text(data.value, x + 8, y + 22);
  
  // Sub
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
  doc.text(data.sub, x + 8, y + 30);
}

function drawCompactKPI(doc: any, x: number, y: number, width: number, height: number, data: { label: string; value: string; sub: string }) {
  // Dark compact card
  doc.setFillColor(25, 25, 25);
  doc.roundedRect(x, y, width, height, 2, 2, 'F');
  
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
  doc.text(data.label, x + 4, y + 8);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
  doc.text(data.value, x + 4, y + 18);
  
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
  doc.text(data.sub, x + 4, y + 24);
}

function generateCFOBottomLine(config: ExecutivePackageConfig): string {
  const issues: string[] = [];
  const positives: string[] = [];
  
  // Budget assessment - plain language
  if (!config.budgetData.onTrack) {
    issues.push(`we're heading ${formatCurrency(Math.abs(config.budgetData.projectedVariance), true)} over budget`);
  } else {
    positives.push(`budget looks good with ${formatCurrency(config.budgetData.projectedVariance, true)} cushion`);
  }
  
  // Decisions assessment
  if (config.decisionsData.critical > 0) {
    issues.push(`${config.decisionsData.critical} items need your attention today`);
  }
  
  // CP1 assessment
  if (parseFloat(config.cp1Data.cp1Rate) > 28) {
    issues.push(`too many claims hitting limits (${config.cp1Data.cp1Rate})`);
  }
  
  if (issues.length === 0) {
    return `Things are running clean. ${positives.join('. ')}. Nothing needs your attention right now.`;
  } else if (issues.length === 1) {
    return `One thing to watch: ${issues[0]}. ${positives.length > 0 ? positives.join('. ') + '.' : ''}`;
  } else {
    return `A few things need attention: ${issues.join('; ')}. Worth 15 minutes this week.`;
  }
}
