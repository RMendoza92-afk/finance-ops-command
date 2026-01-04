import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LitigationMatter } from "@/hooks/useLitigationData";
import { cn } from "@/lib/utils";

interface AggregatedMatter {
  id: string;
  uniqueRecord: string;
  claim: string;
  claimant: string;
  coverage: string;
  litigationStage: 'Early' | 'Mid' | 'Late' | 'Very Late';
  expertType: string;
  expertSpend: number;
  reactiveSpend: number;
  postureRatio: number;
  riskFlag: 'GREEN' | 'ORANGE' | 'RED';
  team: string;
  adjuster: string;
  dept: string;
  totalPaid: number;
  indemnity: number;
  expense: number;
  painBand: string;
  transactions: LitigationMatter[];
}

interface DrilldownModalProps {
  matter: AggregatedMatter | null;
  onClose: () => void;
}

function MetricCard({ label, value, subValue, variant = 'default' }: { 
  label: string; 
  value: string; 
  subValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const variantStyles = {
    default: 'border-border',
    success: 'border-emerald-500/30 bg-emerald-500/5',
    warning: 'border-orange-500/30 bg-orange-500/5',
    danger: 'border-red-500/30 bg-red-500/5'
  };
  
  const textStyles = {
    default: 'text-foreground',
    success: 'text-emerald-400',
    warning: 'text-orange-400',
    danger: 'text-red-400'
  };
  
  return (
    <div className={cn("border rounded-lg p-3", variantStyles[variant])}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className={cn("text-xl font-bold font-mono", textStyles[variant])}>{value}</div>
      {subValue && <div className="text-xs text-muted-foreground mt-0.5">{subValue}</div>}
    </div>
  );
}

function RiskIndicator({ level }: { level: 'GREEN' | 'ORANGE' | 'RED' }) {
  const colors = {
    GREEN: "bg-emerald-500",
    ORANGE: "bg-orange-500",
    RED: "bg-red-500 animate-pulse"
  };
  
  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-3 h-3 rounded-full", colors[level])} />
      <span className={cn(
        "text-sm font-medium",
        level === 'GREEN' ? "text-emerald-400" : 
        level === 'ORANGE' ? "text-orange-400" : "text-red-400"
      )}>
        {level} Risk
      </span>
    </div>
  );
}

export function DrilldownModal({ matter, onClose }: DrilldownModalProps) {
  if (!matter) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getRiskVariant = (level: 'GREEN' | 'ORANGE' | 'RED') => {
    if (level === 'RED') return 'danger';
    if (level === 'ORANGE') return 'warning';
    return 'success';
  };

  return (
    <Dialog open={!!matter} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-card border-border">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold">
                {matter.uniqueRecord}
              </DialogTitle>
              <p className="text-muted-foreground text-sm mt-1">
                {matter.claimant} • {matter.coverage}
              </p>
            </div>
            <RiskIndicator level={matter.riskFlag} />
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto space-y-6 pr-2">
          {/* Exposure Snapshot */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Exposure Snapshot
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <MetricCard 
                label="Total Paid" 
                value={formatCurrency(matter.totalPaid)} 
              />
              <MetricCard 
                label="Indemnity" 
                value={formatCurrency(matter.indemnity)} 
                variant={matter.indemnity > 100000 ? 'warning' : 'default'}
              />
              <MetricCard 
                label="Expense" 
                value={formatCurrency(matter.expense)} 
              />
              <MetricCard 
                label="Expert Spend" 
                value={formatCurrency(matter.expertSpend)} 
                variant={matter.expertSpend > 50000 ? 'warning' : 'default'}
              />
            </div>
          </section>

          {/* Risk Metrics */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Risk Metrics
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <MetricCard 
                label="Reactive Spend" 
                value={formatCurrency(matter.reactiveSpend)} 
                variant={getRiskVariant(matter.riskFlag)}
              />
              <MetricCard 
                label="Posture/Expert Ratio" 
                value={matter.postureRatio > 0 ? `${matter.postureRatio.toFixed(1)}x` : '—'} 
                variant={getRiskVariant(matter.riskFlag)}
              />
              <MetricCard 
                label="Stage" 
                value={matter.litigationStage}
                variant={matter.litigationStage === 'Very Late' ? 'danger' : 
                        matter.litigationStage === 'Late' ? 'warning' : 'default'}
              />
              <MetricCard 
                label="Pain Band" 
                value={matter.painBand}
              />
            </div>
          </section>

          {/* Assignment Info */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Assignment
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <MetricCard label="Department" value={matter.dept || '—'} />
              <MetricCard label="Team" value={matter.team || '—'} />
              <MetricCard label="Adjuster" value={matter.adjuster || '—'} />
            </div>
          </section>

          {/* Recent Transactions */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Transaction History ({matter.transactions.length} records)
            </h3>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Indemnity</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Expense</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Exp Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matter.transactions.slice(0, 50).map((txn, idx) => (
                      <tr key={idx} className="border-t border-border/50 hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-muted-foreground">{txn.paymentDate}</td>
                        <td className={cn(
                          "px-3 py-2 text-right font-mono",
                          txn.indemnitiesAmount > 0 ? "text-emerald-400" : "text-muted-foreground"
                        )}>
                          {formatCurrency(txn.indemnitiesAmount)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {formatCurrency(txn.totalAmount - txn.indemnitiesAmount)}
                        </td>
                        <td className={cn(
                          "px-3 py-2 text-right font-mono font-medium",
                          txn.totalAmount > 50000 ? "text-orange-400" : "text-foreground"
                        )}>
                          {formatCurrency(txn.totalAmount)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primary">
                            {txn.expCategory || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {matter.transactions.length > 50 && (
                <div className="py-2 px-3 text-xs text-muted-foreground border-t border-border bg-muted/30">
                  Showing first 50 of {matter.transactions.length} transactions
                </div>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
