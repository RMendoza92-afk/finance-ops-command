import React, { useState } from "react";
import { format } from "date-fns";
import { useOpenExposureData } from "@/hooks/useOpenExposureData";
import { useDecisionsPending } from "@/hooks/useDecisionsPending";
import { useExportData } from "@/hooks/useExportData";
import { ExecutiveCommandDashboard } from "./ExecutiveCommandDashboard";
import { Loader2 } from "lucide-react";
import { LitigationChat } from "@/components/LitigationChat";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// Financial constants (same as OpenInventoryDashboard)
const FINANCIAL_DATA = {
  totals: {
    totalOpenReserves: 258000000,
    totalLowEval: 63300000,
    totalHighEval: 71000000,
    noEvalCount: 13640,
    noEvalReserves: 156400000,
  }
};

const EXECUTIVE_METRICS = {
  aging: {
    over365Days: 5173,
    over365Reserves: 78100000,
  }
};

const CP1_DATA = {
  totals: { yes: 6523 },
  cp1Rate: '33.3%',
};

export function ExecutiveCommandDashboardWrapper() {
  const { data, loading, error } = useOpenExposureData();
  const { data: decisionsData } = useDecisionsPending();
  const { generateCSuiteBriefing, generateCSuiteExcel } = useExportData();
  const timestamp = format(new Date(), 'MMMM d, yyyy h:mm a');
  
  const [showChat, setShowChat] = useState(false);
  const [showDecisionsDrawer, setShowDecisionsDrawer] = useState(false);
  const [showCP1Drawer, setShowCP1Drawer] = useState(false);
  const [showBudgetDrawer, setShowBudgetDrawer] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        Error loading executive data
      </div>
    );
  }

  const metrics = {
    totalOpenClaims: data.totals.grandTotal,
  };

  // Budget metrics calculation
  const budgetMetrics = {
    coverageBreakdown: {
      bi: {
        ytd2026: 42000,
        ytd2025: 316600000,
      }
    }
  };

  return (
    <>
      <ExecutiveCommandDashboard
        data={{
          totalClaims: metrics.totalOpenClaims,
          totalReserves: FINANCIAL_DATA.totals.totalOpenReserves,
          lowEval: FINANCIAL_DATA.totals.totalLowEval,
          highEval: FINANCIAL_DATA.totals.totalHighEval,
          noEvalCount: FINANCIAL_DATA.totals.noEvalCount,
          noEvalReserves: FINANCIAL_DATA.totals.noEvalReserves,
          aged365Plus: EXECUTIVE_METRICS.aging.over365Days,
          aged365Reserves: EXECUTIVE_METRICS.aging.over365Reserves,
          aged181to365: data.totals.age181To365 || 0,
          aged181Reserves: data.financials.byAge.find(a => a.age === '181-365 Days')?.openReserves || 0,
          aged61to180: data.totals.age61To180 || 0,
          agedUnder60: data.totals.ageUnder60 || 0,
          cp1Count: CP1_DATA.totals.yes,
          cp1Rate: CP1_DATA.cp1Rate,
          decisionsCount: decisionsData?.totalCount || 0,
          decisionsExposure: decisionsData?.totalReserves || 0,
          litCount: data.typeGroupSummaries.find(t => t.typeGroup === 'LIT')?.grandTotal || 0,
          biLitSpend2026: budgetMetrics.coverageBreakdown.bi.ytd2026,
          biLitSpend2025: budgetMetrics.coverageBreakdown.bi.ytd2025,
          dataDate: data.dataDate || timestamp,
          delta: data.delta ? {
            change: data.delta.change,
            changePercent: data.delta.changePercent,
            reservesChange: data.delta.reservesChange || 0,
            reservesChangePercent: data.delta.reservesChangePercent || 0,
            previousDate: data.delta.previousDate,
          } : undefined,
        }}
        onOpenChat={() => setShowChat(true)}
        onDrilldown={(section) => {
          if (section === 'decisions') setShowDecisionsDrawer(true);
          else if (section === 'cp1') setShowCP1Drawer(true);
          else if (section === 'budget') setShowBudgetDrawer(true);
          else if (section === 'export') {
            const exportData = {
              totalClaims: metrics.totalOpenClaims,
              totalReserves: FINANCIAL_DATA.totals.totalOpenReserves,
              cp1Rate: CP1_DATA.cp1Rate,
              cp1Count: CP1_DATA.totals.yes,
              aged365Plus: EXECUTIVE_METRICS.aging.over365Days,
              aged365Reserves: EXECUTIVE_METRICS.aging.over365Reserves,
              aged181to365: data.totals.age181To365 || 0,
              noEvalCount: FINANCIAL_DATA.totals.noEvalCount,
              noEvalReserves: FINANCIAL_DATA.totals.noEvalReserves,
              decisionsCount: decisionsData?.totalCount || 0,
              decisionsExposure: decisionsData?.totalReserves || 0,
              lowEval: FINANCIAL_DATA.totals.totalLowEval,
              highEval: FINANCIAL_DATA.totals.totalHighEval,
              biSpend2026: budgetMetrics.coverageBreakdown.bi.ytd2026,
              biSpend2025: budgetMetrics.coverageBreakdown.bi.ytd2025,
              dataDate: data.dataDate || timestamp,
            };
            generateCSuiteBriefing(exportData);
            generateCSuiteExcel(exportData);
          }
        }}
        timestamp={data.dataDate || timestamp}
      />

      {/* Decisions Drawer */}
      <Sheet open={showDecisionsDrawer} onOpenChange={setShowDecisionsDrawer}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Decisions Pending</SheetTitle>
          </SheetHeader>
          <div className="py-4 text-muted-foreground">
            {decisionsData?.totalCount || 0} claims requiring decision
          </div>
        </SheetContent>
      </Sheet>

      {/* CP1 Drawer */}
      <Sheet open={showCP1Drawer} onOpenChange={setShowCP1Drawer}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>CP1 Claims</SheetTitle>
          </SheetHeader>
          <div className="py-4 text-muted-foreground">
            {CP1_DATA.totals.yes} claims at {CP1_DATA.cp1Rate}
          </div>
        </SheetContent>
      </Sheet>

      {/* Budget Drawer */}
      <Sheet open={showBudgetDrawer} onOpenChange={setShowBudgetDrawer}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Budget Overview</SheetTitle>
          </SheetHeader>
          <div className="py-4 text-muted-foreground">
            BI Litigation Spend tracking
          </div>
        </SheetContent>
      </Sheet>

      {/* Chat triggered from dashboard */}
      {showChat && <LitigationChat />}
    </>
  );
}
