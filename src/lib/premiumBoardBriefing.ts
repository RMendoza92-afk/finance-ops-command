/**
 * PREMIUM BOARD BRIEFING GENERATOR
 * Luxury-tier executive PDF for C-Suite & Board presentation
 * Clean, minimal, data-dense. Zero noise.
 */

import jsPDF from 'jspdf';
import { format } from 'date-fns';
import loyaLogo from '@/assets/fli_logo.jpg';

// ════════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM - Premium Board Aesthetic
// ════════════════════════════════════════════════════════════════════════════

const COLORS = {
  // Primary palette - deep navy/charcoal base
  bg: [8, 12, 21] as [number, number, number],           // Deep navy
  surface: [15, 20, 32] as [number, number, number],     // Elevated surface
  surfaceAlt: [22, 28, 42] as [number, number, number],  // Secondary surface
  
  // Text hierarchy
  white: [255, 255, 255] as [number, number, number],
  offWhite: [235, 238, 245] as [number, number, number],
  muted: [130, 140, 160] as [number, number, number],
  subtle: [80, 90, 110] as [number, number, number],
  
  // Accents
  gold: [218, 185, 107] as [number, number, number],     // Refined gold
  goldMuted: [168, 145, 87] as [number, number, number], // Subdued gold
  emerald: [52, 211, 153] as [number, number, number],   // Success
  ruby: [248, 113, 113] as [number, number, number],     // Alert
  amber: [251, 191, 36] as [number, number, number],     // Warning
  sapphire: [96, 165, 250] as [number, number, number],  // Info
};

// Typography scale (in points)
const TYPE = {
  displayLarge: 32,
  displayMedium: 24,
  headline: 18,
  title: 14,
  body: 10,
  caption: 8,
  micro: 7,
};

// Spacing scale (in mm)
const SPACE = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// ════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

const fmtNum = (n: number): string => n.toLocaleString();

const fmtCurrency = (n: number, compact = false): string => {
  if (compact) {
    if (Math.abs(n) >= 1_000_000_000) return '$' + (n / 1_000_000_000).toFixed(1) + 'B';
    if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K';
  }
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const sanitize = (text: string): string => {
  if (!text) return '';
  return String(text)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E\n]/g, '');
};

// Load image as base64
const loadImageAsBase64 = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = src;
  });
};

// Draw subtle gradient
const drawGradient = (
  doc: jsPDF, 
  x: number, 
  y: number, 
  w: number, 
  h: number, 
  colorTop: [number, number, number], 
  colorBot: [number, number, number], 
  steps = 20
) => {
  const stepH = h / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const r = Math.round(colorTop[0] + (colorBot[0] - colorTop[0]) * t);
    const g = Math.round(colorTop[1] + (colorBot[1] - colorTop[1]) * t);
    const b = Math.round(colorTop[2] + (colorBot[2] - colorTop[2]) * t);
    doc.setFillColor(r, g, b);
    doc.rect(x, y + i * stepH, w, stepH + 0.3, 'F');
  }
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN GENERATOR
// ════════════════════════════════════════════════════════════════════════════

export interface CP1CoverageRow {
  coverage: string;
  total: number;
  yes: number;
  noCP: number;
  cp1Rate: number;
}

export interface CP1AgeRow {
  age: string;
  total: number;
  yes: number;
  noCP: number;
}

export interface CP1AnalysisData {
  totalClaims: number;
  cp1Count: number;
  cp1Rate: string;
  biCP1Rate: string;
  byCoverage: CP1CoverageRow[];
  biByAge: CP1AgeRow[];
  biTotal: { total: number; yes: number; noCP: number };
  totals: { grandTotal: number; yes: number; noCP: number };
  weekOverWeek?: {
    totalClaimsDelta: number;
    cp1RateDelta: number;
    highRiskDelta: number;
    aged365Delta: number;
    previousDate: string;
  };
}

export interface BoardBriefingData {
  totalClaims: number;
  totalReserves: number;
  lowEval?: number;
  highEval?: number;
  cp1Rate: string;
  cp1Count?: number;
  aged365Plus: number;
  aged365Reserves: number;
  aged181to365?: number;
  noEvalCount: number;
  noEvalReserves: number;
  decisionsCount: number;
  decisionsExposure: number;
  biSpend2026: number;
  biSpend2025: number;
  dataDate: string;
  delta?: { 
    change: number; 
    changePercent: number; 
    reservesChange: number; 
    reservesChangePercent: number;
    previousDate?: string;
  };
  fatalityCount?: number;
  fatalityReserves?: number;
  surgeryCount?: number;
  hospitalizationCount?: number;
  // Enhanced CP1 Analysis
  cp1Analysis?: CP1AnalysisData;
}

export async function generatePremiumBoardBriefing(data: BoardBriefingData): Promise<string> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = { l: 20, r: 20, t: 18, b: 18 };
  const cw = pw - m.l - m.r;

  // ══════════════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ══════════════════════════════════════════════════════════════════════════
  
  // Full background
  doc.setFillColor(...COLORS.bg);
  doc.rect(0, 0, pw, ph, 'F');

  // Subtle top gradient accent
  drawGradient(doc, 0, 0, pw, 4, COLORS.gold, COLORS.goldMuted);

  // Logo - center top
  try {
    const logoBase64 = await loadImageAsBase64(loyaLogo);
    doc.addImage(logoBase64, 'JPEG', pw / 2 - 35, 30, 70, 23);
  } catch { 
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...COLORS.white);
    doc.text('FRED LOYA INSURANCE', pw / 2, 42, { align: 'center' });
  }

  // Main title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TYPE.displayLarge);
  doc.setTextColor(...COLORS.white);
  doc.text('PORTFOLIO BRIEFING', pw / 2, 80, { align: 'center' });

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(TYPE.title);
  doc.setTextColor(...COLORS.gold);
  doc.text('Claims Intelligence | Executive Summary', pw / 2, 92, { align: 'center' });

  // Divider line
  doc.setDrawColor(...COLORS.goldMuted);
  doc.setLineWidth(0.5);
  doc.line(pw / 2 - 60, 102, pw / 2 + 60, 102);

  // Date block
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(TYPE.body);
  doc.setTextColor(...COLORS.muted);
  doc.text('Prepared', pw / 2, 118, { align: 'center' });
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TYPE.headline);
  doc.setTextColor(...COLORS.offWhite);
  doc.text(format(new Date(), 'MMMM d, yyyy'), pw / 2, 128, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(TYPE.caption);
  doc.setTextColor(...COLORS.subtle);
  doc.text('Data as of ' + sanitize(data.dataDate), pw / 2, 138, { align: 'center' });

  // Classification
  doc.setFillColor(...COLORS.surface);
  doc.roundedRect(pw / 2 - 35, 155, 70, 14, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TYPE.caption);
  doc.setTextColor(...COLORS.gold);
  doc.text('CONFIDENTIAL', pw / 2, 164, { align: 'center' });

  // Footer line
  doc.setDrawColor(...COLORS.subtle);
  doc.setLineWidth(0.3);
  doc.line(m.l, ph - 15, pw - m.r, ph - 15);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(TYPE.micro);
  doc.setTextColor(...COLORS.subtle);
  doc.text('Fred Loya Insurance | Claims Discipline Command', m.l, ph - 8);
  doc.text('Page 1 of 2', pw - m.r, ph - 8, { align: 'right' });

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2: EXECUTIVE DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════
  
  doc.addPage();
  
  // Background
  doc.setFillColor(...COLORS.bg);
  doc.rect(0, 0, pw, ph, 'F');

  // Header bar
  doc.setFillColor(...COLORS.surface);
  doc.rect(0, 0, pw, 22, 'F');
  
  // Gold accent line
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 22, pw, 1, 'F');

  // Logo in header
  try {
    const logoBase64 = await loadImageAsBase64(loyaLogo);
    doc.addImage(logoBase64, 'JPEG', m.l, 4, 40, 13);
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.white);
    doc.text('FRED LOYA INSURANCE', m.l, 13);
  }

  // Header title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TYPE.title);
  doc.setTextColor(...COLORS.white);
  doc.text('CLAIMS PORTFOLIO STATUS', pw / 2, 13, { align: 'center' });

  // Header right info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(TYPE.caption);
  doc.setTextColor(...COLORS.muted);
  doc.text(format(new Date(), 'MMM d, yyyy'), pw - m.r, 10, { align: 'right' });
  doc.setTextColor(...COLORS.subtle);
  doc.text('Data: ' + sanitize(data.dataDate), pw - m.r, 17, { align: 'right' });

  let y = 30;

  // ════════════════════════════════════════════════════════════════════════
  // STATUS BANNER
  // ════════════════════════════════════════════════════════════════════════
  
  const hasAlert = (data.fatalityCount || 0) > 0 || data.noEvalCount > 5000 || data.aged365Plus > 3000;
  const hasWarning = data.decisionsCount > 100 || parseFloat(data.cp1Rate) < 25;
  
  const statusConfig = hasAlert 
    ? { bg: [35, 18, 18] as [number, number, number], accent: COLORS.ruby, text: 'ATTENTION REQUIRED', icon: '⚠' }
    : hasWarning 
      ? { bg: [35, 30, 15] as [number, number, number], accent: COLORS.amber, text: 'MONITOR', icon: '◐' }
      : { bg: [15, 35, 28] as [number, number, number], accent: COLORS.emerald, text: 'STABLE', icon: '●' };

  doc.setFillColor(...statusConfig.bg);
  doc.roundedRect(m.l, y, cw, 14, 2, 2, 'F');
  
  // Status indicator dot
  doc.setFillColor(...statusConfig.accent);
  doc.circle(m.l + 12, y + 7, 3, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TYPE.body);
  doc.setTextColor(...statusConfig.accent);
  doc.text('PORTFOLIO STATUS: ' + statusConfig.text, m.l + 22, y + 9);
  
  // WoW summary on right
  if (data.delta) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TYPE.caption);
    const changeColor = data.delta.change <= 0 ? COLORS.emerald : COLORS.ruby;
    doc.setTextColor(...changeColor);
    const sign = data.delta.change >= 0 ? '+' : '';
    doc.text(sign + data.delta.change + ' claims WoW (' + sign + data.delta.changePercent.toFixed(1) + '%)', pw - m.r - 10, y + 9, { align: 'right' });
  }

  y += 22;

  // ════════════════════════════════════════════════════════════════════════
  // PRIMARY METRICS - Large Number Cards
  // ════════════════════════════════════════════════════════════════════════
  
  const colW = (cw - SPACE.md * 3) / 4;
  const cardH = 48;

  const primaryMetrics = [
    { 
      label: 'OPEN EXPOSURES', 
      value: fmtNum(data.totalClaims),
      sublabel: 'Active Claims',
      accent: COLORS.sapphire,
    },
    { 
      label: 'TOTAL RESERVES', 
      value: fmtCurrency(data.totalReserves, true),
      sublabel: 'Gross Exposure',
      accent: COLORS.gold,
    },
    { 
      label: 'CP1 COMPLIANCE', 
      value: data.cp1Rate + '%',
      sublabel: fmtNum(data.cp1Count || 0) + ' within limits',
      accent: parseFloat(data.cp1Rate) >= 30 ? COLORS.emerald : COLORS.amber,
    },
    { 
      label: 'PENDING DECISIONS', 
      value: fmtNum(data.decisionsCount),
      sublabel: fmtCurrency(data.decisionsExposure, true) + ' exposure',
      accent: data.decisionsCount > 100 ? COLORS.ruby : COLORS.emerald,
    },
  ];

  primaryMetrics.forEach((metric, idx) => {
    const x = m.l + idx * (colW + SPACE.md);
    
    // Card bg
    doc.setFillColor(...COLORS.surface);
    doc.roundedRect(x, y, colW, cardH, 3, 3, 'F');
    
    // Left accent bar
    doc.setFillColor(...metric.accent);
    doc.rect(x, y + 4, 2.5, cardH - 8, 'F');

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TYPE.micro);
    doc.setTextColor(...COLORS.muted);
    doc.text(metric.label, x + 10, y + 12);

    // Value - large
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TYPE.displayMedium);
    doc.setTextColor(...COLORS.white);
    doc.text(metric.value, x + 10, y + 32);

    // Sublabel
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TYPE.micro);
    doc.setTextColor(...COLORS.subtle);
    doc.text(metric.sublabel, x + 10, y + 42);
  });

  y += cardH + SPACE.lg;

  // ════════════════════════════════════════════════════════════════════════
  // EVALUATION BAND
  // ════════════════════════════════════════════════════════════════════════
  
  const evalW = cw / 3 - SPACE.sm;
  
  doc.setFillColor(...COLORS.surfaceAlt);
  doc.roundedRect(m.l, y, cw, 22, 2, 2, 'F');

  const evalMetrics = [
    { label: 'LOW EVALUATION', value: fmtCurrency(data.lowEval || 0, true), color: COLORS.emerald },
    { label: 'RESERVE BALANCE', value: fmtCurrency(data.totalReserves, true), color: COLORS.gold },
    { label: 'HIGH EVALUATION', value: fmtCurrency(data.highEval || 0, true), color: COLORS.ruby },
  ];

  evalMetrics.forEach((item, idx) => {
    const x = m.l + SPACE.md + idx * evalW;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TYPE.micro);
    doc.setTextColor(...COLORS.muted);
    doc.text(item.label, x, y + 8);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TYPE.title);
    doc.setTextColor(...item.color);
    doc.text(item.value, x, y + 17);
  });

  y += 30;

  // ════════════════════════════════════════════════════════════════════════
  // RISK PANEL - 2 Column Layout
  // ════════════════════════════════════════════════════════════════════════
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TYPE.body);
  doc.setTextColor(...COLORS.gold);
  doc.text('RISK INDICATORS', m.l, y);
  y += SPACE.md;

  const riskColW = (cw - SPACE.lg) / 2;
  const riskRowH = 18;

  // Left column - Severity
  const leftRisks = [
    { 
      label: 'Fatality Claims', 
      count: fmtNum(data.fatalityCount || 0), 
      value: fmtCurrency(data.fatalityReserves || 0, true),
      critical: (data.fatalityCount || 0) > 0,
    },
    { 
      label: 'Surgery Indicated', 
      count: fmtNum(data.surgeryCount || 0), 
      value: '',
      critical: (data.surgeryCount || 0) > 500,
    },
    { 
      label: 'Hospitalization', 
      count: fmtNum(data.hospitalizationCount || 0), 
      value: '',
      critical: (data.hospitalizationCount || 0) > 1000,
    },
  ];

  leftRisks.forEach((risk, idx) => {
    const rowY = y + idx * riskRowH;
    
    doc.setFillColor(...(idx % 2 === 0 ? COLORS.surface : COLORS.surfaceAlt));
    doc.rect(m.l, rowY, riskColW, riskRowH - 2, 'F');
    
    // Status dot
    doc.setFillColor(...(risk.critical ? COLORS.ruby : COLORS.emerald));
    doc.circle(m.l + 8, rowY + (riskRowH - 2) / 2, 2.5, 'F');

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TYPE.caption);
    doc.setTextColor(...COLORS.offWhite);
    doc.text(risk.label, m.l + 16, rowY + 10);

    // Count
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(risk.critical ? COLORS.ruby : COLORS.offWhite));
    doc.text(risk.count, m.l + riskColW - 40, rowY + 10, { align: 'right' });

    // Value
    if (risk.value) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.muted);
      doc.text(risk.value, m.l + riskColW - 5, rowY + 10, { align: 'right' });
    }
  });

  // Right column - Aging & Backlog
  const rightRisks = [
    { 
      label: 'Aged 365+ Days', 
      count: fmtNum(data.aged365Plus), 
      value: fmtCurrency(data.aged365Reserves, true),
      pct: ((data.aged365Plus / data.totalClaims) * 100).toFixed(0) + '%',
      critical: data.aged365Plus > 3000,
    },
    { 
      label: 'No Evaluation', 
      count: fmtNum(data.noEvalCount), 
      value: fmtCurrency(data.noEvalReserves, true),
      pct: ((data.noEvalCount / data.totalClaims) * 100).toFixed(0) + '%',
      critical: data.noEvalCount > 5000,
    },
    { 
      label: 'Aged 181-365 Days', 
      count: fmtNum(data.aged181to365 || 0), 
      value: '',
      pct: data.totalClaims > 0 ? ((( data.aged181to365 || 0) / data.totalClaims) * 100).toFixed(0) + '%' : '0%',
      critical: false,
    },
  ];

  const rightX = m.l + riskColW + SPACE.lg;

  rightRisks.forEach((risk, idx) => {
    const rowY = y + idx * riskRowH;
    
    doc.setFillColor(...(idx % 2 === 0 ? COLORS.surface : COLORS.surfaceAlt));
    doc.rect(rightX, rowY, riskColW, riskRowH - 2, 'F');
    
    // Status dot
    doc.setFillColor(...(risk.critical ? COLORS.ruby : risk.pct && parseInt(risk.pct) > 20 ? COLORS.amber : COLORS.emerald));
    doc.circle(rightX + 8, rowY + (riskRowH - 2) / 2, 2.5, 'F');

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TYPE.caption);
    doc.setTextColor(...COLORS.offWhite);
    doc.text(risk.label, rightX + 16, rowY + 10);

    // Count
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(risk.critical ? COLORS.ruby : COLORS.offWhite));
    doc.text(risk.count, rightX + riskColW - 60, rowY + 10, { align: 'right' });

    // Pct
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TYPE.micro);
    doc.setTextColor(...COLORS.muted);
    doc.text(risk.pct || '', rightX + riskColW - 40, rowY + 10, { align: 'right' });

    // Value
    if (risk.value) {
      doc.text(risk.value, rightX + riskColW - 5, rowY + 10, { align: 'right' });
    }
  });

  y += leftRisks.length * riskRowH + SPACE.lg;

  // ════════════════════════════════════════════════════════════════════════
  // EXECUTIVE DIRECTIVES
  // ════════════════════════════════════════════════════════════════════════
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TYPE.body);
  doc.setTextColor(...COLORS.gold);
  doc.text('EXECUTIVE ACTIONS', m.l, y);
  y += SPACE.md;

  const directives: { priority: 'critical' | 'high' | 'standard'; text: string }[] = [];
  
  if ((data.fatalityCount || 0) > 0) {
    directives.push({ priority: 'critical', text: 'FATALITY: ' + fmtNum(data.fatalityCount || 0) + ' fatality claims require immediate executive review (' + fmtCurrency(data.fatalityReserves || 0, true) + ')' });
  }
  if (data.decisionsCount > 50) {
    directives.push({ priority: 'high', text: 'DECISIONS: Clear ' + fmtNum(data.decisionsCount) + ' pending decisions (' + fmtCurrency(data.decisionsExposure, true) + ' exposure)' });
  }
  if (data.noEvalCount > 2000) {
    directives.push({ priority: 'high', text: 'EVALUATION: ' + fmtNum(data.noEvalCount) + ' claims pending evaluation - target 48-72hr resolution' });
  }
  if (data.aged365Plus > 1500) {
    directives.push({ priority: 'standard', text: 'AGING: Review ' + fmtNum(data.aged365Plus) + ' claims aged 365+ for resolution strategy' });
  }
  if (parseFloat(data.cp1Rate) < 30) {
    directives.push({ priority: 'standard', text: 'CP1: Rate at ' + data.cp1Rate + '% - target 35%+ through early resolution' });
  }
  if (directives.length === 0) {
    directives.push({ priority: 'standard', text: 'MAINTAIN: Continue standard portfolio monitoring cadence' });
  }

  doc.setFillColor(...COLORS.surface);
  doc.roundedRect(m.l, y, cw, directives.length * 10 + SPACE.md, 2, 2, 'F');

  directives.forEach((dir, idx) => {
    const lineY = y + SPACE.sm + idx * 10;
    
    const dotColor = dir.priority === 'critical' ? COLORS.ruby : dir.priority === 'high' ? COLORS.amber : COLORS.emerald;
    doc.setFillColor(...dotColor);
    doc.circle(m.l + SPACE.md, lineY + 3, 2, 'F');
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TYPE.caption);
    doc.setTextColor(...COLORS.offWhite);
    doc.text(sanitize(dir.text), m.l + SPACE.lg, lineY + 5);
  });

  // ════════════════════════════════════════════════════════════════════════
  // FOOTER - PAGE 2
  // ════════════════════════════════════════════════════════════════════════
  
  doc.setFillColor(...COLORS.surface);
  doc.rect(0, ph - 14, pw, 14, 'F');
  doc.setFillColor(...COLORS.goldMuted);
  doc.rect(0, ph - 14, pw, 0.5, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(TYPE.micro);
  doc.setTextColor(...COLORS.subtle);
  doc.text('CONFIDENTIAL - BOARD DISTRIBUTION ONLY', m.l, ph - 6);
  doc.text('Fred Loya Insurance | Claims Discipline Command', pw / 2, ph - 6, { align: 'center' });
  doc.text('Page 2 of ' + (data.cp1Analysis ? '3' : '2'), pw - m.r, ph - 6, { align: 'right' });

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 3: CP1 ANALYSIS (if data available)
  // ══════════════════════════════════════════════════════════════════════════
  
  if (data.cp1Analysis) {
    doc.addPage();
    
    // Background
    doc.setFillColor(...COLORS.bg);
    doc.rect(0, 0, pw, ph, 'F');

    // Header bar
    doc.setFillColor(...COLORS.surface);
    doc.rect(0, 0, pw, 22, 'F');
    doc.setFillColor(...COLORS.gold);
    doc.rect(0, 22, pw, 1, 'F');

    // Logo in header
    try {
      const logoBase64 = await loadImageAsBase64(loyaLogo);
      doc.addImage(logoBase64, 'JPEG', m.l, 4, 40, 13);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.white);
      doc.text('FRED LOYA INSURANCE', m.l, 13);
    }

    // Header title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TYPE.title);
    doc.setTextColor(...COLORS.white);
    doc.text('CP1 ANALYSIS DEEP DIVE', pw / 2, 13, { align: 'center' });

    // Date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TYPE.caption);
    doc.setTextColor(...COLORS.muted);
    doc.text(format(new Date(), 'MMM d, yyyy'), pw - m.r, 13, { align: 'right' });

    let cp1Y = 30;
    const cp1 = data.cp1Analysis;

    // ════════════════════════════════════════════════════════════════════════
    // CP1 SUMMARY BANNER
    // ════════════════════════════════════════════════════════════════════════
    
    const cp1RateNum = parseFloat(cp1.cp1Rate);
    const cp1Status = cp1RateNum >= 35 ? 'EXCELLENT' : cp1RateNum >= 28 ? 'ACCEPTABLE' : 'NEEDS ATTENTION';
    const cp1StatusColor = cp1RateNum >= 35 ? COLORS.emerald : cp1RateNum >= 28 ? COLORS.amber : COLORS.ruby;

    doc.setFillColor(...COLORS.surface);
    doc.roundedRect(m.l, cp1Y, cw, 24, 2, 2, 'F');
    
    // Status indicator
    doc.setFillColor(...cp1StatusColor);
    doc.circle(m.l + 12, cp1Y + 12, 4, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TYPE.title);
    doc.setTextColor(...cp1StatusColor);
    doc.text('CP1 RATE: ' + cp1.cp1Rate + '%', m.l + 24, cp1Y + 10);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TYPE.caption);
    doc.setTextColor(...COLORS.muted);
    doc.text(cp1Status + ' | ' + fmtNum(cp1.cp1Count || 0) + ' of ' + fmtNum(cp1.totalClaims) + ' claims in CP1', m.l + 24, cp1Y + 18);
    
    // Week over week delta
    if (cp1.weekOverWeek) {
      const wow = cp1.weekOverWeek;
      const sign = wow.cp1RateDelta >= 0 ? '+' : '';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(TYPE.body);
      doc.setTextColor(...(wow.cp1RateDelta >= 0 ? COLORS.emerald : COLORS.ruby));
      doc.text(sign + wow.cp1RateDelta.toFixed(1) + '% WoW', pw - m.r - 10, cp1Y + 14, { align: 'right' });
    }

    cp1Y += 32;

    // ════════════════════════════════════════════════════════════════════════
    // CP1 BY COVERAGE TABLE
    // ════════════════════════════════════════════════════════════════════════
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TYPE.body);
    doc.setTextColor(...COLORS.gold);
    doc.text('CP1 BY COVERAGE', m.l, cp1Y);
    cp1Y += SPACE.md;

    const covColW = [45, 35, 35, 35, 40];
    const covRowH = 12;

    // Header row
    doc.setFillColor(...COLORS.surfaceAlt);
    doc.rect(m.l, cp1Y, cw, covRowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TYPE.micro);
    doc.setTextColor(...COLORS.muted);
    doc.text('COVERAGE', m.l + 4, cp1Y + 8);
    doc.text('TOTAL', m.l + covColW[0], cp1Y + 8);
    doc.text('IN CP1', m.l + covColW[0] + covColW[1], cp1Y + 8);
    doc.text('NOT IN CP', m.l + covColW[0] + covColW[1] + covColW[2], cp1Y + 8);
    doc.text('CP1 RATE', m.l + covColW[0] + covColW[1] + covColW[2] + covColW[3], cp1Y + 8);
    cp1Y += covRowH;

    // Data rows
    cp1.byCoverage.forEach((row, idx) => {
      doc.setFillColor(...(idx % 2 === 0 ? COLORS.surface : COLORS.surfaceAlt));
      doc.rect(m.l, cp1Y, cw, covRowH, 'F');
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(TYPE.caption);
      doc.setTextColor(...COLORS.offWhite);
      doc.text(sanitize(row.coverage), m.l + 4, cp1Y + 8);
      doc.text(fmtNum(row.total), m.l + covColW[0], cp1Y + 8);
      doc.text(fmtNum(row.yes), m.l + covColW[0] + covColW[1], cp1Y + 8);
      doc.text(fmtNum(row.noCP), m.l + covColW[0] + covColW[1] + covColW[2], cp1Y + 8);
      
      // CP1 Rate with color coding
      const rate = row.cp1Rate;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(rate >= 35 ? COLORS.emerald : rate >= 28 ? COLORS.amber : COLORS.ruby));
      doc.text(rate.toFixed(1) + '%', m.l + covColW[0] + covColW[1] + covColW[2] + covColW[3], cp1Y + 8);
      
      cp1Y += covRowH;
    });

    // Totals row - use slightly lighter gold to indicate total
    doc.setFillColor(40, 35, 20);
    doc.rect(m.l, cp1Y, cw, covRowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TYPE.caption);
    doc.setTextColor(...COLORS.gold);
    doc.text('TOTAL', m.l + 4, cp1Y + 8);
    doc.text(fmtNum(cp1.totals.grandTotal), m.l + covColW[0], cp1Y + 8);
    doc.text(fmtNum(cp1.totals.yes), m.l + covColW[0] + covColW[1], cp1Y + 8);
    doc.text(fmtNum(cp1.totals.noCP), m.l + covColW[0] + covColW[1] + covColW[2], cp1Y + 8);
    doc.text(cp1.cp1Rate + '%', m.l + covColW[0] + covColW[1] + covColW[2] + covColW[3], cp1Y + 8);
    cp1Y += covRowH + SPACE.lg;

    // ════════════════════════════════════════════════════════════════════════
    // BI BY AGE TABLE
    // ════════════════════════════════════════════════════════════════════════
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TYPE.body);
    doc.setTextColor(...COLORS.gold);
    doc.text('BI CLAIMS BY AGE', m.l, cp1Y);
    cp1Y += SPACE.md;

    const ageColW = [60, 40, 40, 50];

    // Header row
    doc.setFillColor(...COLORS.surfaceAlt);
    doc.rect(m.l, cp1Y, cw, covRowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TYPE.micro);
    doc.setTextColor(...COLORS.muted);
    doc.text('AGE BUCKET', m.l + 4, cp1Y + 8);
    doc.text('TOTAL', m.l + ageColW[0], cp1Y + 8);
    doc.text('IN CP1', m.l + ageColW[0] + ageColW[1], cp1Y + 8);
    doc.text('NOT IN CP', m.l + ageColW[0] + ageColW[1] + ageColW[2], cp1Y + 8);
    cp1Y += covRowH;

    // Data rows
    cp1.biByAge.forEach((row, idx) => {
      doc.setFillColor(...(idx % 2 === 0 ? COLORS.surface : COLORS.surfaceAlt));
      doc.rect(m.l, cp1Y, cw, covRowH, 'F');
      
      const isAged = row.age.includes('365') || row.age.includes('181');
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(TYPE.caption);
      doc.setTextColor(...(isAged ? COLORS.amber : COLORS.offWhite));
      doc.text(sanitize(row.age), m.l + 4, cp1Y + 8);
      doc.text(fmtNum(row.total), m.l + ageColW[0], cp1Y + 8);
      doc.text(fmtNum(row.yes), m.l + ageColW[0] + ageColW[1], cp1Y + 8);
      doc.text(fmtNum(row.noCP), m.l + ageColW[0] + ageColW[1] + ageColW[2], cp1Y + 8);
      
      cp1Y += covRowH;
    });

    // BI Totals row - use slightly lighter gold background to indicate total
    doc.setFillColor(40, 35, 20);
    doc.rect(m.l, cp1Y, cw, covRowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(TYPE.caption);
    doc.setTextColor(...COLORS.gold);
    doc.text('BI TOTAL', m.l + 4, cp1Y + 8);
    doc.text(fmtNum(cp1.biTotal.total), m.l + ageColW[0], cp1Y + 8);
    doc.text(fmtNum(cp1.biTotal.yes), m.l + ageColW[0] + ageColW[1], cp1Y + 8);
    doc.text(fmtNum(cp1.biTotal.noCP), m.l + ageColW[0] + ageColW[1] + ageColW[2], cp1Y + 8);
    
    // BI CP1 Rate
    doc.setTextColor(...COLORS.sapphire);
    doc.text('BI CP1: ' + cp1.biCP1Rate, m.l + ageColW[0] + ageColW[1] + ageColW[2] + 20, cp1Y + 8);
    cp1Y += covRowH + SPACE.lg;

    // ════════════════════════════════════════════════════════════════════════
    // WEEK OVER WEEK PROGRESS
    // ════════════════════════════════════════════════════════════════════════
    
    if (cp1.weekOverWeek) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(TYPE.body);
      doc.setTextColor(...COLORS.gold);
      doc.text('WEEK OVER WEEK PROGRESS', m.l, cp1Y);
      cp1Y += SPACE.md;

      const wow = cp1.weekOverWeek;
      const wowMetrics = [
        { label: 'Total Claims Change', value: (wow.totalClaimsDelta >= 0 ? '+' : '') + fmtNum(wow.totalClaimsDelta), good: wow.totalClaimsDelta <= 0 },
        { label: 'CP1 Rate Change', value: (wow.cp1RateDelta >= 0 ? '+' : '') + wow.cp1RateDelta.toFixed(1) + '%', good: wow.cp1RateDelta >= 0 },
        { label: 'High Risk Claims Change', value: (wow.highRiskDelta >= 0 ? '+' : '') + fmtNum(wow.highRiskDelta), good: wow.highRiskDelta <= 0 },
        { label: '365+ Age Change', value: (wow.aged365Delta >= 0 ? '+' : '') + fmtNum(wow.aged365Delta), good: wow.aged365Delta <= 0 },
      ];

      const wowColW = (cw - SPACE.md * 3) / 4;

      wowMetrics.forEach((metric, idx) => {
        const x = m.l + idx * (wowColW + SPACE.md);
        
        doc.setFillColor(...COLORS.surface);
        doc.roundedRect(x, cp1Y, wowColW, 28, 2, 2, 'F');
        
        // Status indicator
        doc.setFillColor(...(metric.good ? COLORS.emerald : COLORS.ruby));
        doc.rect(x, cp1Y + 4, 2, 20, 'F');
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(TYPE.micro);
        doc.setTextColor(...COLORS.muted);
        doc.text(metric.label, x + 8, cp1Y + 10);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(TYPE.title);
        doc.setTextColor(...(metric.good ? COLORS.emerald : COLORS.ruby));
        doc.text(metric.value, x + 8, cp1Y + 22);
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(TYPE.micro);
      doc.setTextColor(...COLORS.subtle);
      doc.text('Compared to: ' + sanitize(wow.previousDate), m.l, cp1Y + 36);
    }

    // ════════════════════════════════════════════════════════════════════════
    // FOOTER - PAGE 3
    // ════════════════════════════════════════════════════════════════════════
    
    doc.setFillColor(...COLORS.surface);
    doc.rect(0, ph - 14, pw, 14, 'F');
    doc.setFillColor(...COLORS.goldMuted);
    doc.rect(0, ph - 14, pw, 0.5, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TYPE.micro);
    doc.setTextColor(...COLORS.subtle);
    doc.text('CONFIDENTIAL - BOARD DISTRIBUTION ONLY', m.l, ph - 6);
    doc.text('Fred Loya Insurance | Claims Discipline Command', pw / 2, ph - 6, { align: 'center' });
    doc.text('Page 3 of 3', pw - m.r, ph - 6, { align: 'right' });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SAVE
  // ══════════════════════════════════════════════════════════════════════════
  
  const filename = 'Board_Briefing_' + format(new Date(), 'yyyyMMdd_HHmm') + '.pdf';
  doc.save(filename);
  
  return filename;
}
