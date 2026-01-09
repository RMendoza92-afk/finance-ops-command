import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { LitigationMatter } from "@/hooks/useLitigationData";
import { useExportData, ExportableData } from "@/hooks/useExportData";
import { toast } from "sonner";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { getCurrentMonthlySpend } from "@/data/monthlySpendData";

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
  const { exportBoth } = useExportData();
  const timestamp = format(new Date(), 'MMMM d, yyyy h:mm a');
  
  // Get current monthly spend data from operations report (Jan 2026)
  const monthlySpend = getCurrentMonthlySpend();

  // Use January 2026 operations report figures
  const totalExpense = monthlySpend.expenses.total;       // $268,869.38
  const totalIndemnities = monthlySpend.indemnities.total; // $9,835,934.96
  const totalNet = totalIndemnities + totalExpense;        // $10,104,804.34

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount.toLocaleString()}`;
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
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

  // Export handlers
  const handleExportKPIs = useCallback(async () => {
    const exportData: ExportableData = {
      title: '2025 Litigation Discipline Summary',
      subtitle: 'Key Financial Metrics',
      timestamp,
      affectsManager: 'Litigation Management',
      summary: {
        'Total Matters': stats.totalMatters,
        'Total Expenses': formatCurrencyFull(totalExpense),
        'Total Indemnities': formatCurrencyFull(totalIndemnities),
        'Net Amount': formatCurrencyFull(totalNet),
      },
      columns: ['Metric', 'Value'],
      rows: [
        ['Total Litigation Expense', formatCurrencyFull(totalExpense)],
        ['Total Indemnities Paid', formatCurrencyFull(totalIndemnities)],
        ['Feature Inception to Current Net', formatCurrencyFull(totalNet)],
        ['Total Matters', stats.totalMatters],
        ['CWP Count', stats.cwpCount],
        ['CWN Count', stats.cwnCount],
      ],
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Litigation Discipline Summary');
  }, [exportBoth, timestamp, stats, totalExpense, totalIndemnities, totalNet]);

  const handleExportPostureROI = useCallback(async () => {
    const exportData: ExportableData = {
      title: 'Posture ROI Analysis',
      subtitle: 'Did Posture Spend Change Outcomes?',
      timestamp,
      affectsManager: 'Litigation Management',
      columns: ['Outcome Band', 'Expert Spend', 'Posture Spend', 'Observation'],
      rows: outcomeData.map(row => [
        row.outcomeBand,
        formatCurrencyFull(row.expertSpend),
        formatCurrencyFull(row.postureSpend),
        row.observation,
      ]),
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Posture ROI');
  }, [exportBoth, timestamp]);

  const handleExportPainVsPaid = useCallback(async () => {
    const entries = Object.entries(painVsPaidData);
    const exportData: ExportableData = {
      title: 'Pain vs Paid Analysis',
      subtitle: 'Decision Gates Dashboard',
      timestamp,
      affectsManager: 'Litigation Management',
      columns: ['Pain Bucket', 'Count', 'Avg Pain Level', 'Total Paid', 'Avg Paid per Claim'],
      rows: entries.map(([bucket, s]) => [
        bucket,
        s.count,
        s.avgPain.toFixed(1),
        formatCurrencyFull(s.totalPaid),
        formatCurrencyFull(s.count > 0 ? s.totalPaid / s.count : 0),
      ]),
    };
    await exportBoth(exportData);
    toast.success('PDF + Excel exported: Pain vs Paid Analysis');
  }, [exportBoth, timestamp, painVsPaidData]);

  return (
    <div className="mb-8">
      {/* Export Hint */}
      <div className="bg-muted/30 border border-border/50 rounded-lg px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground mb-4">
        <Download className="h-3.5 w-3.5" />
        <span>Double-click any section to export PDF + Excel</span>
      </div>

      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-foreground">2025 Discipline Command Dashboard</h3>
        <p className="text-sm text-muted-foreground">
          Hybrid governance dashboard using real 2025 litigation data. Purpose: enforce spend discipline by separating information spend from posture spend, identifying decision gate leakage, and learning from repeatable patterns.
        </p>
      </div>

      {/* KPI Cards */}
      <div 
        className="grid grid-cols-3 gap-4 mb-6 cursor-pointer"
        onDoubleClick={handleExportKPIs}
        title="Double-click to export"
      >
        <Card className="p-4 bg-card border-border hover:border-primary/50 transition-colors">
          <div className="text-3xl font-bold text-red-500">{formatCurrency(totalExpense)}</div>
          <div className="text-sm text-muted-foreground">Total Litigation Expense (2025)</div>
        </Card>
        <Card className="p-4 bg-card border-border hover:border-primary/50 transition-colors">
          <div className="text-3xl font-bold text-red-500">{formatCurrency(totalIndemnities)}</div>
          <div className="text-sm text-muted-foreground">Total Indemnities Paid</div>
        </Card>
        <Card className="p-4 bg-card border-border hover:border-primary/50 transition-colors">
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
        <Card 
          className="p-6 bg-card border-border mb-6 cursor-pointer hover:border-primary/50 transition-colors"
          onDoubleClick={handleExportPostureROI}
          title="Double-click to export"
        >
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
        <Card 
          className="p-6 bg-card border-border mb-6 cursor-pointer hover:border-primary/50 transition-colors"
          onDoubleClick={handleExportPainVsPaid}
          title="Double-click to export"
        >
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
              {Object.entries(painVsPaidData).map(([bucket, s], idx) => (
                <tr key={idx} className="border-t border-border/50">
                  <td className={`py-3 pr-4 font-medium ${
                    bucket.includes('High') ? 'text-red-500' :
                    bucket.includes('Medium') ? 'text-yellow-500' : 'text-green-500'
                  }`}>
                    {bucket}
                  </td>
                  <td className="py-3 pr-4 text-foreground">{s.count}</td>
                  <td className="py-3 pr-4 text-foreground">{s.avgPain.toFixed(1)}</td>
                  <td className="py-3 pr-4 text-foreground">{formatCurrency(s.totalPaid)}</td>
                  <td className="py-3 text-foreground">
                    {formatCurrency(s.count > 0 ? s.totalPaid / s.count : 0)}
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