import { useState, useEffect } from "react";
import Papa from "papaparse";
import { parse, addYears, isBefore } from "date-fns";

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
}

export interface SOLBreachData {
  inProgressBreaches: SOLBreachClaim[];
  settledBreaches: SOLBreachClaim[];
  inProgressTotal: number;
  settledTotal: number;
  combinedTotal: number;
  inProgressCount: number;
  settledCount: number;
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
        const response = await fetch('/data/open-exposure-raw-jan5.csv');
        const csvText = await response.text();
        
        const parsed = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
        });
        
        const rows = parsed.data as Record<string, string>[];
        const today = new Date('2026-01-06'); // Current date
        
        const inProgressBreaches: SOLBreachClaim[] = [];
        const settledBreaches: SOLBreachClaim[] = [];
        const byState: Record<string, { count: number; reserves: number }> = {};
        
        // Debug: Log first row columns to check exact names
        if (rows.length > 0) {
          console.log('SOL Analysis - Column names:', Object.keys(rows[0]));
          console.log('SOL Analysis - Sample BI Status values:', rows.slice(0, 10).map(r => r['BI Status']));
        }
        
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
            };
            
            if (biStatus === 'In Progress') {
              inProgressBreaches.push(breach);
            } else {
              settledBreaches.push(breach);
            }
            
            // Track by state
            if (!byState[state]) {
              byState[state] = { count: 0, reserves: 0 };
            }
            byState[state].count++;
            byState[state].reserves += reserves;
          }
        }
        
        const inProgressTotal = inProgressBreaches.reduce((sum, b) => sum + b.reserves, 0);
        const settledTotal = settledBreaches.reduce((sum, b) => sum + b.reserves, 0);
        
        setData({
          inProgressBreaches,
          settledBreaches,
          inProgressTotal,
          settledTotal,
          combinedTotal: inProgressTotal + settledTotal,
          inProgressCount: inProgressBreaches.length,
          settledCount: settledBreaches.length,
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

  return { data, loading, error };
}
