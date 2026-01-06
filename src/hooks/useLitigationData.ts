import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Papa from 'papaparse';

// Interface matching existing LitigationMatter for backward compatibility
export interface LitigationMatter {
  id: string;
  class: string;
  prefix: string;
  claim: string;
  claimant: string;
  coverage: string;
  uniqueRecord: string;
  expCategory: string;
  dept: string;
  team: string;
  adjusterUsername: string;
  adjusterName: string;
  creditedTeam: string;
  creditedAdj: string;
  paymentDate: string;
  indemnitiesAmount: number;
  indemnitiesCheckCount: number;
  expensesCheckCount: number;
  totalAmount: number;
  netAmount: number;
  cwpCwn: 'CWP' | 'CWN';
  startPainLvl: number;
  endPainLvl: number;
  transferDate: string;
  previousDept?: string;
  previousTeam?: string;
  previousAdjuster?: string;
}

interface CSVRow {
  Class: string;
  Prefix: string;
  Claim: string;
  Claimant: string;
  Coverage: string;
  'Unique Record': string;
  'EXP Category': string;
  Dept: string;
  Team: string;
  'Adjuster Username': string;
  'Adjuster Name': string;
  'CREDITED TEAM': string;
  'CREDITED ADJ': string;
  'Payment Date': string;
  'Indemnities Amount': string;
  'Indemnities Check Count': string;
  'Expenses Check Count': string;
  'Indemnities+Expenses Amts': string;
  'Feature Inception to Current Net Amt': string;
  'CWP/CWN': string;
  'Start Pain Lvl': string;
  'End Pain Lvl': string;
  'Transfer Date': string;
  'Previous Dept': string;
  'Previous Team': string;
  'Previous Adjuster Name': string;
}

function parseNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/,/g, '').replace(/[()]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function transformRow(row: CSVRow, index: number): LitigationMatter {
  return {
    id: row['Unique Record'] || `row-${index}`,
    class: row.Class || '',
    prefix: row.Prefix || '',
    claim: row.Claim || '',
    claimant: row.Claimant || '',
    coverage: row.Coverage || '',
    uniqueRecord: row['Unique Record'] || '',
    expCategory: row['EXP Category'] || '',
    dept: row.Dept || '',
    team: row.Team || '',
    adjusterUsername: row['Adjuster Username'] || '',
    adjusterName: row['Adjuster Name'] || '',
    creditedTeam: row['CREDITED TEAM'] || '',
    creditedAdj: row['CREDITED ADJ'] || '',
    paymentDate: row['Payment Date'] || '',
    indemnitiesAmount: parseNumber(row['Indemnities Amount']),
    indemnitiesCheckCount: parseNumber(row['Indemnities Check Count']),
    expensesCheckCount: parseNumber(row['Expenses Check Count']),
    totalAmount: parseNumber(row['Indemnities+Expenses Amts']),
    netAmount: parseNumber(row['Feature Inception to Current Net Amt']),
    cwpCwn: (row['CWP/CWN'] === 'CWP' ? 'CWP' : 'CWN') as 'CWP' | 'CWN',
    startPainLvl: parseNumber(row['Start Pain Lvl']),
    endPainLvl: parseNumber(row['End Pain Lvl']),
    transferDate: row['Transfer Date'] || '',
    previousDept: row['Previous Dept'] || undefined,
    previousTeam: row['Previous Team'] || undefined,
    previousAdjuster: row['Previous Adjuster Name'] || undefined,
  };
}

// Transform database row to LitigationMatter
function transformDBRow(row: any): LitigationMatter {
  // Parse pain level - could be "5", "0-3", etc.
  const painLevel = row.pain_levels?.pain_level || '0';
  const painNum = parseFloat(String(painLevel).split('-')[0]) || 0;

  // Use resolution_date as the closest proxy for "payment date" / closure timing in DB mode.
  // (CSV mode has an explicit Payment Date column.)
  const paymentDate = row.resolution_date || '';

  // Map DB status + indemnities to a CWP/CWN approximation.
  const isClosed = String(row.status || '').toLowerCase() === 'closed';
  const hasPayment = (Number(row.indemnities_amount) || 0) > 0;
  const cwpCwn: 'CWP' | 'CWN' = isClosed && hasPayment ? 'CWP' : 'CWN';

  return {
    id: row.id,
    class: row.class || '',
    prefix: '',
    claim: row.matter_id || '',
    claimant: row.claimant || '',
    coverage: '',
    uniqueRecord: row.matter_id || '',
    expCategory: row.type || '',
    dept: row.department || '',
    team: row.team || '',
    adjusterUsername: '',
    adjusterName: row.matter_lead || '',
    creditedTeam: row.team || '',
    creditedAdj: row.matter_lead || '',
    paymentDate,
    indemnitiesAmount: Number(row.indemnities_amount) || 0,
    indemnitiesCheckCount: 0,
    expensesCheckCount: 0,
    totalAmount: Number(row.total_amount) || 0,
    netAmount: Number(row.total_amount) || 0,
    cwpCwn,
    startPainLvl: painNum,
    endPainLvl: painNum,
    transferDate: '',
    previousDept: undefined,
    previousTeam: undefined,
    previousAdjuster: undefined,
  };
}

// Multi-pack claim grouping for closed matters
export interface ClosedMultiPackGroup {
  baseClaimNumber: string;
  packSize: number;
  claims: {
    claim: string;
    claimant: string;
    coverage: string;
    team: string;
    totalAmount: number;
    indemnitiesAmount: number;
  }[];
  totalPaid: number;
  totalIndemnities: number;
}

export interface ClosedMultiPackSummary {
  totalMultiPackGroups: number;
  totalClaimsInPacks: number;
  byPackSize: {
    packSize: number;
    groupCount: number;
    claimCount: number;
    totalPaid: number;
  }[];
  groups: ClosedMultiPackGroup[];
}

export function useLitigationData() {
  const [data, setData] = useState<LitigationMatter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalMatters: 0,
    totalIndemnities: 0,
    totalExpenses: 0,
    totalNet: 0,
    cwpCount: 0,
    cwnCount: 0,
  });
  const [multiPackData, setMultiPackData] = useState<ClosedMultiPackSummary | null>(null);
  const [dataSource, setDataSource] = useState<'database' | 'csv'>('database');

  const calculateStats = (allData: LitigationMatter[]) => {
    const totalIndemnities = allData.reduce((sum, d) => sum + d.indemnitiesAmount, 0);
    const totalExpenses = allData.reduce((sum, d) => sum + d.totalAmount, 0);
    const totalNet = allData.reduce((sum, d) => sum + d.netAmount, 0);
    const cwpCount = allData.filter(d => d.cwpCwn === 'CWP').length;
    const cwnCount = allData.filter(d => d.cwpCwn === 'CWN').length;
    
    return {
      totalMatters: allData.length,
      totalIndemnities,
      totalExpenses,
      totalNet,
      cwpCount,
      cwnCount,
    };
  };

  const calculateMultiPack = (allData: LitigationMatter[]): ClosedMultiPackSummary => {
    // Group claims by base claim = everything except last 2 digits (exposure number)
    // e.g., "39-0000430132" -> base "39-00004301", exposure "32"
    const claimBaseMap = new Map<string, LitigationMatter[]>();
    
    const extractBaseClaim = (claimNum: string): string => {
      if (claimNum.length < 4) return claimNum;
      return claimNum.slice(0, -2);
    };
    
    for (const matter of allData) {
      const claimNum = matter.claim || matter.uniqueRecord || '';
      if (claimNum.length < 8) continue;
      const base = extractBaseClaim(claimNum);
      if (!claimBaseMap.has(base)) {
        claimBaseMap.set(base, []);
      }
      claimBaseMap.get(base)!.push(matter);
    }
    
    // Build multi-pack groups (2+ claims per base)
    const groups: ClosedMultiPackGroup[] = [];
    
    claimBaseMap.forEach((claims, base) => {
      if (claims.length >= 2) {
        groups.push({
          baseClaimNumber: base,
          packSize: claims.length,
          claims: claims.map(c => ({
            claim: c.claim,
            claimant: c.claimant,
            coverage: c.coverage || c.expCategory,
            team: c.team,
            totalAmount: c.totalAmount,
            indemnitiesAmount: c.indemnitiesAmount,
          })),
          totalPaid: claims.reduce((s, c) => s + c.totalAmount, 0),
          totalIndemnities: claims.reduce((s, c) => s + c.indemnitiesAmount, 0),
        });
      }
    });
    
    // Sort by pack size then by total paid
    groups.sort((a, b) => b.packSize - a.packSize || b.totalPaid - a.totalPaid);
    
    // Build by-pack-size summary
    const packSizeMap = new Map<number, { groupCount: number; claimCount: number; totalPaid: number }>();
    for (const g of groups) {
      if (!packSizeMap.has(g.packSize)) {
        packSizeMap.set(g.packSize, { groupCount: 0, claimCount: 0, totalPaid: 0 });
      }
      const ps = packSizeMap.get(g.packSize)!;
      ps.groupCount++;
      ps.claimCount += g.packSize;
      ps.totalPaid += g.totalPaid;
    }
    
    const byPackSize = Array.from(packSizeMap.entries())
      .map(([packSize, data]) => ({ packSize, ...data }))
      .sort((a, b) => a.packSize - b.packSize);
    
    return {
      totalMultiPackGroups: groups.length,
      totalClaimsInPacks: groups.reduce((s, g) => s + g.packSize, 0),
      byPackSize,
      groups,
    };
  };

  const loadFromDatabase = async (): Promise<LitigationMatter[]> => {
    console.log('Fetching litigation data from database...');
    
    const { data: matters, error: fetchError } = await supabase
      .from('litigation_matters')
      .select(`
        *,
        pain_levels (pain_level)
      `)
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;
    
    return (matters || []).map(transformDBRow);
  };

  const loadFromCSV = async (): Promise<LitigationMatter[]> => {
    console.log('Fetching CSV data as fallback...');
    const response = await fetch('/data/litigation-data.csv');
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse<CSVRow>(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const allData = results.data.map((row, idx) => transformRow(row, idx));
          resolve(allData);
        },
        error: (err) => reject(err)
      });
    });
  };

  const refetch = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try database first
      const dbData = await loadFromDatabase();
      
      if (dbData.length > 0) {
        console.log('Loaded', dbData.length, 'matters from database');
        setData(dbData);
        setStats(calculateStats(dbData));
        setMultiPackData(calculateMultiPack(dbData));
        setDataSource('database');
      } else {
        // Fall back to CSV if database is empty
        console.log('Database empty, falling back to CSV');
        const csvData = await loadFromCSV();
        console.log('Loaded', csvData.length, 'matters from CSV');
        setData(csvData);
        setStats(calculateStats(csvData));
        setMultiPackData(calculateMultiPack(csvData));
        setDataSource('csv');
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Database error, trying CSV fallback:', err);
      
      // Try CSV as fallback
      try {
        const csvData = await loadFromCSV();
        console.log('Loaded', csvData.length, 'matters from CSV (fallback)');
        setData(csvData);
        setStats(calculateStats(csvData));
        setMultiPackData(calculateMultiPack(csvData));
        setDataSource('csv');
        setLoading(false);
      } catch (csvErr) {
        setError(csvErr instanceof Error ? csvErr.message : 'Failed to load data');
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  return { data, loading, error, stats, multiPackData, refetch, dataSource };
}

// Get unique values for filters
export function getFilterOptions(data: LitigationMatter[]) {
  return {
    classes: [...new Set(data.map(d => d.class))].filter(Boolean).sort(),
    depts: [...new Set(data.map(d => d.dept))].filter(Boolean).sort(),
    teams: [...new Set(data.map(d => d.team))].filter(Boolean).sort(),
    adjusters: [...new Set(data.map(d => d.adjusterName))].filter(Boolean).sort(),
    expCategories: [...new Set(data.map(d => d.expCategory))].filter(Boolean).sort(),
  };
}
