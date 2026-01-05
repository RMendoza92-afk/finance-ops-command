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
import { 
  calculateExecutiveReview, 
  estimateClaimAge,
  ExecutiveReviewLevel,
  ExecutiveReviewResult 
} from "@/lib/executiveReview";

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

  // Calculate KPIs - Known 2025 YTD figures (through November):
  // Total BI Spend: $395M (all bodily injury)
  // Litigation Expenses: $19M  
  // Expert Spend (actual): $5,681,152 YTD
  // Reactive (pre-lit ATR waste + lit fees): $13.3M ($19M - $5.68M)
  const kpis = useMemo(() => {
    const totalPaid = aggregatedData.reduce((sum, m) => sum + m.totalPaid, 0);
    const indemnity = aggregatedData.reduce((sum, m) => sum + m.indemnity, 0);
    const expense = aggregatedData.reduce((sum, m) => sum + m.expense, 0);
    
    // Known 2025 YTD figures (November)
    const KNOWN_BI_TOTAL = 395000000;      // $395M total BI spend
    const KNOWN_LIT_EXPENSE = 19000000;    // $19M litigation expenses
    const KNOWN_EXPERT = 5681152;          // $5.68M actual expert spend (YTD Nov)
    const KNOWN_REACTIVE = KNOWN_LIT_EXPENSE - KNOWN_EXPERT; // $13.32M waste
    
    // Calculate proportional spend based on filtered data
    const expenseRatio = expense > 0 ? expense / KNOWN_LIT_EXPENSE : 0;
    const expertSpend = KNOWN_EXPERT * expenseRatio;
    const postureSpend = KNOWN_REACTIVE * expenseRatio;
    
    return { 
      totalPaid, 
      expertSpend, 
      postureSpend, 
      indemnity,
      expense,
      // Known figures (full dataset)
      knownBITotal: KNOWN_BI_TOTAL,
      knownLitExpense: KNOWN_LIT_EXPENSE,
      knownExpert: KNOWN_EXPERT,
      knownReactive: KNOWN_REACTIVE,
    };
  }, [aggregatedData]);

  // Expert spend by quarter - actual 2025 YTD data (through November)
  const quarterlyExpertData = [
    { quarter: 'Q1 2025', paid: 1553080, paidAvgMonthly: 517693, approved: 2141536, approvedAvgMonthly: 713845 },
    { quarter: 'Q2 2025', paid: 1727599, paidAvgMonthly: 575866, approved: 1680352, approvedAvgMonthly: 560117 },
    { quarter: 'Q3 2025', paid: 1383717, paidAvgMonthly: 461239, approved: 1449627, approvedAvgMonthly: 483209 },
    { quarter: 'Q4 2025', paid: 1016756, paidAvgMonthly: 508378, approved: 909651, approvedAvgMonthly: 454826 },
  ];

  // Reactive cost curve by stage - using actual expert ratio
  const costCurveData = useMemo(() => {
    const stages = ['Early', 'Mid', 'Late', 'Very Late'];
    const EXPERT_SPEND_RATIO = 5681152 / 19000000; // ~29.9%
    let cumulative = 0;
    
    return stages.map(stage => {
      const stageData = aggregatedData.filter(m => m.stage === stage);
      const stageExpense = stageData.reduce((sum, m) => sum + m.expense, 0);
      const stageExpert = stageExpense * EXPERT_SPEND_RATIO;
      const stagePosture = stageExpense * (1 - EXPERT_SPEND_RATIO);
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

  // Executive Review Cases - files requiring executive attention
  const executiveReviewCases = useMemo(() => {
    const EXPERT_SPEND_RATIO = 5681152 / 19000000;
    
    // Build aggregated view with executive review calculation
    const claimMap = new Map<string, {
      uniqueRecord: string;
      claim: string;
      stage: 'Early' | 'Mid' | 'Late' | 'Very Late';
      expense: number;
      adjuster: string;
      claimAge: number;
      painEscalation: number;
      maxPain: number;
      expCategory: string;
      executiveReview: ExecutiveReviewResult;
    }>();
    
    data.forEach(matter => {
      const key = matter.uniqueRecord || matter.claim;
      const existing = claimMap.get(key);
      const stage = getLitigationStage(matter.endPainLvl);
      const expenseAmount = Math.max(0, (matter.totalAmount || 0) - (matter.indemnitiesAmount || 0));
      const claimAge = estimateClaimAge(matter.prefix, matter.transferDate);
      const painEscalation = matter.endPainLvl - matter.startPainLvl;
      
      if (existing) {
        existing.expense += expenseAmount;
        existing.maxPain = Math.max(existing.maxPain, matter.endPainLvl);
        existing.painEscalation = Math.max(existing.painEscalation, painEscalation);
      } else {
        claimMap.set(key, {
          uniqueRecord: key,
          claim: matter.claim || key,
          stage,
          expense: expenseAmount,
          adjuster: matter.adjusterName || 'Unknown',
          claimAge,
          painEscalation,
          maxPain: matter.endPainLvl,
          expCategory: matter.expCategory || '',
          executiveReview: { level: 'NONE', reasons: [], score: 0 } // placeholder
        });
      }
    });
    
    // Calculate executive review for each claim
    const cases = Array.from(claimMap.values()).map(c => {
      const expertSpend = c.expense * EXPERT_SPEND_RATIO;
      const reactiveSpend = c.expense * (1 - EXPERT_SPEND_RATIO);
      
      const review = calculateExecutiveReview(
        c.claimAge,
        c.stage,
        expertSpend,
        reactiveSpend,
        c.painEscalation,
        c.maxPain,
        c.expCategory
      );
      
      return {
        ...c,
        expertSpend,
        reactiveSpend,
        executiveReview: review
      };
    });
    
    // Filter to CRITICAL and REQUIRED only, sort by expense (highest first)
    return cases
      .filter(c => c.executiveReview.level === 'CRITICAL' || c.executiveReview.level === 'REQUIRED')
      .sort((a, b) => {
        // First sort by level (CRITICAL first), then by expense
        if (a.executiveReview.level !== b.executiveReview.level) {
          return a.executiveReview.level === 'CRITICAL' ? -1 : 1;
        }
        return b.expense - a.expense;
      })
      .slice(0, 8);
  }, [data]);

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
      {/* 2025 BI Spend Summary Banner */}
      <div className="bg-gradient-to-r from-muted/80 to-muted/40 border border-border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">2025 YTD BI Spend: $395M Total</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Litigation Expenses: <span className="font-semibold text-foreground">$19M</span> • Through November 2025
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">$19M Expense Breakdown</p>
            <div className="flex items-center gap-3">
              <span className="text-success font-bold">$5.68M Expert</span>
              <span className="text-muted-foreground">vs</span>
              <span className="text-destructive font-bold">$13.32M Waste</span>
            </div>
          </div>
        </div>
        
        {/* Visual expense breakdown */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Expert (Intentional Leverage)</span>
                <span>Pre-Lit ATR Waste + Litigation Fees</span>
              </div>
              <div className="w-full h-4 rounded-full bg-muted overflow-hidden flex">
                <div className="bg-success h-full flex items-center justify-center text-[10px] font-bold text-success-foreground" style={{ width: '29.9%' }}>
                  $5.68M
                </div>
                <div className="bg-destructive h-full flex items-center justify-center text-[10px] font-bold text-destructive-foreground" style={{ width: '70.1%' }}>
                  $13.32M
                </div>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-success font-medium">30% Strategic</span>
                <span className="text-destructive font-medium">70% Reactive</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        <KPICard
          title="Total BI Spend"
          value="$395M"
          subtitle="All Bodily Injury YTD"
          icon={DollarSign}
          variant="default"
        />
        <KPICard
          title="Lit Expenses"
          value="$19M"
          subtitle="Litigation portion"
          icon={DollarSign}
          variant="default"
        />
        <KPICard
          title="Expert Spend"
          value="$5.68M"
          subtitle="$516K avg/month"
          icon={Target}
          variant="success"
        />
        <KPICard
          title="Reactive Waste"
          value="$13.32M"
          subtitle="Pre-lit ATR + Lit fees"
          icon={AlertTriangle}
          variant="danger"
        />
        <KPICard
          title="Waste Ratio"
          value="2.3x"
          subtitle="$1 expert = $2.34 waste"
          icon={TrendingUp}
          variant="warning"
        />
      </div>

      {/* Quarterly Expert Spend Table */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-1">2025 Litigation Expert Spend by Quarter</h3>
        <p className="text-xs text-muted-foreground mb-4">YTD through November — Paid vs Approved</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Quarter</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Paid</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Paid Monthly Avg</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Approved</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Approved Monthly Avg</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Variance</th>
              </tr>
            </thead>
            <tbody>
              {quarterlyExpertData.map((q) => (
                <tr key={q.quarter} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-3 font-medium">{q.quarter}</td>
                  <td className="py-2 px-3 text-right text-success font-semibold">{formatCurrencyFull(q.paid)}</td>
                  <td className="py-2 px-3 text-right text-muted-foreground">{formatCurrencyFull(q.paidAvgMonthly)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrencyFull(q.approved)}</td>
                  <td className="py-2 px-3 text-right text-muted-foreground">{formatCurrencyFull(q.approvedAvgMonthly)}</td>
                  <td className={`py-2 px-3 text-right font-medium ${q.paid > q.approved ? 'text-warning' : 'text-success'}`}>
                    {q.paid > q.approved ? '+' : '-'}{formatCurrencyFull(Math.abs(q.approved - q.paid))}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-bold">
                <td className="py-2 px-3">2025 YTD</td>
                <td className="py-2 px-3 text-right text-success">$5,681,152</td>
                <td className="py-2 px-3 text-right text-muted-foreground">$516,468</td>
                <td className="py-2 px-3 text-right">$6,181,166</td>
                <td className="py-2 px-3 text-right text-muted-foreground">$561,924</td>
                <td className="py-2 px-3 text-right text-success">-$500,014</td>
              </tr>
            </tbody>
          </table>
        </div>
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

      {/* Executive Review Required */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Executive Review Required</h3>
            <p className="text-xs text-muted-foreground">Files requiring executive closure — zombie claims, duration drift, complex matters</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive animate-pulse"></span> CRITICAL</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning"></span> REQUIRED</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {executiveReviewCases.map((caseItem, idx) => (
            <button
              key={caseItem.uniqueRecord}
              onClick={() => onDrilldown(caseItem.uniqueRecord)}
              className="text-left p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-all hover:border-primary/50 group"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  caseItem.executiveReview.level === 'CRITICAL' ? 'bg-destructive animate-pulse' : 'bg-warning'
                }`}></span>
              </div>
              
              <p className="text-sm font-medium text-foreground truncate mb-1 group-hover:text-primary transition-colors">
                {caseItem.claim}
              </p>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Exposure</span>
                  <span className="font-semibold text-foreground">{formatCurrency(caseItem.expense)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Age</span>
                  <span className={`font-medium ${caseItem.claimAge >= 5 ? 'text-destructive' : 'text-warning'}`}>
                    {caseItem.claimAge}yr
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-border/50">
                  <span className="text-muted-foreground">Score</span>
                  <span className={`font-bold ${
                    caseItem.executiveReview.level === 'CRITICAL' ? 'text-destructive' : 'text-warning'
                  }`}>
                    {caseItem.executiveReview.score}
                  </span>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground mt-2 truncate">{caseItem.adjuster} • {caseItem.stage}</p>
              
              {/* Top reason */}
              {caseItem.executiveReview.reasons.length > 0 && (
                <p className="text-[10px] text-destructive/80 mt-1 truncate">
                  {caseItem.executiveReview.reasons[0]}
                </p>
              )}
            </button>
          ))}
        </div>

        {executiveReviewCases.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No files requiring executive review in current filter selection</p>
          </div>
        )}
      </div>
    </div>
  );
}
