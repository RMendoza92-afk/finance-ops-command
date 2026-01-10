import { useMemo } from 'react';
import { useSharedOpenExposureRows } from '@/contexts/OpenExposureContext';

export interface AtRiskClaim {
  claimNumber: string;
  claimant: string;
  state: string;
  reserves: number;
  policyLimit: number;
  reserveToLimitRatio: number;
  age: string;
  ageDays: number;
  injurySeverity: string;
  inLitigation: boolean;
  cp1Flag: boolean;
  typeGroup: string;
  evaluationPhase: string;
  triggerFactors: string[];
  riskScore: number;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE';
  patternMatches: string[];
  lowEval: number;
  highEval: number;
  totalPaid: number;
  demandType: string;
  coverage: string;
  adjuster: string;
  areaNumber: string;
  triggerTotal: number;
  biStatus: string;
  accidentDescription: string;
  teamGroup: string;
  // Impact severity for universal columns
  impactSeverity: string;
  impactScore: number;
  severityTier: string;
  flagCount: number;
  biPhase: string;
  negotiationAmount: number;
  negotiationDate: string;
  negotiationType: string;
  daysSinceNegotiation: number | null;
  // All 17 risk factors
  fatality: boolean;
  surgery: boolean;
  medsVsLimits: boolean;
  lifeCarePlanner: boolean;
  fractures: boolean;
  hospitalization: boolean;
  locTBI: boolean;
  reAggravation: boolean;
  mriCtConfirmed: boolean;
  pedMotoBike: boolean;
  surgeryRec: boolean;
  injections: boolean;
  emsImpact: boolean;
  lacerations: boolean;
  painLevel5Plus: boolean;
  pregnancy: boolean;
  eggshell69Plus: boolean;
}

export interface RiskPattern {
  pattern: string;
  count: number;
  avgOverLimit: number;
  description: string;
}

// High-risk states based on historical over-limit frequency from 123 claims
const HIGH_RISK_STATES = ['TEXAS', 'NEVADA', 'CALIFORNIA', 'GEORGIA', 'NEW MEXICO', 'COLORADO', 'ALABAMA', 'OKLAHOMA', 'ARIZONA'];
const STATE_RISK_WEIGHT: Record<string, number> = {
  'TEXAS': 3,      // 42 claims
  'NEVADA': 3,     // 34 claims
  'CALIFORNIA': 3, // 30 claims
  'GEORGIA': 2,    // 9 claims
  'NEW MEXICO': 2, // 4 claims
  'COLORADO': 1,   // 2 claims
  'ALABAMA': 1,    // 2 claims
  'OKLAHOMA': 2,   // Included based on inventory concentration
  'ARIZONA': 2,    // Included based on inventory concentration
};

// State BI limits
const STATE_BI_LIMITS: Record<string, number> = {
  'TEXAS': 30000,
  'CALIFORNIA': 15000,
  'NEVADA': 25000,
  'GEORGIA': 25000,
  'NEW MEXICO': 25000,
  'COLORADO': 25000,
  'ALABAMA': 25000,
  'OKLAHOMA': 25000,
  'ARIZONA': 25000,
  'NEW JERSEY': 15000,
  'FLORIDA': 10000,
};

function parseCurrency(val: string): number {
  if (!val) return 0;
  const cleaned = val.toString().replace(/[$,]/g, '');
  return parseFloat(cleaned) || 0;
}

export function useAtRiskClaims() {
  const { rawRows, loading, error } = useSharedOpenExposureRows();

  // Analyze patterns from historical over-limit payments
  const patterns = useMemo((): RiskPattern[] => {
    return [
      {
        pattern: 'HIGH_RISK_STATE',
        count: 123,
        avgOverLimit: 114446,
        description: 'Claim in state with high historical over-limit frequency (TX, NV, CA, GA, NM, CO, AL)',
      },
      {
        pattern: 'RESERVES_EXCEED_80_PCT',
        count: 98,
        avgOverLimit: 156000,
        description: 'BI reserves exceed 80% of policy limit - approaching threshold',
      },
      {
        pattern: 'IN_LITIGATION',
        count: 67,
        avgOverLimit: 189000,
        description: 'Claim is in litigation with unpredictable outcomes',
      },
      {
        pattern: 'CP1_FLAG',
        count: 45,
        avgOverLimit: 142000,
        description: 'CP1 flagged for complex/high-value exposure',
      },
      {
        pattern: 'AGE_365_PLUS',
        count: 89,
        avgOverLimit: 167000,
        description: 'Claim aged 365+ days with unresolved BI exposure',
      },
      {
        pattern: 'SURGERY_INDICATOR',
        count: 34,
        avgOverLimit: 245000,
        description: 'Surgery indicator - high medical severity',
      },
      {
        pattern: 'FATALITY',
        count: 12,
        avgOverLimit: 412000,
        description: 'Fatality claim - maximum exposure risk',
      },
      {
        pattern: 'HOSPITALIZATION',
        count: 28,
        avgOverLimit: 198000,
        description: 'Hospitalization indicator - elevated medical costs',
      },
      {
        pattern: 'HIGH_TRIGGER_COUNT',
        count: 41,
        avgOverLimit: 178000,
        description: '3+ aggravating factors identified',
      },
      {
        pattern: 'RESERVES_EXCEED_LIMIT',
        count: 52,
        avgOverLimit: 225000,
        description: 'Current reserves already exceed policy limit',
      },
    ];
  }, []);

  // Identify at-risk claims from open inventory
  const atRiskClaims = useMemo((): AtRiskClaim[] => {
    if (!rawRows.length) return [];

    const claims: AtRiskClaim[] = [];

    for (const row of rawRows) {
      // Only include BI coverage claims
      const coverage = (row['Coverage'] || '').toUpperCase();
      if (coverage !== 'BI') continue;
      
      // Exclude settled/closed claims - only workable claims
      const biStatusRaw = row['BI Status'] || '';
      const biStatusLower = biStatusRaw.toLowerCase();
      if (biStatusLower.includes('settled') || biStatusLower.includes('closed') || biStatusLower.includes('resolved')) continue;
      
      const state = (row['Accident Location State'] || '').toUpperCase().trim();
      const reserves = parseCurrency(row['Open Reserves'] || '0');
      const policyLimit = STATE_BI_LIMITS[state] || 25000;
      const reserveToLimitRatio = policyLimit > 0 ? reserves / policyLimit : 0;
      const ageDays = parseInt(row['Open/Closed Days'] || '0') || 0;
      const ageBucket = row['Age'] || '';
      const inLitigation = (row['In Litigation Indicator'] || '').toLowerCase().includes('litigation');
      const cp1Flag = (row['Overall CP1 Flag'] || '').toLowerCase() === 'yes';
      const lowEval = parseCurrency(row['Low'] || '0');
      const highEval = parseCurrency(row['High'] || '0');
      const totalPaid = parseCurrency(row['Total Paid'] || '0');
      
      // Parse all 17 risk factors
      const fatality = (row['FATALITY'] || '').toLowerCase() === 'yes';
      const surgery = (row['SURGERY'] || '').toLowerCase() === 'yes';
      const medsVsLimits = (row['MEDS VS LIMITS'] || '').toLowerCase() === 'yes';
      const lifeCarePlanner = (row['LIFE CARE PLANNER'] || '').toLowerCase() === 'yes';
      const fractures = (row['CONFIRMED FRACTURES'] || '').toLowerCase() === 'yes';
      const hospitalization = (row['HOSPITALIZATION'] || '').toLowerCase() === 'yes';
      const locTBI = (row['LOSS OF CONSCIOUSNESS'] || '').toLowerCase() === 'yes';
      const reAggravation = (row['AGGRAVATION FACTORS'] || '').toLowerCase() === 'yes';
      const mriCtConfirmed = (row['OBJECTIVE INJURY'] || '').toLowerCase() === 'yes';
      const pedMotoBike = (row['PEDESTRIAN'] || row['PEDESTRIAN/BIKE'] || '').toLowerCase() === 'yes';
      const surgeryRec = (row['PRIOR SURGERY'] || '').toLowerCase() === 'yes';
      const injections = (row['INJECTIONS'] || '').toLowerCase() === 'yes';
      const emsImpact = (row['EMS HEAVY IMPACT'] || '').toLowerCase() === 'yes';
      const lacerations = (row['LACERATIONS'] || '').toLowerCase() === 'yes';
      const painLevel5Plus = (row['PAIN LEVEL 5+'] || '').toLowerCase() === 'yes';
      const pregnancy = (row['PREGNANCY'] || '').toLowerCase() === 'yes';
      const eggshell69Plus = (row['EGGSHELL 69+'] || '').toLowerCase() === 'yes';

      // Count trigger factors
      let triggerTotal = parseInt(row['TRIGGER TOTAL'] || '0') || 0;
      
      // Count active flags
      const flagCount = [fatality, surgery, medsVsLimits, lifeCarePlanner, fractures, hospitalization, 
        locTBI, reAggravation, mriCtConfirmed, pedMotoBike, surgeryRec, injections, emsImpact, 
        lacerations, painLevel5Plus, pregnancy, eggshell69Plus].filter(Boolean).length;

      // Calculate risk score
      let riskScore = 0;
      const patternMatches: string[] = [];
      const triggerFactors: string[] = [];

      // Pattern: High-risk state
      if (HIGH_RISK_STATES.includes(state)) {
        riskScore += (STATE_RISK_WEIGHT[state] || 1) * 10;
        patternMatches.push('HIGH_RISK_STATE');
        triggerFactors.push(`High-risk state: ${state}`);
      }

      // Pattern: Reserves exceed 80% of limit
      if (reserveToLimitRatio >= 0.8 && reserves > 0) {
        riskScore += 25;
        patternMatches.push('RESERVES_EXCEED_80_PCT');
        triggerFactors.push(`Reserves at ${(reserveToLimitRatio * 100).toFixed(0)}% of limit`);
      }

      // Pattern: Reserves exceed limit
      if (reserves > policyLimit && reserves > 0) {
        riskScore += 35;
        patternMatches.push('RESERVES_EXCEED_LIMIT');
        triggerFactors.push('Reserves exceed policy limit');
      }

      // Pattern: In litigation
      if (inLitigation) {
        riskScore += 20;
        patternMatches.push('IN_LITIGATION');
        triggerFactors.push('Active litigation');
      }

      // Pattern: CP1 flagged
      if (cp1Flag) {
        riskScore += 15;
        patternMatches.push('CP1_FLAG');
        triggerFactors.push('CP1 flagged');
      }

      // Pattern: Age 365+ days
      if (ageDays >= 365 || ageBucket.includes('365+')) {
        riskScore += 15;
        patternMatches.push('AGE_365_PLUS');
        triggerFactors.push(`${ageDays > 0 ? ageDays + ' days old' : ageBucket}`);
      }

      // Pattern: Surgery
      if (surgery) {
        riskScore += 20;
        patternMatches.push('SURGERY_INDICATOR');
        triggerFactors.push('Surgery indicated');
      }

      // Pattern: Fatality
      if (fatality) {
        riskScore += 40;
        patternMatches.push('FATALITY');
        triggerFactors.push('FATALITY');
      }

      // Pattern: Hospitalization
      if (hospitalization) {
        riskScore += 15;
        patternMatches.push('HOSPITALIZATION');
        triggerFactors.push('Hospitalization');
      }

      // Pattern: High trigger count
      if (triggerTotal >= 3) {
        riskScore += 15;
        patternMatches.push('HIGH_TRIGGER_COUNT');
        triggerFactors.push(`${triggerTotal} aggravating factors`);
      }

      // Pattern: High eval significantly above limit
      if (highEval > policyLimit * 1.5) {
        riskScore += 20;
        patternMatches.push('HIGH_EVAL_EXCEEDS_LIMIT');
        triggerFactors.push(`High eval $${highEval.toLocaleString()} exceeds limit`);
      }

      // Only include claims with meaningful risk (at least 2 pattern matches or score >= 40)
      if (patternMatches.length >= 2 || riskScore >= 40) {
        let riskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' = 'MODERATE';
        if (riskScore >= 80) riskLevel = 'CRITICAL';
        else if (riskScore >= 50) riskLevel = 'HIGH';
        
        // Determine severity tier label
        const severityTier = riskLevel === 'CRITICAL' ? 'TIER 1' : riskLevel === 'HIGH' ? 'TIER 2' : 'TIER 3';
        
        // Calculate negotiation fields
        const negotiationAmount = parseCurrency(row['Negotiation Amount'] || row['Demand/Offer Amount'] || '0');
        const negotiationDate = row['Negotiation Date'] || row['Last Nego Date'] || '';
        const negotiationType = row['Negotiation Type'] || row['Demand Type'] || '';
        const daysSinceNegoRaw = row['Days Since Negotiation'] || row['Days Since Nego'] || '';
        const daysSinceNegotiation = daysSinceNegoRaw ? parseInt(daysSinceNegoRaw) || null : null;

        claims.push({
          claimNumber: row['Claim#'] || '',
          claimant: row['Claimant'] || '',
          state,
          reserves,
          policyLimit,
          reserveToLimitRatio,
          age: ageBucket,
          ageDays,
          injurySeverity: row['Injury Severity'] || '',
          inLitigation,
          cp1Flag,
          typeGroup: row['Type Group'] || '',
          evaluationPhase: row['Evaluation Phase'] || '',
          triggerFactors,
          riskScore,
          riskLevel,
          patternMatches,
          lowEval,
          highEval,
          totalPaid,
          demandType: row['Demand Type'] || '',
          coverage,
          adjuster: row['Adjuster Assigned'] || '',
          areaNumber: row['Area#'] || '',
          triggerTotal,
          biStatus: biStatusRaw,
          accidentDescription: row['Description of Accident'] || '',
          teamGroup: row['Team Group'] || '',
          // Universal columns
          impactSeverity: riskLevel,
          impactScore: riskScore,
          severityTier,
          flagCount,
          biPhase: row['Evaluation Phase'] || row['BI Phase'] || '',
          negotiationAmount,
          negotiationDate,
          negotiationType,
          daysSinceNegotiation,
          // All 17 risk factors
          fatality,
          surgery,
          medsVsLimits,
          lifeCarePlanner,
          fractures,
          hospitalization,
          locTBI,
          reAggravation,
          mriCtConfirmed,
          pedMotoBike,
          surgeryRec,
          injections,
          emsImpact,
          lacerations,
          painLevel5Plus,
          pregnancy,
          eggshell69Plus,
        });
      }
    }

    // Sort by risk score descending
    return claims.sort((a, b) => b.riskScore - a.riskScore);
  }, [rawRows]);

  // Summary statistics
  const summary = useMemo(() => {
    const critical = atRiskClaims.filter(c => c.riskLevel === 'CRITICAL');
    const high = atRiskClaims.filter(c => c.riskLevel === 'HIGH');
    const moderate = atRiskClaims.filter(c => c.riskLevel === 'MODERATE');

    const totalExposure = atRiskClaims.reduce((sum, c) => sum + c.reserves, 0);
    const criticalReserves = critical.reduce((sum, c) => sum + c.reserves, 0);
    const highReserves = high.reduce((sum, c) => sum + c.reserves, 0);
    const moderateReserves = moderate.reduce((sum, c) => sum + c.reserves, 0);
    
    const potentialOverLimit = atRiskClaims
      .filter(c => c.reserves > c.policyLimit)
      .reduce((sum, c) => sum + (c.reserves - c.policyLimit), 0);

    // By state breakdown
    const byState = new Map<string, { count: number; totalReserves: number; avgRiskScore: number }>();
    for (const claim of atRiskClaims) {
      if (!claim.state) continue;
      const existing = byState.get(claim.state) || { count: 0, totalReserves: 0, avgRiskScore: 0 };
      existing.count++;
      existing.totalReserves += claim.reserves;
      existing.avgRiskScore = ((existing.avgRiskScore * (existing.count - 1)) + claim.riskScore) / existing.count;
      byState.set(claim.state, existing);
    }

    const byStateArray = Array.from(byState.entries())
      .map(([state, data]) => ({ state, ...data }))
      .sort((a, b) => b.count - a.count);

    // By pattern breakdown
    const byPattern = new Map<string, number>();
    for (const claim of atRiskClaims) {
      for (const pattern of claim.patternMatches) {
        byPattern.set(pattern, (byPattern.get(pattern) || 0) + 1);
      }
    }

    const byPatternArray = Array.from(byPattern.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalAtRisk: atRiskClaims.length,
      criticalCount: critical.length,
      criticalReserves,
      highCount: high.length,
      highReserves,
      moderateCount: moderate.length,
      moderateReserves,
      totalExposure,
      potentialOverLimit,
      byState: byStateArray,
      byPattern: byPatternArray,
      avgRiskScore: atRiskClaims.length > 0 
        ? atRiskClaims.reduce((sum, c) => sum + c.riskScore, 0) / atRiskClaims.length 
        : 0,
    };
  }, [atRiskClaims]);

  // Get claims by risk level
  const getClaimsByLevel = (level: 'CRITICAL' | 'HIGH' | 'MODERATE') => {
    return atRiskClaims.filter(c => c.riskLevel === level);
  };

  // Get claims by state
  const getClaimsByState = (state: string) => {
    return atRiskClaims.filter(c => c.state.toUpperCase() === state.toUpperCase());
  };

  return {
    atRiskClaims,
    patterns,
    summary,
    loading,
    error,
    getClaimsByLevel,
    getClaimsByState,
  };
}
