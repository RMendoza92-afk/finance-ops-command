import { useState, useEffect } from "react";
import Papa from "papaparse";

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
  grandTotal: number;
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

export interface OpenExposureData {
  litPhases: OpenExposurePhase[];
  typeGroupSummaries: TypeGroupSummary[];
  cp1Data: CP1Data;
  totals: {
    age365Plus: number;
    age181To365: number;
    age61To180: number;
    ageUnder60: number;
    grandTotal: number;
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
  };
  knownTotals: KnownTotals;
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
  'Days': string;
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
  [key: string]: string;
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

// Process raw claims data - SINGLE SOURCE OF TRUTH
function processRawClaims(rows: RawClaimRow[]): Omit<OpenExposureData, 'delta' | 'dataDate'> {
  const phaseMap = new Map<string, Map<string, { age365Plus: number; age181To365: number; age61To180: number; ageUnder60: number; total: number }>>();
  const typeGroupMap = new Map<string, { 
    age365Plus: number; age181To365: number; age61To180: number; ageUnder60: number; 
    grandTotal: number; reserves: number; lowEval: number; highEval: number 
  }>();
  
  // CP1 tracking by coverage
  const cp1ByCoverage = new Map<string, { noCP: number; yes: number; reserves: number }>();
  
  // CP1 BI tracking by age bucket
  const cp1BiByAge = {
    age365Plus: { noCP: 0, yes: 0 },
    age181To365: { noCP: 0, yes: 0 },
    age61To180: { noCP: 0, yes: 0 },
    ageUnder60: { noCP: 0, yes: 0 },
  };
  
  // Financial aggregation by age bucket
  const ageFinancials = {
    age365Plus: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
    age181To365: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
    age61To180: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
    ageUnder60: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
  };
  
  let cp1Totals = { total: 0, age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0 };
  let grandTotals = { age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0, grandTotal: 0 };
  let financialTotals = { totalOpenReserves: 0, totalLowEval: 0, totalHighEval: 0, noEvalCount: 0, noEvalReserves: 0 };
  
  // Type group claim counts for known totals
  const typeGroupCounts = new Map<string, number>();
  
  for (const row of rows) {
    // Skip header row or empty rows
    if (!row['Claim#'] || row['Claim#'] === 'Claim#') continue;
    
    const typeGroup = row['Type Group']?.trim() || 'Unknown';
    const days = parseInt(row['Days'] || '0', 10) || 0;
    const ageBucket = getAgeBucket(days);
    const coverage = row['Coverage']?.trim() || 'Unknown';
    
    // Parse financial data
    const reserves = parseCurrency(row['Open Reserves'] || '0');
    const lowEval = parseCurrency(row['Low'] || '0');
    const highEval = parseCurrency(row['High'] || '0');
    
    // CP1 detection - ANY flag
    const isCP1 = row['Overall CP1 Flag']?.toLowerCase() === 'yes' || 
                  row['CP1 Exposure Flag']?.toLowerCase() === 'yes' ||
                  row['CP1 Claim Flag']?.toLowerCase() === 'yes';
    
    const evalPhase = row['Evaluation Phase']?.trim() || '';
    const demandType = row['Demand Type']?.trim() || '(blank)';
    
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
    
    // Track type group counts
    typeGroupCounts.set(typeGroup, (typeGroupCounts.get(typeGroup) || 0) + 1);
    
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
  
  // Convert type group map to array
  const typeGroupSummaries: TypeGroupSummary[] = [];
  typeGroupMap.forEach((counts, typeGroup) => {
    typeGroupSummaries.push({ typeGroup, ...counts });
  });
  
  // Sort by grandTotal descending
  typeGroupSummaries.sort((a, b) => b.grandTotal - a.grandTotal);
  
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
  
  // Calculate CP1 totals
  const cp1TotalsCalc = {
    noCP: cp1CoverageArray.reduce((s, c) => s + c.noCP, 0),
    yes: cp1CoverageArray.reduce((s, c) => s + c.yes, 0),
    grandTotal: cp1CoverageArray.reduce((s, c) => s + c.total, 0),
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
      : '0.0'
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
  
  // Build known totals from actual data
  const knownTotals: KnownTotals = {
    totalOpenClaims: grandTotals.grandTotal,
    totalOpenExposures: grandTotals.grandTotal, // Same as claims from this data
    atr: { 
      claims: typeGroupCounts.get('ATR') || 0, 
      exposures: typeGroupCounts.get('ATR') || 0 
    },
    lit: { 
      claims: typeGroupCounts.get('LIT') || 0, 
      exposures: typeGroupCounts.get('LIT') || 0 
    },
    bi3: { 
      claims: typeGroupCounts.get('BI3') || 0, 
      exposures: typeGroupCounts.get('BI3') || 0 
    },
    earlyBI: { 
      claims: typeGroupCounts.get('Early BI') || typeGroupCounts.get('EBI') || 0, 
      exposures: typeGroupCounts.get('Early BI') || typeGroupCounts.get('EBI') || 0 
    },
    flagged: 0, // Not available in raw data
    newClaims: 0, // Not available in raw data
    closed: 0, // Not available in raw data
  };
  
  return {
    litPhases,
    typeGroupSummaries,
    cp1Data,
    totals: grandTotals,
    financials: {
      totalOpenReserves: financialTotals.totalOpenReserves,
      totalLowEval: financialTotals.totalLowEval,
      totalHighEval: financialTotals.totalHighEval,
      noEvalCount: financialTotals.noEvalCount,
      noEvalReserves: financialTotals.noEvalReserves,
      byAge,
      byTypeGroup,
    },
    knownTotals,
  };
}

// Parse the old summary format for delta comparison
function parseSummaryCSVTotals(csvText: string): { grandTotal: number; reserves: number } {
  const lines = csvText.split('\n');
  let grandTotal = 0;
  let reserves = 0;
  
  for (let i = lines.length - 1; i >= 0; i--) {
    const cols = lines[i].split(',');
    if (cols[0]?.trim() === 'Grand Total') {
      grandTotal = parseInt(cols[7]?.replace(/,/g, '') || '0', 10) || 0;
      break;
    }
  }
  
  return { grandTotal, reserves };
}

export function useOpenExposureData() {
  const [data, setData] = useState<OpenExposureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load current raw data (Jan 5)
        const currentRes = await fetch('/data/open-exposure-raw-jan5.csv');
        const currentCsv = await currentRes.text();
        
        // Load previous summary data (Jan 2) for delta calculation
        const prevRes = await fetch('/data/open-exposure-report-jan2.csv');
        const prevCsv = await prevRes.text();
        
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
          totalClaims: currentData.totals.grandTotal,
          totalReserves: currentData.financials.totalOpenReserves,
          totalLowEval: currentData.financials.totalLowEval,
          totalHighEval: currentData.financials.totalHighEval,
          cp1Rate: currentData.cp1Data.cp1Rate,
          cp1Claims: currentData.cp1Data.totals.yes,
          typeGroups: currentData.typeGroupSummaries.slice(0, 5).map(t => `${t.typeGroup}: ${t.grandTotal}`),
        });
        
        // Parse previous summary for delta
        const prevTotals = parseSummaryCSVTotals(prevCsv);
        
        // Calculate delta
        const delta = {
          previousTotal: prevTotals.grandTotal,
          currentTotal: currentData.totals.grandTotal,
          change: currentData.totals.grandTotal - prevTotals.grandTotal,
          changePercent: prevTotals.grandTotal > 0 
            ? ((currentData.totals.grandTotal - prevTotals.grandTotal) / prevTotals.grandTotal) * 100 
            : 0,
          reservesChange: 0,
          reservesChangePercent: 0,
          previousDate: 'Jan 2, 2026',
          currentDate: 'Jan 5, 2026'
        };
        
        setData({
          ...currentData,
          delta,
          dataDate: 'January 5, 2026'
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
