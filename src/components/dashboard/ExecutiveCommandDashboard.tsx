import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle,
  CheckCircle2, Target, BarChart3, PieChart as PieChartIcon,
  ArrowUpRight, ArrowDownRight, Activity, Zap, Shield, Flag,
  MessageSquare, Database, Calculator, Percent, FileText,
  Building2, Info, Wallet
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, Legend
} from "recharts";
import { useActuarialData } from "@/hooks/useActuarialData";

interface ExecutiveCommandDashboardProps {
  data: {
    totalClaims: number;
    totalReserves: number;
    lowEval: number;
    highEval: number;
    noEvalCount: number;
    noEvalReserves: number;
    aged365Plus: number;
    aged365Reserves: number;
    aged181to365: number;
    aged181Reserves: number;
    aged61to180: number;
    agedUnder60: number;
    cp1Count: number;
    cp1Rate: string;
    decisionsCount: number;
    decisionsExposure: number;
    litCount: number;
    biLitSpend2026: number;
    biLitSpend2025: number;
    dataDate: string;
    delta?: {
      change: number;
      changePercent: number;
      reservesChange: number;
      reservesChangePercent: number;
      previousDate: string;
    };
    trendData?: Array<{ month: string; claims: number; reserves: number }>;
  };
  onOpenChat: () => void;
  onDrilldown: (section: string) => void;
  timestamp: string;
}

const formatM = (val: number) => `$${(val / 1000000).toFixed(1)}M`;
const formatK = (val: number) => `$${(val / 1000).toFixed(0)}K`;
const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};
const formatPct = (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

// Mocked high-level financials from Q2 2024
const COMPANY_FINANCIALS = {
  period: 'Q2 2024',
  companies: [
    { name: 'VISION', gwp: 31250320, surplus: 16957403, netIncome: 424495, ptsRatio: 184, rbcRatio: 760 },
    { name: 'LCIC', gwp: 211059611, surplus: 42657450, netIncome: -548806, ptsRatio: 495, rbcRatio: 313 },
    { name: 'YAIC', gwp: 56174060, surplus: 15890304, netIncome: -2278026, ptsRatio: 354, rbcRatio: 303 },
    { name: 'LIC', gwp: 521185190, surplus: 166336418, netIncome: -9720758, ptsRatio: 313, rbcRatio: 267 },
  ],
  totals: { gwp: 819669180, surplus: 166336419, netIncome: -12123095, ptsRatio: 493, rbcRatio: 267 }
};

export function ExecutiveCommandDashboard({ data, onOpenChat, onDrilldown, timestamp }: ExecutiveCommandDashboardProps) {
  const [showFinancialDetails, setShowFinancialDetails] = useState(false);
  
  // Fetch actuarial data from database
  const { data: actuarialData, loading: actuarialLoading } = useActuarialData(2026);
  
  const metrics = actuarialData.metrics;
  const claimsPayments = actuarialData.claimsPayments;
  const accidentYearDev = actuarialData.accidentYearDev;
  const claimsFrequency = actuarialData.claimsFrequency;
  const overspendSummary = actuarialData.overspendSummary;

  // Pie chart data for age distribution
  const ageData = [
    { name: '365+', value: data.aged365Plus, color: 'hsl(var(--destructive))' },
    { name: '181-365', value: data.aged181to365, color: 'hsl(var(--warning))' },
    { name: '61-180', value: data.aged61to180, color: 'hsl(var(--accent))' },
    { name: '<60', value: data.agedUnder60, color: 'hsl(var(--success))' },
  ];

  // Calculate real metrics from claims payments (2025 YTD only)
  const currentYear = 2025;
  const biPaymentsYTD = claimsPayments
    .filter(p => p.coverage === 'BI' && p.isYtd && p.periodYear === currentYear)
    .reduce((sum, p) => sum + p.totalPayments, 0);
  
  const totalPaymentsYTD = claimsPayments
    .filter(p => p.isYtd && p.periodYear === currentYear && p.coverage === 'TOTAL')
    .reduce((sum, p) => sum + p.totalPayments, 0);

  // Calculate overspend totals
  const overspendByType = overspendSummary.reduce((acc, item) => {
    if (item.issueType === 'anomaly') {
      acc.anomaly += item.totalAmount;
      acc.anomalyCount += item.claimCount;
    } else {
      acc.issue += item.totalAmount;
      acc.issueCount += item.claimCount;
    }
    return acc;
  }, { anomaly: 0, issue: 0, anomalyCount: 0, issueCount: 0 });

  // Get latest AY development grand totals
  const ayGrandTotals = accidentYearDev
    .filter(d => d.category === 'Grand Total' && d.coverage === 'ALL')
    .sort((a, b) => b.accidentYear - a.accidentYear);

  // Calculate frequency trend
  const latestFreq = claimsFrequency
    .filter(f => f.state === 'Combined' && f.year === 2025)
    .sort((a, b) => b.month - a.month)[0];

  return (
    <div className="space-y-4">
      {/* Data Source Legend */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="font-medium text-muted-foreground">Data Sources:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Real Data (Uploaded)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Mocked / Sample Data</span>
            </div>
            <div className="ml-auto text-muted-foreground italic hidden md:block">
              Inventory, Payments, Frequency, AY Dev = Real • Financials, Ratios = Mocked (Q2 2024)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Executive Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl border border-slate-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Live</span>
          </div>
          <span className="text-sm font-semibold text-white">{data.dataDate}</span>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
            REAL DATA
          </Badge>
        </div>
        <div className="flex items-center gap-6">
          {data.delta && (
            <>
              <div className="flex items-center gap-1.5">
                {data.delta.change >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-emerald-500" />
                )}
                <span className={`text-xs font-semibold ${data.delta.change >= 0 ? 'text-destructive' : 'text-emerald-400'}`}>
                  {formatPct(data.delta.changePercent)} Claims
                </span>
              </div>
              <div className="w-px h-4 bg-slate-700" />
              <div className="flex items-center gap-1.5">
                {data.delta.reservesChangePercent >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-emerald-500" />
                )}
                <span className={`text-xs font-semibold ${data.delta.reservesChangePercent >= 0 ? 'text-destructive' : 'text-emerald-400'}`}>
                  {formatPct(data.delta.reservesChangePercent)} Reserves
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: REAL DATA - Inventory & Claims (Green indicators) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      
      <div className="flex items-center gap-2 pt-2">
        <div className="w-3 h-3 rounded-full bg-emerald-500" />
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Real-Time Inventory</h3>
        <Database className="h-4 w-4 text-emerald-500" />
      </div>

      {/* Top Row - 4 Column Power Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Claims */}
        <div className="bg-card rounded-xl border border-emerald-500/20 p-4 hover:border-emerald-500/50 transition-all cursor-pointer" onClick={() => onDrilldown('claims')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Claims</span>
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">{data.totalClaims.toLocaleString()}</p>
          {data.delta && (
            <p className={`text-xs mt-1 ${data.delta.change >= 0 ? 'text-destructive' : 'text-emerald-600'}`}>
              {data.delta.change >= 0 ? '+' : ''}{data.delta.change} MoM
            </p>
          )}
        </div>

        {/* Total Reserves */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-transparent rounded-xl border border-emerald-500/30 p-4 hover:border-emerald-500/50 transition-all cursor-pointer" onClick={() => onDrilldown('reserves')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Reserves</span>
            <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatM(data.totalReserves)}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground">L: {formatM(data.lowEval)}</span>
            <span className="text-[10px] text-muted-foreground">•</span>
            <span className="text-[10px] text-warning">H: {formatM(data.highEval)}</span>
          </div>
        </div>

        {/* CP1 Rate */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-transparent rounded-xl border border-emerald-500/30 p-4 hover:border-emerald-500/50 transition-all cursor-pointer" onClick={() => onDrilldown('cp1')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">CP1 Rate</span>
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data.cp1Rate}%</p>
          <p className="text-[10px] text-muted-foreground mt-1">{data.cp1Count.toLocaleString()} within limits</p>
        </div>

        {/* Claims Payments YTD (Real) */}
        <div className="bg-card rounded-xl border border-emerald-500/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">BI Payments YTD</span>
            <Wallet className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(biPaymentsYTD)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Total: {formatCurrency(totalPaymentsYTD)}
          </p>
        </div>
      </div>

      {/* Risk Matrix - 2 Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Left: Risk Indicators */}
        <div className="bg-card rounded-xl border border-emerald-500/20 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-bold uppercase tracking-wide">Risk Indicators</h3>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] ml-auto">
              REAL
            </Badge>
          </div>
          
          <div className="space-y-3">
            {/* No Eval Alert */}
            <div 
              className="flex items-center justify-between p-3 bg-warning/10 rounded-lg border border-warning/20 cursor-pointer hover:bg-warning/20 transition-colors"
              onClick={() => onDrilldown('noeval')}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <div>
                  <p className="text-sm font-semibold text-foreground">No Evaluation</p>
                  <p className="text-xs text-muted-foreground">{formatM(data.noEvalReserves)} exposure</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-warning">{data.noEvalCount}</p>
                <p className="text-[10px] text-muted-foreground">
                  {((data.noEvalCount / data.totalClaims) * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Aged 365+ Alert */}
            <div 
              className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg border border-destructive/20 cursor-pointer hover:bg-destructive/20 transition-colors"
              onClick={() => onDrilldown('aged365')}
            >
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-destructive" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Aged 365+</p>
                  <p className="text-xs text-muted-foreground">{formatM(data.aged365Reserves)} exposure</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-destructive">{data.aged365Plus}</p>
                <p className="text-[10px] text-muted-foreground">
                  {((data.aged365Plus / data.totalClaims) * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Pending Decisions */}
            <div 
              className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={() => onDrilldown('decisions')}
            >
              <div className="flex items-center gap-3">
                <Flag className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Decisions Pending</p>
                  <p className="text-xs text-muted-foreground">{formatM(data.decisionsExposure)} exposure</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">{data.decisionsCount}</p>
                <p className="text-[10px] text-muted-foreground">action items</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Age Distribution Pie + Overspend Summary */}
        <div className="space-y-3">
          <div className="bg-card rounded-xl border border-emerald-500/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <PieChartIcon className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-bold uppercase tracking-wide">Age Distribution</h3>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ageData}
                      innerRadius={25}
                      outerRadius={40}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {ageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2">
                {ageData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px] text-muted-foreground">{item.name}d</span>
                    </div>
                    <span className="text-xs font-semibold">{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Overspend Quick View */}
          {(overspendByType.anomaly > 0 || overspendByType.issue > 0) && (
            <div className="bg-card rounded-xl border border-emerald-500/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold uppercase tracking-wide">Overspend Summary</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 bg-amber-500/10 rounded border border-amber-500/20">
                  <p className="text-[10px] text-amber-600">Anomalies</p>
                  <p className="text-lg font-bold">{formatCurrency(overspendByType.anomaly)}</p>
                  <p className="text-[10px] text-muted-foreground">{overspendByType.anomalyCount} claims</p>
                </div>
                <div className="p-2 bg-red-500/10 rounded border border-red-500/20">
                  <p className="text-[10px] text-red-600">Issues</p>
                  <p className="text-lg font-bold">{formatCurrency(overspendByType.issue)}</p>
                  <p className="text-[10px] text-muted-foreground">{overspendByType.issueCount} claims</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AY Development Quick View */}
      {ayGrandTotals.length > 0 && (
        <div className="bg-card rounded-xl border border-emerald-500/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-bold uppercase tracking-wide">AY Loss Development @ 6mo</h3>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] ml-auto">
              REAL
            </Badge>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {ayGrandTotals.slice(0, 4).map(ay => (
              <div 
                key={ay.accidentYear}
                className={`p-3 border rounded-lg ${
                  ay.accidentYear === 2024 ? 'bg-emerald-500/10 border-emerald-500' : 'bg-muted/30'
                }`}
              >
                <div className="text-xs font-medium text-muted-foreground">AY {ay.accidentYear}</div>
                <div className={`text-lg font-bold ${ay.incurred < 0 ? 'text-emerald-600' : ay.incurredPctPremium > 5 ? 'text-red-600' : ''}`}>
                  {ay.incurredPctPremium.toFixed(2)}%
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {formatCurrency(ay.incurred)} incurred
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: MOCKED DATA - High-Level Financials (Amber indicators) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      
      <div className="flex items-center gap-2 pt-4 border-t mt-4">
        <div className="w-3 h-3 rounded-full bg-amber-500" />
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Company Financials</h3>
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
          MOCKED - {COMPANY_FINANCIALS.period}
        </Badge>
        <Info className="h-4 w-4 text-amber-500 ml-1" />
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-gradient-to-br from-amber-500/10 to-transparent rounded-xl border border-amber-500/30 p-4">
          <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Gross Written Premium</div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(COMPANY_FINANCIALS.totals.gwp)}</p>
          <p className="text-[10px] text-muted-foreground">All entities</p>
        </div>
        <div className="bg-card rounded-xl border border-amber-500/20 p-4">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Surplus</div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(COMPANY_FINANCIALS.totals.surplus)}</p>
          <p className="text-[10px] text-muted-foreground">6-30-24</p>
        </div>
        <div className="bg-card rounded-xl border border-amber-500/20 p-4">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Net Income</div>
          <p className="text-xl font-bold text-destructive">({formatCurrency(Math.abs(COMPANY_FINANCIALS.totals.netIncome))})</p>
          <p className="text-[10px] text-muted-foreground">YTD Loss</p>
        </div>
        <div className="bg-card rounded-xl border border-amber-500/20 p-4">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Premium/Surplus</div>
          <p className="text-xl font-bold text-amber-600">{COMPANY_FINANCIALS.totals.ptsRatio}%</p>
          <p className="text-[10px] text-muted-foreground">Target: &lt;300%</p>
        </div>
        <div className="bg-card rounded-xl border border-amber-500/20 p-4">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">RBC Ratio</div>
          <p className="text-xl font-bold text-foreground">{COMPANY_FINANCIALS.totals.rbcRatio}%</p>
          <p className="text-[10px] text-muted-foreground">Min: 200%</p>
        </div>
      </div>

      {/* Entity Breakdown Table */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-amber-600" />
              Entity Breakdown
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowFinancialDetails(!showFinancialDetails)}
              className="h-7 text-xs"
            >
              {showFinancialDetails ? 'Hide' : 'Show'} Details
            </Button>
          </div>
        </CardHeader>
        {showFinancialDetails && (
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead className="text-right">GWP</TableHead>
                  <TableHead className="text-right">Surplus</TableHead>
                  <TableHead className="text-right">Net Income</TableHead>
                  <TableHead className="text-right">P/S Ratio</TableHead>
                  <TableHead className="text-right">RBC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMPANY_FINANCIALS.companies.map(co => (
                  <TableRow key={co.name}>
                    <TableCell className="font-medium">{co.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(co.gwp)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(co.surplus)}</TableCell>
                    <TableCell className={`text-right ${co.netIncome < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                      {co.netIncome < 0 ? `(${formatCurrency(Math.abs(co.netIncome))})` : formatCurrency(co.netIncome)}
                    </TableCell>
                    <TableCell className={`text-right ${co.ptsRatio > 400 ? 'text-amber-600' : ''}`}>
                      {co.ptsRatio}%
                    </TableCell>
                    <TableCell className={`text-right ${co.rbcRatio < 300 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {co.rbcRatio}%
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell>TOTALS</TableCell>
                  <TableCell className="text-right">{formatCurrency(COMPANY_FINANCIALS.totals.gwp)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(COMPANY_FINANCIALS.totals.surplus)}</TableCell>
                  <TableCell className="text-right text-destructive">
                    ({formatCurrency(Math.abs(COMPANY_FINANCIALS.totals.netIncome))})
                  </TableCell>
                  <TableCell className="text-right text-amber-600">{COMPANY_FINANCIALS.totals.ptsRatio}%</TableCell>
                  <TableCell className="text-right">{COMPANY_FINANCIALS.totals.rbcRatio}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div className="mt-3 p-2 bg-amber-500/10 rounded border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
              <strong>Data Needed:</strong> Q3-Q4 2024 financials, 2025 YTD figures, and updated RBC calculations
            </div>
          </CardContent>
        )}
      </Card>

      {/* Mocked Actuarial Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/20 text-center">
            <div className="text-[10px] text-amber-600 uppercase">Loss Ratio</div>
            <div className="text-lg font-bold">{formatPercent(metrics.lossRatio)}</div>
            <div className="text-[10px] text-muted-foreground">Target: {formatPercent(metrics.targetLossRatio)}</div>
          </div>
          <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/20 text-center">
            <div className="text-[10px] text-amber-600 uppercase">Expense Ratio</div>
            <div className="text-lg font-bold">{formatPercent(metrics.totalExpenseRatio)}</div>
          </div>
          <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/20 text-center">
            <div className="text-[10px] text-amber-600 uppercase">Combined Ratio</div>
            <div className="text-lg font-bold">{((metrics.lossRatio + metrics.totalExpenseRatio) * 100).toFixed(1)}%</div>
          </div>
          <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/20 text-center">
            <div className="text-[10px] text-amber-600 uppercase">Dev Factor</div>
            <div className="text-lg font-bold">{metrics.developmentFactor.toFixed(3)}</div>
          </div>
          <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/20 text-center">
            <div className="text-[10px] text-amber-600 uppercase">Credibility</div>
            <div className="text-lg font-bold">{(metrics.credibility * 100).toFixed(0)}%</div>
          </div>
        </div>
      )}

      {/* Bottom Quick Actions */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        <button 
          onClick={onOpenChat}
          className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/30 hover:to-pink-600/30 rounded-xl border border-purple-500/30 transition-all"
        >
          <Target className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-semibold text-foreground">AI Insights</span>
        </button>
        <button 
          onClick={() => onDrilldown('litigation')}
          className="flex items-center justify-center gap-2 p-3 bg-card hover:bg-muted rounded-xl border transition-all"
        >
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Litigation ({data.litCount})</span>
        </button>
        <button 
          onClick={() => onDrilldown('export')}
          className="flex items-center justify-center gap-2 p-3 bg-card hover:bg-muted rounded-xl border transition-all"
        >
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Export Report</span>
        </button>
      </div>
    </div>
  );
}
