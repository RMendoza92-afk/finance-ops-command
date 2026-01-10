import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import Papa from 'papaparse';

// Raw row interface matching the CSV structure
export interface RawClaimRow {
  'Status': string;
  'Claim#': string;
  'Claimant': string;
  'Coverage': string;
  'Days'?: string;
  'Open/Closed Days'?: string;
  'Open/Closed Days '?: string;
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

interface OpenExposureContextValue {
  rawRows: RawClaimRow[];
  loading: boolean;
  error: string | null;
}

const OpenExposureContext = createContext<OpenExposureContextValue | null>(null);

// Cache at module level to persist across re-renders
let cachedRows: RawClaimRow[] | null = null;
let loadingPromise: Promise<RawClaimRow[]> | null = null;

async function loadCsvData(): Promise<RawClaimRow[]> {
  // Return cached data if available
  if (cachedRows !== null) {
    return cachedRows;
  }
  
  // Deduplicate concurrent requests
  if (loadingPromise !== null) {
    return loadingPromise;
  }
  
  loadingPromise = (async () => {
    const response = await fetch('/data/open-exposure-raw-jan8.csv?d=2026-01-08');
    const csvText = await response.text();
    
    const parsed = Papa.parse<RawClaimRow>(csvText, {
      header: true,
      skipEmptyLines: true
    });
    
    if (parsed.errors.length > 0) {
      console.warn('CSV parsing warnings:', parsed.errors.slice(0, 3));
    }
    
    console.log(`[OpenExposureContext] Parsed ${parsed.data.length} rows (single load)`);
    cachedRows = parsed.data;
    return parsed.data;
  })();
  
  return loadingPromise;
}

export function OpenExposureProvider({ children }: { children: ReactNode }) {
  const [rawRows, setRawRows] = useState<RawClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCsvData()
      .then((rows) => {
        setRawRows(rows);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[OpenExposureContext] Failed to load CSV:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const value = useMemo(() => ({ rawRows, loading, error }), [rawRows, loading, error]);

  return (
    <OpenExposureContext.Provider value={value}>
      {children}
    </OpenExposureContext.Provider>
  );
}

export function useSharedOpenExposureRows(): OpenExposureContextValue {
  const context = useContext(OpenExposureContext);
  if (!context) {
    throw new Error('useSharedOpenExposureRows must be used within OpenExposureProvider');
  }
  return context;
}
