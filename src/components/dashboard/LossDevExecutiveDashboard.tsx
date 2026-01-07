import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calculator,
  BarChart3,
  Activity,
  AlertCircle,
  Database,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare,
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
  Legend,
  LineChart,
  Line,
  ComposedChart,
  Area,
} from "recharts";
import { useActuarialData } from "@/hooks/useActuarialData";
import { useLossTriangleData } from "@/hooks/useLossTriangleData";

interface LossDevExecutiveDashboardProps {
  onOpenChat: () => void;
  timestamp: string;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

export function LossDevExecutiveDashboard({ onOpenChat, timestamp }: LossDevExecutiveDashboardProps) {
  const [showFrequencyDetails, setShowFrequencyDetails] = useState(false);
  const [showPaymentsDetails, setShowPaymentsDetails] = useState(false);
  const [showOverLimitDetails, setShowOverLimitDetails] = useState(false);
  const [showAYDetails, setShowAYDetails] = useState(false);
  const [selectedFreqState, setSelectedFreqState] = useState<string>("Combined");
  const [selectedPaymentCoverage, setSelectedPaymentCoverage] = useState<string>("BI");

  // Fetch actuarial data from database
  const { data: actuarialData, loading: actuarialLoading } = useActuarialData(2026);
  const triangleData = useLossTriangleData();

  const claimsFrequency = actuarialData.claimsFrequency;
  const claimsPayments = actuarialData.claimsPayments;
  const overLimitPayments = actuarialData.overLimitPayments;
  const overspendSummary = actuarialData.overspendSummary;

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

  // Overspend breakdown
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

  const loading = actuarialLoading || triangleData.loading;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Loss Development Dashboard</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Loading actuarial data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Loss Development Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <Database className="h-3 w-3" />
            Live Data • AY 2017-2025 Triangles • {timestamp}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenChat} className="gap-2">
          <MessageSquare className="h-4 w-4" />
          Ask Oracle
        </Button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: Accident Year Loss Development (from triangle data) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: Claims Frequency by State */}
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
      {/* SECTION 3: Claims Payments by Coverage */}
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
      {/* SECTION 4: Over-Limit Payments Tracker */}
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

            {/* Overspend Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div className="text-xs text-amber-600">Anomaly Total</div>
                <div className="text-lg font-bold text-amber-600">{formatCurrency(overspendByType.anomaly)}</div>
                <div className="text-xs text-muted-foreground">Out of our control</div>
              </div>
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <div className="text-xs text-destructive">Issue Total</div>
                <div className="text-lg font-bold text-destructive">{formatCurrency(overspendByType.issue)}</div>
                <div className="text-xs text-muted-foreground">We had control</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg border">
                <div className="text-xs text-muted-foreground">Grand Total</div>
                <div className="text-lg font-bold">{formatCurrency(overspendByType.anomaly + overspendByType.issue)}</div>
              </div>
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
    </div>
  );
}
