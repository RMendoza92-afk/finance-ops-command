import { 
  Briefcase, 
  DollarSign, 
  AlertTriangle, 
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Users
} from "lucide-react";
import { KPICard } from "./KPICard";
import { LitigationMatter } from "@/data/litigationData";

interface SummaryCardsProps {
  data: LitigationMatter[];
  view: 'exec' | 'manager' | 'adjuster';
}

export function SummaryCards({ data, view }: SummaryCardsProps) {
  // Portfolio-level totals from actual pivot data
  const PORTFOLIO_TOTALS = {
    totalExposures: 26000,
    totalIndemnities: 354000000,
    totalExpenses: 21000000,
    totalAmount: 375000000,
    totalNet: 375000000,
    openExposures: 26000,
    closedWithPayment: 15000,
    closedNoPayment: 11000,
  };

  // Calculate metrics from filtered data (for drill-down context)
  const totalMatters = data.length;
  const cwpMatters = data.filter(m => m.cwpCwn === 'CWP').length;
  const highPainMatters = data.filter(m => m.endPainLvl >= 8).length;
  const criticalMatters = data.filter(m => m.endPainLvl >= 9).length;
  
  // Use portfolio totals for KPIs, filtered data for drill-down
  const isFullDataset = data.length === totalMatters; // Will show portfolio totals when unfiltered
  const totalIndemnities = PORTFOLIO_TOTALS.totalIndemnities;
  const totalAmount = PORTFOLIO_TOTALS.totalAmount;
  const totalNet = PORTFOLIO_TOTALS.totalNet;
  
  // Unique adjusters and teams from sample
  const uniqueAdjusters = new Set(data.map(m => m.adjusterName)).size;
  const uniqueTeams = new Set(data.map(m => m.team)).size;

  const formatLargeCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };

  if (view === 'exec') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger-children">
        <KPICard
          title="Total Net Exposure"
          value={formatLargeCurrency(totalNet)}
          subtitle="Feature inception to current"
          icon={DollarSign}
          variant="danger"
        />
        <KPICard
          title="Total Indemnities"
          value={formatLargeCurrency(totalIndemnities)}
          subtitle={`${formatLargeCurrency(totalAmount)} total amount`}
          icon={TrendingUp}
          variant="warning"
        />
        <KPICard
          title="Critical Pain (9-10)"
          value={criticalMatters}
          subtitle={`${highPainMatters} high pain (8+)`}
          icon={AlertTriangle}
          variant={criticalMatters > 0 ? 'danger' : 'default'}
        />
        <KPICard
          title="Closed Matters"
          value={cwpMatters}
          subtitle="With payment"
          icon={CheckCircle2}
          variant="success"
        />
      </div>
    );
  }

  if (view === 'manager') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6 stagger-children">
        <KPICard
          title="Total Records"
          value={totalMatters}
          subtitle="In filtered view"
          icon={Briefcase}
          variant="primary"
        />
        <KPICard
          title="Closed (CWP)"
          value={cwpMatters}
          subtitle="With payment"
          icon={CheckCircle2}
          variant="success"
        />
        <KPICard
          title="High Pain (8+)"
          value={highPainMatters}
          subtitle="Requires attention"
          icon={AlertTriangle}
          variant={highPainMatters > 0 ? 'danger' : 'default'}
        />
        <KPICard
          title="High Pain (8+)"
          value={highPainMatters}
          subtitle="Requires attention"
          icon={AlertTriangle}
          variant={highPainMatters > 0 ? 'danger' : 'default'}
        />
        <KPICard
          title="Active Teams"
          value={uniqueTeams}
          subtitle="Across matters"
          icon={Users}
          variant="default"
        />
        <KPICard
          title="Total Net"
          value={formatLargeCurrency(totalNet)}
          icon={DollarSign}
          variant="primary"
        />
      </div>
    );
  }

  // Adjuster view
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger-children">
      <KPICard
        title="My Records"
        value={totalMatters}
        subtitle="Active assignments"
        icon={Briefcase}
        variant="primary"
      />
        <KPICard
          title="High Pain Cases"
          value={highPainMatters}
          icon={AlertTriangle}
          variant={highPainMatters > 0 ? 'danger' : 'success'}
        />
      <KPICard
        title="High Pain Cases"
        value={highPainMatters}
        icon={AlertTriangle}
        variant={highPainMatters > 0 ? 'danger' : 'success'}
      />
      <KPICard
        title="Closed (CWP)"
        value={cwpMatters}
        subtitle="Successfully resolved"
        icon={CheckCircle2}
        variant="success"
      />
    </div>
  );
}
