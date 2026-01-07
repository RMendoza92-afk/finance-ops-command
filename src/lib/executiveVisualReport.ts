/**
 * FLI Executive Visual Report Generator
 * Clean, professional multi-page PDF reports with charts and data
 */
import jsPDF from 'jspdf';
import { format } from 'date-fns';

// FLI Brand Colors
const COLORS = {
  primary: { r: 180, g: 30, b: 40 },      // FLI Red
  secondary: { r: 30, g: 30, b: 30 },     // Near black
  accent: { r: 200, g: 160, b: 60 },      // Gold
  success: { r: 34, g: 139, b: 34 },      // Forest green
  warning: { r: 255, g: 165, b: 0 },      // Orange
  danger: { r: 180, g: 30, b: 40 },       // Red
  muted: { r: 120, g: 120, b: 120 },      // Gray
  light: { r: 245, g: 245, b: 245 },      // Light gray
  white: { r: 255, g: 255, b: 255 },
  black: { r: 0, g: 0, b: 0 },
  gridLine: { r: 220, g: 220, b: 220 },
};

type Color = { r: number; g: number; b: number };

const setColor = (doc: jsPDF, c: Color) => doc.setTextColor(c.r, c.g, c.b);
const setFill = (doc: jsPDF, c: Color) => doc.setFillColor(c.r, c.g, c.b);
const setDraw = (doc: jsPDF, c: Color) => doc.setDrawColor(c.r, c.g, c.b);

interface ChartBar {
  label: string;
  value: number;
  compareValue?: number;
  color?: Color;
  compareColor?: Color;
}

interface ChartLine {
  points: Array<{ x: number; y: number; label?: string }>;
  color: Color;
  showDots?: boolean;
  annotations?: Array<{ x: number; y: number; text: string }>;
}

interface ReportSection {
  title: string;
  subtitle?: string;
  type: 'cover' | 'bar-chart' | 'line-chart' | 'table' | 'kpi-grid' | 'comparison';
  data?: any;
}

interface ReportConfig {
  title: string;
  preparedBy?: string;
  sections: ReportSection[];
}

// Draw FLI header with logo text
function drawHeader(doc: jsPDF, pageNum: number, totalPages: number) {
  const W = doc.internal.pageSize.getWidth();
  
  // Top accent bar
  setFill(doc, COLORS.primary);
  doc.rect(0, 0, W, 8, 'F');
  
  // Header band
  setFill(doc, COLORS.secondary);
  doc.rect(0, 8, W, 18, 'F');
  
  // FLI Logo text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setColor(doc, COLORS.white);
  doc.text('FRED LOYA', 15, 18);
  
  doc.setFontSize(10);
  setColor(doc, COLORS.primary);
  doc.text('INSURANCE', 55, 18);
  
  // Right side page number
  doc.setFontSize(8);
  setColor(doc, COLORS.white);
  doc.text(`Page ${pageNum} of ${totalPages}`, W - 15, 18, { align: 'right' });
}

// Draw footer
function drawFooter(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  
  // Bottom line
  setDraw(doc, COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(15, H - 12, W - 15, H - 12);
  
  // Footer text
  doc.setFontSize(7);
  setColor(doc, COLORS.muted);
  doc.text('CONFIDENTIAL - FOR INTERNAL USE ONLY', 15, H - 7);
  doc.text(`Generated ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, W / 2, H - 7, { align: 'center' });
  doc.text('FLI Claims Intelligence', W - 15, H - 7, { align: 'right' });
}

// Draw grouped bar chart
function drawBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  bars: ChartBar[],
  yAxisLabel: string = 'Dollars ($)'
) {
  const chartX = x + 35;
  const chartY = y;
  const chartW = width - 45;
  const chartH = height - 40;
  const barGap = 10;
  const groupWidth = (chartW - barGap * (bars.length + 1)) / bars.length;
  
  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setColor(doc, COLORS.secondary);
  doc.text(title, x + width / 2, y - 5, { align: 'center' });
  
  // Y-axis
  const maxVal = Math.max(...bars.map(b => Math.max(b.value, b.compareValue || 0)));
  const yScale = chartH / (maxVal * 1.1);
  
  // Y-axis label
  doc.setFontSize(8);
  setColor(doc, COLORS.muted);
  doc.text(yAxisLabel, x + 5, chartY + chartH / 2, { angle: 90 });
  
  // Y-axis ticks
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const tickY = chartY + chartH - (i / yTicks) * chartH;
    const tickVal = (i / yTicks) * maxVal * 1.1;
    
    // Grid line
    setDraw(doc, COLORS.gridLine);
    doc.setLineWidth(0.2);
    doc.line(chartX, tickY, chartX + chartW, tickY);
    
    // Tick label
    doc.setFontSize(7);
    setColor(doc, COLORS.muted);
    doc.text(tickVal >= 1000 ? `${(tickVal / 1000).toFixed(0)}k` : tickVal.toFixed(0), chartX - 3, tickY + 1, { align: 'right' });
  }
  
  // X-axis line
  setDraw(doc, COLORS.secondary);
  doc.setLineWidth(0.5);
  doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);
  
  // Draw bars
  bars.forEach((bar, i) => {
    const groupX = chartX + barGap + i * (groupWidth + barGap);
    const singleBarW = bar.compareValue !== undefined ? (groupWidth - 4) / 2 : groupWidth - 4;
    
    // Primary bar
    const barH1 = bar.value * yScale;
    setFill(doc, COLORS.secondary);
    doc.rect(groupX, chartY + chartH - barH1, singleBarW, barH1, 'F');
    
    // Compare bar if exists
    if (bar.compareValue !== undefined) {
      const barH2 = bar.compareValue * yScale;
      setFill(doc, COLORS.primary);
      doc.rect(groupX + singleBarW + 4, chartY + chartH - barH2, singleBarW, barH2, 'F');
    }
    
    // X-axis label
    doc.setFontSize(8);
    setColor(doc, COLORS.secondary);
    doc.text(bar.label, groupX + groupWidth / 2, chartY + chartH + 8, { align: 'center' });
  });
  
  // Legend if comparing
  if (bars.some(b => b.compareValue !== undefined)) {
    const legendY = chartY + chartH + 20;
    
    setFill(doc, COLORS.secondary);
    doc.rect(x + width / 2 - 50, legendY, 8, 4, 'F');
    doc.setFontSize(7);
    setColor(doc, COLORS.secondary);
    doc.text('Reserve', x + width / 2 - 40, legendY + 3);
    
    setFill(doc, COLORS.primary);
    doc.rect(x + width / 2 + 10, legendY, 8, 4, 'F');
    setColor(doc, COLORS.secondary);
    doc.text('Paid', x + width / 2 + 20, legendY + 3);
  }
  
  return y + height;
}

// Draw line chart with annotations
function drawLineChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  xAxisLabel: string,
  yAxisLabel: string,
  lineData: ChartLine
) {
  const chartX = x + 40;
  const chartY = y;
  const chartW = width - 50;
  const chartH = height - 45;
  
  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setColor(doc, COLORS.secondary);
  doc.text(title, x + width / 2, y - 5, { align: 'center' });
  
  // Calculate scales
  const maxX = Math.max(...lineData.points.map(p => p.x));
  const maxY = Math.max(...lineData.points.map(p => p.y));
  const xScale = chartW / maxX;
  const yScale = chartH / (maxY * 1.15);
  
  // Draw grid
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const tickY = chartY + chartH - (i / yTicks) * chartH;
    const tickVal = (i / yTicks) * maxY * 1.15;
    
    setDraw(doc, COLORS.gridLine);
    doc.setLineWidth(0.2);
    doc.line(chartX, tickY, chartX + chartW, tickY);
    
    doc.setFontSize(7);
    setColor(doc, COLORS.muted);
    doc.text(tickVal >= 1000 ? `${(tickVal / 1000).toFixed(0)}k` : tickVal.toFixed(0), chartX - 3, tickY + 1, { align: 'right' });
  }
  
  // X-axis ticks
  const xTicks = [50, 100, 150, 200, 250, 300, 350];
  xTicks.forEach(tick => {
    if (tick <= maxX) {
      const tickX = chartX + tick * xScale;
      setDraw(doc, COLORS.gridLine);
      doc.setLineWidth(0.1);
      doc.line(tickX, chartY, tickX, chartY + chartH);
      
      doc.setFontSize(7);
      setColor(doc, COLORS.muted);
      doc.text(tick.toString(), tickX, chartY + chartH + 6, { align: 'center' });
    }
  });
  
  // Axis labels
  doc.setFontSize(8);
  setColor(doc, COLORS.muted);
  doc.text(yAxisLabel, x + 5, chartY + chartH / 2, { angle: 90 });
  doc.text(xAxisLabel, chartX + chartW / 2, chartY + chartH + 15, { align: 'center' });
  
  // Draw line
  setDraw(doc, lineData.color);
  doc.setLineWidth(1.5);
  
  lineData.points.forEach((point, i) => {
    if (i > 0) {
      const prev = lineData.points[i - 1];
      const x1 = chartX + prev.x * xScale;
      const y1 = chartY + chartH - prev.y * yScale;
      const x2 = chartX + point.x * xScale;
      const y2 = chartY + chartH - point.y * yScale;
      doc.line(x1, y1, x2, y2);
    }
  });
  
  // Draw dots and annotations
  if (lineData.showDots) {
    lineData.points.forEach(point => {
      const px = chartX + point.x * xScale;
      const py = chartY + chartH - point.y * yScale;
      
      setFill(doc, lineData.color);
      doc.circle(px, py, 2, 'F');
    });
  }
  
  // Annotations
  if (lineData.annotations) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    lineData.annotations.forEach(ann => {
      const px = chartX + ann.x * xScale;
      const py = chartY + chartH - ann.y * yScale;
      
      setColor(doc, COLORS.secondary);
      doc.text(ann.text, px, py - 5, { align: 'center' });
    });
  }
  
  return y + height;
}

// Draw KPI grid
function drawKPIGrid(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  kpis: Array<{ label: string; value: string; subtext?: string; color?: Color }>
) {
  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setColor(doc, COLORS.secondary);
  doc.text(title, x, y);
  
  y += 8;
  
  const cols = Math.min(kpis.length, 4);
  const kpiW = (width - (cols - 1) * 5) / cols;
  const kpiH = 25;
  
  kpis.forEach((kpi, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const kpiX = x + col * (kpiW + 5);
    const kpiY = y + row * (kpiH + 5);
    
    // KPI box
    setFill(doc, COLORS.light);
    doc.roundedRect(kpiX, kpiY, kpiW, kpiH, 2, 2, 'F');
    
    // Left accent
    setFill(doc, kpi.color || COLORS.primary);
    doc.rect(kpiX, kpiY, 3, kpiH, 'F');
    
    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setColor(doc, COLORS.muted);
    doc.text(kpi.label.toUpperCase(), kpiX + 8, kpiY + 7);
    
    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    setColor(doc, COLORS.secondary);
    doc.text(kpi.value, kpiX + 8, kpiY + 18);
    
    // Subtext
    if (kpi.subtext) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const subtextColor = kpi.subtext.startsWith('+') ? COLORS.danger : kpi.subtext.startsWith('-') ? COLORS.success : COLORS.muted;
      setColor(doc, subtextColor);
      doc.text(kpi.subtext, kpiX + kpiW - 5, kpiY + 18, { align: 'right' });
    }
  });
  
  return y + Math.ceil(kpis.length / cols) * (kpiH + 5) + 5;
}

// Draw data table
function drawTable(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  headers: string[],
  rows: string[][],
  alignments?: ('left' | 'right' | 'center')[]
) {
  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setColor(doc, COLORS.secondary);
  doc.text(title, x, y);
  
  y += 8;
  
  const colW = width / headers.length;
  const rowH = 8;
  const headerH = 10;
  
  // Header row
  setFill(doc, COLORS.secondary);
  doc.rect(x, y, width, headerH, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(doc, COLORS.white);
  
  headers.forEach((header, i) => {
    const align = alignments?.[i] || 'left';
    let tx = x + i * colW + 3;
    if (align === 'right') tx = x + (i + 1) * colW - 3;
    else if (align === 'center') tx = x + i * colW + colW / 2;
    doc.text(header, tx, y + 7, { align: align as any });
  });
  
  y += headerH;
  
  // Data rows
  rows.forEach((row, rowIdx) => {
    // Alternating background
    if (rowIdx % 2 === 0) {
      setFill(doc, COLORS.light);
      doc.rect(x, y, width, rowH, 'F');
    }
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setColor(doc, COLORS.secondary);
    
    row.forEach((cell, colIdx) => {
      const align = alignments?.[colIdx] || 'left';
      let tx = x + colIdx * colW + 3;
      if (align === 'right') tx = x + (colIdx + 1) * colW - 3;
      else if (align === 'center') tx = x + colIdx * colW + colW / 2;
      doc.text(cell.substring(0, 20), tx, y + 5.5, { align: align as any });
    });
    
    y += rowH;
  });
  
  return y + 5;
}

// Draw cover page
function drawCoverPage(doc: jsPDF, title: string, preparedBy?: string, contents?: string[]) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  
  // Top band
  setFill(doc, COLORS.primary);
  doc.rect(0, 0, W, 40, 'F');
  
  // Logo section
  setFill(doc, COLORS.secondary);
  doc.rect(0, 40, W, 25, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  setColor(doc, COLORS.white);
  doc.text('FRED LOYA', W / 2 - 30, 56);
  
  doc.setFontSize(18);
  setColor(doc, COLORS.primary);
  doc.text('INSURANCE', W / 2 + 45, 56);
  
  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  setColor(doc, COLORS.secondary);
  doc.text(title, W / 2, 100, { align: 'center' });
  
  // Prepared by
  if (preparedBy) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    setColor(doc, COLORS.muted);
    doc.text(`Prepared by ${preparedBy}`, W / 2, 115, { align: 'center' });
  }
  
  // Date
  doc.setFontSize(11);
  setColor(doc, COLORS.muted);
  doc.text(format(new Date(), 'MMMM d, yyyy'), W / 2, 128, { align: 'center' });
  
  // Report contents
  if (contents && contents.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    setColor(doc, COLORS.secondary);
    doc.text('Report Contents', 30, 155);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    contents.forEach((item, i) => {
      setColor(doc, COLORS.secondary);
      doc.text('•', 30, 168 + i * 10);
      doc.text(item, 38, 168 + i * 10);
    });
  }
  
  // Bottom accent
  setFill(doc, COLORS.primary);
  doc.rect(0, H - 15, W, 15, 'F');
  
  doc.setFontSize(8);
  setColor(doc, COLORS.white);
  doc.text('CONFIDENTIAL - FOR INTERNAL USE ONLY', W / 2, H - 6, { align: 'center' });
}

// Main report generator
export function generateExecutiveVisualReport(config: ReportConfig): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 15;
  
  const totalPages = config.sections.length;
  let pageNum = 1;
  
  config.sections.forEach((section, sectionIdx) => {
    if (sectionIdx > 0) doc.addPage();
    
    if (section.type === 'cover') {
      drawCoverPage(doc, config.title, config.preparedBy, section.data?.contents);
    } else {
      drawHeader(doc, pageNum, totalPages);
      drawFooter(doc);
      
      let y = 35;
      
      // Section title
      if (section.title) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        setColor(doc, COLORS.secondary);
        doc.text(section.title, M, y);
        
        if (section.subtitle) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          setColor(doc, COLORS.muted);
          doc.text(section.subtitle, M, y + 7);
          y += 15;
        } else {
          y += 10;
        }
      }
      
      // Draw section content based on type
      switch (section.type) {
        case 'kpi-grid':
          drawKPIGrid(doc, M, y, W - M * 2, section.data.gridTitle || '', section.data.kpis);
          break;
          
        case 'bar-chart':
          drawBarChart(
            doc, M, y, W - M * 2, 100,
            section.data.chartTitle || '',
            section.data.bars,
            section.data.yAxisLabel
          );
          break;
          
        case 'line-chart':
          drawLineChart(
            doc, M, y, W - M * 2, 100,
            section.data.chartTitle || '',
            section.data.xAxisLabel || '',
            section.data.yAxisLabel || '',
            section.data.line
          );
          break;
          
        case 'table':
          drawTable(
            doc, M, y, W - M * 2,
            section.data.tableTitle || '',
            section.data.headers,
            section.data.rows,
            section.data.alignments
          );
          break;
          
        case 'comparison':
          // KPIs at top
          if (section.data.kpis) {
            y = drawKPIGrid(doc, M, y, W - M * 2, '', section.data.kpis);
            y += 5;
          }
          // Chart below
          if (section.data.bars) {
            drawBarChart(doc, M, y, W - M * 2, 90, section.data.chartTitle || '', section.data.bars, section.data.yAxisLabel);
          }
          // Callout text
          if (section.data.callout) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            setColor(doc, COLORS.secondary);
            doc.text(section.data.callout, M, H - 35);
          }
          break;
      }
    }
    
    pageNum++;
  });
  
  const filename = `FLI_${config.title.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename);
}

// Convenience function to generate claims inventory report
export function generateClaimsInventoryReport(data: {
  totalClaims: number;
  totalReserves: number;
  typeGroups: Array<{ name: string; claims: number; reserves: number; paid?: number }>;
  ageBreakdown: Array<{ bucket: string; claims: number; reserves: number }>;
  claimsList?: Array<{ id: string; area: string; reserves: number; status: string }>;
}): void {
  const formatM = (v: number) => `$${(v / 1_000_000).toFixed(1)}M`;
  const formatK = (v: number) => `$${(v / 1_000).toFixed(0)}K`;
  
  generateExecutiveVisualReport({
    title: 'BI Claims Inventory Report',
    preparedBy: 'Claims Intelligence',
    sections: [
      {
        title: '',
        type: 'cover',
        data: {
          contents: [
            `Total open claims inventory: ${data.totalClaims.toLocaleString()} claims`,
            `Total reserves: ${formatM(data.totalReserves)}`,
            'Type group breakdown with reserve vs paid comparison',
            'Age bucket distribution analysis',
            'Top claims by reserve value',
          ],
        },
      },
      {
        title: 'Claims Inventory Overview',
        subtitle: 'Portfolio summary and key metrics',
        type: 'kpi-grid',
        data: {
          kpis: [
            { label: 'Total Open Claims', value: data.totalClaims.toLocaleString(), color: COLORS.primary },
            { label: 'Total Reserves', value: formatM(data.totalReserves), color: COLORS.secondary },
            { label: 'Litigation', value: (data.typeGroups.find(t => t.name === 'LIT')?.claims || 0).toLocaleString(), subtext: `${(((data.typeGroups.find(t => t.name === 'LIT')?.claims || 0) / data.totalClaims) * 100).toFixed(1)}%`, color: COLORS.danger },
            { label: 'Pre-Litigation', value: (data.typeGroups.find(t => t.name === 'PL')?.claims || 0).toLocaleString(), color: COLORS.warning },
          ],
        },
      },
      {
        title: 'Reserve vs Paid by Category',
        subtitle: 'Comparing current reserves to actual payments',
        type: 'bar-chart',
        data: {
          chartTitle: 'Average Paid vs Reserve - BI Categories',
          yAxisLabel: 'Dollars ($)',
          bars: data.typeGroups.slice(0, 5).map(tg => ({
            label: tg.name,
            value: tg.reserves / (tg.claims || 1),
            compareValue: (tg.paid || 0) / (tg.claims || 1),
          })),
        },
      },
      {
        title: 'Age Distribution',
        subtitle: 'Claims and reserves by age bucket',
        type: 'table',
        data: {
          tableTitle: 'Claims by Age Bucket',
          headers: ['Age Bucket', 'Claims', 'Reserves', '% of Total'],
          rows: data.ageBreakdown.map(ab => [
            ab.bucket,
            ab.claims.toLocaleString(),
            formatM(ab.reserves),
            `${((ab.reserves / data.totalReserves) * 100).toFixed(1)}%`,
          ]),
          alignments: ['left', 'right', 'right', 'right'],
        },
      },
    ],
  });
}

// Generate cost curve report
export function generateCostCurveReport(data: {
  curvePoints: Array<{ days: number; cost: number }>;
  annotations: Array<{ days: number; cost: number; label: string }>;
  currentAvgDays: number;
  targetDays: number;
  potentialSavings: number;
}): void {
  const formatK = (v: number) => `$${(v / 1_000).toFixed(0)}K`;
  
  generateExecutiveVisualReport({
    title: 'Cost of BI Over Time',
    preparedBy: 'Claims Intelligence',
    sections: [
      {
        title: '',
        type: 'cover',
        data: {
          contents: [
            'Time-driven severity curve illustrating inflation impact of BI aging',
            `Current average days open: ${data.currentAvgDays}`,
            `Target resolution: ${data.targetDays} days`,
            `Projected savings: ${formatK(data.potentialSavings)}`,
          ],
        },
      },
      {
        title: 'Cost of BI Over Time',
        subtitle: 'Cycle time curve showing cost escalation',
        type: 'line-chart',
        data: {
          chartTitle: 'Cost of BI Over Time - Cycle Time Curve',
          xAxisLabel: 'Days Open',
          yAxisLabel: 'Average Paid ($)',
          line: {
            points: data.curvePoints.map(p => ({ x: p.days, y: p.cost })),
            color: COLORS.primary,
            showDots: true,
            annotations: data.annotations.map(a => ({ x: a.days, y: a.cost, text: `${a.days}d: ${formatK(a.cost)}` })),
          },
        },
      },
    ],
  });
}
