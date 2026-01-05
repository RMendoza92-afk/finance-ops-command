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
}

function parseNumber(val: string): number {
  if (!val || val.trim() === '' || val === '(blank)') return 0;
  return parseInt(val.replace(/,/g, ''), 10) || 0;
}

export function useOpenExposureData() {
  const [data, setData] = useState<OpenExposureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/open-exposure-report.csv')
      .then(res => res.text())
      .then(csvText => {
        const lines = csvText.split('\n');
        const litPhases: OpenExposurePhase[] = [];
        const typeGroupSummaries: TypeGroupSummary[] = [];
        let cp1Data: CP1Data | null = null;
        
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
          
          // Skip empty rows
          if (!typeGroup && !evalPhase && grandTotal === 0) continue;
          
          // LIT section
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
            // Continuation of LIT section
            if (evalPhase && !evalPhase.includes('Total') && currentPhase?.phase !== evalPhase) {
              // New phase
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
              // Phase total
              currentPhase.total365Plus = age365Plus;
              currentPhase.total181To365 = age181To365;
              currentPhase.total61To180 = age61To180;
              currentPhase.totalUnder60 = ageUnder60;
              currentPhase.grandTotal = grandTotal;
              
              // Parse CP1 data from Limits Tendered CP1 Total
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
                  }))
                };
              }
            } else if (!evalPhase && currentPhase) {
              // Demand type row
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
            // Type group summaries (ATR, BI3, etc.)
            typeGroupSummaries.push({
              typeGroup,
              age365Plus,
              age181To365,
              age61To180,
              ageUnder60,
              grandTotal
            });
          } else if (typeGroup === 'Grand Total') {
            setData({
              litPhases,
              typeGroupSummaries,
              cp1Data,
              totals: {
                age365Plus,
                age181To365,
                age61To180,
                ageUnder60,
                grandTotal
              }
            });
            break;
          }
        }
        
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}
