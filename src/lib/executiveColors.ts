/**
 * Executive Colors & Report Context
 * Shared colors and utilities for PDF generation
 */

import { format } from 'date-fns';

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

export interface ReportContext {
  runDate: Date;
  reportPeriod: string;
  reportTime: string;
  weekNumber: number;
  quarter: number;
  fiscalYear: number;
  reportId: string;
}

export function getReportContext(): ReportContext {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  
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
  };
}

/**
 * Format currency for executive reports
 */
export function formatCurrency(value: number, compact: boolean = false): string {
  if (compact) {
    if (Math.abs(value) >= 1_000_000_000) return '$' + (value / 1_000_000_000).toFixed(1) + 'B';
    if (Math.abs(value) >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(value) >= 1_000) return '$' + (value / 1_000).toFixed(0) + 'K';
  }
  return '$' + value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Format percent for executive reports
 */
export function formatPercent(value: number): string {
  return value.toFixed(1) + '%';
}

/**
 * Get delta direction based on value
 */
export function getDeltaDirection(value: number, lowerIsBetter: boolean = true): 'positive' | 'negative' | 'neutral' {
  if (value === 0) return 'neutral';
  if (lowerIsBetter) {
    return value < 0 ? 'positive' : 'negative';
  }
  return value > 0 ? 'positive' : 'negative';
}
