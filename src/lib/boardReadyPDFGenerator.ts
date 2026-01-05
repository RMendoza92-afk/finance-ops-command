/**
 * CEO CONTROL INSTRUMENT - FRED LOYA JR.
 * Power BI Executive Format - Clean, High-Impact, No Clutter
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

// ==================== POWER BI COLORS ====================
const POWER_BI = {
  background: [15, 23, 42] as [number, number, number],      // Dark slate
  card: [30, 41, 59] as [number, number, number],            // Slate card
  cardLight: [51, 65, 85] as [number, number, number],       // Lighter card
  accent: [59, 130, 246] as [number, number, number],        // Blue
  success: [34, 197, 94] as [number, number, number],        // Green
  danger: [239, 68, 68] as [number, number, number],         // Red
  warning: [251, 191, 36] as [number, number, number],       // Amber
  textWhite: [255, 255, 255] as [number, number, number],
  textMuted: [148, 163, 184] as [number, number, number],    // Slate 400
  textDim: [100, 116, 139] as [number, number, number],      // Slate 500
};

// ==================== MAIN GENERATOR ====================

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
  const margins = { left: 14, right: 14, top: 16, bottom: 16 };
  const contentWidth = pageWidth - margins.left - margins.right;
  const totalPages = config.quarterlyExpertData && config.quarterlyExpertData.length > 0 ? 5 : 4;
  
  // ====================================================================
  // PAGE 1: CEO CONTROL PANEL
  // ====================================================================
  
  drawBackground(doc, pageWidth, pageHeight);
  drawPowerBIHeader(doc, pageWidth, 'CEO WEEKLY CONTROL', ctx);
  let y = 48;

  const ceo = buildCEOControlPanel(config);

  // STATUS BANNER - Large readable text
  const bannerColor = ceo.band === 'FAIL' ? POWER_BI.danger : ceo.band === 'WARN' ? POWER_BI.warning : POWER_BI.success;
  doc.setFillColor(...bannerColor);
  doc.roundedRect(margins.left, y, contentWidth, 32, 4, 4, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(ceo.statusLabel, pageWidth / 2, y + 14, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(ceo.statusDetail, pageWidth / 2, y + 26, { align: 'center' });
  y += 42;

  // THE 3 CONTROL QUESTIONS - Large type, simple layout
  const questions = [
    { num: '1', q: 'ARE WE IN CONTROL', a: ceo.controlAnswer, color: ceo.controlColor },
    { num: '2', q: 'WHERE IS IT BREAKING', a: ceo.breakAnswer, color: ceo.breakColor },
    { num: '3', q: 'ACTION THIS WEEK', a: ceo.actionAnswer, color: ceo.actionColor },
  ];

  questions.forEach((item) => {
    doc.setFillColor(...POWER_BI.card);
    doc.roundedRect(margins.left, y, contentWidth, 38, 3, 3, 'F');
    
    // Left accent bar
    doc.setFillColor(...item.color);
    doc.rect(margins.left, y + 6, 5, 26, 'F');
    
    // Question number and text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...POWER_BI.textMuted);
    doc.text(`${item.num}. ${item.q}`, margins.left + 12, y + 14);
    
    // Answer - BIG and CLEAR
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...POWER_BI.textWhite);
    const answerLines = doc.splitTextToSize(item.a, contentWidth - 20) as string[];
    doc.text(answerLines[0] || '', margins.left + 12, y + 28);
    
    y += 44;
  });

  // BOTTOM LINE
  y += 4;
  doc.setFillColor(...POWER_BI.cardLight);
  doc.roundedRect(margins.left, y, contentWidth, 28, 3, 3, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...POWER_BI.textMuted);
  doc.text('CHIEF OF STAFF', margins.left + 8, y + 11);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...POWER_BI.textWhite);
  doc.text(ceo.bottomLine, margins.left + 8, y + 22);

  drawPowerBIFooter(doc, pageWidth, pageHeight, currentPage, totalPages, ctx);
  
  // ====================================================================
  // PAGE 2: BUDGET
  // ====================================================================
  doc.addPage();
  currentPage++;
  
  drawBackground(doc, pageWidth, pageHeight);
  drawPowerBIHeader(doc, pageWidth, 'BUDGET BURN', ctx);
  y = 48;
  
  // Status bar
  const budgetOK = config.budgetData.onTrack;
  const budgetStatus = budgetOK ? 'ON TRACK' : 'OVER BUDGET';
  const budgetColor = budgetOK ? POWER_BI.success : POWER_BI.danger;
  
  doc.setFillColor(...budgetColor);
  doc.roundedRect(margins.left, y, contentWidth, 24, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(budgetStatus, pageWidth / 2, y + 16, { align: 'center' });
  y += 32;

  // KPI Row - 4 big numbers
  const budgetKPIs = [
    { label: 'BUDGET', value: formatCurrency(config.budgetData.annualBudget, true) },
    { label: 'SPENT', value: formatCurrency(config.budgetData.ytdPaid, true) },
    { label: 'BURN RATE', value: `${config.budgetData.burnRate}%` },
    { label: 'REMAINING', value: formatCurrency(config.budgetData.remaining, true) },
  ];
  
  const kpiWidth = (contentWidth - 18) / 4;
  budgetKPIs.forEach((kpi, i) => {
    const kx = margins.left + i * (kpiWidth + 6);
    drawBigKPI(doc, kx, y, kpiWidth, 44, kpi.label, kpi.value);
  });
  y += 54;

  // DRIVERS section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...POWER_BI.textWhite);
  doc.text('TOP DRIVERS', margins.left, y);
  y += 10;

  const drivers = [
    { label: 'BI', change: config.budgetData.coverageBreakdown.bi.change },
    { label: 'CL', change: config.budgetData.coverageBreakdown.cl.change },
    { label: 'OC', change: config.budgetData.coverageBreakdown.oc.change },
  ].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  drivers.forEach((d) => {
    const isUp = d.change > 0;
    doc.setFillColor(...POWER_BI.card);
    doc.roundedRect(margins.left, y, contentWidth, 20, 2, 2, 'F');
    
    doc.setFillColor(...(isUp ? POWER_BI.danger : POWER_BI.success));
    doc.rect(margins.left, y + 4, 4, 12, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...POWER_BI.textWhite);
    doc.text(d.label, margins.left + 12, y + 14);
    
    doc.setTextColor(...(isUp ? POWER_BI.danger : POWER_BI.success));
    doc.text(`${isUp ? '+' : ''}${formatCurrency(d.change, true)}`, margins.left + 40, y + 14);
    
    y += 26;
  });

  // ORDER
  y += 6;
  doc.setFillColor(...POWER_BI.cardLight);
  doc.roundedRect(margins.left, y, contentWidth, 28, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...POWER_BI.textMuted);
  doc.text('ORDER', margins.left + 8, y + 11);
  doc.setFontSize(11);
  doc.setTextColor(...POWER_BI.textWhite);
  doc.text(budgetOK ? 'Maintain current pace. No changes.' : 'Tighten BI gate. Review by Friday.', margins.left + 8, y + 22);

  drawPowerBIFooter(doc, pageWidth, pageHeight, currentPage, totalPages, ctx);
  
  // ====================================================================
  // PAGE 3: DECISIONS
  // ====================================================================
  doc.addPage();
  currentPage++;
  
  drawBackground(doc, pageWidth, pageHeight);
  drawPowerBIHeader(doc, pageWidth, 'DECISION QUEUE', ctx);
  y = 48;
  
  const hasCritical = config.decisionsData.critical > 0;
  const decisionStatus = hasCritical ? 'ACTION REQUIRED' : 'QUEUE CLEAR';
  const decisionColor = hasCritical ? POWER_BI.danger : POWER_BI.success;
  
  doc.setFillColor(...decisionColor);
  doc.roundedRect(margins.left, y, contentWidth, 24, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(decisionStatus, pageWidth / 2, y + 16, { align: 'center' });
  y += 32;

  // KPIs
  const decKPIs = [
    { label: 'PENDING', value: config.decisionsData.total.toString() },
    { label: 'CRITICAL', value: config.decisionsData.critical.toString() },
    { label: 'THIS WEEK', value: config.decisionsData.thisWeek.toString() },
    { label: 'EXPOSURE', value: formatCurrency(config.decisionsData.totalExposure, true) },
  ];
  
  decKPIs.forEach((kpi, i) => {
    const kx = margins.left + i * (kpiWidth + 6);
    drawBigKPI(doc, kx, y, kpiWidth, 44, kpi.label, kpi.value);
  });
  y += 54;

  // Critical items only
  if (hasCritical) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...POWER_BI.textWhite);
    doc.text('CRITICAL ITEMS', margins.left, y);
    y += 10;

    const criticals = config.decisionsData.decisions
      .filter(d => d.severity === 'critical')
      .slice(0, 5);

    criticals.forEach((d) => {
      doc.setFillColor(...POWER_BI.card);
      doc.roundedRect(margins.left, y, contentWidth, 22, 2, 2, 'F');
      doc.setFillColor(...POWER_BI.danger);
      doc.rect(margins.left, y + 4, 4, 14, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...POWER_BI.textWhite);
      doc.text(`${d.matterId}`, margins.left + 12, y + 10);
      
      doc.setTextColor(...POWER_BI.danger);
      doc.text(formatCurrency(d.amount, true), margins.left + 60, y + 10);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...POWER_BI.textMuted);
      doc.text(`${d.daysOpen} days`, margins.left + 110, y + 10);
      doc.text(d.lead, margins.left + 140, y + 10);
      
      doc.setFontSize(8);
      doc.text(d.recommendedAction, margins.left + 12, y + 18);
      
      y += 26;
    });
  } else {
    doc.setFillColor(...POWER_BI.card);
    doc.roundedRect(margins.left, y, contentWidth, 40, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...POWER_BI.success);
    doc.text('NO CRITICAL ITEMS', pageWidth / 2, y + 25, { align: 'center' });
    y += 48;
  }

  // ORDER
  y += 6;
  doc.setFillColor(...POWER_BI.cardLight);
  doc.roundedRect(margins.left, y, contentWidth, 28, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...POWER_BI.textMuted);
  doc.text('ORDER', margins.left + 8, y + 11);
  doc.setFontSize(11);
  doc.setTextColor(...POWER_BI.textWhite);
  doc.text(hasCritical ? 'Clear critical queue today. No exceptions.' : 'Queue is moving. No action.', margins.left + 8, y + 22);

  drawPowerBIFooter(doc, pageWidth, pageHeight, currentPage, totalPages, ctx);
  
  // ====================================================================
  // PAGE 4: CP1 LIMITS
  // ====================================================================
  doc.addPage();
  currentPage++;
  
  drawBackground(doc, pageWidth, pageHeight);
  drawPowerBIHeader(doc, pageWidth, 'LIMITS EXPOSURE', ctx);
  y = 48;

  const agedBucket = config.cp1Data.biByAge.find(a => a.age === '365+ Days');
  const agedShare = agedBucket && config.cp1Data.biTotal.total > 0 ? (agedBucket.total / config.cp1Data.biTotal.total) : 0;
  const agedPct = Math.round(agedShare * 100);
  const agedFail = agedPct >= 40;
  const cp1High = parseFloat(config.cp1Data.cp1Rate) > 28;

  const cp1Status = agedFail ? 'ESCALATION REQUIRED' : cp1High ? 'ELEVATED' : 'WITHIN LIMITS';
  const cp1Color = agedFail ? POWER_BI.danger : cp1High ? POWER_BI.warning : POWER_BI.success;
  
  doc.setFillColor(...cp1Color);
  doc.roundedRect(margins.left, y, contentWidth, 24, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(cp1Status, pageWidth / 2, y + 16, { align: 'center' });
  y += 32;

  // KPIs
  const cp1KPIs = [
    { label: 'OPEN CLAIMS', value: config.cp1Data.totalClaims.toLocaleString() },
    { label: 'AT LIMITS', value: config.cp1Data.cp1Count.toLocaleString() },
    { label: 'CP1 RATE', value: config.cp1Data.cp1Rate },
    { label: 'AGED BI', value: `${agedPct}%` },
  ];
  
  cp1KPIs.forEach((kpi, i) => {
    const kx = margins.left + i * (kpiWidth + 6);
    drawBigKPI(doc, kx, y, kpiWidth, 44, kpi.label, kpi.value);
  });
  y += 54;

  // Top coverage by CP1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...POWER_BI.textWhite);
  doc.text('TOP COVERAGE BY CP1 RATE', margins.left, y);
  y += 10;

  const topCov = [...config.cp1Data.byCoverage]
    .sort((a, b) => b.cp1Rate - a.cp1Rate)
    .slice(0, 4);

  topCov.forEach((c) => {
    const isBad = c.cp1Rate >= 30;
    doc.setFillColor(...POWER_BI.card);
    doc.roundedRect(margins.left, y, contentWidth, 18, 2, 2, 'F');
    doc.setFillColor(...(isBad ? POWER_BI.danger : POWER_BI.success));
    doc.rect(margins.left, y + 3, 4, 12, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...POWER_BI.textWhite);
    doc.text(c.coverage, margins.left + 12, y + 12);
    
    doc.setTextColor(...(isBad ? POWER_BI.danger : POWER_BI.textMuted));
    doc.text(`${c.cp1Rate}%`, margins.left + 70, y + 12);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...POWER_BI.textMuted);
    doc.text(`${c.total.toLocaleString()} claims`, margins.left + 100, y + 12);
    
    y += 22;
  });

  // ORDER
  y += 6;
  doc.setFillColor(...POWER_BI.cardLight);
  doc.roundedRect(margins.left, y, contentWidth, 28, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...POWER_BI.textMuted);
  doc.text('ORDER', margins.left + 8, y + 11);
  doc.setFontSize(11);
  doc.setTextColor(...POWER_BI.textWhite);
  doc.text(
    agedFail ? `Execute escalation. Aged BI at ${agedPct}%.` : 
    cp1High ? 'Monitor. Review in 7 days.' : 
    'No action. Control holds.',
    margins.left + 8, y + 22
  );

  drawPowerBIFooter(doc, pageWidth, pageHeight, currentPage, totalPages, ctx);
  
  // ====================================================================
  // PAGE 5: EXPERT SPEND (if data exists)
  // ====================================================================
  if (config.quarterlyExpertData && config.quarterlyExpertData.length > 0) {
    doc.addPage();
    currentPage++;
    
    drawBackground(doc, pageWidth, pageHeight);
    drawPowerBIHeader(doc, pageWidth, 'EXPERT SPEND', ctx);
    y = 48;

    let totalPaid = 0;
    let totalApproved = 0;
    config.quarterlyExpertData.forEach((q) => {
      totalPaid += q.paid;
      totalApproved += q.approved;
    });
    const variance = totalPaid - totalApproved;
    const isOver = variance < 0;

    const spendStatus = isOver ? 'OVERSPEND' : 'WITHIN BUDGET';
    const spendColor = isOver ? POWER_BI.danger : POWER_BI.success;
    
    doc.setFillColor(...spendColor);
    doc.roundedRect(margins.left, y, contentWidth, 24, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(spendStatus, pageWidth / 2, y + 16, { align: 'center' });
    y += 32;

    // KPIs
    const spendKPIs = [
      { label: '7Q PAID', value: formatCurrency(totalPaid, true) },
      { label: '7Q APPROVED', value: formatCurrency(totalApproved, true) },
      { label: 'VARIANCE', value: `${variance >= 0 ? '+' : ''}${formatCurrency(variance, true)}` },
      { label: 'STATUS', value: isOver ? 'FAIL' : 'OK' },
    ];
    
    spendKPIs.forEach((kpi, i) => {
      const kx = margins.left + i * (kpiWidth + 6);
      drawBigKPI(doc, kx, y, kpiWidth, 44, kpi.label, kpi.value);
    });
    y += 54;

    // ORDER
    doc.setFillColor(...POWER_BI.cardLight);
    doc.roundedRect(margins.left, y, contentWidth, 28, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...POWER_BI.textMuted);
    doc.text('ORDER', margins.left + 8, y + 11);
    doc.setFontSize(11);
    doc.setTextColor(...POWER_BI.textWhite);
    doc.text(isOver ? 'Freeze non-essential. Pre-approval required.' : 'Maintain cadence.', margins.left + 8, y + 22);

    drawPowerBIFooter(doc, pageWidth, pageHeight, currentPage, totalPages, ctx);
  }
  
  // Save
  const filename = `CEO_Control_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
  
  return { success: true, filename, pageCount: currentPage };
}

// ==================== HELPER FUNCTIONS ====================

function drawBackground(doc: any, pageWidth: number, pageHeight: number) {
  doc.setFillColor(...POWER_BI.background);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
}

function drawPowerBIHeader(doc: any, pageWidth: number, title: string, ctx: any) {
  // Header bar
  doc.setFillColor(...POWER_BI.card);
  doc.rect(0, 0, pageWidth, 36, 'F');
  
  // Accent line
  doc.setFillColor(...POWER_BI.accent);
  doc.rect(0, 36, pageWidth, 3, 'F');
  
  // Title - BIG
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...POWER_BI.textWhite);
  doc.text(title, 14, 24);
  
  // Date - right side
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...POWER_BI.textMuted);
  doc.text(`${ctx.reportPeriod}`, pageWidth - 14, 16, { align: 'right' });
  doc.text(`Q${ctx.quarter} FY${ctx.fiscalYear}`, pageWidth - 14, 28, { align: 'right' });
}

function drawPowerBIFooter(doc: any, pageWidth: number, pageHeight: number, page: number, total: number, ctx: any) {
  doc.setFillColor(...POWER_BI.card);
  doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...POWER_BI.textDim);
  doc.text('CONFIDENTIAL', 14, pageHeight - 5);
  doc.text('Fred Loya Insurance', pageWidth / 2, pageHeight - 5, { align: 'center' });
  doc.text(`${page} of ${total}`, pageWidth - 14, pageHeight - 5, { align: 'right' });
}

function drawBigKPI(doc: any, x: number, y: number, w: number, h: number, label: string, value: string) {
  doc.setFillColor(...POWER_BI.card);
  doc.roundedRect(x, y, w, h, 3, 3, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...POWER_BI.textMuted);
  doc.text(label, x + 6, y + 12);
  
  doc.setFontSize(16);
  doc.setTextColor(...POWER_BI.textWhite);
  
  // Truncate if too long
  let displayValue = value;
  if (value.length > 8) {
    doc.setFontSize(12);
  }
  doc.text(displayValue, x + 6, y + 32);
}

type Band = 'OK' | 'WARN' | 'FAIL';

function buildCEOControlPanel(config: ExecutivePackageConfig): {
  band: Band;
  statusLabel: string;
  statusDetail: string;
  controlAnswer: string;
  controlColor: [number, number, number];
  breakAnswer: string;
  breakColor: [number, number, number];
  actionAnswer: string;
  actionColor: [number, number, number];
  bottomLine: string;
} {
  const overBudget = !config.budgetData.onTrack;
  const hasCritical = config.decisionsData.critical > 0;
  const cp1High = parseFloat(config.cp1Data.cp1Rate) > 28;
  
  const agedBucket = config.cp1Data.biByAge.find(a => a.age === '365+ Days');
  const agedShare = agedBucket && config.cp1Data.biTotal.total > 0 ? (agedBucket.total / config.cp1Data.biTotal.total) : 0;
  const agedFail = agedShare >= 0.40;

  const criticalExposure = config.decisionsData.decisions
    .filter(d => d.severity === 'critical')
    .reduce((s, d) => s + (d.amount || 0), 0);

  // Determine band
  const band: Band = overBudget || hasCritical || agedFail ? 'FAIL' : cp1High ? 'WARN' : 'OK';

  // Status
  const statusLabel = band === 'FAIL' ? 'INTERVENTION REQUIRED' : band === 'WARN' ? 'MONITOR ACTIVE' : 'IN CONTROL';
  const statusDetail = band === 'FAIL' 
    ? 'Action required this week' 
    : band === 'WARN' 
      ? 'No action yet - watching' 
      : 'No action required';

  // Q1: Control?
  const controlAnswer = overBudget
    ? `NO - ${formatCurrency(Math.abs(config.budgetData.projectedVariance), true)} over plan`
    : `YES - ${formatCurrency(config.budgetData.projectedVariance, true)} under plan`;
  const controlColor: [number, number, number] = overBudget ? POWER_BI.danger : POWER_BI.success;

  // Q2: Breaking where?
  let breakAnswer = 'NOWHERE - All gates holding';
  let breakColor: [number, number, number] = POWER_BI.success;
  
  if (overBudget) {
    breakAnswer = 'BUDGET - BI driving overspend';
    breakColor = POWER_BI.danger;
  } else if (hasCritical) {
    breakAnswer = `DECISIONS - ${config.decisionsData.critical} critical stalled`;
    breakColor = POWER_BI.danger;
  } else if (agedFail) {
    breakAnswer = `AGED BI - ${Math.round(agedShare * 100)}% at 365+ days`;
    breakColor = POWER_BI.danger;
  } else if (cp1High) {
    breakAnswer = `CP1 RATE - ${config.cp1Data.cp1Rate} is elevated`;
    breakColor = POWER_BI.warning;
  }

  // Q3: Action?
  let actionAnswer = 'NO - Maintain cadence';
  let actionColor: [number, number, number] = POWER_BI.success;
  
  if (overBudget) {
    actionAnswer = 'YES - Tighten BI gate by Friday';
    actionColor = POWER_BI.danger;
  } else if (hasCritical) {
    actionAnswer = 'YES - Clear critical queue today';
    actionColor = POWER_BI.danger;
  } else if (agedFail) {
    actionAnswer = 'YES - Execute escalation protocol';
    actionColor = POWER_BI.danger;
  } else if (cp1High) {
    actionAnswer = 'MONITOR - Review in 7 days';
    actionColor = POWER_BI.warning;
  }

  // Bottom line
  const bottomLine = band === 'OK'
    ? 'Discipline is holding. No action required.'
    : band === 'WARN'
      ? 'Warning active. Monitoring. Will escalate if trend continues.'
      : 'Intervention required. I have flagged the items above.';

  return {
    band,
    statusLabel,
    statusDetail,
    controlAnswer,
    controlColor,
    breakAnswer,
    breakColor,
    actionAnswer,
    actionColor,
    bottomLine,
  };
}
