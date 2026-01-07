import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle,
  BarChart3, PieChart as PieChartIcon,
  ArrowUpRight, ArrowDownRight, Activity, Zap, Shield, Flag,
  Database, Wallet, ChevronDown, ChevronUp, AlertCircle, MessageSquare,
  FileText, FileSpreadsheet, Loader2
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
  PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line, ComposedChart, Bar
} from "recharts";
import { useActuarialData } from "@/hooks/useActuarialData";
import { useLossTriangleData } from "@/hooks/useLossTriangleData";
import { useExportData } from "@/hooks/useExportData";
import { toast } from "sonner";

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
const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};
const formatPct = (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;

export function ExecutiveCommandDashboard({ data, onOpenChat, onDrilldown, timestamp }: ExecutiveCommandDashboardProps) {
  // Export functionality
  const { generateCSuiteBriefing, generateCSuiteExcel } = useExportData();
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);

  // Loss Dev section states
  const [showAYDetails, setShowAYDetails] = useState(false);
  const [showFrequencyDetails, setShowFrequencyDetails] = useState(false);
  const [showPaymentsDetails, setShowPaymentsDetails] = useState(false);
  const [showOverLimitDetails, setShowOverLimitDetails] = useState(false);
  const [selectedFreqState, setSelectedFreqState] = useState<string>("Combined");
  const [selectedPaymentCoverage, setSelectedPaymentCoverage] = useState<string>("BI");
  
  // Fetch actuarial data from database
  const { data: actuarialData, loading: actuarialLoading } = useActuarialData(2026);
  const triangleData = useLossTriangleData();
  
  const claimsPayments = actuarialData.claimsPayments;
  const claimsFrequency = actuarialData.claimsFrequency;
  const overspendSummary = actuarialData.overspendSummary;
  const overLimitPayments = actuarialData.overLimitPayments;

  // Export handlers
  const handleExportPDF = async () => {
    setGeneratingPDF(true);
    try {
      await generateCSuiteBriefing({
        totalClaims: data.totalClaims,
        totalReserves: data.totalReserves,
        cp1Rate: data.cp1Rate,
        aged365Plus: data.aged365Plus,
        aged365Reserves: data.aged365Reserves,
        noEvalCount: data.noEvalCount,
        noEvalReserves: data.noEvalReserves,
        decisionsCount: data.decisionsCount,
        decisionsExposure: data.decisionsExposure,
        biSpend2026: data.biLitSpend2026,
        biSpend2025: data.biLitSpend2025,
        dataDate: data.dataDate,
        delta: data.delta,
      });
      toast.success('C-Suite Briefing PDF generated');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleExportExcel = () => {
    setGeneratingExcel(true);
    try {
      generateCSuiteExcel({
        totalClaims: data.totalClaims,
        totalReserves: data.totalReserves,
        cp1Rate: data.cp1Rate,
        cp1Count: data.cp1Count,
        aged365Plus: data.aged365Plus,
        aged365Reserves: data.aged365Reserves,
        aged181to365: data.aged181to365,
        noEvalCount: data.noEvalCount,
        noEvalReserves: data.noEvalReserves,
        decisionsCount: data.decisionsCount,
        decisionsExposure: data.decisionsExposure,
        lowEval: data.lowEval,
        highEval: data.highEval,
        biSpend2026: data.biLitSpend2026,
        biSpend2025: data.biLitSpend2025,
        dataDate: data.dataDate,
      });
      toast.success('C-Suite Portfolio Excel generated');
    } catch (err) {
      console.error('Excel generation error:', err);
      toast.error('Failed to generate Excel');
    } finally {
      setGeneratingExcel(false);
    }
  };

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
    if (item.issueType === 'anomaly' || item.issueType === 'Anomaly') {
      acc.anomaly += item.totalAmount;
      acc.anomalyCount += item.claimCount;
    } else {
      acc.issue += item.totalAmount;
      acc.issueCount += item.claimCount;
    }
    return acc;
  }, { anomaly: 0, issue: 0, anomalyCount: 0, issueCount: 0 });

  // Get unique states from frequency data
  const frequencyStates = [...new Set(claimsFrequency.map(f => f.state))].sort();

  // Filter frequency data for selected state and transform for chart
  const frequencyChartData = claimsFrequency
    .filter(f => f.state === selectedFreqState)
    .reduce((acc, f) => {
      const monthName = new Date(2000, f.month - 1).toLocaleString('default', { month: 'short' });
      const existing = acc.find(a => a.month === monthName);
      if (existing) {
        if (f.year === 2023) existing.freq2023 = f.frequency;
        else if (f.year === 2024) existing.freq2024 = f.frequency;
        else if (f.year === 2025) existing.freq2025 = f.frequency;
      } else {
        acc.push({
          month: monthName,
          freq2023: f.year === 2023 ? f.frequency : 0,
          freq2024: f.year === 2024 ? f.frequency : 0,
          freq2025: f.year === 2025 ? f.frequency : 0,
        });
      }
      return acc;
    }, [] as { month: string; freq2023: number; freq2024: number; freq2025: number }[]);

  // Calculate state frequency averages
  const stateFreqAverages = frequencyStates
    .filter(s => s !== 'Combined')
    .map(state => {
      const stateData = claimsFrequency.filter(f => f.state === state);
      const data2024 = stateData.filter(f => f.year === 2024);
      const data2025 = stateData.filter(f => f.year === 2025);
      return {
        state,
        avg2024: data2024.length > 0 ? data2024.reduce((s, f) => s + f.frequency, 0) / data2024.length : 0,
        avg2025: data2025.length > 0 ? data2025.reduce((s, f) => s + f.frequency, 0) / data2025.length : 0,
      };
    })
    .sort((a, b) => b.avg2025 - a.avg2025);

  // Loss development chart data from triangle
  const lossDevChartData = triangleData.summaryByAY
    .filter(ay => ay.accidentYear >= 2020)
    .sort((a, b) => a.accidentYear - b.accidentYear)
    .map(ay => ({
      year: `AY ${ay.accidentYear}`,
      paid: ay.netPaidLoss,
      reserves: ay.claimReserves,
      ibnr: ay.bulkIbnr,
      incurred: ay.ultimateIncurred,
      lossRatio: ay.lossRatio,
    }));

  return (
    <div className="space-y-4">
      {/* Consolidated Header - Exports, Data Status & Trends */}
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
        
        {/* Delta Indicators */}
        <div className="flex items-center gap-4">
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
              <div className="w-px h-4 bg-slate-700" />
            </>
          )}
          
          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportPDF}
              disabled={generatingPDF}
              className="gap-2 bg-primary/10 border-primary/30 hover:bg-primary/20 h-7 text-xs"
            >
              {generatingPDF ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              C-Suite PDF
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportExcel}
              disabled={generatingExcel}
              className="gap-2 h-7 text-xs"
            >
              {generatingExcel ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5" />
              )}
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={onOpenChat} className="gap-2 h-7 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              Ask Oracle
            </Button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: REAL DATA - Inventory & Claims (Green indicators) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      
      <div className="flex items-center gap-2 pt-2">
        <div className="w-3 h-3 rounded-full bg-emerald-500" />
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Real-Time Inventory</h3>
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

        {/* Claims Payments 2025 (Real) */}
        <div className="bg-card rounded-xl border border-emerald-500/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">BI Payments 2025</span>
            <Wallet className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(biPaymentsYTD)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Thru Nov • Total: {formatCurrency(totalPaymentsYTD)}
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: Accident Year Loss Development (from triangle data) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      <div className="flex items-center gap-2 pt-4 border-t mt-4">
        <div className="w-3 h-3 rounded-full bg-emerald-500" />
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Loss Development</h3>
      </div>

      {triangleData.summaryByAY.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Accident Year Loss Development
                </CardTitle>
                <CardDescription>Ultimate Incurred = Paid + Reserves + IBNR by Accident Year</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                  REAL DATA
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => setShowAYDetails(!showAYDetails)}>
                  {showAYDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* AY Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              {triangleData.summaryByAY.slice(0, 5).map((ay) => (
                <div
                  key={ay.accidentYear}
                  className={`p-3 border rounded-lg ${
                    ay.accidentYear === 2025 ? 'bg-primary/10 border-primary' : 'bg-muted/30'
                  }`}
                >
                  <div className="text-xs font-medium text-muted-foreground">AY {ay.accidentYear}</div>
                  <div className="text-lg font-bold">{ay.lossRatio.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(ay.ultimateIncurred)} incurred
                  </div>
                  <div className="text-xs text-muted-foreground">
                    @ {ay.developmentAge} mo
                  </div>
                </div>
              ))}
            </div>

            {/* Development Chart */}
            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={lossDevChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v / 1000000}M`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), '']}
                  />
                  <Legend />
                  <Bar dataKey="paid" name="Paid" stackId="a" fill="#10B981" />
                  <Bar dataKey="reserves" name="Reserves" stackId="a" fill="#F59E0B" />
                  <Bar dataKey="ibnr" name="IBNR" stackId="a" fill="#8B5CF6" />
                  <Line type="monotone" dataKey="incurred" name="Incurred" stroke="#3B82F6" strokeWidth={2} dot />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed Table */}
            {showAYDetails && (
              <div className="border-t pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>AY</TableHead>
                      <TableHead className="text-right">Earned Premium</TableHead>
                      <TableHead className="text-right">Net Paid</TableHead>
                      <TableHead className="text-right">Reserves</TableHead>
                      <TableHead className="text-right">IBNR</TableHead>
                      <TableHead className="text-right">Incurred</TableHead>
                      <TableHead className="text-right">Loss Ratio</TableHead>
                      <TableHead className="text-right">Dev Age</TableHead>
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
                        <TableCell className="text-right">{row.developmentAge} mo</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3: Claims Frequency by State */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {claimsFrequency.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Claims Frequency by State
                </CardTitle>
                <CardDescription>Loya Insurance Group - All Programs (2023-2025)</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedFreqState}
                  onChange={(e) => setSelectedFreqState(e.target.value)}
                  className="text-sm border rounded-md px-2 py-1 bg-background"
                >
                  {frequencyStates.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
                <Button variant="ghost" size="sm" onClick={() => setShowFrequencyDetails(!showFrequencyDetails)}>
                  {showFrequencyDetails ? "Hide Table" : "Show Table"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Frequency Chart */}
            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={frequencyChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 'auto']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="freq2023" name="2023" stroke="#94A3B8" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="freq2024" name="2024" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="freq2025" name="2025" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* State Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
              {stateFreqAverages.slice(0, 6).map((state) => (
                <div
                  key={state.state}
                  className={`p-2 border rounded-lg cursor-pointer transition-all ${
                    selectedFreqState === state.state
                      ? 'bg-primary/10 border-primary'
                      : 'bg-muted/30 hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedFreqState(state.state)}
                >
                  <div className="text-xs font-medium truncate">{state.state}</div>
                  <div className="text-lg font-bold">{state.avg2025.toFixed(1)}%</div>
                  <div className="flex items-center gap-1 text-xs">
                    {state.avg2025 < state.avg2024 ? (
                      <>
                        <TrendingDown className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-600">
                          {((state.avg2024 - state.avg2025) / state.avg2024 * 100).toFixed(0)}% ↓
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="h-3 w-3 text-amber-500" />
                        <span className="text-amber-600">
                          {((state.avg2025 - state.avg2024) / state.avg2024 * 100).toFixed(0)}% ↑
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {showFrequencyDetails && (
              <div className="border-t pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>State</TableHead>
                      <TableHead className="text-right">2024 Avg</TableHead>
                      <TableHead className="text-right">2025 Avg</TableHead>
                      <TableHead className="text-right">YoY Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stateFreqAverages.map((row) => {
                      const yoyChange = row.avg2024 > 0 ? ((row.avg2025 - row.avg2024) / row.avg2024 * 100) : 0;
                      return (
                        <TableRow
                          key={row.state}
                          className={`cursor-pointer ${selectedFreqState === row.state ? 'bg-primary/5' : ''}`}
                          onClick={() => setSelectedFreqState(row.state)}
                        >
                          <TableCell className="font-medium">{row.state}</TableCell>
                          <TableCell className="text-right">{row.avg2024.toFixed(1)}%</TableCell>
                          <TableCell className="text-right font-semibold">{row.avg2025.toFixed(1)}%</TableCell>
                          <TableCell className={`text-right ${yoyChange < 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {yoyChange >= 0 ? '+' : ''}{yoyChange.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4: Claims Payments by Coverage */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {claimsPayments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Claims Payments by Coverage
                </CardTitle>
                <CardDescription>Total All States - YTD & Monthly Trends (2021-2025)</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedPaymentCoverage}
                  onChange={(e) => setSelectedPaymentCoverage(e.target.value)}
                  className="text-sm border rounded-md px-2 py-1 bg-background"
                >
                  {['BI', 'PD', 'UM', 'CL', 'TOTAL'].map(cov => (
                    <option key={cov} value={cov}>{cov}</option>
                  ))}
                </select>
                <Button variant="ghost" size="sm" onClick={() => setShowPaymentsDetails(!showPaymentsDetails)}>
                  {showPaymentsDetails ? "Hide Table" : "Show Table"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* YTD Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              {[2021, 2022, 2023, 2024, 2025].map(year => {
                const ytdData = claimsPayments.find(p =>
                  p.coverage === selectedPaymentCoverage && p.periodYear === year && p.isYtd
                );
                const prevYtd = claimsPayments.find(p =>
                  p.coverage === selectedPaymentCoverage && p.periodYear === year - 1 && p.isYtd
                );
                const yoyChange = prevYtd && prevYtd.totalPayments > 0
                  ? ((ytdData?.totalPayments || 0) - prevYtd.totalPayments) / prevYtd.totalPayments * 100
                  : 0;

                return ytdData ? (
                  <div
                    key={year}
                    className={`p-3 border rounded-lg ${
                      year === 2025 ? 'bg-primary/10 border-primary' : 'bg-muted/30'
                    }`}
                  >
                    <div className="text-xs font-medium text-muted-foreground">{year} YTD</div>
                    <div className="text-lg font-bold">{formatCurrency(ytdData.totalPayments)}</div>
                    <div className="flex items-center gap-1 text-xs mt-1">
                      {yoyChange > 0 ? (
                        <ArrowUpRight className="h-3 w-3 text-amber-500" />
                      ) : yoyChange < 0 ? (
                        <ArrowDownRight className="h-3 w-3 text-emerald-500" />
                      ) : null}
                      <span className={yoyChange > 0 ? "text-amber-600" : "text-emerald-600"}>
                        {yoyChange !== 0 ? `${yoyChange >= 0 ? '+' : ''}${yoyChange.toFixed(0)}%` : '—'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {ytdData.claimantsPaid.toLocaleString()} claimants
                    </div>
                  </div>
                ) : null;
              })}
            </div>

            {/* Monthly Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={claimsPayments
                    .filter(p => p.coverage === selectedPaymentCoverage && p.periodYear === 2025 && !p.isYtd && p.periodMonth)
                    .map(p => ({
                      month: new Date(2000, (p.periodMonth || 1) - 1).toLocaleString('default', { month: 'short' }),
                      payments: p.totalPayments,
                      avgPaid: p.avgPaidPerClaimant,
                    }))}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v / 1000000}M`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v / 1000}K`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) =>
                      name === 'payments' ? [formatCurrency(value), 'Total Payments'] : [formatCurrency(value), 'Avg per Claimant']
                    }
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="payments" name="Total Payments" fill="#3B82F6" />
                  <Line yAxisId="right" type="monotone" dataKey="avgPaid" name="Avg per Claimant" stroke="#F59E0B" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {showPaymentsDetails && (
              <div className="border-t pt-4 mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coverage</TableHead>
                      <TableHead className="text-right">2023 YTD</TableHead>
                      <TableHead className="text-right">2024 YTD</TableHead>
                      <TableHead className="text-right">2025 YTD</TableHead>
                      <TableHead className="text-right">YoY Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {['BI', 'PD', 'CL', 'UM', 'TOTAL'].map(cov => {
                      const getYtd = (year: number) =>
                        claimsPayments.find(p => p.coverage === cov && p.periodYear === year && p.isYtd)?.totalPayments || 0;
                      const ytd2024 = getYtd(2024);
                      const ytd2025 = getYtd(2025);
                      const yoyChange = ytd2024 > 0 ? ((ytd2025 - ytd2024) / ytd2024) * 100 : 0;

                      return (
                        <TableRow
                          key={cov}
                          className={`cursor-pointer ${selectedPaymentCoverage === cov ? 'bg-primary/5' : ''} ${cov === 'TOTAL' ? 'font-bold border-t-2' : ''}`}
                          onClick={() => setSelectedPaymentCoverage(cov)}
                        >
                          <TableCell className="font-medium">{cov}</TableCell>
                          <TableCell className="text-right">{formatCurrency(getYtd(2023))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(getYtd(2024))}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(ytd2025)}</TableCell>
                          <TableCell className={`text-right ${yoyChange > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {yoyChange !== 0 ? `${yoyChange >= 0 ? '+' : ''}${yoyChange.toFixed(1)}%` : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 5: Over-Limit Payments Tracker */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {overLimitPayments.length > 0 && (
        <Card className="border-destructive/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Over-Limit Payments Tracker
                </CardTitle>
                <CardDescription>2025 YTD Payments Exceeding Policy Limits</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowOverLimitDetails(!showOverLimitDetails)}>
                {showOverLimitDetails ? "Collapse" : "Expand"} All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <div className="text-xs text-destructive">Total Over-Limit</div>
                <div className="text-xl font-bold text-destructive">
                  {formatCurrency(overLimitPayments.reduce((s, p) => s + p.overLimitAmount, 0))}
                </div>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div className="text-xs text-amber-600">Total Payments</div>
                <div className="text-xl font-bold text-amber-600">
                  {formatCurrency(overLimitPayments.reduce((s, p) => s + p.paymentAmount, 0))}
                </div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg border">
                <div className="text-xs text-muted-foreground">Claims Count</div>
                <div className="text-xl font-bold">{overLimitPayments.length}</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg border">
                <div className="text-xs text-muted-foreground">Avg Over-Limit</div>
                <div className="text-xl font-bold">
                  {formatCurrency(overLimitPayments.reduce((s, p) => s + p.overLimitAmount, 0) / overLimitPayments.length)}
                </div>
              </div>
            </div>

            {/* By State */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
              {Object.entries(
                overLimitPayments.reduce((acc, p) => {
                  acc[p.state] = (acc[p.state] || 0) + p.overLimitAmount;
                  return acc;
                }, {} as Record<string, number>)
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([state, amount]) => (
                  <div key={state} className="p-2 border rounded-lg bg-destructive/5">
                    <div className="text-xs font-medium">{state}</div>
                    <div className="text-sm font-bold text-destructive">{formatCurrency(amount)}</div>
                  </div>
                ))}
            </div>

            {/* Detail Table */}
            {showOverLimitDetails && (
              <div className="border-t pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Claim #</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead className="text-right">Limit</TableHead>
                      <TableHead className="text-right">Payment</TableHead>
                      <TableHead className="text-right">Over Limit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overLimitPayments.slice(0, 10).map((row) => (
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
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Showing top 10 of {overLimitPayments.length} claims
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 6: Claims Frequency Heat Map */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      
      <div className="flex items-center gap-2 pt-4 border-t mt-4">
        <div className="w-3 h-3 rounded-full bg-emerald-500" />
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Claims Frequency Heat Map</h3>
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
          REAL DATA
        </Badge>
      </div>

      {claimsFrequency.length > 0 && (
        <Card className="border-emerald-500/20">
          <CardHeader className="py-3">
            <CardDescription>Claims Frequency by State - 2025 YTD Average</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              // Calculate 2025 average frequency by state
              const stateFreqs = claimsFrequency
                .filter(f => f.year === 2025 && f.state !== 'Combined')
                .reduce((acc, f) => {
                  if (!acc[f.state]) {
                    acc[f.state] = { total: 0, count: 0 };
                  }
                  acc[f.state].total += f.frequency;
                  acc[f.state].count += 1;
                  return acc;
                }, {} as Record<string, { total: number; count: number }>);

              const stateData = Object.entries(stateFreqs)
                .map(([state, stData]) => ({
                  state,
                  avgFreq: stData.total / stData.count,
                }))
                .sort((a, b) => b.avgFreq - a.avgFreq);

              const maxFreq = Math.max(...stateData.map(s => s.avgFreq));
              const minFreq = Math.min(...stateData.map(s => s.avgFreq));

              const getHeatColor = (freq: number) => {
                const normalized = maxFreq === minFreq ? 0.5 : (freq - minFreq) / (maxFreq - minFreq);
                if (normalized > 0.75) return 'bg-red-500/80 text-white';
                if (normalized > 0.5) return 'bg-orange-500/70 text-white';
                if (normalized > 0.25) return 'bg-amber-500/60 text-foreground';
                return 'bg-emerald-500/50 text-foreground';
              };

              return (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {stateData.map(({ state, avgFreq }) => (
                    <div
                      key={state}
                      className={`p-3 rounded-lg text-center transition-all hover:scale-105 cursor-pointer ${getHeatColor(avgFreq)}`}
                      onClick={() => onDrilldown(`frequency-${state}`)}
                    >
                      <div className="text-xs font-bold uppercase">{state}</div>
                      <div className="text-lg font-bold">{(avgFreq * 100).toFixed(2)}%</div>
                      <div className="text-[10px] opacity-80">avg freq</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            
            {/* Heat Map Legend */}
            <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-emerald-500/50" />
                <span className="text-xs text-muted-foreground">Low Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-amber-500/60" />
                <span className="text-xs text-muted-foreground">Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-orange-500/70" />
                <span className="text-xs text-muted-foreground">Elevated</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500/80" />
                <span className="text-xs text-muted-foreground">High Risk</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
