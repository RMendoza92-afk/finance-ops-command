import { useMemo, useState } from "react";
import { useLitigationData } from "@/hooks/useLitigationData";
import { useStateBILimits, calculateOverspendMetrics } from "@/hooks/useStateBILimits";
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  MapPin,
  ChevronDown,
  ChevronUp,
  FileText,
  FileSpreadsheet,
  Download
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
import { useExportData, ExportableData } from "@/hooks/useExportData";
import { format } from "date-fns";
import { toast } from "sonner";

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
  const { data: matters, loading: mattersLoading, dataSource } = useLitigationData();
  const { limits, loading: limitsLoading } = useStateBILimits();
  const [showDetails, setShowDetails] = useState(false);
  const { generatePDF, generateExcel } = useExportData();

  const metrics = useMemo(() => {
    if (!matters.length || !limits.length) return null;
    return calculateOverspendMetrics(matters, limits);
  }, [matters, limits]);

  // Prepare export data
  const getExportData = (): ExportableData | null => {
    if (!metrics) return null;
    
    return {
      title: 'State BI Limit Overspend Report',
      subtitle: 'Closed matters vs 2025 per-person state minimums with 80% trigger authority',
      timestamp: format(new Date(), 'MMMM d, yyyy h:mm a'),
      summary: {
        'Total Closures': metrics.totalClosures.toLocaleString(),
        'Net Closures': `${metrics.netClosures} (${((metrics.netClosures / metrics.totalClosures) * 100).toFixed(1)}%)`,
        'Over Limit': `${metrics.overLimitClosures} (${((metrics.overLimitClosures / metrics.totalClosures) * 100).toFixed(1)}%)`,
        'Trigger Alerts': metrics.triggerAlerts.toLocaleString(),
        'Total Overspend': formatCurrency(metrics.overLimitAmount),
      },
      bulletInsights: [
        `${metrics.netClosures} closures (${((metrics.netClosures / metrics.totalClosures) * 100).toFixed(1)}%) settled within state BI limits`,
        `${metrics.overLimitClosures} closures exceeded state limits, totaling ${formatCurrency(metrics.overLimitAmount)} in overspend`,
        `${metrics.triggerAlerts} matters at 80%+ threshold requiring executive authority`,
        metrics.byState.length > 0 
          ? `Highest overspend: ${metrics.byState[0].state} with ${metrics.byState[0].overLimit} over-limit closures`
          : 'No state-level overspend detected',
      ],
      columns: ['State', 'BI Limit', 'Total Closures', 'Net Closures', 'Over Limit', 'Trigger Alerts', 'Overspend Amount'],
      rows: metrics.byState.map(s => [
        s.state,
        formatCurrency(s.stateLimit),
        s.closures,
        s.netClosures,
        s.overLimit,
        s.triggerAlerts,
        s.overLimitAmount > 0 ? formatCurrency(s.overLimitAmount) : '—',
      ]),
    };
  };

  const handleExportPDF = async () => {
    const exportData = getExportData();
    if (!exportData) return;
    try {
      await generatePDF(exportData);
      toast.success('PDF exported successfully');
    } catch (err) {
      toast.error('Failed to export PDF');
    }
  };

  const handleExportExcel = () => {
    const exportData = getExportData();
    if (!exportData) return;
    try {
      generateExcel(exportData);
      toast.success('Excel exported successfully');
    } catch (err) {
      toast.error('Failed to export Excel');
    }
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            State BI Limit Overspend Tracker
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Closed matters vs 2025 per-person state minimums • 80% trigger authority
            <span className="ml-2 text-muted-foreground/60">
              (Source: {dataSource === 'csv' ? 'CSV' : 'Database'})
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="text-xs h-7 px-2"
          >
            <FileText className="h-3 w-3 mr-1" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="text-xs h-7 px-2"
          >
            <FileSpreadsheet className="h-3 w-3 mr-1" />
            Excel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs h-7"
          >
            {showDetails ? (
              <>Hide <ChevronUp className="ml-1 h-3 w-3" /></>
            ) : (
              <>By State <ChevronDown className="ml-1 h-3 w-3" /></>
            )}
          </Button>
        </div>
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
              {metrics.byState.map((state) => (
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
        </div>
      )}
    </div>
  );
}
