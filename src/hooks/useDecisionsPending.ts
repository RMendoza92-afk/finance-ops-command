import { useState, useEffect } from "react";
import Papa from "papaparse";

interface DecisionsPendingData {
  totalCount: number;
  totalReserves: number;
  claims: DecisionClaim[];
  byPainLevel: Record<string, { count: number; reserves: number }>;
}

interface DecisionClaim {
  claimNumber: string;
  state: string;
  painLevel: string;
  reserves: number;
  biStatus: string;
  team: string;
  reason: string;
}

function parseCurrency(val: string): number {
  if (!val || val.trim() === '' || val === '(blank)') return 0;
  const cleaned = val.replace(/[$,\s]/g, '').trim();
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -parseFloat(cleaned.slice(1, -1)) || 0;
  }
  return parseFloat(cleaned) || 0;
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
        const byPainLevel: Record<string, { count: number; reserves: number }> = {};
        
        for (const row of rows) {
          const reserves = parseCurrency(row['Open Reserves'] || '0');
          const lowEval = parseCurrency(row['Low'] || '0');
          const highEval = parseCurrency(row['High'] || '0');
          const hasNoEval = lowEval === 0 && highEval === 0;
          
          // Get pain level info
          const finalEndPain = row['Final End Pain']?.trim() || '';
          const endPainLevel = row['End Pain Level']?.trim() || '';
          const painLevelStr = finalEndPain || endPainLevel || 'Unknown';
          
          // Determine if this claim needs a decision
          // Criteria: High reserves ($15K+) with no evaluation set
          const needsDecision = reserves >= 15000 && hasNoEval;
          
          if (!needsDecision) continue;
          
          const claimNumber = row['Claim#'] || '';
          const state = row['Accident Location State']?.trim() || '';
          const biStatus = (row['BI Status'] || row['BI Status '] || '').trim();
          const team = row['Team Group']?.trim() || '';
          
          // Determine reason
          let reason = 'High reserves with no evaluation';
          if (painLevelStr === 'Pending' || painLevelStr === 'Blank') {
            reason = 'Pending pain assessment + no evaluation';
          } else if (painLevelStr.includes('5+') || painLevelStr === 'Limits') {
            reason = 'High pain level + no evaluation';
          }
          
          claims.push({
            claimNumber,
            state,
            painLevel: painLevelStr,
            reserves,
            biStatus,
            team,
            reason,
          });
          
          // Track by pain level category
          const category = painLevelStr === 'Pending' || painLevelStr === 'Blank' 
            ? 'Pending' 
            : painLevelStr.includes('5+') || painLevelStr === 'Limits'
              ? 'High (5+)'
              : painLevelStr.includes('Under')
                ? 'Under 5'
                : painLevelStr || 'Unknown';
          
          if (!byPainLevel[category]) {
            byPainLevel[category] = { count: 0, reserves: 0 };
          }
          byPainLevel[category].count++;
          byPainLevel[category].reserves += reserves;
        }
        
        // Sort by reserves descending
        claims.sort((a, b) => b.reserves - a.reserves);
        
        const totalReserves = claims.reduce((sum, c) => sum + c.reserves, 0);
        
        console.log('Decisions Pending Analysis:', {
          totalClaims: claims.length,
          totalReserves,
          byCategory: byPainLevel,
        });
        
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
