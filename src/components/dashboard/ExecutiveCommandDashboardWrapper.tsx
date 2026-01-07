import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { useOpenExposureData } from "@/hooks/useOpenExposureData";
import { useDecisionsPending } from "@/hooks/useDecisionsPending";
import { useExportData } from "@/hooks/useExportData";
import { ExecutiveCommandDashboard } from "./ExecutiveCommandDashboard";
import { Loader2, DollarSign, Clock, AlertTriangle, Shield, Flag, TrendingUp, TrendingDown, FileText, Wallet, Users, Target, Activity, ExternalLink, Download } from "lucide-react";
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
import { generateClaimsInventoryReport } from "@/lib/executiveVisualReport";

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

  // Budget metrics calculation (still using placeholder for spend tracking)
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
        };
        generateCSuiteBriefing(exportData);
        generateCSuiteExcel(exportData);
        break;
    }
  };

  // Double-click to generate visual PDF report
  const handleDoubleClickReport = (section: string) => {
    toast.success('Generating executive visual report...');
    
    generateClaimsInventoryReport({
      totalClaims: totalOpenClaims,
      totalReserves,
      typeGroups: typeGroupData.map(tg => ({ name: tg.typeGroup, claims: tg.grandTotal, reserves: tg.reserves })),
      ageBreakdown: data.financials.byAge.map(a => ({ bucket: a.age, claims: a.claims, reserves: a.openReserves })),
    });
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
          dataDate: data.dataDate || timestamp,
          delta: data.delta ? {
            change: data.delta.change,
            changePercent: data.delta.changePercent,
            reservesChange: data.delta.reservesChange || 0,
            reservesChangePercent: data.delta.reservesChangePercent || 0,
            previousDate: data.delta.previousDate,
          } : undefined,
          typeGroupData: typeGroupData,
          ageBreakdown: data.financials.byAge,
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
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
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
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Claims</p>
                <p className="text-3xl font-bold text-foreground mt-1">{totalOpenClaims.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Litigation</p>
                <p className="text-3xl font-bold text-primary mt-1">{litCount.toLocaleString()}</p>
              </div>
            </div>

            {/* Type Group Breakdown Table */}
            <div>
              <h4 className="text-sm font-semibold mb-3">By Type Group</h4>
              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">Type Group</TableHead>
                      <TableHead className="text-right font-bold">Claims</TableHead>
                      <TableHead className="text-right font-bold">Reserves</TableHead>
                      <TableHead className="text-right font-bold">%</TableHead>
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
                            {((tg.grandTotal / totalOpenClaims) * 100).toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Recent Claim Reviews from Database */}
            {claimReviews.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3">Recent Claim Reviews</h4>
                {loadingDrilldown ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
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
                        {claimReviews.slice(0, 15).map((review) => (
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
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* RESERVES DRILLDOWN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sheet open={showReservesDrawer} onOpenChange={setShowReservesDrawer}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
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
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                <p className="text-xs text-muted-foreground">Total Reserves</p>
                <p className="text-2xl font-bold text-emerald-500">{formatM(totalReserves)}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border">
                <p className="text-xs text-muted-foreground">Low Eval</p>
                <p className="text-2xl font-bold">{formatM(totalLowEval)}</p>
              </div>
              <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
                <p className="text-xs text-warning">High Eval</p>
                <p className="text-2xl font-bold text-warning">{formatM(totalHighEval)}</p>
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
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground">Claims Pending</p>
                <p className="text-3xl font-bold text-primary">{pendingDecisionsCount.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border">
                <p className="text-xs text-muted-foreground">Total Exposure</p>
                <p className="text-3xl font-bold">{formatM(pendingDecisionsReserves)}</p>
              </div>
            </div>

            {/* Claims requiring decisions */}
            {decisionsData?.claims && decisionsData.claims.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3">Top Claims by Exposure</h4>
                <div className="rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">Claim</TableHead>
                        <TableHead className="font-bold">State</TableHead>
                        <TableHead className="text-right font-bold">Reserves</TableHead>
                        <TableHead className="font-bold">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {decisionsData.claims.slice(0, 15).map((claim, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs">{claim.claimNumber}</TableCell>
                          <TableCell className="text-sm">{claim.state}</TableCell>
                          <TableCell className="text-right font-medium">{formatK(claim.reserves)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{claim.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* LOR Offers from Database */}
            {lorOffers.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3">Active LOR Offers</h4>
                {loadingDrilldown ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-bold">Claim</TableHead>
                          <TableHead className="text-right font-bold">Offer</TableHead>
                          <TableHead className="font-bold">Expires</TableHead>
                          <TableHead className="font-bold">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lorOffers.slice(0, 10).map((offer) => (
                          <TableRow key={offer.id} className="hover:bg-muted/30">
                            <TableCell className="font-mono text-xs">{offer.claim_number}</TableCell>
                            <TableCell className="text-right font-medium">{formatK(offer.offer_amount)}</TableCell>
                            <TableCell className="text-sm">{format(new Date(offer.expires_date), 'MMM d')}</TableCell>
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
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
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
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
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
            <div className="p-6 rounded-xl bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Claims Without Eval</p>
                  <p className="text-4xl font-bold text-warning">{noEvalCount.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Exposure at Risk</p>
                  <p className="text-4xl font-bold text-warning">{formatM(noEvalReserves)}</p>
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
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
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
              <div className="p-4 rounded-xl bg-muted/30 border">
                <p className="text-xs text-muted-foreground">Aged 365+ Claims</p>
                <p className="text-3xl font-bold text-red-600">{aged365Plus.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border">
                <p className="text-xs text-muted-foreground">Reserve Exposure</p>
                <p className="text-3xl font-bold text-red-600">{formatM(aged365Reserves)}</p>
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
            <div>
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
