import { useState, useEffect } from 'react';
import Papa from 'papaparse';

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
  // Remove commas and parse
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

  useEffect(() => {
    async function loadData() {
      try {
        console.log('Fetching CSV data...');
        const response = await fetch('/data/litigation-data.csv');
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }
        const csvText = await response.text();
        console.log('CSV loaded, size:', csvText.length, 'bytes');
        
        Papa.parse<CSVRow>(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            // Include all records (both CWP and CWN)
            const allData = results.data.map((row, idx) => transformRow(row, idx));
            
            setData(allData);
            
            // Calculate stats
            const totalIndemnities = allData.reduce((sum, d) => sum + d.indemnitiesAmount, 0);
            const totalExpenses = allData.reduce((sum, d) => sum + d.totalAmount, 0);
            const totalNet = allData.reduce((sum, d) => sum + d.netAmount, 0);
            const cwpCount = allData.filter(d => d.cwpCwn === 'CWP').length;
            const cwnCount = allData.filter(d => d.cwpCwn === 'CWN').length;
            
            setStats({
              totalMatters: allData.length,
              totalIndemnities,
              totalExpenses,
              totalNet,
              cwpCount,
              cwnCount,
            });
            
            setLoading(false);
          },
          error: (err) => {
            setError(err.message);
            setLoading(false);
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return { data, loading, error, stats };
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