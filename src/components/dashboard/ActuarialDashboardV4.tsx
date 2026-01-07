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
  
  // Fetch actuarial data from database
  const { data: actuarialData, loading, error } = useActuarialData(2026);

  const metrics = actuarialData.metrics;
  const coverageRates = actuarialData.coverageRates;
  const stateRates = actuarialData.stateRates;
  const lossDevelopment = actuarialData.lossDevelopment;

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
