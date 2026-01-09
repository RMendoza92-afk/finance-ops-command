// Monthly Claim Indemnity & Expenses Report - January 2026
// Source: FLI Operations Report 01-JAN-2026

export interface CoverageSpend {
  coverage: string;
  costs: number;
  checkCount: number;
  average: number;
}

export interface MonthlySpendData {
  period: string;
  periodDate: string;
  indemnities: {
    byCoverage: CoverageSpend[];
    total: number;
    totalChecks: number;
  };
  expenses: {
    byCoverage: CoverageSpend[];
    total: number;
    totalChecks: number;
  };
}

// January 2026 Data from Operations Report
export const monthlySpendJan2026: MonthlySpendData = {
  period: '01-JAN 2026',
  periodDate: '2026-01-01',
  indemnities: {
    byCoverage: [
      { coverage: '', costs: 100.00, checkCount: 1, average: 100.00 },
      { coverage: 'BI', costs: 5421500.48, checkCount: 779, average: 6959.56 },
      { coverage: 'CL', costs: 1535162.34, checkCount: 281, average: 5463.21 },
      { coverage: 'MP', costs: 5000.00, checkCount: 2, average: 2500.00 },
      { coverage: 'OC', costs: 318061.42, checkCount: 69, average: 4609.59 },
      { coverage: 'PD', costs: 2415290.11, checkCount: 1022, average: 2363.30 },
      { coverage: 'PP', costs: 5000.00, checkCount: 2, average: 2500.00 },
      { coverage: 'RN', costs: 11145.52, checkCount: 30, average: 371.52 },
      { coverage: 'TL', costs: 588.95, checkCount: 12, average: 49.08 },
      { coverage: 'UI', costs: 30000.00, checkCount: 1, average: 30000.00 },
      { coverage: 'UM', costs: 85220.00, checkCount: 8, average: 10652.50 },
      { coverage: 'UP', costs: 8866.14, checkCount: 7, average: 1266.59 },
    ],
    total: 9835934.96,
    totalChecks: 2214,
  },
  expenses: {
    byCoverage: [
      { coverage: 'BI', costs: 213683.75, checkCount: 144, average: 1483.91 },
      { coverage: 'CL', costs: 23276.96, checkCount: 26, average: 895.27 },
      { coverage: 'OC', costs: 1804.49, checkCount: 4, average: 451.12 },
      { coverage: 'PD', costs: 29631.28, checkCount: 46, average: 644.16 },
      { coverage: 'UM', costs: 472.90, checkCount: 2, average: 236.45 },
    ],
    total: 268869.38,
    totalChecks: 222,
  },
};

// Helper to get current monthly data
export const getCurrentMonthlySpend = (): MonthlySpendData => monthlySpendJan2026;

// Coverage display names
export const coverageNames: Record<string, string> = {
  'BI': 'Bodily Injury',
  'CL': 'Collision',
  'MP': 'Medical Payments',
  'OC': 'Other Coverage',
  'PD': 'Property Damage',
  'PP': 'Personal Property',
  'RN': 'Rental',
  'TL': 'Total Loss',
  'UI': 'Uninsured',
  'UM': 'Underinsured Motorist',
  'UP': 'Underinsured Property',
  '': 'Unclassified',
};

// Format helpers
export const formatSpendCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
};

export const formatSpendCurrencyFull = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};
