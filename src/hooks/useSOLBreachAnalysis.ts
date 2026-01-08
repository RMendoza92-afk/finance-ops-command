import { useState, useEffect } from "react";
import Papa from "papaparse";
import { parse, addYears, addDays, isBefore, isAfter } from "date-fns";
import * as XLSX from "xlsx";

// Statute of Limitations by State (in years)
const STATE_SOL: Record<string, number> = {
  'ALABAMA': 2,
  'ALASKA': 2,
  'ARIZONA': 2,
  'ARKANSAS': 3,
  'CALIFORNIA': 2,
  'COLORADO': 3,
  'CONNECTICUT': 2,
  'DELAWARE': 2,
  'FLORIDA': 2,
  'GEORGIA': 2,
  'HAWAII': 2,
  'IDAHO': 2,
  'ILLINOIS': 2,
  'INDIANA': 2,
  'IOWA': 2,
  'KANSAS': 2,
  'KENTUCKY': 1,
  'LOUISIANA': 2,
  'MAINE': 6,
  'MARYLAND': 3,
  'MASSACHUSETTS': 3,
  'MICHIGAN': 3,
  'MINNESOTA': 2,
  'MISSISSIPPI': 3,
  'MISSOURI': 5,
  'MONTANA': 3,
  'NEBRASKA': 4,
  'NEVADA': 2,
  'NEW HAMPSHIRE': 3,
  'NEW JERSEY': 2,
  'NEW MEXICO': 3,
  'NEW YORK': 3,
  'NORTH CAROLINA': 3,
  'NORTH DAKOTA': 6,
  'OHIO': 2,
  'OKLAHOMA': 2,
  'OREGON': 2,
  'PENNSYLVANIA': 2,
  'RHODE ISLAND': 3,
  'SOUTH CAROLINA': 3,
  'SOUTH DAKOTA': 3,
  'TENNESSEE': 1,
  'TEXAS': 2,
  'UTAH': 4,
  'VERMONT': 3,
  'VIRGINIA': 2,
  'WASHINGTON': 3,
  'WEST VIRGINIA': 2,
  'WISCONSIN': 3,
  'WYOMING': 4,
  'WASHINGTON, D.C.': 3,
  'DC': 3,
  'DISTRICT OF COLUMBIA': 3,
};

interface SOLBreachClaim {
  claimNumber: string;
  state: string;
  expCreateDate: string;
  solExpiryDate: Date;
  biStatus: string;
  reserves: number;
  solYears: number;
  daysUntilExpiry: number;
  category: 'breached' | 'approaching';
}

export interface SOLBreachData {
  breachedClaims: SOLBreachClaim[];
  approachingClaims: SOLBreachClaim[];
  breachedTotal: number;
  approachingTotal: number;
  combinedTotal: number;
  breachedCount: number;
  approachingCount: number;
  totalPendingCount: number; // breached + approaching for Decisions Pending
  byState: Record<string, { count: number; reserves: number }>;
}

function parseCurrency(val: string): number {
  if (!val || val.trim() === '' || val === '(blank)') return 0;
  const cleaned = val.replace(/[$,\s]/g, '').trim();
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -parseFloat(cleaned.slice(1, -1)) || 0;
  }
  return parseFloat(cleaned) || 0;
}

function parseExpCreateDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  // Try M/D/YY format first (e.g., "6/28/23")
  try {
    const parsed = parse(dateStr.trim(), 'M/d/yy', new Date());
    if (!isNaN(parsed.getTime())) return parsed;
  } catch {}
  
  // Try M/D/YYYY format
  try {
    const parsed = parse(dateStr.trim(), 'M/d/yyyy', new Date());
    if (!isNaN(parsed.getTime())) return parsed;
  } catch {}
  
  return null;
}

export function useSOLBreachAnalysis() {
  const [data, setData] = useState<SOLBreachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAndAnalyze() {
      try {
        const response = await fetch('/data/open-exposure-raw-jan8.csv?d=2026-01-08');
        const csvText = await response.text();
        
        const parsed = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
        });
        
        const rows = parsed.data as Record<string, string>[];
        const today = new Date('2026-01-06'); // Current date
        const approachingThreshold = addDays(today, 90); // 90 days from now
        
        const breachedClaims: SOLBreachClaim[] = [];
        const approachingClaims: SOLBreachClaim[] = [];
        const byState: Record<string, { count: number; reserves: number }> = {};
        
        for (const row of rows) {
          // Handle different possible column name formats
          const biStatus = (row['BI Status'] || row['BI Status '] || '').trim();
          
          // Only check "In Progress" or "Settled"
          if (biStatus !== 'In Progress' && biStatus !== 'Settled') continue;
          
          const state = row['Accident Location State']?.trim().toUpperCase() || '';
          const expCreateDateStr = row['Exp. Create Date']?.trim() || '';
          const reserves = parseCurrency(row['Open Reserves'] || '0');
          const claimNumber = row['Claim#'] || '';
          
          // Get SOL for state
          const solYears = STATE_SOL[state];
          if (!solYears) continue; // Skip if state not found
          
          const expCreateDate = parseExpCreateDate(expCreateDateStr);
          if (!expCreateDate) continue; // Skip if date can't be parsed
          
          // Calculate SOL expiry date
          const solExpiryDate = addYears(expCreateDate, solYears);
          const daysUntilExpiry = Math.floor((solExpiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          // Check if SOL is breached (expiry date is before today)
          if (isBefore(solExpiryDate, today)) {
            const breach: SOLBreachClaim = {
              claimNumber,
              state,
              expCreateDate: expCreateDateStr,
              solExpiryDate,
              biStatus,
              reserves,
              solYears,
              daysUntilExpiry,
              category: 'breached',
            };
            
            breachedClaims.push(breach);
            
            // Track by state
            if (!byState[state]) {
              byState[state] = { count: 0, reserves: 0 };
            }
            byState[state].count++;
            byState[state].reserves += reserves;
          } 
          // Check if SOL is approaching (within 90 days)
          else if (isBefore(solExpiryDate, approachingThreshold)) {
            const approaching: SOLBreachClaim = {
              claimNumber,
              state,
              expCreateDate: expCreateDateStr,
              solExpiryDate,
              biStatus,
              reserves,
              solYears,
              daysUntilExpiry,
              category: 'approaching',
            };
            
            approachingClaims.push(approaching);
          }
        }
        
        const breachedTotal = breachedClaims.reduce((sum, b) => sum + b.reserves, 0);
        const approachingTotal = approachingClaims.reduce((sum, b) => sum + b.reserves, 0);
        
        setData({
          breachedClaims,
          approachingClaims,
          breachedTotal,
          approachingTotal,
          combinedTotal: breachedTotal + approachingTotal,
          breachedCount: breachedClaims.length,
          approachingCount: approachingClaims.length,
          totalPendingCount: breachedClaims.length + approachingClaims.length,
          byState,
        });
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to analyze SOL breaches');
        setLoading(false);
      }
    }
    
    loadAndAnalyze();
  }, []);

  // Export function for Excel - Standardized Executive Format
  const exportToExcel = () => {
    if (!data) return;

    const wb = XLSX.utils.book_new();

    // === EXECUTIVE SUMMARY SHEET ===
    const summaryRows: (string | number)[][] = [
      ['SOL RISK REVIEW - DECISIONS PENDING'],
      ['Fred Loya Insurance | Discipline Command Center'],
      [''],
      ['Report Date:', '2026-01-06'],
      ['Classification:', 'CONFIDENTIAL - EXECUTIVE USE ONLY'],
      [''],
      ['KEY METRICS'],
      ['Metric', 'Value'],
      ['Total Breached Claims (Past SOL)', data.breachedCount],
      ['Breached Reserves', data.breachedTotal],
      ['Total Approaching Claims (90 days)', data.approachingCount],
      ['Approaching Reserves', data.approachingTotal],
      ['Combined Total Claims', data.totalPendingCount],
      ['Combined Total Reserves', data.combinedTotal],
      [''],
      ['EXECUTIVE SUMMARY'],
      [`${data.totalPendingCount} claims require immediate review. ${data.breachedCount} have exceeded SOL. ${data.approachingCount} approaching within 90 days.`],
    ];

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    summaryWs['!cols'] = [{ wch: 40 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Executive Summary');

    // === BREACHED CLAIMS SHEET ===
    if (data.breachedClaims.length > 0) {
      const breachedRows: (string | number)[][] = [
        ['BREACHED CLAIMS - PAST STATUTE OF LIMITATIONS'],
        ['Generated: 2026-01-06'],
        [''],
        ['Claim #', 'State', 'BI Status', 'Exp. Create Date', 'SOL (Years)', 'SOL Expiry', 'Days Past Due', 'Open Reserves'],
      ];
      data.breachedClaims.forEach(c => {
        breachedRows.push([
          c.claimNumber,
          c.state,
          c.biStatus,
          c.expCreateDate,
          c.solYears,
          c.solExpiryDate.toLocaleDateString(),
          Math.abs(c.daysUntilExpiry),
          c.reserves,
        ]);
      });
      const breachedWs = XLSX.utils.aoa_to_sheet(breachedRows);
      breachedWs['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, breachedWs, 'Breached Claims');
    }

    // === APPROACHING CLAIMS SHEET ===
    if (data.approachingClaims.length > 0) {
      const approachingRows: (string | number)[][] = [
        ['APPROACHING CLAIMS - WITHIN 90 DAYS OF SOL'],
        ['Generated: 2026-01-06'],
        [''],
        ['Claim #', 'State', 'BI Status', 'Exp. Create Date', 'SOL (Years)', 'SOL Expiry', 'Days Until Expiry', 'Open Reserves'],
      ];
      data.approachingClaims.forEach(c => {
        approachingRows.push([
          c.claimNumber,
          c.state,
          c.biStatus,
          c.expCreateDate,
          c.solYears,
          c.solExpiryDate.toLocaleDateString(),
          c.daysUntilExpiry,
          c.reserves,
        ]);
      });
      const approachingWs = XLSX.utils.aoa_to_sheet(approachingRows);
      approachingWs['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, approachingWs, 'Approaching Claims');
    }

    XLSX.writeFile(wb, `SOL_Review_Report_20260106.xlsx`);
  };

  return { data, loading, error, exportToExcel };
}
