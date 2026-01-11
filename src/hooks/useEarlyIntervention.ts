import { useMemo } from 'react';
import { useSharedOpenExposureRows } from '@/contexts/OpenExposureContext';

export type InterventionStrategy = 
  | 'LOR_CANDIDATE'      // Liability clear + approaching limits + early
  | 'PROACTIVE_NEGO'     // Surgery/hospitalization + early + demand pending
  | 'RESERVE_CORRECTION' // High eval > limit but reserves low
  | 'EXPERT_EARLY';      // Fatality/TBI/life care + no expert yet

export interface EarlyInterventionClaim {
  claimNumber: string;
  claimant: string;
  state: string;
  daysOpen: number;
  ageBucket: string;
  reserves: number;
  policyLimit: number;
  reserveToLimitPct: number;
  totalMeds: number;
  totalPaid: number;
  liabilityStatus: string;
  liabilityClear: boolean;
  cp1FlagCount: number;
  triggerTotal: number;
  evaluationPhase: string;
  biStatus: string;
  demandType: string;
  adjuster: string;
  areaNumber: string;
  teamGroup: string;
  lowEval: number;
  highEval: number;
  // Strategy assignment
  strategies: InterventionStrategy[];
  primaryStrategy: InterventionStrategy;
  reasoning: string[];
  priorityScore: number;
  // Risk factors present
  hasFatality: boolean;
  hasSurgery: boolean;
  hasHospitalization: boolean;
  hasTBI: boolean;
  hasLifeCarePlanner: boolean;
  // Negotiation status
  lastNegotiationDate: string;
  daysSinceNegotiation: number | null;
  negotiationAmount: number;
  // Action status
  lorSent: boolean;
  lorDate: string;
}

export interface InterventionSummary {
  totalCandidates: number;
  byStrategy: Record<InterventionStrategy, number>;
  byState: { state: string; count: number; reserves: number }[];
  totalReserves: number;
  avgDaysOpen: number;
  avgMeds: number;
  texasPilotCount: number;
  expansionCandidates: number;
}

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
  'ILLINOIS': 25000,
  'INDIANA': 25000,
  'OHIO': 25000,
};

// High-risk states for expansion
const HIGH_RISK_STATES = ['TEXAS', 'NEVADA', 'CALIFORNIA', 'GEORGIA', 'NEW MEXICO', 'COLORADO', 'ALABAMA', 'OKLAHOMA', 'ARIZONA'];

function parseCurrency(val: string): number {
  if (!val) return 0;
  const cleaned = val.toString().replace(/[$,]/g, '');
  return parseFloat(cleaned) || 0;
}

function parseYesNo(val: string): boolean {
  if (!val) return false;
  const lower = val.toString().toLowerCase().trim();
  return lower === 'yes' || lower === 'y' || lower === 'true' || lower === '1';
}

export function useEarlyIntervention() {
  const { rawRows, loading, error } = useSharedOpenExposureRows();

  const candidates = useMemo((): EarlyInterventionClaim[] => {
    if (!rawRows.length) return [];

    const claims: EarlyInterventionClaim[] = [];

    for (const row of rawRows) {
      // Only BI coverage
      const coverage = (row['Coverage'] || '').toUpperCase();
      if (coverage !== 'BI') continue;

      // Exclude settled/closed
      const biStatus = row['BI Status'] || '';
      const biStatusLower = biStatus.toLowerCase();
      if (biStatusLower.includes('settled') || biStatusLower.includes('closed')) continue;

      const state = (row['Accident Location State'] || '').toUpperCase().trim();
      const daysOpen = parseInt(row['Open/Closed Days'] || '0') || 0;
      const ageBucket = row['Age'] || '';
      const reserves = parseCurrency(row['Open Reserves'] || '0');
      const policyLimit = STATE_BI_LIMITS[state] || 25000;
      const reserveToLimitPct = policyLimit > 0 ? (reserves / policyLimit) * 100 : 0;
      
      // Meds and paid
      const totalMeds = parseCurrency(row['Total Meds'] || '0');
      const totalPaid = parseCurrency(row['Total Paid'] || '0');
      
      // Liability status
      const faultRating = (row['Fault Rating'] || '').toLowerCase();
      const liabilityClear = faultRating.includes('insured at fault') || faultRating === 'clear';
      
      // CP1 and trigger counts
      const overallCP1 = (row['Overall CP1 Flag'] || '').toLowerCase() === 'yes';
      const triggerTotal = parseInt(row['TRIGGER TOTAL'] || '0') || 0;
      
      // Count actual CP1 flags from columns
      let cp1FlagCount = 0;
      const cp1Columns = [
        'FATALITY', 'SURGERY', 'MEDS VS LIMITS', 'HOSPITALIZATION', 
        'LOSS OF CONSCIOUSNESS', 'AGGRAVATING FACTORS', 'OBJECTIVE INJURIES',
        'PEDESTRIAN/MOTORCYCLIST/BICYCLIST/PREGNANCY', 'LIFE CARE PLANNER',
        'INJECTIONS', 'EMS + HEAVY IMPACT'
      ];
      for (const col of cp1Columns) {
        if (parseYesNo(row[col])) cp1FlagCount++;
      }
      
      // Use trigger total if available, otherwise use counted flags
      const effectiveFlagCount = triggerTotal > 0 ? triggerTotal : cp1FlagCount;

      // Risk factors
      const hasFatality = parseYesNo(row['FATALITY']) || parseYesNo(row['Injury Incident - Fatality']);
      const hasSurgery = parseYesNo(row['SURGERY']) || parseYesNo(row['Injury Incident - Surgery']);
      const hasHospitalization = parseYesNo(row['HOSPITALIZATION']) || parseYesNo(row['Injury Incident - Hospitalization and Hospitalized']);
      const hasTBI = parseYesNo(row['LOSS OF CONSCIOUSNESS']) || parseYesNo(row['Injury Incident - Loss of Consciousness']);
      const hasLifeCarePlanner = parseYesNo(row['LIFE CARE PLANNER']) || parseYesNo(row['Injury Incident - Life Care Planner']);
      
      // Evaluations
      const lowEval = parseCurrency(row['Low'] || '0');
      const highEval = parseCurrency(row['High'] || '0');
      const evaluationPhase = row['Evaluation Phase'] || '';
      const demandType = row['Demand Type'] || '';
      
      // Negotiation
      const negotiationDate = row['Negotiation Date'] || '';
      const daysSinceNegoStr = row['Days Since Negotiation Date'] || '';
      const daysSinceNegotiation = daysSinceNegoStr ? parseInt(daysSinceNegoStr) || null : null;
      const negotiationAmount = parseCurrency(row['Negotiation Amount'] || '0');
      
      // LOR status
      const lorSent = (row['LOR'] || '').toLowerCase().includes('yes') || !!row['Days From LOR'];
      const lorDate = row['Days From LOR'] ? `${row['Days From LOR']} days ago` : '';

      // === STRATEGY DETERMINATION ===
      const strategies: InterventionStrategy[] = [];
      const reasoning: string[] = [];
      let priorityScore = 0;

      // Early intervention window: under 90 days preferred, under 180 still actionable
      const isEarly = daysOpen < 90;
      const isActionable = daysOpen < 180;

      // === LOR_CANDIDATE ===
      // Liability clear + reserves approaching limit + early stage + 3+ flags
      if (liabilityClear && reserveToLimitPct >= 50 && isActionable && effectiveFlagCount >= 3) {
        strategies.push('LOR_CANDIDATE');
        reasoning.push(`Liability clear with ${reserveToLimitPct.toFixed(0)}% of limit reserved. ${effectiveFlagCount} CP1 flags. ${daysOpen} days open - early LOR opportunity.`);
        priorityScore += 40;
        if (isEarly) priorityScore += 20; // Bonus for very early
        if (reserveToLimitPct >= 80) priorityScore += 15;
        if (state === 'TEXAS') priorityScore += 10; // TX pilot priority
      }

      // === PROACTIVE_NEGO ===
      // Surgery/hospitalization + early + demand pending or active negotiation
      const hasSerious = hasSurgery || hasHospitalization || hasTBI;
      const hasDemand = demandType.toLowerCase().includes('demand') || 
                        evaluationPhase.toLowerCase().includes('demand') ||
                        evaluationPhase.toLowerCase().includes('negotiation');
      if (hasSerious && isActionable && hasDemand) {
        strategies.push('PROACTIVE_NEGO');
        const injuries = [hasSurgery && 'Surgery', hasHospitalization && 'Hospitalization', hasTBI && 'TBI'].filter(Boolean).join(', ');
        reasoning.push(`${injuries} indicated with active demand. ${daysOpen} days open - proactive engagement recommended.`);
        priorityScore += 35;
        if (isEarly) priorityScore += 15;
      }

      // === RESERVE_CORRECTION ===
      // High eval significantly exceeds limit but reserves are low
      if (highEval > policyLimit * 1.5 && reserveToLimitPct < 60) {
        strategies.push('RESERVE_CORRECTION');
        reasoning.push(`High eval $${highEval.toLocaleString()} exceeds $${policyLimit.toLocaleString()} limit by ${((highEval/policyLimit - 1) * 100).toFixed(0)}%, but reserves only at ${reserveToLimitPct.toFixed(0)}%.`);
        priorityScore += 30;
      }

      // === EXPERT_EARLY ===
      // Fatality/TBI/life care planner + early stage
      const needsExpert = hasFatality || hasTBI || hasLifeCarePlanner;
      if (needsExpert && isActionable) {
        strategies.push('EXPERT_EARLY');
        const expertReasons = [hasFatality && 'Fatality', hasTBI && 'TBI/LOC', hasLifeCarePlanner && 'Life Care Planner'].filter(Boolean).join(', ');
        reasoning.push(`${expertReasons} - early expert engagement critical. ${daysOpen} days open.`);
        priorityScore += 45;
        if (hasFatality) priorityScore += 20;
      }

      // Only include if at least one strategy applies AND has 3+ flags
      if (strategies.length > 0 && effectiveFlagCount >= 3) {
        // Add state risk bonus
        if (HIGH_RISK_STATES.includes(state)) {
          priorityScore += 10;
          reasoning.push(`High-risk state: ${state}`);
        }

        // Low meds = better LOR timing
        if (totalMeds < 10000 && strategies.includes('LOR_CANDIDATE')) {
          priorityScore += 10;
          reasoning.push(`Low meds ($${totalMeds.toLocaleString()}) - optimal LOR timing`);
        }

        claims.push({
          claimNumber: row['Claim#'] || '',
          claimant: row['Claimant'] || '',
          state,
          daysOpen,
          ageBucket,
          reserves,
          policyLimit,
          reserveToLimitPct,
          totalMeds,
          totalPaid,
          liabilityStatus: row['Fault Rating'] || '',
          liabilityClear,
          cp1FlagCount: effectiveFlagCount,
          triggerTotal,
          evaluationPhase,
          biStatus,
          demandType,
          adjuster: row['Adjuster Assigned'] || '',
          areaNumber: row['Area#'] || '',
          teamGroup: row['Team Group'] || '',
          lowEval,
          highEval,
          strategies,
          primaryStrategy: strategies[0],
          reasoning,
          priorityScore,
          hasFatality,
          hasSurgery,
          hasHospitalization,
          hasTBI,
          hasLifeCarePlanner,
          lastNegotiationDate: negotiationDate,
          daysSinceNegotiation,
          negotiationAmount,
          lorSent,
          lorDate,
        });
      }
    }

    // Sort by priority score descending
    return claims.sort((a, b) => b.priorityScore - a.priorityScore);
  }, [rawRows]);

  // Summary statistics
  const summary = useMemo((): InterventionSummary => {
    const byStrategy: Record<InterventionStrategy, number> = {
      'LOR_CANDIDATE': 0,
      'PROACTIVE_NEGO': 0,
      'RESERVE_CORRECTION': 0,
      'EXPERT_EARLY': 0,
    };

    const stateMap = new Map<string, { count: number; reserves: number }>();
    let totalReserves = 0;
    let totalDays = 0;
    let totalMeds = 0;
    let texasPilotCount = 0;
    let expansionCandidates = 0;

    for (const claim of candidates) {
      // Count by strategy
      for (const strategy of claim.strategies) {
        byStrategy[strategy]++;
      }

      // By state
      const existing = stateMap.get(claim.state) || { count: 0, reserves: 0 };
      existing.count++;
      existing.reserves += claim.reserves;
      stateMap.set(claim.state, existing);

      totalReserves += claim.reserves;
      totalDays += claim.daysOpen;
      totalMeds += claim.totalMeds;

      if (claim.state === 'TEXAS') {
        texasPilotCount++;
      } else if (HIGH_RISK_STATES.includes(claim.state)) {
        expansionCandidates++;
      }
    }

    const byState = Array.from(stateMap.entries())
      .map(([state, data]) => ({ state, ...data }))
      .sort((a, b) => b.count - a.count);

    return {
      totalCandidates: candidates.length,
      byStrategy,
      byState,
      totalReserves,
      avgDaysOpen: candidates.length > 0 ? totalDays / candidates.length : 0,
      avgMeds: candidates.length > 0 ? totalMeds / candidates.length : 0,
      texasPilotCount,
      expansionCandidates,
    };
  }, [candidates]);

  // Get claims by strategy
  const getByStrategy = (strategy: InterventionStrategy) => {
    return candidates.filter(c => c.strategies.includes(strategy));
  };

  // Get claims by state
  const getByState = (state: string) => {
    return candidates.filter(c => c.state.toUpperCase() === state.toUpperCase());
  };

  // Get Texas pilot candidates
  const texasPilotCandidates = useMemo(() => {
    return candidates.filter(c => c.state === 'TEXAS');
  }, [candidates]);

  return {
    candidates,
    summary,
    loading,
    error,
    getByStrategy,
    getByState,
    texasPilotCandidates,
  };
}
