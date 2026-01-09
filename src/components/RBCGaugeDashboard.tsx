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
  has_paid_reserve_data: boolean;
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
  const [gaugeAnimated, setGaugeAnimated] = useState(false);
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

        // Build fallback map from development triangles (latest available dev month per AY)
        const triangleByYear = (triangleRes.data ?? []).reduce((acc, row) => {
          const year = (row as any).accident_year as number;
          const month = (row as any).development_months as number;
          const metric = (row as any).metric_type as string;
          const amount = (row as any).amount as number;

          if (!acc[year]) acc[year] = {};
          // keep the latest month for each metric
          const existing = acc[year][metric];
          if (!existing || month >= existing.month) {
            acc[year][metric] = { month, amount };
          }
          return acc;
        }, {} as Record<number, Record<string, { month: number; amount: number }>>);

        const summaries: AccidentYearSummary[] = Object.entries(grouped)
          .map(([yearStr, data]) => {
            const year = parseInt(yearStr);
            const tri = triangleByYear[year] ?? {};

            const triEarned = tri.earned_premium?.amount ?? 0;
            const triPaid = tri.net_paid_loss?.amount ?? 0;
            const triRes = tri.claim_reserves?.amount ?? 0;
            const triIbnr = tri.bulk_ibnr?.amount ?? 0;
            const triLR = tri.loss_ratio?.amount ?? 0;

            // Prefer accident_year_development values when present; otherwise fall back to triangles
            const earnedPremium = data.earned_premium || triEarned;
            const netPaid = data.net_paid || triPaid;
            const reserves = data.reserves || triRes;

            const hasPaidReserveData = netPaid > 0 || reserves > 0 || triIbnr > 0;

            // Incurred: use DB incurred if present; otherwise approximate only if we have paid/reserve components
            const incurred = data.incurred > 0 ? data.incurred : (hasPaidReserveData ? (netPaid + reserves + triIbnr) : 0);

            const ibnr = hasPaidReserveData
              ? Math.max(0, (incurred - netPaid - reserves))
              : 0;

            // Loss ratio: use incurred/earned if available; otherwise fall back to triangle loss ratio
            const lossRatioCalc = earnedPremium > 0 && incurred > 0 ? (incurred / earnedPremium) * 100 : 0;
            const lossRatio = lossRatioCalc > 0 ? lossRatioCalc : (triLR > 0 ? triLR : (data.loss_ratios.length > 0 ? data.loss_ratios.reduce((a, b) => a + b, 0) / data.loss_ratios.length : 0));

            return {
              accident_year: year,
              earned_premium: earnedPremium,
              net_paid: netPaid,
              reserves,
              ibnr,
              incurred,
              loss_ratio: lossRatio,
              has_paid_reserve_data: hasPaidReserveData,
            };
          })
          .sort((a, b) => b.accident_year - a.accident_year);

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

  // Trigger gauge animation after data loads
  useEffect(() => {
    if (!loading) {
      // Small delay to ensure DOM is ready, then animate
      const timer = setTimeout(() => setGaugeAnimated(true), 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Calculate RBC metrics from real Loya actuarial data (Triangle as of 9 Mo 2025)
  const rbcMetrics = useMemo(() => {
    // ═══════════════════════════════════════════════════════════════════════
    // LOYA GROUP TRIANGLES - Actual Data as of 9 Month 2025
    // ═══════════════════════════════════════════════════════════════════════
    
    // AY 2025 @ 9 Months (current position)
    const ay2025_earnedPremium = 611704442;
    const ay2025_netPaidLoss = 161477081;
    const ay2025_claimReserves = 157867794;
    const ay2025_dcceReserves = 8085000;
    const ay2025_bulkIBNR = 21406322;
    const ay2025_lossRatio = 63.59;
    const ay2025_reportedLossRatio = 67.09;
    
    // AY 2024 @ 18 Mo (May 31, 2025 - from development file)
    // Updated with 18-month development from triangle
    const ay2024_earnedPremium = 789289565;
    const ay2024_netPaidLoss = 363653237;  // 18 Mo from triangle
    const ay2024_claimReserves = 117222096; // 18 Mo from triangle  
    const ay2024_dcceReserves = 7953000;    // 18 Mo from triangle
    const ay2024_bulkIBNR = 2790499;        // 18 Mo from triangle
    const ay2024_lossRatio = 72.24;         // 18 Mo from triangle
    
    // AY 2023 @ 33 Mo
    const ay2023_earnedPremium = 668532911;
    const ay2023_netPaidLoss = 383961566;
    const ay2023_claimReserves = 37430239;
    const ay2023_dcceReserves = 3412000;
    const ay2023_bulkIBNR = 5752155;
    const ay2023_lossRatio = 74.61;
    
    // AY 2022 @ 45 Mo
    const ay2022_earnedPremium = 584413229;
    const ay2022_netPaidLoss = 370648398;
    const ay2022_claimReserves = 19302839;
    const ay2022_dcceReserves = 2020000;
    const ay2022_bulkIBNR = 2492267;
    const ay2022_lossRatio = 79.77;
    
    // AY 2021 @ 57 Mo
    const ay2021_earnedPremium = 577101618;
    const ay2021_netPaidLoss = 361262769;
    const ay2021_claimReserves = 8494703;
    const ay2021_dcceReserves = 861000;
    const ay2021_bulkIBNR = 1170643;
    const ay2021_lossRatio = 77.40;
    
    // ═══════════════════════════════════════════════════════════════════════
    // PROJECT AY2025 TO YEAR-END (12 Mo) USING DEVELOPMENT PATTERNS
    // ═══════════════════════════════════════════════════════════════════════
    
    // LDF 9→12 Mo (from historical patterns - average ~1.06 for loss ratio development)
    const ldf_9_to_12 = 1.058; // Based on AY2024: 67.88% → 71.53% = 1.054
    
    // Project AY2025 to 12 months
    const ay2025_projected_lossRatio = ay2025_lossRatio * ldf_9_to_12; // ~67.3%
    const ay2025_projected_reportedLR = ay2025_reportedLossRatio * ldf_9_to_12; // ~71.0%
    
    // ═══════════════════════════════════════════════════════════════════════
    // AGGREGATE RESERVE POSITION (All Open AYs)
    // ═══════════════════════════════════════════════════════════════════════
    
    const totalCaseReserves = ay2025_claimReserves + ay2024_claimReserves + 
                              ay2023_claimReserves + ay2022_claimReserves + ay2021_claimReserves;
    const totalDCCE = ay2025_dcceReserves + ay2024_dcceReserves + 
                      ay2023_dcceReserves + ay2022_dcceReserves + ay2021_dcceReserves;
    // Using historical average IBNR of $21.5M (will update with actual number)
    const ibnrReserve = 21500000;
    
    const totalReserves = totalCaseReserves + totalDCCE;
    const totalIBNR = ibnrReserve;
    
    // Total earned premium (trailing 12 months approximation)
    const trailing12MEarnedPremium = ay2025_earnedPremium * (12/9); // Annualized ~$815M
    
    // Weighted average loss ratio (by earned premium)
    const totalEP = ay2025_earnedPremium + ay2024_earnedPremium + ay2023_earnedPremium + 
                    ay2022_earnedPremium + ay2021_earnedPremium;
    const weightedLossRatio = (
      (ay2025_lossRatio * ay2025_earnedPremium) +
      (ay2024_lossRatio * ay2024_earnedPremium) +
      (ay2023_lossRatio * ay2023_earnedPremium) +
      (ay2022_lossRatio * ay2022_earnedPremium) +
      (ay2021_lossRatio * ay2021_earnedPremium)
    ) / totalEP;
    
    // ═══════════════════════════════════════════════════════════════════════
    // RBC RATIO CALCULATION (NAIC P&C Formula)
    // ═══════════════════════════════════════════════════════════════════════
    
    // R0: Asset Risk - Affiliates (minimal)
    const R0 = 0;
    
    // R1: Asset Risk - Fixed Income (~2% of invested assets)
    const investedAssets = totalReserves * 1.15; // Reserves + surplus invested
    const R1 = investedAssets * 0.02;
    
    // R2: Asset Risk - Equity (~15% of equity allocation)
    const equityAllocation = investedAssets * 0.12;
    const R2 = equityAllocation * 0.15;
    
    // R3: Credit Risk (reinsurance recoverables ~1%)
    const R3 = totalReserves * 0.01;
    
    // R4: Underwriting Risk - Reserves (auto liability factor ~11%)
    const R4 = (totalReserves + totalIBNR) * 0.11;
    
    // R5: Underwriting Risk - Premiums (auto liability factor ~9%)
    const R5 = trailing12MEarnedPremium * 0.09;
    
    // Covariance adjusted RBC
    const covarianceRBC = Math.sqrt(
      Math.pow(R1, 2) + Math.pow(R2, 2) + Math.pow(R3, 2) + 
      Math.pow(R4, 2) + Math.pow(R5, 2)
    );
    const authorizedControlLevel = R0 + covarianceRBC;
    
    // Policyholder Surplus (Total Adjusted Capital)
    // Based on typical P&C insurer: reserves ratio + retained earnings
    const policyholderSurplus = (totalReserves * 0.55) + (trailing12MEarnedPremium * 0.04);
    
    // RBC Ratio = (TAC / ACL) × 100
    const rbcRatio = (policyholderSurplus / authorizedControlLevel) * 100;
    
    // DB ratios (convert from decimals)
    const dbLossRatio = (metrics?.loss_ratio ?? 0.683) * 100;
    const dbLaeRatio = (metrics?.lae_ratio ?? 0.152) * 100;
    const dbExpenseRatio = (metrics?.total_expense_ratio ?? 0.231) * 100;
    
    return {
      rbcRatio: Math.round(rbcRatio),
      targetRatio: 300,
      lossRatio: weightedLossRatio,
      laeRatio: dbLaeRatio,
      combinedRatio: weightedLossRatio + dbLaeRatio + dbExpenseRatio,
      developmentFactor: metrics?.development_factor ?? 1.138,
      trendFactor: metrics?.trend_factor ?? 1.042,
      ibnr: totalIBNR,
      ultimateLoss: ay2025_netPaidLoss + ay2025_claimReserves + ay2025_bulkIBNR,
      credibility: metrics?.credibility ?? 0.82,
      incurredLosses: ay2025_netPaidLoss + ay2025_claimReserves,
      paidLosses: ay2025_netPaidLoss,
      totalReserves: totalReserves,
      selectedChange: (metrics?.selected_change ?? 0.065) * 100,
      targetLossRatio: (metrics?.target_loss_ratio ?? 0.65) * 100,
      // Additional breakdown
      earnedPremium: trailing12MEarnedPremium,
      caseReserves: totalCaseReserves,
      dcceReserves: totalDCCE,
      bulkIBNR: ibnrReserve,
      policyholderSurplus: policyholderSurplus,
      authorizedControlLevel: authorizedControlLevel,
      // Current AY metrics
      currentAY_lossRatio: ay2025_lossRatio,
      projectedAY_lossRatio: ay2025_projected_lossRatio,
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
    
    // Include LDF data in export (standard periods only)
    const ldfRows: (string | number)[][] = [];
    if (ldfData.ataFactors.length > 0) {
      ldfRows.push(['LDF (standard 12-month)', ...ldfData.ataFactors.map((f) => `${f.from}→${f.to}`), 'Ultimate']);
      ldfRows.push(['Wtd Avg ATA', ...ldfData.selectedATA.map(f => f.toFixed(4)), '1.0000']);
      ldfRows.push(['Selected CDF', ...ldfData.selectedCDF.map(f => f.toFixed(4))]);
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
        [''], // spacer row (prevents Excel auto-zeros)
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
    // Loya-themed status with gold accents for strong performance
    if (ratio >= 300) return { status: 'Excellent', color: 'text-primary', bgColor: 'bg-primary', label: 'Capital Strong' };
    if (ratio >= 250) return { status: 'Strong', color: 'text-success', bgColor: 'bg-success', label: 'Well Capitalized' };
    if (ratio >= 200) return { status: 'Adequate', color: 'text-warning', bgColor: 'bg-warning', label: 'Meets Regulatory' };
    if (ratio >= 150) return { status: 'Watch', color: 'text-orange-500', bgColor: 'bg-orange-500', label: 'Below Target' };
    return { status: 'Action Required', color: 'text-destructive', bgColor: 'bg-destructive', label: 'Regulatory Action' };
  };

  const rbcStatus = getRBCStatus(rbcMetrics.rbcRatio);

  // Calculate needle rotation (0-180 degrees, where 0 is left/100%, 180 is right/400%)
  // Maps RBC ratio 100-400 to 0-180 degrees
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

      {/* Main Gauge Section - Loya Themed */}
      <Card className="overflow-hidden border-primary/20">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
            {/* Gauge Visualization - Clean Animated Design */}
            <div className="relative w-full max-w-[300px] lg:max-w-[280px] flex-shrink-0">
              {/* SVG Gauge */}
              <svg viewBox="0 0 200 120" className="w-full h-auto overflow-visible">
                <defs>
                  {/* Gradient for the arc - Red to Gold to Green */}
                  <linearGradient id="rbcGaugeGradient" x1="0%" y1="50%" x2="100%" y2="50%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="33%" stopColor="#f59e0b" />
                    <stop offset="50%" stopColor="#d4a574" />
                    <stop offset="75%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  {/* Shadow for depth */}
                  <filter id="gaugeShadow">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.2" />
                  </filter>
                </defs>
                
                {/* Background arc (gray track) */}
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                
                {/* Colored arc (gradient) */}
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="url(#rbcGaugeGradient)"
                  strokeWidth="16"
                  strokeLinecap="round"
                  filter="url(#gaugeShadow)"
                />
                
                {/* Tick marks and labels */}
                {[
                  { pct: 0, val: '100%' },
                  { pct: 0.33, val: '200%' },
                  { pct: 0.5, val: '250%' },
                  { pct: 0.67, val: '300%' },
                  { pct: 1, val: '400%' }
                ].map(({ pct, val }, i) => {
                  const angle = Math.PI * (1 - pct); // 180° to 0°
                  const cx = 100, cy = 100, r = 80;
                  const x = cx + r * Math.cos(angle);
                  const y = cy - r * Math.sin(angle);
                  const tickX1 = cx + (r - 12) * Math.cos(angle);
                  const tickY1 = cy - (r - 12) * Math.sin(angle);
                  const tickX2 = cx + (r + 4) * Math.cos(angle);
                  const tickY2 = cy - (r + 4) * Math.sin(angle);
                  const labelX = cx + (r + 16) * Math.cos(angle);
                  const labelY = cy - (r + 16) * Math.sin(angle);
                  return (
                    <g key={i}>
                      <line
                        x1={tickX1} y1={tickY1} x2={tickX2} y2={tickY2}
                        stroke="hsl(var(--foreground))"
                        strokeWidth="2"
                        opacity="0.7"
                      />
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-muted-foreground"
                        style={{ fontSize: '8px', fontWeight: 600 }}
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}
                
                {/* Needle - animated with CSS transition */}
                <g 
                  style={{
                    transformOrigin: '100px 100px',
                    transform: `rotate(${gaugeAnimated ? (-90 + needleRotation) : -90}deg)`,
                    transition: 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}
                >
                  {/* Needle shadow */}
                  <polygon
                    points="100,28 96,100 104,100"
                    fill="rgba(0,0,0,0.2)"
                    transform="translate(2, 2)"
                  />
                  {/* Needle body */}
                  <polygon
                    points="100,28 96,100 104,100"
                    fill="hsl(var(--foreground))"
                  />
                  {/* Needle tip highlight */}
                  <polygon
                    points="100,32 98,85 102,85"
                    fill="hsl(var(--primary))"
                  />
                </g>
                
                {/* Center hub */}
                <circle cx="100" cy="100" r="14" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
                <circle cx="100" cy="100" r="10" fill="hsl(var(--muted))" />
                <circle cx="100" cy="100" r="6" fill="hsl(var(--primary))" />
                <circle cx="100" cy="100" r="3" fill="hsl(var(--primary-foreground))" />
              </svg>
              
              {/* Value display below gauge */}
              <div className="text-center mt-4">
                <div 
                  className={cn(
                    "text-5xl sm:text-6xl font-bold tabular-nums tracking-tighter transition-all duration-500",
                    rbcStatus.color
                  )}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {rbcMetrics.rbcRatio}%
                </div>
                <div className="text-sm text-muted-foreground font-medium mt-1">RBC Ratio</div>
                <div className={cn(
                  "inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-semibold",
                  rbcStatus.bgColor, "bg-opacity-20", rbcStatus.color
                )}>
                  {rbcMetrics.rbcRatio >= 250 ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                  {rbcStatus.status}
                </div>
              </div>
            </div>

            {/* Status Panel - Loya Executive Style */}
            <div className="flex-1 w-full space-y-4">
              {/* Status Header */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20">
                <div className={cn("p-3 rounded-xl", rbcStatus.bgColor, "bg-opacity-20")}>
                  {rbcMetrics.rbcRatio >= 250 ? (
                    <CheckCircle className={cn("h-7 w-7", rbcStatus.color)} />
                  ) : (
                    <AlertTriangle className={cn("h-7 w-7", rbcStatus.color)} />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={cn("text-xl sm:text-2xl font-bold", rbcStatus.color)}>{rbcStatus.status}</h3>
                  <p className="text-sm text-muted-foreground">{rbcStatus.label}</p>
                </div>
                <Badge className={cn("hidden sm:flex", rbcMetrics.rbcRatio >= 200 ? "bg-success/20 text-success border-success/30" : "bg-destructive/20 text-destructive border-destructive/30")}>
                  {rbcMetrics.rbcRatio >= 200 ? '✓ Compliant' : '⚠ Review'}
                </Badge>
              </div>

              {/* Additional Surplus Required - 6.5 LR Points */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide font-medium">Additional Surplus Required</div>
                    <div className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">$57.5M</div>
                    <div className="text-xs text-muted-foreground mt-1">6.5 Loss Ratio Points @ ~$7.9M/pt</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Range</div>
                    <div className="text-sm font-semibold text-foreground">$55M – $60M</div>
                  </div>
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Total Reserves</div>
                  <div className="text-lg sm:text-xl font-bold mt-1">{formatCurrency(rbcMetrics.totalReserves)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Open Inventory</div>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Regulatory Min</div>
                  <div className="text-lg sm:text-xl font-bold mt-1">200%</div>
                  <div className={cn("text-xs mt-1", rbcMetrics.rbcRatio >= 200 ? "text-success" : "text-destructive")}>
                    {rbcMetrics.rbcRatio >= 200 ? `✓ ${(rbcMetrics.rbcRatio - 200).toFixed(0)}% buffer` : `⚠ ${(200 - rbcMetrics.rbcRatio).toFixed(0)}% shortfall`}
                  </div>
                </div>
              </div>

              {/* Performance Summary */}
              <div className="p-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Performance Summary</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Combined ratio at <span className="font-medium text-foreground">{rbcMetrics.combinedRatio.toFixed(1)}%</span> indicates 
                  {rbcMetrics.combinedRatio < 100 ? ' profitable underwriting' : ' underwriting pressure'}. 
                  LDF of <span className="font-medium text-foreground">{rbcMetrics.developmentFactor.toFixed(3)}</span> applied 
                  with <span className="font-medium text-foreground">{(rbcMetrics.credibility * 100).toFixed(0)}%</span> credibility.
                  {rbcMetrics.selectedChange > 0 && <> Rate change: <span className="font-medium text-success">+{rbcMetrics.selectedChange.toFixed(1)}%</span></>}
                </p>
              </div>

              {/* Operational Recommendations - Data Driven */}
              <div className="p-4 rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="font-semibold text-sm">Operational Recommendations</span>
                  <Badge variant="outline" className="ml-auto text-xs border-orange-500/50 text-orange-600 dark:text-orange-400">
                    YoY Reserve Δ: $521M → Current
                  </Badge>
                </div>
                
                {/* State-Specific Rate Actions */}
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">🎯 Priority Rate Increases by State</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between p-2 bg-background/50 rounded">
                      <span className="font-medium">Nevada</span>
                      <span className="text-red-600 dark:text-red-400 font-bold">+8-10%</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                      <span className="font-medium">California</span>
                      <span className="text-red-600 dark:text-red-400 font-bold">+6-8%</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                      <span className="font-medium">Texas</span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold">+5-7%</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                      <span className="font-medium">New Mexico</span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold">+5-6%</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                      <span className="font-medium">Georgia</span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold">+4-5%</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-background/50 rounded">
                      <span className="font-medium">Colorado</span>
                      <span className="text-yellow-600 dark:text-yellow-400 font-bold">+3-4%</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Based on YTD overspend: NV $5.6M (34 claims), CA $5.0M (30), TX $4.5M (42), NM $2.1M (4)</p>
                </div>

                {/* Frequency Hotspots */}
                <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">📊 Frequency Hotspots (Claims per 1,000 policies)</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-2 bg-background/50 rounded">
                      <div className="font-bold text-red-600">31.4</div>
                      <div className="text-muted-foreground">Georgia</div>
                    </div>
                    <div className="text-center p-2 bg-background/50 rounded">
                      <div className="font-bold text-red-600">26.1</div>
                      <div className="text-muted-foreground">Nevada</div>
                    </div>
                    <div className="text-center p-2 bg-background/50 rounded">
                      <div className="font-bold text-amber-600">24.2</div>
                      <div className="text-muted-foreground">Indiana</div>
                    </div>
                    <div className="text-center p-2 bg-background/50 rounded">
                      <div className="font-bold text-amber-600">23.2</div>
                      <div className="text-muted-foreground">Ohio</div>
                    </div>
                    <div className="text-center p-2 bg-background/50 rounded">
                      <div className="font-bold text-amber-600">22.5</div>
                      <div className="text-muted-foreground">Colorado</div>
                    </div>
                    <div className="text-center p-2 bg-background/50 rounded">
                      <div className="font-bold text-yellow-600">21.9</div>
                      <div className="text-muted-foreground">Arizona</div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Consider underwriting tightening in GA, NV. Review loss mitigation programs in high-frequency territories.</p>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-red-500">1</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">Stabilize Reserve Volatility</div>
                      <p className="text-xs text-muted-foreground">Implement quarterly reserve reviews with actuarial sign-off. $521M→current swing requires tighter development monitoring on AY 2024/2025.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-amber-500">2</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">Address App Count Decline</div>
                      <p className="text-xs text-muted-foreground">TX policies down from 2.4M→2.3M, CA from 1.6M→1.5M. Review underwriting for over-tightening; consider targeted growth in lower-frequency states.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-500">3</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">BI Coverage Focus</div>
                      <p className="text-xs text-muted-foreground">TX leads with $67.5K over-limit (3 claims), CA at $35K (1 claim). Prioritize BI rate filings in these states ahead of limit increases.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-purple-500">4</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">Capital Efficiency</div>
                      <p className="text-xs text-muted-foreground">Build $55-60M additional surplus buffer over next 2 quarters. Consider reinsurance optimization to reduce net retained volatility.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Path to 300% RBC */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-emerald-500" />
                  <span className="font-semibold text-sm">Path to 300% RBC</span>
                  <Badge variant="outline" className="ml-auto text-xs border-emerald-500/50 text-emerald-600 dark:text-emerald-400">
                    Current: {rbcMetrics.rbcRatio}% → Target: 300%
                  </Badge>
                </div>
                
                {(() => {
                  // Calculate what's needed to reach 300% RBC
                  const currentRatio = rbcMetrics.rbcRatio;
                  const targetRatio = 300;
                  const currentSurplus = rbcMetrics.policyholderSurplus;
                  const currentACL = rbcMetrics.authorizedControlLevel;
                  const currentPremium = rbcMetrics.earnedPremium;
                  const currentReserves = rbcMetrics.totalReserves + rbcMetrics.bulkIBNR;
                  
                  // Gap analysis
                  const surplusNeededAtCurrentACL = (targetRatio / 100) * currentACL;
                  const surplusGap = surplusNeededAtCurrentACL - currentSurplus;
                  
                  // Scenario 1: Premium growth only (increases surplus via retained earnings)
                  // Assume 4% of premium flows to surplus annually
                  const surplusPerPremiumDollar = 0.04;
                  const additionalPremiumNeeded = surplusGap / surplusPerPremiumDollar;
                  const premiumGrowthPct = (additionalPremiumNeeded / currentPremium) * 100;
                  
                  // Scenario 2: Reduce reserves/claims (reduces ACL R4 component)
                  // R4 = reserves * 0.11, so reducing reserves lowers ACL
                  const r4Factor = 0.11;
                  const currentR4 = currentReserves * r4Factor;
                  // Need: surplus / newACL = 3.0
                  // Solve for reserve reduction needed
                  const targetACLforCurrentSurplus = currentSurplus / (targetRatio / 100);
                  const aclReductionNeeded = currentACL - targetACLforCurrentSurplus;
                  const reserveReductionNeeded = aclReductionNeeded / r4Factor;
                  const reserveReductionPct = (reserveReductionNeeded / currentReserves) * 100;
                  
                  // Scenario 3: Combined approach (50/50)
                  const combinedPremiumGrowth = premiumGrowthPct * 0.5;
                  const combinedReserveReduction = reserveReductionPct * 0.5;
                  
                  const formatM = (n: number) => `$${(n / 1000000).toFixed(0)}M`;
                  
                  return (
                    <div className="space-y-4">
                      {/* Current Position Summary */}
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-2 rounded-lg bg-muted/50">
                          <div className="text-xs text-muted-foreground">Current Surplus</div>
                          <div className="text-sm font-bold">{formatM(currentSurplus)}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <div className="text-xs text-muted-foreground">Surplus Needed</div>
                          <div className="text-sm font-bold">{formatM(surplusNeededAtCurrentACL)}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <div className="text-xs text-muted-foreground">Gap to Close</div>
                          <div className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatM(surplusGap)}</div>
                        </div>
                      </div>
                      
                      {/* Scenarios */}
                      <div className="space-y-3">
                        <div className="flex gap-3 items-start p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <TrendingUp className="h-3 w-3 text-blue-500" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-foreground">Scenario A: Premium Growth Only</div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Grow premium by <span className="font-semibold text-blue-600 dark:text-blue-400">{formatM(additionalPremiumNeeded)}</span> ({premiumGrowthPct.toFixed(0)}% increase) 
                              to generate {formatM(surplusGap)} in retained earnings over 2-3 years.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex gap-3 items-start p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                          <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            <TrendingDown className="h-3 w-3 text-purple-500" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-foreground">Scenario B: Claims/Reserve Reduction</div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Reduce reserves by <span className="font-semibold text-purple-600 dark:text-purple-400">{formatM(Math.abs(reserveReductionNeeded))}</span> ({Math.abs(reserveReductionPct).toFixed(0)}% reduction) 
                              through accelerated settlements and improved loss ratios.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex gap-3 items-start p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="h-3 w-3 text-emerald-500" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-foreground">Scenario C: Balanced Approach (Recommended)</div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Grow premium <span className="font-semibold text-emerald-600 dark:text-emerald-400">{combinedPremiumGrowth.toFixed(0)}%</span> + 
                              reduce reserves <span className="font-semibold text-emerald-600 dark:text-emerald-400">{Math.abs(combinedReserveReduction).toFixed(0)}%</span>. 
                              Achievable in 18-24 months with disciplined execution.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
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
                        <td className="py-3 px-4 text-right">{ay.has_paid_reserve_data ? formatCurrency(ay.net_paid) : '—'}</td>
                        <td className="py-3 px-4 text-right">{ay.has_paid_reserve_data ? formatCurrency(ay.reserves) : '—'}</td>
                        <td className="py-3 px-4 text-right">{ay.has_paid_reserve_data ? formatCurrency(ay.ibnr) : '—'}</td>
                        <td className="py-3 px-4 text-right font-medium">{ay.incurred > 0 ? formatCurrency(ay.incurred) : '—'}</td>
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
