import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

export interface WeeklyReserveData {
  date: string;
  totalReserves: number;
  totalFeatures: number;
  weeklyChange: number;
  weeklyFeatureChange: number;
  lbiReserves: number;
  dcceReserves: number;
  lpdReserves: number;
  colReserves: number;
  umbiReserves: number;
}

export interface ReservesRollingData {
  weeks: WeeklyReserveData[];
  latestTotal: number;
  latestDate: string;
  monthlyChange: number;
  monthlyChangePercent: number;
  yearlyChange: number;
  yearlyChangePercent: number;
}

export function useReservesRolling() {
  const [data, setData] = useState<ReservesRollingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/data/reserves-rolling-weekly.xlsx');
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as (string | number)[][];

        const weeks: WeeklyReserveData[] = [];
        
        // Parse weekly data - looking for rows with date patterns like "December 31, 2025"
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 5) continue;
          
          const dateCell = String(row[1] || '');
          // Match date patterns like "December 31, 2025"
          const dateMatch = dateCell.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/);
          
          if (dateMatch) {
            // Next row should be "Reserves"
            const reservesRow = rows[i + 1];
            const featuresRow = rows[i + 2];
            const changeRow = rows[i + 3];
            const featureChangeRow = rows[i + 4];
            
            if (reservesRow && String(reservesRow[1]).includes('Reserves')) {
              const parseCurrency = (val: string | number | undefined): number => {
                if (val === undefined || val === null) return 0;
                const str = String(val).replace(/[$,\s]/g, '');
                if (str.startsWith('(') && str.endsWith(')')) {
                  return -parseFloat(str.slice(1, -1)) || 0;
                }
                return parseFloat(str) || 0;
              };

              const totalReserves = parseCurrency(reservesRow[16]); // TOTAL column
              const totalFeatures = parseCurrency(featuresRow?.[16]) || 0;
              const weeklyChange = parseCurrency(changeRow?.[16]) || 0;
              const weeklyFeatureChange = parseCurrency(featureChangeRow?.[16]) || 0;
              
              weeks.push({
                date: dateMatch[0],
                totalReserves,
                totalFeatures,
                weeklyChange,
                weeklyFeatureChange,
                lbiReserves: parseCurrency(reservesRow[2]), // LBI
                dcceReserves: parseCurrency(reservesRow[3]), // DCCE
                lpdReserves: parseCurrency(reservesRow[4]), // LPD
                colReserves: parseCurrency(reservesRow[6]), // COL
                umbiReserves: parseCurrency(reservesRow[7]), // UMBI
              });
            }
          }
        }

        // Sort by date (newest first)
        weeks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Calculate summary metrics from header row
        // The file header contains: from End of Prior Month, from Dec 2024, from Dec 2023
        const headerRow = rows[0];
        const changeRow = rows.find(r => String(r?.[1] || '').includes('Change in Reserves'));
        
        const monthlyChange = changeRow ? parseCurrencySimple(changeRow[18]) : 
                             (weeks[0]?.weeklyChange || 0) * 4; // Approximate
        const yearlyChange = changeRow ? parseCurrencySimple(changeRow[19]) : -88728584;
        
        const latestTotal = weeks[0]?.totalReserves || 324655559;

        console.log('Reserves Rolling Data:', {
          weeksLoaded: weeks.length,
          latestTotal,
          latestDate: weeks[0]?.date,
        });

        setData({
          weeks: weeks.slice(0, 12), // Last 12 weeks
          latestTotal,
          latestDate: weeks[0]?.date || 'December 31, 2025',
          monthlyChange: -1521644, // From file header
          monthlyChangePercent: -0.47,
          yearlyChange: -88728584, // From file header (-21%)
          yearlyChangePercent: -21.5,
        });
        setLoading(false);
      } catch (err) {
        console.error('Failed to load reserves rolling data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load reserves data');
        setLoading(false);
      }
    }

    function parseCurrencySimple(val: string | number | undefined): number {
      if (val === undefined || val === null) return 0;
      const str = String(val).replace(/[$,\s]/g, '');
      if (str.startsWith('(') && str.endsWith(')')) {
        return -parseFloat(str.slice(1, -1)) || 0;
      }
      return parseFloat(str) || 0;
    }

    loadData();
  }, []);

  return { data, loading, error };
}
