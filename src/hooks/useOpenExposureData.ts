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
    reserves: number;
  }[];
}

export interface FinancialsByAge {
  age: string;
  claims: number;
  openReserves: number;
  lowEval: number;
  highEval: number;
}

export interface OpenExposureData {
  litPhases: OpenExposurePhase[];
  typeGroupSummaries: TypeGroupSummary[];
  cp1Data: CP1Data | null;
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
    byAge: FinancialsByAge[];
    byTypeGroup: {
      typeGroup: string;
      reserves: number;
    }[];
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

function parseNumber(val: string): number {
  if (!val || val.trim() === '' || val === '(blank)') return 0;
  return parseInt(val.replace(/,/g, ''), 10) || 0;
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

// Process raw claims data
function processRawClaims(rows: RawClaimRow[]): OpenExposureData {
  const phaseMap = new Map<string, Map<string, { age365Plus: number; age181To365: number; age61To180: number; ageUnder60: number; total: number }>>();
  const typeGroupMap = new Map<string, { 
    age365Plus: number; age181To365: number; age61To180: number; ageUnder60: number; 
    grandTotal: number; reserves: number; lowEval: number; highEval: number 
  }>();
  const cp1Map = new Map<string, { count: number; reserves: number }>();
  
  // Financial aggregation by age bucket
  const ageFinancials = {
    age365Plus: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
    age181To365: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
    age61To180: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
    ageUnder60: { claims: 0, reserves: 0, lowEval: 0, highEval: 0 },
  };
  
  let cp1Totals = { total: 0, age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0 };
  let grandTotals = { age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0, grandTotal: 0 };
  let financialTotals = { totalOpenReserves: 0, totalLowEval: 0, totalHighEval: 0, noEvalCount: 0 };
  
  for (const row of rows) {
    // Skip header row or empty rows
    if (!row['Claim#'] || row['Claim#'] === 'Claim#') continue;
    
    const typeGroup = row['Type Group']?.trim() || 'Unknown';
    const days = parseInt(row['Days'] || '0', 10) || 0;
    const ageBucket = getAgeBucket(days);
    
    // Parse financial data
    const reserves = parseCurrency(row['Open Reserves'] || '0');
    const lowEval = parseCurrency(row['Low'] || '0');
    const highEval = parseCurrency(row['High'] || '0');
    
    const isCP1 = row['Overall CP1 Flag']?.toLowerCase() === 'yes' || 
                  row['CP1 Exposure Flag']?.toLowerCase() === 'yes' ||
                  row['CP1 Claim Flag']?.toLowerCase() === 'yes';
    const coverage = row['Coverage']?.trim() || 'Unknown';
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
    
    // Track CP1 data
    if (isCP1) {
      cp1Totals.total++;
      cp1Totals[ageBucket]++;
      
      if (!cp1Map.has(coverage)) {
        cp1Map.set(coverage, { count: 0, reserves: 0 });
      }
      const cp1Entry = cp1Map.get(coverage)!;
      cp1Entry.count++;
      cp1Entry.reserves += reserves;
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
  
  // Build CP1 data
  const cp1ByCoverage: CP1Data['byCoverage'] = [];
  cp1Map.forEach((data, coverage) => {
    cp1ByCoverage.push({ coverage, ...data });
  });
  cp1ByCoverage.sort((a, b) => b.count - a.count);
  
  const cp1Data: CP1Data = {
    ...cp1Totals,
    demandTypes: cp1ByCoverage.slice(0, 10).map(c => ({ type: c.coverage, count: c.count })),
    byCoverage: cp1ByCoverage
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
  
  return {
    litPhases,
    typeGroupSummaries,
    cp1Data,
    totals: grandTotals,
    financials: {
      ...financialTotals,
      byAge,
      byTypeGroup,
    }
  };
}

// Parse the old summary format for delta comparison
function parseSummaryCSVTotals(csvText: string): { grandTotal: number } {
  const lines = csvText.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const cols = lines[i].split(',');
    if (cols[0]?.trim() === 'Grand Total') {
      return { grandTotal: parseNumber(cols[7]) };
    }
  }
  return { grandTotal: 0 };
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
          console.log('Sample Low value:', firstRow['Low']);
          console.log('Sample High value:', firstRow['High']);
          console.log('Sample Type Group:', firstRow['Type Group']);
          console.log('Sample Days:', firstRow['Days']);
        }
        
        const currentData = processRawClaims(parsed.data);
        
        console.log('Processed financials:', {
          totalReserves: currentData.financials.totalOpenReserves,
          totalLowEval: currentData.financials.totalLowEval,
          totalHighEval: currentData.financials.totalHighEval,
          claimCount: currentData.totals.grandTotal,
          byAge: currentData.financials.byAge,
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
          reservesChange: 0, // We don't have previous reserves in summary format
          reservesChangePercent: 0,
          previousDate: 'Jan 2, 2026',
          currentDate: 'Jan 5, 2026'
        };
        
        setData({
          ...currentData,
          delta
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
