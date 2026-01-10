import React, { createContext, useContext, useMemo, ReactNode } from "react";
import { useOpenExposureData } from "@/hooks/useOpenExposureData";
import { useCP1AnalysisCsv, CP1CsvAnalysis } from "@/hooks/useCP1AnalysisCsv";
import { useCheckHistory, SpendSummary } from "@/hooks/useCheckHistory";
import { useDecisionsPending } from "@/hooks/useDecisionsPending";

// Unified operations data that flows to Executive tab
export interface OperationsMetrics {
  // Inventory metrics
  totalOpenClaims: number;
  totalReserves: number;
  totalLowEval: number;
  totalHighEval: number;
  noEvalCount: number;
  noEvalReserves: number;
  
  // Age breakdown
  aged365Plus: number;
  aged365Reserves: number;
  aged181to365: number;
  aged181Reserves: number;
  aged61to180: number;
  agedUnder60: number;
  
  // CP1 metrics (from Operations)
  cp1Count: number;
  cp1Rate: string;
  biCP1Rate: string;
  cp1TotalReserves: number;
  cp1Fatalities: number;
  cp1Surgeries: number;
  cp1Hospitalizations: number;
  cp1TotalFlags: number;
  cp1WeekOverWeek: {
    claimsDelta: number;
    rateDelta: number;
    highRiskDelta: number;
    aged365Delta: number;
    hasValidPrior: boolean;
    priorDate: string | null;
  } | null;
  
  // Spend metrics (from check history)
  totalSpend: number;
  indemnitySpend: number;
  expenseSpend: number;
  litigationSpend: number;
  biSpend: number;
  checkCount: number;
  spendByDept: Map<string, { gross: number; net: number; count: number }>;
  spendByTeam: Map<string, { gross: number; net: number; count: number }>;
  
  // Decisions pending
  decisionsCount: number;
  decisionsReserves: number;
  
  // Type group data
  litCount: number;
  typeGroupData: { typeGroup: string; grandTotal: number; reserves: number }[];
  
  // Data freshness
  dataDate: string;
  isLoading: boolean;
  hasError: boolean;
}

interface OperationsDataContextValue {
  metrics: OperationsMetrics;
  cp1Analysis: CP1CsvAnalysis | null;
  spendSummary: SpendSummary | null;
  refetch: () => void;
}

const OperationsDataContext = createContext<OperationsDataContextValue | null>(null);

export function OperationsDataProvider({ children }: { children: ReactNode }) {
  const { data: exposureData, loading: exposureLoading, error: exposureError } = useOpenExposureData();
  const { data: cp1Data, loading: cp1Loading, error: cp1Error } = useCP1AnalysisCsv();
  const { summary: spendSummary, litigationSpend, biSpend, loading: spendLoading, error: spendError } = useCheckHistory();
  const { data: decisionsData } = useDecisionsPending();

  const metrics = useMemo((): OperationsMetrics => {
    const isLoading = exposureLoading || cp1Loading || spendLoading;
    const hasError = !!(exposureError || cp1Error || spendError);

    // Default values when data not loaded
    if (!exposureData) {
      return {
        totalOpenClaims: 0,
        totalReserves: 0,
        totalLowEval: 0,
        totalHighEval: 0,
        noEvalCount: 0,
        noEvalReserves: 0,
        aged365Plus: 0,
        aged365Reserves: 0,
        aged181to365: 0,
        aged181Reserves: 0,
        aged61to180: 0,
        agedUnder60: 0,
        cp1Count: 0,
        cp1Rate: "0.0%",
        biCP1Rate: "0.0%",
        cp1TotalReserves: 0,
        cp1Fatalities: 0,
        cp1Surgeries: 0,
        cp1Hospitalizations: 0,
        cp1TotalFlags: 0,
        cp1WeekOverWeek: null,
        totalSpend: 0,
        indemnitySpend: 0,
        expenseSpend: 0,
        litigationSpend: 0,
        biSpend: 0,
        checkCount: 0,
        spendByDept: new Map(),
        spendByTeam: new Map(),
        decisionsCount: 0,
        decisionsReserves: 0,
        litCount: 0,
        typeGroupData: [],
        dataDate: new Date().toISOString(),
        isLoading,
        hasError,
      };
    }

    // Extract exposure data
    const totalOpenClaims = exposureData.totals.grandTotal;
    const totalReserves = exposureData.financials.totalOpenReserves;
    const totalLowEval = exposureData.financials.totalLowEval;
    const totalHighEval = exposureData.financials.totalHighEval;
    const noEvalCount = exposureData.financials.noEvalCount;
    const noEvalReserves = exposureData.financials.noEvalReserves;

    const aged365Plus = exposureData.totals.age365Plus;
    const aged365Reserves = exposureData.financials.byAge.find(a => a.age === '365+ Days')?.openReserves || 0;
    const aged181to365 = exposureData.totals.age181To365 || 0;
    const aged181Reserves = exposureData.financials.byAge.find(a => a.age === '181-365 Days')?.openReserves || 0;
    const aged61to180 = exposureData.totals.age61To180 || 0;
    const agedUnder60 = exposureData.totals.ageUnder60 || 0;

    const typeGroupData = exposureData.typeGroupSummaries || [];
    const litCount = typeGroupData.find(t => t.typeGroup === 'LIT')?.grandTotal || 0;

    // CP1 metrics - prefer CSV data if available for most accurate counts
    const cp1Count = cp1Data?.rawClaims.length || exposureData.cp1Data.totals.yes;
    const cp1Rate = cp1Data?.cp1Data.cp1Rate || exposureData.cp1Data.cp1Rate;
    const biTotal = cp1Data?.cp1Data.biTotal || exposureData.cp1Data.biTotal;
    const biCP1Rate = biTotal && biTotal.total > 0
      ? ((biTotal.yes / biTotal.total) * 100).toFixed(1) + '%'
      : cp1Rate;
    const cp1TotalReserves = cp1Data?.rawClaims.reduce((s, c) => s + c.openReserves, 0) || 0;
    const cp1Fatalities = cp1Data?.fatalitySummary.fatalityCount || exposureData.fatalitySummary?.fatalityCount || 0;
    const cp1Surgeries = cp1Data?.fatalitySummary.surgeryCount || exposureData.fatalitySummary?.surgeryCount || 0;
    const cp1Hospitalizations = cp1Data?.fatalitySummary.hospitalizationCount || exposureData.fatalitySummary?.hospitalizationCount || 0;
    const cp1TotalFlags = cp1Data?.totalFlagInstances || 0;

    // Week-over-week delta
    const cp1WeekOverWeek = cp1Data?.weekOverWeek?.hasValidPrior ? {
      claimsDelta: cp1Data.weekOverWeek.totalClaims.delta,
      rateDelta: cp1Data.weekOverWeek.cp1Rate.delta,
      highRiskDelta: cp1Data.weekOverWeek.highRiskClaims.delta,
      aged365Delta: cp1Data.weekOverWeek.age365Plus.delta,
      hasValidPrior: true,
      priorDate: cp1Data.weekOverWeek.priorSnapshotDate,
    } : null;

    // Spend metrics from check history
    const totalSpend = spendSummary?.totalNet || 0;
    const indemnitySpend = spendSummary?.indemnityTotal || 0;
    const expenseSpend = spendSummary?.expenseTotal || 0;
    const litSpend = litigationSpend?.totalNet || 0;
    const biSpendTotal = biSpend?.totalNet || 0;
    const checkCount = spendSummary?.checkCount || 0;
    const spendByDept = spendSummary?.byDept || new Map();
    const spendByTeam = spendSummary?.byTeam || new Map();

    // Decisions
    const decisionsCount = decisionsData?.totalCount || 0;
    const decisionsReserves = decisionsData?.totalReserves || 0;

    return {
      totalOpenClaims,
      totalReserves,
      totalLowEval,
      totalHighEval,
      noEvalCount,
      noEvalReserves,
      aged365Plus,
      aged365Reserves,
      aged181to365,
      aged181Reserves,
      aged61to180,
      agedUnder60,
      cp1Count,
      cp1Rate,
      biCP1Rate,
      cp1TotalReserves,
      cp1Fatalities,
      cp1Surgeries,
      cp1Hospitalizations,
      cp1TotalFlags,
      cp1WeekOverWeek,
      totalSpend,
      indemnitySpend,
      expenseSpend,
      litigationSpend: litSpend,
      biSpend: biSpendTotal,
      checkCount,
      spendByDept,
      spendByTeam,
      decisionsCount,
      decisionsReserves,
      litCount,
      typeGroupData,
      dataDate: exposureData.dataDate || new Date().toISOString(),
      isLoading,
      hasError,
    };
  }, [exposureData, cp1Data, spendSummary, litigationSpend, biSpend, decisionsData, exposureLoading, cp1Loading, spendLoading, exposureError, cp1Error, spendError]);

  const value = useMemo(() => ({
    metrics,
    cp1Analysis: cp1Data,
    spendSummary,
    refetch: () => { /* Data refreshes automatically */ },
  }), [metrics, cp1Data, spendSummary]);

  return (
    <OperationsDataContext.Provider value={value}>
      {children}
    </OperationsDataContext.Provider>
  );
}

export function useOperationsData() {
  const context = useContext(OperationsDataContext);
  if (!context) {
    throw new Error("useOperationsData must be used within an OperationsDataProvider");
  }
  return context;
}

// Convenience hook to get just the metrics
export function useOperationsMetrics() {
  const { metrics } = useOperationsData();
  return metrics;
}
