/**
 * CEO CONTROL INSTRUMENT — CHIEF OF STAFF TO FRED LOYA JR.
 * =========================================================
 * You are Chief of Staff. This is a CEO control and discipline instrument.
 * 
 * Your job is NOT to summarize data.
 * Your job is to DECIDE, LABEL, and FORCE POSTURE.
 * 
 * The reader:
 * - Is Fred Loya Jr.
 * - Already knows the business
 * - Has zero patience
 * - Will not interpret or infer
 * 
 * Page 1 must immediately answer:
 * 1. Are we in control or not?
 * 2. Where is discipline breaking (if anywhere)?
 * 3. Does executive intervention happen this week, or not?
 * 
 * Every section MUST resolve to ONE state:
 * 🟢 DISCIPLINE HOLDING — no action
 * 🟡 DISCIPLINE SOFTENING — warning / monitor
 * 🔴 DISCIPLINE BROKEN — intervention required
 * 
 * NO NEUTRAL OR DESCRIPTIVE SECTIONS.
 * 
 * All metrics MUST include:
 * - Financial impact
 * - Owner
 * - Consequence if unchanged
 * 
 * If the CEO cannot understand the takeaway in 10 seconds, REGENERATE.
 * Interpretation is failure.
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
  const totalPagesPlanned = config.quarterlyExpertData && config.quarterlyExpertData.length > 0 ? 5 : 4;
  let colX = 0;
  
  // Track section page numbers
  const sectionPages: Record<string, number> = {};
  
  // ====================================================================
  // PAGE 1: EXECUTIVE SUMMARY - THE ONLY PAGE MOST EXECUTIVES WILL READ
  // ====================================================================
  
  // Dark background for page 1
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  drawPageHeader(doc, pageWidth, 'FRED LOYA JR. — THIS WEEK', 'Chief of Staff Control Report', ctx);
  let y = 44;

  const ceo = buildCEOControlPanel(config);

  // GIANT STATUS BADGE — 10 second read
  const statusBadgeColor = ceo.disciplineBand === 'failure' ? EXECUTIVE_COLORS.danger : ceo.disciplineBand === 'degrading' ? EXECUTIVE_COLORS.warning : EXECUTIVE_COLORS.success;
  doc.setFillColor(statusBadgeColor[0], statusBadgeColor[1], statusBadgeColor[2]);
  doc.roundedRect(margins.left, y, pageWidth - margins.left - margins.right, 28, 4, 4, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(ceo.disciplineLabel, pageWidth / 2, y + 12, { align: 'center' });
  
  doc.setFontSize(9);
  doc.text(ceo.statusLine, pageWidth / 2, y + 22, { align: 'center' });
  y += 36;

  // THE 3 QUESTIONS — NO SCANNING REQUIRED
  const boxW = pageWidth - margins.left - margins.right;
  const boxH = 30;

  const drawCEOBox = (number: string, question: string, answer: string, owner: string, impact: string, consequence: string, accent: number[]) => {
    doc.setFillColor(18, 18, 18);
    doc.roundedRect(margins.left, y, boxW, boxH, 3, 3, 'F');
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(margins.left, y + 4, 5, boxH - 8, 'F');

    // Question label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text(`${number} ${question}`, margins.left + 10, y + 8);

    // Answer (large, bold)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
    const lines = doc.splitTextToSize(answer, boxW - 20);
    doc.text(lines[0], margins.left + 10, y + 18);

    // Owner | Impact | Consequence (single line)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...EXECUTIVE_COLORS.textSecondary);
    doc.text(`OWNER: ${owner}  |  IMPACT: ${impact}  |  IF UNCHANGED: ${consequence}`, margins.left + 10, y + 26);

    y += boxH + 4;
  };

  drawCEOBox('1)', 'ARE WE IN CONTROL?', ceo.planAnswer, ceo.planOwner, ceo.planImpact, ceo.planConsequence, ceo.planAccent);
  drawCEOBox('2)', 'WHERE IS DISCIPLINE BREAKING?', ceo.breakAnswer, ceo.breakOwner, ceo.breakImpact, ceo.breakConsequence, ceo.breakAccent);
  drawCEOBox('3)', 'INTERVENTION THIS WEEK?', ceo.enforcementAnswer, ceo.enforcementOwner, ceo.enforcementImpact, ceo.enforcementConsequence, ceo.enforcementAccent);

  // CHIEF OF STAFF CONFIRMATION
  y += 4;
  doc.setFillColor(ceo.disciplineBand === 'holding' ? 15 : 40, ceo.disciplineBand === 'holding' ? 35 : 18, ceo.disciplineBand === 'holding' ? 25 : 18);
  doc.roundedRect(margins.left, y, boxW, 22, 3, 3, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
  doc.text('CHIEF OF STAFF CONFIRMATION:', margins.left + 6, y + 9);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const confirmLines = doc.splitTextToSize(ceo.confirmationLine, boxW - 16);
  doc.text(confirmLines[0], margins.left + 6, y + 17);

  // Page footer
  drawPageFooter(doc, pageWidth, pageHeight, currentPage, totalPagesPlanned, ctx);
  
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
  
  // Budget discipline state — NO NEUTRAL
  const budgetBand = config.budgetData.onTrack ? '🟢 DISCIPLINE HOLDING' : '🔴 DISCIPLINE BROKEN';
  const budgetOwner = 'Claims + Litigation';
  const budgetImpact = formatCurrency(Math.abs(config.budgetData.projectedVariance), true);
  const budgetConsequence = config.budgetData.onTrack 
    ? 'None — on track'
    : `+${formatCurrency(Math.abs(config.budgetData.projectedVariance) / 12, true)}/mo bleed`;
  const budgetTakeaway = config.budgetData.onTrack
    ? `${budgetBand} | OWNER: ${budgetOwner} | We are ${formatCurrency(config.budgetData.projectedVariance, true)} under. No action.`
    : `${budgetBand} | OWNER: ${budgetOwner} | ${budgetImpact} over. BI broke the gate. Tighten now.`;
  
  drawKeyTakeaway(doc, margins.left, y, pageWidth - margins.left - margins.right, budgetTakeaway, config.budgetData.onTrack ? 'positive' : 'negative');
  y += 26;
  
  // Budget metrics row
  const budgetMetrics = [
    { label: 'BUDGET', value: formatCurrency(config.budgetData.annualBudget, true), sub: `FY${ctx.fiscalYear}` },
    { label: 'SPENT', value: formatCurrency(config.budgetData.ytdPaid, true), sub: `${config.budgetData.yoyChangePercent >= 0 ? '+' : ''}${config.budgetData.yoyChangePercent.toFixed(1)}% YoY` },
    { label: 'BURN', value: `${config.budgetData.burnRate}%`, sub: 'of annual' },
    { label: 'REMAINING', value: formatCurrency(config.budgetData.remaining, true), sub: config.budgetData.onTrack ? 'OK' : 'Tight' }
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
    
    const impact = cov.change > 20000000 ? 'ACT' : cov.change > 0 ? 'WATCH' : 'OK';
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
  doc.text('I AM CALLING THIS OUT:', margins.left + 4, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...EXECUTIVE_COLORS.textPrimary);
  const biPct = ((config.budgetData.coverageBreakdown.bi.change / totalChange) * 100).toFixed(0);
  const biClaimDiff = config.budgetData.coverageBreakdown.bi.claimCount2025 - config.budgetData.coverageBreakdown.bi.claimCount2024;
  doc.text(`BI is ${biPct}% of the problem. ${biClaimDiff.toLocaleString()} more BI claims YoY.`, margins.left + 58, y + 8);
  doc.text('I DEMAND: BI payment gate tightened. Litigation spend review by Friday.', margins.left + 4, y + 16);
  
  drawPageFooter(doc, pageWidth, pageHeight, currentPage, totalPagesPlanned, ctx);
  
  // ====================================================================
  // PAGE 3: DECISION QUEUE
  // ====================================================================
  doc.addPage();
  currentPage++;
  sectionPages['decisions'] = currentPage;
  
  // Dark background
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  drawPageHeader(doc, pageWidth, 'DECISION QUEUE', `${config.decisionsData.critical} Critical`, ctx);
  y = 44;
  
  const criticalExposure = config.decisionsData.decisions
    .filter(d => d.severity === 'critical')
    .reduce((s, d) => s + (d.amount || 0), 0);

  // Decision discipline state — NO NEUTRAL
  const decisionBand = config.decisionsData.critical > 0 ? '🔴 DISCIPLINE BROKEN' : '🟢 DISCIPLINE HOLDING';
  const decisionOwner = 'Litigation';
  const decisionTakeaway = config.decisionsData.critical > 0
    ? `${decisionBand} | OWNER: ${decisionOwner} | ${config.decisionsData.critical} critical stalled (${formatCurrency(criticalExposure, true)}). Clear today.`
    : `${decisionBand} | OWNER: ${decisionOwner} | Queue moving. ${config.decisionsData.total} pending. No action.`;
  
  drawKeyTakeaway(doc, margins.left, y, pageWidth - margins.left - margins.right, decisionTakeaway, config.decisionsData.critical > 0 ? 'negative' : 'positive');
  y += 26;
  
  // Decision metrics
  const decMetrics = [
    { label: 'PENDING', value: config.decisionsData.total.toString(), sub: 'matters' },
    { label: 'CRITICAL', value: config.decisionsData.critical.toString(), sub: 'act now' },
    { label: 'THIS WEEK', value: config.decisionsData.thisWeek.toString(), sub: '7 days' },
    { label: 'EXPOSED', value: formatCurrency(config.decisionsData.totalExposure, true), sub: 'total' }
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
  
  drawPageFooter(doc, pageWidth, pageHeight, currentPage, totalPagesPlanned, ctx);
  
  // ====================================================================
  // PAGE 4: CP1 LIMITS ANALYSIS
  // ====================================================================
  doc.addPage();
  currentPage++;
  sectionPages['cp1'] = currentPage;
  
  // Dark background
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  drawPageHeader(doc, pageWidth, 'LIMITS EXPOSURE', 'CP1 by Coverage and Age', ctx);
  y = 44;

  const agedBucket = config.cp1Data.biByAge.find(a => a.age === '365+ Days');
  const agedShare = agedBucket && config.cp1Data.biTotal.total > 0 ? (agedBucket.total / config.cp1Data.biTotal.total) : 0;
  const agedSharePct = (agedShare * 100);
  const agedEscalation = agedSharePct >= 40;
  const cp1High = parseFloat(config.cp1Data.cp1Rate) > 28;

  // CP1 discipline state — NO NEUTRAL
  const cp1Band = agedEscalation ? '🔴 DISCIPLINE BROKEN' : cp1High ? '🟡 DISCIPLINE SOFTENING' : '🟢 DISCIPLINE HOLDING';
  const cp1Owner = 'Claims + Litigation';
  const cp1Takeaway = agedEscalation
    ? `${cp1Band} | OWNER: ${cp1Owner} | Aged BI at ${agedSharePct.toFixed(0)}% (threshold 40%). Execute escalation now.`
    : cp1High
      ? `${cp1Band} | OWNER: ${cp1Owner} | CP1 at ${config.cp1Data.cp1Rate} is elevated. Monitoring. No action yet.`
      : `${cp1Band} | OWNER: ${cp1Owner} | CP1 at ${config.cp1Data.cp1Rate}. Aged BI at ${agedSharePct.toFixed(0)}%. No action.`;
  
  drawKeyTakeaway(doc, margins.left, y, pageWidth - margins.left - margins.right, cp1Takeaway, agedEscalation ? 'negative' : cp1High ? 'neutral' : 'positive');
  y += 26;
  
  // CP1 metrics
  const cp1Metrics = [
    { label: 'OPEN', value: config.cp1Data.totalClaims.toLocaleString(), sub: 'claims' },
    { label: 'AT LIMITS', value: config.cp1Data.cp1Count.toLocaleString(), sub: 'CP1' },
    { label: 'CP1 RATE', value: config.cp1Data.cp1Rate, sub: 'of book' },
    { label: 'BI RATE', value: config.cp1Data.biCP1Rate, sub: 'driver' }
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
  
  drawPageFooter(doc, pageWidth, pageHeight, currentPage, totalPagesPlanned, ctx);
  
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
    
    drawPageHeader(doc, pageWidth, 'QUARTERLY TREND', 'Expert Spend', ctx);
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
    
    drawPageFooter(doc, pageWidth, pageHeight, currentPage, totalPagesPlanned, ctx);
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
  doc.text('STATUS:', x + 8, y + 8);
  
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
  const ceo = buildCEOControlPanel(config);
  return `${ceo.statusLine}. ${ceo.enforcementAnswer}`;
}

type DisciplineBand = 'holding' | 'degrading' | 'failure';

function buildCEOControlPanel(config: ExecutivePackageConfig): {
  disciplineBand: DisciplineBand;
  disciplineLabel: string;
  statusLine: string;
  planAnswer: string;
  planAccent: number[];
  planOwner: string;
  planImpact: string;
  planConsequence: string;
  breakAnswer: string;
  breakAccent: number[];
  breakOwner: string;
  breakImpact: string;
  breakConsequence: string;
  enforcementAnswer: string;
  enforcementAccent: number[];
  enforcementOwner: string;
  enforcementImpact: string;
  enforcementConsequence: string;
  primaryOwner: string;
  confirmationLine: string;
} {
  const overBudget = !config.budgetData.onTrack;
  const critical = config.decisionsData.critical > 0;
  const cp1High = parseFloat(config.cp1Data.cp1Rate) > 28;

  const biChange = config.budgetData.coverageBreakdown?.bi?.change ?? 0;
  const biDriver = biChange > 0;

  const agedBucket = config.cp1Data.biByAge.find(a => a.age === '365+ Days');
  const agedShare = agedBucket && config.cp1Data.biTotal.total > 0 ? (agedBucket.total / config.cp1Data.biTotal.total) : 0;
  const agedEscalation = agedShare >= 0.40;
  const agedSharePct = (agedShare * 100).toFixed(0);

  const criticalExposure = config.decisionsData.decisions
    .filter(d => d.severity === 'critical')
    .reduce((s, d) => s + (d.amount || 0), 0);

  // DISCIPLINE BAND — the only 3 states allowed
  const disciplineBand: DisciplineBand = overBudget || critical || agedEscalation 
    ? 'failure' 
    : (cp1High || biDriver ? 'degrading' : 'holding');

  // LABELS — no neutral language
  const disciplineLabel = disciplineBand === 'failure' 
    ? '🔴 DISCIPLINE BROKEN — INTERVENTION REQUIRED' 
    : disciplineBand === 'degrading' 
      ? '🟡 DISCIPLINE SOFTENING — WARNING ACTIVE' 
      : '🟢 DISCIPLINE HOLDING — NO ACTION';

  const statusLine = disciplineBand === 'failure'
    ? 'We are NOT in control. Executive action required this week.'
    : disciplineBand === 'degrading'
      ? 'Control is slipping. Monitoring active. No intervention yet.'
      : 'We are in control. No intervention required.';

  // QUESTION 1: Are we in control?
  const planAnswer = overBudget
    ? `NO. ${formatCurrency(Math.abs(config.budgetData.projectedVariance), true)} over plan. BI broke the gate.`
    : `YES. ${formatCurrency(config.budgetData.projectedVariance, true)} under plan. Gates holding.`;
  const planOwner = 'Claims + Litigation';
  const planImpact = formatCurrency(Math.abs(config.budgetData.projectedVariance), true);
  const planConsequence = overBudget 
    ? `+${formatCurrency(Math.abs(config.budgetData.projectedVariance) / 12, true)}/mo bleed`
    : 'None — on track';

  // QUESTION 2: Where is discipline breaking?
  const breakAnswer = (() => {
    if (overBudget) return `BI PAYMENT GATE. Severity is driving overspend.`;
    if (critical) return `DECISION QUEUE. ${config.decisionsData.critical} critical matters stalled.`;
    if (agedEscalation) return `AGED BI. ${agedSharePct}% at 365+ days. Escalation triggered.`;
    if (cp1High) return `LIMITS RATE. ${config.cp1Data.cp1Rate} CP1 is elevated.`;
    return `NOWHERE. All gates holding.`;
  })();
  const breakOwner = overBudget ? 'Claims' : critical ? 'Litigation' : agedEscalation ? 'Claims + Litigation' : 'All';
  const breakImpact = overBudget 
    ? formatCurrency(biChange, true) + ' BI YoY'
    : critical 
      ? formatCurrency(criticalExposure, true) + ' exposed'
      : agedEscalation
        ? agedSharePct + '% aged BI'
        : '$0 — clean';
  const breakConsequence = overBudget || critical || agedEscalation
    ? 'Exposure compounds weekly'
    : 'None';

  // QUESTION 3: Intervention this week?
  const enforcementAnswer = (() => {
    if (overBudget) return `YES. Tighten BI gate. Litigation spend review by Friday.`;
    if (critical) return `YES. Clear critical queue today. No exceptions.`;
    if (agedEscalation) return `YES. Execute escalation protocol. Review authority.`;
    if (cp1High) return `MONITOR. No action yet. Review in 7 days.`;
    return `NO. Maintain cadence.`;
  })();
  const enforcementOwner = overBudget ? 'Claims + Litigation' : critical ? 'Litigation' : agedEscalation ? 'Claims' : 'None';
  const enforcementImpact = disciplineBand === 'failure' 
    ? 'Required now' 
    : disciplineBand === 'degrading' 
      ? 'Monitor active' 
      : 'None needed';
  const enforcementConsequence = disciplineBand === 'failure'
    ? 'Delay = more exposure'
    : 'None';

  const primaryOwner = overBudget ? 'Claims (BI) + Litigation' : critical ? 'Litigation' : agedEscalation ? 'Claims + Litigation' : 'None required';

  // CHIEF OF STAFF CONFIRMATION — written as the CoS speaking to Fred
  const confirmationLine = disciplineBand === 'holding'
    ? 'Mr. Loya, discipline is holding. No action required. I will maintain watch and report any changes.'
    : disciplineBand === 'degrading'
      ? 'Mr. Loya, control is softening. I am monitoring. I will escalate if thresholds breach.'
      : 'Mr. Loya, discipline has broken. I have assigned enforcement. Confirmation of execution is required by Friday.';

  return {
    disciplineBand,
    disciplineLabel,
    statusLine,
    planAnswer,
    planAccent: overBudget ? EXECUTIVE_COLORS.danger : EXECUTIVE_COLORS.success,
    planOwner,
    planImpact,
    planConsequence,
    breakAnswer,
    breakAccent: disciplineBand === 'failure' ? EXECUTIVE_COLORS.danger : disciplineBand === 'degrading' ? EXECUTIVE_COLORS.warning : EXECUTIVE_COLORS.success,
    breakOwner,
    breakImpact,
    breakConsequence,
    enforcementAnswer,
    enforcementAccent: disciplineBand === 'holding' ? EXECUTIVE_COLORS.success : disciplineBand === 'failure' ? EXECUTIVE_COLORS.danger : EXECUTIVE_COLORS.warning,
    enforcementOwner,
    enforcementImpact,
    enforcementConsequence,
    primaryOwner,
    confirmationLine,
  };
}
