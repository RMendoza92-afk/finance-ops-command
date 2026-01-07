import React, { useState } from "react";
import { format } from "date-fns";
import { useOpenExposureData } from "@/hooks/useOpenExposureData";
import { useDecisionsPending } from "@/hooks/useDecisionsPending";
import { useExportData } from "@/hooks/useExportData";
import { ExecutiveCommandDashboard } from "./ExecutiveCommandDashboard";
import { Loader2, DollarSign, Clock, AlertTriangle, Shield, Flag, TrendingUp, TrendingDown, FileText, Wallet, Users, Target, Activity } from "lucide-react";
import { LitigationChat } from "@/components/LitigationChat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

const formatM = (val: number) => `$${(val / 1000000).toFixed(1)}M`;
const formatK = (val: number) => `$${(val / 1000).toFixed(0)}K`;

export function ExecutiveCommandDashboardWrapper() {
  const { data, loading, error } = useOpenExposureData();
  const { data: decisionsData } = useDecisionsPending();
  const { generateCSuiteBriefing, generateCSuiteExcel } = useExportData();
  const timestamp = format(new Date(), 'MMMM d, yyyy h:mm a');
  
  const [showChat, setShowChat] = useState(false);
  const [showClaimsDrawer, setShowClaimsDrawer] = useState(false);
  const [showReservesDrawer, setShowReservesDrawer] = useState(false);
  const [showDecisionsDrawer, setShowDecisionsDrawer] = useState(false);
  const [showCP1Drawer, setShowCP1Drawer] = useState(false);
  const [showNoEvalDrawer, setShowNoEvalDrawer] = useState(false);
  const [showAged365Drawer, setShowAged365Drawer] = useState(false);
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

  // Drilldown handler
  const handleDrilldown = (section: string) => {
    switch (section) {
      case 'claims':
        setShowClaimsDrawer(true);
        break;
      case 'reserves':
        setShowReservesDrawer(true);
        break;
      case 'decisions':
        setShowDecisionsDrawer(true);
        break;
      case 'cp1':
        setShowCP1Drawer(true);
        break;
      case 'noeval':
        setShowNoEvalDrawer(true);
        break;
      case 'aged365':
        setShowAged365Drawer(true);
        break;
      case 'budget':
        setShowBudgetDrawer(true);
        break;
      case 'export':
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
        break;
    }
  };

  // Type group breakdown for claims drawer
  const typeGroupData = data.typeGroupSummaries || [];

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
        onDrilldown={handleDrilldown}
        timestamp={data.dataDate || timestamp}
      />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CLAIMS DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showClaimsDrawer} onOpenChange={setShowClaimsDrawer}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Activity className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <SheetTitle className="text-xl">Claims Inventory Breakdown</SheetTitle>
                <SheetDescription>By type group and phase</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Claims</p>
                <p className="text-3xl font-bold text-foreground mt-1">{metrics.totalOpenClaims.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Litigation</p>
                <p className="text-3xl font-bold text-primary mt-1">{typeGroupData.find(t => t.typeGroup === 'LIT')?.grandTotal.toLocaleString() || 0}</p>
              </div>
            </div>

            {/* Type Group Breakdown Table */}
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">Type Group</TableHead>
                    <TableHead className="text-right font-bold">Claims</TableHead>
                    <TableHead className="text-right font-bold">Reserves</TableHead>
                    <TableHead className="text-right font-bold">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typeGroupData.slice(0, 10).map((tg) => (
                    <TableRow key={tg.typeGroup} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{tg.typeGroup}</TableCell>
                      <TableCell className="text-right">{tg.grandTotal.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatM(tg.reserves)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-xs">
                          {((tg.grandTotal / metrics.totalOpenClaims) * 100).toFixed(1)}%
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
      {/* RESERVES DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showReservesDrawer} onOpenChange={setShowReservesDrawer}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <SheetTitle className="text-xl">Reserves Analysis</SheetTitle>
                <SheetDescription>Portfolio reserve distribution</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Reserve Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                <p className="text-xs text-muted-foreground">Total Reserves</p>
                <p className="text-2xl font-bold text-emerald-500">{formatM(FINANCIAL_DATA.totals.totalOpenReserves)}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border">
                <p className="text-xs text-muted-foreground">Low Eval</p>
                <p className="text-2xl font-bold">{formatM(FINANCIAL_DATA.totals.totalLowEval)}</p>
              </div>
              <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
                <p className="text-xs text-warning">High Eval</p>
                <p className="text-2xl font-bold text-warning">{formatM(FINANCIAL_DATA.totals.totalHighEval)}</p>
              </div>
            </div>

            {/* Evaluation Gap Analysis */}
            <div className="p-4 rounded-xl border bg-card">
              <h4 className="font-semibold mb-4">Evaluation Gap Analysis</h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Low Eval Coverage</span>
                    <span>{((FINANCIAL_DATA.totals.totalLowEval / FINANCIAL_DATA.totals.totalOpenReserves) * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={(FINANCIAL_DATA.totals.totalLowEval / FINANCIAL_DATA.totals.totalOpenReserves) * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>High Eval Exposure</span>
                    <span>{((FINANCIAL_DATA.totals.totalHighEval / FINANCIAL_DATA.totals.totalOpenReserves) * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={(FINANCIAL_DATA.totals.totalHighEval / FINANCIAL_DATA.totals.totalOpenReserves) * 100} className="h-2 bg-warning/20" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-destructive font-medium">No Evaluation</span>
                    <span className="text-destructive">{((FINANCIAL_DATA.totals.noEvalReserves / FINANCIAL_DATA.totals.totalOpenReserves) * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={(FINANCIAL_DATA.totals.noEvalReserves / FINANCIAL_DATA.totals.totalOpenReserves) * 100} className="h-2 bg-destructive/20" />
                </div>
              </div>
            </div>

            {/* Reserve by Age */}
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">Age Bucket</TableHead>
                    <TableHead className="text-right font-bold">Claims</TableHead>
                    <TableHead className="text-right font-bold">Reserves</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.financials.byAge.map((age) => (
                    <TableRow key={age.age}>
                      <TableCell className="font-medium">{age.age}</TableCell>
                      <TableCell className="text-right">{age.claims.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatM(age.openReserves)}</TableCell>
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
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Flag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-xl">Decisions Pending</SheetTitle>
                <SheetDescription>Claims requiring executive action</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground">Pending Decisions</p>
                <p className="text-3xl font-bold text-primary">{decisionsData?.totalCount || 0}</p>
              </div>
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                <p className="text-xs text-muted-foreground">Total Exposure</p>
                <p className="text-3xl font-bold text-destructive">{formatM(decisionsData?.totalReserves || 0)}</p>
              </div>
            </div>

            {/* Claims List */}
            {decisionsData?.claims && decisionsData.claims.length > 0 ? (
              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">Claim</TableHead>
                      <TableHead className="font-bold">Team</TableHead>
                      <TableHead className="text-right font-bold">Reserves</TableHead>
                      <TableHead className="text-right font-bold">Pain Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {decisionsData.claims.slice(0, 20).map((claim, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/30">
                        <TableCell className="font-medium font-mono text-xs">{claim.claimNumber}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{claim.team}</Badge></TableCell>
                        <TableCell className="text-right">{formatK(claim.reserves)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={claim.painLevel.includes('5+') || claim.painLevel === 'Limits' ? 'destructive' : 'outline'} className="text-xs">
                            {claim.painLevel}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground border rounded-xl">
                <Flag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No pending decisions data available</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CP1 DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showCP1Drawer} onOpenChange={setShowCP1Drawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Shield className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <SheetTitle className="text-xl">CP1 Analysis</SheetTitle>
                <SheetDescription>Claims within policy limits</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* CP1 Summary */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Current CP1 Rate</p>
                <p className="text-5xl font-bold text-emerald-500">{CP1_DATA.cp1Rate}</p>
                <p className="text-sm text-muted-foreground mt-2">{CP1_DATA.totals.yes.toLocaleString()} claims within limits</p>
              </div>
            </div>

            {/* Target Progress */}
            <div className="p-4 rounded-xl border bg-card">
              <h4 className="font-semibold mb-4">Target Achievement</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Current Rate</span>
                    <span className="font-medium text-emerald-500">{CP1_DATA.cp1Rate}</span>
                  </div>
                  <Progress value={parseFloat(CP1_DATA.cp1Rate)} className="h-3" />
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <span className="text-sm">Target: 35%</span>
                  <Badge variant={parseFloat(CP1_DATA.cp1Rate) >= 35 ? "default" : "secondary"}>
                    {parseFloat(CP1_DATA.cp1Rate) >= 35 ? 'On Track' : `${(35 - parseFloat(CP1_DATA.cp1Rate)).toFixed(1)}% to go`}
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
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/20">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <SheetTitle className="text-xl">No Evaluation Claims</SheetTitle>
                <SheetDescription>Claims without damage assessment</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Risk Summary */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Claims Without Eval</p>
                  <p className="text-4xl font-bold text-warning">{FINANCIAL_DATA.totals.noEvalCount.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Exposure at Risk</p>
                  <p className="text-4xl font-bold text-warning">{formatM(FINANCIAL_DATA.totals.noEvalReserves)}</p>
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
                    {((FINANCIAL_DATA.totals.noEvalCount / metrics.totalOpenClaims) * 100).toFixed(0)}% of claims lack proper evaluation. 
                    Target completion within 48 hours to minimize exposure risk.
                  </p>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs text-muted-foreground">% of Inventory</p>
                <p className="text-lg font-bold">{((FINANCIAL_DATA.totals.noEvalCount / metrics.totalOpenClaims) * 100).toFixed(1)}%</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs text-muted-foreground">Avg per Claim</p>
                <p className="text-lg font-bold">{formatK(FINANCIAL_DATA.totals.noEvalReserves / FINANCIAL_DATA.totals.noEvalCount)}</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* AGED 365+ DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showAged365Drawer} onOpenChange={setShowAged365Drawer}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/20">
                <Clock className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <SheetTitle className="text-xl">Aged Claims (365+ Days)</SheetTitle>
                <SheetDescription>Claims exceeding one year</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Aged Summary */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-destructive/10 to-destructive/5 border border-destructive/20">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Aged 365+ Claims</p>
                  <p className="text-4xl font-bold text-destructive">{EXECUTIVE_METRICS.aging.over365Days.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Reserve Exposure</p>
                  <p className="text-4xl font-bold text-destructive">{formatM(EXECUTIVE_METRICS.aging.over365Reserves)}</p>
                </div>
              </div>
            </div>

            {/* Risk Level */}
            <div className="p-4 rounded-xl border-2 border-destructive/50 bg-destructive/5">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <h4 className="font-semibold text-destructive">High Priority</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {((EXECUTIVE_METRICS.aging.over365Days / metrics.totalOpenClaims) * 100).toFixed(1)}% of portfolio aged over 1 year.
                    Escalate for resolution review and closure strategy.
                  </p>
                </div>
              </div>
            </div>

            {/* Trend Comparison */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs text-muted-foreground">% of Inventory</p>
                <p className="text-lg font-bold">{((EXECUTIVE_METRICS.aging.over365Days / metrics.totalOpenClaims) * 100).toFixed(1)}%</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs text-muted-foreground">Avg Reserve</p>
                <p className="text-lg font-bold">{formatK(EXECUTIVE_METRICS.aging.over365Reserves / EXECUTIVE_METRICS.aging.over365Days)}</p>
              </div>
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
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-xl">Budget & Spend Analysis</SheetTitle>
                <SheetDescription>BI Litigation expenditure tracking</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* YoY Comparison */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-muted/30 border">
                <p className="text-xs text-muted-foreground">2026 YTD</p>
                <p className="text-2xl font-bold">{formatK(budgetMetrics.coverageBreakdown.bi.ytd2026)}</p>
                <Badge className="mt-2 bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Jan only</Badge>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border">
                <p className="text-xs text-muted-foreground">2025 Full Year</p>
                <p className="text-2xl font-bold">{formatM(budgetMetrics.coverageBreakdown.bi.ytd2025)}</p>
                <Badge className="mt-2" variant="outline">Complete</Badge>
              </div>
            </div>

            {/* Spend Trajectory */}
            <div className="p-4 rounded-xl border bg-card">
              <h4 className="font-semibold mb-4">Spend Trajectory</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Projected 2026</span>
                  <span className="font-mono">{formatM(budgetMetrics.coverageBreakdown.bi.ytd2026 * 12)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">2025 Actual</span>
                  <span className="font-mono">{formatM(budgetMetrics.coverageBreakdown.bi.ytd2025)}</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">YoY Change</span>
                    <div className="flex items-center gap-1">
                      {budgetMetrics.coverageBreakdown.bi.ytd2026 * 12 > budgetMetrics.coverageBreakdown.bi.ytd2025 ? (
                        <TrendingUp className="h-4 w-4 text-destructive" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-emerald-500" />
                      )}
                      <span className={budgetMetrics.coverageBreakdown.bi.ytd2026 * 12 > budgetMetrics.coverageBreakdown.bi.ytd2025 ? 'text-destructive font-medium' : 'text-emerald-500 font-medium'}>
                        {(((budgetMetrics.coverageBreakdown.bi.ytd2026 * 12 - budgetMetrics.coverageBreakdown.bi.ytd2025) / budgetMetrics.coverageBreakdown.bi.ytd2025) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Chat triggered from dashboard */}
      {showChat && <LitigationChat />}
    </>
  );
}
