import { useMemo } from "react";
import { useSharedOpenExposureRows } from "@/contexts/OpenExposureContext";

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
  fatality: boolean;
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
  const { rawRows, loading, error } = useSharedOpenExposureRows();

  const data = useMemo((): DecisionsPendingData | null => {
    if (!rawRows.length) return null;

    const claims: DecisionClaim[] = [];
    const byPainLevel: Record<string, { count: number; reserves: number }> = {};
    
    for (const row of rawRows) {
      const reserves = parseCurrency(row['Open Reserves'] || '0');
      const lowEval = parseCurrency(row['Low'] || '0');
      const highEval = parseCurrency(row['High'] || '0');
      const hasNoEval = lowEval === 0 && highEval === 0;
      
      // Get pain level info
      const finalEndPain = (row as any)['Final End Pain']?.trim() || '';
      const endPainLevel = (row as any)['End Pain Level']?.trim() || '';
      const painLevelStr = finalEndPain || endPainLevel || 'Unknown';
      
      // Determine if this claim needs a decision
      // Criteria: High reserves ($15K+) with no evaluation set
      const needsDecision = reserves >= 15000 && hasNoEval;
      
      if (!needsDecision) continue;
      
      const claimNumber = row['Claim#'] || '';
      const state = (row as any)['Accident Location State']?.trim() || '';
      const biStatus = ((row as any)['BI Status'] || (row as any)['BI Status '] || '').trim();
      const team = (row as any)['Team Group']?.trim() || '';
      const fatalityVal = ((row as any)['FATALITY'] || '').toString().toLowerCase().trim();
      const isFatality = fatalityVal === 'yes' || fatalityVal === 'y' || fatalityVal === 'true' || fatalityVal === '1';
      
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
        fatality: isFatality,
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
    
    return {
      totalCount: claims.length,
      totalReserves,
      claims,
      byPainLevel,
    };
  }, [rawRows]);

  return { data, loading, error };
}
