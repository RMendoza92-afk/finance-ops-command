import { useMemo, useState } from "react";
import { useStateBILimits, calculateOverspendMetrics } from "@/hooks/useStateBILimits";
import { useOverLimitPaymentsDB } from "@/hooks/useOverLimitPaymentsDB";
import { useLitigationData } from "@/hooks/useLitigationData";
import { 
  TrendingUp, 
  AlertTriangle, 
  MapPin,
  ChevronDown,
  ChevronUp,
  FileText,
  FileSpreadsheet,
  Calendar,
  Eye,
  Activity,
  ExternalLink
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverLimitDrilldownModal } from "./OverLimitDrilldownModal";

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
  const { data: litigationData, loading: dataLoading } = useLitigationData();
  const { byState: dbStateMetrics, totals: dbTotals, loading: dbLoading, getClaimsByState, data: dbData } = useOverLimitPaymentsDB();
  const [showDetails, setShowDetails] = useState(false);
  const [showClaims, setShowClaims] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("ytd");
  const { generatePDF, generateExcel } = useExportData();
  
  // Drill-down state
  const [drilldownState, setDrilldownState] = useState<string | null>(null);
  const [drilldownOpen, setDrilldownOpen] = useState(false);

  // Calculate CWP threshold metrics from litigation data
  const cwpMetrics = useMemo(() => {
    if (!litigationData.length || !limits.length) return null;
    return calculateOverspendMetrics(litigationData, limits);
  }, [litigationData, limits]);

  // Use DB data for YTD over-limit
  const stateMetrics = dbStateMetrics;

  // Combined totals using DB data
  const combinedTotals = useMemo(() => {
    const cwpOver = cwpMetrics?.overLimitAmount || 0;
    const ytdOver = dbTotals.totalOverLimit;
    return {
      totalOverLimit: cwpOver + ytdOver,
      cwpOverLimit: cwpOver,
      ytdOverLimit: ytdOver,
      cwpCount: cwpMetrics?.overLimitClosures || 0,
      ytdCount: dbTotals.claimCount,
      totalCount: (cwpMetrics?.overLimitClosures || 0) + dbTotals.claimCount,
    };
  }, [cwpMetrics, dbTotals]);

  // Handle drill-down click
  const handleStateDrilldown = (state: string) => {
    setDrilldownState(state);
    setDrilldownOpen(true);
  };

  const drilldownClaims = drilldownState ? getClaimsByState(drilldownState) : [];
  const drilldownTotal = drilldownClaims.reduce((sum, c) => sum + c.over_limit_amount, 0);

  // Prepare export data - Standardized Executive Format
  const getExportData = (): ExportableData => {
    return {
      title: 'BI OVER-LIMIT PAYMENTS REPORT',
      subtitle: 'CWP Threshold Analysis + YTD 2026 Over-Limit Payments',
      timestamp: format(new Date(), 'MMMM d, yyyy h:mm a'),
      affectsManager: 'Claims + Litigation Leadership',
      summary: {
        'Total Over-Limit Claims': combinedTotals.totalCount.toLocaleString(),
        'Total Overspend': formatCurrencyFull(combinedTotals.totalOverLimit),
        'CWP Threshold Overspend': formatCurrencyFull(combinedTotals.cwpOverLimit),
        'YTD 2026 Overspend': formatCurrencyFull(combinedTotals.ytdOverLimit),
      },
      bulletInsights: [
        `${combinedTotals.totalCount} claims totaling ${formatCurrency(combinedTotals.totalOverLimit)} above state BI limits`,
        `CWP: ${combinedTotals.cwpCount} matters at ${formatCurrency(combinedTotals.cwpOverLimit)} overspend`,
        `YTD 2026: ${combinedTotals.ytdCount} claims at ${formatCurrency(combinedTotals.ytdOverLimit)} overspend`,
        stateMetrics.length > 0 
          ? `Highest exposure: ${stateMetrics[0].state} with ${formatCurrency(stateMetrics[0].totalOverLimit)}`
          : '',
      ].filter(Boolean),
      columns: ['State', 'Claims', 'Total Payment', 'Over Limit Amount', 'Avg Over-Limit'],
      rows: stateMetrics.map(s => [
        s.state,
        s.count,
        formatCurrencyFull(s.totalPayment),
        formatCurrencyFull(s.totalOverLimit),
        formatCurrencyFull(s.totalOverLimit / s.count),
      ]),
      rawClaimData: [
        // CWP threshold summary by state
        {
          sheetName: 'CWP Threshold By State',
          columns: ['State', 'Closures', 'Net Closures', 'Over Limit', 'Trigger Alerts', 'State Limit', 'Over Limit Amount'],
          rows: cwpMetrics?.byState?.length 
            ? cwpMetrics.byState.map(s => [
                s.state,
                s.closures,
                s.netClosures,
                s.overLimit,
                s.triggerAlerts,
                formatCurrencyFull(s.stateLimit),
                formatCurrencyFull(s.overLimitAmount),
              ])
            : [['No CWP threshold data available', '', '', '', '', '', '']],
        },
        // CWP summary totals
        {
          sheetName: 'CWP Summary',
          columns: ['Metric', 'Value'],
          rows: [
            ['Total CWP Closures', cwpMetrics?.totalClosures || 0],
            ['Net Closures (within limits)', cwpMetrics?.netClosures || 0],
            ['Over Limit Closures', cwpMetrics?.overLimitClosures || 0],
            ['80% Trigger Alerts', cwpMetrics?.triggerAlerts || 0],
            ['Total Over Limit Amount', formatCurrencyFull(cwpMetrics?.overLimitAmount || 0)],
          ],
        },
        // YTD 2025 claims detail from DB
        {
          sheetName: 'YTD 2025 Over-Limit Claims',
          columns: ['Date', 'Claim', 'State', 'Coverage Limit', 'Payment', 'Over Limit'],
          rows: dbData.map(p => [
            p.payment_date,
            p.claim_number,
            p.state,
            formatCurrencyFull(p.policy_limit || 0),
            formatCurrencyFull(p.payment_amount),
            formatCurrencyFull(p.over_limit_amount),
          ]),
        },
        // YTD by state summary
        {
          sheetName: 'YTD 2026 By State',
          columns: ['State', 'Claims', 'Total Payment', 'Total Over Limit', 'Avg Over Limit'],
          rows: stateMetrics.map(s => [
            s.state,
            s.count,
            formatCurrencyFull(s.totalPayment),
            formatCurrencyFull(s.totalOverLimit),
            formatCurrencyFull(s.totalOverLimit / s.count),
          ]),
        },
      ],
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

  if (limitsLoading || dataLoading || dbLoading) {
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
              BI Over-Limit Tracker
            </h3>
            <Badge variant="destructive" className="text-[10px]">
              {combinedTotals.totalCount} Total Claims
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            CWP threshold analysis + YTD 2025 actual over-limit payments
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
              <>Details <ChevronDown className="ml-1 h-3 w-3" /></>
            )}
          </Button>
        </div>
      </div>

      {/* Combined Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase">Total Overspend</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-destructive">{formatCurrency(combinedTotals.totalOverLimit)}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{combinedTotals.totalCount} claims combined</p>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-amber-500" />
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase">CWP Threshold</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-amber-600">{formatCurrency(combinedTotals.cwpOverLimit)}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{combinedTotals.cwpCount} matters</p>
        </div>

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-destructive" />
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase">YTD 2025</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-destructive">{formatCurrency(combinedTotals.ytdOverLimit)}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">{combinedTotals.ytdCount} claims</p>
        </div>

        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-4 w-4 text-warning" />
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase">80% Triggers</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-warning">{cwpMetrics?.triggerAlerts || 0}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Approaching limits</p>
        </div>
      </div>

      {/* Detailed Views */}
      {showDetails && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="ytd" className="text-xs">
              YTD 2025 Over-Limit ({dbTotals.claimCount})
            </TabsTrigger>
            <TabsTrigger value="cwp" className="text-xs">
              CWP Threshold ({cwpMetrics?.overLimitClosures || 0})
            </TabsTrigger>
          </TabsList>

          {/* YTD 2025 Tab */}
          <TabsContent value="ytd" className="space-y-3">
            <p className="text-xs text-muted-foreground italic mb-2">
              Click any state row to drill down and export claims data
            </p>
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">State</TableHead>
                    <TableHead className="text-xs text-right">Claims</TableHead>
                    <TableHead className="text-xs text-right">Total Payment</TableHead>
                    <TableHead className="text-xs text-right text-destructive">Over Limit</TableHead>
                    <TableHead className="text-xs text-right">Avg Over-Limit</TableHead>
                    <TableHead className="text-xs w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stateMetrics.map((state) => (
                    <TableRow 
                      key={state.state} 
                      className="text-xs cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleStateDrilldown(state.state)}
                    >
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
                      <TableCell>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold text-xs">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">{dbTotals.claimCount}</TableCell>
                    <TableCell className="text-right">{formatCurrency(dbTotals.totalPayments)}</TableCell>
                    <TableCell className="text-right text-destructive">
                      {formatCurrency(dbTotals.totalOverLimit)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {dbTotals.claimCount > 0 ? formatCurrency(dbTotals.totalOverLimit / dbTotals.claimCount) : '-'}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClaims(!showClaims)}
              className="text-xs w-full"
            >
              <Eye className="h-3 w-3 mr-1" />
              {showClaims ? 'Hide' : 'View'} All {dbTotals.claimCount} Claims
            </Button>

            {showClaims && (
              <div className="border border-border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
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
                    {dbData.map((p, idx) => (
                      <TableRow key={p.id || idx} className="text-xs">
                        <TableCell className="font-mono text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {p.payment_date}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-medium">{p.claim_number}</TableCell>
                        <TableCell>{p.state}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.policy_limit || 0)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.payment_amount)}</TableCell>
                        <TableCell className="text-right text-destructive font-medium">
                          {formatCurrency(p.over_limit_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* CWP Threshold Tab */}
          <TabsContent value="cwp" className="space-y-3">
            {cwpMetrics && cwpMetrics.byState.length > 0 ? (
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">State</TableHead>
                      <TableHead className="text-xs text-right">Closures</TableHead>
                      <TableHead className="text-xs text-right">Net</TableHead>
                      <TableHead className="text-xs text-right text-destructive">Over Limit</TableHead>
                      <TableHead className="text-xs text-right text-warning">80% Triggers</TableHead>
                      <TableHead className="text-xs text-right">State Limit</TableHead>
                      <TableHead className="text-xs text-right text-destructive">Overspend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cwpMetrics.byState.map((state) => (
                      <TableRow key={state.state} className="text-xs">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {state.state}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{state.closures}</TableCell>
                        <TableCell className="text-right text-green-600">{state.netClosures}</TableCell>
                        <TableCell className="text-right text-destructive font-medium">{state.overLimit}</TableCell>
                        <TableCell className="text-right text-warning">{state.triggerAlerts}</TableCell>
                        <TableCell className="text-right">{formatCurrency(state.stateLimit)}</TableCell>
                        <TableCell className="text-right text-destructive font-medium">
                          {formatCurrency(state.overLimitAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold text-xs">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">{cwpMetrics.totalClosures}</TableCell>
                      <TableCell className="text-right text-green-600">{cwpMetrics.netClosures}</TableCell>
                      <TableCell className="text-right text-destructive">{cwpMetrics.overLimitClosures}</TableCell>
                      <TableCell className="text-right text-warning">{cwpMetrics.triggerAlerts}</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right text-destructive">
                        {formatCurrency(cwpMetrics.overLimitAmount)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Activity className="h-8 w-8 mx-auto mb-2 text-green-500" />
                No CWP threshold violations detected
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Drill-down Modal */}
      <OverLimitDrilldownModal
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
        state={drilldownState || ''}
        claims={drilldownClaims}
        totalOverLimit={drilldownTotal}
      />
    </div>
  );
}
