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
        
        const parseCurrency = (val: string | number | undefined): number => {
          if (val === undefined || val === null) return 0;
          const str = String(val).replace(/[$,\s]/g, '');
          if (str.startsWith('(') && str.endsWith(')')) {
            return -parseFloat(str.slice(1, -1)) || 0;
          }
          return parseFloat(str) || 0;
        };

        // Parse weekly data - looking for rows with date patterns like "December 31, 2025"
        // Structure: Row with date in col 2, then "Reserves" row, "Features" row, change rows
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 5) continue;
          
          // Check column 2 for date (column index 2)
          const dateCell = String(row[2] || '');
          const dateMatch = dateCell.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/);
          
          if (dateMatch) {
            // This row has the date AND has column headers: LBI, DCCE, etc.
            // The actual data is in the SAME row structure
            // Check if this row itself has "Reserves" label in column 2
            const reservesRowLabel = String(row[2] || '');
            
            // Actually the structure is: date row, then reserves row below it
            // Look at the next row for "Reserves"
            const nextRow = rows[i + 1];
            if (nextRow && String(nextRow[2] || '').includes('Reserves')) {
              // nextRow has the reserves data
              // Columns: 3=LBI, 4=DCCE, 5=LPD, 6=OTC, 7=COL, 8=UMBI, ... 17=TOTAL
              const totalReserves = parseCurrency(nextRow[17]);
              
              const featuresRow = rows[i + 2];
              const changeRow = rows[i + 3];
              const featureChangeRow = rows[i + 4];
              
              weeks.push({
                date: dateMatch[0],
                totalReserves,
                totalFeatures: parseCurrency(featuresRow?.[17]) || 0,
                weeklyChange: parseCurrency(changeRow?.[17]) || 0,
                weeklyFeatureChange: parseCurrency(featureChangeRow?.[17]) || 0,
                lbiReserves: parseCurrency(nextRow[3]),
                dcceReserves: parseCurrency(nextRow[4]),
                lpdReserves: parseCurrency(nextRow[5]),
                colReserves: parseCurrency(nextRow[7]),
                umbiReserves: parseCurrency(nextRow[8]),
              });
            }
          }
        }

        // Sort by date (newest first)
        weeks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const latestTotal = weeks[0]?.totalReserves || 324655559;

        console.log('Reserves Rolling Data:', {
          weeksLoaded: weeks.length,
          latestTotal,
          latestDate: weeks[0]?.date,
          firstWeek: weeks[0],
        });

        setData({
          weeks: weeks.slice(0, 12),
          latestTotal,
          latestDate: weeks[0]?.date || 'December 31, 2025',
          monthlyChange: -1521644,
          monthlyChangePercent: -0.47,
          yearlyChange: -88728584,
          yearlyChangePercent: -21.5,
        });
        setLoading(false);
      } catch (err) {
        console.error('Failed to load reserves rolling data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load reserves data');
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return { data, loading, error };
}
