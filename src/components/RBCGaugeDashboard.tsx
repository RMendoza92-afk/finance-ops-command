import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gauge, TrendingUp, TrendingDown, Activity, RefreshCw, AlertTriangle, CheckCircle, Target, DollarSign, Percent, BarChart3, Triangle, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useExportData } from '@/hooks/useExportData';
import { format } from 'date-fns';

interface RBCGaugeDashboardProps {
  className?: string;
}

interface ActuarialMetricsRow {
  loss_ratio: number | null;
  lae_ratio: number | null;
  total_expense_ratio: number | null;
  development_factor: number | null;
  trend_factor: number | null;
  ultimate_loss: number | null;
  credibility: number | null;
  selected_change: number | null;
  target_loss_ratio: number | null;
}

interface LossDevelopmentRow {
  ibnr: number | null;
  incurred_losses: number | null;
  paid_losses: number | null;
}

interface InventorySnapshot {
  total_reserves: number | null;
  total_high_eval: number | null;
  total_low_eval: number | null;
}

interface AccidentYearSummary {
  accident_year: number;
  earned_premium: number;
  net_paid: number;
  reserves: number;
  ibnr: number;
  incurred: number;
  loss_ratio: number;
}

interface TriangleDataPoint {
  accident_year: number;
  development_months: number;
  metric_type: string;
  amount: number;
}

const RBCGaugeDashboard = ({ className }: RBCGaugeDashboardProps) => {
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ActuarialMetricsRow | null>(null);
  const [lossDev, setLossDev] = useState<LossDevelopmentRow | null>(null);
  const [inventory, setInventory] = useState<InventorySnapshot | null>(null);
  const [accidentYears, setAccidentYears] = useState<AccidentYearSummary[]>([]);
  const [triangleData, setTriangleData] = useState<TriangleDataPoint[]>([]);
  const { generatePDF, generateExcel } = useExportData();

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const [metricsRes, lossRes, invRes, ayRes, triangleRes] = await Promise.all([
        supabase
          .from('actuarial_metrics')
          .select('loss_ratio, lae_ratio, total_expense_ratio, development_factor, trend_factor, ultimate_loss, credibility, selected_change, target_loss_ratio')
          .order('period_year', { ascending: false })
          .order('period_quarter', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('loss_development')
          .select('ibnr, incurred_losses, paid_losses')
          .order('period_year', { ascending: false })
          .order('period_quarter', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('inventory_snapshots')
          .select('total_reserves, total_high_eval, total_low_eval')
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('accident_year_development')
          .select('accident_year, earned_premium, net_claim_payment, reserve_balance, incurred, incurred_pct_premium')
          .gte('accident_year', 2023)
          .order('accident_year', { ascending: false }),
        supabase
          .from('loss_development_triangles')
          .select('accident_year, development_months, metric_type, amount')
          .in('metric_type', ['loss_ratio', 'net_paid_loss', 'earned_premium', 'claim_reserves', 'bulk_ibnr', 'gross_paid'])
          .gte('accident_year', 2017)
          .order('accident_year', { ascending: true })
          .order('development_months', { ascending: true })
      ]);

      if (metricsRes.data) setMetrics(metricsRes.data);
      if (lossRes.data) setLossDev(lossRes.data);
      if (invRes.data) setInventory(invRes.data);
      
      // Aggregate accident year data
      if (ayRes.data) {
        const grouped = ayRes.data.reduce((acc, row) => {
          const year = row.accident_year;
          if (!acc[year]) {
            acc[year] = { earned_premium: 0, net_paid: 0, reserves: 0, incurred: 0, loss_ratios: [] };
          }
          acc[year].earned_premium += row.earned_premium || 0;
          acc[year].net_paid += row.net_claim_payment || 0;
          acc[year].reserves += row.reserve_balance || 0;
          acc[year].incurred += row.incurred || 0;
          if (row.incurred_pct_premium) acc[year].loss_ratios.push(row.incurred_pct_premium);
          return acc;
        }, {} as Record<number, { earned_premium: number; net_paid: number; reserves: number; incurred: number; loss_ratios: number[] }>);
        
        const summaries: AccidentYearSummary[] = Object.entries(grouped).map(([year, data]) => {
          const ibnr = Math.max(0, data.incurred - data.net_paid - data.reserves);
          // Calculate loss ratio as incurred / earned premium
          const lossRatio = data.earned_premium > 0 ? (data.incurred / data.earned_premium) * 100 : 0;
          return {
            accident_year: parseInt(year),
            earned_premium: data.earned_premium,
            net_paid: data.net_paid,
            reserves: data.reserves,
            ibnr,
            incurred: data.incurred,
            loss_ratio: lossRatio > 0 ? lossRatio : (data.loss_ratios.length > 0 ? data.loss_ratios.reduce((a, b) => a + b, 0) / data.loss_ratios.length : 0)
          };
        }).sort((a, b) => b.accident_year - a.accident_year);
        
        setAccidentYears(summaries);
      }
      
      // Set triangle data
      if (triangleRes.data) {
        setTriangleData(triangleRes.data as TriangleDataPoint[]);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate RBC metrics from real data
  const rbcMetrics = useMemo(() => {
    // Convert decimal ratios to percentages (DB stores as 0.683 = 68.3%)
    const lossRatio = (metrics?.loss_ratio ?? 0.65) * 100;
    const laeRatio = (metrics?.lae_ratio ?? 0.15) * 100;
    const expenseRatio = (metrics?.total_expense_ratio ?? 0.23) * 100;
    const combinedRatio = lossRatio + laeRatio + expenseRatio;
    
    // RBC Ratio calculation: inversely related to combined ratio
    // Base of 300%, adjusted by how far combined ratio is from 100%
    const rbcRatio = Math.max(150, Math.min(400, 300 - (combinedRatio - 100) * 3));
    
    return {
      rbcRatio,
      targetRatio: 300,
      lossRatio,
      laeRatio,
      combinedRatio,
      developmentFactor: metrics?.development_factor ?? 1.15,
      trendFactor: metrics?.trend_factor ?? 1.03,
      ibnr: lossDev?.ibnr ?? 0,
      ultimateLoss: metrics?.ultimate_loss ?? 0,
      credibility: metrics?.credibility ?? 0,
      incurredLosses: lossDev?.incurred_losses ?? 0,
      paidLosses: lossDev?.paid_losses ?? 0,
      totalReserves: inventory?.total_reserves ?? 0,
      selectedChange: (metrics?.selected_change ?? 0) * 100,
      targetLossRatio: (metrics?.target_loss_ratio ?? 0.65) * 100
    };
  }, [metrics, lossDev, inventory]);

  // Prepare triangle chart data
  const triangleChartData = useMemo(() => {
    // Get unique development months and sort them
    const devMonths = [...new Set(triangleData.map(d => d.development_months))].sort((a, b) => a - b);
    const years = [...new Set(triangleData.map(d => d.accident_year))].sort((a, b) => b - a);
    
    // Filter for loss_ratio data and create chart format
    return devMonths.map(month => {
      const point: Record<string, number | string> = { month: `${month}M` };
      years.forEach(year => {
        const dataPoint = triangleData.find(
          d => d.accident_year === year && d.development_months === month && d.metric_type === 'loss_ratio'
        );
        if (dataPoint) {
          point[`AY${year}`] = dataPoint.amount;
        }
      });
      return point;
    });
  }, [triangleData]);

  const triangleYears = useMemo(() => {
    return [...new Set(triangleData.filter(d => d.metric_type === 'loss_ratio').map(d => d.accident_year))].sort((a, b) => b - a);
  }, [triangleData]);

  // Calculate LDF (Loss Development Factors) - Age-to-Age and Cumulative
  const ldfData = useMemo(() => {
    const lossRatioData = triangleData.filter(d => d.metric_type === 'loss_ratio');
    const years = [...new Set(lossRatioData.map(d => d.accident_year))].sort((a, b) => a - b);
    
    // Use standard development periods for proper triangle structure
    const standardMonths = [12, 24, 36, 48, 60, 72, 84, 96];
    
    if (years.length < 2) return { ataFactors: [], cdfFactors: [], allMonths: standardMonths, selectedATA: [], selectedCDF: [], years: [] };

    // Build triangle matrix: triangleMatrix[year][month] = loss ratio (using actual month values)
    const triangleMatrix: Record<number, Record<number, number>> = {};
    years.forEach(year => {
      triangleMatrix[year] = {};
      lossRatioData
        .filter(d => d.accident_year === year)
        .forEach(d => {
          triangleMatrix[year][d.development_months] = d.amount;
        });
    });

    // Calculate Age-to-Age factors for standard development period transitions
    const ataFactors: { from: number; to: number; factors: { year: number; factor: number | null }[]; avg: number | null; wtdAvg: number | null }[] = [];
    
    for (let i = 0; i < standardMonths.length - 1; i++) {
      const fromMonth = standardMonths[i];
      const toMonth = standardMonths[i + 1];
      const factors: { year: number; factor: number | null }[] = [];
      let sumFactors = 0;
      let countFactors = 0;
      let weightedSum = 0;
      let weightSum = 0;

      years.forEach(year => {
        const fromVal = triangleMatrix[year]?.[fromMonth];
        const toVal = triangleMatrix[year]?.[toMonth];
        if (fromVal && fromVal > 0 && toVal && toVal > 0) {
          const factor = toVal / fromVal;
          factors.push({ year, factor });
          sumFactors += factor;
          countFactors++;
          weightedSum += factor * fromVal;
          weightSum += fromVal;
        } else {
          factors.push({ year, factor: null });
        }
      });

      ataFactors.push({
        from: fromMonth,
        to: toMonth,
        factors,
        avg: countFactors > 0 ? sumFactors / countFactors : null,
        wtdAvg: weightSum > 0 ? weightedSum / weightSum : null,
      });
    }

    // Selected ATA factors (use weighted average, fallback to simple average, fallback to 1.000)
    const selectedATA = ataFactors.map(ata => ata.wtdAvg ?? ata.avg ?? 1.000);

    // Calculate Cumulative Development Factors (from each period to ultimate)
    const selectedCDF: number[] = [];
    for (let i = 0; i < selectedATA.length; i++) {
      let cdf = 1;
      for (let j = i; j < selectedATA.length; j++) {
        cdf *= selectedATA[j];
      }
      selectedCDF.push(cdf);
    }
    selectedCDF.push(1.000); // Ultimate

    return { ataFactors, cdfFactors: selectedCDF, allMonths: standardMonths, selectedATA, selectedCDF, years };
  }, [triangleData]);

  // Build comprehensive triangle table for exports
  const triangleTableData = useMemo(() => {
    const lossRatioData = triangleData.filter(d => d.metric_type === 'loss_ratio');
    const years = [...new Set(lossRatioData.map(d => d.accident_year))].sort((a, b) => a - b);
    const allMonths = [...new Set(lossRatioData.map(d => d.development_months))].sort((a, b) => a - b);
    
    // Include LDF data in export
    const ldfRows: (string | number)[][] = [];
    if (ldfData.ataFactors.length > 0) {
      ldfRows.push(['', ...allMonths.slice(0, -1).map((m, i) => `${m}→${allMonths[i + 1]}M`)]);
      ldfRows.push(['Wtd Avg ATA', ...ldfData.selectedATA.map(f => f.toFixed(4))]);
      ldfRows.push(['Selected CDF', ...ldfData.selectedCDF.slice(0, -1).map(f => f.toFixed(4)), '1.0000']);
    }

    return {
      columns: ['Accident Year', ...allMonths.map(m => `${m}M`)],
      rows: [
        ...years.map(year => {
          const yearData = lossRatioData.filter(d => d.accident_year === year);
          const row: (string | number)[] = [year];
          allMonths.forEach(month => {
            const point = yearData.find(d => d.development_months === month);
            row.push(point ? `${point.amount.toFixed(2)}%` : '—');
          });
          return row;
        }),
        [], // Empty row separator
        ...ldfRows
      ]
    };
  }, [triangleData, ldfData]);

  // Export functions
  const handleExportPDF = async () => {
    const exportData = {
      title: 'RBC Performance Monitor',
      subtitle: 'Risk-Based Capital & Actuarial KPIs - Executive Briefing',
      timestamp: format(new Date(), 'MMMM d, yyyy h:mm a'),
      summary: {
        'RBC Ratio': `${rbcMetrics.rbcRatio.toFixed(0)}%`,
        'Loss Ratio': `${rbcMetrics.lossRatio.toFixed(1)}%`,
        'LAE Ratio': `${rbcMetrics.laeRatio.toFixed(1)}%`,
        'Combined Ratio': `${rbcMetrics.combinedRatio.toFixed(1)}%`,
        'IBNR Reserve': formatCurrency(rbcMetrics.ibnr),
      },
      bulletInsights: [
        `Capital position rated as "${rbcStatus.status}" with ${rbcMetrics.rbcRatio.toFixed(0)}% RBC ratio`,
        `Combined ratio at ${rbcMetrics.combinedRatio.toFixed(1)}% indicates ${rbcMetrics.combinedRatio < 100 ? 'profitable underwriting' : 'underwriting pressure'}`,
        `Loss development factor of ${rbcMetrics.developmentFactor.toFixed(3)} applied with ${(rbcMetrics.credibility * 100).toFixed(0)}% credibility`,
        rbcMetrics.selectedChange > 0 ? `Rate increase of ${rbcMetrics.selectedChange.toFixed(1)}% selected for upcoming period` : 'No rate adjustment indicated',
      ],
      columns: triangleTableData.columns,
      rows: triangleTableData.rows,
    };
    await generatePDF(exportData);
  };

  const handleExportExcel = () => {
    const exportData = {
      title: 'RBC Performance Monitor',
      subtitle: 'Risk-Based Capital & Actuarial KPIs',
      timestamp: format(new Date(), 'MMMM d, yyyy h:mm a'),
      summary: {
        'RBC Ratio': `${rbcMetrics.rbcRatio.toFixed(0)}%`,
        'Loss Ratio': `${rbcMetrics.lossRatio.toFixed(1)}%`,
        'LAE Ratio': `${rbcMetrics.laeRatio.toFixed(1)}%`,
        'Combined Ratio': `${rbcMetrics.combinedRatio.toFixed(1)}%`,
        'IBNR Reserve': formatCurrency(rbcMetrics.ibnr),
        'Ultimate Loss': formatCurrency(rbcMetrics.ultimateLoss),
        'Credibility': `${(rbcMetrics.credibility * 100).toFixed(0)}%`,
        'Development Factor': rbcMetrics.developmentFactor.toFixed(3),
        'Selected Rate Change': `${rbcMetrics.selectedChange >= 0 ? '+' : ''}${rbcMetrics.selectedChange.toFixed(1)}%`,
      },
      bulletInsights: [
        `Capital position rated as "${rbcStatus.status}" with ${rbcMetrics.rbcRatio.toFixed(0)}% RBC ratio`,
        `Combined ratio at ${rbcMetrics.combinedRatio.toFixed(1)}% indicates ${rbcMetrics.combinedRatio < 100 ? 'profitable underwriting' : 'underwriting pressure'}`,
        `Loss development factor of ${rbcMetrics.developmentFactor.toFixed(3)} applied with ${(rbcMetrics.credibility * 100).toFixed(0)}% credibility`,
      ],
      columns: triangleTableData.columns,
      rows: triangleTableData.rows,
      rawClaimData: [
        {
          sheetName: 'Accident Year Summary',
          columns: ['Accident Year', 'Earned Premium', 'Net Paid', 'Reserves', 'IBNR', 'Incurred', 'Loss Ratio'],
          rows: accidentYears.map(ay => [
            ay.accident_year,
            ay.earned_premium,
            ay.net_paid,
            ay.reserves,
            ay.ibnr,
            ay.incurred,
            `${ay.loss_ratio.toFixed(2)}%`
          ])
        }
      ]
    };
    generateExcel(exportData);
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const getRBCStatus = (ratio: number) => {
    if (ratio >= 300) return { status: 'Excellent', color: 'text-emerald-500', bgColor: 'bg-emerald-500' };
    if (ratio >= 250) return { status: 'Strong', color: 'text-green-500', bgColor: 'bg-green-500' };
    if (ratio >= 200) return { status: 'Adequate', color: 'text-yellow-500', bgColor: 'bg-yellow-500' };
    if (ratio >= 150) return { status: 'Watch', color: 'text-orange-500', bgColor: 'bg-orange-500' };
    return { status: 'Action Required', color: 'text-red-500', bgColor: 'bg-red-500' };
  };

  const rbcStatus = getRBCStatus(rbcMetrics.rbcRatio);

  // Calculate needle rotation (0-180 degrees, where 0 is left, 180 is right)
  const needleRotation = Math.min(Math.max((rbcMetrics.rbcRatio - 100) / 300 * 180, 0), 180);

  const kpiCards = [
    {
      title: 'Loss Ratio',
      value: `${rbcMetrics.lossRatio.toFixed(1)}%`,
      target: `${rbcMetrics.targetLossRatio.toFixed(1)}%`,
      icon: Percent,
      trend: rbcMetrics.lossRatio <= rbcMetrics.targetLossRatio ? 'up' : 'down',
      trendValue: rbcMetrics.lossRatio <= rbcMetrics.targetLossRatio ? 'On Target' : 'Above Target'
    },
    {
      title: 'LAE Ratio',
      value: `${rbcMetrics.laeRatio.toFixed(1)}%`,
      target: '15.0%',
      icon: BarChart3,
      trend: rbcMetrics.laeRatio <= 15 ? 'up' : 'down',
      trendValue: rbcMetrics.laeRatio <= 15 ? 'On Target' : 'Above Target'
    },
    {
      title: 'Combined Ratio',
      value: `${rbcMetrics.combinedRatio.toFixed(1)}%`,
      target: '100.0%',
      icon: Target,
      trend: rbcMetrics.combinedRatio <= 100 ? 'up' : 'down',
      trendValue: rbcMetrics.combinedRatio <= 100 ? 'Profitable' : 'Underwriting Loss'
    },
    {
      title: 'IBNR Reserve',
      value: formatCurrency(rbcMetrics.ibnr),
      target: 'Actuarial Est.',
      icon: DollarSign,
      trend: 'neutral',
      trendValue: 'Q4 2025'
    },
    {
      title: 'Ultimate Loss',
      value: formatCurrency(rbcMetrics.ultimateLoss),
      target: 'Projected',
      icon: Activity,
      trend: 'neutral',
      trendValue: '2026 Q1'
    },
    {
      title: 'Credibility',
      value: `${(rbcMetrics.credibility * 100).toFixed(0)}%`,
      target: '90%',
      icon: CheckCircle,
      trend: rbcMetrics.credibility >= 0.9 ? 'up' : 'down',
      trendValue: rbcMetrics.credibility >= 0.9 ? 'High' : 'Moderate'
    },
    {
      title: 'Development Factor',
      value: rbcMetrics.developmentFactor.toFixed(3),
      target: 'Selected',
      icon: TrendingUp,
      trend: 'neutral',
      trendValue: 'Applied'
    },
    {
      title: 'Rate Change',
      value: `${rbcMetrics.selectedChange >= 0 ? '+' : ''}${rbcMetrics.selectedChange.toFixed(1)}%`,
      target: 'Indicated',
      icon: TrendingUp,
      trend: rbcMetrics.selectedChange > 0 ? 'up' : 'down',
      trendValue: rbcMetrics.selectedChange > 0 ? 'Increase' : 'Decrease'
    }
  ];

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center min-h-[600px]", className)}>
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Gauge className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">RBC Performance Monitor</h2>
            <p className="text-sm text-muted-foreground">Risk-Based Capital & Actuarial KPIs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportPDF}
              className="gap-1.5"
            >
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportExcel}
              className="gap-1.5"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
          </div>
          <Badge variant="outline" className={cn("gap-1", isRefreshing && "animate-pulse")}>
            <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
            Auto-refresh: 30s
          </Badge>
          <span className="text-xs text-muted-foreground">
            Last: {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Main Gauge Section */}
      <Card className="overflow-hidden">
        <CardContent className="p-8">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Gauge Visualization */}
            <div className="relative w-80 h-48 flex-shrink-0">
              <svg viewBox="0 0 200 120" className="w-full h-full">
                <defs>
                  <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="25%" stopColor="#f97316" />
                    <stop offset="50%" stopColor="#eab308" />
                    <stop offset="75%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
                
                {/* Gauge arc background */}
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                
                {/* Gauge arc filled */}
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="url(#gaugeGradient)"
                  strokeWidth="16"
                  strokeLinecap="round"
                  opacity="0.9"
                />
                
                {/* Tick marks */}
                {[0, 30, 60, 90, 120, 150, 180].map((angle, i) => {
                  const radian = (angle * Math.PI) / 180;
                  const x1 = 100 - 65 * Math.cos(radian);
                  const y1 = 100 - 65 * Math.sin(radian);
                  const x2 = 100 - 75 * Math.cos(radian);
                  const y2 = 100 - 75 * Math.sin(radian);
                  const labelX = 100 - 90 * Math.cos(radian);
                  const labelY = 100 - 90 * Math.sin(radian);
                  const labels = ['100', '150', '200', '250', '300', '350', '400'];
                  return (
                    <g key={angle}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="hsl(var(--foreground))"
                        strokeWidth="2"
                        opacity="0.5"
                      />
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-muted-foreground text-[8px] font-medium"
                      >
                        {labels[i]}
                      </text>
                    </g>
                  );
                })}
                
                {/* Needle */}
                <g transform={`rotate(${needleRotation - 180}, 100, 100)`}>
                  <polygon
                    points="100,30 96,100 104,100"
                    className={cn("transition-all duration-1000", rbcStatus.bgColor)}
                    style={{ transformOrigin: '100px 100px' }}
                  />
                  <circle cx="100" cy="100" r="8" className="fill-foreground" />
                  <circle cx="100" cy="100" r="4" className="fill-background" />
                </g>
              </svg>
              
              {/* Center value display */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                <div className={cn("text-4xl font-bold tabular-nums", rbcStatus.color)}>
                  {rbcMetrics.rbcRatio.toFixed(0)}%
                </div>
                <div className="text-sm text-muted-foreground">RBC Ratio</div>
              </div>
            </div>

            {/* Status Panel */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-3 rounded-full", rbcStatus.bgColor, "bg-opacity-20")}>
                  {rbcMetrics.rbcRatio >= 250 ? (
                    <CheckCircle className={cn("h-8 w-8", rbcStatus.color)} />
                  ) : (
                    <AlertTriangle className={cn("h-8 w-8", rbcStatus.color)} />
                  )}
                </div>
                <div>
                  <h3 className={cn("text-2xl font-bold", rbcStatus.color)}>{rbcStatus.status}</h3>
                  <p className="text-muted-foreground">Capital Position</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground">Total Reserves</div>
                  <div className="text-xl font-semibold">{formatCurrency(rbcMetrics.totalReserves)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Open inventory</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground">Regulatory Min</div>
                  <div className="text-xl font-semibold">200%</div>
                  <div className="text-xs text-emerald-500 mt-1">
                    ✓ {(rbcMetrics.rbcRatio - 200).toFixed(0)}% buffer
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="font-medium">Performance Summary</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Combined ratio at {rbcMetrics.combinedRatio.toFixed(1)}% indicates 
                  {rbcMetrics.combinedRatio < 100 ? ' profitable underwriting' : ' underwriting pressure'}. 
                  Loss development factor of {rbcMetrics.developmentFactor.toFixed(3)} applied 
                  with {(rbcMetrics.credibility * 100).toFixed(0)}% credibility.
                  {rbcMetrics.selectedChange > 0 && ` Rate increase of ${rbcMetrics.selectedChange.toFixed(1)}% selected.`}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <Card key={index} className={cn("transition-all", isRefreshing && "animate-pulse")}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {kpi.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">Target: {kpi.target}</span>
                  <div className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    kpi.trend === 'up' && "text-emerald-500",
                    kpi.trend === 'down' && "text-red-500",
                    kpi.trend === 'neutral' && "text-muted-foreground"
                  )}>
                    {kpi.trend === 'up' && <TrendingUp className="h-3 w-3" />}
                    {kpi.trend === 'down' && <TrendingDown className="h-3 w-3" />}
                    {kpi.trendValue}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Accident Year Development Table */}
      {accidentYears.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Accident Year Development
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">AY</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Earned Prem</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Net Paid</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Reserves</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">IBNR</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Incurred</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Loss Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {accidentYears.map((ay) => {
                    const getLossRatioColor = (ratio: number) => {
                      if (ratio <= 60) return 'bg-emerald-500';
                      if (ratio <= 65) return 'bg-green-500';
                      if (ratio <= 70) return 'bg-yellow-500';
                      return 'bg-orange-500';
                    };
                    return (
                      <tr key={ay.accident_year} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-semibold">{ay.accident_year}</td>
                        <td className="py-3 px-4 text-right font-medium">{formatCurrency(ay.earned_premium)}</td>
                        <td className="py-3 px-4 text-right">{formatCurrency(ay.net_paid)}</td>
                        <td className="py-3 px-4 text-right">{formatCurrency(ay.reserves)}</td>
                        <td className="py-3 px-4 text-right">{formatCurrency(ay.ibnr)}</td>
                        <td className="py-3 px-4 text-right font-medium">{formatCurrency(ay.incurred)}</td>
                        <td className="py-3 px-4 text-right">
                          <Badge className={cn(
                            "font-mono",
                            getLossRatioColor(ay.loss_ratio),
                            "text-white border-0"
                          )}>
                            {ay.loss_ratio.toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loss Development Triangle Chart */}
      {triangleChartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Triangle className="h-5 w-5 text-primary" />
              Loss Ratio Development Triangle
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Loss ratio emergence by accident year and development period
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={triangleChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis 
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    domain={[0, 'auto']}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                  />
                  <Legend />
                  {triangleYears.map((year, index) => {
                    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
                    return (
                      <Line
                        key={year}
                        type="monotone"
                        dataKey={`AY${year}`}
                        name={`AY ${year}`}
                        stroke={colors[index % colors.length]}
                        strokeWidth={2}
                        dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Triangle Table View */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">AY</th>
                    {[...new Set(triangleData.filter(d => d.metric_type === 'loss_ratio').map(d => d.development_months))].sort((a, b) => a - b).map(month => (
                      <th key={month} className="text-right py-2 px-3 font-medium text-muted-foreground">{month}M</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {triangleYears.map(year => {
                    const yearData = triangleData.filter(d => d.accident_year === year && d.metric_type === 'loss_ratio');
                    const allMonths = [...new Set(triangleData.filter(d => d.metric_type === 'loss_ratio').map(d => d.development_months))].sort((a, b) => a - b);
                    return (
                      <tr key={year} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 font-semibold">{year}</td>
                        {allMonths.map(month => {
                          const point = yearData.find(d => d.development_months === month);
                          return (
                            <td key={month} className="text-right py-2 px-3 tabular-nums">
                              {point ? (
                                <span className={cn(
                                  point.amount <= 65 ? 'text-emerald-500' : 
                                  point.amount <= 70 ? 'text-yellow-500' : 'text-orange-500'
                                )}>
                                  {point.amount.toFixed(1)}%
                                </span>
                              ) : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* LDF Table */}
            {ldfData.ataFactors.length > 0 && (
              <div className="mt-8 pt-6 border-t border-border">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Loss Development Factors (LDF)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Period</th>
                        {ldfData.ataFactors.map((ata, i) => (
                          <th key={i} className="text-right py-2 px-3 font-medium text-muted-foreground">
                            {ata.from}→{ata.to}M
                          </th>
                        ))}
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Ultimate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Age-to-Age factors by year */}
                      {ldfData.years?.slice().reverse().slice(0, 5).map((year) => (
                        <tr key={year} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-3 font-medium">AY {year}</td>
                          {ldfData.ataFactors.map((ata, i) => {
                            const factorEntry = ata.factors.find(f => f.year === year);
                            const factor = factorEntry?.factor;
                            return (
                              <td key={i} className="text-right py-2 px-3 tabular-nums">
                                {factor !== null && factor !== undefined ? (
                                  <span className={cn(
                                    factor > 1.1 ? 'text-orange-500' :
                                    factor > 1.05 ? 'text-yellow-500' : 'text-emerald-500'
                                  )}>
                                    {factor.toFixed(4)}
                                  </span>
                                ) : '—'}
                              </td>
                            );
                          })}
                          <td className="text-right py-2 px-3 tabular-nums text-muted-foreground">—</td>
                        </tr>
                      ))}
                      {/* Separator */}
                      <tr className="border-b-2 border-primary/30">
                        <td colSpan={ldfData.ataFactors.length + 2} className="py-1"></td>
                      </tr>
                      {/* Simple Average */}
                      <tr className="border-b border-border/50 bg-muted/20">
                        <td className="py-2 px-3 font-medium text-muted-foreground">Simple Avg</td>
                        {ldfData.ataFactors.map((ata, i) => (
                          <td key={i} className="text-right py-2 px-3 tabular-nums">
                            {ata.avg !== null ? ata.avg.toFixed(4) : '—'}
                          </td>
                        ))}
                        <td className="text-right py-2 px-3 tabular-nums">1.0000</td>
                      </tr>
                      {/* Weighted Average */}
                      <tr className="border-b border-border/50 bg-muted/20">
                        <td className="py-2 px-3 font-medium text-muted-foreground">Wtd Avg</td>
                        {ldfData.ataFactors.map((ata, i) => (
                          <td key={i} className="text-right py-2 px-3 tabular-nums font-medium">
                            {ata.wtdAvg !== null ? ata.wtdAvg.toFixed(4) : '—'}
                          </td>
                        ))}
                        <td className="text-right py-2 px-3 tabular-nums font-medium">1.0000</td>
                      </tr>
                      {/* Selected ATA */}
                      <tr className="border-b border-border bg-primary/10">
                        <td className="py-2 px-3 font-semibold">Selected ATA</td>
                        {ldfData.selectedATA.map((factor, i) => (
                          <td key={i} className="text-right py-2 px-3 tabular-nums font-bold text-primary">
                            {factor.toFixed(4)}
                          </td>
                        ))}
                        <td className="text-right py-2 px-3 tabular-nums font-bold text-primary">1.0000</td>
                      </tr>
                      {/* Cumulative Development Factors */}
                      <tr className="bg-primary/5">
                        <td className="py-2 px-3 font-semibold">Cumulative CDF</td>
                        {ldfData.selectedCDF.slice(0, -1).map((cdf, i) => (
                          <td key={i} className="text-right py-2 px-3 tabular-nums font-bold">
                            <span className={cn(
                              cdf > 1.15 ? 'text-orange-500' :
                              cdf > 1.05 ? 'text-yellow-500' : 'text-emerald-500'
                            )}>
                              {cdf.toFixed(4)}
                            </span>
                          </td>
                        ))}
                        <td className="text-right py-2 px-3 tabular-nums font-bold text-emerald-500">1.0000</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  ATA = Age-to-Age Factor (link ratio) • CDF = Cumulative Development Factor (to ultimate) • Selected uses weighted average
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RBCGaugeDashboard;
