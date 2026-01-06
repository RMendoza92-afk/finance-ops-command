import { useState, useEffect } from "react";
import Papa from "papaparse";

interface DecisionsPendingData {
  totalCount: number;
  totalReserves: number;
  claims: DecisionClaim[];
  byPainLevel: Record<number, { count: number; reserves: number }>;
}

interface DecisionClaim {
  claimNumber: string;
  state: string;
  painLevel: number;
  reserves: number;
  biStatus: string;
  team: string;
}

function parseCurrency(val: string): number {
  if (!val || val.trim() === '' || val === '(blank)') return 0;
  const cleaned = val.replace(/[$,\s]/g, '').trim();
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -parseFloat(cleaned.slice(1, -1)) || 0;
  }
  return parseFloat(cleaned) || 0;
}

function parsePainLevel(val: string): number | null {
  if (!val || val.trim() === '' || val === 'Pending' || val === 'Blank') return null;
  // Handle ranges like "7-9" - take the high end
  if (val.includes('-')) {
    const parts = val.split('-');
    return parseInt(parts[1]) || null;
  }
  // Handle "Under 5" type values
  if (val.toLowerCase().includes('under')) return null;
  // Handle "Limits" as high pain level (10)
  if (val.toLowerCase() === 'limits') return 10;
  const num = parseInt(val);
  return isNaN(num) ? null : num;
}

export function useDecisionsPending() {
  const [data, setData] = useState<DecisionsPendingData | null>(null);
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
        const claims: DecisionClaim[] = [];
        const byPainLevel: Record<number, { count: number; reserves: number }> = {};
        
        for (const row of rows) {
          // Get pain level - prefer Final End Pain, then End Pain Level
          const finalEndPain = row['Final End Pain']?.trim() || '';
          const endPainLevel = row['End Pain Level']?.trim() || '';
          const painLevelStr = finalEndPain || endPainLevel;
          const painLevel = parsePainLevel(painLevelStr);
          
          // Skip if pain level is null or <= 5
          if (painLevel === null || painLevel <= 5) continue;
          
          // Check for no eval (Low and High must be empty/0)
          const lowEval = parseCurrency(row['Low'] || '0');
          const highEval = parseCurrency(row['High'] || '0');
          
          // Only include if BOTH low and high eval are 0/empty
          if (lowEval !== 0 || highEval !== 0) continue;
          
          const reserves = parseCurrency(row['Open Reserves'] || '0');
          const claimNumber = row['Claim#'] || '';
          const state = row['Accident Location State']?.trim() || '';
          const biStatus = (row['BI Status'] || row['BI Status '] || '').trim();
          const team = row['Team Group']?.trim() || '';
          
          claims.push({
            claimNumber,
            state,
            painLevel,
            reserves,
            biStatus,
            team,
          });
          
          // Track by pain level
          if (!byPainLevel[painLevel]) {
            byPainLevel[painLevel] = { count: 0, reserves: 0 };
          }
          byPainLevel[painLevel].count++;
          byPainLevel[painLevel].reserves += reserves;
        }
        
        const totalReserves = claims.reduce((sum, c) => sum + c.reserves, 0);
        
        setData({
          totalCount: claims.length,
          totalReserves,
          claims,
          byPainLevel,
        });
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to analyze decisions pending');
        setLoading(false);
      }
    }
    
    loadAndAnalyze();
  }, []);

  return { data, loading, error };
}
