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
  // Detailed breakdown by coverage type
  byCoverage: {
    coverage: string;
    count: number;
    reserves: number;
  }[];
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
  // Delta from previous period
  delta?: {
    previousTotal: number;
    currentTotal: number;
    change: number;
    changePercent: number;
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
  'CP1 Exposure Flag': string;
  'CP1 Claim Flag': string;
  'Overall CP1 Flag': string;
  'Exposure Category': string;
  [key: string]: string;
}

function parseNumber(val: string): number {
  if (!val || val.trim() === '' || val === '(blank)') return 0;
  return parseInt(val.replace(/,/g, ''), 10) || 0;
}

function parseReserves(val: string): number {
  if (!val || val.trim() === '') return 0;
  // Remove $ and commas, handle parentheses for negatives
  const cleaned = val.replace(/[$,]/g, '').trim();
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

// Parse the old summary format
function parseSummaryCSV(csvText: string): { totals: OpenExposureData['totals']; litPhases: OpenExposurePhase[]; typeGroupSummaries: TypeGroupSummary[]; cp1Data: CP1Data | null } {
  const lines = csvText.split('\n');
  const litPhases: OpenExposurePhase[] = [];
  const typeGroupSummaries: TypeGroupSummary[] = [];
  let cp1Data: CP1Data | null = null;
  let totals = { age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0, grandTotal: 0 };
  
  let currentPhase: OpenExposurePhase | null = null;
  let inLitSection = false;
  
  for (let i = 4; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 8) continue;
    
    const typeGroup = cols[0]?.trim();
    const evalPhase = cols[1]?.trim();
    const demandType = cols[2]?.trim() || '(blank)';
    const age365Plus = parseNumber(cols[3]);
    const age181To365 = parseNumber(cols[4]);
    const age61To180 = parseNumber(cols[5]);
    const ageUnder60 = parseNumber(cols[6]);
    const grandTotal = parseNumber(cols[7]);
    
    if (!typeGroup && !evalPhase && grandTotal === 0) continue;
    
    if (typeGroup === 'LIT') {
      inLitSection = true;
      if (evalPhase && !evalPhase.includes('Total')) {
        currentPhase = {
          phase: evalPhase,
          demandTypes: [],
          total365Plus: 0,
          total181To365: 0,
          total61To180: 0,
          totalUnder60: 0,
          grandTotal: 0
        };
        currentPhase.demandTypes.push({
          type: demandType,
          age365Plus,
          age181To365,
          age61To180,
          ageUnder60,
          total: grandTotal
        });
        litPhases.push(currentPhase);
      }
    } else if (typeGroup === '' && inLitSection) {
      if (evalPhase && !evalPhase.includes('Total') && currentPhase?.phase !== evalPhase) {
        currentPhase = {
          phase: evalPhase,
          demandTypes: [],
          total365Plus: 0,
          total181To365: 0,
          total61To180: 0,
          totalUnder60: 0,
          grandTotal: 0
        };
        currentPhase.demandTypes.push({
          type: demandType,
          age365Plus,
          age181To365,
          age61To180,
          ageUnder60,
          total: grandTotal
        });
        litPhases.push(currentPhase);
      } else if (evalPhase && evalPhase.includes('Total') && currentPhase) {
        currentPhase.total365Plus = age365Plus;
        currentPhase.total181To365 = age181To365;
        currentPhase.total61To180 = age61To180;
        currentPhase.totalUnder60 = ageUnder60;
        currentPhase.grandTotal = grandTotal;
        
        if (evalPhase === 'Limits Tendered CP1 Total') {
          cp1Data = {
            total: grandTotal,
            age365Plus,
            age181To365,
            age61To180,
            ageUnder60,
            demandTypes: currentPhase.demandTypes.map(dt => ({
              type: dt.type,
              count: dt.total
            })),
            byCoverage: []
          };
        }
      } else if (!evalPhase && currentPhase) {
        currentPhase.demandTypes.push({
          type: demandType,
          age365Plus,
          age181To365,
          age61To180,
          ageUnder60,
          total: grandTotal
        });
      }
    } else if (typeGroup === 'LIT Total') {
      inLitSection = false;
    } else if (typeGroup && typeGroup !== 'Grand Total' && !typeGroup.includes('Total')) {
      typeGroupSummaries.push({
        typeGroup,
        age365Plus,
        age181To365,
        age61To180,
        ageUnder60,
        grandTotal
      });
    } else if (typeGroup === 'Grand Total') {
      totals = { age365Plus, age181To365, age61To180, ageUnder60, grandTotal };
      break;
    }
  }
  
  return { totals, litPhases, typeGroupSummaries, cp1Data };
}

// Process raw claims data into summary format
function processRawClaims(rows: RawClaimRow[]): OpenExposureData {
  const phaseMap = new Map<string, Map<string, { age365Plus: number; age181To365: number; age61To180: number; ageUnder60: number; total: number }>>();
  const typeGroupMap = new Map<string, { age365Plus: number; age181To365: number; age61To180: number; ageUnder60: number; grandTotal: number }>();
  const cp1Map = new Map<string, { count: number; reserves: number }>();
  
  let cp1Totals = { total: 0, age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0 };
  let grandTotals = { age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0, grandTotal: 0 };
  
  for (const row of rows) {
    const typeGroup = row['Type Group']?.trim() || 'Unknown';
    const days = parseInt(row['Days'] || row['Age'] || '0', 10) || 0;
    const ageBucket = getAgeBucket(days);
    const reserves = parseReserves(row['Open Reserves'] || row['BI Reserves'] || '0');
    const isCP1 = row['Overall CP1 Flag']?.toLowerCase() === 'yes' || 
                  row['CP1 Exposure Flag']?.toLowerCase() === 'yes' ||
                  row['CP1 Claim Flag']?.toLowerCase() === 'yes';
    const coverage = row['Coverage']?.trim() || 'Unknown';
    const exposureCategory = row['Exposure Category']?.trim() || 'Unknown';
    
    // Update grand totals
    grandTotals[ageBucket]++;
    grandTotals.grandTotal++;
    
    // Update type group summaries
    if (!typeGroupMap.has(typeGroup)) {
      typeGroupMap.set(typeGroup, { age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0, grandTotal: 0 });
    }
    const tg = typeGroupMap.get(typeGroup)!;
    tg[ageBucket]++;
    tg.grandTotal++;
    
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
    if (typeGroup === 'LIT') {
      const phase = exposureCategory || 'Unknown';
      if (!phaseMap.has(phase)) {
        phaseMap.set(phase, new Map());
      }
      const demandMap = phaseMap.get(phase)!;
      const demandType = row['Demand Type']?.trim() || '(blank)';
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
  
  return {
    litPhases,
    typeGroupSummaries,
    cp1Data,
    totals: grandTotals
  };
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
        
        const currentData = processRawClaims(parsed.data);
        
        // Parse previous summary for delta
        const prevData = parseSummaryCSV(prevCsv);
        
        // Calculate delta
        const delta = {
          previousTotal: prevData.totals.grandTotal,
          currentTotal: currentData.totals.grandTotal,
          change: currentData.totals.grandTotal - prevData.totals.grandTotal,
          changePercent: prevData.totals.grandTotal > 0 
            ? ((currentData.totals.grandTotal - prevData.totals.grandTotal) / prevData.totals.grandTotal) * 100 
            : 0,
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
