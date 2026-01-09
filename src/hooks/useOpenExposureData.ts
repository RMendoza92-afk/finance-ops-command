import { useState, useEffect } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, parseISO } from "date-fns";

export interface OpenExposurePhase {
  phase: string;
  demandTypes: {
    type: string;
    age365Plus: number;
    age181To365: number;
    age61To180: number;
    ageUnder60: number;
    total: number;
  }[];
  total365Plus: number;
  total181To365: number;
  total61To180: number;
  totalUnder60: number;
  grandTotal: number;
}

export interface TypeGroupSummary {
  typeGroup: string;
  age365Plus: number;
  age181To365: number;
  age61To180: number;
  ageUnder60: number;
  grandTotal: number; // exposures (rows)
  uniqueClaims: number; // unique claim numbers
  reserves: number;
  lowEval: number;
  highEval: number;
}

export interface CP1Data {
  total: number;
  age365Plus: number;
  age181To365: number;
  age61To180: number;
  ageUnder60: number;
  demandTypes: {
    type: string;
    count: number;
  }[];
  byCoverage: {
    coverage: string;
    count: number;
    noCP: number;
    yes: number;
    total: number;
    cp1Rate: number;
    reserves: number;
  }[];
  biByAge: {
    age: string;
    noCP: number;
    yes: number;
    total: number;
  }[];
  biTotal: {
    noCP: number;
    yes: number;
    total: number;
  };
  totals: {
    noCP: number;
    yes: number;
    grandTotal: number;
  };
  cp1Rate: string;
  // CP1 claims by BI Status
  byStatus: {
    inProgress: number;
    settled: number;
    inProgressPct: string;
    settledPct: string;
  };
}

export interface FinancialsByAge {
  age: string;
  claims: number;
  openReserves: number;
  lowEval: number;
  highEval: number;
}

export interface KnownTotals {
  totalOpenClaims: number;
  totalOpenExposures: number;
  atr: { claims: number; exposures: number };
  lit: { claims: number; exposures: number };
  bi3: { claims: number; exposures: number };
  earlyBI: { claims: number; exposures: number };
  flagged: number;
  newClaims: number;
  closed: number;
}

export interface TexasRearEndArea {
  area: string;
  claims: number;
  reserves: number;
  lowEval: number;
  highEval: number;
}

export interface TexasRearEndAge {
  age: string;
  claims: number;
  reserves: number;
  lowEval: number;
  highEval: number;
}

export interface TexasRearEndData {
  lossDescription: string;
  summary: {
    totalClaims: number;
    totalReserves: number;
    lowEval: number;
    highEval: number;
  };
  byArea: TexasRearEndArea[];
  byAge: TexasRearEndAge[];
}

// Raw claim export format (for CP1 validation and filtering)
export interface RawClaimExport {
  claimNumber: string;
  claimant: string;
  coverage: string;
  days: number;
  ageBucket: string;
  typeGroup: string;
  openReserves: number;
  lowEval: number;
  highEval: number;
  cp1Flag: string;
  overallCP1: string;
  evaluationPhase: string;
  demandType: string;
  teamGroup: string;
  adjuster: string;
  areaNumber: string;
  lossDescription: string;
  exposureCategory: string;
  biStatus: string;
  daysSinceNegotiation: number | null;
  negotiationType: string;
  negotiationDate: string;
  // Demand/settlement data
  negotiationAmount: number;
  authAmount: number;
  totalPaid: number;
  netTotalIncurred: number;
  reserveChangePercent: number;
  // Litigation/trial data
  inLitigation: boolean;
  causeNumber: string;
  caseType: string;
  matterStatus: string;
  settledDate: string;
  daysSinceSettled: number | null;
  // Fatality and severity flags
  fatality: boolean;
  surgery: boolean;
  hospitalization: boolean;
}

export interface CP1ByTypeGroup {
  typeGroup: string;
  noCP: number;
  yes: number;
  total: number;
  cp1Rate: number;
}

// Multi-pack claim grouping - claims that share a common base (same incident)
export interface MultiPackGroup {
  baseClaimNumber: string;
  packSize: number; // e.g., "2-pack", "3-pack"
  claims: {
    claimNumber: string;
    claimant: string;
    coverage: string;
    days: number;
    ageBucket: string;
    typeGroup: string;
    teamGroup: string;
    reserves: number;
    lowEval: number;
    highEval: number;
    exposureCategory: string;
    overallCP1: string;
    evaluationPhase: string;
  }[];
  totalReserves: number;
  totalLowEval: number;
  totalHighEval: number;
}

export interface MultiPackSummary {
  totalMultiPackGroups: number;
  totalClaimsInPacks: number;
  byPackSize: {
    packSize: number;
    groupCount: number;
    claimCount: number;
    reserves: number;
  }[];
  groups: MultiPackGroup[];
}

// Phase breakdown for population analysis
export interface PhaseBreakdown {
  phase: string;
  claims: number;
  reserves: number;
  lowEval: number;
  highEval: number;
  byAge: {
    age365Plus: number;
    age181To365: number;
    age61To180: number;
    ageUnder60: number;
  };
}

// Negotiation recency tracking
export interface NegotiationRecency {
  bucket: string; // "0-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "No Negotiation"
  claims: number;
  reserves: number;
  lowEval: number;
  highEval: number;
}

export interface OpenExposureData {
  litPhases: OpenExposurePhase[];
  typeGroupSummaries: TypeGroupSummary[];
  cp1Data: CP1Data;
  cp1ByTypeGroup: CP1ByTypeGroup[];
  totals: {
    age365Plus: number;
    age181To365: number;
    age61To180: number;
    ageUnder60: number;
    grandTotal: number; // ALL exposures (all coverages) - primary inventory count
    uniqueClaims: number; // Unique claim numbers across all coverages
    biExposures: number; // BI/UM/UI exposures (for BI financial % calculations)
    allExposures: number; // Alias of grandTotal for clarity
  };
  financials: {
    totalOpenReserves: number;
    totalLowEval: number;
    totalHighEval: number;
    noEvalCount: number;
    noEvalReserves: number;
    byAge: FinancialsByAge[];
    byTypeGroup: {
      typeGroup: string;
      reserves: number;
    }[];
    byQueue: {
      queue: string;
      openReserves: number;
      lowEval: number;
      highEval: number;
      claims: number;
    }[];
  };
  knownTotals: KnownTotals;
  texasRearEnd: TexasRearEndData;
  rawClaims: RawClaimExport[]; // BI/UM/UI claims for financial analysis
  allRawClaims: RawClaimExport[]; // ALL claims (all coverages) for drilldowns
  multiPackData: MultiPackSummary; // Multi-pack claim grouping
  // Population by phase breakdown
  phaseBreakdown: PhaseBreakdown[];
  // Negotiation recency tracking
  negotiationRecency: NegotiationRecency[];
  // BI Status breakdown (In Progress vs Settled)
  biStatusBreakdown: {
    inProgress: { claims: number; reserves: number };
    settled: { claims: number; reserves: number };
    other: { claims: number; reserves: number };
  };
  // Demand summary - claims with a demand type
  demandSummary: {
    claimsWithDemand: number;
    totalDemandReserves: number;
    totalDemandLowEval: number;
    totalDemandHighEval: number;
    byDemandType: {
      demandType: string;
      claims: number;
      reserves: number;
      lowEval: number;
      highEval: number;
    }[];
    demandClaims: RawClaimExport[];
  };
  // Fatality and severity summary - all CP1 flag types
  fatalitySummary: {
    fatalityCount: number;
    fatalityReserves: number;
    fatalityLowEval: number;
    fatalityHighEval: number;
    surgeryCount: number;
    hospitalizationCount: number;
    fatalityClaims: RawClaimExport[];
    // Additional CP1 trigger flags
    medsVsLimitsCount: number;
    lossOfConsciousnessCount: number;
    aggravatingFactorsCount: number;
    objectiveInjuriesCount: number;
    pedestrianMotorcyclistCount: number;
    pregnancyCount: number;
    lifeCarePlannerCount: number;
    injectionsCount: number;
    emsHeavyImpactCount: number;
  };
  delta?: {
    previousTotal: number;
    currentTotal: number;
    change: number;
    changePercent: number;
    reservesChange: number;
    reservesChangePercent: number;
    previousDate: string;
    currentDate: string;
  };
  dataDate: string;
}

interface RawClaimRow {
  'Status': string;
  'Claim#': string;
  'Claimant': string;
  'Coverage': string;
  // Historical exports used "Days"; the 1/08 export uses "Open/Closed Days"
  'Days'?: string;
  'Open/Closed Days'?: string;
  'Open/Closed Days '?: string;
  // Bucket label in the export (e.g., "365+ Days", "61-180 Days")
  'Age': string;
  'Type Group': string;
  'Open Reserves': string;
  'BI Reserves': string;
  'Low': string;
  'High': string;
  'CP1 Exposure Flag': string;
  'CP1 Claim Flag': string;
  'Overall CP1 Flag': string;
  'Exposure Category': string;
  'Evaluation Phase': string;
  'Demand Type': string;
  [key: string]: string | undefined;
}

function parseCurrency(val: string): number {
  if (!val || val.trim() === '' || val === '(blank)') return 0;
  // Remove $, commas, spaces
  const cleaned = val.replace(/[$,\s]/g, '').trim();
  // Handle parentheses for negatives
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -parseFloat(cleaned.slice(1, -1)) || 0;
  }
  return parseFloat(cleaned) || 0;
}

function getAgeBucket(days: number): 'age365Plus' | 'age181To365' | 'age61To180' | 'ageUnder60' {
  if (days >= 365) return 'age365Plus';
  if (days >= 181) return 'age181To365';
  if (days >= 61) return 'age61To180';
  return 'ageUnder60';
}

function getAgeBucketLabel(bucket: string): string {
  switch (bucket) {
    case 'age365Plus': return '365+ Days';
    case 'age181To365': return '181-365 Days';
    case 'age61To180': return '61-180 Days';
    case 'ageUnder60': return 'Under 60 Days';
    default: return bucket;
  }
}

// Only include these coverage types for BI measurement
const INCLUDED_COVERAGES = ['BI', 'UM', 'UI'];

function isIncludedCoverage(coverage: string): boolean {
  const trimmed = coverage?.trim().toUpperCase() || '';
  return INCLUDED_COVERAGES.includes(trimmed);
}

// Process raw claims data - SINGLE SOURCE OF TRUTH
function processRawClaims(rows: RawClaimRow[]): Omit<OpenExposureData, 'delta' | 'dataDate'> {
  const phaseMap = new Map<string, Map<string, { age365Plus: number; age181To365: number; age61To180: number; ageUnder60: number; total: number }>>();
  const typeGroupMap = new Map<string, { 
    age365Plus: number; age181To365: number; age61To180: number; ageUnder60: number; 
    grandTotal: number; reserves: number; lowEval: number; highEval: number 
  }>();
  
  // CP1 tracking by coverage (for BI/UM/UI detailed breakdown)
  const cp1ByCoverage = new Map<string, { noCP: number; yes: number; reserves: number }>();
  
  // CP1 tracking by type group
  const cp1ByTypeGroup = new Map<string, { noCP: number; yes: number }>();
  
  // CP1 tracking for ALL coverages (for grand total)
  let cp1AllCoverages = { noCP: 0, yes: 0 };
  
  // CP1 tracking by BI Status (In Progress vs Settled)
  let cp1ByStatus = { inProgress: 0, settled: 0 };
  
  // CP1 BI tracking by age bucket
  const cp1BiByAge = {
    age365Plus: { noCP: 0, yes: 0 },
    age181To365: { noCP: 0, yes: 0 },
    age61To180: { noCP: 0, yes: 0 },
    ageUnder60: { noCP: 0, yes: 0 },
  };
  
  // Financial aggregation by age bucket (for BI/UM/UI)
  const ageFinancials = {
    age365Plus: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
    age181To365: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
    age61To180: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
    ageUnder60: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
  };
  
  let cp1Totals = { total: 0, age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0 };
  // grandTotals for BI/UM/UI detailed analysis
  let grandTotals = { age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0, grandTotal: 0 };
  let financialTotals = { totalOpenReserves: 0, totalLowEval: 0, totalHighEval: 0, noEvalCount: 0, noEvalReserves: 0 };
  
  // ═══════════════════════════════════════════════════════════════════
  // NEW: Track ALL claims/exposures (not just BI/UM/UI) for accurate totals
  // ═══════════════════════════════════════════════════════════════════
  const allUniqueClaimNumbers = new Set<string>();
  let allExposuresCount = 0;
  let allFlaggedCount = 0;
  let allNewClaimsCount = 0;
  const allAgeTotals = { age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0 };
  
  // Type group claim counts for known totals
  const typeGroupCounts = new Map<string, number>();
  
  // Track unique claims per type group (for Claims column) vs exposures (rows)
  const typeGroupUniqueClaims = new Map<string, Set<string>>();
  const typeGroupExposures = new Map<string, number>();
  
  // ALL coverages - track unique claims and exposures per type group
  const allTypeGroupUniqueClaims = new Map<string, Set<string>>();
  const allTypeGroupExposures = new Map<string, number>();
  
  // Texas Rear End tracking (State = TEXAS, Loss Desc contains "R/E")
  const texasAreaMap = new Map<string, { claims: number; reserves: number; lowEval: number; highEval: number }>();
  const texasAgeMap = {
    age365Plus: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
    age181To365: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
    age61To180: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
    ageUnder60: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
  };
  let texasSummary = { totalClaims: 0, totalReserves: 0, lowEval: 0, highEval: 0 };
  
  // Raw claims for export/validation (BI/UM/UI only)
  const rawClaimsExport: RawClaimExport[] = [];
  // ALL raw claims for drilldowns (all coverages)
  const allRawClaimsExport: RawClaimExport[] = [];
  
  for (const row of rows) {
    // Skip header row or empty rows
    if (!row['Claim#'] || row['Claim#'] === 'Claim#') continue;
    
    // ═══════════════════════════════════════════════════════════════════
    // FILTER OUT non-workable files (settled statuses, pending docs, etc.)
    // ═══════════════════════════════════════════════════════════════════
    const exposureCategory = (row['Exposure Category'] || '').trim().toUpperCase();
    const biStatusRaw = (row['BI Status'] || '').trim().toLowerCase();
    
    // Exclude Exposure Categories that are non-workable
    if (exposureCategory === 'SPD' || exposureCategory === 'SETTLED PENDING DOCS') continue;
    
    // Exclude BI Statuses that indicate settled/pending non-workable claims
    const excludedBiStatuses = [
      'settled pending docs',
      'conditional',
      'court approval pending',
      'settled pending drafting instructions',
      'pending friendly suits',
      'pending payment',
      'future medical release',
      'past medical release',
      'spd-lit',
      'spd - lit',
      'passed/future medical release',
      'past/future medical release',
    ];
    if (excludedBiStatuses.some(s => biStatusRaw === s || biStatusRaw.includes(s))) continue;
    
    const claimNum = row['Claim#']?.trim() || '';
    const typeGroup = row['Type Group']?.trim() || 'Unknown';

    // The 1/08 export changed the days column header.
    const daysStr = (row['Days'] || row['Open/Closed Days'] || row['Open/Closed Days '] || '0').toString();
    const days = parseInt(daysStr, 10) || 0;

    // Prefer the explicit bucket label if present; fall back to computed days.
    const ageLabel = (row['Age'] || '').trim();
    const ageBucket = ageLabel.includes('365+')
      ? 'age365Plus'
      : ageLabel.includes('181-365')
        ? 'age181To365'
        : ageLabel.includes('61-180')
          ? 'age61To180'
          : ageLabel.includes('Under 60')
            ? 'ageUnder60'
            : getAgeBucket(days);
    // ═══════════════════════════════════════════════════════════════════
    // COUNT ALL CLAIMS/EXPOSURES FIRST (before coverage filter)
    // ═══════════════════════════════════════════════════════════════════
    allUniqueClaimNumbers.add(claimNum);
    allExposuresCount++;
    allAgeTotals[ageBucket]++;
    
    // Track by type group for ALL coverages
    if (!allTypeGroupUniqueClaims.has(typeGroup)) {
      allTypeGroupUniqueClaims.set(typeGroup, new Set());
    }
    allTypeGroupUniqueClaims.get(typeGroup)!.add(claimNum);
    allTypeGroupExposures.set(typeGroup, (allTypeGroupExposures.get(typeGroup) || 0) + 1);
    
    // Track flagged claims (CP1 flags)
    // IMPORTANT: CP1 is defined by the "Overall CP1 Flag" (the derived business definition).
    // Falling back to the component flags only if Overall is blank prevents double-counting.
    const overall = (row['Overall CP1 Flag'] || '').trim().toLowerCase();
    const exposureFlag = (row['CP1 Exposure Flag'] || '').trim().toLowerCase();
    const claimFlag = (row['CP1 Claim Flag'] || '').trim().toLowerCase();

    const isCP1 = overall === 'yes' || (overall === '' && (exposureFlag === 'yes' || claimFlag === 'yes'));
    if (isCP1) {
      allFlaggedCount++;
    }
    
    const coverage = row['Coverage']?.trim() || 'Unknown';
    
    // Parse financial data for ALL claims (needed for allRawClaimsExport)
    const reserves = parseCurrency(row['Open Reserves'] || '0');
    const lowEval = parseCurrency(row['Low'] || '0');
    const highEval = parseCurrency(row['High'] || '0');
    
    const evalPhase = row['Evaluation Phase']?.trim() || '';
    const demandType = row['Demand Type']?.trim() || '(blank)';
    const biStatus = row['BI Status']?.trim() || '';
    const daysSinceNegoStr = row['Days Since Negotiation Date']?.trim() || '';
    const daysSinceNegotiation = daysSinceNegoStr ? parseInt(daysSinceNegoStr, 10) || null : null;
    const negotiationType = row['Negotiation Type']?.trim() || '';
    const negotiationDate = row['Negotiation Date']?.trim() || '';
    
    // Parse demand/settlement and litigation fields
    const negotiationAmount = parseCurrency(row['Negotiation Amount'] || '0');
    const authAmount = parseCurrency(row['Auth'] || '0');
    const totalPaid = parseCurrency(row['Total Paid'] || '0');
    const netTotalIncurred = parseCurrency(row['Net Total Incurred'] || '0');
    const reserveChangePercentStr = row['% Reserve Change from Initial Reserve']?.trim() || '';
    const reserveChangePercent = reserveChangePercentStr ? parseFloat(reserveChangePercentStr.replace(/[%,]/g, '')) || 0 : 0;
    const inLitigationStr = row['In Litigation Indicator']?.trim().toLowerCase() || '';
    const inLitigation = inLitigationStr === 'in litigation' || inLitigationStr === 'yes';
    const causeNumber = row['Cause Number']?.trim() || '';
    const caseType = row['Case Type']?.trim() || '';
    const matterStatus = row['Matter Status']?.trim() || '';
    const settledDate = row['Settled Date']?.trim() || '';
    const daysSinceSettledStr = row['Days Since Settled?']?.trim() || '';
    const daysSinceSettled = daysSinceSettledStr ? parseInt(daysSinceSettledStr, 10) || null : null;
    
    // Parse fatality and severity flags (all CP1 trigger types)
    const parseYesNo = (val: string) => {
      const v = (val || '').toString().toLowerCase().trim();
      return v === 'yes' || v === 'y' || v === 'true' || v === '1';
    };
    const isFatality = parseYesNo(row['FATALITY']);
    const isSurgery = parseYesNo(row['SURGERY']);
    const isHospitalization = parseYesNo(row['HOSPITALIZATION']);
    const isMedsVsLimits = parseYesNo(row['MEDS VS LIMITS']);
    const isLossOfConsciousness = parseYesNo(row['LOSS OF CONSCIOUSNESS']);
    const isAggravatingFactors = parseYesNo(row['AGGRAVATING FACTORS']);
    const isObjectiveInjuries = parseYesNo(row['OBJECTIVE INJURIES']);
    const isPedestrianMotorcyclist = parseYesNo(row['PEDESTRIAN/MOTORCYCLIST/BICYCLIST/PREGNANCY']);
    const isLifeCarePlanner = parseYesNo(row['LIFE CARE PLANNER']);
    const isInjections = parseYesNo(row['INJECTIONS']);
    const isEmsHeavyImpact = parseYesNo(row['EMS + HEAVY IMPACT']);
    
    const teamGroup = row['Team Group']?.trim() || '';
    const adjuster = row['Adjuster Assigned']?.trim() || '';
    const areaNumber = row['Area#']?.trim() || '';
    const lossDescription = row['Description of Accident']?.trim() || '';
    
    // ═══════════════════════════════════════════════════════════════════
    // Add ALL claims to allRawClaimsExport BEFORE the coverage filter
    // ═══════════════════════════════════════════════════════════════════
    allRawClaimsExport.push({
      claimNumber: row['Claim#']?.trim() || '',
      claimant: row['Claimant']?.trim() || '',
      coverage,
      days,
      ageBucket: getAgeBucketLabel(ageBucket),
      typeGroup,
      openReserves: reserves,
      lowEval,
      highEval,
      cp1Flag: isCP1 ? 'Yes' : 'No',
      overallCP1: row['Overall CP1 Flag']?.trim() || '',
      evaluationPhase: evalPhase,
      demandType,
      teamGroup,
      adjuster,
      areaNumber,
      lossDescription,
      exposureCategory: row['Exposure Category']?.trim() || '',
      biStatus,
      daysSinceNegotiation,
      negotiationType,
      negotiationDate,
      negotiationAmount,
      authAmount,
      totalPaid,
      netTotalIncurred,
      reserveChangePercent,
      inLitigation,
      causeNumber,
      caseType,
      matterStatus,
      settledDate,
      daysSinceSettled,
      fatality: isFatality,
      surgery: isSurgery,
      hospitalization: isHospitalization,
    });
    
    // Track CP1 for ALL coverages (for grand total)
    if (isCP1) {
      cp1AllCoverages.yes++;
      
      // Track CP1 by BI Status
      const biStatusLower = biStatus.toLowerCase();
      if (biStatusLower === 'in progress') {
        cp1ByStatus.inProgress++;
      } else if (biStatusLower === 'settled') {
        cp1ByStatus.settled++;
      }
    } else {
      cp1AllCoverages.noCP++;
    }
    
    // FILTER: Only include BI, UM, UI coverages for detailed financial breakdown
    if (!isIncludedCoverage(coverage)) continue;
    
    // Add BI/UM/UI claims to rawClaimsExport for financial analysis
    rawClaimsExport.push({
      claimNumber: row['Claim#']?.trim() || '',
      claimant: row['Claimant']?.trim() || '',
      coverage,
      days,
      ageBucket: getAgeBucketLabel(ageBucket),
      typeGroup,
      openReserves: reserves,
      lowEval,
      highEval,
      cp1Flag: isCP1 ? 'Yes' : 'No',
      overallCP1: row['Overall CP1 Flag']?.trim() || '',
      evaluationPhase: evalPhase,
      demandType,
      teamGroup,
      adjuster,
      areaNumber,
      lossDescription,
      exposureCategory: row['Exposure Category']?.trim() || '',
      biStatus,
      daysSinceNegotiation,
      negotiationType,
      negotiationDate,
      negotiationAmount,
      authAmount,
      totalPaid,
      netTotalIncurred,
      reserveChangePercent,
      inLitigation,
      causeNumber,
      caseType,
      matterStatus,
      settledDate,
      daysSinceSettled,
      fatality: isFatality,
      surgery: isSurgery,
      hospitalization: isHospitalization,
    });
    
    // Update grand totals (claim counts)
    grandTotals[ageBucket]++;
    grandTotals.grandTotal++;
    
    // Update financial totals
    financialTotals.totalOpenReserves += reserves;
    financialTotals.totalLowEval += lowEval;
    financialTotals.totalHighEval += highEval;
    if (lowEval === 0 && highEval === 0) {
      financialTotals.noEvalCount++;
      financialTotals.noEvalReserves += reserves;
    }
    
    // Update age bucket financials
    ageFinancials[ageBucket].claims++;
    ageFinancials[ageBucket].reserves += reserves;
    ageFinancials[ageBucket].lowEval += lowEval;
    ageFinancials[ageBucket].highEval += highEval;
    
    // Update type group summaries
    if (!typeGroupMap.has(typeGroup)) {
      typeGroupMap.set(typeGroup, { 
        age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0, 
        grandTotal: 0, reserves: 0, lowEval: 0, highEval: 0 
      });
    }
    const tg = typeGroupMap.get(typeGroup)!;
    tg[ageBucket]++;
    tg.grandTotal++;
    tg.reserves += reserves;
    tg.lowEval += lowEval;
    tg.highEval += highEval;
    
    // Track type group counts (exposures = rows)
    typeGroupCounts.set(typeGroup, (typeGroupCounts.get(typeGroup) || 0) + 1);
    typeGroupExposures.set(typeGroup, (typeGroupExposures.get(typeGroup) || 0) + 1);
    
    // Track unique claims per type group (for BI/UM/UI)
    if (!typeGroupUniqueClaims.has(typeGroup)) {
      typeGroupUniqueClaims.set(typeGroup, new Set());
    }
    typeGroupUniqueClaims.get(typeGroup)!.add(claimNum);
    
    // Track CP1 by coverage
    if (!cp1ByCoverage.has(coverage)) {
      cp1ByCoverage.set(coverage, { noCP: 0, yes: 0, reserves: 0 });
    }
    const coverageCP1 = cp1ByCoverage.get(coverage)!;
    if (isCP1) {
      coverageCP1.yes++;
      coverageCP1.reserves += reserves;
      cp1Totals.total++;
      cp1Totals[ageBucket]++;
    } else {
      coverageCP1.noCP++;
    }
    
    // Track CP1 by type group
    if (!cp1ByTypeGroup.has(typeGroup)) {
      cp1ByTypeGroup.set(typeGroup, { noCP: 0, yes: 0 });
    }
    const typeGroupCP1 = cp1ByTypeGroup.get(typeGroup)!;
    if (isCP1) {
      typeGroupCP1.yes++;
    } else {
      typeGroupCP1.noCP++;
    }
    
    // Track BI CP1 by age bucket
    if (coverage === 'BI' || coverage.startsWith('BI')) {
      if (isCP1) {
        cp1BiByAge[ageBucket].yes++;
      } else {
        cp1BiByAge[ageBucket].noCP++;
      }
    }
    
    // Track phases for LIT type group
    if (typeGroup === 'LIT' && evalPhase) {
      if (!phaseMap.has(evalPhase)) {
        phaseMap.set(evalPhase, new Map());
      }
      const demandMap = phaseMap.get(evalPhase)!;
      if (!demandMap.has(demandType)) {
        demandMap.set(demandType, { age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0, total: 0 });
      }
      const dt = demandMap.get(demandType)!;
      dt[ageBucket]++;
      dt.total++;
    }
    
    // Track Texas Rear End claims (State = TEXAS, Loss Description contains "R/E")
    const accidentState = row['Accident Location State']?.trim().toUpperCase() || '';
    const accidentCity = row['Accident Location City']?.trim() || '';
    const lossDesc = row['Description of Accident']?.trim() || '';
    const isTexas = accidentState === 'TEXAS' || accidentState === 'TX';
    const isRearEnd = lossDesc.toUpperCase().includes('R/E');
    
    if (isTexas && isRearEnd) {
      // Track by city (as area substitute)
      const cityKey = accidentCity || 'Unknown';
      if (!texasAreaMap.has(cityKey)) {
        texasAreaMap.set(cityKey, { claims: 0, reserves: 0, lowEval: 0, highEval: 0 });
      }
      const areaData = texasAreaMap.get(cityKey)!;
      areaData.claims++;
      areaData.reserves += reserves;
      areaData.lowEval += lowEval;
      areaData.highEval += highEval;
      
      // Track by age bucket
      texasAgeMap[ageBucket].claims++;
      texasAgeMap[ageBucket].reserves += reserves;
      texasAgeMap[ageBucket].lowEval += lowEval;
      texasAgeMap[ageBucket].highEval += highEval;
      
      // Update summary
      texasSummary.totalClaims++;
      texasSummary.totalReserves += reserves;
      texasSummary.lowEval += lowEval;
      texasSummary.highEval += highEval;
    }
  }
  
  // Convert phase map to array
  const litPhases: OpenExposurePhase[] = [];
  phaseMap.forEach((demandMap, phase) => {
    const demandTypes: OpenExposurePhase['demandTypes'] = [];
    let phaseTotals = { age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0, grandTotal: 0 };
    
    demandMap.forEach((counts, type) => {
      demandTypes.push({ type, ...counts });
      phaseTotals.age365Plus += counts.age365Plus;
      phaseTotals.age181To365 += counts.age181To365;
      phaseTotals.age61To180 += counts.age61To180;
      phaseTotals.ageUnder60 += counts.ageUnder60;
      phaseTotals.grandTotal += counts.total;
    });
    
    litPhases.push({
      phase,
      demandTypes,
      total365Plus: phaseTotals.age365Plus,
      total181To365: phaseTotals.age181To365,
      total61To180: phaseTotals.age61To180,
      totalUnder60: phaseTotals.ageUnder60,
      grandTotal: phaseTotals.grandTotal
    });
  });
  
  // Sort phases by total descending
  litPhases.sort((a, b) => b.grandTotal - a.grandTotal);
  
  // Convert type group map to array with unique claims count
  const typeGroupSummaries: TypeGroupSummary[] = [];
  typeGroupMap.forEach((counts, typeGroup) => {
    const uniqueClaims = typeGroupUniqueClaims.get(typeGroup)?.size || 0;
    typeGroupSummaries.push({ typeGroup, ...counts, uniqueClaims });
  });
  
  // Sort by uniqueClaims descending (claims count, not exposures)
  typeGroupSummaries.sort((a, b) => b.uniqueClaims - a.uniqueClaims);
  
  // Build CP1 byCoverage array
  const cp1CoverageArray: CP1Data['byCoverage'] = [];
  cp1ByCoverage.forEach((data, coverage) => {
    const total = data.noCP + data.yes;
    cp1CoverageArray.push({
      coverage,
      count: data.yes,
      noCP: data.noCP,
      yes: data.yes,
      total,
      cp1Rate: total > 0 ? parseFloat(((data.yes / total) * 100).toFixed(1)) : 0,
      reserves: data.reserves
    });
  });
  cp1CoverageArray.sort((a, b) => b.total - a.total);
  
  // Build CP1 BI by age
  const biByAge: CP1Data['biByAge'] = [
    { age: '365+ Days', noCP: cp1BiByAge.age365Plus.noCP, yes: cp1BiByAge.age365Plus.yes, total: cp1BiByAge.age365Plus.noCP + cp1BiByAge.age365Plus.yes },
    { age: '181-365 Days', noCP: cp1BiByAge.age181To365.noCP, yes: cp1BiByAge.age181To365.yes, total: cp1BiByAge.age181To365.noCP + cp1BiByAge.age181To365.yes },
    { age: '61-180 Days', noCP: cp1BiByAge.age61To180.noCP, yes: cp1BiByAge.age61To180.yes, total: cp1BiByAge.age61To180.noCP + cp1BiByAge.age61To180.yes },
    { age: 'Under 60 Days', noCP: cp1BiByAge.ageUnder60.noCP, yes: cp1BiByAge.ageUnder60.yes, total: cp1BiByAge.ageUnder60.noCP + cp1BiByAge.ageUnder60.yes },
  ];
  
  const biTotal = {
    noCP: biByAge.reduce((s, b) => s + b.noCP, 0),
    yes: biByAge.reduce((s, b) => s + b.yes, 0),
    total: biByAge.reduce((s, b) => s + b.total, 0),
  };
  
  // Calculate CP1 totals - use ALL coverages for grand total
  const cp1TotalsCalc = {
    noCP: cp1AllCoverages.noCP,
    yes: cp1AllCoverages.yes,
    grandTotal: cp1AllCoverages.noCP + cp1AllCoverages.yes,
  };
  
  // Calculate CP1 by status percentages
  const cp1StatusTotal = cp1ByStatus.inProgress + cp1ByStatus.settled;
  const byStatus = {
    inProgress: cp1ByStatus.inProgress,
    settled: cp1ByStatus.settled,
    inProgressPct: cp1StatusTotal > 0 ? ((cp1ByStatus.inProgress / cp1StatusTotal) * 100).toFixed(1) : '0.0',
    settledPct: cp1StatusTotal > 0 ? ((cp1ByStatus.settled / cp1StatusTotal) * 100).toFixed(1) : '0.0',
  };

  const cp1Data: CP1Data = {
    ...cp1Totals,
    demandTypes: cp1CoverageArray.slice(0, 10).map(c => ({ type: c.coverage, count: c.count })),
    byCoverage: cp1CoverageArray,
    biByAge,
    biTotal,
    totals: cp1TotalsCalc,
    cp1Rate: cp1TotalsCalc.grandTotal > 0 
      ? ((cp1TotalsCalc.yes / cp1TotalsCalc.grandTotal) * 100).toFixed(1)
      : '0.0',
    byStatus,
  };
  
  // Build financials by age
  const byAge: FinancialsByAge[] = [
    { age: '365+ Days', claims: ageFinancials.age365Plus.claims, openReserves: ageFinancials.age365Plus.reserves, lowEval: ageFinancials.age365Plus.lowEval, highEval: ageFinancials.age365Plus.highEval },
    { age: '181-365 Days', claims: ageFinancials.age181To365.claims, openReserves: ageFinancials.age181To365.reserves, lowEval: ageFinancials.age181To365.lowEval, highEval: ageFinancials.age181To365.highEval },
    { age: '61-180 Days', claims: ageFinancials.age61To180.claims, openReserves: ageFinancials.age61To180.reserves, lowEval: ageFinancials.age61To180.lowEval, highEval: ageFinancials.age61To180.highEval },
    { age: 'Under 60 Days', claims: ageFinancials.ageUnder60.claims, openReserves: ageFinancials.ageUnder60.reserves, lowEval: ageFinancials.ageUnder60.lowEval, highEval: ageFinancials.ageUnder60.highEval },
  ];
  
  // Build financials by type group
  const byTypeGroup = typeGroupSummaries.map(tg => ({
    typeGroup: tg.typeGroup,
    reserves: tg.reserves
  }));
  
  // Build known totals from actual data - ALL claims (not just BI/UM/UI)
  // This matches the source system totals: 10,074 claims / 19,470 exposures
  const knownTotals: KnownTotals = {
    totalOpenClaims: allUniqueClaimNumbers.size,
    totalOpenExposures: allExposuresCount,
    atr: { 
      claims: allTypeGroupUniqueClaims.get('ATR')?.size || 0, 
      exposures: allTypeGroupExposures.get('ATR') || 0 
    },
    lit: { 
      claims: allTypeGroupUniqueClaims.get('LIT')?.size || 0, 
      exposures: allTypeGroupExposures.get('LIT') || 0 
    },
    bi3: { 
      claims: allTypeGroupUniqueClaims.get('BI3')?.size || 0, 
      exposures: allTypeGroupExposures.get('BI3') || 0 
    },
    earlyBI: { 
      claims: allTypeGroupUniqueClaims.get('Early BI')?.size || allTypeGroupUniqueClaims.get('EBI')?.size || 0, 
      exposures: allTypeGroupExposures.get('Early BI') || allTypeGroupExposures.get('EBI') || 0 
    },
    flagged: allFlaggedCount,
    newClaims: allNewClaimsCount,
    closed: 0, // Would need separate data source
  };
  
  // Build Texas Rear End data (by city)
  const texasRearEndByArea: TexasRearEndArea[] = [];
  texasAreaMap.forEach((data, city) => {
    texasRearEndByArea.push({
      area: city,
      claims: data.claims,
      reserves: data.reserves,
      lowEval: data.lowEval,
      highEval: data.highEval
    });
  });
  texasRearEndByArea.sort((a, b) => b.claims - a.claims);
  
  const texasRearEndByAge: TexasRearEndAge[] = [
    { age: '365+ Days', ...texasAgeMap.age365Plus },
    { age: '181-365 Days', ...texasAgeMap.age181To365 },
    { age: '61-180 Days', ...texasAgeMap.age61To180 },
    { age: 'Under 60 Days', ...texasAgeMap.ageUnder60 },
  ];
  
  const texasRearEnd: TexasRearEndData = {
    lossDescription: 'IV R/E CV',
    summary: texasSummary,
    byArea: texasRearEndByArea,
    byAge: texasRearEndByAge
  };
  
  // Build CP1 by type group array
  const cp1ByTypeGroupArray: CP1ByTypeGroup[] = [];
  cp1ByTypeGroup.forEach((data, typeGroup) => {
    const total = data.noCP + data.yes;
    cp1ByTypeGroupArray.push({
      typeGroup,
      noCP: data.noCP,
      yes: data.yes,
      total,
      cp1Rate: total > 0 ? parseFloat(((data.yes / total) * 100).toFixed(1)) : 0,
    });
  });
  cp1ByTypeGroupArray.sort((a, b) => b.yes - a.yes);
  
  // ============ MULTI-PACK GROUPING ============
  // Group claims by prefix + first 6 digits after prefix
  // Format: XX-XXXXXX-XX where prefix is 2-3 chars, base is 6 digits, rest is exposure
  // e.g., "39-0000430132" and "39-0000431432" share base "39-000043"
  const claimBaseMap = new Map<string, {
    claimNumber: string;
    claimant: string;
    coverage: string;
    days: number;
    ageBucket: string;
    typeGroup: string;
    teamGroup: string;
    reserves: number;
    lowEval: number;
    highEval: number;
    exposureCategory: string;
    overallCP1: string;
    evaluationPhase: string;
  }[]>();
  
  const extractBaseClaim = (claimNum: string): string => {
    // Base claim = everything before the last dash (exposure number follows last dash)
    // e.g., "65-158035-2" -> base "65-158035", exposure "2"
    const lastDashIdx = claimNum.lastIndexOf('-');
    if (lastDashIdx === -1 || lastDashIdx === claimNum.indexOf('-')) {
      // No second dash - return as-is (single claim, not multi-pack)
      return claimNum;
    }
    return claimNum.substring(0, lastDashIdx);
  };
  
  for (const claim of rawClaimsExport) {
    const base = extractBaseClaim(claim.claimNumber);
    if (!claimBaseMap.has(base)) {
      claimBaseMap.set(base, []);
    }
    claimBaseMap.get(base)!.push({
      claimNumber: claim.claimNumber,
      claimant: claim.claimant,
      coverage: claim.coverage,
      days: claim.days,
      ageBucket: claim.ageBucket,
      typeGroup: claim.typeGroup,
      teamGroup: claim.teamGroup,
      reserves: claim.openReserves,
      lowEval: claim.lowEval,
      highEval: claim.highEval,
      exposureCategory: claim.exposureCategory,
      overallCP1: claim.overallCP1,
      evaluationPhase: claim.evaluationPhase,
    });
  }
  
  // Build multi-pack groups (only groups with 2+ claims)
  const multiPackGroups: MultiPackGroup[] = [];
  claimBaseMap.forEach((claims, baseClaimNumber) => {
    if (claims.length >= 2) {
      const totalReserves = claims.reduce((sum, c) => sum + c.reserves, 0);
      const totalLowEval = claims.reduce((sum, c) => sum + c.lowEval, 0);
      const totalHighEval = claims.reduce((sum, c) => sum + c.highEval, 0);
      multiPackGroups.push({
        baseClaimNumber,
        packSize: claims.length,
        claims: claims.sort((a, b) => parseInt(a.claimant) - parseInt(b.claimant)),
        totalReserves,
        totalLowEval,
        totalHighEval,
      });
    }
  });
  
  // Sort by pack size (largest first) then by reserves
  multiPackGroups.sort((a, b) => b.packSize - a.packSize || b.totalReserves - a.totalReserves);
  
  // Calculate summary by pack size
  const packSizeMap = new Map<number, { groupCount: number; claimCount: number; reserves: number }>();
  for (const group of multiPackGroups) {
    if (!packSizeMap.has(group.packSize)) {
      packSizeMap.set(group.packSize, { groupCount: 0, claimCount: 0, reserves: 0 });
    }
    const ps = packSizeMap.get(group.packSize)!;
    ps.groupCount++;
    ps.claimCount += group.claims.length;
    ps.reserves += group.totalReserves;
  }
  
  const byPackSize = Array.from(packSizeMap.entries())
    .map(([packSize, data]) => ({ packSize, ...data }))
    .sort((a, b) => b.packSize - a.packSize);
  
  const multiPackData: MultiPackSummary = {
    totalMultiPackGroups: multiPackGroups.length,
    totalClaimsInPacks: multiPackGroups.reduce((sum, g) => sum + g.claims.length, 0),
    byPackSize,
    groups: multiPackGroups,
  };
  
  // ============ PHASE BREAKDOWN ============
  const phaseAggregation = new Map<string, { claims: number; reserves: number; lowEval: number; highEval: number; byAge: { age365Plus: number; age181To365: number; age61To180: number; ageUnder60: number } }>();
  
  for (const claim of rawClaimsExport) {
    const phase = claim.evaluationPhase || '(No Phase)';
    if (!phaseAggregation.has(phase)) {
      phaseAggregation.set(phase, { claims: 0, reserves: 0, lowEval: 0, highEval: 0, byAge: { age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0 } });
    }
    const p = phaseAggregation.get(phase)!;
    p.claims++;
    p.reserves += claim.openReserves;
    p.lowEval += claim.lowEval;
    p.highEval += claim.highEval;
    
    // Map age bucket label back to property name
    if (claim.ageBucket === '365+ Days') p.byAge.age365Plus++;
    else if (claim.ageBucket === '181-365 Days') p.byAge.age181To365++;
    else if (claim.ageBucket === '61-180 Days') p.byAge.age61To180++;
    else p.byAge.ageUnder60++;
  }
  
  const phaseBreakdown: PhaseBreakdown[] = Array.from(phaseAggregation.entries())
    .map(([phase, data]) => ({ phase, ...data }))
    .sort((a, b) => b.claims - a.claims);
  
  // ============ NEGOTIATION RECENCY ============
  const negoRecencyMap = new Map<string, { claims: number; reserves: number; lowEval: number; highEval: number }>();
  const negoBuckets = ['0-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'No Negotiation'];
  negoBuckets.forEach(b => negoRecencyMap.set(b, { claims: 0, reserves: 0, lowEval: 0, highEval: 0 }));
  
  for (const claim of rawClaimsExport) {
    let bucket = 'No Negotiation';
    if (claim.daysSinceNegotiation !== null && !isNaN(claim.daysSinceNegotiation)) {
      if (claim.daysSinceNegotiation <= 30) bucket = '0-30 Days';
      else if (claim.daysSinceNegotiation <= 60) bucket = '31-60 Days';
      else if (claim.daysSinceNegotiation <= 90) bucket = '61-90 Days';
      else bucket = '90+ Days';
    }
    const nr = negoRecencyMap.get(bucket)!;
    nr.claims++;
    nr.reserves += claim.openReserves;
    nr.lowEval += claim.lowEval;
    nr.highEval += claim.highEval;
  }
  
  const negotiationRecency: NegotiationRecency[] = negoBuckets.map(bucket => ({
    bucket,
    ...negoRecencyMap.get(bucket)!
  }));
  
  // ============ BI STATUS BREAKDOWN ============
  const biStatusBreakdown = {
    inProgress: { claims: 0, reserves: 0 },
    settled: { claims: 0, reserves: 0 },
    other: { claims: 0, reserves: 0 },
  };
  
  for (const claim of rawClaimsExport) {
    const status = claim.biStatus?.toLowerCase() || '';
    if (status === 'in progress') {
      biStatusBreakdown.inProgress.claims++;
      biStatusBreakdown.inProgress.reserves += claim.openReserves;
    } else if (status === 'settled') {
      biStatusBreakdown.settled.claims++;
      biStatusBreakdown.settled.reserves += claim.openReserves;
    } else {
      biStatusBreakdown.other.claims++;
      biStatusBreakdown.other.reserves += claim.openReserves;
    }
  }
  
  // ============ DEMAND SUMMARY ============
  // Claims "with demand" = claims where demandType is not blank/empty
  const claimsWithDemand = rawClaimsExport.filter(c => 
    c.demandType && c.demandType.trim() !== '' && c.demandType !== '(blank)'
  );
  const demandSummary = {
    claimsWithDemand: claimsWithDemand.length,
    totalDemandReserves: claimsWithDemand.reduce((sum, c) => sum + c.openReserves, 0),
    totalDemandLowEval: claimsWithDemand.reduce((sum, c) => sum + c.lowEval, 0),
    totalDemandHighEval: claimsWithDemand.reduce((sum, c) => sum + c.highEval, 0),
    byDemandType: (() => {
      const demandTypeMap = new Map<string, { claims: number; reserves: number; lowEval: number; highEval: number }>();
      for (const claim of claimsWithDemand) {
        const dt = claim.demandType || 'Unknown';
        if (!demandTypeMap.has(dt)) {
          demandTypeMap.set(dt, { claims: 0, reserves: 0, lowEval: 0, highEval: 0 });
        }
        const d = demandTypeMap.get(dt)!;
        d.claims++;
        d.reserves += claim.openReserves;
        d.lowEval += claim.lowEval;
        d.highEval += claim.highEval;
      }
      return Array.from(demandTypeMap.entries())
        .map(([demandType, data]) => ({ demandType, ...data }))
        .sort((a, b) => b.claims - a.claims);
    })(),
    demandClaims: claimsWithDemand, // Include raw claims for export
  };
  
  // ============ FATALITY & SEVERITY SUMMARY ============
  // Count all CP1 trigger flags directly from raw CSV data
  let medsVsLimitsCount = 0;
  let lossOfConsciousnessCount = 0;
  let aggravatingFactorsCount = 0;
  let objectiveInjuriesCount = 0;
  let pedestrianMotorcyclistCount = 0;
  let pregnancyCount = 0;
  let lifeCarePlannerCount = 0;
  let injectionsCount = 0;
  let emsHeavyImpactCount = 0;
  
  // Count from raw data (all rows)
  rows.forEach((row: RawClaimRow) => {
    const parseYesNo = (val: string) => {
      const v = (val || '').toString().toLowerCase().trim();
      return v === 'yes' || v === 'y' || v === 'true' || v === '1';
    };
    if (parseYesNo(row['MEDS VS LIMITS'] as string)) medsVsLimitsCount++;
    if (parseYesNo(row['LOSS OF CONSCIOUSNESS'] as string)) lossOfConsciousnessCount++;
    if (parseYesNo(row['AGGRAVATING FACTORS'] as string)) aggravatingFactorsCount++;
    if (parseYesNo(row['OBJECTIVE INJURIES'] as string)) objectiveInjuriesCount++;
    const pedMotoPreg = (row['PEDESTRIAN/MOTORCYCLIST/BICYCLIST/PREGNANCY'] as string || '').toString().toLowerCase().trim();
    if (pedMotoPreg === 'yes' || pedMotoPreg === 'y' || pedMotoPreg === 'true' || pedMotoPreg === '1') {
      pedestrianMotorcyclistCount++;
      // Check description for pregnancy indicators
      const desc = (row['Description of Accident'] as string || '').toLowerCase();
      if (desc.includes('pregnan') || desc.includes('expecting')) {
        pregnancyCount++;
      }
    }
    if (parseYesNo(row['LIFE CARE PLANNER'] as string)) lifeCarePlannerCount++;
    if (parseYesNo(row['INJECTIONS'] as string)) injectionsCount++;
    if (parseYesNo(row['EMS + HEAVY IMPACT'] as string)) emsHeavyImpactCount++;
  });
  
  const fatalityClaims = rawClaimsExport.filter(c => c.fatality);
  const surgeryClaims = rawClaimsExport.filter(c => c.surgery);
  const hospitalizationClaims = rawClaimsExport.filter(c => c.hospitalization);
  const fatalitySummary = {
    fatalityCount: fatalityClaims.length,
    fatalityReserves: fatalityClaims.reduce((sum, c) => sum + c.openReserves, 0),
    fatalityLowEval: fatalityClaims.reduce((sum, c) => sum + c.lowEval, 0),
    fatalityHighEval: fatalityClaims.reduce((sum, c) => sum + c.highEval, 0),
    surgeryCount: surgeryClaims.length,
    hospitalizationCount: hospitalizationClaims.length,
    fatalityClaims: fatalityClaims,
    // Additional CP1 trigger counts
    medsVsLimitsCount,
    lossOfConsciousnessCount,
    aggravatingFactorsCount,
    objectiveInjuriesCount,
    pedestrianMotorcyclistCount,
    pregnancyCount,
    lifeCarePlannerCount,
    injectionsCount,
    emsHeavyImpactCount,
  };
  
  return {
    litPhases,
    typeGroupSummaries,
    cp1Data,
    cp1ByTypeGroup: cp1ByTypeGroupArray,
    // totals now uses ALL exposures (all coverages) for accurate inventory counts
    totals: {
      ...grandTotals,
      // Override with ALL claims age breakdown for accurate totals
      age365Plus: allAgeTotals.age365Plus,
      age181To365: allAgeTotals.age181To365,
      age61To180: allAgeTotals.age61To180,
      ageUnder60: allAgeTotals.ageUnder60,
      grandTotal: allExposuresCount, // ALL exposures (this is the 19.5k/19.7k number)
      uniqueClaims: allUniqueClaimNumbers.size,
      biExposures: grandTotals.grandTotal, // BI/UM/UI exposures
      allExposures: allExposuresCount,
    },
    financials: {
      totalOpenReserves: financialTotals.totalOpenReserves,
      totalLowEval: financialTotals.totalLowEval,
      totalHighEval: financialTotals.totalHighEval,
      noEvalCount: financialTotals.noEvalCount,
      noEvalReserves: financialTotals.noEvalReserves,
      byAge,
      byTypeGroup,
      byQueue: typeGroupSummaries
        .filter(tg => ['ATR', 'LIT', 'BI3', 'Non Rep', 'UIM'].includes(tg.typeGroup))
        .map(tg => ({
          queue: tg.typeGroup,
          openReserves: tg.reserves,
          lowEval: tg.lowEval,
          highEval: tg.highEval,
          claims: tg.grandTotal,
        })),
    },
    knownTotals,
    texasRearEnd,
    rawClaims: rawClaimsExport,
    allRawClaims: allRawClaimsExport,
    multiPackData,
    phaseBreakdown,
    negotiationRecency,
    biStatusBreakdown,
    demandSummary,
    fatalitySummary,
  };
}

// Known baseline for Jan 2, 2026 (BI/UM/UI only) - fallback if no DB snapshot
const FALLBACK_BASELINE = { total: 19493, reserves: 0, date: 'Jan 2, 2026' };

interface SnapshotData {
  snapshot_date: string;
  total_claims: number;
  total_reserves: number;
  total_low_eval: number;
  total_high_eval: number;
  cp1_claims: number;
  cp1_rate: number;
  no_eval_count: number;
  no_eval_reserves: number;
  age_365_plus: number;
  age_181_365: number;
  age_61_180: number;
  age_under_60: number;
  type_group_breakdown: Record<string, number>;
}

// Save current data as a snapshot
async function saveSnapshot(data: Omit<OpenExposureData, 'delta' | 'dataDate'>, snapshotDate: string): Promise<void> {
  const typeGroupBreakdown: Record<string, number> = {};
  data.typeGroupSummaries.forEach(tg => {
    typeGroupBreakdown[tg.typeGroup] = tg.grandTotal;
  });

  const snapshot = {
    snapshot_date: snapshotDate,
    total_claims: data.totals.grandTotal,
    total_reserves: data.financials.totalOpenReserves,
    total_low_eval: data.financials.totalLowEval,
    total_high_eval: data.financials.totalHighEval,
    cp1_claims: data.cp1Data.totals.yes,
    cp1_rate: parseFloat(data.cp1Data.cp1Rate),
    no_eval_count: data.financials.noEvalCount,
    no_eval_reserves: data.financials.noEvalReserves,
    age_365_plus: data.totals.age365Plus,
    age_181_365: data.totals.age181To365,
    age_61_180: data.totals.age61To180,
    age_under_60: data.totals.ageUnder60,
    type_group_breakdown: typeGroupBreakdown,
  };

  const { error } = await supabase
    .from('inventory_snapshots')
    .upsert(snapshot, { onConflict: 'snapshot_date' });

  if (error) {
    console.warn('Failed to save snapshot:', error);
  } else {
    console.log('Snapshot saved for:', snapshotDate);
  }
}

// Get the most recent snapshot before a given date for comparison
async function getPreviousSnapshot(beforeDate: string): Promise<SnapshotData | null> {
  const { data, error } = await supabase
    .from('inventory_snapshots')
    .select('*')
    .lt('snapshot_date', beforeDate)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    console.log('No previous snapshot found, using fallback baseline');
    return null;
  }

  return data as SnapshotData;
}

export function useOpenExposureData() {
  const [data, setData] = useState<OpenExposureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load current raw data (Jan 8)
        const currentRes = await fetch('/data/open-exposure-raw-jan8.csv?d=2026-01-08');
        const currentCsv = await currentRes.text();
        
        // Parse current raw data
        const parsed = Papa.parse<RawClaimRow>(currentCsv, {
          header: true,
          skipEmptyLines: true
        });
        
        if (parsed.errors.length > 0) {
          console.warn('CSV parsing warnings:', parsed.errors.slice(0, 5));
        }
        
        console.log(`Parsed ${parsed.data.length} rows from raw CSV`);
        
        // Debug: Log first row to verify column names
        if (parsed.data.length > 0) {
          const firstRow = parsed.data[0];
          console.log('First row keys:', Object.keys(firstRow).slice(0, 15));
          console.log('Sample reserves value:', firstRow['Open Reserves']);
          console.log('Sample Coverage:', firstRow['Coverage']);
          console.log('Sample CP1 Flag:', firstRow['Overall CP1 Flag']);
        }
        
        const currentData = processRawClaims(parsed.data);
        
        console.log('Processed data summary:', {
          totalExposuresAllCoverages: currentData.totals.grandTotal,
          uniqueClaimsAllCoverages: currentData.totals.uniqueClaims,
          biExposures: currentData.totals.biExposures,
          totalReservesBI: currentData.financials.totalOpenReserves,
          totalLowEvalBI: currentData.financials.totalLowEval,
          totalHighEvalBI: currentData.financials.totalHighEval,
          cp1Rate: currentData.cp1Data.cp1Rate,
          cp1Claims: currentData.cp1Data.totals.yes,
          typeGroupsBI: currentData.typeGroupSummaries.slice(0, 5).map(t => `${t.typeGroup}: ${t.grandTotal}`),
        });
        
        // Current snapshot date (from filename or hardcoded for now)
        const currentSnapshotDate = '2026-01-08';
        
        // Save current data as snapshot
        await saveSnapshot(currentData, currentSnapshotDate);
        
        // Get previous snapshot for delta comparison
        const previousSnapshot = await getPreviousSnapshot(currentSnapshotDate);
        
        // Calculate delta using DB snapshot or fallback
        let delta;
        if (previousSnapshot) {
          const prevReserves = Number(previousSnapshot.total_reserves);
          const currReserves = currentData.financials.totalOpenReserves;
          delta = {
            previousTotal: previousSnapshot.total_claims,
            currentTotal: currentData.totals.grandTotal,
            change: currentData.totals.grandTotal - previousSnapshot.total_claims,
            changePercent: previousSnapshot.total_claims > 0 
              ? ((currentData.totals.grandTotal - previousSnapshot.total_claims) / previousSnapshot.total_claims) * 100 
              : 0,
            reservesChange: currReserves - prevReserves,
            reservesChangePercent: prevReserves > 0 
              ? ((currReserves - prevReserves) / prevReserves) * 100 
              : 0,
            previousDate: format(parseISO(previousSnapshot.snapshot_date), 'MMM d, yyyy'),
            currentDate: format(parseISO(currentSnapshotDate), 'MMM d, yyyy')
          };
        } else {
          // Use fallback baseline
          delta = {
            previousTotal: FALLBACK_BASELINE.total,
            currentTotal: currentData.totals.grandTotal,
            change: currentData.totals.grandTotal - FALLBACK_BASELINE.total,
            changePercent: FALLBACK_BASELINE.total > 0 
              ? ((currentData.totals.grandTotal - FALLBACK_BASELINE.total) / FALLBACK_BASELINE.total) * 100 
              : 0,
            reservesChange: 0,
            reservesChangePercent: 0,
            previousDate: FALLBACK_BASELINE.date,
            currentDate: format(parseISO(currentSnapshotDate), 'MMM d, yyyy')
          };
        }
        
        setData({
          ...currentData,
          delta,
          dataDate: format(parseISO(currentSnapshotDate), 'MMMM d, yyyy')
        });
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading exposure data:', err);
        setError(err.message);
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  return { data, loading, error };
}
