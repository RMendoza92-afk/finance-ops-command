/**
 * Bloomberg Terminal-Style PDF Export
 * Premium dark theme, data-dense, CEO-ready financial reporting
 */
import jsPDF from 'jspdf';
import { format } from 'date-fns';

// Premium Bloomberg terminal color palette
const C = {
  // Backgrounds
  black: { r: 0, g: 0, b: 0 },
  bgDark: { r: 12, g: 14, b: 18 },
  bgCard: { r: 18, g: 21, b: 27 },
  bgHeader: { r: 25, g: 29, b: 38 },
  bgRow: { r: 15, g: 17, b: 22 },
  bgRowAlt: { r: 20, g: 23, b: 30 },
  
  // Accent colors
  orange: { r: 255, g: 136, b: 0 },
  orangeDim: { r: 180, g: 100, b: 20 },
  gold: { r: 255, g: 200, b: 80 },
  cyan: { r: 0, g: 200, b: 255 },
  
  // Status colors
  green: { r: 0, g: 230, b: 118 },
  greenDim: { r: 0, g: 160, b: 80 },
  red: { r: 255, g: 82, b: 82 },
  redDim: { r: 180, g: 60, b: 60 },
  yellow: { r: 255, g: 235, b: 59 },
  
  // Text
  white: { r: 255, g: 255, b: 255 },
  textPrimary: { r: 240, g: 242, b: 245 },
  textSecondary: { r: 160, g: 165, b: 175 },
  textMuted: { r: 100, g: 105, b: 115 },
  
  // Grid
  gridLine: { r: 35, g: 40, b: 50 },
  gridLineBright: { r: 50, g: 55, b: 65 },
};

interface DrilldownData {
  title: string;
  subtitle: string;
  timestamp: string;
  metrics: Array<{ 
    label: string; 
    value: string; 
    delta?: string; 
    status?: 'positive' | 'negative' | 'neutral' | 'warning';
    subvalue?: string;
  }>;
  table?: {
    headers: string[];
    rows: Array<string[]>;
    alignments?: ('left' | 'right' | 'center')[];
    highlights?: number[]; // row indices to highlight
  };
  summary?: string;
  riskLevel?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
}

const setColor = (doc: jsPDF, c: { r: number; g: number; b: number }) => {
  doc.setTextColor(c.r, c.g, c.b);
};

const setFill = (doc: jsPDF, c: { r: number; g: number; b: number }) => {
  doc.setFillColor(c.r, c.g, c.b);
};

const setDraw = (doc: jsPDF, c: { r: number; g: number; b: number }) => {
  doc.setDrawColor(c.r, c.g, c.b);
};

// Draw gradient bar (simulated with bands)
function drawGradientBar(doc: jsPDF, x: number, y: number, w: number, h: number, fromColor: typeof C.orange, toColor: typeof C.orangeDim, steps = 20) {
  const stepW = w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const r = Math.round(fromColor.r + (toColor.r - fromColor.r) * t);
    const g = Math.round(fromColor.g + (toColor.g - fromColor.g) * t);
    const b = Math.round(fromColor.b + (toColor.b - fromColor.b) * t);
    doc.setFillColor(r, g, b);
    doc.rect(x + i * stepW, y, stepW + 0.5, h, 'F');
  }
}

// Draw scanlines effect (subtle horizontal lines)
function drawScanlines(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.05);
  for (let i = 0; i < h; i += 2) {
    doc.setDrawColor(255, 255, 255);
    doc.line(x, y + i, x + w, y + i);
  }
}

export function generateBloombergDrilldown(data: DrilldownData): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 10; // margin

  // === BACKGROUND ===
  setFill(doc, C.bgDark);
  doc.rect(0, 0, W, H, 'F');

  // === TOP ACCENT BAR (gradient) ===
  drawGradientBar(doc, 0, 0, W, 4, C.orange, { r: 200, g: 80, b: 0 });

  // === HEADER BAND ===
  setFill(doc, C.bgHeader);
  doc.rect(0, 4, W, 28, 'F');

  // Header left: Brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, C.orange);
  doc.text('FLI', M, 14);
  
  doc.setFontSize(9);
  setColor(doc, C.textMuted);
  doc.text('CLAIMS INTELLIGENCE', M + 12, 14);

  // Header center: Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  setColor(doc, C.white);
  doc.text(data.title.toUpperCase(), W / 2, 18, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, C.textSecondary);
  doc.text(data.subtitle, W / 2, 26, { align: 'center' });

  // Header right: Timestamp & Risk Level
  doc.setFontSize(8);
  setColor(doc, C.textMuted);
  doc.text(data.timestamp, W - M, 12, { align: 'right' });
  
  // Risk indicator badge
  if (data.riskLevel) {
    const riskColors: Record<string, typeof C.green> = {
      LOW: C.green,
      MODERATE: C.yellow,
      HIGH: C.orange,
      CRITICAL: C.red,
    };
    const rc = riskColors[data.riskLevel] || C.textMuted;
    
    setFill(doc, rc);
    doc.roundedRect(W - M - 30, 18, 30, 8, 1, 1, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setColor(doc, C.black);
    doc.text(data.riskLevel, W - M - 15, 23.5, { align: 'center' });
  }

  // === METRICS SECTION ===
  let y = 38;
  
  if (data.metrics.length > 0) {
    const numCols = Math.min(data.metrics.length, 4);
    const cardW = (W - M * 2 - (numCols - 1) * 4) / numCols;
    const cardH = 28;

    data.metrics.slice(0, 4).forEach((metric, i) => {
      const x = M + i * (cardW + 4);
      
      // Card background with border
      setFill(doc, C.bgCard);
      doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F');
      
      // Left accent stripe
      const stripeColor = metric.status === 'positive' ? C.green 
        : metric.status === 'negative' ? C.red 
        : metric.status === 'warning' ? C.yellow
        : C.orange;
      setFill(doc, stripeColor);
      doc.rect(x, y, 3, cardH, 'F');
      
      // Top glow line
      drawGradientBar(doc, x + 3, y, cardW - 3, 1, stripeColor, C.bgCard, 10);

      // Label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      setColor(doc, C.textMuted);
      doc.text(metric.label.toUpperCase(), x + 8, y + 8);

      // Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      setColor(doc, C.white);
      doc.text(metric.value, x + 8, y + 19);

      // Delta badge
      if (metric.delta) {
        const deltaColor = metric.delta.startsWith('+') ? C.green : metric.delta.startsWith('-') ? C.red : C.textMuted;
        
        setFill(doc, { r: deltaColor.r, g: deltaColor.g, b: deltaColor.b });
        doc.setFontSize(7);
        const deltaWidth = doc.getTextWidth(metric.delta) + 4;
        doc.roundedRect(x + cardW - deltaWidth - 6, y + 4, deltaWidth, 5, 1, 1, 'F');
        
        setColor(doc, C.black);
        doc.setFont('helvetica', 'bold');
        doc.text(metric.delta, x + cardW - 6 - deltaWidth / 2, y + 7.5, { align: 'center' });
      }

      // Subvalue
      if (metric.subvalue) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        setColor(doc, C.textSecondary);
        doc.text(metric.subvalue, x + 8, y + 25);
      }
    });

    y += cardH + 6;
  }

  // Second row of metrics (if more than 4)
  if (data.metrics.length > 4) {
    const numCols = Math.min(data.metrics.length - 4, 4);
    const cardW = (W - M * 2 - (numCols - 1) * 4) / numCols;
    const cardH = 20;

    data.metrics.slice(4, 8).forEach((metric, i) => {
      const x = M + i * (cardW + 4);
      
      setFill(doc, C.bgCard);
      doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F');
      
      setFill(doc, C.cyan);
      doc.rect(x, y, 2, cardH, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      setColor(doc, C.textMuted);
      doc.text(metric.label.toUpperCase(), x + 6, y + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      setColor(doc, C.textPrimary);
      doc.text(metric.value, x + 6, y + 14);
    });

    y += cardH + 6;
  }

  // === DATA TABLE ===
  if (data.table && data.table.rows.length > 0) {
    const cols = data.table.headers.length;
    const tableW = W - M * 2;
    const colW = tableW / cols;
    const headerH = 10;
    const rowH = 7;

    // Table container
    setDraw(doc, C.gridLineBright);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, tableW, Math.min((data.table.rows.length + 1) * rowH + headerH, H - y - 30), 2, 2, 'S');

    // Table header
    setFill(doc, C.bgHeader);
    doc.roundedRect(M, y, tableW, headerH, 2, 2, 'F');
    
    // Fill corners under rounded rect
    setFill(doc, C.bgHeader);
    doc.rect(M, y + 2, tableW, headerH - 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setColor(doc, C.orange);

    data.table.headers.forEach((header, i) => {
      const align = data.table?.alignments?.[i] || 'left';
      let tx = M + i * colW + 4;
      if (align === 'right') tx = M + (i + 1) * colW - 4;
      else if (align === 'center') tx = M + i * colW + colW / 2;
      doc.text(header.toUpperCase(), tx, y + 7, { align: align as any });
    });

    y += headerH;

    // Header underline
    setDraw(doc, C.orange);
    doc.setLineWidth(0.5);
    doc.line(M + 2, y, M + tableW - 2, y);

    y += 1;

    // Table rows
    const maxRows = Math.min(data.table.rows.length, Math.floor((H - y - 28) / rowH));

    data.table.rows.slice(0, maxRows).forEach((row, rowIdx) => {
      // Alternating background
      setFill(doc, rowIdx % 2 === 0 ? C.bgRow : C.bgRowAlt);
      doc.rect(M + 0.5, y, tableW - 1, rowH, 'F');

      // Highlight high-priority rows
      const isHighlight = data.table?.highlights?.includes(rowIdx);
      if (isHighlight) {
        setFill(doc, C.redDim);
        doc.rect(M + 0.5, y, 2, rowH, 'F');
      }

      row.forEach((cell, colIdx) => {
        const align = data.table?.alignments?.[colIdx] || 'left';
        let tx = M + colIdx * colW + 4;
        if (align === 'right') tx = M + (colIdx + 1) * colW - 4;
        else if (align === 'center') tx = M + colIdx * colW + colW / 2;

        // First column in cyan, rest in white
        if (colIdx === 0) {
          doc.setFont('helvetica', 'bold');
          setColor(doc, C.cyan);
        } else {
          doc.setFont('helvetica', 'normal');
          setColor(doc, C.textPrimary);
        }
        doc.setFontSize(7);
        doc.text(cell.substring(0, 30), tx, y + 5, { align: align as any });
      });

      y += rowH;
    });

    // Truncation notice
    if (data.table.rows.length > maxRows) {
      y += 3;
      doc.setFontSize(6);
      setColor(doc, C.textMuted);
      doc.text(`Showing ${maxRows} of ${data.table.rows.length} records`, M + 2, y);
    }
  }

  // === SUMMARY BOX ===
  if (data.summary) {
    const summaryY = H - 28;
    
    setFill(doc, C.bgCard);
    doc.roundedRect(M, summaryY, W - M * 2, 14, 2, 2, 'F');
    
    // Left accent
    setFill(doc, C.gold);
    doc.rect(M, summaryY, 3, 14, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setColor(doc, C.gold);
    doc.text('EXECUTIVE SUMMARY', M + 8, summaryY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setColor(doc, C.textPrimary);
    doc.text(data.summary.substring(0, 180), M + 8, summaryY + 11);
  }

  // === FOOTER ===
  const footerY = H - 12;
  
  // Footer bar
  setFill(doc, C.bgHeader);
  doc.rect(0, footerY - 2, W, 14, 'F');
  
  // Bottom accent line
  drawGradientBar(doc, 0, H - 2, W, 2, { r: 200, g: 80, b: 0 }, C.orange);

  // Footer content
  doc.setFontSize(6);
  
  setColor(doc, C.textMuted);
  doc.text('CONFIDENTIAL', M, footerY + 3);
  doc.text('|', M + 22, footerY + 3);
  doc.text('EXECUTIVE USE ONLY', M + 26, footerY + 3);
  
  setColor(doc, C.textSecondary);
  doc.text(`Generated ${format(new Date(), "yyyy-MM-dd 'at' HH:mm:ss")}`, W / 2, footerY + 3, { align: 'center' });
  
  doc.setFont('helvetica', 'bold');
  setColor(doc, C.orange);
  doc.text('FLI CLAIMS INTELLIGENCE TERMINAL', W - M, footerY + 3, { align: 'right' });

  // === SAVE ===
  const filename = `FLI_${data.title.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
  doc.save(filename);
}

// === CONVENIENCE EXPORTS ===

const formatM = (v: number) => `$${(v / 1_000_000).toFixed(1)}M`;
const formatK = (v: number) => `$${(v / 1_000).toFixed(0)}K`;

export function exportClaimsDrilldown(
  totalClaims: number,
  totalReserves: number,
  typeGroupData: Array<{ typeGroup: string; grandTotal: number; reserves: number }>,
  claimReviews: Array<{ claim_id: string; area: string; reserves: number; status: string }>
): void {
  const litCount = typeGroupData.find(t => t.typeGroup === 'LIT')?.grandTotal || 0;
  const plCount = typeGroupData.find(t => t.typeGroup === 'PL')?.grandTotal || 0;
  const litPct = ((litCount / totalClaims) * 100).toFixed(1);

  generateBloombergDrilldown({
    title: 'Claims Inventory Analysis',
    subtitle: 'Portfolio Distribution by Type Group & Phase',
    timestamp: format(new Date(), 'MMM d, yyyy h:mm a'),
    riskLevel: litCount > 5000 ? 'HIGH' : litCount > 3000 ? 'MODERATE' : 'LOW',
    metrics: [
      { label: 'Total Open Claims', value: totalClaims.toLocaleString(), status: 'neutral', subvalue: 'Active inventory' },
      { label: 'Total Reserves', value: formatM(totalReserves), status: 'neutral', subvalue: 'Gross exposure' },
      { label: 'Litigation', value: litCount.toLocaleString(), delta: `${litPct}%`, status: 'negative', subvalue: 'Active lawsuits' },
      { label: 'Pre-Litigation', value: plCount.toLocaleString(), status: 'warning', subvalue: 'Demand received' },
    ],
    table: {
      headers: ['Claim ID', 'Area', 'Reserves', 'Status'],
      rows: claimReviews.slice(0, 25).map(r => [r.claim_id, r.area, formatK(r.reserves), r.status.toUpperCase()]),
      alignments: ['left', 'left', 'right', 'left'],
      highlights: claimReviews.slice(0, 25).map((r, i) => r.status === 'flagged' ? i : -1).filter(i => i >= 0),
    },
    summary: `${totalClaims.toLocaleString()} open claims with ${formatM(totalReserves)} in reserves. Litigation represents ${litPct}% of inventory requiring priority resolution.`,
  });
}

export function exportReservesDrilldown(
  totalReserves: number,
  lowEval: number,
  highEval: number,
  noEvalReserves: number,
  ageData: Array<{ age: string; claims: number; openReserves: number }>
): void {
  const lowPct = ((lowEval / totalReserves) * 100).toFixed(1);
  const highPct = ((highEval / totalReserves) * 100).toFixed(1);
  const noEvalPct = ((noEvalReserves / totalReserves) * 100).toFixed(1);
  const gap = highEval - lowEval;

  generateBloombergDrilldown({
    title: 'Reserves Analysis',
    subtitle: 'Portfolio Reserve Distribution & Evaluation Coverage',
    timestamp: format(new Date(), 'MMM d, yyyy h:mm a'),
    riskLevel: parseFloat(noEvalPct) > 50 ? 'CRITICAL' : parseFloat(noEvalPct) > 30 ? 'HIGH' : 'MODERATE',
    metrics: [
      { label: 'Total Reserves', value: formatM(totalReserves), status: 'neutral', subvalue: 'Portfolio exposure' },
      { label: 'Low Eval', value: formatM(lowEval), delta: `${lowPct}%`, status: 'positive', subvalue: 'Conservative estimate' },
      { label: 'High Eval', value: formatM(highEval), delta: `${highPct}%`, status: 'negative', subvalue: 'Maximum exposure' },
      { label: 'Evaluation Gap', value: formatM(gap), status: 'warning', subvalue: 'Hi-Lo variance' },
      { label: 'No Evaluation', value: formatM(noEvalReserves), delta: `${noEvalPct}%`, status: 'negative', subvalue: 'Unassessed risk' },
    ],
    table: {
      headers: ['Age Bucket', 'Claims', 'Reserves', '% of Total'],
      rows: ageData.map(a => [
        a.age, 
        a.claims.toLocaleString(), 
        formatM(a.openReserves),
        `${((a.openReserves / totalReserves) * 100).toFixed(1)}%`
      ]),
      alignments: ['left', 'right', 'right', 'right'],
    },
    summary: `${formatM(noEvalReserves)} (${noEvalPct}%) in reserves lack evaluation. Evaluation gap of ${formatM(gap)} between low and high estimates indicates uncertainty.`,
  });
}

export function exportDecisionsDrilldown(
  pendingCount: number,
  totalExposure: number,
  claims: Array<{ claimNumber: string; team: string; reserves: number; painLevel: string }>
): void {
  const highPainCount = claims.filter(c => c.painLevel.includes('5+') || c.painLevel === 'Limits').length;
  const avgExposure = pendingCount > 0 ? totalExposure / pendingCount : 0;

  generateBloombergDrilldown({
    title: 'Decisions Pending',
    subtitle: 'Claims Requiring Executive Authorization',
    timestamp: format(new Date(), 'MMM d, yyyy h:mm a'),
    riskLevel: pendingCount > 50 ? 'CRITICAL' : pendingCount > 25 ? 'HIGH' : pendingCount > 10 ? 'MODERATE' : 'LOW',
    metrics: [
      { label: 'Pending Decisions', value: pendingCount.toLocaleString(), status: 'negative', subvalue: 'Awaiting action' },
      { label: 'Total Exposure', value: formatM(totalExposure), status: 'negative', subvalue: 'At-risk reserves' },
      { label: 'Avg Claim Exposure', value: formatK(avgExposure), status: 'warning', subvalue: 'Per decision' },
      { label: 'High Pain Level', value: highPainCount.toString(), delta: highPainCount > 0 ? 'URGENT' : undefined, status: 'negative', subvalue: 'Critical attention' },
    ],
    table: {
      headers: ['Claim Number', 'Team', 'Reserves', 'Pain Level'],
      rows: claims.slice(0, 25).map(c => [c.claimNumber, c.team, formatK(c.reserves), c.painLevel]),
      alignments: ['left', 'left', 'right', 'left'],
      highlights: claims.slice(0, 25).map((c, i) => c.painLevel.includes('5+') || c.painLevel === 'Limits' ? i : -1).filter(i => i >= 0),
    },
    summary: `${pendingCount} decisions pending with ${formatM(totalExposure)} in total exposure. ${highPainCount} claims flagged at high pain level requiring immediate attention.`,
  });
}

export function exportAgedDrilldown(
  agedCount: number,
  agedReserves: number,
  totalClaims: number,
  claims: Array<{ claim_id: string; area: string; reserves: number; status: string }>
): void {
  const pctOfInventory = ((agedCount / totalClaims) * 100).toFixed(1);
  const avgReserve = agedCount > 0 ? agedReserves / agedCount : 0;

  generateBloombergDrilldown({
    title: 'Aged Claims Analysis',
    subtitle: 'Claims Exceeding 365 Days Open',
    timestamp: format(new Date(), 'MMM d, yyyy h:mm a'),
    riskLevel: parseFloat(pctOfInventory) > 30 ? 'CRITICAL' : parseFloat(pctOfInventory) > 20 ? 'HIGH' : 'MODERATE',
    metrics: [
      { label: 'Aged 365+ Claims', value: agedCount.toLocaleString(), status: 'negative', subvalue: 'Over one year' },
      { label: 'Reserve Exposure', value: formatM(agedReserves), status: 'negative', subvalue: 'Aged inventory' },
      { label: '% of Inventory', value: `${pctOfInventory}%`, status: 'negative', subvalue: 'Portfolio share' },
      { label: 'Avg Reserve', value: formatK(avgReserve), status: 'warning', subvalue: 'Per aged claim' },
    ],
    table: {
      headers: ['Claim ID', 'Area', 'Reserves', 'Status'],
      rows: claims.slice(0, 25).map(c => [c.claim_id, c.area, formatK(c.reserves), c.status.toUpperCase()]),
      alignments: ['left', 'left', 'right', 'left'],
    },
    summary: `${agedCount.toLocaleString()} claims aged 365+ days represent ${pctOfInventory}% of portfolio with ${formatM(agedReserves)} in exposure. Target aggressive resolution strategy.`,
  });
}

export function exportNoEvalDrilldown(
  noEvalCount: number,
  noEvalReserves: number,
  totalClaims: number
): void {
  const pctOfInventory = ((noEvalCount / totalClaims) * 100).toFixed(1);
  const avgReserve = noEvalCount > 0 ? noEvalReserves / noEvalCount : 0;

  generateBloombergDrilldown({
    title: 'No Evaluation Claims',
    subtitle: 'Claims Without Damage Assessment',
    timestamp: format(new Date(), 'MMM d, yyyy h:mm a'),
    riskLevel: parseFloat(pctOfInventory) > 60 ? 'CRITICAL' : parseFloat(pctOfInventory) > 40 ? 'HIGH' : 'MODERATE',
    metrics: [
      { label: 'Claims Without Eval', value: noEvalCount.toLocaleString(), status: 'negative', subvalue: 'No assessment' },
      { label: 'Exposure at Risk', value: formatM(noEvalReserves), status: 'negative', subvalue: 'Unquantified' },
      { label: '% of Inventory', value: `${pctOfInventory}%`, status: 'negative', subvalue: 'Blind exposure' },
      { label: 'Avg per Claim', value: formatK(avgReserve), status: 'warning', subvalue: 'Reserve basis' },
    ],
    summary: `${noEvalCount.toLocaleString()} claims (${pctOfInventory}%) lack evaluation representing ${formatM(noEvalReserves)} in unquantified risk. Priority: Complete evaluations within 48 hours.`,
  });
}

export function exportCP1Drilldown(
  cp1Count: number,
  cp1Rate: string,
  targetRate: number = 35
): void {
  const currentRate = parseFloat(cp1Rate);
  const gap = targetRate - currentRate;
  const onTrack = currentRate >= targetRate;

  generateBloombergDrilldown({
    title: 'CP1 Analysis',
    subtitle: 'Claims Within Policy Limits',
    timestamp: format(new Date(), 'MMM d, yyyy h:mm a'),
    riskLevel: onTrack ? 'LOW' : gap > 10 ? 'HIGH' : 'MODERATE',
    metrics: [
      { label: 'Current CP1 Rate', value: cp1Rate, status: onTrack ? 'positive' : 'negative', subvalue: 'Policy limit coverage' },
      { label: 'Claims in CP1', value: cp1Count.toLocaleString(), status: 'positive', subvalue: 'Within limits' },
      { label: 'Target Rate', value: `${targetRate}%`, status: 'neutral', subvalue: 'Benchmark goal' },
      { label: 'Gap to Target', value: gap > 0 ? `${gap.toFixed(1)}%` : 'On Target ✓', status: onTrack ? 'positive' : 'negative', subvalue: gap > 0 ? 'Improvement needed' : 'Goal achieved' },
    ],
    summary: onTrack 
      ? `CP1 rate at ${cp1Rate} exceeds target of ${targetRate}%. ${cp1Count.toLocaleString()} claims resolved within policy limits. Continue current strategy.`
      : `CP1 rate at ${cp1Rate} is ${gap.toFixed(1)}% below target. Focus on resolution within policy limits to reduce excess exposure.`,
  });
}

export function exportBudgetDrilldown(
  ytd2026: number,
  ytd2025: number
): void {
  const projected2026 = ytd2026 * 12;
  const yoyChange = ytd2025 > 0 ? ((projected2026 - ytd2025) / ytd2025 * 100) : 0;
  const monthlyRun = ytd2026;

  generateBloombergDrilldown({
    title: 'Budget & Spend Analysis',
    subtitle: 'BI Litigation Expenditure Tracking',
    timestamp: format(new Date(), 'MMM d, yyyy h:mm a'),
    riskLevel: yoyChange > 20 ? 'HIGH' : yoyChange > 10 ? 'MODERATE' : 'LOW',
    metrics: [
      { label: '2026 YTD', value: formatK(ytd2026), delta: 'Jan Only', status: 'neutral', subvalue: 'Current spend' },
      { label: '2025 Full Year', value: formatM(ytd2025), status: 'neutral', subvalue: 'Prior year actual' },
      { label: 'Projected 2026', value: formatM(projected2026), status: yoyChange > 0 ? 'negative' : 'positive', subvalue: 'Annualized' },
      { label: 'YoY Trajectory', value: `${yoyChange > 0 ? '+' : ''}${yoyChange.toFixed(1)}%`, status: yoyChange > 0 ? 'negative' : 'positive', subvalue: 'vs 2025 baseline' },
      { label: 'Monthly Run Rate', value: formatK(monthlyRun), status: 'neutral', subvalue: 'Current pace' },
    ],
    summary: `2026 projected at ${formatM(projected2026)} based on Jan spend of ${formatK(ytd2026)}. ${yoyChange > 0 ? 'Trending above' : 'Trending below'} 2025 baseline of ${formatM(ytd2025)}.`,
  });
}
