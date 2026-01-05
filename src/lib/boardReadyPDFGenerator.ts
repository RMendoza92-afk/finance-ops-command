/**
 * CEO CONTROL PANEL - SINGLE PAGE
 * Chief of Staff to Fred Loya Jr.
 * No narrative. No explanation. Table only.
 */

import { format } from 'date-fns';
import loyaLogo from '@/assets/fli_logo.jpg';
import { 
  getReportContext,
  formatCurrency,
  QuarterlyData
} from './executivePDFFramework';

// ==================== TYPES ====================

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

// ==================== COLORS ====================
const C = {
  bg: [10, 15, 25] as [number, number, number],
  headerBg: [20, 30, 50] as [number, number, number],
  rowDark: [18, 24, 38] as [number, number, number],
  rowLight: [25, 32, 48] as [number, number, number],
  border: [45, 55, 75] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  muted: [140, 150, 170] as [number, number, number],
  green: [34, 197, 94] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
  amber: [251, 191, 36] as [number, number, number],
  blue: [59, 130, 246] as [number, number, number],
};

// ==================== GENERATOR ====================

export async function generateBoardReadyPackage(config: ExecutivePackageConfig): Promise<{
  success: boolean;
  filename: string;
  pageCount: number;
}> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ctx = getReportContext();
  
  const m = { l: 10, r: 10, t: 10 };
  const cw = pw - m.l - m.r;

  // Background
  doc.setFillColor(...C.bg);
  doc.rect(0, 0, pw, ph, 'F');

  let y = m.t;

  // ============ HEADER ============
  doc.setFillColor(...C.headerBg);
  doc.rect(0, 0, pw, 28, 'F');
  doc.setFillColor(...C.blue);
  doc.rect(0, 28, pw, 2, 'F');

  // Logo
  try {
    doc.addImage(loyaLogo, 'JPEG', m.l, 4, 20, 20);
  } catch (e) {
    // Logo failed to load, continue without it
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...C.white);
  doc.text('CEO CONTROL PANEL', m.l + 24, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.muted);
  doc.text(ctx.reportPeriod, pw - m.r, 12, { align: 'right' });
  doc.text(`Q${ctx.quarter} FY${ctx.fiscalYear}`, pw - m.r, 22, { align: 'right' });

  y = 38;

  // ============ BUILD DATA ============
  const data = buildControlData(config);

  // ============ STATUS BANNER ============
  const bannerColor = data.status === 'FAIL' ? C.red : data.status === 'WARN' ? C.amber : C.green;
  doc.setFillColor(...bannerColor);
  doc.roundedRect(m.l, y, cw, 18, 2, 2, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...C.white);
  doc.text(data.statusLabel, pw / 2, y + 12, { align: 'center' });
  y += 24;

  // ============ CONTROL QUESTIONS TABLE ============
  const colW = [50, cw - 50];
  const rowH = 18;

  const questions = [
    ['1. IN CONTROL?', data.control],
    ['2. BREAKING WHERE?', data.breaking],
    ['3. ACTION THIS WEEK?', data.action],
  ];

  doc.setFontSize(9);
  questions.forEach((row, i) => {
    doc.setFillColor(...(i % 2 === 0 ? C.rowDark : C.rowLight));
    doc.rect(m.l, y, cw, rowH, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.muted);
    doc.text(row[0], m.l + 4, y + 12);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.white);
    doc.text(row[1], m.l + colW[0] + 4, y + 12);
    
    y += rowH;
  });

  y += 8;

  // ============ METRICS TABLE ============
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.white);
  doc.text('METRICS', m.l, y + 4);
  y += 10;

  const metricColW = [45, 40, 45, cw - 130];
  const metricRowH = 14;

  // Header row
  doc.setFillColor(...C.headerBg);
  doc.rect(m.l, y, cw, metricRowH, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.muted);
  doc.text('AREA', m.l + 4, y + 9);
  doc.text('VALUE', m.l + metricColW[0] + 4, y + 9);
  doc.text('STATE', m.l + metricColW[0] + metricColW[1] + 4, y + 9);
  doc.text('OWNER', m.l + metricColW[0] + metricColW[1] + metricColW[2] + 4, y + 9);
  y += metricRowH;

  const metrics = [
    ['BUDGET', data.budgetValue, data.budgetState, 'Claims + Litigation'],
    ['DECISIONS', data.decisionsValue, data.decisionsState, 'Litigation'],
    ['CP1 RATE', data.cp1Value, data.cp1State, 'Claims'],
    ['AGED BI', data.agedValue, data.agedState, 'Claims + Litigation'],
  ];

  doc.setFontSize(8);
  metrics.forEach((row, i) => {
    doc.setFillColor(...(i % 2 === 0 ? C.rowDark : C.rowLight));
    doc.rect(m.l, y, cw, metricRowH, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.white);
    doc.text(row[0], m.l + 4, y + 9);
    
    doc.setFont('helvetica', 'normal');
    doc.text(row[1], m.l + metricColW[0] + 4, y + 9);
    
    const stateColor = row[2] === 'FAIL' ? C.red : row[2] === 'WARN' ? C.amber : C.green;
    doc.setTextColor(...stateColor);
    doc.setFont('helvetica', 'bold');
    doc.text(row[2], m.l + metricColW[0] + metricColW[1] + 4, y + 9);
    
    doc.setTextColor(...C.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(row[3], m.l + metricColW[0] + metricColW[1] + metricColW[2] + 4, y + 9);
    
    y += metricRowH;
  });

  y += 8;

  // ============ DRIVERS TABLE ============
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.white);
  doc.text('DRIVERS', m.l, y + 4);
  y += 10;

  const driverColW = [30, 50, cw - 80];

  // Header
  doc.setFillColor(...C.headerBg);
  doc.rect(m.l, y, cw, metricRowH, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.muted);
  doc.text('COV', m.l + 4, y + 9);
  doc.text('YOY CHANGE', m.l + driverColW[0] + 4, y + 9);
  doc.text('IMPACT', m.l + driverColW[0] + driverColW[1] + 4, y + 9);
  y += metricRowH;

  doc.setFontSize(8);
  data.drivers.forEach((d, i) => {
    doc.setFillColor(...(i % 2 === 0 ? C.rowDark : C.rowLight));
    doc.rect(m.l, y, cw, metricRowH, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.white);
    doc.text(d.cov, m.l + 4, y + 9);
    
    const changeColor = d.change > 0 ? C.red : C.green;
    doc.setTextColor(...changeColor);
    doc.text(d.changeStr, m.l + driverColW[0] + 4, y + 9);
    
    doc.setTextColor(...C.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(d.impact, m.l + driverColW[0] + driverColW[1] + 4, y + 9);
    
    y += metricRowH;
  });

  y += 8;

  // ============ ORDERS TABLE ============
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.white);
  doc.text('ORDERS', m.l, y + 4);
  y += 10;

  const orderColW = [50, cw - 50];

  // Header
  doc.setFillColor(...C.headerBg);
  doc.rect(m.l, y, cw, metricRowH, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.muted);
  doc.text('AREA', m.l + 4, y + 9);
  doc.text('ORDER', m.l + orderColW[0] + 4, y + 9);
  y += metricRowH;

  doc.setFontSize(8);
  data.orders.forEach((o, i) => {
    doc.setFillColor(...(i % 2 === 0 ? C.rowDark : C.rowLight));
    doc.rect(m.l, y, cw, metricRowH, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.white);
    doc.text(o.area, m.l + 4, y + 9);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text(o.order, m.l + orderColW[0] + 4, y + 9);
    
    y += metricRowH;
  });

  y += 8;

  // ============ CONSEQUENCES TABLE ============
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C.white);
  doc.text('CONSEQUENCES IF UNCHANGED', m.l, y + 4);
  y += 10;

  // Header
  doc.setFillColor(...C.headerBg);
  doc.rect(m.l, y, cw, metricRowH, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.muted);
  doc.text('AREA', m.l + 4, y + 9);
  doc.text('CONSEQUENCE', m.l + orderColW[0] + 4, y + 9);
  y += metricRowH;

  doc.setFontSize(8);
  data.consequences.forEach((c, i) => {
    doc.setFillColor(...(i % 2 === 0 ? C.rowDark : C.rowLight));
    doc.rect(m.l, y, cw, metricRowH, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.white);
    doc.text(c.area, m.l + 4, y + 9);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.red);
    doc.text(c.consequence, m.l + orderColW[0] + 4, y + 9);
    
    y += metricRowH;
  });

  // ============ FOOTER ============
  doc.setFillColor(...C.headerBg);
  doc.rect(0, ph - 12, pw, 12, 'F');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('CONFIDENTIAL', m.l, ph - 4);
  doc.text('Fred Loya Insurance', pw / 2, ph - 4, { align: 'center' });
  doc.text('Page 1 of 1', pw - m.r, ph - 4, { align: 'right' });

  // Save
  const filename = `CEO_Control_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
  
  return { success: true, filename, pageCount: 1 };
}

// ==================== DATA BUILDER ====================

function buildControlData(config: ExecutivePackageConfig) {
  const INSUF = 'INSUFFICIENT - EXEC ASSUMPTION MADE';
  
  const overBudget = !config.budgetData.onTrack;
  const hasCritical = config.decisionsData.critical > 0;
  const cp1High = parseFloat(config.cp1Data.cp1Rate) > 28;
  
  const agedBucket = config.cp1Data.biByAge.find(a => a.age === '365+ Days');
  const agedShare = agedBucket && config.cp1Data.biTotal.total > 0 
    ? (agedBucket.total / config.cp1Data.biTotal.total) 
    : 0;
  const agedPct = Math.round(agedShare * 100);
  const agedFail = agedPct >= 40;

  // Status
  const status = overBudget || hasCritical || agedFail ? 'FAIL' : cp1High ? 'WARN' : 'OK';
  const statusLabel = status === 'FAIL' 
    ? 'INTERVENTION REQUIRED' 
    : status === 'WARN' 
      ? 'MONITOR ACTIVE' 
      : 'IN CONTROL';

  // Control questions
  const control = overBudget
    ? `NO - ${formatCurrency(Math.abs(config.budgetData.projectedVariance), true)} over`
    : `YES - ${formatCurrency(config.budgetData.projectedVariance, true)} under`;

  let breaking = 'NOWHERE';
  if (overBudget) breaking = 'BUDGET - BI overspend';
  else if (hasCritical) breaking = `DECISIONS - ${config.decisionsData.critical} critical`;
  else if (agedFail) breaking = `AGED BI - ${agedPct}% at 365+`;
  else if (cp1High) breaking = `CP1 - ${config.cp1Data.cp1Rate} elevated`;

  let action = 'NO - Maintain cadence';
  if (overBudget) action = 'YES - Tighten BI gate Friday';
  else if (hasCritical) action = 'YES - Clear critical today';
  else if (agedFail) action = 'YES - Execute escalation';
  else if (cp1High) action = 'MONITOR - Review 7 days';

  // Metrics
  const budgetValue = config.budgetData.ytdPaid 
    ? formatCurrency(config.budgetData.ytdPaid, true) 
    : INSUF;
  const budgetState = overBudget ? 'FAIL' : 'OK';

  const decisionsValue = config.decisionsData.critical !== undefined 
    ? `${config.decisionsData.critical} critical` 
    : INSUF;
  const decisionsState = hasCritical ? 'FAIL' : 'OK';

  const cp1Value = config.cp1Data.cp1Rate || INSUF;
  const cp1State = cp1High ? 'WARN' : 'OK';

  const agedValue = agedPct !== undefined ? `${agedPct}%` : INSUF;
  const agedState = agedFail ? 'FAIL' : 'OK';

  // Drivers
  const bi = config.budgetData.coverageBreakdown?.bi;
  const cl = config.budgetData.coverageBreakdown?.cl;
  const oc = config.budgetData.coverageBreakdown?.oc;

  const drivers = [
    { 
      cov: 'BI', 
      change: bi?.change ?? 0,
      changeStr: bi ? `${bi.change >= 0 ? '+' : ''}${formatCurrency(bi.change, true)}` : INSUF,
      impact: bi?.change > 0 ? 'Primary overspend driver' : 'Under prior year'
    },
    { 
      cov: 'CL', 
      change: cl?.change ?? 0,
      changeStr: cl ? `${cl.change >= 0 ? '+' : ''}${formatCurrency(cl.change, true)}` : INSUF,
      impact: cl?.change > 0 ? 'Contributing to overspend' : 'Under prior year'
    },
    { 
      cov: 'OC', 
      change: oc?.change ?? 0,
      changeStr: oc ? `${oc.change >= 0 ? '+' : ''}${formatCurrency(oc.change, true)}` : INSUF,
      impact: oc?.change > 0 ? 'Contributing to overspend' : 'Under prior year'
    },
  ].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  // Orders
  const orders = [
    { area: 'BUDGET', order: overBudget ? 'Tighten BI gate. Review Friday.' : 'No change.' },
    { area: 'DECISIONS', order: hasCritical ? 'Clear critical queue today.' : 'No change.' },
    { area: 'CP1', order: agedFail ? 'Execute escalation protocol.' : cp1High ? 'Monitor. Review 7 days.' : 'No change.' },
  ];

  // Consequences
  const consequences = [
    { 
      area: 'BUDGET', 
      consequence: overBudget 
        ? `+${formatCurrency(Math.abs(config.budgetData.projectedVariance) / 12, true)}/mo bleed` 
        : 'None'
    },
    { 
      area: 'DECISIONS', 
      consequence: hasCritical ? 'Exposure compounds weekly' : 'None'
    },
    { 
      area: 'CP1', 
      consequence: agedFail ? 'Authority erosion' : 'None'
    },
  ];

  return {
    status,
    statusLabel,
    control,
    breaking,
    action,
    budgetValue,
    budgetState,
    decisionsValue,
    decisionsState,
    cp1Value,
    cp1State,
    agedValue,
    agedState,
    drivers,
    orders,
    consequences,
  };
}
