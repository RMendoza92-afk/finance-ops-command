import { useMemo, useState } from "react";
import { useStateBILimits } from "@/hooks/useStateBILimits";
import { overLimitPayments2025, getOverLimitByState, overLimitTotals } from "@/data/overLimitPayments2025";
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
  Calendar,
  Eye
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
import { Badge } from "@/components/ui/badge";

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

function formatCurrencyFull(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function OverspendTracker() {
  const { limits, loading: limitsLoading } = useStateBILimits();
  const [showDetails, setShowDetails] = useState(false);
  const [showClaims, setShowClaims] = useState(false);
  const { generatePDF, generateExcel } = useExportData();

  // Use actual YTD 2025 over-limit data
  const stateMetrics = useMemo(() => {
    return getOverLimitByState(overLimitPayments2025);
  }, []);

  // Prepare export data
  const getExportData = (): ExportableData => {
    return {
      title: 'YTD 2025 BI Over-Limit Payments Report',
      subtitle: 'Payments exceeding state per-person BI policy limits',
      timestamp: format(new Date(), 'MMMM d, yyyy h:mm a'),
      summary: {
        'Total Claims': overLimitTotals.claimCount.toLocaleString(),
        'Total Payments': formatCurrencyFull(overLimitTotals.totalPayments),
        'Total Over Limit': formatCurrencyFull(overLimitTotals.totalOverLimit),
        'States Impacted': stateMetrics.length.toString(),
      },
      bulletInsights: [
        `${overLimitTotals.claimCount} claims paid above state BI limits in 2025 YTD`,
        `Total overspend of ${formatCurrency(overLimitTotals.totalOverLimit)} across ${stateMetrics.length} states`,
        stateMetrics.length > 0 
          ? `Highest exposure: ${stateMetrics[0].state} with ${formatCurrency(stateMetrics[0].totalOverLimit)} over-limit`
          : 'No state-level overspend detected',
        `Average over-limit per claim: ${formatCurrency(overLimitTotals.totalOverLimit / overLimitTotals.claimCount)}`,
      ],
      columns: ['State', 'Claims', 'Total Payment', 'Over Limit Amount', 'Avg Over-Limit'],
      rows: stateMetrics.map(s => [
        s.state,
        s.count,
        formatCurrencyFull(s.totalPayment),
        formatCurrencyFull(s.totalOverLimit),
        formatCurrencyFull(s.totalOverLimit / s.count),
      ]),
      rawClaimData: [{
        sheetName: 'Over-Limit Claims Detail',
        columns: ['Date', 'Claim', 'State', 'Coverage Limit', 'Payment', 'Over Limit'],
        rows: overLimitPayments2025.map(p => [
          p.date,
          p.claim,
          p.state,
          formatCurrencyFull(p.coverageLimit),
          formatCurrencyFull(p.payment),
          formatCurrencyFull(p.overLimit),
        ]),
      }],
    };
  };

  const handleExportPDF = async () => {
    const exportData = getExportData();
    try {
      await generatePDF(exportData);
      toast.success('PDF exported successfully');
    } catch (err) {
      toast.error('Failed to export PDF');
    }
  };

  const handleExportExcel = () => {
    const exportData = getExportData();
    try {
      generateExcel(exportData);
      toast.success('Excel exported successfully');
    } catch (err) {
      toast.error('Failed to export Excel');
    }
  };

  if (limitsLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="h-24 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              YTD 2025 BI Over-Limit Payments
            </h3>
            <Badge variant="destructive" className="text-[10px]">
              {overLimitTotals.claimCount} Claims
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Payments exceeding state per-person BI policy limits • Actual claim data
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-destructive" />
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase">Over-Limit Claims</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-destructive">{overLimitTotals.claimCount}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">YTD 2025</p>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase">Total Paid</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-foreground">{formatCurrency(overLimitTotals.totalPayments)}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Gross payments</p>
        </div>

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase">Total Overspend</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-destructive">{formatCurrency(overLimitTotals.totalOverLimit)}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Above policy limits</p>
        </div>

        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-4 w-4 text-warning" />
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase">States</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-warning">{stateMetrics.length}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">With over-limit claims</p>
        </div>
      </div>

      {/* State Summary Table */}
      {showDetails && stateMetrics.length > 0 && (
        <div className="space-y-3">
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">State</TableHead>
                  <TableHead className="text-xs text-right">Claims</TableHead>
                  <TableHead className="text-xs text-right">Total Payment</TableHead>
                  <TableHead className="text-xs text-right text-destructive">Over Limit</TableHead>
                  <TableHead className="text-xs text-right">Avg Over-Limit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stateMetrics.map((state) => (
                  <TableRow key={state.state} className="text-xs">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {state.state}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{state.count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(state.totalPayment)}</TableCell>
                    <TableCell className="text-right text-destructive font-medium">
                      {formatCurrency(state.totalOverLimit)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(state.totalOverLimit / state.count)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="bg-muted/50 font-semibold text-xs">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">{overLimitTotals.claimCount}</TableCell>
                  <TableCell className="text-right">{formatCurrency(overLimitTotals.totalPayments)}</TableCell>
                  <TableCell className="text-right text-destructive">
                    {formatCurrency(overLimitTotals.totalOverLimit)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(overLimitTotals.totalOverLimit / overLimitTotals.claimCount)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Toggle claims detail */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowClaims(!showClaims)}
            className="text-xs w-full"
          >
            <Eye className="h-3 w-3 mr-1" />
            {showClaims ? 'Hide' : 'View'} All {overLimitTotals.claimCount} Claims
          </Button>
        </div>
      )}

      {/* Individual Claims Table */}
      {showDetails && showClaims && (
        <div className="border border-border rounded-lg overflow-hidden mt-3 max-h-[400px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-muted z-10">
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Claim</TableHead>
                <TableHead className="text-xs">State</TableHead>
                <TableHead className="text-xs text-right">Limit</TableHead>
                <TableHead className="text-xs text-right">Payment</TableHead>
                <TableHead className="text-xs text-right text-destructive">Over Limit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overLimitPayments2025.map((p, idx) => (
                <TableRow key={`${p.claim}-${idx}`} className="text-xs">
                  <TableCell className="font-mono text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {p.date}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono font-medium">{p.claim}</TableCell>
                  <TableCell>{p.state}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.coverageLimit)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(p.payment)}</TableCell>
                  <TableCell className="text-right text-destructive font-medium">
                    {formatCurrency(p.overLimit)}
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
