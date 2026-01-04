import { useState } from "react";
import { Card } from "@/components/ui/card";
import { LitigationMatter } from "@/hooks/useLitigationData";

interface Stats {
  totalMatters: number;
  totalIndemnities: number;
  totalExpenses: number;
  totalNet: number;
  cwpCount: number;
  cwnCount: number;
}

interface LitigationDisciplineDashboardProps {
  data: LitigationMatter[];
  stats: Stats;
}

type TabType = 'posture-roi' | 'decision-gates' | 'patterns';

interface OutcomeRow {
  outcomeBand: string;
  expertSpend: number;
  postureSpend: number;
  observation: string;
  observationType: 'negative' | 'positive' | 'mixed';
}

const outcomeData: OutcomeRow[] = [
  {
    outcomeBand: 'Resolved Near Limits',
    expertSpend: 1400000,
    postureSpend: 6900000,
    observation: 'Posture did not materially change outcome',
    observationType: 'negative',
  },
  {
    outcomeBand: 'Resolved Below Expected Range',
    expertSpend: 3100000,
    postureSpend: 4200000,
    observation: 'Expert leverage effective',
    observationType: 'positive',
  },
  {
    outcomeBand: 'Expected Range Resolution',
    expertSpend: 1100000,
    postureSpend: 2300000,
    observation: 'Mixed return on posture',
    observationType: 'mixed',
  },
];

export function LitigationDisciplineDashboard({ data, stats }: LitigationDisciplineDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('posture-roi');

  // Use real stats from loaded data
  const totalExpense = stats.totalExpenses;
  const totalIndemnities = stats.totalIndemnities;
  const totalNet = stats.totalNet;

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'posture-roi', label: 'Posture ROI' },
    { id: 'decision-gates', label: 'Decision Gates' },
    { id: 'patterns', label: 'Representative Patterns' },
  ];

  // Generate pain vs paid analysis from actual data
  const painVsPaidData = data.reduce((acc, matter) => {
    const painLevel = matter.endPainLvl;
    const bucket = painLevel >= 8 ? 'High Pain (8-10)' : painLevel >= 5 ? 'Medium Pain (5-7)' : 'Low Pain (1-4)';
    
    if (!acc[bucket]) {
      acc[bucket] = { count: 0, totalPaid: 0, avgPain: 0, painSum: 0 };
    }
    acc[bucket].count++;
    acc[bucket].totalPaid += matter.totalAmount;
    acc[bucket].painSum += painLevel;
    acc[bucket].avgPain = acc[bucket].painSum / acc[bucket].count;
    
    return acc;
  }, {} as Record<string, { count: number; totalPaid: number; avgPain: number; painSum: number }>);

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-foreground">2025 Litigation Discipline Dashboard</h3>
        <p className="text-sm text-muted-foreground">
          Hybrid governance dashboard using real 2025 litigation data. Purpose: enforce spend discipline by separating information spend from posture spend, identifying decision gate leakage, and learning from repeatable patterns.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4 bg-card border-border">
          <div className="text-3xl font-bold text-red-500">{formatCurrency(totalExpense)}</div>
          <div className="text-sm text-muted-foreground">Total Litigation Expense (2025)</div>
        </Card>
        <Card className="p-4 bg-card border-border">
          <div className="text-3xl font-bold text-red-500">{formatCurrency(totalIndemnities)}</div>
          <div className="text-sm text-muted-foreground">Total Indemnities Paid</div>
        </Card>
        <Card className="p-4 bg-card border-border">
          <div className="text-3xl font-bold text-red-500">{formatCurrency(totalNet)}</div>
          <div className="text-sm text-muted-foreground">Feature Inception to Current Net</div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
              activeTab === tab.id
                ? 'bg-red-600 text-white'
                : 'bg-zinc-800 text-foreground hover:bg-zinc-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'posture-roi' && (
        <Card className="p-6 bg-card border-border mb-6">
          <h4 className="font-semibold text-foreground mb-4">Did Posture Spend Change Outcomes?</h4>
          
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-3 pr-4">Outcome Band</th>
                <th className="pb-3 pr-4">Expert Spend</th>
                <th className="pb-3 pr-4">Posture Spend</th>
                <th className="pb-3">Observation</th>
              </tr>
            </thead>
            <tbody>
              {outcomeData.map((row, idx) => (
                <tr key={idx} className="border-t border-border/50">
                  <td className="py-3 pr-4 text-foreground">{row.outcomeBand}</td>
                  <td className="py-3 pr-4 text-foreground">{formatCurrency(row.expertSpend)}</td>
                  <td className="py-3 pr-4 text-foreground">{formatCurrency(row.postureSpend)}</td>
                  <td className={`py-3 font-medium ${
                    row.observationType === 'negative' ? 'text-red-500' :
                    row.observationType === 'positive' ? 'text-green-500' : 'text-yellow-500'
                  }`}>
                    {row.observation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'decision-gates' && (
        <Card className="p-6 bg-card border-border mb-6">
          <h4 className="font-semibold text-foreground mb-4">Pain vs Paid Analysis</h4>
          
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-3 pr-4">Pain Bucket</th>
                <th className="pb-3 pr-4">Count</th>
                <th className="pb-3 pr-4">Avg Pain Level</th>
                <th className="pb-3 pr-4">Total Paid</th>
                <th className="pb-3">Avg Paid per Claim</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(painVsPaidData).map(([bucket, stats], idx) => (
                <tr key={idx} className="border-t border-border/50">
                  <td className={`py-3 pr-4 font-medium ${
                    bucket.includes('High') ? 'text-red-500' :
                    bucket.includes('Medium') ? 'text-yellow-500' : 'text-green-500'
                  }`}>
                    {bucket}
                  </td>
                  <td className="py-3 pr-4 text-foreground">{stats.count}</td>
                  <td className="py-3 pr-4 text-foreground">{stats.avgPain.toFixed(1)}</td>
                  <td className="py-3 pr-4 text-foreground">{formatCurrency(stats.totalPaid)}</td>
                  <td className="py-3 text-foreground">
                    {formatCurrency(stats.count > 0 ? stats.totalPaid / stats.count : 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'patterns' && (
        <Card className="p-6 bg-card border-border mb-6">
          <h4 className="font-semibold text-foreground mb-4">Representative Patterns</h4>
          <p className="text-muted-foreground">Pattern analysis based on claim characteristics coming soon.</p>
        </Card>
      )}

      {/* Help Text */}
      <Card className="p-4 bg-zinc-900 border-border">
        <h5 className="font-semibold text-foreground mb-1">How to use this dashboard:</h5>
        <p className="text-sm text-muted-foreground">
          This view is designed to govern litigation spend, not manage files. It surfaces where money bought information versus where it bought time. Improvement comes from tightening decision gates and time-boxing posture spend once leverage is exhausted.
        </p>
      </Card>
    </div>
  );
}