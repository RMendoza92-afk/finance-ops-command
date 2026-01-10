import React, { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { useOpenExposureData } from "@/hooks/useOpenExposureData";
import { useDecisionsPending } from "@/hooks/useDecisionsPending";
import { useExportData, type ExportableData } from "@/hooks/useExportData";
import { useActuarialData } from "@/hooks/useActuarialData";
import { useLossTriangleData } from "@/hooks/useLossTriangleData";
import { useCP1AnalysisCsv } from "@/hooks/useCP1AnalysisCsv";
import { useCheckHistory } from "@/hooks/useCheckHistory";
import { ExecutiveCommandDashboard } from "./ExecutiveCommandDashboard";
import { Loader2, DollarSign, Clock, AlertTriangle, Shield, Flag, TrendingUp, TrendingDown, FileText, FileSpreadsheet, Wallet, Users, Target, Activity, ExternalLink, Download, BarChart3, PieChart, AlertCircle } from "lucide-react";
import { LitigationChat } from "@/components/LitigationChat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  exportClaimsDrilldown,
  exportReservesDrilldown,
  exportDecisionsDrilldown,
  exportAgedDrilldown,
  exportNoEvalDrilldown,
  exportCP1Drilldown,
  exportBudgetDrilldown,
} from "@/lib/bloombergExport";
// Visual reports removed - using styled Excel exports
import { generateStyledExcelFromLegacy } from "@/lib/boardroomExcelExport";
import {
  LineChart, Line, BarChart, Bar, ComposedChart, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const formatM = (val: number) => `$${(val / 1000000).toFixed(1)}M`;
const formatK = (val: number) => `$${(val / 1000).toFixed(0)}K`;
const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

export function ExecutiveCommandDashboardWrapper() {
  const { data, loading, error } = useOpenExposureData();
  const { data: decisionsData } = useDecisionsPending();
  const { data: cp1CsvData } = useCP1AnalysisCsv();
  const { summary: spendSummary, litigationSpend, biSpend, loading: spendLoading } = useCheckHistory();
  const { generateCSuiteBriefing, generateCSuiteExcel, generatePDF, generateExcel } = useExportData();
  const { data: actuarialData } = useActuarialData(2026);
  const triangleData = useLossTriangleData();
  const timestamp = format(new Date(), 'MMMM d, yyyy h:mm a');

  // Budget metrics - now using REAL data from check history CSV
  // Falls back to static data if CSV not loaded
  // MUST be before any early returns to comply with Rules of Hooks
  const budgetMetrics = useMemo(() => {
    // Get BI spend from check history (real data)
    const biYtd2026 = biSpend?.totalNet || 5847291.33;
    const biCheckCount = biSpend?.checkCount || 335;
    
    // Get UM/UI from coverage breakdown if available
    const umSpend = spendSummary?.byCoverage.get('UM')?.net || 101896.68;
    const uiSpend = spendSummary?.byCoverage.get('UI')?.net || 90000.00;
    
    // Calculate total YTD from real data
    const totalYtd = spendSummary?.totalNet || 6039188.01;

    // Date range from spend data
    let dateRangeLabel = 'January 2026';
    if (spendSummary?.minDate && spendSummary?.maxDate) {
      try {
        const minD = new Date(spendSummary.minDate);
        const maxD = new Date(spendSummary.maxDate);
        if (!isNaN(minD.getTime()) && !isNaN(maxD.getTime())) {
          dateRangeLabel = `${format(minD, 'MMM d')} - ${format(maxD, 'MMM d, yyyy')}`;
        }
      } catch { /* use default */ }
    }
    
    return {
      coverageBreakdown: {
        bi: {
          ytd2026: biYtd2026,
          checkCount: biCheckCount,
          ytd2025: 344631765,
        },
        um: {
          ytd2026: umSpend,
          ytd2025: 83565242,
        },
        ui: {
          ytd2026: uiSpend,
          ytd2025: 23226040,
        }
      },
      totalYtd2026: totalYtd,
      total2025: 451423047,
      litigationSpend: {
        total: litigationSpend?.totalNet || 0,
        indemnity: litigationSpend?.indemnityTotal || 0,
        expense: litigationSpend?.expenseTotal || 0,
        checkCount: litigationSpend?.checkCount || 0,
      },
      totalIndemnity: spendSummary?.indemnityTotal || 0,
      totalExpense: spendSummary?.expenseTotal || 0,
      totalChecks: spendSummary?.checkCount || 0,
      isRealData: !spendLoading && (spendSummary?.checkCount || 0) > 0,
      dateRangeLabel,
    };
  }, [biSpend, spendSummary, litigationSpend, spendLoading]);

  // Over-limit export payload (for the Over-Limit drawer)
  const overLimitExportData: ExportableData = useMemo(() => {
    const payments = actuarialData?.overLimitPayments || [];
    const totalOverLimit = payments.reduce((s: number, p: any) => s + (p.overLimitAmount || 0), 0);
    const totalPayments = payments.reduce((s: number, p: any) => s + (p.paymentAmount || 0), 0);

    return {
      title: 'OVER-LIMIT PAYMENTS REPORT',
      subtitle: 'Executive Tab • Over-Limit Payments Analysis',
      timestamp,
      affectsManager: 'Claims + Litigation Leadership',
      summary: {
        'Claims Count': payments.length,
        'Total Payments': totalPayments.toFixed(2),
        'Total Over-Limit': totalOverLimit.toFixed(2),
        'Avg Over-Limit': payments.length ? (totalOverLimit / payments.length).toFixed(2) : '0.00',
      },
      columns: ['Date', 'Claim #', 'State', 'Policy Limit', 'Payment', 'Over Limit'],
      rows: payments.map((p: any) => [
        p.paymentDate,
        p.claimNumber,
        p.state,
        p.policyLimit,
        p.paymentAmount,
        p.overLimitAmount,
      ]),
    };
  }, [actuarialData, timestamp]);

  const handleOverLimitExportPDF = async () => {
    try {
      await generatePDF(overLimitExportData);
      toast.success('Over-Limit PDF exported');
    } catch {
      toast.error('Failed to export Over-Limit PDF');
    }
  };

  const handleOverLimitExportExcel = async () => {
    try {
      await generateStyledExcelFromLegacy(overLimitExportData);
      toast.success('Boardroom-styled Over-Limit Excel exported');
    } catch {
      toast.error('Failed to export Over-Limit Excel');
    }
  };
  
  const [showChat, setShowChat] = useState(false);
  const [showClaimsDrawer, setShowClaimsDrawer] = useState(false);
  const [showReservesDrawer, setShowReservesDrawer] = useState(false);
  const [showDecisionsDrawer, setShowDecisionsDrawer] = useState(false);
  const [showCP1Drawer, setShowCP1Drawer] = useState(false);
  const [showNoEvalDrawer, setShowNoEvalDrawer] = useState(false);
  const [showAged365Drawer, setShowAged365Drawer] = useState(false);
  const [showBudgetDrawer, setShowBudgetDrawer] = useState(false);
  
  // NEW: Drill-down states for additional sections
  const [showLossDevDrawer, setShowLossDevDrawer] = useState(false);
  const [showFrequencyDrawer, setShowFrequencyDrawer] = useState(false);
  const [showPaymentsDrawer, setShowPaymentsDrawer] = useState(false);
  const [showOverLimitDrawer, setShowOverLimitDrawer] = useState(false);
  const [showAgeMixDrawer, setShowAgeMixDrawer] = useState(false);
  const [selectedFreqState, setSelectedFreqState] = useState<string | null>(null);

  // Database data states
  const [claimReviews, setClaimReviews] = useState<any[]>([]);
  const [lorOffers, setLorOffers] = useState<any[]>([]);
  const [inventorySnapshot, setInventorySnapshot] = useState<any>(null);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);

  // Fetch claim reviews from database
  const fetchClaimReviews = async (filter?: string) => {
    setLoadingDrilldown(true);
    try {
      let query = supabase.from('claim_reviews').select('*').order('reserves', { ascending: false }).limit(50);
      if (filter === 'aged365') {
        query = query.eq('age_bucket', '365+ Days');
      }
      const { data: reviews } = await query;
      setClaimReviews(reviews || []);
    } catch (err) {
      console.error('Failed to fetch claim reviews:', err);
    }
    setLoadingDrilldown(false);
  };

  // Fetch LOR offers from database
  const fetchLorOffers = async () => {
    setLoadingDrilldown(true);
    try {
      const { data: offers } = await supabase.from('lor_offers').select('*').order('offer_amount', { ascending: false }).limit(30);
      setLorOffers(offers || []);
    } catch (err) {
      console.error('Failed to fetch LOR offers:', err);
    }
    setLoadingDrilldown(false);
  };

  // Fetch latest inventory snapshot
  const fetchInventorySnapshot = async () => {
    try {
      const { data: snapshot } = await supabase.from('inventory_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(1).maybeSingle();
      setInventorySnapshot(snapshot);
    } catch (err) {
      console.error('Failed to fetch inventory snapshot:', err);
    }
  };

  useEffect(() => {
    fetchInventorySnapshot();
  }, []);

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

  // Extract real data from the hook - SINGLE SOURCE OF TRUTH
  const totalOpenClaims = data.totals.grandTotal;
  const totalReserves = data.financials.totalOpenReserves;
  const totalLowEval = data.financials.totalLowEval;
  const totalHighEval = data.financials.totalHighEval;
  const noEvalCount = data.financials.noEvalCount;
  const noEvalReserves = data.financials.noEvalReserves;
  
  // Age breakdown from real data
  const aged365Plus = data.totals.age365Plus;
  const aged365Reserves = data.financials.byAge.find(a => a.age === '365+ Days')?.openReserves || 0;
  const aged181to365 = data.totals.age181To365 || 0;
  const aged181Reserves = data.financials.byAge.find(a => a.age === '181-365 Days')?.openReserves || 0;
  const aged61to180 = data.totals.age61To180 || 0;
  const agedUnder60 = data.totals.ageUnder60 || 0;
  
  // CP1 from real data
  const cp1Count = data.cp1Data.totals.yes;
  const cp1Rate = data.cp1Data.cp1Rate;
  
  // Decisions from real hook data
  const pendingDecisionsCount = decisionsData?.totalCount || 0;
  const pendingDecisionsReserves = decisionsData?.totalReserves || 0;
  
  // Type group data
  const typeGroupData = data.typeGroupSummaries || [];
  const litCount = typeGroupData.find(t => t.typeGroup === 'LIT')?.grandTotal || 0;

  // Drilldown handler
  const handleDrilldown = (section: string) => {
    // Handle frequency state drilldown
    if (section.startsWith('frequency-')) {
      const state = section.replace('frequency-', '');
      setSelectedFreqState(state);
      setShowFrequencyDrawer(true);
      return;
    }
    
    switch (section) {
      case 'claims':
        fetchClaimReviews();
        setShowClaimsDrawer(true);
        break;
      case 'reserves':
        setShowReservesDrawer(true);
        break;
      case 'decisions':
        fetchLorOffers();
        setShowDecisionsDrawer(true);
        break;
      case 'cp1':
        setShowCP1Drawer(true);
        break;
      case 'noeval':
        setShowNoEvalDrawer(true);
        break;
      case 'aged365':
        fetchClaimReviews('aged365');
        setShowAged365Drawer(true);
        break;
      case 'budget':
        setShowBudgetDrawer(true);
        break;
      // NEW: Additional drill-down sections
      case 'loss-development':
        setShowLossDevDrawer(true);
        break;
      case 'claims-frequency':
        setSelectedFreqState(null);
        setShowFrequencyDrawer(true);
        break;
      case 'claims-payments':
        setShowPaymentsDrawer(true);
        break;
      case 'over-limit':
        setShowOverLimitDrawer(true);
        break;
      case 'age-mix':
        setShowAgeMixDrawer(true);
        break;
      case 'export':
        const exportData = {
          totalClaims: totalOpenClaims,
          totalReserves,
          cp1Rate,
          cp1Count,
          aged365Plus,
          aged365Reserves,
          aged181to365,
          noEvalCount,
          noEvalReserves,
          decisionsCount: pendingDecisionsCount,
          decisionsExposure: pendingDecisionsReserves,
          lowEval: totalLowEval,
          highEval: totalHighEval,
          biSpend2026: budgetMetrics.coverageBreakdown.bi.ytd2026,
          biSpend2025: budgetMetrics.coverageBreakdown.bi.ytd2025,
          dataDate: data.dataDate || timestamp,
          fatalityCount: data.fatalitySummary?.fatalityCount || 0,
          fatalityReserves: data.fatalitySummary?.fatalityReserves || 0,
          surgeryCount: data.fatalitySummary?.surgeryCount || 0,
          hospitalizationCount: data.fatalitySummary?.hospitalizationCount || 0,
        };
        generateCSuiteBriefing(exportData);
        generateCSuiteExcel(exportData);
        break;
    }
  };

  // Double-click to show toast about styled Excel exports
  const handleDoubleClickReport = (section: string) => {
    toast.info('Use Export buttons for styled Excel reports');
  };

  // Build CP1 analysis data for exports
  // Calculate BI CP1 rate from biTotal
  const biCP1Rate = data.cp1Data.biTotal && data.cp1Data.biTotal.total > 0
    ? ((data.cp1Data.biTotal.yes / data.cp1Data.biTotal.total) * 100).toFixed(1) + '%'
    : cp1Rate;

  // Extract week-over-week data from CP1 CSV hook if available
  const cp1WeekOverWeek = cp1CsvData?.weekOverWeek?.hasValidPrior ? {
    totalClaimsDelta: cp1CsvData.weekOverWeek.totalClaims.delta,
    cp1RateDelta: cp1CsvData.weekOverWeek.cp1Rate.delta,
    highRiskDelta: cp1CsvData.weekOverWeek.highRiskClaims.delta,
    aged365Delta: cp1CsvData.weekOverWeek.age365Plus.delta,
    previousDate: cp1CsvData.weekOverWeek.priorSnapshotDate || '',
  } : undefined;
    
  const cp1Analysis = {
    totalClaims: data.cp1Data.totals.grandTotal,
    cp1Count: cp1Count,
    cp1Rate: cp1Rate,
    biCP1Rate: biCP1Rate,
    byCoverage: data.cp1Data.byCoverage || [],
    biByAge: data.cp1Data.biByAge || [],
    biTotal: data.cp1Data.biTotal || { total: 0, yes: 0, noCP: 0 },
    totals: data.cp1Data.totals,
    weekOverWeek: cp1WeekOverWeek,
  };

  return (
    <>
      <ExecutiveCommandDashboard
        data={{
          totalClaims: totalOpenClaims,
          totalReserves,
          lowEval: totalLowEval,
          highEval: totalHighEval,
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
          decisionsCount: pendingDecisionsCount,
          decisionsExposure: pendingDecisionsReserves,
          litCount,
          biLitSpend2026: budgetMetrics.coverageBreakdown.bi.ytd2026,
          biLitSpend2025: budgetMetrics.coverageBreakdown.bi.ytd2025,
          spendDateRange: budgetMetrics.dateRangeLabel,
          dataDate: data.dataDate || timestamp,
          fatalityCount: data.fatalitySummary?.fatalityCount || 0,
          fatalityReserves: data.fatalitySummary?.fatalityReserves || 0,
          surgeryCount: data.fatalitySummary?.surgeryCount || 0,
          hospitalizationCount: data.fatalitySummary?.hospitalizationCount || 0,
          delta: undefined,
          typeGroupData: typeGroupData,
          ageBreakdown: data.financials.byAge,
          rawClaims: data.rawClaims,
          // Include full CP1 analysis for board reports
          cp1Analysis,
        }}
        onOpenChat={() => setShowChat(true)}
        onDrilldown={handleDrilldown}
        onDoubleClickReport={handleDoubleClickReport}
        timestamp={data.dataDate || timestamp}
      />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CLAIMS DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showClaimsDrawer} onOpenChange={setShowClaimsDrawer}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-4 sm:p-6">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Activity className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <SheetTitle className="text-xl">Claims Inventory Breakdown</SheetTitle>
                  <SheetDescription>By type group and phase</SheetDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportClaimsDrilldown(
                  totalOpenClaims,
                  totalReserves,
                  typeGroupData,
                  claimReviews
                )}
                className="gap-2 bg-zinc-900 border-orange-500/50 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-muted/30 border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Exposures</p>
                <p className="text-3xl font-bold text-foreground mt-1">{totalOpenClaims.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Litigation</p>
                <p className="text-3xl font-bold text-primary mt-1">{litCount.toLocaleString()}</p>
              </div>
            </div>

            {/* Type Group Breakdown Table */}
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <h4 className="text-sm font-semibold mb-3">By Type Group</h4>
              <div className="rounded-xl border min-w-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold whitespace-nowrap">Type Group</TableHead>
                      <TableHead className="text-right font-bold whitespace-nowrap">Claims</TableHead>
                      <TableHead className="text-right font-bold whitespace-nowrap">Reserves</TableHead>
                      <TableHead className="text-right font-bold whitespace-nowrap">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {typeGroupData.slice(0, 10).map((tg) => (
                      <TableRow key={tg.typeGroup} className="hover:bg-muted/30">
                        <TableCell className="font-medium whitespace-nowrap">{tg.typeGroup}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{tg.grandTotal.toLocaleString()}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatM(tg.reserves)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Badge variant="outline" className="text-xs">
                            {((tg.grandTotal / totalOpenClaims) * 100).toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* RESERVES DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showReservesDrawer} onOpenChange={setShowReservesDrawer}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-4 sm:p-6">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <SheetTitle className="text-xl">Reserves Analysis</SheetTitle>
                  <SheetDescription>Portfolio reserve distribution</SheetDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportReservesDrilldown(
                  totalReserves,
                  totalLowEval,
                  totalHighEval,
                  noEvalReserves,
                  data.financials.byAge
                )}
                className="gap-2 bg-zinc-900 border-orange-500/50 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Reserve Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                <p className="text-xs text-muted-foreground">Total Reserves</p>
                <p className="text-xl sm:text-2xl font-bold text-emerald-500">{formatM(totalReserves)}</p>
              </div>
              <div className="p-3 sm:p-4 rounded-xl bg-muted/30 border">
                <p className="text-xs text-muted-foreground">Low Eval</p>
                <p className="text-xl sm:text-2xl font-bold">{formatM(totalLowEval)}</p>
              </div>
              <div className="p-3 sm:p-4 rounded-xl bg-warning/10 border border-warning/20">
                <p className="text-xs text-warning">High Eval</p>
                <p className="text-xl sm:text-2xl font-bold text-warning">{formatM(totalHighEval)}</p>
              </div>
            </div>

            {/* Evaluation Gap Analysis */}
            <div className="p-4 rounded-xl border bg-card">
              <h4 className="font-semibold mb-4">Evaluation Gap Analysis</h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Low Eval Coverage</span>
                    <span>{totalReserves > 0 ? ((totalLowEval / totalReserves) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <Progress value={totalReserves > 0 ? (totalLowEval / totalReserves) * 100 : 0} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>High Eval Exposure</span>
                    <span>{totalReserves > 0 ? ((totalHighEval / totalReserves) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <Progress value={totalReserves > 0 ? (totalHighEval / totalReserves) * 100 : 0} className="h-2 bg-warning/20" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-destructive font-medium">No Evaluation</span>
                    <span className="text-destructive">{totalReserves > 0 ? ((noEvalReserves / totalReserves) * 100).toFixed(1) : 0}%</span>
                  </div>
                  <Progress value={totalReserves > 0 ? (noEvalReserves / totalReserves) * 100 : 0} className="h-2 bg-destructive/20" />
                </div>
              </div>
            </div>

            {/* Reserve by Age */}
            <div className="rounded-xl border overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold whitespace-nowrap">Age Bucket</TableHead>
                    <TableHead className="text-right font-bold whitespace-nowrap">Claims</TableHead>
                    <TableHead className="text-right font-bold whitespace-nowrap">Reserves</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.financials.byAge.map((age) => (
                    <TableRow key={age.age}>
                      <TableCell className="font-medium whitespace-nowrap">{age.age}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{age.claims.toLocaleString()}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatM(age.openReserves)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* DECISIONS PENDING DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showDecisionsDrawer} onOpenChange={setShowDecisionsDrawer}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-4 sm:p-6">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Flag className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-xl">Pending Decisions</SheetTitle>
                  <SheetDescription>Claims requiring action</SheetDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportDecisionsDrilldown(
                  pendingDecisionsCount,
                  pendingDecisionsReserves,
                  decisionsData?.claims || []
                )}
                className="gap-2 bg-zinc-900 border-orange-500/50 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 sm:p-4 rounded-xl bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground">Claims Pending</p>
                <p className="text-2xl sm:text-3xl font-bold text-primary">{pendingDecisionsCount.toLocaleString()}</p>
              </div>
              <div className="p-3 sm:p-4 rounded-xl bg-muted/30 border">
                <p className="text-xs text-muted-foreground">Total Exposure</p>
                <p className="text-2xl sm:text-3xl font-bold">{formatM(pendingDecisionsReserves)}</p>
              </div>
            </div>

            {/* Claims requiring decisions */}
            {decisionsData?.claims && decisionsData.claims.length > 0 && (
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <h4 className="text-sm font-semibold mb-3">Top Claims by Exposure</h4>
                <div className="rounded-xl border min-w-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold whitespace-nowrap">Claim</TableHead>
                        <TableHead className="font-bold whitespace-nowrap">State</TableHead>
                        <TableHead className="text-right font-bold whitespace-nowrap">Reserves</TableHead>
                        <TableHead className="font-bold whitespace-nowrap">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {decisionsData.claims.slice(0, 15).map((claim, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {claim.claimNumber}
                              {claim.fatality && (
                                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white rounded animate-pulse">
                                  FATALITY
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{claim.state}</TableCell>
                          <TableCell className="text-right font-medium whitespace-nowrap">{formatK(claim.reserves)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{claim.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* LOR Offers from Database */}
            {lorOffers.length > 0 && (
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <h4 className="text-sm font-semibold mb-3">Active LOR Offers</h4>
                {loadingDrilldown ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="rounded-xl border min-w-[350px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-bold whitespace-nowrap">Claim</TableHead>
                          <TableHead className="text-right font-bold whitespace-nowrap">Offer</TableHead>
                          <TableHead className="font-bold whitespace-nowrap">Expires</TableHead>
                          <TableHead className="font-bold whitespace-nowrap">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lorOffers.slice(0, 10).map((offer) => (
                          <TableRow key={offer.id} className="hover:bg-muted/30">
                            <TableCell className="font-mono text-xs whitespace-nowrap">{offer.claim_number}</TableCell>
                            <TableCell className="text-right font-medium whitespace-nowrap">{formatK(offer.offer_amount)}</TableCell>
                            <TableCell className="text-sm whitespace-nowrap">{format(new Date(offer.expires_date), 'MMM d')}</TableCell>
                            <TableCell>
                              <Badge variant={offer.status === 'accepted' ? 'default' : offer.status === 'expired' ? 'destructive' : 'secondary'} className="text-xs">
                                {offer.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CP1 DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showCP1Drawer} onOpenChange={setShowCP1Drawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-4 sm:p-6">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Shield className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <SheetTitle className="text-xl">CP1 Analysis</SheetTitle>
                  <SheetDescription>Claims within policy limits</SheetDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCP1Drilldown(cp1Count, cp1Rate)}
                className="gap-2 bg-zinc-900 border-orange-500/50 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* CP1 Summary */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Current CP1 Rate</p>
                <p className="text-5xl font-bold text-emerald-500">{cp1Rate}</p>
                <p className="text-sm text-muted-foreground mt-2">{cp1Count.toLocaleString()} claims within limits</p>
              </div>
            </div>

            {/* Target Progress */}
            <div className="p-4 rounded-xl border bg-card">
              <h4 className="font-semibold mb-4">Target Achievement</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Current Rate</span>
                    <span className="font-medium text-emerald-500">{cp1Rate}</span>
                  </div>
                  <Progress value={parseFloat(cp1Rate)} className="h-3" />
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <span className="text-sm">Target: 35%</span>
                  <Badge variant={parseFloat(cp1Rate) >= 35 ? "default" : "secondary"}>
                    {parseFloat(cp1Rate) >= 35 ? 'On Track' : `${(35 - parseFloat(cp1Rate)).toFixed(1)}% to go`}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* NO EVAL DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showNoEvalDrawer} onOpenChange={setShowNoEvalDrawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-4 sm:p-6">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/20">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <SheetTitle className="text-xl">No Evaluation Claims</SheetTitle>
                  <SheetDescription>Claims without damage assessment</SheetDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportNoEvalDrilldown(
                  noEvalCount,
                  noEvalReserves,
                  totalOpenClaims
                )}
                className="gap-2 bg-zinc-900 border-orange-500/50 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Risk Summary */}
            <div className="p-4 sm:p-6 rounded-xl bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-muted-foreground">Claims Without Eval</p>
                  <p className="text-2xl sm:text-4xl font-bold text-warning">{noEvalCount.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-muted-foreground">Exposure at Risk</p>
                  <p className="text-2xl sm:text-4xl font-bold text-warning">{formatM(noEvalReserves)}</p>
                </div>
              </div>
            </div>

            {/* Action Required */}
            <div className="p-4 rounded-xl border-2 border-warning/50 bg-warning/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                <div>
                  <h4 className="font-semibold text-warning">Action Required</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {data.totals.biExposures > 0 ? ((noEvalCount / data.totals.biExposures) * 100).toFixed(0) : 0}% of BI exposures lack proper evaluation. 
                    Target completion within 48 hours to minimize exposure risk.
                  </p>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs text-muted-foreground">% of BI Inventory</p>
                <p className="text-lg font-bold">{data.totals.biExposures > 0 ? ((noEvalCount / data.totals.biExposures) * 100).toFixed(1) : 0}%</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs text-muted-foreground">Avg per Claim</p>
                <p className="text-lg font-bold">{noEvalCount > 0 ? formatK(noEvalReserves / noEvalCount) : '$0'}</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* AGED 365+ DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showAged365Drawer} onOpenChange={setShowAged365Drawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-4 sm:p-6">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/20">
                  <Clock className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <SheetTitle className="text-xl">Aged Claims (365+ Days)</SheetTitle>
                  <SheetDescription>High-priority aged inventory</SheetDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportAgedDrilldown(
                  aged365Plus,
                  aged365Reserves,
                  totalOpenClaims,
                  claimReviews
                )}
                className="gap-2 bg-zinc-900 border-orange-500/50 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Aged Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 sm:p-4 rounded-xl bg-muted/30 border">
                <p className="text-xs text-muted-foreground">Aged 365+ Claims</p>
                <p className="text-2xl sm:text-3xl font-bold text-red-600">{aged365Plus.toLocaleString()}</p>
              </div>
              <div className="p-3 sm:p-4 rounded-xl bg-muted/30 border">
                <p className="text-xs text-muted-foreground">Reserve Exposure</p>
                <p className="text-2xl sm:text-3xl font-bold text-red-600">{formatM(aged365Reserves)}</p>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs text-muted-foreground">% of Inventory</p>
                <p className="text-lg font-bold">{totalOpenClaims > 0 ? ((aged365Plus / totalOpenClaims) * 100).toFixed(1) : 0}%</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs text-muted-foreground">Avg Reserve</p>
                <p className="text-lg font-bold">{aged365Plus > 0 ? formatK(aged365Reserves / aged365Plus) : '$0'}</p>
              </div>
            </div>

            {/* Aged Claims from Database */}
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <h4 className="text-sm font-semibold mb-3">Aged Claims Detail</h4>
              {loadingDrilldown ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : claimReviews.length > 0 ? (
                <div className="rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">Claim ID</TableHead>
                        <TableHead className="font-bold">Area</TableHead>
                        <TableHead className="text-right font-bold">Reserves</TableHead>
                        <TableHead className="font-bold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {claimReviews.slice(0, 20).map((review) => (
                        <TableRow key={review.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs">{review.claim_id}</TableCell>
                          <TableCell className="text-sm">{review.area}</TableCell>
                          <TableCell className="text-right font-medium">{formatK(review.reserves)}</TableCell>
                          <TableCell>
                            <Badge variant={review.status === 'completed' ? 'default' : review.status === 'flagged' ? 'destructive' : 'secondary'} className="text-xs">
                              {review.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground border rounded-xl">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No aged claim records available</p>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* BUDGET DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showBudgetDrawer} onOpenChange={setShowBudgetDrawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-xl">Budget & Spend Analysis</SheetTitle>
                  <SheetDescription>BI Litigation expenditure tracking</SheetDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportBudgetDrilldown(
                  budgetMetrics.coverageBreakdown.bi.ytd2026,
                  budgetMetrics.coverageBreakdown.bi.ytd2025
                )}
                className="gap-2 bg-zinc-900 border-orange-500/50 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* YoY Comparison - Total BI/UM/UI */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-muted/30 border">
                <p className="text-xs text-muted-foreground">2026 YTD (1/1 - 1/7)</p>
                <p className="text-2xl font-bold">{formatM(budgetMetrics.totalYtd2026)}</p>
                <Badge className="mt-2 bg-emerald-500/20 text-emerald-500 border-emerald-500/30">345 claims</Badge>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border">
                <p className="text-xs text-muted-foreground">2025 Full Year</p>
                <p className="text-2xl font-bold">{formatM(budgetMetrics.total2025)}</p>
                <Badge className="mt-2" variant="outline">Complete</Badge>
              </div>
            </div>

            {/* Coverage Breakdown */}
            <div className="p-4 rounded-xl border bg-card">
              <h4 className="font-semibold mb-4">Coverage Breakdown (1/1/26 - 1/7/26)</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Bodily Injury (335)</span>
                  <span className="font-mono">{formatM(budgetMetrics.coverageBreakdown.bi.ytd2026)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Uninsured Motorist BI (7)</span>
                  <span className="font-mono">{formatK(budgetMetrics.coverageBreakdown.um.ytd2026)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Underinsured Motorist BI (3)</span>
                  <span className="font-mono">{formatK(budgetMetrics.coverageBreakdown.ui.ytd2026)}</span>
                </div>
              </div>
            </div>

            {/* Spend Trajectory */}
            <div className="p-4 rounded-xl border bg-card">
              <h4 className="font-semibold mb-4">Spend Trajectory</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Projected 2026</span>
                  <span className="font-mono">{formatM(budgetMetrics.totalYtd2026 * 52)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">2025 Actual</span>
                  <span className="font-mono">{formatM(budgetMetrics.total2025)}</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">YoY Change (Projected)</span>
                    <div className="flex items-center gap-1">
                      {budgetMetrics.totalYtd2026 * 52 > budgetMetrics.total2025 ? (
                        <TrendingUp className="h-4 w-4 text-destructive" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-emerald-500" />
                      )}
                      <span className={budgetMetrics.totalYtd2026 * 52 > budgetMetrics.total2025 ? 'text-destructive font-medium' : 'text-emerald-500 font-medium'}>
                        {(((budgetMetrics.totalYtd2026 * 52 - budgetMetrics.total2025) / budgetMetrics.total2025) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* LOSS DEVELOPMENT DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showLossDevDrawer} onOpenChange={setShowLossDevDrawer}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-xl">Loss Development Analysis</SheetTitle>
                <SheetDescription>Accident year incurred development</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* AY Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {triangleData.summaryByAY.slice(0, 3).map((ay) => (
                <div
                  key={ay.accidentYear}
                  className={`p-4 rounded-xl border ${
                    ay.accidentYear === 2025 ? 'bg-primary/10 border-primary' : 'bg-muted/30'
                  }`}
                >
                  <div className="text-xs font-medium text-muted-foreground">AY {ay.accidentYear}</div>
                  <div className="text-2xl font-bold">{ay.lossRatio.toFixed(1)}%</div>
                  <div className="text-sm text-muted-foreground">{formatCurrency(ay.ultimateIncurred)}</div>
                  <Badge variant="outline" className="mt-2 text-xs">{ay.developmentAge} mo dev</Badge>
                </div>
              ))}
            </div>

            {/* Development Chart */}
            <div className="p-4 rounded-xl border bg-card">
              <h4 className="font-semibold mb-4">Incurred Development by AY</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={triangleData.summaryByAY.filter(ay => ay.accidentYear >= 2020).map(ay => ({
                    year: `AY ${ay.accidentYear}`,
                    paid: ay.netPaidLoss,
                    reserves: ay.claimReserves,
                    ibnr: ay.bulkIbnr,
                    incurred: ay.ultimateIncurred,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v / 1000000}M`} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
                    <Legend />
                    <Bar dataKey="paid" name="Paid" stackId="a" fill="#10B981" />
                    <Bar dataKey="reserves" name="Reserves" stackId="a" fill="#F59E0B" />
                    <Bar dataKey="ibnr" name="IBNR" stackId="a" fill="#8B5CF6" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detail Table */}
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">AY</TableHead>
                    <TableHead className="text-right font-bold">Earned Prem</TableHead>
                    <TableHead className="text-right font-bold">Net Paid</TableHead>
                    <TableHead className="text-right font-bold">Reserves</TableHead>
                    <TableHead className="text-right font-bold">IBNR</TableHead>
                    <TableHead className="text-right font-bold">Incurred</TableHead>
                    <TableHead className="text-right font-bold">Loss Ratio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {triangleData.summaryByAY.map((row) => (
                    <TableRow key={row.accidentYear}>
                      <TableCell className="font-medium">{row.accidentYear}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.earnedPremium)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.netPaidLoss)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.claimReserves)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.bulkIbnr)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(row.ultimateIncurred)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={row.lossRatio > 75 ? "destructive" : row.lossRatio > 70 ? "secondary" : "default"}>
                          {row.lossRatio.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CLAIMS FREQUENCY DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showFrequencyDrawer} onOpenChange={setShowFrequencyDrawer}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <BarChart3 className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <SheetTitle className="text-xl">
                  Claims Frequency {selectedFreqState ? `- ${selectedFreqState}` : 'Analysis'}
                </SheetTitle>
                <SheetDescription>State-level frequency trends</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* State Frequency Summary */}
            {(() => {
              const claimsFrequency = actuarialData.claimsFrequency;
              const states = [...new Set(claimsFrequency.map(f => f.state))].filter(s => s !== 'Combined');
              
              const stateAverages = states.map(state => {
                const stateData = claimsFrequency.filter(f => f.state === state);
                const data2024 = stateData.filter(f => f.year === 2024);
                const data2025 = stateData.filter(f => f.year === 2025);
                return {
                  state,
                  avg2024: data2024.length > 0 ? data2024.reduce((s, f) => s + f.frequency, 0) / data2024.length : 0,
                  avg2025: data2025.length > 0 ? data2025.reduce((s, f) => s + f.frequency, 0) / data2025.length : 0,
                };
              }).sort((a, b) => b.avg2025 - a.avg2025);

              const filteredData = selectedFreqState 
                ? stateAverages.filter(s => s.state === selectedFreqState)
                : stateAverages;

              return (
                <>
                  {/* State Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(selectedFreqState ? filteredData : stateAverages.slice(0, 4)).map((state) => {
                      const yoyChange = state.avg2024 > 0 ? ((state.avg2025 - state.avg2024) / state.avg2024 * 100) : 0;
                      const getColor = () => {
                        const freqPct = state.avg2025 * 100;
                        if (freqPct >= 220) return 'bg-red-500/20 border-red-500/30 text-red-500';
                        if (freqPct >= 180) return 'bg-orange-500/20 border-orange-500/30 text-orange-500';
                        if (freqPct >= 160) return 'bg-amber-500/20 border-amber-500/30 text-amber-600';
                        return 'bg-emerald-500/20 border-emerald-500/30 text-emerald-500';
                      };
                      return (
                        <div key={state.state} className={`p-4 rounded-xl border ${getColor()}`}>
                          <div className="text-xs font-medium text-muted-foreground">{state.state}</div>
                          <div className="text-2xl font-bold">{(state.avg2025 * 100).toFixed(1)}%</div>
                          <div className="flex items-center gap-1 text-xs mt-1">
                            {yoyChange < 0 ? (
                              <TrendingDown className="h-3 w-3" />
                            ) : (
                              <TrendingUp className="h-3 w-3" />
                            )}
                            <span>{yoyChange >= 0 ? '+' : ''}{yoyChange.toFixed(1)}% YoY</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Frequency Chart */}
                  <div className="p-4 rounded-xl border bg-card">
                    <h4 className="font-semibold mb-4">Frequency Trend</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stateAverages.slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="state" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                          <Tooltip formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, '']} />
                          <Legend />
                          <Bar dataKey="avg2024" name="2024 Avg" fill="#94A3B8" />
                          <Bar dataKey="avg2025" name="2025 Avg" fill="#F59E0B" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Full Table */}
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-bold">State</TableHead>
                          <TableHead className="text-right font-bold">2024 Avg</TableHead>
                          <TableHead className="text-right font-bold">2025 Avg</TableHead>
                          <TableHead className="text-right font-bold">YoY Change</TableHead>
                          <TableHead className="text-right font-bold">Risk Level</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stateAverages.map((row) => {
                          const yoyChange = row.avg2024 > 0 ? ((row.avg2025 - row.avg2024) / row.avg2024 * 100) : 0;
                          const freqPct = row.avg2025 * 100;
                          const riskLevel = freqPct >= 220 ? 'High' : freqPct >= 180 ? 'Elevated' : freqPct >= 160 ? 'Medium' : 'Low';
                          const riskVariant = freqPct >= 220 ? 'destructive' : freqPct >= 180 ? 'secondary' : 'default';
                          return (
                            <TableRow key={row.state} className={selectedFreqState === row.state ? 'bg-primary/5' : ''}>
                              <TableCell className="font-medium">{row.state}</TableCell>
                              <TableCell className="text-right">{(row.avg2024 * 100).toFixed(1)}%</TableCell>
                              <TableCell className="text-right font-semibold">{(row.avg2025 * 100).toFixed(1)}%</TableCell>
                              <TableCell className={`text-right ${yoyChange < 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {yoyChange >= 0 ? '+' : ''}{yoyChange.toFixed(1)}%
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant={riskVariant as any}>{riskLevel}</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              );
            })()}
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CLAIMS PAYMENTS DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showPaymentsDrawer} onOpenChange={setShowPaymentsDrawer}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <SheetTitle className="text-xl">Claims Payments Analysis</SheetTitle>
                <SheetDescription>Coverage-level payment trends</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {(() => {
              const claimsPayments = actuarialData.claimsPayments;
              const coverages = ['BI', 'PD', 'UM', 'CL', 'TOTAL'];
              
              const paymentSummary = coverages.map(cov => {
                const getYtd = (year: number) => 
                  claimsPayments.find(p => p.coverage === cov && p.periodYear === year && p.isYtd)?.totalPayments || 0;
                const ytd2024 = getYtd(2024);
                const ytd2025 = getYtd(2025);
                const yoyChange = ytd2024 > 0 ? ((ytd2025 - ytd2024) / ytd2024) * 100 : 0;
                return { coverage: cov, ytd2023: getYtd(2023), ytd2024, ytd2025, yoyChange };
              });

              return (
                <>
                  {/* Coverage Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {paymentSummary.map((cov) => (
                      <div
                        key={cov.coverage}
                        className={`p-4 rounded-xl border ${cov.coverage === 'TOTAL' ? 'bg-primary/10 border-primary col-span-2 md:col-span-1' : 'bg-muted/30'}`}
                      >
                        <div className="text-xs font-medium text-muted-foreground">{cov.coverage}</div>
                        <div className="text-xl font-bold">{formatCurrency(cov.ytd2025)}</div>
                        <div className="flex items-center gap-1 text-xs mt-1">
                          {cov.yoyChange > 0 ? (
                            <TrendingUp className="h-3 w-3 text-amber-500" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-emerald-500" />
                          )}
                          <span className={cov.yoyChange > 0 ? "text-amber-600" : "text-emerald-600"}>
                            {cov.yoyChange !== 0 ? `${cov.yoyChange >= 0 ? '+' : ''}${cov.yoyChange.toFixed(0)}%` : '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Payments Chart */}
                  <div className="p-4 rounded-xl border bg-card">
                    <h4 className="font-semibold mb-4">YTD Payments by Coverage</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={paymentSummary.filter(p => p.coverage !== 'TOTAL')}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="coverage" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v / 1000000}M`} />
                          <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
                          <Legend />
                          <Bar dataKey="ytd2023" name="2023 YTD" fill="#94A3B8" />
                          <Bar dataKey="ytd2024" name="2024 YTD" fill="#F59E0B" />
                          <Bar dataKey="ytd2025" name="2025 YTD" fill="#10B981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Detail Table */}
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-bold">Coverage</TableHead>
                          <TableHead className="text-right font-bold">2023 YTD</TableHead>
                          <TableHead className="text-right font-bold">2024 YTD</TableHead>
                          <TableHead className="text-right font-bold">2025 YTD</TableHead>
                          <TableHead className="text-right font-bold">YoY Change</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentSummary.map((row) => (
                          <TableRow key={row.coverage} className={row.coverage === 'TOTAL' ? 'font-bold border-t-2' : ''}>
                            <TableCell className="font-medium">{row.coverage}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.ytd2023)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.ytd2024)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(row.ytd2025)}</TableCell>
                            <TableCell className={`text-right ${row.yoyChange > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {row.yoyChange !== 0 ? `${row.yoyChange >= 0 ? '+' : ''}${row.yoyChange.toFixed(1)}%` : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              );
            })()}
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* OVER-LIMIT PAYMENTS DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showOverLimitDrawer} onOpenChange={setShowOverLimitDrawer}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/20">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <SheetTitle className="text-xl">Over-Limit Payments Analysis</SheetTitle>
                  <SheetDescription>Payments exceeding policy limits</SheetDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleOverLimitExportPDF} className="gap-2">
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleOverLimitExportExcel} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
              </div>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {(() => {
              const overLimitPayments = actuarialData.overLimitPayments;
              const totalOverLimit = overLimitPayments.reduce((s, p) => s + p.overLimitAmount, 0);
              const totalPayments = overLimitPayments.reduce((s, p) => s + p.paymentAmount, 0);
              
              // Group by state
              const byState = overLimitPayments.reduce((acc, p) => {
                acc[p.state] = (acc[p.state] || 0) + p.overLimitAmount;
                return acc;
              }, {} as Record<string, number>);
              
              const stateData = Object.entries(byState)
                .sort((a, b) => b[1] - a[1])
                .map(([state, amount]) => ({ state, amount }));

              return (
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                      <div className="text-xs text-destructive">Total Over-Limit</div>
                      <div className="text-2xl font-bold text-destructive">{formatCurrency(totalOverLimit)}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="text-xs text-amber-600">Total Payments</div>
                      <div className="text-2xl font-bold text-amber-600">{formatCurrency(totalPayments)}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30 border">
                      <div className="text-xs text-muted-foreground">Claims Count</div>
                      <div className="text-2xl font-bold">{overLimitPayments.length}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30 border">
                      <div className="text-xs text-muted-foreground">Avg Over-Limit</div>
                      <div className="text-2xl font-bold">
                        {overLimitPayments.length > 0 ? formatCurrency(totalOverLimit / overLimitPayments.length) : '$0'}
                      </div>
                    </div>
                  </div>

                  {/* By State Chart */}
                  <div className="p-4 rounded-xl border bg-card">
                    <h4 className="font-semibold mb-4">Over-Limit by State</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stateData.slice(0, 10)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                          <YAxis type="category" dataKey="state" tick={{ fontSize: 11 }} width={60} />
                          <Tooltip formatter={(value: number) => [formatCurrency(value), 'Over-Limit']} />
                          <Bar dataKey="amount" fill="#EF4444" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Detail Table */}
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-bold">Date</TableHead>
                          <TableHead className="font-bold">Claim #</TableHead>
                          <TableHead className="font-bold">State</TableHead>
                          <TableHead className="text-right font-bold">Policy Limit</TableHead>
                          <TableHead className="text-right font-bold">Payment</TableHead>
                          <TableHead className="text-right font-bold">Over Limit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overLimitPayments.slice(0, 15).map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.paymentDate}</TableCell>
                            <TableCell className="font-mono text-xs">{row.claimNumber}</TableCell>
                            <TableCell>{row.state}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.policyLimit)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.paymentAmount)}</TableCell>
                            <TableCell className="text-right text-destructive font-semibold">
                              {formatCurrency(row.overLimitAmount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {overLimitPayments.length > 15 && (
                      <p className="text-xs text-muted-foreground p-3 text-center border-t">
                        Showing 15 of {overLimitPayments.length} claims
                      </p>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* AGE MIX DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showAgeMixDrawer} onOpenChange={setShowAgeMixDrawer}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <PieChart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-xl">Age Distribution Analysis</SheetTitle>
                <SheetDescription>Claims aging breakdown</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Age Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                <div className="text-xs text-destructive">365+ Days</div>
                <div className="text-3xl font-bold text-destructive">{aged365Plus.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground mt-1">{formatM(aged365Reserves)}</div>
              </div>
              <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
                <div className="text-xs text-warning">181-365 Days</div>
                <div className="text-3xl font-bold text-warning">{aged181to365.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground mt-1">{formatM(aged181Reserves)}</div>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="text-xs text-amber-600">61-180 Days</div>
                <div className="text-3xl font-bold text-amber-600">{aged61to180.toLocaleString()}</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-xs text-emerald-600">&lt;60 Days</div>
                <div className="text-3xl font-bold text-emerald-600">{agedUnder60.toLocaleString()}</div>
              </div>
            </div>

            {/* Age Distribution Visual */}
            <div className="p-4 rounded-xl border bg-card">
              <h4 className="font-semibold mb-4">Age Distribution</h4>
              <div className="space-y-3">
                {[
                  { label: '365+ Days', count: aged365Plus, color: 'bg-destructive' },
                  { label: '181-365 Days', count: aged181to365, color: 'bg-warning' },
                  { label: '61-180 Days', count: aged61to180, color: 'bg-amber-500' },
                  { label: '<60 Days', count: agedUnder60, color: 'bg-emerald-500' },
                ].map((age) => {
                  const pct = totalOpenClaims > 0 ? (age.count / totalOpenClaims) * 100 : 0;
                  return (
                    <div key={age.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{age.label}</span>
                        <span className="font-medium">{age.count.toLocaleString()} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${age.color} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reserves by Age */}
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">Age Bucket</TableHead>
                    <TableHead className="text-right font-bold">Claims</TableHead>
                    <TableHead className="text-right font-bold">% of Total</TableHead>
                    <TableHead className="text-right font-bold">Reserves</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.financials.byAge.map((age) => (
                    <TableRow key={age.age}>
                      <TableCell className="font-medium">{age.age}</TableCell>
                      <TableCell className="text-right">{age.claims.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {totalOpenClaims > 0 ? ((age.claims / totalOpenClaims) * 100).toFixed(1) : 0}%
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatM(age.openReserves)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Chat triggered from dashboard */}
      {showChat && <LitigationChat />}
    </>
  );
}
