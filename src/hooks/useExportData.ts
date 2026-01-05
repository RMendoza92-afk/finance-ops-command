import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import loyaLogo from '@/assets/fli_logo.jpg';

export interface ManagerTracking {
  name: string;
  value: string | number;
  category: string;
}

export interface RawClaimData {
  columns: string[];
  rows: (string | number)[][];
  sheetName?: string;
}

export interface DashboardVisual {
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
}

export interface ChartData {
  label: string;
  value: number;
  color?: 'red' | 'green' | 'blue' | 'amber' | 'muted';
}

export interface PDFChart {
  type: 'bar' | 'horizontalBar' | 'pie' | 'donut';
  title: string;
  data: ChartData[];
  width?: number; // percentage of page width (default 45 for side-by-side)
}

export interface ExportableData {
  title: string;
  subtitle?: string;
  timestamp: string;
  affectsManager?: string;
  directive?: string;
  managerTracking?: ManagerTracking[];
  summary?: Record<string, string | number>;
  // NEW: Dashboard-style visuals with bullet insights
  dashboardVisuals?: DashboardVisual[];
  bulletInsights?: string[];
  // NEW: Charts for visual representation
  charts?: PDFChart[];
  columns: string[];
  rows: (string | number)[][];
  // Raw underlying claim data for Excel export
  rawClaimData?: RawClaimData[];
}

// Helper to load image as base64
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

export function useExportData() {
  const generatePDF = async (data: ExportableData) => {
    // Use LANDSCAPE orientation for more table space
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 28;

    // EXECUTIVE THEME - Black, Light Grey, White, Red, Green
    const darkBg = { r: 0, g: 0, b: 0 };           // Pure Black
    const darkCard = { r: 18, g: 18, b: 18 };      // Near Black
    const darkBorder = { r: 38, g: 38, b: 38 };    // Dark Grey
    const accentRed = { r: 220, g: 38, b: 38 };    // Red 600
    const accentGreen = { r: 34, g: 197, b: 94 };  // Green 500
    const textWhite = { r: 255, g: 255, b: 255 };  // Pure White
    const textMuted = { r: 163, g: 163, b: 163 };  // Light Grey (Neutral 400)
    const textLight = { r: 212, g: 212, b: 212 };  // Lighter Grey (Neutral 300)

    // Fill entire page with dark background
    doc.setFillColor(darkBg.r, darkBg.g, darkBg.b);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // ====== HEADER WITH LOGO ======
    try {
      const logoBase64 = await loadImageAsBase64(loyaLogo);
      doc.addImage(logoBase64, 'JPEG', 14, 8, 50, 14);
    } catch (e) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text('FRED LOYA INSURANCE', 14, 18);
    }
    
    // Accent line - red
    doc.setDrawColor(accentRed.r, accentRed.g, accentRed.b);
    doc.setLineWidth(2);
    doc.line(14, 24, pageWidth - 14, 24);

    yPos = 34;

    // ====== TITLE ======
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
    doc.text(data.title.toUpperCase(), 14, yPos);
    yPos += 8;

    if (data.subtitle) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textLight.r, textLight.g, textLight.b);
      doc.text(data.subtitle, 14, yPos);
      yPos += 6;
    }

    doc.setFontSize(9);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(data.timestamp, 14, yPos);
    
    if (data.affectsManager) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text(`Prepared for: ${data.affectsManager}`, pageWidth - 14, yPos, { align: 'right' });
    }
    yPos += 12;

    // ====== DIRECTIVE ======
    if (data.directive) {
      doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
      doc.rect(14, yPos, pageWidth - 28, 20, 'F');
      
      // Left accent bar - red
      doc.setFillColor(accentRed.r, accentRed.g, accentRed.b);
      doc.rect(14, yPos, 4, 20, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(accentRed.r, accentRed.g, accentRed.b);
      doc.text('DIRECTIVE', 22, yPos + 7);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      const directiveLines = doc.splitTextToSize(data.directive, pageWidth - 50);
      doc.text(directiveLines.slice(0, 2), 22, yPos + 14);
      yPos += 26;
    }

    // ====== PREMIUM DASHBOARD VISUALS (Executive KPI Cards) ======
    if (data.dashboardVisuals && data.dashboardVisuals.length > 0) {
      const visuals = data.dashboardVisuals;
      const maxCols = Math.min(visuals.length, 4);
      const cardWidth = (pageWidth - 28 - (maxCols - 1) * 10) / maxCols;
      const cardHeight = 40;
      
      visuals.forEach((visual, index) => {
        const col = index % maxCols;
        const row = Math.floor(index / maxCols);
        const xPos = 14 + col * (cardWidth + 10);
        const cardY = yPos + row * (cardHeight + 8);

        // Trend colors with gradients
        const trendColors = {
          up: { main: { r: 34, g: 197, b: 94 }, dark: { r: 21, g: 128, b: 61 }, light: { r: 74, g: 222, b: 128 } },
          down: { main: { r: 239, g: 68, b: 68 }, dark: { r: 153, g: 27, b: 27 }, light: { r: 252, g: 129, b: 129 } },
          neutral: { main: { r: 156, g: 163, b: 175 }, dark: { r: 107, g: 114, b: 128 }, light: { r: 209, g: 213, b: 219 } },
        };
        const colorSet = trendColors[visual.trendDirection || 'neutral'];

        // Card shadow
        doc.setFillColor(5, 5, 5);
        doc.roundedRect(xPos + 1.5, cardY + 1.5, cardWidth, cardHeight, 4, 4, 'F');

        // Card background with subtle gradient effect
        doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
        doc.roundedRect(xPos, cardY, cardWidth, cardHeight, 4, 4, 'F');
        
        // Top highlight
        doc.setFillColor(30, 30, 30);
        doc.roundedRect(xPos, cardY, cardWidth, 3, 4, 4, 'F');
        
        // Accent bar with gradient
        doc.setFillColor(colorSet.dark.r, colorSet.dark.g, colorSet.dark.b);
        doc.roundedRect(xPos, cardY, 5, cardHeight, 4, 0, 'F');
        doc.rect(xPos + 2, cardY, 3, cardHeight, 'F');
        doc.setFillColor(colorSet.main.r, colorSet.main.g, colorSet.main.b);
        doc.roundedRect(xPos, cardY, 4, cardHeight - 4, 4, 0, 'F');
        doc.rect(xPos + 2, cardY, 2, cardHeight - 4, 'F');
        
        // Subtle glow at accent bar
        doc.setFillColor(colorSet.light.r, colorSet.light.g, colorSet.light.b);
        doc.roundedRect(xPos, cardY + 4, 2, 8, 1, 0, 'F');

        // Border
        doc.setDrawColor(50, 50, 50);
        doc.setLineWidth(0.3);
        doc.roundedRect(xPos, cardY, cardWidth, cardHeight, 4, 4, 'S');

        // Label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.text(visual.label.toUpperCase(), xPos + 12, cardY + 12);

        // Value - large and prominent
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
        doc.text(String(visual.value), xPos + 12, cardY + 27);

        // Trend badge
        if (visual.trend) {
          // Badge background
          doc.setFillColor(colorSet.dark.r, colorSet.dark.g, colorSet.dark.b);
          const trendText = visual.trend.length > 15 ? visual.trend.substring(0, 14) + '…' : visual.trend;
          const badgeWidth = Math.min(trendText.length * 2.5 + 8, cardWidth - 20);
          doc.roundedRect(xPos + 12, cardY + 31, badgeWidth, 7, 2, 2, 'F');
          
          // Arrow indicator
          const arrow = visual.trendDirection === 'up' ? '↑' : visual.trendDirection === 'down' ? '↓' : '→';
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6);
          doc.setTextColor(colorSet.light.r, colorSet.light.g, colorSet.light.b);
          doc.text(`${arrow} ${trendText}`, xPos + 14, cardY + 36);
        }
      });

      yPos += Math.ceil(visuals.length / maxCols) * (cardHeight + 8) + 10;
    }

    // ====== PREMIUM KEY INSIGHTS ======
    if (data.bulletInsights && data.bulletInsights.length > 0) {
      const bulletBoxHeight = 14 + data.bulletInsights.length * 10;
      
      // Shadow
      doc.setFillColor(5, 5, 5);
      doc.roundedRect(15, yPos + 1, pageWidth - 28, bulletBoxHeight, 4, 4, 'F');
      
      // Main card
      doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
      doc.roundedRect(14, yPos, pageWidth - 28, bulletBoxHeight, 4, 4, 'F');
      
      // Top highlight
      doc.setFillColor(28, 28, 28);
      doc.roundedRect(14, yPos, pageWidth - 28, 2, 4, 4, 'F');
      
      // Amber accent bar with gradient
      doc.setFillColor(180, 83, 9);
      doc.roundedRect(14, yPos, 5, bulletBoxHeight, 4, 0, 'F');
      doc.rect(16, yPos, 3, bulletBoxHeight, 'F');
      doc.setFillColor(245, 158, 11);
      doc.roundedRect(14, yPos, 4, bulletBoxHeight - 5, 4, 0, 'F');
      doc.rect(16, yPos, 2, bulletBoxHeight - 5, 'F');
      
      // Glow
      doc.setFillColor(251, 191, 36);
      doc.roundedRect(14, yPos + 4, 2, 10, 1, 0, 'F');
      
      // Border
      doc.setDrawColor(50, 50, 50);
      doc.setLineWidth(0.3);
      doc.roundedRect(14, yPos, pageWidth - 28, bulletBoxHeight, 4, 4, 'S');
      
      // Header with icon
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(245, 158, 11);
      doc.text('KEY INSIGHTS', 24, yPos + 10);
      
      yPos += 16;
      
      data.bulletInsights.forEach((insight, idx) => {
        // Bullet number
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(245, 158, 11);
        doc.text(`${idx + 1}.`, 24, yPos);
        
        // Insight text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
        const insightText = insight.length > 100 ? insight.substring(0, 97) + '...' : insight;
        doc.text(insightText, 32, yPos);
        yPos += 10;
      });
      
      yPos += 10;
    }


    // ====== PREMIUM CHARTS SECTION ======
    if (data.charts && data.charts.length > 0) {
      // Premium color palette with gradients
      const chartColors = {
        red: { main: { r: 239, g: 68, b: 68 }, light: { r: 254, g: 202, b: 202 }, dark: { r: 153, g: 27, b: 27 } },
        green: { main: { r: 34, g: 197, b: 94 }, light: { r: 187, g: 247, b: 208 }, dark: { r: 21, g: 128, b: 61 } },
        blue: { main: { r: 59, g: 130, b: 246 }, light: { r: 191, g: 219, b: 254 }, dark: { r: 29, g: 78, b: 216 } },
        amber: { main: { r: 245, g: 158, b: 11 }, light: { r: 254, g: 243, b: 199 }, dark: { r: 180, g: 83, b: 9 } },
        muted: { main: { r: 156, g: 163, b: 175 }, light: { r: 229, g: 231, b: 235 }, dark: { r: 75, g: 85, b: 99 } },
      };
      const defaultColors = ['red', 'amber', 'green', 'blue', 'muted'] as const;
      
      // Section header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text('VISUAL ANALYTICS', 14, yPos);
      
      // Accent underline
      doc.setDrawColor(accentRed.r, accentRed.g, accentRed.b);
      doc.setLineWidth(1.5);
      doc.line(14, yPos + 3, 70, yPos + 3);
      yPos += 14;

      // Premium chart layout
      const chartsPerRow = data.charts.length === 1 ? 1 : 2;
      const chartWidth = chartsPerRow === 1 ? pageWidth - 28 : (pageWidth - 36) / 2;
      const chartHeight = 85;

      data.charts.forEach((chart, chartIdx) => {
        const col = chartIdx % chartsPerRow;
        const row = Math.floor(chartIdx / chartsPerRow);
        const xStart = 14 + col * (chartWidth + 8);
        const chartY = yPos + row * (chartHeight + 12);

        // Page break check
        if (chartY + chartHeight > pageHeight - 30) {
          doc.addPage();
          doc.setFillColor(darkBg.r, darkBg.g, darkBg.b);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          yPos = 20;
        }

        // Premium card with gradient effect (simulated with layered rects)
        // Outer glow/shadow
        doc.setFillColor(8, 8, 8);
        doc.roundedRect(xStart + 1, chartY + 1, chartWidth, chartHeight, 4, 4, 'F');
        
        // Main card
        doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
        doc.roundedRect(xStart, chartY, chartWidth, chartHeight, 4, 4, 'F');
        
        // Subtle top highlight
        doc.setFillColor(28, 28, 28);
        doc.roundedRect(xStart, chartY, chartWidth, 2, 4, 4, 'F');
        
        // Left accent bar
        const accentColor = chartIdx === 0 ? accentRed : accentGreen;
        doc.setFillColor(accentColor.r, accentColor.g, accentColor.b);
        doc.roundedRect(xStart, chartY, 4, chartHeight, 4, 0, 'F');
        doc.rect(xStart + 2, chartY, 2, chartHeight, 'F');
        
        // Border
        doc.setDrawColor(48, 48, 48);
        doc.setLineWidth(0.3);
        doc.roundedRect(xStart, chartY, chartWidth, chartHeight, 4, 4, 'S');

        // Chart title with icon indicator
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
        doc.text(chart.title.toUpperCase(), xStart + 14, chartY + 14);
        
        // Subtitle line
        doc.setDrawColor(48, 48, 48);
        doc.setLineWidth(0.3);
        doc.line(xStart + 14, chartY + 18, xStart + chartWidth - 14, chartY + 18);

        const maxValue = Math.max(...chart.data.map(d => d.value));
        const total = chart.data.reduce((sum, d) => sum + d.value, 0);
        const dataArea = { x: xStart + 14, y: chartY + 24, w: chartWidth - 28, h: chartHeight - 34 };

        if (chart.type === 'horizontalBar' || chart.type === 'bar') {
          // Premium horizontal bar chart
          const barCount = chart.data.length;
          const barHeight = Math.min(12, (dataArea.h - 8) / barCount);
          const gap = Math.min(6, (dataArea.h - barCount * barHeight) / (barCount + 1));
          const labelWidth = 70;
          const valueWidth = 55;
          const barAreaWidth = dataArea.w - labelWidth - valueWidth - 8;

          chart.data.forEach((item, i) => {
            const barY = dataArea.y + gap + i * (barHeight + gap);
            const barWidth = maxValue > 0 ? (item.value / maxValue) * barAreaWidth : 0;
            const colorKey = item.color || defaultColors[i % defaultColors.length];
            const colors = chartColors[colorKey];
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';

            // Label with rank indicator
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(colors.main.r, colors.main.g, colors.main.b);
            doc.text(`${i + 1}.`, dataArea.x, barY + barHeight - 2);
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(textLight.r, textLight.g, textLight.b);
            const label = item.label.length > 12 ? item.label.substring(0, 11) + '…' : item.label;
            doc.text(label, dataArea.x + 10, barY + barHeight - 2);

            // Bar track (background)
            doc.setFillColor(30, 30, 30);
            doc.roundedRect(dataArea.x + labelWidth, barY, barAreaWidth, barHeight, 2, 2, 'F');
            
            // Inner track shadow
            doc.setFillColor(20, 20, 20);
            doc.roundedRect(dataArea.x + labelWidth, barY, barAreaWidth, 2, 2, 2, 'F');

            // Main bar with gradient effect (darker bottom, lighter top)
            if (barWidth > 4) {
              // Dark base
              doc.setFillColor(colors.dark.r, colors.dark.g, colors.dark.b);
              doc.roundedRect(dataArea.x + labelWidth, barY, barWidth, barHeight, 2, 2, 'F');
              
              // Main color overlay
              doc.setFillColor(colors.main.r, colors.main.g, colors.main.b);
              doc.roundedRect(dataArea.x + labelWidth, barY, barWidth, barHeight - 3, 2, 2, 'F');
              
              // Highlight at top
              doc.setFillColor(
                Math.min(255, colors.main.r + 40),
                Math.min(255, colors.main.g + 40),
                Math.min(255, colors.main.b + 40)
              );
              doc.roundedRect(dataArea.x + labelWidth + 1, barY + 1, Math.max(barWidth - 2, 2), 3, 1, 1, 'F');
            } else if (barWidth > 0) {
              doc.setFillColor(colors.main.r, colors.main.g, colors.main.b);
              doc.roundedRect(dataArea.x + labelWidth, barY, Math.max(barWidth, 4), barHeight, 2, 2, 'F');
            }

            // Value with percentage
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
            const valueStr = item.value >= 1000000 
              ? `$${(item.value / 1000000).toFixed(1)}M` 
              : item.value >= 1000 
                ? `$${Math.round(item.value / 1000)}K` 
                : `$${item.value.toLocaleString()}`;
            doc.text(valueStr, dataArea.x + dataArea.w - 2, barY + barHeight - 2, { align: 'right' });
            
            // Percentage badge
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
            doc.text(`${pct}%`, dataArea.x + dataArea.w - 2, barY + barHeight + 5, { align: 'right' });
          });
          
        } else if (chart.type === 'pie' || chart.type === 'donut') {
          // Premium pie/donut chart
          const centerX = dataArea.x + 45;
          const centerY = dataArea.y + dataArea.h / 2;
          const radius = Math.min(dataArea.h / 2 - 2, 28);
          const innerRadius = chart.type === 'donut' ? radius * 0.55 : 0;

          // Outer glow ring
          doc.setDrawColor(40, 40, 40);
          doc.setLineWidth(3);
          doc.circle(centerX, centerY, radius + 2, 'S');

          let startAngle = -Math.PI / 2;
          
          // Draw slices with enhanced visuals
          chart.data.forEach((item, i) => {
            const sliceAngle = total > 0 ? (item.value / total) * Math.PI * 2 : 0;
            if (sliceAngle < 0.01) return; // Skip tiny slices
            
            const colorKey = item.color || defaultColors[i % defaultColors.length];
            const colors = chartColors[colorKey];

            // Draw wedge with smooth edges
            const steps = Math.max(20, Math.ceil(sliceAngle * 20));
            
            // Dark outline for depth
            doc.setFillColor(colors.dark.r, colors.dark.g, colors.dark.b);
            for (let s = 0; s < steps; s++) {
              const a1 = startAngle + (sliceAngle * s) / steps;
              const a2 = startAngle + (sliceAngle * (s + 1)) / steps;
              
              const x1 = centerX + Math.cos(a1) * (radius + 0.5);
              const y1 = centerY + Math.sin(a1) * (radius + 0.5);
              const x2 = centerX + Math.cos(a2) * (radius + 0.5);
              const y2 = centerY + Math.sin(a2) * (radius + 0.5);
              
              doc.triangle(centerX, centerY, x1, y1, x2, y2, 'F');
            }
            
            // Main fill
            doc.setFillColor(colors.main.r, colors.main.g, colors.main.b);
            for (let s = 0; s < steps; s++) {
              const a1 = startAngle + (sliceAngle * s) / steps;
              const a2 = startAngle + (sliceAngle * (s + 1)) / steps;
              
              const x1 = centerX + Math.cos(a1) * radius;
              const y1 = centerY + Math.sin(a1) * radius;
              const x2 = centerX + Math.cos(a2) * radius;
              const y2 = centerY + Math.sin(a2) * radius;
              
              doc.triangle(centerX, centerY, x1, y1, x2, y2, 'F');
            }
            
            // Inner highlight arc (top portion only)
            const highlightSteps = Math.ceil(steps * 0.4);
            doc.setFillColor(
              Math.min(255, colors.main.r + 50),
              Math.min(255, colors.main.g + 50),
              Math.min(255, colors.main.b + 50)
            );
            for (let s = 0; s < highlightSteps; s++) {
              const a1 = startAngle + (sliceAngle * s) / steps;
              const a2 = startAngle + (sliceAngle * (s + 1)) / steps;
              
              const innerR = radius * 0.7;
              const x1 = centerX + Math.cos(a1) * innerR;
              const y1 = centerY + Math.sin(a1) * innerR;
              const x2 = centerX + Math.cos(a2) * innerR;
              const y2 = centerY + Math.sin(a2) * innerR;
              const ox1 = centerX + Math.cos(a1) * (radius - 2);
              const oy1 = centerY + Math.sin(a1) * (radius - 2);
              const ox2 = centerX + Math.cos(a2) * (radius - 2);
              const oy2 = centerY + Math.sin(a2) * (radius - 2);
              
              // Draw highlight quad as two triangles
              doc.triangle(x1, y1, ox1, oy1, ox2, oy2, 'F');
              doc.triangle(x1, y1, ox2, oy2, x2, y2, 'F');
            }

            startAngle += sliceAngle;
          });
          
          // Donut center
          if (innerRadius > 0) {
            // Shadow ring
            doc.setFillColor(10, 10, 10);
            doc.circle(centerX, centerY, innerRadius + 2, 'F');
            
            // Main center
            doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
            doc.circle(centerX, centerY, innerRadius, 'F');
            
            // Center text - total
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
            const totalStr = total >= 1000000 ? `$${(total / 1000000).toFixed(0)}M` : `$${Math.round(total / 1000)}K`;
            doc.text(totalStr, centerX, centerY + 2, { align: 'center' });
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5);
            doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
            doc.text('TOTAL', centerX, centerY - 4, { align: 'center' });
          }

          // Premium legend on the right
          const legendX = dataArea.x + 100;
          const legendWidth = dataArea.w - 105;
          
          chart.data.forEach((item, i) => {
            const legendY = dataArea.y + 2 + i * 11;
            const colorKey = item.color || defaultColors[i % defaultColors.length];
            const colors = chartColors[colorKey];
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
            const valueStr = item.value >= 1000000 
              ? `$${(item.value / 1000000).toFixed(1)}M` 
              : item.value >= 1000 
                ? `$${Math.round(item.value / 1000)}K` 
                : `$${item.value.toLocaleString()}`;

            // Color indicator with gradient
            doc.setFillColor(colors.dark.r, colors.dark.g, colors.dark.b);
            doc.roundedRect(legendX, legendY, 8, 8, 1, 1, 'F');
            doc.setFillColor(colors.main.r, colors.main.g, colors.main.b);
            doc.roundedRect(legendX, legendY, 8, 6, 1, 1, 'F');
            doc.setFillColor(
              Math.min(255, colors.main.r + 40),
              Math.min(255, colors.main.g + 40),
              Math.min(255, colors.main.b + 40)
            );
            doc.roundedRect(legendX + 1, legendY + 1, 6, 2, 0.5, 0.5, 'F');

            // Label
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(textLight.r, textLight.g, textLight.b);
            const label = item.label.length > 12 ? item.label.substring(0, 11) + '…' : item.label;
            doc.text(label, legendX + 12, legendY + 6);

            // Value and percentage on right
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
            doc.text(valueStr, legendX + legendWidth, legendY + 4, { align: 'right' });
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(colors.main.r, colors.main.g, colors.main.b);
            doc.text(`${pct}%`, legendX + legendWidth, legendY + 9, { align: 'right' });
          });
        }
      });

      yPos += Math.ceil(data.charts.length / chartsPerRow) * (chartHeight + 12) + 10;
    }

    // ====== MANAGER TRACKING ======
    if (data.managerTracking && data.managerTracking.length > 0) {
      const highEvalManagers = data.managerTracking.filter(m => m.category === 'high_eval');
      const noEvalTracking = data.managerTracking.filter(m => m.category === 'no_eval');

      if (highEvalManagers.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(accentRed.r, accentRed.g, accentRed.b);
        doc.text('HIGH EVALUATION — TOP 10', 14, yPos);
        yPos += 8;

        // Table header
        doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
        doc.rect(14, yPos, pageWidth - 28, 8, 'F');
        doc.setFontSize(8);
        doc.setTextColor(textLight.r, textLight.g, textLight.b);
        doc.text('RANK', 20, yPos + 5.5);
        doc.text('ADJUSTER NAME', 45, yPos + 5.5);
        doc.text('HIGH EVAL TOTAL', pageWidth - 20, yPos + 5.5, { align: 'right' });
        yPos += 10;

        // Table rows
        highEvalManagers.forEach((manager, idx) => {
          if (idx % 2 === 0) {
            doc.setFillColor(darkBorder.r, darkBorder.g, darkBorder.b);
            doc.rect(14, yPos - 4, pageWidth - 28, 7, 'F');
          }
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
          doc.text(String(idx + 1), 20, yPos);
          
          doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
          doc.text(manager.name, 45, yPos);
          
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(accentRed.r, accentRed.g, accentRed.b);
          doc.text(String(manager.value), pageWidth - 20, yPos, { align: 'right' });
          yPos += 7;
        });
        yPos += 8;
      }

      if (noEvalTracking.length > 0) {
        doc.setDrawColor(darkBorder.r, darkBorder.g, darkBorder.b);
        doc.setLineWidth(0.3);
        doc.line(14, yPos, pageWidth - 14, yPos);
        yPos += 8;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(accentRed.r, accentRed.g, accentRed.b);
        doc.text('NO EVALUATION ASSIGNED', 14, yPos);
        yPos += 6;

        noEvalTracking.forEach((item) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
          doc.text(`${item.name}: ${item.value} claims pending evaluation`, 14, yPos);
          yPos += 6;
        });
        yPos += 6;
      }
    }

    // Summary section with metric cards
    if (data.summary && Object.keys(data.summary).length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text('KEY METRICS', 14, yPos);
      yPos += 10;

      const entries = Object.entries(data.summary);
      const maxCols = Math.min(entries.length, 5);
      const cardWidth = (pageWidth - 28 - (maxCols - 1) * 6) / maxCols;
      
      entries.forEach(([key, value], index) => {
        const col = index % maxCols;
        const row = Math.floor(index / maxCols);
        const xPos = 14 + col * (cardWidth + 6);
        const cardY = yPos + row * 30;

        // Dark card with subtle border
        doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
        doc.rect(xPos, cardY, cardWidth, 26, 'F');
        doc.setDrawColor(darkBorder.r, darkBorder.g, darkBorder.b);
        doc.setLineWidth(0.5);
        doc.rect(xPos, cardY, cardWidth, 26, 'S');

        // Value in green for money
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
        doc.text(String(value), xPos + cardWidth / 2, cardY + 12, { align: 'center' });

        // Label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        const truncatedKey = key.length > 22 ? key.substring(0, 20) + '...' : key;
        doc.text(truncatedKey, xPos + cardWidth / 2, cardY + 21, { align: 'center' });
      });

      yPos += Math.ceil(entries.length / maxCols) * 30 + 14;
    }

    // Data Table Section - OPTIMIZED FOR NO CUTOFF
    if (data.columns.length > 0 && data.rows.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text('DETAILED DATA', 14, yPos);
      yPos += 10;

      const tableWidth = pageWidth - 28;
      const colCount = data.columns.length;
      
      // Dynamic column widths based on content
      const colWidths: number[] = data.columns.map((col, i) => {
        const headerLen = col.length;
        const maxDataLen = Math.max(...data.rows.slice(0, 50).map(row => String(row[i] || '').length));
        return Math.max(headerLen, maxDataLen);
      });
      const totalChars = colWidths.reduce((a, b) => a + b, 0);
      const calculatedWidths = colWidths.map(w => (w / totalChars) * tableWidth);
      
      // Ensure minimum width for readability
      const minColWidth = 25;
      const adjustedWidths = calculatedWidths.map(w => Math.max(w, minColWidth));
      const rowHeight = 10;

      // Table header
      doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
      doc.rect(14, yPos, tableWidth, rowHeight, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(textLight.r, textLight.g, textLight.b);
      
      let xOffset = 14;
      data.columns.forEach((col, i) => {
        const maxChars = Math.floor((adjustedWidths[i] - 4) / 2.2);
        const truncated = col.length > maxChars ? col.substring(0, maxChars - 1) + '…' : col;
        doc.text(truncated, xOffset + 3, yPos + 7);
        xOffset += adjustedWidths[i];
      });
      yPos += rowHeight;

      // Table rows with alternating colors
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      const maxY = pageHeight - 25;

      data.rows.forEach((row, rowIdx) => {
        if (yPos > maxY) {
          // Add new page with dark background
          doc.addPage();
          doc.setFillColor(darkBg.r, darkBg.g, darkBg.b);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          yPos = 20;
          
          // Repeat header
          doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
          doc.rect(14, yPos, tableWidth, rowHeight, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(textLight.r, textLight.g, textLight.b);
          
          let xOff = 14;
          data.columns.forEach((col, i) => {
            const maxChars = Math.floor((adjustedWidths[i] - 4) / 2.2);
            const truncated = col.length > maxChars ? col.substring(0, maxChars - 1) + '…' : col;
            doc.text(truncated, xOff + 3, yPos + 7);
            xOff += adjustedWidths[i];
          });
          yPos += rowHeight;
          doc.setFont('helvetica', 'normal');
        }

        // Alternating row colors
        if (rowIdx % 2 === 0) {
          doc.setFillColor(darkBorder.r, darkBorder.g, darkBorder.b);
          doc.rect(14, yPos, tableWidth, rowHeight, 'F');
        }

        // Subtle row separator
        doc.setDrawColor(darkBorder.r, darkBorder.g, darkBorder.b);
        doc.setLineWidth(0.2);
        doc.line(14, yPos + rowHeight, pageWidth - 14, yPos + rowHeight);

        // Row data with proper column alignment
        let xOff = 14;
        row.forEach((cell, i) => {
          const cellText = String(cell);
          const colW = adjustedWidths[i];
          const maxChars = Math.floor((colW - 4) / 2.2);
          const truncated = cellText.length > maxChars ? cellText.substring(0, maxChars - 1) + '…' : cellText;
          
          // Color coding for specific columns
          if (data.columns[i]?.toLowerCase().includes('level') && cellText.toUpperCase() === 'CRITICAL') {
            doc.setTextColor(accentRed.r, accentRed.g, accentRed.b);
          } else if (data.columns[i]?.toLowerCase().includes('exposure') || data.columns[i]?.toLowerCase().includes('$')) {
            doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
          } else {
            doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
          }
          
          doc.text(truncated, xOff + 3, yPos + 7);
          xOff += colW;
        });
        yPos += rowHeight;
      });
    }

    // Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      const footerY = pageHeight - 8;
      
      // Dark footer bar
      doc.setFillColor(darkCard.r, darkCard.g, darkCard.b);
      doc.rect(0, footerY - 6, pageWidth, 14, 'F');
      
      doc.setDrawColor(accentRed.r, accentRed.g, accentRed.b);
      doc.setLineWidth(0.5);
      doc.line(14, footerY - 6, pageWidth - 14, footerY - 6);
      
      doc.setFontSize(8);
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text('Fred Loya Insurance • Litigation Command Center • Confidential', 14, footerY);
      doc.setTextColor(textLight.r, textLight.g, textLight.b);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, footerY, { align: 'right' });
    }

    // Download
    const filename = `${data.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    doc.save(filename);
    
    return filename;
  };

  const generateExcel = (data: ExportableData) => {
    const wb = XLSX.utils.book_new();

    // ====== SUMMARY SHEET ======
    const summaryData: (string | number)[][] = [
      [data.title],
      [data.subtitle || ''],
      [`Generated: ${data.timestamp}`],
      data.affectsManager ? [`Prepared For: ${data.affectsManager}`] : [],
      [],
    ];

    // Add directive if exists
    if (data.directive) {
      summaryData.push(['DIRECTIVE']);
      summaryData.push([data.directive]);
      summaryData.push([]);
    }

    // Add manager tracking if exists
    if (data.managerTracking && data.managerTracking.length > 0) {
      const highEvalManagers = data.managerTracking.filter(m => m.category === 'high_eval');
      const noEvalTracking = data.managerTracking.filter(m => m.category === 'no_eval');

      if (highEvalManagers.length > 0) {
        summaryData.push(['HIGH EVALUATION TOP 10 MANAGERS']);
        summaryData.push(['Rank', 'Manager', 'High Eval Amount']);
        highEvalManagers.forEach((manager, idx) => {
          summaryData.push([idx + 1, manager.name, String(manager.value)]);
        });
        summaryData.push([]);
      }

      if (noEvalTracking.length > 0) {
        summaryData.push(['NO EVALUATION TRACKING']);
        summaryData.push(['Assigned To', 'Claims Count']);
        noEvalTracking.forEach((item) => {
          summaryData.push([item.name, String(item.value)]);
        });
        summaryData.push([]);
      }
    }

    // Add summary if exists
    if (data.summary && Object.keys(data.summary).length > 0) {
      summaryData.push(['KEY METRICS']);
      summaryData.push([]);
      Object.entries(data.summary).forEach(([key, value]) => {
        summaryData.push([key, String(value)]);
      });
      summaryData.push([]);
    }

    // Add table headers and rows
    summaryData.push([]);
    summaryData.push(['REPORT DATA']);
    summaryData.push(data.columns);
    data.rows.forEach(row => {
      summaryData.push(row.map(cell => typeof cell === 'number' ? cell : String(cell)));
    });

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

    // Set column widths for summary
    const summaryColWidths = data.columns.map((col, i) => {
      const maxLen = Math.max(
        col.length,
        ...data.rows.map(row => String(row[i] || '').length)
      );
      return { wch: Math.min(maxLen + 2, 40) };
    });
    summarySheet['!cols'] = summaryColWidths;

    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // ====== RAW CLAIM DATA SHEETS ======
    if (data.rawClaimData && data.rawClaimData.length > 0) {
      data.rawClaimData.forEach((rawData, index) => {
        const sheetName = rawData.sheetName || `Claim Data ${index + 1}`;
        const rawRows: (string | number)[][] = [rawData.columns];
        
        rawData.rows.forEach(row => {
          rawRows.push(row.map(cell => typeof cell === 'number' ? cell : String(cell)));
        });

        const rawSheet = XLSX.utils.aoa_to_sheet(rawRows);

        // Set column widths
        const rawColWidths = rawData.columns.map((col, i) => {
          const maxLen = Math.max(
            col.length,
            ...rawData.rows.slice(0, 100).map(row => String(row[i] || '').length)
          );
          return { wch: Math.min(maxLen + 2, 50) };
        });
        rawSheet['!cols'] = rawColWidths;

        // Truncate sheet name to 31 chars (Excel limit)
        const safeSheetName = sheetName.substring(0, 31);
        XLSX.utils.book_append_sheet(wb, rawSheet, safeSheetName);
      });
    }

    // Download
    const filename = `${data.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    return filename;
  };

  const exportBoth = async (data: ExportableData) => {
    const pdfFile = await generatePDF(data);
    const xlsFile = generateExcel(data);
    return { pdfFile, xlsFile };
  };

  // Generate a comprehensive Excel workbook with multiple sections
  const generateFullExcel = (sections: { title: string; data: ExportableData }[]) => {
    const wb = XLSX.utils.book_new();

    sections.forEach((section, sectionIndex) => {
      const { title, data } = section;
      
      // ====== SECTION SUMMARY SHEET ======
      const summaryData: (string | number)[][] = [
        [data.title],
        [data.subtitle || ''],
        [`Generated: ${data.timestamp}`],
        data.affectsManager ? [`Prepared For: ${data.affectsManager}`] : [],
        [],
      ];

      // Add summary metrics
      if (data.summary && Object.keys(data.summary).length > 0) {
        summaryData.push(['KEY METRICS']);
        Object.entries(data.summary).forEach(([key, value]) => {
          summaryData.push([key, String(value)]);
        });
        summaryData.push([]);
      }

      // Add report data
      if (data.columns.length > 0 && data.rows.length > 0) {
        summaryData.push(['REPORT DATA']);
        summaryData.push(data.columns);
        data.rows.forEach(row => {
          summaryData.push(row.map(cell => typeof cell === 'number' ? cell : String(cell)));
        });
      }

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      const safeSheetName = `${sectionIndex + 1}. ${title}`.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, summarySheet, safeSheetName);

      // ====== RAW CLAIM DATA SHEETS FOR THIS SECTION ======
      if (data.rawClaimData && data.rawClaimData.length > 0) {
        data.rawClaimData.forEach((rawData, rawIndex) => {
          const rawRows: (string | number)[][] = [rawData.columns];
          rawData.rows.forEach(row => {
            rawRows.push(row.map(cell => typeof cell === 'number' ? cell : String(cell)));
          });

          const rawSheet = XLSX.utils.aoa_to_sheet(rawRows);
          
          // Set column widths
          const rawColWidths = rawData.columns.map((col, i) => {
            const maxLen = Math.max(
              col.length,
              ...rawData.rows.slice(0, 100).map(row => String(row[i] || '').length)
            );
            return { wch: Math.min(maxLen + 2, 50) };
          });
          rawSheet['!cols'] = rawColWidths;

          const rawSheetName = `${sectionIndex + 1}.${rawIndex + 1} ${rawData.sheetName || 'Data'}`.substring(0, 31);
          XLSX.utils.book_append_sheet(wb, rawSheet, rawSheetName);
        });
      }
    });

    // Download
    const filename = `Executive_Dashboard_Full_Export_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    return filename;
  };

  // Generate Executive Command Center PDF - Matching Dashboard Layout
  const generateExecutivePDF = async (metrics: {
    totalOpenReserves: number;
    pendingEval: number;
    pendingEvalPct: number;
    closuresThisMonth: number;
    avgDaysToClose: number;
    closureTrend: number;
    aged365Count: number;
    aged365Reserves: number;
    aged365Pct: number;
    reservesMoM: number;
    reservesYoY: number;
    lowEval: number;
    medianEval: number;
    highEval: number;
  }, granularData?: {
    byAge: { age: string; claims: number; openReserves: number; lowEval: number; highEval: number }[];
    byQueue: { queue: string; openReserves: number; lowEval: number; highEval: number; noEvalCount: number }[];
    byTypeGroup: { typeGroup: string; reserves: number }[];
    highEvalAdjusters: { name: string; value: string }[];
    quarterlyData?: { quarter: string; paid: number; paidMonthly: number; approved: number; approvedMonthly: number; variance: number }[];
  }) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const timestamp = format(new Date(), 'MMMM d, yyyy h:mm a');
    
    // EXECUTIVE THEME - Matches dashboard exactly
    const darkBg = { r: 9, g: 9, b: 11 };             // Zinc-950
    const cardBg = { r: 24, g: 24, b: 27 };           // Zinc-900
    const darkBorder = { r: 39, g: 39, b: 42 };       // Zinc-800
    const textWhite = { r: 250, g: 250, b: 250 };     // Zinc-50
    const textMuted = { r: 161, g: 161, b: 170 };     // Zinc-400
    const textLight = { r: 212, g: 212, b: 216 };     // Zinc-300
    const accentRed = { r: 239, g: 68, b: 68 };       // Red-500
    const accentGreen = { r: 34, g: 197, b: 94 };     // Green-500
    const accentAmber = { r: 245, g: 158, b: 11 };    // Amber-500
    const accentYellow = { r: 250, g: 204, b: 21 };   // Yellow-400
    
    const formatCurrency = (val: number) => {
      if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
      return `$${val.toFixed(0)}`;
    };

    // === PAGE 1: Executive Summary ===
    doc.setFillColor(darkBg.r, darkBg.g, darkBg.b);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Header with logo
    let yPos = 12;
    try {
      const logoBase64 = await loadImageAsBase64(loyaLogo);
      doc.addImage(logoBase64, 'JPEG', 14, 8, 45, 13);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text('FRED LOYA INSURANCE', 14, 16);
    }

    // Title section - matching dashboard header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
    doc.text('Litigation Command Center', 65, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('2025 Portfolio', 65, 20);

    // Live badge
    doc.setFillColor(accentGreen.r, accentGreen.g, accentGreen.b);
    doc.roundedRect(pageWidth - 45, 10, 32, 10, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('● LIVE', pageWidth - 40, 16);

    yPos = 30;

    // === EXECUTIVE COMMAND CENTER HEADER ===
    doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
    doc.roundedRect(14, yPos, pageWidth - 28, 22, 3, 3, 'F');
    doc.setDrawColor(darkBorder.r, darkBorder.g, darkBorder.b);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, yPos, pageWidth - 28, 22, 3, 3, 'S');
    
    // Yellow accent bar
    doc.setFillColor(accentYellow.r, accentYellow.g, accentYellow.b);
    doc.rect(14, yPos, 4, 22, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
    doc.text('EXECUTIVE COMMAND CENTER', 24, yPos + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('Litigation Intelligence Dashboard', 24, yPos + 18);
    doc.text(timestamp, pageWidth - 80, yPos + 14);

    yPos += 28;

    // === EXPENSE BREAKDOWN BAR ===
    doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
    doc.roundedRect(14, yPos, pageWidth - 28, 45, 3, 3, 'F');
    
    // Title row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
    doc.text('2025 YTD BI Spend: $395M Total', 20, yPos + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('Litigation Expenses: $19M • Through November 2025', 20, yPos + 18);
    
    // Right side breakdown
    doc.setFontSize(8);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('$19M EXPENSE BREAKDOWN', pageWidth - 70, yPos + 8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
    doc.text('$5.68M Expert', pageWidth - 70, yPos + 16);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('vs', pageWidth - 45, yPos + 16);
    doc.setTextColor(accentRed.r, accentRed.g, accentRed.b);
    doc.text('$13.32M Waste', pageWidth - 38, yPos + 16);
    
    // Progress bar
    const barY = yPos + 26;
    const barWidth = pageWidth - 48;
    const expertPct = 30;
    
    doc.setFillColor(accentGreen.r, accentGreen.g, accentGreen.b);
    doc.roundedRect(20, barY, barWidth * (expertPct / 100), 8, 2, 2, 'F');
    doc.setFillColor(accentRed.r, accentRed.g, accentRed.b);
    doc.roundedRect(20 + barWidth * (expertPct / 100), barY, barWidth * ((100 - expertPct) / 100), 8, 2, 2, 'F');
    
    doc.setFontSize(7);
    doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
    doc.text('$5.68M', 20 + (barWidth * expertPct / 200), barY + 5.5);
    doc.text('$13.32M', 20 + barWidth * (expertPct / 100) + (barWidth * (100 - expertPct) / 200) - 8, barY + 5.5);
    
    // Labels
    doc.setFontSize(7);
    doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
    doc.text('30% Strategic', 20, barY + 16);
    doc.setTextColor(accentRed.r, accentRed.g, accentRed.b);
    doc.text('70% Reactive', pageWidth - 48, barY + 16);

    yPos += 50;

    // === KPI CARDS ROW ===
    const kpiWidth = (pageWidth - 70) / 5;
    const kpiHeight = 38;
    
    const kpis = [
      { label: 'TOTAL BI SPEND', value: '$395M', sub: 'All Bodily Injury YTD', color: textWhite },
      { label: 'LIT EXPENSES', value: '$19M', sub: 'Litigation portion', color: accentGreen },
      { label: 'EXPERT SPEND', value: '$5.68M', sub: '$516K avg/month', color: accentGreen },
      { label: 'REACTIVE WASTE', value: '$13.32M', sub: 'Pre-lit ATR + Lit fees', color: accentRed },
      { label: 'WASTE RATIO', value: '2.3x', sub: '$1 expert = $2.34 waste', color: accentYellow },
    ];
    
    kpis.forEach((kpi, i) => {
      const x = 14 + i * (kpiWidth + 14);
      doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
      doc.roundedRect(x, yPos, kpiWidth, kpiHeight, 3, 3, 'F');
      
      doc.setFontSize(7);
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text(kpi.label, x + 6, yPos + 10);
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(kpi.color.r, kpi.color.g, kpi.color.b);
      doc.text(kpi.value, x + 6, yPos + 24);
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text(kpi.sub, x + 6, yPos + 32);
    });

    yPos += kpiHeight + 10;

    // === QUARTERLY TABLE ===
    doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
    doc.roundedRect(14, yPos, pageWidth - 28, 58, 3, 3, 'F');
    
    // Yellow accent bar
    doc.setFillColor(accentYellow.r, accentYellow.g, accentYellow.b);
    doc.rect(14, yPos, 4, 58, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(accentYellow.r, accentYellow.g, accentYellow.b);
    doc.text('2025 LITIGATION EXPERT SPEND BY QUARTER', 24, yPos + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('YTD through November — Paid vs Approved', 24, yPos + 17);
    
    // Table header
    const tableY = yPos + 22;
    const cols = ['Quarter', 'Paid', 'Paid Monthly Avg', 'Approved', 'Approved Monthly Avg', 'Variance'];
    const colWidths = [40, 50, 50, 50, 50, 40];
    let colX = 24;
    
    doc.setFontSize(7);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    cols.forEach((col, i) => {
      doc.text(col, colX, tableY);
      colX += colWidths[i];
    });
    
    // Table data
    const quarterlyData = granularData?.quarterlyData || [
      { quarter: 'Q1 2025', paid: 1553080, paidMonthly: 517693, approved: 2141536, approvedMonthly: 713845, variance: -588456 },
      { quarter: 'Q2 2025', paid: 1727599, paidMonthly: 575866, approved: 1680352, approvedMonthly: 560117, variance: 47247 },
      { quarter: 'Q3 2025', paid: 1383717, paidMonthly: 461239, approved: 1449627, approvedMonthly: 483209, variance: -65910 },
      { quarter: 'Q4 2025', paid: 1016756, paidMonthly: 508378, approved: 909651, approvedMonthly: 454826, variance: 107105 },
    ];
    
    quarterlyData.forEach((row, i) => {
      const rowY = tableY + 8 + i * 8;
      colX = 24;
      
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text(row.quarter, colX, rowY);
      colX += colWidths[0];
      
      doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
      doc.text(`$${(row.paid / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, colX, rowY);
      colX += colWidths[1];
      
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text(`$${row.paidMonthly.toLocaleString()}`, colX, rowY);
      colX += colWidths[2];
      
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text(`$${row.approved.toLocaleString()}`, colX, rowY);
      colX += colWidths[3];
      
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text(`$${row.approvedMonthly.toLocaleString()}`, colX, rowY);
      colX += colWidths[4];
      
      const varColor = row.variance >= 0 ? accentGreen : accentRed;
      doc.setTextColor(varColor.r, varColor.g, varColor.b);
      doc.text(`${row.variance >= 0 ? '+' : ''}$${Math.abs(row.variance).toLocaleString()}`, colX, rowY);
    });

    // Footer
    const footerY = pageHeight - 8;
    doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
    doc.rect(0, footerY - 6, pageWidth, 14, 'F');
    doc.setDrawColor(accentRed.r, accentRed.g, accentRed.b);
    doc.setLineWidth(0.5);
    doc.line(14, footerY - 6, pageWidth - 14, footerY - 6);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('Fred Loya Insurance • Litigation Command Center • Confidential', 14, footerY);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.text('Page 1 of 2', pageWidth - 30, footerY);

    // === PAGE 2: Reserves & Evaluation Detail ===
    doc.addPage();
    doc.setFillColor(darkBg.r, darkBg.g, darkBg.b);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    yPos = 14;
    
    // Header continuation
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
    doc.text('RESERVES & EVALUATION DETAIL', 14, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(timestamp, pageWidth - 80, yPos);

    yPos = 26;

    // === RESERVES SUMMARY CARDS ===
    const resCardWidth = (pageWidth - 56) / 4;
    const resCardHeight = 36;
    
    const resCards = [
      { label: 'OPEN RESERVES', value: formatCurrency(metrics.totalOpenReserves), trend: `${metrics.reservesMoM > 0 ? '+' : ''}${metrics.reservesMoM}% MoM`, trendColor: metrics.reservesMoM > 0 ? accentRed : accentGreen },
      { label: 'PENDING EVAL', value: formatCurrency(metrics.pendingEval), trend: `${metrics.pendingEvalPct.toFixed(0)}% uneval`, trendColor: accentAmber },
      { label: 'AGED 365+ DAYS', value: metrics.aged365Count.toLocaleString(), trend: `${metrics.aged365Pct}% of inventory`, trendColor: accentRed },
      { label: 'CLOSURES/MONTH', value: metrics.closuresThisMonth.toLocaleString(), trend: `+${metrics.closureTrend}% trend`, trendColor: accentGreen },
    ];
    
    resCards.forEach((card, i) => {
      const x = 14 + i * (resCardWidth + 14);
      doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
      doc.roundedRect(x, yPos, resCardWidth, resCardHeight, 3, 3, 'F');
      
      doc.setFontSize(7);
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text(card.label, x + 6, yPos + 10);
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text(card.value, x + 6, yPos + 22);
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(card.trendColor.r, card.trendColor.g, card.trendColor.b);
      doc.text(card.trend, x + 6, yPos + 30);
    });

    yPos += resCardHeight + 10;

    // === EVALUATION BREAKDOWN ===
    const evalWidth = (pageWidth - 42) / 3;
    
    doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
    doc.roundedRect(14, yPos, pageWidth - 28, 32, 3, 3, 'F');
    
    const evalItems = [
      { label: 'LOW EVAL', value: formatCurrency(metrics.lowEval), color: accentGreen },
      { label: 'MEDIAN EVAL', value: formatCurrency(metrics.medianEval), color: textWhite },
      { label: 'HIGH EVAL', value: formatCurrency(metrics.highEval), color: accentRed },
    ];
    
    evalItems.forEach((item, i) => {
      const x = 24 + i * evalWidth;
      doc.setFillColor(item.color.r, item.color.g, item.color.b);
      doc.circle(x + 8, yPos + 16, 6, 'F');
      
      doc.setFontSize(8);
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text(item.label, x + 20, yPos + 12);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(item.color.r, item.color.g, item.color.b);
      doc.text(item.value, x + 20, yPos + 24);
    });

    yPos += 40;

    // === BY AGE TABLE ===
    if (granularData?.byAge) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text('RESERVES BY AGE', 14, yPos);
      yPos += 8;
      
      // Table header
      doc.setFillColor(darkBorder.r, darkBorder.g, darkBorder.b);
      doc.rect(14, yPos, pageWidth - 28, 8, 'F');
      doc.setFontSize(7);
      doc.setTextColor(textLight.r, textLight.g, textLight.b);
      const ageColWidths = [50, 30, 50, 40, 40, 40];
      let ageX = 18;
      ['Age Bucket', 'Claims', 'Open Reserves', 'Low Eval', 'High Eval', 'Gap'].forEach((h, i) => {
        doc.text(h, ageX, yPos + 5.5);
        ageX += ageColWidths[i];
      });
      yPos += 10;
      
      granularData.byAge.forEach((row, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(24, 24, 27);
          doc.rect(14, yPos - 1, pageWidth - 28, 7, 'F');
        }
        
        ageX = 18;
        doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
        doc.text(row.age, ageX, yPos + 4);
        ageX += ageColWidths[0];
        doc.text(row.claims.toLocaleString(), ageX, yPos + 4);
        ageX += ageColWidths[1];
        doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
        doc.text(formatCurrency(row.openReserves), ageX, yPos + 4);
        ageX += ageColWidths[2];
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.text(formatCurrency(row.lowEval), ageX, yPos + 4);
        ageX += ageColWidths[3];
        doc.text(formatCurrency(row.highEval), ageX, yPos + 4);
        ageX += ageColWidths[4];
        const gap = row.openReserves - row.highEval;
        doc.setTextColor(accentAmber.r, accentAmber.g, accentAmber.b);
        doc.text(formatCurrency(gap), ageX, yPos + 4);
        yPos += 7;
      });
    }

    yPos += 8;

    // === BY QUEUE TABLE ===
    if (granularData?.byQueue && yPos < pageHeight - 50) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
      doc.text('RESERVES BY QUEUE', 14, yPos);
      yPos += 8;
      
      doc.setFillColor(darkBorder.r, darkBorder.g, darkBorder.b);
      doc.rect(14, yPos, pageWidth - 28, 8, 'F');
      doc.setFontSize(7);
      doc.setTextColor(textLight.r, textLight.g, textLight.b);
      const qColWidths = [40, 50, 40, 40, 35, 35];
      let qX = 18;
      ['Queue', 'Open Reserves', 'Low Eval', 'High Eval', 'No Eval #', '% Total'].forEach((h, i) => {
        doc.text(h, qX, yPos + 5.5);
        qX += qColWidths[i];
      });
      yPos += 10;
      
      const totalRes = granularData.byQueue.reduce((s, q) => s + q.openReserves, 0);
      granularData.byQueue.slice(0, 6).forEach((row, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(24, 24, 27);
          doc.rect(14, yPos - 1, pageWidth - 28, 7, 'F');
        }
        
        qX = 18;
        doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
        doc.text(row.queue, qX, yPos + 4);
        qX += qColWidths[0];
        doc.setTextColor(accentGreen.r, accentGreen.g, accentGreen.b);
        doc.text(formatCurrency(row.openReserves), qX, yPos + 4);
        qX += qColWidths[1];
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.text(formatCurrency(row.lowEval), qX, yPos + 4);
        qX += qColWidths[2];
        doc.text(formatCurrency(row.highEval), qX, yPos + 4);
        qX += qColWidths[3];
        doc.setTextColor(accentAmber.r, accentAmber.g, accentAmber.b);
        doc.text(row.noEvalCount.toString(), qX, yPos + 4);
        qX += qColWidths[4];
        const pct = ((row.openReserves / totalRes) * 100).toFixed(1);
        doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        doc.text(`${pct}%`, qX, yPos + 4);
        yPos += 7;
      });
    }

    // Footer page 2
    const footer2Y = pageHeight - 8;
    doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
    doc.rect(0, footer2Y - 6, pageWidth, 14, 'F');
    doc.setDrawColor(accentRed.r, accentRed.g, accentRed.b);
    doc.setLineWidth(0.5);
    doc.line(14, footer2Y - 6, pageWidth - 14, footer2Y - 6);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('Fred Loya Insurance • Litigation Command Center • Confidential', 14, footer2Y);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.text('Page 2 of 2', pageWidth - 30, footer2Y);

    const filename = `Executive_Command_Center_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    doc.save(filename);
    return filename;
  };

  // Generate Executive Package: PDF summary + Excel with granular data
  const generateExecutivePackage = async (metrics: {
    totalOpenReserves: number;
    pendingEval: number;
    pendingEvalPct: number;
    closuresThisMonth: number;
    avgDaysToClose: number;
    closureTrend: number;
    aged365Count: number;
    aged365Reserves: number;
    aged365Pct: number;
    reservesMoM: number;
    reservesYoY: number;
    lowEval: number;
    medianEval: number;
    highEval: number;
  }, granularData: {
    byAge: { age: string; claims: number; openReserves: number; lowEval: number; highEval: number }[];
    byQueue: { queue: string; openReserves: number; lowEval: number; highEval: number; noEvalCount: number }[];
    byTypeGroup: { typeGroup: string; reserves: number }[];
    highEvalAdjusters: { name: string; value: string }[];
    quarterlyData?: { quarter: string; paid: number; paidMonthly: number; approved: number; approvedMonthly: number; variance: number }[];
  }) => {
    const timestamp = format(new Date(), 'MMMM d, yyyy h:mm a');
    const dateStamp = format(new Date(), 'yyyyMMdd_HHmm');
    
    // Generate Excel with granular data
    const wb = XLSX.utils.book_new();
    
    // Sheet 1: Executive Summary
    const summaryData: (string | number)[][] = [
      ['EXECUTIVE COMMAND CENTER - SUMMARY'],
      [`Generated: ${timestamp}`],
      [],
      ['KEY PERFORMANCE INDICATORS'],
      [],
      ['Metric', 'Value', 'Trend'],
      ['Total Open Reserves', `$${(metrics.totalOpenReserves / 1000000).toFixed(1)}M`, `${metrics.reservesMoM > 0 ? '+' : ''}${metrics.reservesMoM}% MoM`],
      ['Pending Evaluation', `$${(metrics.pendingEval / 1000000).toFixed(1)}M`, `${metrics.pendingEvalPct.toFixed(0)}% of reserves`],
      ['Low Eval Total', `$${(metrics.lowEval / 1000000).toFixed(1)}M`, ''],
      ['Median Eval', `$${(metrics.medianEval / 1000000).toFixed(1)}M`, ''],
      ['High Eval Total', `$${(metrics.highEval / 1000000).toFixed(1)}M`, ''],
      [],
      ['CLOSURES'],
      ['Closures This Month', metrics.closuresThisMonth, `+${metrics.closureTrend}% trend`],
      ['Average Days to Close', metrics.avgDaysToClose, ''],
      [],
      ['AGING ALERTS'],
      ['Claims 365+ Days', metrics.aged365Count, `${metrics.aged365Pct}% of inventory`],
      ['Reserves 365+ Days', `$${(metrics.aged365Reserves / 1000000).toFixed(1)}M`, ''],
      [],
      ['YEAR OVER YEAR'],
      ['Reserves YoY', `${metrics.reservesYoY > 0 ? '+' : ''}${metrics.reservesYoY}%`, ''],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Executive Summary');
    
    // Sheet 2: Reserves by Age Bucket
    const ageData: (string | number)[][] = [
      ['RESERVES BY AGE BUCKET'],
      [`Generated: ${timestamp}`],
      [],
      ['Age Bucket', 'Claims', 'Open Reserves', 'Low Eval', 'High Eval', 'Gap (No Eval)'],
    ];
    granularData.byAge.forEach(row => {
      const gap = row.openReserves - row.highEval;
      ageData.push([row.age, row.claims, row.openReserves, row.lowEval, row.highEval, gap]);
    });
    // Totals row
    const ageTotals = granularData.byAge.reduce((acc, row) => ({
      claims: acc.claims + row.claims,
      reserves: acc.reserves + row.openReserves,
      low: acc.low + row.lowEval,
      high: acc.high + row.highEval,
    }), { claims: 0, reserves: 0, low: 0, high: 0 });
    ageData.push([]);
    ageData.push(['TOTAL', ageTotals.claims, ageTotals.reserves, ageTotals.low, ageTotals.high, ageTotals.reserves - ageTotals.high]);
    
    const ageSheet = XLSX.utils.aoa_to_sheet(ageData);
    ageSheet['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ageSheet, 'By Age Bucket');
    
    // Sheet 3: Reserves by Queue/Type
    const queueData: (string | number)[][] = [
      ['RESERVES BY QUEUE'],
      [`Generated: ${timestamp}`],
      [],
      ['Queue', 'Open Reserves', 'Low Eval', 'High Eval', 'No Eval Count', '% of Total'],
    ];
    const totalReserves = granularData.byQueue.reduce((sum, q) => sum + q.openReserves, 0);
    granularData.byQueue.forEach(row => {
      const pct = totalReserves > 0 ? ((row.openReserves / totalReserves) * 100).toFixed(1) + '%' : '0%';
      queueData.push([row.queue, row.openReserves, row.lowEval, row.highEval, row.noEvalCount, pct]);
    });
    const queueSheet = XLSX.utils.aoa_to_sheet(queueData);
    queueSheet['!cols'] = [{ wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, queueSheet, 'By Queue');
    
    // Sheet 4: Full Type Group Breakdown
    const typeData: (string | number)[][] = [
      ['RESERVES BY TYPE GROUP'],
      [`Generated: ${timestamp}`],
      [],
      ['Type Group', 'Reserves', '% of Total'],
    ];
    const typeTotal = granularData.byTypeGroup.reduce((sum, t) => sum + t.reserves, 0);
    granularData.byTypeGroup.forEach(row => {
      const pct = typeTotal > 0 ? ((row.reserves / typeTotal) * 100).toFixed(2) + '%' : '0%';
      typeData.push([row.typeGroup, row.reserves, pct]);
    });
    typeData.push([]);
    typeData.push(['TOTAL', typeTotal, '100%']);
    const typeSheet = XLSX.utils.aoa_to_sheet(typeData);
    typeSheet['!cols'] = [{ wch: 15 }, { wch: 18 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, typeSheet, 'By Type Group');
    
    // Sheet 5: High Eval Adjusters (Full List)
    const adjusterData: (string | number)[][] = [
      ['HIGH EVALUATION ADJUSTERS - COMPLETE LIST'],
      [`Generated: ${timestamp}`],
      [],
      ['Rank', 'Adjuster Name', 'High Eval Amount'],
    ];
    granularData.highEvalAdjusters.forEach((adj, idx) => {
      adjusterData.push([idx + 1, adj.name, adj.value]);
    });
    const adjusterSheet = XLSX.utils.aoa_to_sheet(adjusterData);
    adjusterSheet['!cols'] = [{ wch: 8 }, { wch: 35 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, adjusterSheet, 'High Eval Adjusters');
    
    // Save Excel
    const excelFilename = `Executive_Command_Center_Data_${dateStamp}.xlsx`;
    XLSX.writeFile(wb, excelFilename);
    
    // Generate PDF with granular data
    await generateExecutivePDF(metrics, granularData);
    
    return { pdf: `Executive_Command_Center_${dateStamp}.pdf`, excel: excelFilename };
  };

  return { generatePDF, generateExcel, exportBoth, generateFullExcel, generateExecutivePDF, generateExecutivePackage };
}

// Export type definitions for different dashboard sections
export type ExportSection = 
  | 'kpi-spend'
  | 'quarterly-expert'
  | 'cost-curve'
  | 'expert-vs-reactive'
  | 'executive-review'
  | 'claim-detail'
  | 'open-inventory'
  | 'litigation-discipline'
  | 'expert-matching';
