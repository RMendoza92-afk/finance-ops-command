import { 
  Briefcase, 
  DollarSign, 
  AlertTriangle, 
  Scale, 
  CheckCircle2, 
  Clock,
  TrendingUp,
  Shield
} from "lucide-react";
import { KPICard } from "./KPICard";
import { LitigationMatter } from "@/data/litigationData";

interface SummaryCardsProps {
  data: LitigationMatter[];
  view: 'exec' | 'manager' | 'adjuster';
}

export function SummaryCards({ data, view }: SummaryCardsProps) {
  // Calculate metrics
  const totalMatters = data.length;
  const openMatters = data.filter(m => m.status === 'Open' || m.status === 'In Trial' || m.status === 'Pending').length;
  const closedMatters = data.filter(m => m.status === 'Closed').length;
  const criticalMatters = data.filter(m => m.severity === 'Critical').length;
  const inTrialMatters = data.filter(m => m.status === 'In Trial').length;
  
  const totalReserves = data.reduce((sum, m) => sum + m.incurredReserve, 0);
  const totalPaid = data.reduce((sum, m) => sum + m.paidToDate, 0);
  const totalExposure = data.reduce((sum, m) => sum + m.estimatedExposure, 0);

  const formatLargeCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount}`;
  };

  if (view === 'exec') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger-children">
        <KPICard
          title="Total Exposure"
          value={formatLargeCurrency(totalExposure)}
          subtitle="Across all open matters"
          icon={DollarSign}
          variant="danger"
          trend={{ value: 8.2, isPositive: false }}
        />
        <KPICard
          title="Total Reserves"
          value={formatLargeCurrency(totalReserves)}
          subtitle={`${formatLargeCurrency(totalPaid)} paid YTD`}
          icon={TrendingUp}
          variant="warning"
        />
        <KPICard
          title="Critical Matters"
          value={criticalMatters}
          subtitle={`${inTrialMatters} currently in trial`}
          icon={AlertTriangle}
          variant={criticalMatters > 0 ? 'danger' : 'default'}
        />
        <KPICard
          title="Open Matters"
          value={openMatters}
          subtitle={`${closedMatters} closed this period`}
          icon={Briefcase}
          variant="primary"
        />
      </div>
    );
  }

  if (view === 'manager') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6 stagger-children">
        <KPICard
          title="Active Matters"
          value={openMatters}
          subtitle="Requiring attention"
          icon={Briefcase}
          variant="primary"
        />
        <KPICard
          title="In Trial"
          value={inTrialMatters}
          subtitle="Active litigation"
          icon={Scale}
          variant={inTrialMatters > 0 ? 'danger' : 'success'}
        />
        <KPICard
          title="Critical"
          value={criticalMatters}
          subtitle="High priority"
          icon={AlertTriangle}
          variant={criticalMatters > 0 ? 'danger' : 'default'}
        />
        <KPICard
          title="Pending"
          value={data.filter(m => m.status === 'Pending').length}
          subtitle="Awaiting action"
          icon={Clock}
          variant="warning"
        />
        <KPICard
          title="Total Reserves"
          value={formatLargeCurrency(totalReserves)}
          icon={DollarSign}
          variant="default"
        />
        <KPICard
          title="Closed"
          value={closedMatters}
          subtitle="This period"
          icon={CheckCircle2}
          variant="success"
        />
      </div>
    );
  }

  // Adjuster view
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger-children">
      <KPICard
        title="My Open Matters"
        value={openMatters}
        subtitle="Active assignments"
        icon={Briefcase}
        variant="primary"
      />
      <KPICard
        title="Pending Review"
        value={data.filter(m => m.status === 'Pending').length}
        subtitle="Needs attention"
        icon={Clock}
        variant="warning"
      />
      <KPICard
        title="Critical Cases"
        value={criticalMatters}
        icon={Shield}
        variant={criticalMatters > 0 ? 'danger' : 'success'}
      />
      <KPICard
        title="Closed This Month"
        value={closedMatters}
        subtitle="Successfully resolved"
        icon={CheckCircle2}
        variant="success"
      />
    </div>
  );
}
