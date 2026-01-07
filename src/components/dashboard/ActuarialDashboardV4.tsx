import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Minus
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

interface ActuarialDashboardV4Props {
  data: any;
  onOpenChat: () => void;
  timestamp: string;
}

// Actuarial data - structured for rate filing and financial planning
const ACTUARIAL_METRICS = {
  projectedLossLAE: {
    currentYear: 18750000,
    priorYear: 16420000,
    ultimateLoss: 21340000,
    lae: 3245000,
    laeRatio: 0.152,
    developmentFactor: 1.138,
  },
  expenseRatios: {
    fixedExpense: 0.142, // 14.2%
    variableExpense: 0.089, // 8.9%
    totalExpense: 0.231, // 23.1%
    targetExpense: 0.225, // 22.5% target
    priorYearExpense: 0.238, // 23.8% prior year
  },
  profitProvisions: {
    selectedProfit: 0.050, // 5.0%
    contingencies: 0.020, // 2.0%
    totalProvision: 0.070, // 7.0%
    investmentIncome: 0.015, // 1.5% offset
    netProvision: 0.055, // 5.5% net
  },
  rateIndication: {
    indicatedLevelEffect: 0.087, // +8.7% indicated
    selectedChange: 0.065, // +6.5% selected
    credibility: 0.82,
    trendFactor: 1.042,
    lossRatio: 0.683, // 68.3%
    targetLossRatio: 0.650, // 65.0%
  }
};

// Rate changes by coverage
const COVERAGE_RATE_CHANGES = [
  { coverage: "Bodily Injury", indicated: 9.2, selected: 7.0, premium: 8450000, lossRatio: 71.2, trend: "up" },
  { coverage: "Property Damage", indicated: 4.8, selected: 4.0, premium: 3210000, lossRatio: 58.4, trend: "down" },
  { coverage: "Collision", indicated: 7.5, selected: 6.0, premium: 5670000, lossRatio: 66.8, trend: "up" },
  { coverage: "Comprehensive", indicated: 3.2, selected: 2.5, premium: 2140000, lossRatio: 52.1, trend: "flat" },
  { coverage: "UM/UIM", indicated: 12.4, selected: 9.0, premium: 4890000, lossRatio: 78.3, trend: "up" },
  { coverage: "Medical Payments", indicated: 5.1, selected: 4.5, premium: 1280000, lossRatio: 61.7, trend: "flat" },
];

// State-level rate changes
const STATE_RATE_CHANGES = [
  { state: "Texas", indicated: 11.2, selected: 8.5, volume: 4250, lossRatio: 74.8, status: "Filed" },
  { state: "California", indicated: 8.7, selected: 6.5, volume: 3890, lossRatio: 69.2, status: "Pending" },
  { state: "Florida", indicated: 14.3, selected: 10.0, volume: 3120, lossRatio: 82.1, status: "Approved" },
  { state: "New York", indicated: 6.4, selected: 5.0, volume: 2780, lossRatio: 64.3, status: "Filed" },
  { state: "Illinois", indicated: 7.8, selected: 6.0, volume: 1950, lossRatio: 67.9, status: "Pending" },
  { state: "Georgia", indicated: 9.5, selected: 7.5, volume: 1680, lossRatio: 71.4, status: "Draft" },
  { state: "Arizona", indicated: 5.9, selected: 4.5, volume: 1420, lossRatio: 62.8, status: "Approved" },
  { state: "Pennsylvania", indicated: 4.2, selected: 3.5, volume: 1350, lossRatio: 58.9, status: "Filed" },
];

// Quarterly loss development
const LOSS_DEVELOPMENT_DATA = [
  { quarter: "Q1 2025", reported: 4250000, paid: 3180000, incurred: 4850000, ibnr: 1420000 },
  { quarter: "Q2 2025", reported: 4680000, paid: 3540000, incurred: 5120000, ibnr: 1380000 },
  { quarter: "Q3 2025", reported: 4920000, paid: 3780000, incurred: 5340000, ibnr: 1290000 },
  { quarter: "Q4 2025", reported: 4390000, paid: 3420000, incurred: 4890000, ibnr: 1180000 },
];

const COLORS = {
  primary: "hsl(var(--primary))",
  accent: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  muted: "hsl(var(--muted-foreground))",
  chart1: "#3B82F6",
  chart2: "#10B981",
  chart3: "#F59E0B",
  chart4: "#8B5CF6",
};

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function ActuarialDashboardV4({ data, onOpenChat, timestamp }: ActuarialDashboardV4Props) {
  const [showStateDetails, setShowStateDetails] = useState(false);
  const [showCoverageDetails, setShowCoverageDetails] = useState(false);

  const { projectedLossLAE, expenseRatios, profitProvisions, rateIndication } = ACTUARIAL_METRICS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Actuarial Financial Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Rate Indication & Financial Performance • {timestamp}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenChat}
          className="gap-2"
        >
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
              {formatCurrency(projectedLossLAE.currentYear)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <ArrowUpRight className="h-3 w-3 text-amber-500" />
              <span className="text-amber-600">+14.2% vs PY</span>
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
              {formatCurrency(projectedLossLAE.lae)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              LAE Ratio: {formatPercent(projectedLossLAE.laeRatio)}
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
              {formatCurrency(projectedLossLAE.ultimateLoss)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              Dev Factor: {projectedLossLAE.developmentFactor.toFixed(3)}
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
              +{(rateIndication.indicatedLevelEffect * 100).toFixed(1)}%
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <span className="text-emerald-600">Selected: +{(rateIndication.selectedChange * 100).toFixed(1)}%</span>
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
                  <span className="text-lg font-bold">{formatPercent(expenseRatios.fixedExpense)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${expenseRatios.fixedExpense * 100 * 3}%` }}
                  />
                </div>
              </div>

              {/* Variable Expense */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Variable Expense Ratio</span>
                  <span className="text-lg font-bold">{formatPercent(expenseRatios.variableExpense)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: `${expenseRatios.variableExpense * 100 * 3}%` }}
                  />
                </div>
              </div>

              {/* Total Expense */}
              <div className="pt-2 border-t space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Expense Ratio</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{formatPercent(expenseRatios.totalExpense)}</span>
                    {expenseRatios.totalExpense > expenseRatios.targetExpense ? (
                      <Badge variant="destructive" className="text-xs">Above Target</Badge>
                    ) : (
                      <Badge className="bg-emerald-500 text-xs">On Target</Badge>
                    )}
                  </div>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                    style={{ width: `${expenseRatios.totalExpense * 100 * 3}%` }}
                  />
                  {/* Target marker */}
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-500"
                    style={{ left: `${expenseRatios.targetExpense * 100 * 3}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Target: {formatPercent(expenseRatios.targetExpense)}</span>
                  <span>Prior Year: {formatPercent(expenseRatios.priorYearExpense)}</span>
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
                  <div className="text-xl font-bold">{formatPercent(profitProvisions.selectedProfit)}</div>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">Contingencies</div>
                  <div className="text-xl font-bold">{formatPercent(profitProvisions.contingencies)}</div>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total Provision</span>
                  <span className="font-semibold">{formatPercent(profitProvisions.totalProvision)}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-600">
                  <span className="text-sm">Less: Investment Income</span>
                  <span className="font-semibold">-{formatPercent(profitProvisions.investmentIncome)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between items-center">
                  <span className="text-sm font-medium">Net Provision Required</span>
                  <span className="text-lg font-bold text-primary">{formatPercent(profitProvisions.netProvision)}</span>
                </div>
              </div>

              {/* Loss Ratio Comparison */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="text-xs text-muted-foreground">Current Loss Ratio</div>
                  <div className="text-lg font-bold">{formatPercent(rateIndication.lossRatio)}</div>
                </div>
                <ArrowUpRight className="h-5 w-5 text-amber-500" />
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Target Loss Ratio</div>
                  <div className="text-lg font-bold text-emerald-600">{formatPercent(rateIndication.targetLossRatio)}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rate Changes by Coverage */}
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
              <ComposedChart data={COVERAGE_RATE_CHANGES}>
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
                  {COVERAGE_RATE_CHANGES.map((row) => (
                    <TableRow key={row.coverage}>
                      <TableCell className="font-medium">{row.coverage}</TableCell>
                      <TableCell className="text-right text-amber-600">+{row.indicated}%</TableCell>
                      <TableCell className="text-right text-emerald-600 font-semibold">+{row.selected}%</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.premium)}</TableCell>
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

      {/* State Rate Changes */}
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
            {STATE_RATE_CHANGES.slice(0, 4).map((state) => (
              <div 
                key={state.state}
                className="p-3 border rounded-lg bg-gradient-to-br from-muted/30 to-muted/10"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{state.state}</span>
                  <Badge 
                    variant={state.status === "Approved" ? "default" : state.status === "Filed" ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {state.status}
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-primary">+{state.selected}%</div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Ind: +{state.indicated}%</span>
                  <span>{state.volume.toLocaleString()} policies</span>
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
                {STATE_RATE_CHANGES.map((row) => (
                  <TableRow key={row.state}>
                    <TableCell className="font-medium">{row.state}</TableCell>
                    <TableCell className="text-right text-amber-600">+{row.indicated}%</TableCell>
                    <TableCell className="text-right text-emerald-600 font-semibold">+{row.selected}%</TableCell>
                    <TableCell className="text-right">{row.volume.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{row.lossRatio}%</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={row.status === "Approved" ? "default" : row.status === "Filed" ? "secondary" : "outline"}
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Loss Development Trend */}
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
              <ComposedChart data={LOSS_DEVELOPMENT_DATA}>
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

      {/* Summary Stats Footer */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 bg-muted/50 rounded-lg text-center">
          <div className="text-xs text-muted-foreground">Credibility</div>
          <div className="text-lg font-bold">{(rateIndication.credibility * 100).toFixed(0)}%</div>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg text-center">
          <div className="text-xs text-muted-foreground">Trend Factor</div>
          <div className="text-lg font-bold">{rateIndication.trendFactor.toFixed(3)}</div>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg text-center">
          <div className="text-xs text-muted-foreground">Loss Ratio Gap</div>
          <div className="text-lg font-bold text-amber-600">
            +{((rateIndication.lossRatio - rateIndication.targetLossRatio) * 100).toFixed(1)}pts
          </div>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg text-center">
          <div className="text-xs text-muted-foreground">Combined Ratio</div>
          <div className="text-lg font-bold">
            {((rateIndication.lossRatio + expenseRatios.totalExpense) * 100).toFixed(1)}%
          </div>
        </div>
        <div className="p-3 bg-primary/10 rounded-lg text-center border border-primary/20">
          <div className="text-xs text-primary">Avg Selected Change</div>
          <div className="text-lg font-bold text-primary">
            +{(COVERAGE_RATE_CHANGES.reduce((sum, c) => sum + c.selected, 0) / COVERAGE_RATE_CHANGES.length).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* AI Chat Launcher */}
      <div className="flex justify-center pt-2">
        <Button
          onClick={onOpenChat}
          className="gap-2 bg-gradient-to-r from-primary to-primary/80"
        >
          <MessageSquare className="h-4 w-4" />
          Deep Dive with Oracle AI
        </Button>
      </div>
    </div>
  );
}
