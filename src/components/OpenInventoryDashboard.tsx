import { useMemo, useState } from "react";
import { useOpenExposureData, OpenExposurePhase, TypeGroupSummary } from "@/hooks/useOpenExposureData";
import { KPICard } from "@/components/KPICard";
import { Loader2, FileStack, Clock, AlertTriangle, TrendingUp, DollarSign, Wallet, Car, MapPin, MessageSquare, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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

export function OpenInventoryDashboard() {
  const { data, loading, error } = useOpenExposureData();

  const [selectedClaims, setSelectedClaims] = useState<string[]>([]);
  const [sendingText, setSendingText] = useState(false);
  
  const formatNumber = (val: number) => val.toLocaleString();
  const formatCurrency = (val: number) => `$${(val / 1000000).toFixed(1)}M`;
  const formatCurrencyK = (val: number) => `$${(val / 1000).toFixed(0)}K`;
  const formatCurrencyFull = (val: number) => `$${val.toLocaleString()}`;

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

  // Rear Ends - Texas Areas 101-110 (placeholder data for quick action)
  const TEXAS_REAR_END_DATA = {
    summary: { totalClaims: 47, totalReserves: 2850000, lowEval: 1420000, highEval: 1680000 },
    byArea: [
      { area: '101', claims: 8, reserves: 485000, lowEval: 245000, highEval: 290000 },
      { area: '102', claims: 6, reserves: 365000, lowEval: 180000, highEval: 215000 },
      { area: '103', claims: 5, reserves: 310000, lowEval: 155000, highEval: 185000 },
      { area: '104', claims: 4, reserves: 245000, lowEval: 120000, highEval: 145000 },
      { area: '105', claims: 7, reserves: 420000, lowEval: 210000, highEval: 250000 },
      { area: '106', claims: 3, reserves: 185000, lowEval: 90000, highEval: 110000 },
      { area: '107', claims: 5, reserves: 295000, lowEval: 145000, highEval: 175000 },
      { area: '108', claims: 4, reserves: 240000, lowEval: 120000, highEval: 145000 },
      { area: '109', claims: 3, reserves: 175000, lowEval: 85000, highEval: 100000 },
      { area: '110', claims: 2, reserves: 130000, lowEval: 70000, highEval: 85000 },
    ],
    byAge: [
      { age: '365+ Days', claims: 18, reserves: 1180000, lowEval: 590000, highEval: 700000 },
      { age: '181-365 Days', claims: 14, reserves: 850000, lowEval: 420000, highEval: 500000 },
      { age: '61-180 Days', claims: 10, reserves: 520000, lowEval: 260000, highEval: 310000 },
      { age: 'Under 60 Days', claims: 5, reserves: 300000, lowEval: 150000, highEval: 170000 },
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
      {/* Summary Banner with Financials */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-5">
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

      {/* Financial KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Total Open Reserves"
          value={formatCurrency(metrics.financials.totals.totalOpenReserves)}
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
          title="High Evaluation"
          value={formatCurrency(metrics.financials.totals.totalHighEval)}
          subtitle="Maximum exposure estimate"
          icon={DollarSign}
          variant="warning"
        />
        <KPICard
          title="No Evaluation"
          value={formatNumber(metrics.financials.totals.noEvalCount)}
          subtitle="Claims pending eval"
          icon={Clock}
          variant="default"
        />
      </div>

      {/* Charts Row - Financials by Age */}
      <div className="grid grid-cols-2 gap-6">
        {/* Reserves vs Eval by Age Bucket */}
        <div className="bg-card border border-border rounded-xl p-5">
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
                  formatter={(value: number, name: string) => [
                    formatCurrencyFull(value), 
                    name === 'openReserves' ? 'Open Reserves' : name === 'lowEval' ? 'Low Eval' : 'High Eval'
                  ]}
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
                    name === 'openReserves' ? 'Open Reserves' : name === 'lowEval' ? 'Low Eval' : 'High Eval'
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

      {/* QUICK ACTION: Rear Ends - Texas Areas 101-110 */}
      <div className="bg-gradient-to-r from-warning/10 to-warning/5 border-2 border-warning/40 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/20">
              <Car className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
                Quick Action: Rear Ends — Texas Areas 101-110
                <span className="px-2 py-0.5 bg-warning/20 text-warning text-xs rounded-full font-medium">ACTION REQUIRED</span>
              </h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> West Texas Region • {TEXAS_REAR_END_DATA.summary.totalClaims} open claims
              </p>
            </div>
          </div>
          <div className="flex gap-6 items-center">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase">Open Reserves</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(TEXAS_REAR_END_DATA.summary.totalReserves)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase">Low Eval</p>
              <p className="text-xl font-bold text-accent-foreground">{formatCurrency(TEXAS_REAR_END_DATA.summary.lowEval)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase">High Eval</p>
              <p className="text-xl font-bold text-warning">{formatCurrency(TEXAS_REAR_END_DATA.summary.highEval)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* By Area */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">By Area Code</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {TEXAS_REAR_END_DATA.byArea.map((item) => (
                <div key={item.area} className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-sm font-medium">Area {item.area}</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-muted-foreground">{item.claims} claims</span>
                    <span className="text-primary font-semibold">{formatCurrencyK(item.reserves)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* By Age */}
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
                    <p className="text-sm font-semibold">{item.claims} claims</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrencyK(item.reserves)} reserves • {formatCurrencyK(item.highEval)} high
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SMS Action */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2">
              <MessageSquare className="h-3 w-3" /> Request File Review
            </h4>
            <RadioGroup 
              value={selectedClaims.length > 0 ? selectedClaims[0] : ''} 
              onValueChange={(val) => setSelectedClaims([val])}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all-claims" />
                <Label htmlFor="all-claims" className="text-sm cursor-pointer">All 47 claims</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="aged-365" id="aged-365" />
                <Label htmlFor="aged-365" className="text-sm cursor-pointer">365+ day aged only (18)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high-reserve" id="high-reserve" />
                <Label htmlFor="high-reserve" className="text-sm cursor-pointer">High reserve &gt; $50K (12)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no-eval" id="no-eval" />
                <Label htmlFor="no-eval" className="text-sm cursor-pointer">No evaluation set (5)</Label>
              </div>
            </RadioGroup>

            <Button 
              className="w-full mt-4" 
              variant="default"
              disabled={selectedClaims.length === 0 || sendingText}
              onClick={() => {
                setSendingText(true);
                // Simulate SMS send to 9154875798
                setTimeout(() => {
                  toast.success("Text sent to (915) 487-5798", {
                    description: `Review request for ${selectedClaims[0] === 'all' ? '47 claims' : 
                      selectedClaims[0] === 'aged-365' ? '18 aged claims' :
                      selectedClaims[0] === 'high-reserve' ? '12 high reserve claims' : '5 no-eval claims'} sent.`,
                    icon: <CheckCircle2 className="h-4 w-4" />
                  });
                  setSendingText(false);
                  setSelectedClaims([]);
                }, 1500);
              }}
            >
              {sendingText ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Text to (915) 487-5798
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Reviewer will receive claim list for immediate action
            </p>
          </div>
        </div>
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
