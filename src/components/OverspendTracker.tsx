import { useMemo, useState } from "react";
import { useLitigationDataDB, LitigationMatter } from "@/hooks/useLitigationDataDB";
import { useStateBILimits, calculateOverspendMetrics, StateBILimit } from "@/hooks/useStateBILimits";
import { KPICard } from "@/components/KPICard";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  MapPin,
  ChevronDown,
  ChevronUp 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

export function OverspendTracker() {
  const { data: matters, loading: mattersLoading } = useLitigationDataDB();
  const { limits, loading: limitsLoading } = useStateBILimits();
  const [showDetails, setShowDetails] = useState(false);

  const metrics = useMemo(() => {
    if (!matters.length || !limits.length) return null;
    return calculateOverspendMetrics(matters, limits);
  }, [matters, limits]);

  if (mattersLoading || limitsLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="h-24 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!metrics || metrics.totalClosures === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2">
          State Limit Overspend Tracker
        </h3>
        <p className="text-sm text-muted-foreground">
          No closed matters with indemnity payments to analyze.
        </p>
      </div>
    );
  }

  const overspendRate = ((metrics.overLimitClosures / metrics.totalClosures) * 100).toFixed(1);
  const netRate = ((metrics.netClosures / metrics.totalClosures) * 100).toFixed(1);

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            State BI Limit Overspend Tracker
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Closed matters vs 2025 per-person state minimums • 80% trigger authority
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs"
        >
          {showDetails ? (
            <>Hide Details <ChevronUp className="ml-1 h-3 w-3" /></>
          ) : (
            <>By State <ChevronDown className="ml-1 h-3 w-3" /></>
          )}
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase">Net Closures</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-success">{metrics.netClosures}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{netRate}% within limits</p>
        </div>

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-destructive" />
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase">Over Limit</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-destructive">{metrics.overLimitClosures}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{overspendRate}% exceeded</p>
        </div>

        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase">Trigger Alerts</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-warning">{metrics.triggerAlerts}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">At 80%+ threshold</p>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-destructive" />
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase">Overspend Amt</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-destructive">{formatCurrency(metrics.overLimitAmount)}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Above state limits</p>
        </div>
      </div>

      {/* State Details Table */}
      {showDetails && metrics.byState.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs">State</TableHead>
                <TableHead className="text-xs text-right">Limit</TableHead>
                <TableHead className="text-xs text-right">Closures</TableHead>
                <TableHead className="text-xs text-right text-success">Net</TableHead>
                <TableHead className="text-xs text-right text-destructive">Over</TableHead>
                <TableHead className="text-xs text-right text-warning">Triggers</TableHead>
                <TableHead className="text-xs text-right">Overspend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.byState.slice(0, 15).map((state) => (
                <TableRow key={state.state} className="text-xs">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {state.state}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(state.stateLimit)}</TableCell>
                  <TableCell className="text-right">{state.closures}</TableCell>
                  <TableCell className="text-right text-success font-medium">{state.netClosures}</TableCell>
                  <TableCell className="text-right text-destructive font-medium">{state.overLimit}</TableCell>
                  <TableCell className="text-right text-warning font-medium">{state.triggerAlerts}</TableCell>
                  <TableCell className="text-right text-destructive">
                    {state.overLimitAmount > 0 ? formatCurrency(state.overLimitAmount) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {metrics.byState.length > 15 && (
            <div className="p-2 text-center text-xs text-muted-foreground border-t border-border">
              Showing top 15 of {metrics.byState.length} states
            </div>
          )}
        </div>
      )}
    </div>
  );
}
