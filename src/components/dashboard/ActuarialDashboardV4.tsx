import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calculator, 
  PieChart as PieChartIcon,
  BarChart3,
  Target,
  Percent,
  Activity,
  MapPin,
  Shield,
  FileText,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertCircle,
  Database
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
  LineChart,
  Line,
  ComposedChart,
  Area,
} from "recharts";
import { useActuarialData } from "@/hooks/useActuarialData";

interface ActuarialDashboardV4Props {
  data: any;
  onOpenChat: () => void;
  timestamp: string;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function ActuarialDashboardV4({ data, onOpenChat, timestamp }: ActuarialDashboardV4Props) {
  const [showStateDetails, setShowStateDetails] = useState(false);
  const [showCoverageDetails, setShowCoverageDetails] = useState(false);
  const [showFrequencyDetails, setShowFrequencyDetails] = useState(false);
  const [showPaymentsDetails, setShowPaymentsDetails] = useState(false);
  const [showOverLimitDetails, setShowOverLimitDetails] = useState(false);
  const [showAYDevDetails, setShowAYDevDetails] = useState(false);
  const [selectedFreqState, setSelectedFreqState] = useState<string>("Combined");
  const [selectedPaymentCoverage, setSelectedPaymentCoverage] = useState<string>("BI");
  const [selectedAYCoverage, setSelectedAYCoverage] = useState<string>("ALL");
  
  // Fetch actuarial data from database
  const { data: actuarialData, loading, error } = useActuarialData(2026);

  const metrics = actuarialData.metrics;
  const coverageRates = actuarialData.coverageRates;
  const stateRates = actuarialData.stateRates;
  const lossDevelopment = actuarialData.lossDevelopment;
  const claimsFrequency = actuarialData.claimsFrequency;
  const claimsPayments = actuarialData.claimsPayments;
  const overLimitPayments = actuarialData.overLimitPayments;
  const overspendSummary = actuarialData.overspendSummary;
  const accidentYearDev = actuarialData.accidentYearDev;

  // Transform loss development for chart
  const lossDevChartData = lossDevelopment.map((ld) => ({
    quarter: `Q${ld.periodQuarter} ${ld.periodYear}`,
    reported: ld.reportedLosses,
    paid: ld.paidLosses,
    incurred: ld.incurredLosses,
    ibnr: ld.ibnr,
  }));

  // Transform coverage rates for chart
  const coverageChartData = coverageRates.map((cr) => ({
    coverage: cr.coverage,
    indicated: cr.indicatedChange,
    selected: cr.selectedChange,
    premium: cr.premiumVolume,
    lossRatio: cr.lossRatio,
    trend: cr.trend,
  }));

  // Get unique states from frequency data
  const frequencyStates = [...new Set(claimsFrequency.map(f => f.state))].sort();
  
  // Filter frequency data for selected state and transform for chart
  const frequencyChartData = claimsFrequency
    .filter(f => f.state === selectedFreqState)
    .reduce((acc, f) => {
      const monthName = new Date(2000, f.month - 1).toLocaleString('default', { month: 'short' });
      const existing = acc.find(a => a.month === monthName);
      if (existing) {
        if (f.year === 2023) {
          existing.freq2023 = f.frequency;
          existing.inForce2023 = f.inForce;
        } else if (f.year === 2024) {
          existing.freq2024 = f.frequency;
          existing.inForce2024 = f.inForce;
        } else if (f.year === 2025) {
          existing.freq2025 = f.frequency;
          existing.inForce2025 = f.inForce;
        }
      } else {
        acc.push({
          month: monthName,
          freq2023: f.year === 2023 ? f.frequency : 0,
          freq2024: f.year === 2024 ? f.frequency : 0,
          freq2025: f.year === 2025 ? f.frequency : 0,
          inForce2023: f.year === 2023 ? f.inForce : 0,
          inForce2024: f.year === 2024 ? f.inForce : 0,
          inForce2025: f.year === 2025 ? f.inForce : 0,
        });
      }
      return acc;
    }, [] as { month: string; freq2023: number; freq2024: number; freq2025: number; inForce2023: number; inForce2024: number; inForce2025: number }[]);

  // Calculate state frequency averages
  const stateFreqAverages = frequencyStates
    .filter(s => s !== 'Combined')
    .map(state => {
      const stateData = claimsFrequency.filter(f => f.state === state);
      const data2023 = stateData.filter(f => f.year === 2023);
      const data2024 = stateData.filter(f => f.year === 2024);
      const data2025 = stateData.filter(f => f.year === 2025);
      return {
        state,
        avg2023: data2023.length > 0 ? data2023.reduce((s, f) => s + f.frequency, 0) / data2023.length : 0,
        avg2024: data2024.length > 0 ? data2024.reduce((s, f) => s + f.frequency, 0) / data2024.length : 0,
        avg2025: data2025.length > 0 ? data2025.reduce((s, f) => s + f.frequency, 0) / data2025.length : 0,
        totalInForce2025: data2025.length > 0 ? data2025[data2025.length - 1]?.inForce || 0 : 0,
      };
    })
    .sort((a, b) => b.totalInForce2025 - a.totalInForce2025);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Calculator className="h-6 w-6 text-primary" />
              Actuarial Financial Dashboard
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Loading data from database...</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-20 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Calculator className="h-6 w-6 text-primary" />
              Actuarial Financial Dashboard
            </h2>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenChat} className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Ask Oracle
          </Button>
        </div>
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">No Actuarial Data Available</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error || "No actuarial metrics found for the current period. Data can be uploaded via the admin panel or database."}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Database className="h-3 w-3" />
              <span>Tables: actuarial_metrics, coverage_rate_changes, state_rate_changes, loss_development</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate derived values
  const priorYearChange = metrics.priorYearLoss > 0 
    ? ((metrics.projectedLoss - metrics.priorYearLoss) / metrics.priorYearLoss) * 100 
    : 0;
  const totalProvision = metrics.selectedProfit + metrics.contingencies;
  const netProvision = totalProvision - metrics.investmentIncome;
  const avgSelectedChange = coverageRates.length > 0
    ? coverageRates.reduce((sum, c) => sum + c.selectedChange, 0) / coverageRates.length
    : 0;
  const combinedRatio = metrics.lossRatio + metrics.totalExpenseRatio;
  const lossRatioGap = (metrics.lossRatio - metrics.targetLossRatio) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Actuarial Financial Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <Database className="h-3 w-3" />
            Live Data • Q{metrics.periodQuarter} {metrics.periodYear} • {timestamp}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenChat} className="gap-2">
          <MessageSquare className="h-4 w-4" />
          Ask Oracle
        </Button>
      </div>

      {/* Primary KPIs - Loss & LAE */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Projected Loss
              </span>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(metrics.projectedLoss)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              {priorYearChange >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-amber-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-emerald-500" />
              )}
              <span className={priorYearChange >= 0 ? "text-amber-600" : "text-emerald-600"}>
                {priorYearChange >= 0 ? "+" : ""}{priorYearChange.toFixed(1)}% vs PY
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                LAE Provision
              </span>
              <FileText className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(metrics.laeAmount)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              LAE Ratio: {formatPercent(metrics.laeRatio)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Ultimate Loss
              </span>
              <Target className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(metrics.ultimateLoss)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              Dev Factor: {metrics.developmentFactor.toFixed(3)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Indicated Change
              </span>
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              +{(metrics.indicatedLevelEffect * 100).toFixed(1)}%
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <span className="text-emerald-600">Selected: +{(metrics.selectedChange * 100).toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense Ratios & Profit Provisions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expense Ratios Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" />
              Expense Ratios
            </CardTitle>
            <CardDescription>Fixed, Variable & Combined Analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Fixed Expense */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Fixed Expense Ratio</span>
                  <span className="text-lg font-bold">{formatPercent(metrics.fixedExpenseRatio)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${metrics.fixedExpenseRatio * 100 * 3}%` }}
                  />
                </div>
              </div>

              {/* Variable Expense */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Variable Expense Ratio</span>
                  <span className="text-lg font-bold">{formatPercent(metrics.variableExpenseRatio)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: `${metrics.variableExpenseRatio * 100 * 3}%` }}
                  />
                </div>
              </div>

              {/* Total Expense */}
              <div className="pt-2 border-t space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Expense Ratio</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{formatPercent(metrics.totalExpenseRatio)}</span>
                    {metrics.totalExpenseRatio > metrics.targetExpenseRatio ? (
                      <Badge variant="destructive" className="text-xs">Above Target</Badge>
                    ) : (
                      <Badge className="bg-emerald-500 text-xs">On Target</Badge>
                    )}
                  </div>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                    style={{ width: `${metrics.totalExpenseRatio * 100 * 3}%` }}
                  />
                  {/* Target marker */}
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-500"
                    style={{ left: `${metrics.targetExpenseRatio * 100 * 3}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Target: {formatPercent(metrics.targetExpenseRatio)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profit & Contingencies Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Profit & Contingencies
            </CardTitle>
            <CardDescription>Selected Provisions & Investment Income</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Selected Profit</div>
                  <div className="text-xl font-bold">{formatPercent(metrics.selectedProfit)}</div>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">Contingencies</div>
                  <div className="text-xl font-bold">{formatPercent(metrics.contingencies)}</div>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total Provision</span>
                  <span className="font-semibold">{formatPercent(totalProvision)}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-600">
                  <span className="text-sm">Less: Investment Income</span>
                  <span className="font-semibold">-{formatPercent(metrics.investmentIncome)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between items-center">
                  <span className="text-sm font-medium">Net Provision Required</span>
                  <span className="text-lg font-bold text-primary">{formatPercent(netProvision)}</span>
                </div>
              </div>

              {/* Loss Ratio Comparison */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground">Current Loss Ratio</div>
                  <div className="text-lg font-bold">{formatPercent(metrics.lossRatio)}</div>
                </div>
                <ArrowUpRight className="h-5 w-5 text-amber-500" />
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Target Loss Ratio</div>
                  <div className="text-lg font-bold text-emerald-600">{formatPercent(metrics.targetLossRatio)}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rate Changes by Coverage */}
      {coverageRates.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Selected Rate Changes by Coverage
                </CardTitle>
                <CardDescription>Indicated vs Selected with Premium Volume</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowCoverageDetails(!showCoverageDetails)}
              >
                {showCoverageDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={coverageChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="coverage" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v/1000000}M`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'premium') return [formatCurrency(value), 'Premium'];
                      return [`${value}%`, name === 'indicated' ? 'Indicated' : 'Selected'];
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="indicated" name="Indicated" fill="#F59E0B" opacity={0.7} />
                  <Bar yAxisId="left" dataKey="selected" name="Selected" fill="#10B981" />
                  <Line yAxisId="right" type="monotone" dataKey="premium" name="Premium" stroke="#3B82F6" strokeWidth={2} dot />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {showCoverageDetails && (
              <div className="mt-4 border-t pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coverage</TableHead>
                      <TableHead className="text-right">Indicated</TableHead>
                      <TableHead className="text-right">Selected</TableHead>
                      <TableHead className="text-right">Premium</TableHead>
                      <TableHead className="text-right">Loss Ratio</TableHead>
                      <TableHead className="text-center">Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coverageRates.map((row) => (
                      <TableRow key={row.coverage}>
                        <TableCell className="font-medium">{row.coverage}</TableCell>
                        <TableCell className="text-right text-amber-600">+{row.indicatedChange}%</TableCell>
                        <TableCell className="text-right text-emerald-600 font-semibold">+{row.selectedChange}%</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.premiumVolume)}</TableCell>
                        <TableCell className="text-right">{row.lossRatio}%</TableCell>
                        <TableCell className="text-center">
                          {row.trend === "up" && <TrendingUp className="h-4 w-4 text-amber-500 inline" />}
                          {row.trend === "down" && <TrendingDown className="h-4 w-4 text-emerald-500 inline" />}
                          {row.trend === "flat" && <Minus className="h-4 w-4 text-muted-foreground inline" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* State Rate Changes */}
      {stateRates.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Rate Changes by State
                </CardTitle>
                <CardDescription>Filing Status & Volume Analysis</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowStateDetails(!showStateDetails)}
              >
                {showStateDetails ? "Collapse" : "Expand"} Details
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {stateRates.slice(0, 4).map((state) => (
                <div 
                  key={state.state}
                  className="p-3 border rounded-lg bg-gradient-to-br from-muted/30 to-muted/10"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{state.state}</span>
                    <Badge 
                      variant={state.filingStatus === "Approved" ? "default" : state.filingStatus === "Filed" ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {state.filingStatus}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold text-primary">+{state.selectedChange}%</div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Ind: +{state.indicatedChange}%</span>
                    <span>{state.policyVolume.toLocaleString()} policies</span>
                  </div>
                </div>
              ))}
            </div>

            {showStateDetails && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Indicated</TableHead>
                    <TableHead className="text-right">Selected</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">Loss Ratio</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stateRates.map((row) => (
                    <TableRow key={row.state}>
                      <TableCell className="font-medium">{row.state}</TableCell>
                      <TableCell className="text-right text-amber-600">+{row.indicatedChange}%</TableCell>
                      <TableCell className="text-right text-emerald-600 font-semibold">+{row.selectedChange}%</TableCell>
                      <TableCell className="text-right">{row.policyVolume.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.lossRatio}%</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={row.filingStatus === "Approved" ? "default" : row.filingStatus === "Filed" ? "secondary" : "outline"}
                        >
                          {row.filingStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loss Development Trend */}
      {lossDevelopment.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Quarterly Loss Development
            </CardTitle>
            <CardDescription>Reported, Paid, Incurred & IBNR Progression</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={lossDevChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v/1000000}M`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: any) => [formatCurrency(value), '']}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="incurred" name="Incurred" fill="#3B82F6" fillOpacity={0.2} stroke="#3B82F6" strokeWidth={2} />
                  <Bar dataKey="reported" name="Reported" fill="#10B981" />
                  <Bar dataKey="paid" name="Paid" fill="#8B5CF6" />
                  <Line type="monotone" dataKey="ibnr" name="IBNR" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 5" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Claims Frequency by State */}
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
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowFrequencyDetails(!showFrequencyDetails)}
                >
                  {showFrequencyDetails ? "Hide Table" : "Show Table"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Frequency Trend Chart */}
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
                      borderRadius: '8px'
                    }}
                    formatter={(value: any) => [`${Number(value).toFixed(1)}%`, '']}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="freq2023" name="2023" stroke="#94A3B8" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="freq2024" name="2024" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="freq2025" name="2025" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* State Summary Cards */}
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

            {/* Detailed Table */}
            {showFrequencyDetails && (
              <div className="border-t pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>State</TableHead>
                      <TableHead className="text-right">2023 Avg</TableHead>
                      <TableHead className="text-right">2024 Avg</TableHead>
                      <TableHead className="text-right">2025 Avg</TableHead>
                      <TableHead className="text-right">YoY Change</TableHead>
                      <TableHead className="text-right">In Force (Dec '25)</TableHead>
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
                          <TableCell className="text-right">{row.avg2023.toFixed(1)}%</TableCell>
                          <TableCell className="text-right">{row.avg2024.toFixed(1)}%</TableCell>
                          <TableCell className="text-right font-semibold">{row.avg2025.toFixed(1)}%</TableCell>
                          <TableCell className={`text-right ${yoyChange < 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {yoyChange >= 0 ? '+' : ''}{yoyChange.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right">{row.totalInForce2025.toLocaleString()}</TableCell>
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

      {/* Claims Payments by Coverage */}
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
                  {['BI', 'PD', 'UM', 'CL', 'OC', 'UI', 'MP', 'PP', 'UP', 'RN', 'TL', 'DW', 'TOTAL'].map(cov => (
                    <option key={cov} value={cov}>{cov}</option>
                  ))}
                </select>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowPaymentsDetails(!showPaymentsDetails)}
                >
                  {showPaymentsDetails ? "Hide Table" : "Show Table"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* YTD Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              {[2021, 2022, 2023, 2024, 2025].map(year => {
                const ytdData = claimsPayments.find(p => 
                  p.coverage === selectedPaymentCoverage && 
                  p.periodYear === year && 
                  p.isYtd
                );
                const prevYtd = claimsPayments.find(p => 
                  p.coverage === selectedPaymentCoverage && 
                  p.periodYear === year - 1 && 
                  p.isYtd
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
                        <TrendingUp className="h-3 w-3 text-amber-500" />
                      ) : yoyChange < 0 ? (
                        <TrendingDown className="h-3 w-3 text-emerald-500" />
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

            {/* Monthly 2025 Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={
                  claimsPayments
                    .filter(p => p.coverage === selectedPaymentCoverage && p.periodYear === 2025 && !p.isYtd && p.periodMonth)
                    .map(p => ({
                      month: new Date(2000, (p.periodMonth || 1) - 1).toLocaleString('default', { month: 'short' }),
                      payments: p.totalPayments,
                      claimants: p.claimantsPaid,
                      avgPaid: p.avgPaidPerClaimant,
                    }))
                }>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v/1000000}M`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v/1000}K`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'payments') return [formatCurrency(value), 'Total Payments'];
                      if (name === 'avgPaid') return [formatCurrency(value), 'Avg per Claimant'];
                      return [value.toLocaleString(), 'Claimants'];
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="payments" name="Total Payments" fill="#3B82F6" />
                  <Line yAxisId="right" type="monotone" dataKey="avgPaid" name="Avg per Claimant" stroke="#F59E0B" strokeWidth={2} dot />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed Table */}
            {showPaymentsDetails && (
              <div className="border-t pt-4 mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coverage</TableHead>
                      <TableHead className="text-right">2021 YTD</TableHead>
                      <TableHead className="text-right">2022 YTD</TableHead>
                      <TableHead className="text-right">2023 YTD</TableHead>
                      <TableHead className="text-right">2024 YTD</TableHead>
                      <TableHead className="text-right">2025 YTD</TableHead>
                      <TableHead className="text-right">YoY Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {['BI', 'PD', 'CL', 'UM', 'OC', 'UI', 'UP', 'RN', 'MP', 'PP', 'TL', 'DW', 'TOTAL'].map(cov => {
                      const getYtd = (year: number) => claimsPayments.find(p => 
                        p.coverage === cov && p.periodYear === year && p.isYtd
                      )?.totalPayments || 0;
                      
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
                          <TableCell className="text-right">{formatCurrency(getYtd(2021))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(getYtd(2022))}</TableCell>
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

      {/* Over Limit Payments */}
      {overLimitPayments.length > 0 && (
        <Card className="border-red-500/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Over-Limit Payments Tracker
                </CardTitle>
                <CardDescription>2025 YTD Payments Exceeding Policy Limits</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowOverLimitDetails(!showOverLimitDetails)}
              >
                {showOverLimitDetails ? "Collapse" : "Expand"} All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <div className="text-xs text-red-600 dark:text-red-400">Total Over-Limit</div>
                <div className="text-xl font-bold text-red-600">
                  {formatCurrency(overLimitPayments.reduce((s, p) => s + p.overLimitAmount, 0))}
                </div>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div className="text-xs text-amber-600 dark:text-amber-400">Total Payments</div>
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

            {/* By State Summary */}
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
                  <div key={state} className="p-2 bg-muted/30 rounded-lg text-center">
                    <div className="text-xs font-medium">{state}</div>
                    <div className="text-sm font-bold text-red-600">{formatCurrency(amount)}</div>
                  </div>
                ))}
            </div>

            {/* Top Claims Table */}
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
                {overLimitPayments.slice(0, showOverLimitDetails ? 50 : 10).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{new Date(row.paymentDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono text-xs">{row.claimNumber}</TableCell>
                    <TableCell>{row.state}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.policyLimit)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.paymentAmount)}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      {formatCurrency(row.overLimitAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!showOverLimitDetails && overLimitPayments.length > 10 && (
              <div className="text-center mt-2 text-sm text-muted-foreground">
                Showing top 10 of {overLimitPayments.length} claims
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Overspend Summary - Anomaly vs Issue */}
      {overspendSummary.length > 0 && (
        <Card className="border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Over-Limit Overspend Analysis
            </CardTitle>
            <CardDescription>Anomaly (10/10 we'd do same) vs Issue (10/10 we had control)</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Summary Totals */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 text-center">
                <div className="text-xs text-blue-600 dark:text-blue-400">Anomaly Total</div>
                <div className="text-xl font-bold text-blue-600">
                  {formatCurrency(overspendSummary.filter(o => o.issueType === 'anomaly').reduce((s, o) => s + o.totalAmount, 0))}
                </div>
                <div className="text-xs text-muted-foreground">Out of our control</div>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 text-center">
                <div className="text-xs text-red-600 dark:text-red-400">Issue Total</div>
                <div className="text-xl font-bold text-red-600">
                  {formatCurrency(overspendSummary.filter(o => o.issueType === 'issue').reduce((s, o) => s + o.totalAmount, 0))}
                </div>
                <div className="text-xs text-muted-foreground">We had control</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg border text-center">
                <div className="text-xs text-muted-foreground">Grand Total</div>
                <div className="text-xl font-bold">
                  {formatCurrency(overspendSummary.reduce((s, o) => s + o.totalAmount, 0))}
                </div>
              </div>
            </div>

            {/* By State Breakdown */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Anomaly</TableHead>
                  <TableHead className="text-right">Issue</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...new Set(overspendSummary.map(o => o.state))].map(state => {
                  const anomaly = overspendSummary.find(o => o.state === state && o.issueType === 'anomaly')?.totalAmount || 0;
                  const issue = overspendSummary.find(o => o.state === state && o.issueType === 'issue')?.totalAmount || 0;
                  return (
                    <TableRow key={state}>
                      <TableCell className="font-medium">{state}</TableCell>
                      <TableCell className="text-right text-blue-600">{anomaly > 0 ? formatCurrency(anomaly) : '—'}</TableCell>
                      <TableCell className="text-right text-red-600">{issue > 0 ? formatCurrency(issue) : '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(anomaly + issue)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Accident Year Loss Development */}
      {accidentYearDev.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Accident Year Loss Development
                </CardTitle>
                <CardDescription>AY 2024 at 6 Months (as of May 31, 2025) vs Historical</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedAYCoverage}
                  onChange={(e) => setSelectedAYCoverage(e.target.value)}
                  className="text-sm border rounded-md px-2 py-1 bg-background"
                >
                  {['ALL', 'BI', 'PD', 'CL', 'OTHER'].map(cov => (
                    <option key={cov} value={cov}>{cov === 'ALL' ? 'All Coverages' : cov}</option>
                  ))}
                </select>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowAYDevDetails(!showAYDevDetails)}
                >
                  {showAYDevDetails ? "Hide Details" : "Show Details"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Grand Total Comparison by AY */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[2024, 2023, 2022, 2021].map(ay => {
                const grandTotal = accidentYearDev.find(d => 
                  d.accidentYear === ay && 
                  d.coverage === selectedAYCoverage && 
                  d.category === 'Grand Total'
                );
                return grandTotal ? (
                  <div 
                    key={ay}
                    className={`p-3 border rounded-lg ${
                      ay === 2024 ? 'bg-primary/10 border-primary' : 'bg-muted/30'
                    }`}
                  >
                    <div className="text-xs font-medium text-muted-foreground">AY {ay} @ 6mo</div>
                    <div className={`text-lg font-bold ${grandTotal.incurred < 0 ? 'text-emerald-600' : grandTotal.incurredPctPremium > 5 ? 'text-red-600' : ''}`}>
                      {grandTotal.incurredPctPremium.toFixed(2)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(grandTotal.incurred)} incurred
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(grandTotal.earnedPremium)} EP
                    </div>
                  </div>
                ) : null;
              })}
            </div>

            {/* Detailed Category Breakdown for AY 2024 */}
            {showAYDevDetails && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">AY 2024 Category Breakdown - {selectedAYCoverage}</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Features</TableHead>
                      <TableHead className="text-right">Prior Reserve</TableHead>
                      <TableHead className="text-right">Net Payment</TableHead>
                      <TableHead className="text-right">Reserve Bal</TableHead>
                      <TableHead className="text-right">Incurred</TableHead>
                      <TableHead className="text-right">% EP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accidentYearDev
                      .filter(d => d.accidentYear === 2024 && d.coverage === selectedAYCoverage)
                      .map(row => (
                        <TableRow 
                          key={row.category}
                          className={row.category === 'Grand Total' ? 'font-bold border-t-2' : ''}
                        >
                          <TableCell>{row.category}</TableCell>
                          <TableCell className="text-right">{row.featureCount.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.priorReserve)}</TableCell>
                          <TableCell className={`text-right ${row.netClaimPayment < 0 ? 'text-emerald-600' : ''}`}>
                            {formatCurrency(row.netClaimPayment)}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(row.reserveBalance)}</TableCell>
                          <TableCell className={`text-right ${row.incurred < 0 ? 'text-emerald-600' : row.incurred > 0 ? 'text-amber-600' : ''}`}>
                            {formatCurrency(row.incurred)}
                          </TableCell>
                          <TableCell className={`text-right ${row.incurredPctPremium < 0 ? 'text-emerald-600' : row.incurredPctPremium > 3 ? 'text-red-600' : ''}`}>
                            {row.incurredPctPremium.toFixed(2)}%
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Stats Footer */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 bg-muted/50 rounded-lg text-center">
          <div className="text-xs text-muted-foreground">Credibility</div>
          <div className="text-lg font-bold">{(metrics.credibility * 100).toFixed(0)}%</div>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg text-center">
          <div className="text-xs text-muted-foreground">Trend Factor</div>
          <div className="text-lg font-bold">{metrics.trendFactor.toFixed(3)}</div>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg text-center">
          <div className="text-xs text-muted-foreground">Loss Ratio Gap</div>
          <div className="text-lg font-bold text-amber-600">
            {lossRatioGap >= 0 ? "+" : ""}{lossRatioGap.toFixed(1)}pts
          </div>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg text-center">
          <div className="text-xs text-muted-foreground">Combined Ratio</div>
          <div className="text-lg font-bold">
            {(combinedRatio * 100).toFixed(1)}%
          </div>
        </div>
        <div className="p-3 bg-primary/10 rounded-lg text-center border border-primary/20">
          <div className="text-xs text-primary">Avg Selected Change</div>
          <div className="text-lg font-bold text-primary">
            +{avgSelectedChange.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* AI Chat Launcher */}
      <div className="flex justify-center pt-2">
        <Button onClick={onOpenChat} className="gap-2 bg-gradient-to-r from-primary to-primary/80">
          <MessageSquare className="h-4 w-4" />
          Deep Dive with Oracle AI
        </Button>
      </div>
    </div>
  );
}
