/**
 * Bloomberg Terminal-Style PDF Export
 * Dark, data-dense, professional financial reporting
 */
import jsPDF from 'jspdf';
import { format } from 'date-fns';

// Bloomberg terminal color palette
const BLOOMBERG = {
  bg: { r: 15, g: 17, b: 21 },           // Near black
  bgAlt: { r: 22, g: 25, b: 31 },        // Slightly lighter
  text: { r: 255, g: 255, b: 255 },      // White
  textMuted: { r: 140, g: 145, b: 155 }, // Gray
  accent: { r: 255, g: 136, b: 0 },      // Bloomberg orange
  green: { r: 0, g: 200, b: 100 },       // Positive
  red: { r: 255, g: 75, b: 75 },         // Negative
  blue: { r: 50, g: 150, b: 255 },       // Info
  grid: { r: 40, g: 45, b: 55 },         // Grid lines
  header: { r: 30, g: 35, b: 45 },       // Header bg
};

interface DrilldownData {
  title: string;
  subtitle: string;
  timestamp: string;
  metrics: Array<{ label: string; value: string; delta?: string; status?: 'positive' | 'negative' | 'neutral' }>;
  table?: {
    headers: string[];
    rows: Array<string[]>;
    alignments?: ('left' | 'right' | 'center')[];
  };
  summary?: string;
}

const setColor = (doc: jsPDF, color: { r: number; g: number; b: number }) => {
  doc.setTextColor(color.r, color.g, color.b);
};

const setFillColor = (doc: jsPDF, color: { r: number; g: number; b: number }) => {
  doc.setFillColor(color.r, color.g, color.b);
};

const setDrawColor = (doc: jsPDF, color: { r: number; g: number; b: number }) => {
  doc.setDrawColor(color.r, color.g, color.b);
};

export function generateBloombergDrilldown(data: DrilldownData): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Background
  setFillColor(doc, BLOOMBERG.bg);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Top bar with orange accent
  setFillColor(doc, BLOOMBERG.accent);
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Header section
  setFillColor(doc, BLOOMBERG.header);
  doc.rect(0, 3, pageWidth, 22, 'F');

  // Bloomberg-style title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  setColor(doc, BLOOMBERG.accent);
  doc.text('CLAIMS INTELLIGENCE', margin, 14);

  doc.setFontSize(12);
  setColor(doc, BLOOMBERG.text);
  doc.text(data.title.toUpperCase(), margin, 21);

  // Right side metadata
  doc.setFontSize(8);
  setColor(doc, BLOOMBERG.textMuted);
  doc.text(data.timestamp, pageWidth - margin, 12, { align: 'right' });
  doc.text(data.subtitle, pageWidth - margin, 18, { align: 'right' });
  
  // Terminal identifier
  doc.setFontSize(7);
  setColor(doc, BLOOMBERG.accent);
  doc.text('FLI TERMINAL', pageWidth - margin, 23, { align: 'right' });

  let yPos = 32;

  // Metrics grid
  if (data.metrics.length > 0) {
    const metricBoxWidth = (pageWidth - margin * 2) / Math.min(data.metrics.length, 4);
    const metricBoxHeight = 22;

    data.metrics.slice(0, 4).forEach((metric, idx) => {
      const x = margin + idx * metricBoxWidth;
      
      // Metric box background
      setFillColor(doc, BLOOMBERG.bgAlt);
      doc.rect(x, yPos, metricBoxWidth - 2, metricBoxHeight, 'F');
      
      // Left accent bar based on status
      const accentColor = metric.status === 'positive' ? BLOOMBERG.green 
        : metric.status === 'negative' ? BLOOMBERG.red 
        : BLOOMBERG.accent;
      setFillColor(doc, accentColor);
      doc.rect(x, yPos, 2, metricBoxHeight, 'F');

      // Label
      doc.setFontSize(7);
      setColor(doc, BLOOMBERG.textMuted);
      doc.text(metric.label.toUpperCase(), x + 5, yPos + 6);

      // Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      setColor(doc, BLOOMBERG.text);
      doc.text(metric.value, x + 5, yPos + 15);

      // Delta if present
      if (metric.delta) {
        doc.setFontSize(8);
        const deltaColor = metric.delta.startsWith('+') ? BLOOMBERG.green : metric.delta.startsWith('-') ? BLOOMBERG.red : BLOOMBERG.textMuted;
        setColor(doc, deltaColor);
        doc.text(metric.delta, x + 5, yPos + 20);
      }
    });

    yPos += metricBoxHeight + 8;
  }

  // Secondary row of metrics if more than 4
  if (data.metrics.length > 4) {
    const metricBoxWidth = (pageWidth - margin * 2) / Math.min(data.metrics.length - 4, 4);
    const metricBoxHeight = 18;

    data.metrics.slice(4, 8).forEach((metric, idx) => {
      const x = margin + idx * metricBoxWidth;
      
      setFillColor(doc, BLOOMBERG.bgAlt);
      doc.rect(x, yPos, metricBoxWidth - 2, metricBoxHeight, 'F');
      
      setFillColor(doc, BLOOMBERG.blue);
      doc.rect(x, yPos, 2, metricBoxHeight, 'F');

      doc.setFontSize(7);
      setColor(doc, BLOOMBERG.textMuted);
      doc.text(metric.label.toUpperCase(), x + 5, yPos + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      setColor(doc, BLOOMBERG.text);
      doc.text(metric.value, x + 5, yPos + 13);
    });

    yPos += metricBoxHeight + 8;
  }

  // Data table
  if (data.table && data.table.rows.length > 0) {
    const colCount = data.table.headers.length;
    const tableWidth = pageWidth - margin * 2;
    const colWidth = tableWidth / colCount;
    const rowHeight = 7;
    const headerHeight = 9;

    // Table header
    setFillColor(doc, BLOOMBERG.header);
    doc.rect(margin, yPos, tableWidth, headerHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setColor(doc, BLOOMBERG.accent);

    data.table.headers.forEach((header, idx) => {
      const align = data.table?.alignments?.[idx] || 'left';
      const x = margin + idx * colWidth + (align === 'right' ? colWidth - 3 : 3);
      doc.text(header.toUpperCase(), x, yPos + 6, { align: align as any });
    });

    yPos += headerHeight;

    // Grid line under header
    setDrawColor(doc, BLOOMBERG.grid);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);

    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    const maxRows = Math.min(data.table.rows.length, Math.floor((pageHeight - yPos - 25) / rowHeight));

    data.table.rows.slice(0, maxRows).forEach((row, rowIdx) => {
      // Alternating row background
      if (rowIdx % 2 === 1) {
        setFillColor(doc, BLOOMBERG.bgAlt);
        doc.rect(margin, yPos, tableWidth, rowHeight, 'F');
      }

      setColor(doc, BLOOMBERG.text);
      row.forEach((cell, colIdx) => {
        const align = data.table?.alignments?.[colIdx] || 'left';
        const x = margin + colIdx * colWidth + (align === 'right' ? colWidth - 3 : 3);
        
        // Highlight first column
        if (colIdx === 0) {
          doc.setFont('helvetica', 'bold');
          setColor(doc, BLOOMBERG.blue);
        } else {
          doc.setFont('helvetica', 'normal');
          setColor(doc, BLOOMBERG.text);
        }
        
        doc.text(cell.substring(0, 25), x, yPos + 5, { align: align as any });
      });

      yPos += rowHeight;
    });

    // Show truncation notice if needed
    if (data.table.rows.length > maxRows) {
      yPos += 3;
      doc.setFontSize(6);
      setColor(doc, BLOOMBERG.textMuted);
      doc.text(`Showing ${maxRows} of ${data.table.rows.length} records`, margin, yPos);
    }
  }

  // Footer bar
  const footerY = pageHeight - 10;
  setFillColor(doc, BLOOMBERG.header);
  doc.rect(0, footerY - 2, pageWidth, 12, 'F');

  // Bottom accent line
  setFillColor(doc, BLOOMBERG.accent);
  doc.rect(0, pageHeight - 2, pageWidth, 2, 'F');

  // Footer text
  doc.setFontSize(6);
  setColor(doc, BLOOMBERG.textMuted);
  doc.text('CONFIDENTIAL - EXECUTIVE USE ONLY', margin, footerY + 3);
  doc.text(`Generated ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, pageWidth / 2, footerY + 3, { align: 'center' });
  
  setColor(doc, BLOOMBERG.accent);
  doc.text('FLI CLAIMS INTELLIGENCE', pageWidth - margin, footerY + 3, { align: 'right' });

  // Summary text if provided
  if (data.summary) {
    const summaryY = footerY - 12;
    setFillColor(doc, BLOOMBERG.bgAlt);
    doc.roundedRect(margin, summaryY - 6, pageWidth - margin * 2, 10, 1, 1, 'F');
    
    doc.setFontSize(7);
    setColor(doc, BLOOMBERG.textMuted);
    doc.text('SUMMARY: ', margin + 3, summaryY);
    
    setColor(doc, BLOOMBERG.text);
    doc.text(data.summary.substring(0, 150), margin + 22, summaryY);
  }

  // Save
  const filename = `FLI_${data.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
  doc.save(filename);
}

// Convenience exports for common drilldowns
export function exportClaimsDrilldown(
  totalClaims: number,
  totalReserves: number,
  typeGroupData: Array<{ typeGroup: string; grandTotal: number; reserves: number }>,
  claimReviews: Array<{ claim_id: string; area: string; reserves: number; status: string }>
): void {
  const formatM = (v: number) => `$${(v / 1_000_000).toFixed(1)}M`;
  const formatK = (v: number) => `$${(v / 1_000).toFixed(0)}K`;

  generateBloombergDrilldown({
    title: 'Claims Inventory Analysis',
    subtitle: 'Portfolio Distribution & Review Status',
    timestamp: format(new Date(), 'MMM d, yyyy h:mm a'),
    metrics: [
      { label: 'Total Claims', value: totalClaims.toLocaleString(), status: 'neutral' },
      { label: 'Total Reserves', value: formatM(totalReserves), status: 'neutral' },
      { label: 'Litigation', value: (typeGroupData.find(t => t.typeGroup === 'LIT')?.grandTotal || 0).toLocaleString(), status: 'negative' },
      { label: 'Pre-Lit', value: (typeGroupData.find(t => t.typeGroup === 'PL')?.grandTotal || 0).toLocaleString(), status: 'neutral' },
    ],
    table: {
      headers: ['Claim ID', 'Area', 'Reserves', 'Status'],
      rows: claimReviews.map(r => [r.claim_id, r.area, formatK(r.reserves), r.status.toUpperCase()]),
      alignments: ['left', 'left', 'right', 'left'],
    },
    summary: `${totalClaims.toLocaleString()} open claims with ${formatM(totalReserves)} in reserves. ${typeGroupData.length} type groups active.`,
  });
}

export function exportReservesDrilldown(
  totalReserves: number,
  lowEval: number,
  highEval: number,
  noEvalReserves: number,
  ageData: Array<{ age: string; claims: number; openReserves: number }>
): void {
  const formatM = (v: number) => `$${(v / 1_000_000).toFixed(1)}M`;
  const lowPct = ((lowEval / totalReserves) * 100).toFixed(1);
  const highPct = ((highEval / totalReserves) * 100).toFixed(1);
  const noEvalPct = ((noEvalReserves / totalReserves) * 100).toFixed(1);

  generateBloombergDrilldown({
    title: 'Reserves Analysis',
    subtitle: 'Portfolio Reserve Distribution',
    timestamp: format(new Date(), 'MMM d, yyyy h:mm a'),
    metrics: [
      { label: 'Total Reserves', value: formatM(totalReserves), status: 'neutral' },
      { label: 'Low Eval', value: formatM(lowEval), delta: `${lowPct}%`, status: 'positive' },
      { label: 'High Eval', value: formatM(highEval), delta: `${highPct}%`, status: 'negative' },
      { label: 'No Eval', value: formatM(noEvalReserves), delta: `${noEvalPct}%`, status: 'negative' },
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
    summary: `${formatM(noEvalReserves)} (${noEvalPct}%) in reserves lack proper evaluation. High eval exposure: ${formatM(highEval)}.`,
  });
}

export function exportDecisionsDrilldown(
  pendingCount: number,
  totalExposure: number,
  claims: Array<{ claimNumber: string; team: string; reserves: number; painLevel: string }>
): void {
  const formatM = (v: number) => `$${(v / 1_000_000).toFixed(1)}M`;
  const formatK = (v: number) => `$${(v / 1_000).toFixed(0)}K`;

  generateBloombergDrilldown({
    title: 'Decisions Pending',
    subtitle: 'Executive Action Required',
    timestamp: format(new Date(), 'MMM d, yyyy h:mm a'),
    metrics: [
      { label: 'Pending Decisions', value: pendingCount.toLocaleString(), status: 'negative' },
      { label: 'Total Exposure', value: formatM(totalExposure), status: 'negative' },
      { label: 'Avg Exposure', value: pendingCount > 0 ? formatK(totalExposure / pendingCount) : '$0', status: 'neutral' },
      { label: 'High Pain Claims', value: claims.filter(c => c.painLevel.includes('5+') || c.painLevel === 'Limits').length.toString(), status: 'negative' },
    ],
    table: {
      headers: ['Claim Number', 'Team', 'Reserves', 'Pain Level'],
      rows: claims.map(c => [c.claimNumber, c.team, formatK(c.reserves), c.painLevel]),
      alignments: ['left', 'left', 'right', 'left'],
    },
    summary: `${pendingCount} claims require executive decision with ${formatM(totalExposure)} in total exposure.`,
  });
}

export function exportAgedDrilldown(
  agedCount: number,
  agedReserves: number,
  totalClaims: number,
  claims: Array<{ claim_id: string; area: string; reserves: number; status: string }>
): void {
  const formatM = (v: number) => `$${(v / 1_000_000).toFixed(1)}M`;
  const formatK = (v: number) => `$${(v / 1_000).toFixed(0)}K`;
  const pctOfInventory = ((agedCount / totalClaims) * 100).toFixed(1);

  generateBloombergDrilldown({
    title: 'Aged Claims (365+ Days)',
    subtitle: 'Claims Exceeding One Year',
    timestamp: format(new Date(), 'MMM d, yyyy h:mm a'),
    metrics: [
      { label: 'Aged 365+ Claims', value: agedCount.toLocaleString(), status: 'negative' },
      { label: 'Reserve Exposure', value: formatM(agedReserves), status: 'negative' },
      { label: '% of Inventory', value: `${pctOfInventory}%`, status: 'negative' },
      { label: 'Avg Reserve', value: agedCount > 0 ? formatK(agedReserves / agedCount) : '$0', status: 'neutral' },
    ],
    table: {
      headers: ['Claim ID', 'Area', 'Reserves', 'Status'],
      rows: claims.map(c => [c.claim_id, c.area, formatK(c.reserves), c.status.toUpperCase()]),
      alignments: ['left', 'left', 'right', 'left'],
    },
    summary: `${agedCount.toLocaleString()} claims aged 365+ days represent ${pctOfInventory}% of inventory with ${formatM(agedReserves)} exposure.`,
  });
}

export function exportNoEvalDrilldown(
  noEvalCount: number,
  noEvalReserves: number,
  totalClaims: number
): void {
  const formatM = (v: number) => `$${(v / 1_000_000).toFixed(1)}M`;
  const formatK = (v: number) => `$${(v / 1_000).toFixed(0)}K`;
  const pctOfInventory = ((noEvalCount / totalClaims) * 100).toFixed(1);

  generateBloombergDrilldown({
    title: 'No Evaluation Claims',
    subtitle: 'Claims Without Damage Assessment',
    timestamp: format(new Date(), 'MMM d, yyyy h:mm a'),
    metrics: [
      { label: 'Claims Without Eval', value: noEvalCount.toLocaleString(), status: 'negative' },
      { label: 'Exposure at Risk', value: formatM(noEvalReserves), status: 'negative' },
      { label: '% of Inventory', value: `${pctOfInventory}%`, status: 'negative' },
      { label: 'Avg per Claim', value: noEvalCount > 0 ? formatK(noEvalReserves / noEvalCount) : '$0', status: 'neutral' },
    ],
    summary: `${noEvalCount.toLocaleString()} claims (${pctOfInventory}%) lack proper evaluation representing ${formatM(noEvalReserves)} in exposure.`,
  });
}

export function exportCP1Drilldown(
  cp1Count: number,
  cp1Rate: string,
  targetRate: number = 35
): void {
  const currentRate = parseFloat(cp1Rate);
  const gap = targetRate - currentRate;

  generateBloombergDrilldown({
    title: 'CP1 Analysis',
    subtitle: 'Claims Within Policy Limits',
    timestamp: format(new Date(), 'MMM d, yyyy h:mm a'),
    metrics: [
      { label: 'Current CP1 Rate', value: cp1Rate, status: currentRate >= targetRate ? 'positive' : 'negative' },
      { label: 'Claims in CP1', value: cp1Count.toLocaleString(), status: 'positive' },
      { label: 'Target Rate', value: `${targetRate}%`, status: 'neutral' },
      { label: 'Gap to Target', value: gap > 0 ? `${gap.toFixed(1)}%` : 'On Target', status: gap > 0 ? 'negative' : 'positive' },
    ],
    summary: currentRate >= targetRate 
      ? `CP1 rate at ${cp1Rate} exceeds target of ${targetRate}%. ${cp1Count.toLocaleString()} claims within limits.`
      : `CP1 rate at ${cp1Rate} is ${gap.toFixed(1)}% below target. Focus on resolution within policy limits.`,
  });
}

export function exportBudgetDrilldown(
  ytd2026: number,
  ytd2025: number
): void {
  const formatM = (v: number) => `$${(v / 1_000_000).toFixed(1)}M`;
  const formatK = (v: number) => `$${(v / 1_000).toFixed(0)}K`;
  const projected2026 = ytd2026 * 12;
  const yoyChange = ytd2025 > 0 ? ((projected2026 - ytd2025) / ytd2025 * 100) : 0;

  generateBloombergDrilldown({
    title: 'Budget & Spend Analysis',
    subtitle: 'BI Litigation Expenditure Tracking',
    timestamp: format(new Date(), 'MMM d, yyyy h:mm a'),
    metrics: [
      { label: '2026 YTD', value: formatK(ytd2026), delta: 'Jan Only', status: 'neutral' },
      { label: '2025 Full Year', value: formatM(ytd2025), status: 'neutral' },
      { label: 'Projected 2026', value: formatM(projected2026), status: yoyChange > 0 ? 'negative' : 'positive' },
      { label: 'YoY Trajectory', value: `${yoyChange > 0 ? '+' : ''}${yoyChange.toFixed(1)}%`, status: yoyChange > 0 ? 'negative' : 'positive' },
    ],
    summary: `2026 projected at ${formatM(projected2026)} based on Jan YTD of ${formatK(ytd2026)}. 2025 baseline: ${formatM(ytd2025)}.`,
  });
}
