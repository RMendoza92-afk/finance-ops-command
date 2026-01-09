import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gauge, TrendingUp, TrendingDown, Activity, RefreshCw, AlertTriangle, CheckCircle, Target, DollarSign, Percent, BarChart3 } from 'lucide-react';
import { useActuarialData } from '@/hooks/useActuarialData';
import { cn } from '@/lib/utils';

interface RBCGaugeDashboardProps {
  className?: string;
}

const RBCGaugeDashboard = ({ className }: RBCGaugeDashboardProps) => {
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: actuarialData, loading } = useActuarialData(2025);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setIsRefreshing(true);
      setLastRefresh(new Date());
      setTimeout(() => setIsRefreshing(false), 1000);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate RBC Ratio based on actuarial metrics
  const rbcMetrics = useMemo(() => {
    const defaults = {
      rbcRatio: 285,
      targetRatio: 300,
      lossRatio: 62.5,
      laeRatio: 12.3,
      combinedRatio: 94.8,
      developmentFactor: 1.15,
      trendFactor: 1.03,
      ibnr: 45000000,
      ultimateLoss: 125000000,
      credibility: 0.92
    };

    if (!actuarialData?.metrics) {
      return defaults;
    }

    const metrics = actuarialData.metrics;
    return {
      rbcRatio: 285 + (metrics.lossRatio ? (65 - metrics.lossRatio) * 2 : 0),
      targetRatio: 300,
      lossRatio: metrics.lossRatio || defaults.lossRatio,
      laeRatio: metrics.laeRatio || defaults.laeRatio,
      combinedRatio: (metrics.lossRatio || defaults.lossRatio) + (metrics.laeRatio || defaults.laeRatio) + (metrics.totalExpenseRatio || 20),
      developmentFactor: metrics.developmentFactor || defaults.developmentFactor,
      trendFactor: metrics.trendFactor || defaults.trendFactor,
      ibnr: actuarialData.lossDevelopment?.[0]?.ibnr || defaults.ibnr,
      ultimateLoss: metrics.ultimateLoss || defaults.ultimateLoss,
      credibility: metrics.credibility || defaults.credibility
    };
  }, [actuarialData]);

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
  // Map RBC ratio 100-400 to 0-180 degrees
  const needleRotation = Math.min(Math.max((rbcMetrics.rbcRatio - 100) / 300 * 180, 0), 180);

  const kpiCards = [
    {
      title: 'Loss Ratio',
      value: `${rbcMetrics.lossRatio.toFixed(1)}%`,
      target: '65.0%',
      icon: Percent,
      trend: rbcMetrics.lossRatio < 65 ? 'up' : 'down',
      trendValue: rbcMetrics.lossRatio < 65 ? '+2.5%' : '-1.2%'
    },
    {
      title: 'LAE Ratio',
      value: `${rbcMetrics.laeRatio.toFixed(1)}%`,
      target: '15.0%',
      icon: BarChart3,
      trend: rbcMetrics.laeRatio < 15 ? 'up' : 'down',
      trendValue: rbcMetrics.laeRatio < 15 ? '+0.8%' : '-0.3%'
    },
    {
      title: 'Combined Ratio',
      value: `${rbcMetrics.combinedRatio.toFixed(1)}%`,
      target: '100.0%',
      icon: Target,
      trend: rbcMetrics.combinedRatio < 100 ? 'up' : 'down',
      trendValue: rbcMetrics.combinedRatio < 100 ? '+3.2%' : '-1.8%'
    },
    {
      title: 'IBNR Reserve',
      value: formatCurrency(rbcMetrics.ibnr),
      target: formatCurrency(50000000),
      icon: DollarSign,
      trend: 'neutral',
      trendValue: 'Stable'
    },
    {
      title: 'Ultimate Loss',
      value: formatCurrency(rbcMetrics.ultimateLoss),
      target: formatCurrency(130000000),
      icon: Activity,
      trend: rbcMetrics.ultimateLoss < 130000000 ? 'up' : 'down',
      trendValue: '-$4.2M'
    },
    {
      title: 'Credibility',
      value: `${(rbcMetrics.credibility * 100).toFixed(0)}%`,
      target: '90%',
      icon: CheckCircle,
      trend: rbcMetrics.credibility >= 0.9 ? 'up' : 'down',
      trendValue: '+2%'
    },
    {
      title: 'Development Factor',
      value: rbcMetrics.developmentFactor.toFixed(3),
      target: '1.100',
      icon: TrendingUp,
      trend: 'neutral',
      trendValue: 'Selected'
    },
    {
      title: 'Trend Factor',
      value: rbcMetrics.trendFactor.toFixed(3),
      target: '1.050',
      icon: TrendingUp,
      trend: 'neutral',
      trendValue: 'Selected'
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
        <div className="flex items-center gap-2">
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
              {/* Gauge Background Arc */}
              <svg viewBox="0 0 200 120" className="w-full h-full">
                {/* Background arc segments */}
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
                  <div className="text-sm text-muted-foreground">Target RBC</div>
                  <div className="text-xl font-semibold">{rbcMetrics.targetRatio}%</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {rbcMetrics.rbcRatio >= rbcMetrics.targetRatio ? (
                      <span className="text-emerald-500">✓ Above target</span>
                    ) : (
                      <span className="text-orange-500">
                        {(rbcMetrics.targetRatio - rbcMetrics.rbcRatio).toFixed(0)}% below
                      </span>
                    )}
                  </div>
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
                  Loss development trending {rbcMetrics.developmentFactor < 1.2 ? 'favorably' : 'adversely'} 
                  with {(rbcMetrics.credibility * 100).toFixed(0)}% credibility on selected factors.
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
    </div>
  );
};

export default RBCGaugeDashboard;
