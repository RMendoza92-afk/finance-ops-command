import { useMemo, useState, useEffect, useCallback } from "react";
import { useOpenExposureData, OpenExposurePhase, TypeGroupSummary } from "@/hooks/useOpenExposureData";
import { useExportData, ExportableData } from "@/hooks/useExportData";
import { KPICard } from "@/components/KPICard";
import { Loader2, FileStack, Clock, AlertTriangle, TrendingUp, DollarSign, Wallet, Car, MapPin, MessageSquare, Send, CheckCircle2, Target, Users, Flag, Eye, RefreshCw, Calendar, Sparkles, TestTube, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, addDays } from "date-fns";

type ClaimReview = Tables<"claim_reviews">;

const REVIEWERS = ['Richie Mendoza'];

export function OpenInventoryDashboard() {
  const { data, loading, error } = useOpenExposureData();
  const { exportBoth } = useExportData();
  const timestamp = format(new Date(), 'MMMM d, yyyy h:mm a');

  const [selectedClaimFilter, setSelectedClaimFilter] = useState<string>('');
  const [selectedReviewer, setSelectedReviewer] = useState<string>('');
  const [directive, setDirective] = useState<string>('');
  const [deploying, setDeploying] = useState(false);
  const [reviews, setReviews] = useState<ClaimReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [deadline, setDeadline] = useState<string>(format(addDays(new Date(), 3), 'yyyy-MM-dd'));
  const [aiSummary, setAiSummary] = useState<string>('');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [testMode, setTestMode] = useState(true);
  
  const formatNumber = (val: number) => val.toLocaleString();
  const formatCurrency = (val: number) => `$${(val / 1000000).toFixed(1)}M`;
  const formatCurrencyK = (val: number) => `$${(val / 1000).toFixed(0)}K`;
  const formatCurrencyFull = (val: number) => `$${val.toLocaleString()}`;
  const formatCurrencyFullValue = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  // Fetch existing reviews
  const fetchReviews = async () => {
    const { data: reviewData, error: reviewError } = await supabase
      .from('claim_reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (!reviewError && reviewData) {
      setReviews(reviewData);
    }
    setLoadingReviews(false);
  };

  useEffect(() => {
    fetchReviews();

    // Set up realtime subscription
    const channel = supabase
      .channel('claim_reviews_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'claim_reviews' },
        (payload) => {
          console.log('Realtime update:', payload);
          if (payload.eventType === 'INSERT') {
            setReviews(prev => [payload.new as ClaimReview, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setReviews(prev => prev.map(r => 
              r.id === (payload.new as ClaimReview).id ? payload.new as ClaimReview : r
            ));
          } else if (payload.eventType === 'DELETE') {
            setReviews(prev => prev.filter(r => r.id !== (payload.old as ClaimReview).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Calculate review stats
  const reviewStats = useMemo(() => {
    const assigned = reviews.filter(r => r.status === 'assigned').length;
    const inReview = reviews.filter(r => r.status === 'in_review').length;
    const completed = reviews.filter(r => r.status === 'completed').length;
    const flagged = reviews.filter(r => r.status === 'flagged').length;
    const totalReserves = reviews.reduce((sum, r) => sum + (Number(r.reserves) || 0), 0);
    
    return { total: reviews.length, assigned, inReview, completed, flagged, totalReserves };
  }, [reviews]);

  // Known totals from user source (January 2, 2026)
  const KNOWN_TOTALS = {
    totalOpenClaims: 10109,
    totalOpenExposures: 19501,
    atr: { claims: 3994, exposures: 8385 },
    lit: { claims: 3747, exposures: 6161 },
    bi3: { claims: 2227, exposures: 4616 },
    earlyBI: { claims: 141, exposures: 339 },
    flagged: 252,
    newClaims: 1,
    closed: 2,
  };

  // Financial reserves by age bucket (placeholder data - replace with actual)
  // Open Reserves vs Low/High Evaluation - null means no evaluation
  const FINANCIAL_DATA = {
    byAge: [
      { age: '365+ Days', claims: 5630, openReserves: 48750000, lowEval: 28500000, highEval: 32100000 },
      { age: '181-365 Days', claims: 3953, openReserves: 31200000, lowEval: 18200000, highEval: 20500000 },
      { age: '61-180 Days', claims: 5576, openReserves: 28900000, lowEval: 10800000, highEval: 12200000 },
      { age: 'Under 60 Days', claims: 8420, openReserves: 18600000, lowEval: 3600000, highEval: 3800000 },
    ],
    byQueue: [
      { queue: 'Litigation', openReserves: 68500000, lowEval: 38200000, highEval: 42800000, noEvalCount: 0 },
      { queue: 'ATR', openReserves: 34200000, lowEval: 14500000, highEval: 16200000, noEvalCount: 1245 },
      { queue: 'BI3', openReserves: 18900000, lowEval: 6800000, highEval: 7600000, noEvalCount: 892 },
      { queue: 'Early BI', openReserves: 5850000, lowEval: 1600000, highEval: 2000000, noEvalCount: 141 },
    ],
    totals: {
      totalOpenReserves: 127450000,
      totalLowEval: 61100000,  // $61.1M
      totalHighEval: 68600000, // $68.6M
      noEvalCount: 2278,
    }
  };

  // Rear Ends - Texas Areas 101-110 | Loss Desc: IV R/E CV only
  const TEXAS_REAR_END_DATA = {
    lossDescription: 'IV R/E CV',
    summary: { totalClaims: 2458, totalReserves: 33000000, lowEval: 9260000, highEval: 10800000 },
    byArea: [
      { area: '101 EL PASO', claims: 412, reserves: 5600000, lowEval: 1550000, highEval: 1810000 },
      { area: '102 RIO GRANDE/VALL', claims: 318, reserves: 4200000, lowEval: 1170000, highEval: 1360000 },
      { area: '103 LAREDO/DEL RIO', claims: 245, reserves: 3600000, lowEval: 1010000, highEval: 1180000 },
      { area: '104 CORPUS', claims: 198, reserves: 2800000, lowEval: 780000, highEval: 910000 },
      { area: '105 SAN ANTONIO', claims: 387, reserves: 4900000, lowEval: 1370000, highEval: 1600000 },
      { area: '106 WEST TEXAS', claims: 156, reserves: 2100000, lowEval: 590000, highEval: 690000 },
      { area: '107 HOUSTON', claims: 289, reserves: 3400000, lowEval: 950000, highEval: 1110000 },
      { area: '109 DALLAS', claims: 142, reserves: 2000000, lowEval: 560000, highEval: 650000 },
      { area: '110 AUSTIN', claims: 98, reserves: 1500000, lowEval: 420000, highEval: 490000 },
    ],
    byAge: [
      { age: '365+ Days', claims: 983, reserves: 13600000, lowEval: 3800000, highEval: 4450000 },
      { age: '181-365 Days', claims: 712, reserves: 9800000, lowEval: 2740000, highEval: 3200000 },
      { age: '61-180 Days', claims: 498, reserves: 6000000, lowEval: 1680000, highEval: 1960000 },
      { age: 'Under 60 Days', claims: 265, reserves: 3600000, lowEval: 1040000, highEval: 1190000 },
    ],
  };

  // Calculate derived metrics
  const metrics = useMemo(() => {
    if (!data) return null;

    const litTotal = KNOWN_TOTALS.lit.claims;
    const aged365Plus = data.totals.age365Plus;
    const agedPct = KNOWN_TOTALS.totalOpenClaims > 0 
      ? ((aged365Plus / KNOWN_TOTALS.totalOpenClaims) * 100).toFixed(1)
      : '0';

    // Top 5 phases by count
    const topPhases = [...data.litPhases]
      .sort((a, b) => b.grandTotal - a.grandTotal)
      .slice(0, 8);

    // Age distribution for chart with financials
    const ageDistribution = FINANCIAL_DATA.byAge.map(item => ({
      ...item,
      fill: item.age === '365+ Days' ? 'hsl(var(--destructive))' :
            item.age === '181-365 Days' ? 'hsl(var(--warning))' :
            item.age === '61-180 Days' ? 'hsl(var(--accent))' :
            'hsl(var(--success))'
    }));

    // Type groups from known data
    const typeGroups = [
      { typeGroup: 'ATR', claims: KNOWN_TOTALS.atr.claims, exposures: KNOWN_TOTALS.atr.exposures },
      { typeGroup: 'Litigation', claims: KNOWN_TOTALS.lit.claims, exposures: KNOWN_TOTALS.lit.exposures },
      { typeGroup: 'BI3', claims: KNOWN_TOTALS.bi3.claims, exposures: KNOWN_TOTALS.bi3.exposures },
      { typeGroup: 'Early BI', claims: KNOWN_TOTALS.earlyBI.claims, exposures: KNOWN_TOTALS.earlyBI.exposures },
    ];

    return {
      litTotal,
      aged365Plus,
      agedPct,
      topPhases,
      ageDistribution,
      typeGroups,
      totalOpenClaims: KNOWN_TOTALS.totalOpenClaims,
      totalOpenExposures: KNOWN_TOTALS.totalOpenExposures,
      flagged: KNOWN_TOTALS.flagged,
      financials: FINANCIAL_DATA,
    };
  }, [data]);

  // Export handlers for double-click
  const handleExportSummary = useCallback(() => {
    if (!metrics) return;
    const medianEval = (metrics.financials.totals.totalLowEval + metrics.financials.totals.totalHighEval) / 2;
    const manager = selectedReviewer || 'Richie Mendoza';
    const exportData: ExportableData = {
      title: 'Open Inventory Summary',
      subtitle: 'Claims and Financial Overview',
      timestamp,
      affectsManager: manager,
      summary: {
        'Total Open Claims': formatNumber(metrics.totalOpenClaims),
        'Total Open Exposures': formatNumber(metrics.totalOpenExposures),
        'Open Reserves': formatCurrencyFullValue(metrics.financials.totals.totalOpenReserves),
        'Median Evaluation': formatCurrencyFullValue(medianEval),
        'No Evaluation': formatNumber(metrics.financials.totals.noEvalCount),
      },
      columns: ['Metric', 'Value'],
      rows: [
        ['Total Open Claims', formatNumber(metrics.totalOpenClaims)],
        ['Total Open Exposures', formatNumber(metrics.totalOpenExposures)],
        ['Open Reserves', formatCurrencyFullValue(metrics.financials.totals.totalOpenReserves)],
        ['Low Evaluation', formatCurrencyFullValue(metrics.financials.totals.totalLowEval)],
        ['High Evaluation', formatCurrencyFullValue(metrics.financials.totals.totalHighEval)],
        ['Median Evaluation', formatCurrencyFullValue(medianEval)],
        ['No Evaluation Count', formatNumber(metrics.financials.totals.noEvalCount)],
        ['Flagged Claims', formatNumber(metrics.flagged)],
      ],
    };
    exportBoth(exportData);
    toast.success('PDF + Excel exported: Open Inventory Summary');
  }, [exportBoth, timestamp, metrics, selectedReviewer]);

  const handleExportByAge = useCallback(() => {
    if (!metrics) return;
    const manager = selectedReviewer || 'Richie Mendoza';
    const exportData: ExportableData = {
      title: 'Reserves vs Evaluation by Age',
      subtitle: 'Financial breakdown by claim age bucket',
      timestamp,
      affectsManager: manager,
      columns: ['Age Bucket', 'Claims', 'Open Reserves', 'Low Eval', 'High Eval', 'Median Eval'],
      rows: metrics.ageDistribution.map(item => [
        item.age,
        item.claims,
        formatCurrencyFullValue(item.openReserves),
        formatCurrencyFullValue(item.lowEval),
        formatCurrencyFullValue(item.highEval),
        formatCurrencyFullValue((item.lowEval + item.highEval) / 2),
      ]),
    };
    exportBoth(exportData);
    toast.success('PDF + Excel exported: Reserves by Age');
  }, [exportBoth, timestamp, metrics, selectedReviewer]);

  const handleExportByQueue = useCallback(() => {
    if (!metrics) return;
    const manager = selectedReviewer || 'Richie Mendoza';
    const exportData: ExportableData = {
      title: 'Reserve Adequacy by Queue',
      subtitle: 'Queue-level reserve analysis',
      timestamp,
      affectsManager: manager,
      columns: ['Queue', 'Open Reserves', 'Low Eval', 'High Eval', 'Median Eval', 'Variance %', 'Status'],
      rows: metrics.financials.byQueue.map(queue => {
        const qMedian = (queue.lowEval + queue.highEval) / 2;
        const qVariance = queue.openReserves - qMedian;
        const qVariancePct = ((qVariance / qMedian) * 100).toFixed(1);
        const qIsOver = qVariance > 0;
        return [
          queue.queue,
          formatCurrencyFullValue(queue.openReserves),
          formatCurrencyFullValue(queue.lowEval),
          formatCurrencyFullValue(queue.highEval),
          formatCurrencyFullValue(qMedian),
          `${qIsOver ? '+' : ''}${qVariancePct}%`,
          qIsOver ? 'Over-reserved' : 'Under-reserved',
        ];
      }),
    };
    exportBoth(exportData);
    toast.success('PDF + Excel exported: Reserve Adequacy by Queue');
  }, [exportBoth, timestamp, metrics, selectedReviewer]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading open inventory data...</span>
      </div>
    );
  }

  if (error || !data || !metrics) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Unable to load open exposure data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Export Hint */}
      <div className="bg-muted/30 border border-border/50 rounded-lg px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Download className="h-3.5 w-3.5" />
        <span>Double-click any section to export PDF + Excel</span>
      </div>

      {/* Summary Banner with Financials */}
      <div 
        className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-5 cursor-pointer hover:border-primary/50 transition-colors"
        onDoubleClick={handleExportSummary}
        title="Double-click to export"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Open Inventory: {formatNumber(metrics.totalOpenClaims)} Claims</h2>
            <p className="text-sm text-muted-foreground mt-1">
              As of January 2, 2026 • <span className="font-semibold text-foreground">{formatNumber(metrics.totalOpenExposures)}</span> open exposures
            </p>
          </div>
          <div className="flex gap-8 items-center">
            <div className="text-center border-r border-border pr-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Open Reserves</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(metrics.financials.totals.totalOpenReserves)}</p>
            </div>
            <div className="text-center border-r border-border pr-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Low Eval</p>
              <p className="text-2xl font-bold text-accent-foreground">{formatCurrency(metrics.financials.totals.totalLowEval)}</p>
            </div>
            <div className="text-center border-r border-border pr-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">High Eval</p>
              <p className="text-2xl font-bold text-warning">{formatCurrency(metrics.financials.totals.totalHighEval)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">No Evaluation</p>
              <p className="text-2xl font-bold text-muted-foreground">{formatNumber(metrics.financials.totals.noEvalCount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial KPI Cards with Reserve Adequacy */}
      {(() => {
        const medianEval = (metrics.financials.totals.totalLowEval + metrics.financials.totals.totalHighEval) / 2;
        const reserves = metrics.financials.totals.totalOpenReserves;
        const variance = reserves - medianEval;
        const variancePct = ((variance / medianEval) * 100).toFixed(1);
        const isOverReserved = variance > 0;
        
        return (
          <>
            <div className="grid grid-cols-5 gap-4">
              <KPICard
                title="Total Open Reserves"
                value={formatCurrency(reserves)}
                subtitle="Outstanding liability"
                icon={Wallet}
                variant="default"
              />
              <KPICard
                title="Low Evaluation"
                value={formatCurrency(metrics.financials.totals.totalLowEval)}
                subtitle="Minimum exposure estimate"
                icon={DollarSign}
                variant="default"
              />
              <KPICard
                title="Median Evaluation"
                value={formatCurrency(medianEval)}
                subtitle="(Low + High) / 2"
                icon={Target}
                variant="default"
              />
              <KPICard
                title="High Evaluation"
                value={formatCurrency(metrics.financials.totals.totalHighEval)}
                subtitle="Maximum exposure estimate"
                icon={DollarSign}
                variant="warning"
              />
              <div className={`rounded-xl p-4 border-2 ${isOverReserved ? 'bg-success/10 border-success/40' : 'bg-destructive/10 border-destructive/40'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {isOverReserved ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-xs font-medium text-muted-foreground uppercase">Reserve Adequacy</span>
                </div>
                <p className={`text-2xl font-bold ${isOverReserved ? 'text-success' : 'text-destructive'}`}>
                  {isOverReserved ? '+' : ''}{variancePct}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isOverReserved ? 'Over-reserved' : 'Under-reserved'} by {formatCurrency(Math.abs(variance))}
                </p>
              </div>
            </div>

            {/* Reserve Adequacy by Queue */}
            <div 
              className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-primary/50 transition-colors"
              onDoubleClick={handleExportByQueue}
              title="Double-click to export"
            >
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Reserve Adequacy by Queue</h3>
              <div className="grid grid-cols-4 gap-4">
                {metrics.financials.byQueue.map((queue) => {
                  const qMedian = (queue.lowEval + queue.highEval) / 2;
                  const qVariance = queue.openReserves - qMedian;
                  const qVariancePct = ((qVariance / qMedian) * 100).toFixed(1);
                  const qIsOver = qVariance > 0;
                  
                  return (
                    <div key={queue.queue} className={`rounded-lg p-4 border ${qIsOver ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-foreground">{queue.queue}</span>
                        <span className={`text-sm font-bold ${qIsOver ? 'text-success' : 'text-destructive'}`}>
                          {qIsOver ? '+' : ''}{qVariancePct}%
                        </span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Reserves</span>
                          <span className="font-medium">{formatCurrency(queue.openReserves)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Median Eval</span>
                          <span className="font-medium">{formatCurrency(qMedian)}</span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-1 mt-1">
                          <span className="text-muted-foreground">{qIsOver ? 'Over' : 'Under'}</span>
                          <span className={`font-bold ${qIsOver ? 'text-success' : 'text-destructive'}`}>
                            {qIsOver ? '+' : '-'}{formatCurrency(Math.abs(qVariance))}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        );
      })()}

      {/* Charts Row - Financials by Age */}
      <div className="grid grid-cols-2 gap-6">
        {/* Reserves vs Eval by Age Bucket */}
        <div 
          className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-primary/50 transition-colors"
          onDoubleClick={handleExportByAge}
          title="Double-click to export"
        >
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Reserves vs Evaluation by Age</h3>
          <p className="text-xs text-muted-foreground mb-4">Open reserves compared to low/high evaluation by claim age</p>
          
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.ageDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${(v/1000000).toFixed(0)}M`} />
                <YAxis type="category" dataKey="age" stroke="hsl(var(--muted-foreground))" fontSize={11} width={85} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number, name: string) => [formatCurrencyFull(value), name]}
                />
                <Bar dataKey="openReserves" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Open Reserves" />
                <Bar dataKey="lowEval" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} name="Low Eval" />
                <Bar dataKey="highEval" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} name="High Eval" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex gap-6 mt-4 pt-4 border-t border-border justify-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-primary"></div>
              <span className="text-xs text-muted-foreground">Open Reserves</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{backgroundColor: 'hsl(var(--accent))'}}></div>
              <span className="text-xs text-muted-foreground">Low Eval</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-warning"></div>
              <span className="text-xs text-muted-foreground">High Eval</span>
            </div>
          </div>
        </div>

        {/* Reserves by Queue */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Reserves vs Evaluation by Queue</h3>
          <p className="text-xs text-muted-foreground mb-4">Open reserves & evaluation by handling unit</p>
          
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.financials.byQueue} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="queue" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${(v/1000000).toFixed(0)}M`} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number | null, name: string) => [
                    value !== null ? formatCurrencyFull(value) : 'No Evaluation', 
                    name
                  ]}
                />
                <Bar dataKey="openReserves" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Open Reserves" />
                <Bar dataKey="lowEval" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Low Eval" />
                <Bar dataKey="highEval" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} name="High Eval" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex gap-6 mt-4 pt-4 border-t border-border justify-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-primary"></div>
              <span className="text-xs text-muted-foreground">Open Reserves</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{backgroundColor: 'hsl(var(--accent))'}}></div>
              <span className="text-xs text-muted-foreground">Low Eval</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-warning"></div>
              <span className="text-xs text-muted-foreground">High Eval</span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary Table */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Financial Summary by Age</h3>
        <p className="text-xs text-muted-foreground mb-4">Claims, reserves, and evaluation amounts by age bucket</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Age Bucket</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Claims</th>
                <th className="text-right py-2 px-3 text-primary font-medium">Open Reserves</th>
                <th className="text-right py-2 px-3 text-accent-foreground font-medium">Low Eval</th>
                <th className="text-right py-2 px-3 text-warning font-medium">High Eval</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Avg Reserve</th>
              </tr>
            </thead>
            <tbody>
              {metrics.financials.byAge.map((item) => (
                <tr key={item.age} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-3 font-medium">{item.age}</td>
                  <td className="py-2 px-3 text-right">{formatNumber(item.claims)}</td>
                  <td className="py-2 px-3 text-right text-primary font-semibold">{formatCurrency(item.openReserves)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(item.lowEval)}</td>
                  <td className="py-2 px-3 text-right text-warning">{formatCurrency(item.highEval)}</td>
                  <td className="py-2 px-3 text-right text-muted-foreground">{formatCurrencyFull(Math.round(item.openReserves / item.claims))}</td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-bold">
                <td className="py-2 px-3">Total</td>
                <td className="py-2 px-3 text-right">{formatNumber(metrics.financials.byAge.reduce((s, i) => s + i.claims, 0))}</td>
                <td className="py-2 px-3 text-right text-primary">{formatCurrency(metrics.financials.totals.totalOpenReserves)}</td>
                <td className="py-2 px-3 text-right">{formatCurrency(metrics.financials.totals.totalLowEval)}</td>
                <td className="py-2 px-3 text-right text-warning">{formatCurrency(metrics.financials.totals.totalHighEval)}</td>
                <td className="py-2 px-3 text-right text-muted-foreground">{formatCurrencyFull(Math.round(metrics.financials.totals.totalOpenReserves / metrics.financials.byAge.reduce((s, i) => s + i.claims, 0)))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Claims by Queue */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Claims by Queue</h3>
          <p className="text-xs text-muted-foreground mb-4">Claims vs Exposures by handling unit</p>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.typeGroups} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="typeGroup" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={formatNumber} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number, name: string) => [formatNumber(value), name === 'claims' ? 'Claims' : 'Exposures']}
                />
                <Bar dataKey="claims" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Claims" />
                <Bar dataKey="exposures" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Exposures" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex gap-6 mt-4 pt-4 border-t border-border justify-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-primary"></div>
              <span className="text-xs text-muted-foreground">Claims</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{backgroundColor: 'hsl(var(--accent))'}}></div>
              <span className="text-xs text-muted-foreground">Exposures</span>
            </div>
          </div>
        </div>

        {/* Inventory Age */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Inventory Age Distribution</h3>
          <p className="text-xs text-muted-foreground mb-4">Claim counts by age bucket</p>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.ageDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={formatNumber} />
                <YAxis type="category" dataKey="age" stroke="hsl(var(--muted-foreground))" fontSize={11} width={85} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number) => [formatNumber(value), 'Claims']}
                />
                <Bar dataKey="claims" radius={[0, 4, 4, 0]}>
                  {metrics.ageDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex gap-4 mt-4 pt-4 border-t border-border justify-center flex-wrap">
            {metrics.ageDistribution.map(item => (
              <div key={item.age} className="text-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: item.fill }}></div>
                  <span className="text-xs text-muted-foreground">{item.age}</span>
                </div>
                <p className="text-sm font-semibold">{formatNumber(item.claims)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Litigation Phases Table */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Litigation Evaluation Phases</h3>
        <p className="text-xs text-muted-foreground mb-4">Open LIT files by phase and age — focus on 365+ day aged claims</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Evaluation Phase</th>
                <th className="text-right py-2 px-3 text-destructive font-medium">365+ Days</th>
                <th className="text-right py-2 px-3 text-warning font-medium">181-365 Days</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">61-180 Days</th>
                <th className="text-right py-2 px-3 text-success font-medium">Under 60 Days</th>
                <th className="text-right py-2 px-3 text-foreground font-medium">Total</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">% Aged</th>
              </tr>
            </thead>
            <tbody>
              {metrics.topPhases.map((phase) => {
                const agedPct = phase.grandTotal > 0 
                  ? ((phase.total365Plus / phase.grandTotal) * 100).toFixed(0)
                  : '0';
                return (
                  <tr key={phase.phase} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{phase.phase}</td>
                    <td className="py-2 px-3 text-right text-destructive font-semibold">{formatNumber(phase.total365Plus)}</td>
                    <td className="py-2 px-3 text-right text-warning">{formatNumber(phase.total181To365)}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{formatNumber(phase.total61To180)}</td>
                    <td className="py-2 px-3 text-right text-success">{formatNumber(phase.totalUnder60)}</td>
                    <td className="py-2 px-3 text-right font-bold">{formatNumber(phase.grandTotal)}</td>
                    <td className={`py-2 px-3 text-right font-medium ${parseInt(agedPct) > 70 ? 'text-destructive' : parseInt(agedPct) > 50 ? 'text-warning' : 'text-muted-foreground'}`}>
                      {agedPct}%
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/50 font-bold">
                <td className="py-2 px-3">LIT Total</td>
                <td className="py-2 px-3 text-right text-destructive">{formatNumber(data.litPhases.reduce((s, p) => s + p.total365Plus, 0))}</td>
                <td className="py-2 px-3 text-right text-warning">{formatNumber(data.litPhases.reduce((s, p) => s + p.total181To365, 0))}</td>
                <td className="py-2 px-3 text-right">{formatNumber(data.litPhases.reduce((s, p) => s + p.total61To180, 0))}</td>
                <td className="py-2 px-3 text-right text-success">{formatNumber(data.litPhases.reduce((s, p) => s + p.totalUnder60, 0))}</td>
                <td className="py-2 px-3 text-right">{formatNumber(metrics.litTotal)}</td>
                <td className="py-2 px-3 text-right text-destructive">
                  {((data.litPhases.reduce((s, p) => s + p.total365Plus, 0) / metrics.litTotal) * 100).toFixed(0)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK ACTION: Rear Ends - Texas Areas 101-110 with In-Platform Directive */}
      <div className="bg-gradient-to-r from-warning/10 to-warning/5 border-2 border-warning/40 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/20">
              <Target className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
                Quick Action: Rear Ends — Texas 101-110 | IV R/E CV
                <span className="px-2 py-0.5 bg-warning/20 text-warning text-xs rounded-full font-medium">ACTION REQUIRED</span>
              </h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> West Texas Region • Loss Desc: {TEXAS_REAR_END_DATA.lossDescription} • {TEXAS_REAR_END_DATA.summary.totalClaims} open claims
              </p>
            </div>
          </div>
          <div className="flex gap-6 items-center">
            <div className="text-center border-r border-border pr-4">
              <p className="text-xs text-muted-foreground uppercase">Open Reserves</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(TEXAS_REAR_END_DATA.summary.totalReserves)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase">Low Eval</p>
              <p className="text-lg font-semibold text-muted-foreground">{formatCurrency(TEXAS_REAR_END_DATA.summary.lowEval)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase">High Eval</p>
              <p className="text-lg font-semibold text-muted-foreground">{formatCurrency(TEXAS_REAR_END_DATA.summary.highEval)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* By Area - Reserves Emphasized */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">By Area Code</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {TEXAS_REAR_END_DATA.byArea.map((item) => (
                <div key={item.area} className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-sm font-medium">{item.area}</span>
                  <div className="flex gap-3 text-xs items-center">
                    <span className="text-muted-foreground">{item.claims} claims</span>
                    <span className="text-primary font-bold text-sm">{formatCurrencyK(item.reserves)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* By Age - Reserves Emphasized */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">By Age Bucket</h4>
            <div className="space-y-2">
              {TEXAS_REAR_END_DATA.byAge.map((item) => (
                <div key={item.age} className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className={`text-sm font-medium ${
                    item.age === '365+ Days' ? 'text-destructive' : 
                    item.age === '181-365 Days' ? 'text-warning' : ''
                  }`}>{item.age}</span>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{formatCurrencyK(item.reserves)} reserves</p>
                    <p className="text-xs text-muted-foreground">
                      {item.claims} claims • {formatCurrencyK(item.highEval)} high
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deploy Directive - In-Platform */}
          <div className="bg-card rounded-lg border border-primary/30 p-4">
            <h4 className="text-xs font-semibold text-primary uppercase mb-3 flex items-center gap-2">
              <Target className="h-3 w-3" /> Deploy Review Directive
            </h4>
            <RadioGroup 
              value={selectedClaimFilter} 
              onValueChange={(val) => {
                setSelectedClaimFilter(val);
                setAiSummary('');
              }}
              className="grid grid-cols-2 gap-1"
            >
              <label className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs ${selectedClaimFilter === 'all' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}>
                <RadioGroupItem value="all" id="all-claims" />
                <div>
                  <span className="font-medium">All ({TEXAS_REAR_END_DATA.summary.totalClaims.toLocaleString()})</span>
                </div>
              </label>
              <label className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs ${selectedClaimFilter === 'aged-365' ? 'border-destructive bg-destructive/10' : 'border-border hover:bg-muted/50'}`}>
                <RadioGroupItem value="aged-365" id="aged-365" />
                <div>
                  <span className="font-medium text-destructive">365+ Days ({TEXAS_REAR_END_DATA.byAge[0].claims})</span>
                </div>
              </label>
              <label className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs ${selectedClaimFilter === 'aged-181-365' ? 'border-warning bg-warning/10' : 'border-border hover:bg-muted/50'}`}>
                <RadioGroupItem value="aged-181-365" id="aged-181-365" />
                <div>
                  <span className="font-medium text-warning">181-365 Days ({TEXAS_REAR_END_DATA.byAge[1].claims})</span>
                </div>
              </label>
              <label className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs ${selectedClaimFilter === 'top-3-areas' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}>
                <RadioGroupItem value="top-3-areas" id="top-3-areas" />
                <div>
                  <span className="font-medium">Top 3 Areas ({(TEXAS_REAR_END_DATA.byArea[0].claims + TEXAS_REAR_END_DATA.byArea[4].claims + TEXAS_REAR_END_DATA.byArea[1].claims).toLocaleString()})</span>
                </div>
              </label>
            </RadioGroup>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <select
                value={selectedReviewer}
                onChange={(e) => {
                  setSelectedReviewer(e.target.value);
                  setAiSummary('');
                }}
                className="p-2 rounded border border-border bg-background text-xs"
              >
                <option value="">Reviewer...</option>
                {REVIEWERS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => {
                    setDeadline(e.target.value);
                    setAiSummary('');
                  }}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="flex-1 p-2 rounded border border-border bg-background text-xs"
                />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs">
              <label className="flex items-center gap-1 cursor-pointer">
                <Switch checked={testMode} onCheckedChange={setTestMode} className="scale-75" />
                <span className="text-muted-foreground">SMS Test</span>
              </label>
              {selectedClaimFilter && (
                <span className="text-muted-foreground">
                  ${(selectedClaimFilter === 'aged-365' ? TEXAS_REAR_END_DATA.byAge[0].reserves / 1000000 :
                     selectedClaimFilter === 'aged-181-365' ? TEXAS_REAR_END_DATA.byAge[1].reserves / 1000000 :
                     selectedClaimFilter === 'top-3-areas' ? (TEXAS_REAR_END_DATA.byArea[0].reserves + TEXAS_REAR_END_DATA.byArea[4].reserves + TEXAS_REAR_END_DATA.byArea[1].reserves) / 1000000 :
                     TEXAS_REAR_END_DATA.summary.totalReserves / 1000000).toFixed(1)}M at risk
                </span>
              )}
            </div>

            {/* Buttons Row */}
            <div className="mt-3 flex gap-2">
              <Button 
                className="flex-1" 
                variant="outline"
                size="sm"
                disabled={!selectedClaimFilter || !selectedReviewer || generatingSummary}
                onClick={async () => {
                  setGeneratingSummary(true);
                  const getFilterData = () => {
                    switch (selectedClaimFilter) {
                      case 'all': return { count: TEXAS_REAR_END_DATA.summary.totalClaims, reserves: TEXAS_REAR_END_DATA.summary.totalReserves };
                      case 'aged-365': return { count: TEXAS_REAR_END_DATA.byAge[0].claims, reserves: TEXAS_REAR_END_DATA.byAge[0].reserves };
                      case 'aged-181-365': return { count: TEXAS_REAR_END_DATA.byAge[1].claims, reserves: TEXAS_REAR_END_DATA.byAge[1].reserves };
                      case 'top-3-areas': return { 
                        count: TEXAS_REAR_END_DATA.byArea[0].claims + TEXAS_REAR_END_DATA.byArea[4].claims + TEXAS_REAR_END_DATA.byArea[1].claims,
                        reserves: TEXAS_REAR_END_DATA.byArea[0].reserves + TEXAS_REAR_END_DATA.byArea[4].reserves + TEXAS_REAR_END_DATA.byArea[1].reserves,
                      };
                      default: return { count: 0, reserves: 0 };
                    }
                  };
                  const filterData = getFilterData();
                  
                  try {
                    const { data, error } = await supabase.functions.invoke('generate-directive-summary', {
                      body: {
                        claimFilter: selectedClaimFilter,
                        claimCount: filterData.count,
                        region: 'Texas 101-110',
                        lossDescription: TEXAS_REAR_END_DATA.lossDescription,
                        reviewer: selectedReviewer,
                        deadline: format(new Date(deadline), 'MMMM d, yyyy'),
                        totalReserves: filterData.reserves,
                      }
                    });
                    if (error) throw error;
                    setAiSummary(data.summary);
                  } catch (err: any) {
                    console.error('Summary error:', err);
                    setAiSummary(`DIRECTIVE: Review ${filterData.count} claims. Exposure: $${(filterData.reserves/1000000).toFixed(1)}M. Due: ${format(new Date(deadline), 'MMM d')}. Assigned: ${selectedReviewer}.`);
                  }
                  setGeneratingSummary(false);
                }}
              >
                {generatingSummary ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                {generatingSummary ? '' : 'AI Summary'}
              </Button>
            </div>

            {/* Compact AI Summary */}
            {aiSummary && (
              <div className="mt-2 p-2 rounded bg-primary/10 border border-primary/30 text-xs">
                <p className="text-foreground leading-snug">{aiSummary}</p>
              </div>
            )}

            <Button 
              className="w-full mt-2" 
              variant="default"
              size="sm"
              disabled={!selectedClaimFilter || !selectedReviewer || !aiSummary || deploying}
              onClick={async () => {
                setDeploying(true);
                
                // Get filter-specific data
                const getFilterData = () => {
                  switch (selectedClaimFilter) {
                    case 'all': return { count: TEXAS_REAR_END_DATA.summary.totalClaims, ageBucket: 'Mixed', areas: TEXAS_REAR_END_DATA.byArea };
                    case 'aged-365': return { count: TEXAS_REAR_END_DATA.byAge[0].claims, ageBucket: '365+ Days', areas: TEXAS_REAR_END_DATA.byArea };
                    case 'aged-181-365': return { count: TEXAS_REAR_END_DATA.byAge[1].claims, ageBucket: '181-365 Days', areas: TEXAS_REAR_END_DATA.byArea };
                    case 'top-3-areas': return { 
                      count: TEXAS_REAR_END_DATA.byArea[0].claims + TEXAS_REAR_END_DATA.byArea[4].claims + TEXAS_REAR_END_DATA.byArea[1].claims,
                      ageBucket: 'Mixed',
                      areas: [TEXAS_REAR_END_DATA.byArea[0], TEXAS_REAR_END_DATA.byArea[4], TEXAS_REAR_END_DATA.byArea[1]] // El Paso, San Antonio, Rio Grande
                    };
                    case 'under-60': return { count: TEXAS_REAR_END_DATA.byAge[3].claims, ageBucket: 'Under 60 Days', areas: TEXAS_REAR_END_DATA.byArea };
                    default: return { count: 0, ageBucket: '', areas: [] };
                  }
                };
                const filterData = getFilterData();
                
                // Create sample claims for the database (limited to 15 for demo)
                const claimsToInsert = [];
                const areas = filterData.areas;
                const sampleSize = Math.min(filterData.count, 15);
                
                for (let i = 0; i < sampleSize; i++) {
                  const area = areas[i % areas.length];
                  const ageBucket = filterData.ageBucket === 'Mixed' 
                    ? ['365+ Days', '181-365 Days', '61-180 Days', 'Under 60 Days'][i % 4]
                    : filterData.ageBucket;
                  
                  claimsToInsert.push({
                    claim_id: `CLM-${area.area.split(' ')[0]}-${1000 + i}`,
                    area: area.area,
                    loss_description: TEXAS_REAR_END_DATA.lossDescription,
                    reserves: Math.round(area.reserves / area.claims),
                    low_eval: Math.round((area.lowEval || 0) / area.claims),
                    high_eval: Math.round((area.highEval || 0) / area.claims),
                    age_bucket: ageBucket,
                    status: 'assigned' as const,
                    assigned_to: selectedReviewer,
                    assigned_at: new Date().toISOString(),
                    notes: `${aiSummary}\n\nDeadline: ${format(new Date(deadline), 'MMMM d, yyyy')}`,
                  });
                }
                
                const { error } = await supabase
                  .from('claim_reviews')
                  .insert(claimsToInsert);
                
                if (error) {
                  console.error('Deploy error:', error);
                  toast.error("Failed to deploy directive");
                } else {
                  // Handle SMS notification
                  if (testMode) {
                    // Simulate SMS in test mode
                    toast.success(
                      <div className="space-y-1">
                        <p className="font-semibold">📱 SMS Simulated (Test Mode)</p>
                        <p className="text-xs text-muted-foreground">
                          To: {selectedReviewer}<br/>
                          {aiSummary.slice(0, 100)}...
                        </p>
                      </div>,
                      { duration: 8000 }
                    );
                  }
                  
                  toast.success(`Deployed ${claimsToInsert.length} claims to ${selectedReviewer}`, {
                    description: `Deadline: ${format(new Date(deadline), 'MMM d, yyyy')}`,
                    icon: <CheckCircle2 className="h-4 w-4" />
                  });
                  setSelectedClaimFilter('');
                  setSelectedReviewer('');
                  setDirective('');
                  setAiSummary('');
                }
                setDeploying(false);
              }}
            >
              {deploying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Deploy Directive
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {!aiSummary ? "Generate summary first to deploy" : "Track progress in real-time below"}
            </p>
          </div>
        </div>

        {/* Real-Time Progress Tracking */}
        {reviews.length > 0 && (
          <div className="mt-4 pt-4 border-t border-warning/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-foreground uppercase flex items-center gap-2">
                <Eye className="h-3 w-3" /> Live Review Progress
              </h4>
              <div className="flex gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  Assigned: {reviewStats.assigned}
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  In Review: {reviewStats.inReview}
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Completed: {reviewStats.completed}
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  Flagged: {reviewStats.flagged}
                </span>
                <span className="font-semibold text-primary">
                  ${reviewStats.totalReserves.toLocaleString()} reserves
                </span>
              </div>
            </div>
            
            <div className="max-h-40 overflow-y-auto bg-card rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="text-left py-2 px-3">Claim</th>
                    <th className="text-left py-2 px-3">Area</th>
                    <th className="text-left py-2 px-3">Age</th>
                    <th className="text-right py-2 px-3">Reserves</th>
                    <th className="text-left py-2 px-3">Assigned</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.slice(0, 10).map(review => (
                    <tr key={review.id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-1.5 px-3 font-mono">{review.claim_id}</td>
                      <td className="py-1.5 px-3">{review.area}</td>
                      <td className="py-1.5 px-3">
                        <Badge variant="outline" className="text-xs">{review.age_bucket}</Badge>
                      </td>
                      <td className="py-1.5 px-3 text-right text-primary font-semibold">
                        ${Number(review.reserves).toLocaleString()}
                      </td>
                      <td className="py-1.5 px-3">{review.assigned_to}</td>
                      <td className="py-1.5 px-3">
                        {review.status === 'assigned' && <Badge className="bg-blue-500 text-xs">Assigned</Badge>}
                        {review.status === 'in_review' && <Badge className="bg-amber-500 text-xs">In Review</Badge>}
                        {review.status === 'completed' && <Badge className="bg-green-500 text-xs">Done</Badge>}
                        {review.status === 'flagged' && <Badge className="bg-red-500 text-xs">Flagged</Badge>}
                      </td>
                      <td className="py-1.5 px-3">
                        <div className="flex gap-1">
                          {review.status === 'assigned' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={async () => {
                                await supabase.from('claim_reviews').update({ status: 'in_review' }).eq('id', review.id);
                              }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          )}
                          {review.status === 'in_review' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-green-500"
                                onClick={async () => {
                                  await supabase.from('claim_reviews').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', review.id);
                                }}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-red-500"
                                onClick={async () => {
                                  await supabase.from('claim_reviews').update({ status: 'flagged' }).eq('id', review.id);
                                }}
                              >
                                <Flag className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border border-destructive/30 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Aged Inventory Alert</h3>
            <p className="text-xs text-muted-foreground">Claims over 365 days by type require immediate executive attention</p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {data.typeGroupSummaries
            .filter(g => g.age365Plus > 50)
            .sort((a, b) => b.age365Plus - a.age365Plus)
            .slice(0, 10)
            .map((group) => (
              <div key={group.typeGroup} className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">{group.typeGroup}</p>
                <p className="text-lg font-bold text-destructive">{formatNumber(group.age365Plus)}</p>
                <p className="text-xs text-muted-foreground">
                  of {formatNumber(group.grandTotal)} total ({((group.age365Plus / group.grandTotal) * 100).toFixed(0)}%)
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
