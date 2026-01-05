import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LitigationMatter } from "@/hooks/useLitigationData";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { useExportData, ExportableData } from "@/hooks/useExportData";
import { format } from "date-fns";
import { Download } from "lucide-react";

interface ExpertMatchingDashboardProps {
  data: LitigationMatter[];
}

// Mock expert matching data derived from litigation matters
interface ActionableItem {
  id: number;
  venue: string;
  venueSeverity: 'High' | 'Med' | 'Low';
  pattern: string;
  expert: string;
  posture: string;
  status: 'Terminate' | 'Coach';
  paidToDate: number;
  overhang: number;
  totalCost: number;
}

const patterns = ['Cognitive complaints', 'Soft tissue only', 'Excessive chiropractic'];
const experts = ['Neuropsych', 'Chiro', 'Neurologist', 'Nurse'];
const postures = ['Settle early', 'Validate'];

function generateActionableItems(data: LitigationMatter[]): ActionableItem[] {
  return data.slice(0, 12).map((matter, idx) => {
    const severity = matter.endPainLvl >= 8 ? 'High' : matter.endPainLvl >= 5 ? 'Med' : 'Low';
    const status: 'Terminate' | 'Coach' = matter.endPainLvl >= 7 ? 'Terminate' : 'Coach';
    const paidToDate = matter.totalAmount > 0 ? matter.totalAmount : Math.floor(Math.random() * 150000) + 50000;
    const overhang = Math.floor(paidToDate * (0.1 + Math.random() * 0.4));
    
    return {
      id: idx + 1,
      venue: `${matter.team.replace('TEAM ', '')} (${severity})`,
      venueSeverity: severity,
      pattern: patterns[idx % patterns.length],
      expert: experts[idx % experts.length],
      posture: postures[idx % postures.length],
      status,
      paidToDate,
      overhang,
      totalCost: paidToDate + overhang,
    };
  });
}

export function ExpertMatchingDashboard({ data }: ExpertMatchingDashboardProps) {
  const [selectedRow, setSelectedRow] = useState<ActionableItem | null>(null);
  const [managerNotes, setManagerNotes] = useState("");
  const { exportBoth } = useExportData();
  const timestamp = format(new Date(), 'MMMM d, yyyy h:mm a');

  const actionableItems = generateActionableItems(data);
  
  // Calculate KPI metrics
  const totalActionable = actionableItems.length;
  const decisionOverhang = actionableItems.reduce((sum, s) => sum + s.overhang, 0);
  const selectedTotalCost = selectedRow ? selectedRow.totalCost : actionableItems.reduce((sum, s) => sum + s.totalCost, 0);
  const terminateReady = actionableItems.filter(s => s.status === 'Terminate').length;

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  // Export handlers
  const handleExportKPIs = useCallback(async () => {
    const exportData: ExportableData = {
      title: 'Expert Matching Summary',
      subtitle: 'Manager Dashboard - Actionable Items',
      timestamp,
      affectsManager: 'Claims Management',
      summary: {
        'Actionable Items': totalActionable,
        'Decision Overhang': formatCurrencyFull(decisionOverhang),
        'Total Cost Exposure': formatCurrencyFull(selectedTotalCost),
        'Terminate Ready': terminateReady,
      },
      columns: ['Metric', 'Value'],
      rows: [
        ['Actionable Items', totalActionable],
        ['Decision Overhang', formatCurrencyFull(decisionOverhang)],
        ['Total Cost Exposure', formatCurrencyFull(selectedTotalCost)],
        ['Terminate Ready', terminateReady],
      ],
    };
    await exportBoth(exportData);
    sonnerToast.success('PDF + Excel exported: Expert Matching Summary');
  }, [exportBoth, timestamp, totalActionable, decisionOverhang, selectedTotalCost, terminateReady]);

  const handleExportQueue = useCallback(async () => {
    const exportData: ExportableData = {
      title: 'Expert Matching Action Queue',
      subtitle: 'Full queue with cost analysis',
      timestamp,
      affectsManager: 'Claims Management',
      summary: {
        'Total Items': actionableItems.length,
        'Total Overhang': formatCurrencyFull(decisionOverhang),
        'Terminate Ready': terminateReady,
      },
      columns: ['#', 'Venue', 'Pattern', 'Expert', 'Posture', 'Status', 'Paid to Date', 'Overhang', 'Total Cost'],
      rows: actionableItems.map(row => [
        row.id,
        row.venue,
        row.pattern,
        row.expert,
        row.posture,
        row.status,
        formatCurrencyFull(row.paidToDate),
        formatCurrencyFull(row.overhang),
        formatCurrencyFull(row.totalCost),
      ]),
    };
    await exportBoth(exportData);
    sonnerToast.success('PDF + Excel exported: Action Queue');
  }, [exportBoth, timestamp, actionableItems, decisionOverhang, terminateReady]);

  const handleExportItem = useCallback(async (item: ActionableItem) => {
    const exportData: ExportableData = {
      title: `Action Item: ${item.venue}`,
      subtitle: `Expert Matching - ${item.status}`,
      timestamp,
      affectsManager: 'Claims Management',
      summary: {
        'Venue': item.venue,
        'Pattern': item.pattern,
        'Expert': item.expert,
        'Posture': item.posture,
        'Status': item.status,
        'Paid to Date': formatCurrencyFull(item.paidToDate),
        'Overhang': formatCurrencyFull(item.overhang),
        'Total Cost': formatCurrencyFull(item.totalCost),
      },
      columns: ['Field', 'Value'],
      rows: [
        ['ID', item.id],
        ['Venue', item.venue],
        ['Pattern', item.pattern],
        ['Expert', item.expert],
        ['Posture', item.posture],
        ['Status', item.status],
        ['Paid to Date', formatCurrencyFull(item.paidToDate)],
        ['Overhang', formatCurrencyFull(item.overhang)],
        ['Total Cost', formatCurrencyFull(item.totalCost)],
      ],
    };
    await exportBoth(exportData);
    sonnerToast.success(`PDF + Excel exported: ${item.venue}`);
  }, [exportBoth, timestamp]);

  return (
    <div className="mb-8">
      {/* Export Hint */}
      <div className="bg-muted/30 border border-border/50 rounded-lg px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground mb-4">
        <Download className="h-3.5 w-3.5" />
        <span>Double-click any section to export PDF + Excel</span>
      </div>

      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-foreground">Expert Matching — Manager Dashboard</h3>
        <p className="text-sm text-muted-foreground">Actionable items • Cashflow harm + total cost of decision</p>
      </div>

      {/* KPI Cards */}
      <div 
        className="grid grid-cols-4 gap-4 mb-6 cursor-pointer"
        onDoubleClick={handleExportKPIs}
        title="Double-click to export"
      >
        <Card className="p-4 bg-card border-border hover:border-primary/50 transition-colors">
          <div className="text-3xl font-bold text-foreground">{totalActionable}</div>
          <div className="text-sm text-muted-foreground">Actionable Items</div>
        </Card>
        <Card className="p-4 bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/50 transition-colors">
          <div className="text-3xl font-bold text-yellow-500">{formatCurrency(decisionOverhang)}</div>
          <div className="text-sm text-yellow-500/80">Decision overhang</div>
        </Card>
        <Card className="p-4 bg-red-500/10 border-red-500/30 hover:border-red-500/50 transition-colors">
          <div className="text-3xl font-bold text-red-500">{formatCurrency(selectedTotalCost)}</div>
          <div className="text-sm text-red-500/80">Total cost exposure {selectedRow ? '' : '(selected)'}</div>
        </Card>
        <Card className="p-4 bg-card border-border hover:border-primary/50 transition-colors">
          <div className="text-3xl font-bold text-foreground">{terminateReady}</div>
          <div className="text-sm text-muted-foreground">Terminate-ready</div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Submission Queue Table */}
        <Card 
          className="lg:col-span-2 p-4 bg-card border-border cursor-pointer hover:border-primary/50 transition-colors"
          onDoubleClick={handleExportQueue}
          title="Double-click to export"
        >
          <div className="mb-3">
            <h4 className="font-semibold text-foreground">Action Queue <span className="text-muted-foreground font-normal">(click any line, double-click to export)</span></h4>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-2">#</th>
                  <th className="pb-2 pr-2">Venue</th>
                  <th className="pb-2 pr-2">Pattern</th>
                  <th className="pb-2 pr-2">Expert</th>
                  <th className="pb-2 pr-2">Posture</th>
                  <th className="pb-2 pr-2">Status</th>
                  <th className="pb-2 pr-2 text-right">Paid to Date</th>
                  <th className="pb-2 pr-2 text-right">Overhang</th>
                  <th className="pb-2 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {actionableItems.map((row) => (
                  <tr 
                    key={row.id}
                    onClick={() => setSelectedRow(row)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleExportItem(row);
                    }}
                    className={`border-b border-border/50 cursor-pointer transition-colors hover:bg-accent/50 ${
                      selectedRow?.id === row.id ? 'bg-accent' : ''
                    }`}
                  >
                    <td className="py-2 pr-2 text-muted-foreground">{row.id}</td>
                    <td className="py-2 pr-2">
                      <span className={`${
                        row.venueSeverity === 'High' ? 'text-red-400' : 
                        row.venueSeverity === 'Med' ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {row.venue}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-foreground">{row.pattern}</td>
                    <td className="py-2 pr-2 text-foreground">{row.expert}</td>
                    <td className="py-2 pr-2 text-foreground">{row.posture}</td>
                    <td className="py-2 pr-2">
                      <span 
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          row.status === 'Terminate' 
                            ? 'bg-red-600 text-white' 
                            : 'bg-zinc-700 text-white'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right text-foreground">{formatCurrency(row.paidToDate)}</td>
                    <td className="py-2 pr-2 text-right text-yellow-500">{formatCurrency(row.overhang)}</td>
                    <td className="py-2 text-right text-foreground">{formatCurrency(row.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <p className="mt-3 text-xs text-muted-foreground">
            Overhang = expert spend + delay + premium attributable to decision.
          </p>
        </Card>

        {/* Side Panel */}
        <Card className="p-4 bg-card border-border">
          <h4 className="font-semibold text-foreground mb-2">Select an item</h4>
          <p className="text-sm text-muted-foreground mb-4">
            {selectedRow ? `Viewing: Row ${selectedRow.id} - ${selectedRow.venue}` : 'Click a line to view total cost impact.'}
          </p>
          
          <div className="mb-4">
            <label className="text-sm font-medium text-foreground mb-2 block">Manager Notes</label>
            <Textarea
              placeholder="Process-based notes only."
              value={managerNotes}
              onChange={(e) => setManagerNotes(e.target.value)}
              className="min-h-[120px] bg-background border-border resize-none"
            />
          </div>

          <div className="flex gap-3">
            <Button 
              variant="secondary"
              className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white"
              disabled={!selectedRow}
              onClick={() => {
                toast({
                  title: "Coaching initiated",
                  description: `Row ${selectedRow?.id} - ${selectedRow?.venue} marked for coaching.`,
                });
                setSelectedRow(null);
                setManagerNotes("");
              }}
            >
              Coach
            </Button>
            <Button 
              variant="destructive"
              className="flex-1"
              disabled={!selectedRow}
              onClick={() => {
                toast({
                  title: "Termination confirmed",
                  description: `Row ${selectedRow?.id} - ${selectedRow?.venue} marked for termination.`,
                  variant: "destructive",
                });
                setSelectedRow(null);
                setManagerNotes("");
              }}
            >
              Terminate
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}