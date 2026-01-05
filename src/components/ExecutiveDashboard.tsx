import { useMemo } from "react";
import { LitigationMatter } from "@/hooks/useLitigationData";
import { KPICard } from "@/components/KPICard";
import { DollarSign, TrendingUp, AlertTriangle, Target } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface ExecutiveDashboardProps {
  data: LitigationMatter[];
  onDrilldown: (claimId: string) => void;
}

// Determine litigation stage based on pain level
function getLitigationStage(painLvl: number): 'Early' | 'Mid' | 'Late' | 'Very Late' {
  if (painLvl <= 2) return 'Early';
  if (painLvl <= 5) return 'Mid';
  if (painLvl <= 7) return 'Late';
  return 'Very Late';
}

// Determine expert type from expense category
function getExpertType(expCategory: string): string {
  if (!expCategory) return 'Other';
  const cat = expCategory.toUpperCase();
  if (cat.includes('MEDICAL') || cat.includes('MED')) return 'Medical';
  if (cat.includes('LEGAL') || cat.includes('ATTORNEY')) return 'Legal';
  if (cat.includes('EXPERT') || cat.includes('CONSULT')) return 'Consultant';
  if (cat.includes('ENGINEER')) return 'Engineering';
  if (cat.includes('ACCOUNT') || cat.includes('ECON')) return 'Economic';
  return 'Other';
}

export function ExecutiveDashboard({ data, onDrilldown }: ExecutiveDashboardProps) {
  // Aggregate data by unique record (claim)
  const aggregatedData = useMemo(() => {
    const grouped = new Map<string, {
      uniqueRecord: string;
      claim: string;
      stage: string;
      expertSpend: number;
      postureSpend: number;
      indemnity: number;
      expense: number;
      totalPaid: number;
      expertType: string;
      adjuster: string;
      team: string;
    }>();

    data.forEach(matter => {
      const key = matter.uniqueRecord || matter.claim;
      const existing = grouped.get(key);
      const stage = getLitigationStage(matter.endPainLvl);
      const expertType = getExpertType(matter.expCategory);
      
      // Determine if this is expert spend or reactive posture spend
      const isExpertSpend = matter.expCategory?.toUpperCase().includes('EXPERT') || 
                           matter.expCategory?.toUpperCase().includes('MED') ||
                           matter.expCategory?.toUpperCase().includes('CONSULT');
      
      // Calculate expense from total minus indemnity
      const expenseAmount = (matter.totalAmount || 0) - (matter.indemnitiesAmount || 0);
      const expertSpend = isExpertSpend ? Math.max(0, expenseAmount) : 0;
      const postureSpend = isExpertSpend ? 0 : Math.max(0, expenseAmount);
      
      if (existing) {
        existing.expertSpend += expertSpend;
        existing.postureSpend += postureSpend;
        existing.indemnity += matter.indemnitiesAmount || 0;
        existing.expense += Math.max(0, expenseAmount);
        existing.totalPaid += matter.totalAmount || 0;
      } else {
        const expenseAmount = (matter.totalAmount || 0) - (matter.indemnitiesAmount || 0);
        grouped.set(key, {
          uniqueRecord: key,
          claim: matter.claim || key,
          stage,
          expertSpend,
          postureSpend,
          indemnity: matter.indemnitiesAmount || 0,
          expense: Math.max(0, expenseAmount),
          totalPaid: matter.totalAmount || 0,
          expertType,
          adjuster: matter.adjusterName || 'Unknown',
          team: matter.team || 'Unknown',
        });
      }
    });

    return Array.from(grouped.values());
  }, [data]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalPaid = aggregatedData.reduce((sum, m) => sum + m.totalPaid, 0);
    const expertSpend = aggregatedData.reduce((sum, m) => sum + m.expertSpend, 0);
    const postureSpend = aggregatedData.reduce((sum, m) => sum + m.postureSpend, 0);
    const indemnity = aggregatedData.reduce((sum, m) => sum + m.indemnity, 0);
    
    return { totalPaid, expertSpend, postureSpend, indemnity };
  }, [aggregatedData]);

  // Reactive cost curve by stage
  const costCurveData = useMemo(() => {
    const stages = ['Early', 'Mid', 'Late', 'Very Late'];
    let cumulative = 0;
    
    return stages.map(stage => {
      const stageData = aggregatedData.filter(m => m.stage === stage);
      const stagePosture = stageData.reduce((sum, m) => sum + m.postureSpend, 0);
      const stageExpert = stageData.reduce((sum, m) => sum + m.expertSpend, 0);
      cumulative += stagePosture;
      
      return {
        stage,
        reactiveSpend: stagePosture,
        expertSpend: stageExpert,
        cumulative,
        count: stageData.length,
      };
    });
  }, [aggregatedData]);

  // What's not working - top exposures by reactive spend
  const topProblems = useMemo(() => {
    return [...aggregatedData]
      .filter(m => m.postureSpend > 0)
      .sort((a, b) => b.postureSpend - a.postureSpend)
      .slice(0, 8)
      .map(m => ({
        ...m,
        ratio: m.expertSpend > 0 ? m.postureSpend / m.expertSpend : m.postureSpend > 0 ? 999 : 0,
        riskFlag: (() => {
          const ratio = m.expertSpend > 0 ? m.postureSpend / m.expertSpend : 999;
          if (ratio >= 3) return 'RED';
          if (ratio >= 1.5) return 'ORANGE';
          return 'GREEN';
        })(),
      }));
  }, [aggregatedData]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Total Paid"
          value={formatCurrency(kpis.totalPaid)}
          subtitle={`Indemnity: ${formatCurrency(kpis.indemnity)}`}
          icon={DollarSign}
          variant="default"
        />
        <KPICard
          title="Expert Spend"
          value={formatCurrency(kpis.expertSpend)}
          subtitle="Intentional / Leverage"
          icon={Target}
          variant="success"
        />
        <KPICard
          title="Reactive Posture Spend"
          value={formatCurrency(kpis.postureSpend)}
          subtitle="Friction / Delay Costs"
          icon={AlertTriangle}
          variant="danger"
        />
        <KPICard
          title="Posture / Expert Ratio"
          value={kpis.expertSpend > 0 ? `${(kpis.postureSpend / kpis.expertSpend).toFixed(1)}x` : 'N/A'}
          subtitle={kpis.postureSpend > kpis.expertSpend ? "More reactive than strategic" : "Strategic spend leading"}
          icon={TrendingUp}
          variant={kpis.postureSpend / kpis.expertSpend >= 3 ? 'danger' : kpis.postureSpend / kpis.expertSpend >= 1.5 ? 'warning' : 'success'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Reactive Cost Curve */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Reactive Cost Curve</h3>
          <p className="text-xs text-muted-foreground mb-4">Cumulative posture spend by litigation stage — shows capital deployed reactively</p>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costCurveData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReactive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="stage" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={11}
                  tickFormatter={(v) => formatCurrency(v)}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number, name: string) => [formatCurrencyFull(value), name === 'cumulative' ? 'Cumulative Spend' : 'Stage Spend']}
                  labelFormatter={(label) => `Stage: ${label}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="cumulative" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  fill="url(#colorReactive)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex gap-4 mt-4 pt-4 border-t border-border">
            {costCurveData.map(item => (
              <div key={item.stage} className="flex-1 text-center">
                <p className="text-xs text-muted-foreground">{item.stage}</p>
                <p className="text-sm font-semibold text-foreground">{formatCurrency(item.reactiveSpend)}</p>
                <p className="text-xs text-muted-foreground">{item.count} claims</p>
              </div>
            ))}
          </div>
        </div>

        {/* Spend Comparison by Stage */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-1">Expert vs Reactive by Stage</h3>
          <p className="text-xs text-muted-foreground mb-4">Strategic expert spend vs reactive posture spend — leverage decay visible</p>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costCurveData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="stage" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={11}
                  tickFormatter={(v) => formatCurrency(v)}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number, name: string) => [formatCurrencyFull(value), name === 'expertSpend' ? 'Expert (Strategic)' : 'Reactive (Friction)']}
                />
                <Bar dataKey="expertSpend" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Expert Spend" />
                <Bar dataKey="reactiveSpend" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Reactive Spend" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex gap-6 mt-4 pt-4 border-t border-border justify-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-success"></div>
              <span className="text-xs text-muted-foreground">Expert (Intentional)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-destructive"></div>
              <span className="text-xs text-muted-foreground">Reactive (Friction)</span>
            </div>
          </div>
        </div>
      </div>

      {/* What's Not Working */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">What's Not Working</h3>
            <p className="text-xs text-muted-foreground">Top exposures by reactive posture spend — click to inspect in Management Data</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive"></span> RED ≥3x</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning"></span> ORANGE 1.5-3x</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success"></span> GREEN &lt;1.5x</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {topProblems.map((problem, idx) => (
            <button
              key={problem.uniqueRecord}
              onClick={() => onDrilldown(problem.uniqueRecord)}
              className="text-left p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-all hover:border-primary/50 group"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  problem.riskFlag === 'RED' ? 'bg-destructive animate-pulse' : 
                  problem.riskFlag === 'ORANGE' ? 'bg-warning' : 'bg-success'
                }`}></span>
              </div>
              
              <p className="text-sm font-medium text-foreground truncate mb-1 group-hover:text-primary transition-colors">
                {problem.claim}
              </p>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Reactive</span>
                  <span className="font-semibold text-destructive">{formatCurrency(problem.postureSpend)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Expert</span>
                  <span className="font-medium text-success">{formatCurrency(problem.expertSpend)}</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-border/50">
                  <span className="text-muted-foreground">Ratio</span>
                  <span className={`font-bold ${
                    problem.riskFlag === 'RED' ? 'text-destructive' : 
                    problem.riskFlag === 'ORANGE' ? 'text-warning' : 'text-success'
                  }`}>
                    {problem.ratio >= 999 ? '∞' : `${problem.ratio.toFixed(1)}x`}
                  </span>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground mt-2 truncate">{problem.adjuster} • {problem.stage}</p>
            </button>
          ))}
        </div>

        {topProblems.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No exposures with reactive spend in current filter selection</p>
          </div>
        )}
      </div>
    </div>
  );
}
