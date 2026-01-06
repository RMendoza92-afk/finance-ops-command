import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Clock, Flame, Download, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  calculateExecutiveReview, 
  estimateClaimAge, 
  getLitigationStage,
  ExecutiveReviewResult 
} from "@/lib/executiveReview";
import { SMSDialog } from "./SMSDialog";

interface CP1Claim {
  matter_id: string;
  claimant: string | null;
  type: string | null;
  status: string | null;
  days_open: number | null;
  total_amount: number | null;
  severity: string | null;
  matter_lead: string | null;
  location: string | null;
  filing_date: string | null;
}

interface ClaimWithReview extends CP1Claim {
  executiveReview: ExecutiveReviewResult;
  claimAge: number;
}

interface CP1DrilldownModalProps {
  open: boolean;
  onClose: () => void;
  coverage: string;
  coverageData: {
    noCP: number;
    yes: number;
    total: number;
    cp1Rate: number;
  };
}

export function CP1DrilldownModal({ open, onClose, coverage, coverageData }: CP1DrilldownModalProps) {
  const [claims, setClaims] = useState<CP1Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [selectedClaimForSMS, setSelectedClaimForSMS] = useState<ClaimWithReview | null>(null);
  useEffect(() => {
    if (open && coverage) {
      fetchClaims();
    }
  }, [open, coverage]);

  const fetchClaims = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch claims from litigation_matters where type matches coverage
      const { data, error: fetchError } = await supabase
        .from('litigation_matters')
        .select('matter_id, claimant, type, status, days_open, total_amount, severity, matter_lead, location, filing_date')
        .eq('type', coverage)
        .eq('status', 'Open')
        .order('days_open', { ascending: false })
        .limit(100);

      if (fetchError) {
        console.error('Error fetching CP1 claims:', fetchError);
        setError('Failed to load claims');
        return;
      }

      setClaims(data || []);
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load claims');
    } finally {
      setLoading(false);
    }
  };

  // Calculate executive review for each claim
  const claimsWithReview = useMemo<ClaimWithReview[]>(() => {
    return claims.map(claim => {
      // Extract prefix from matter_id (e.g., "78" from "78-12345")
      const prefix = claim.matter_id.split('-')[0] || '';
      const claimAge = estimateClaimAge(prefix, claim.filing_date || undefined);
      
      // Convert days_open to pain level estimate (rough mapping)
      const painLvl = claim.days_open ? Math.min(10, Math.floor((claim.days_open || 0) / 60) + 1) : 1;
      const stage = getLitigationStage(painLvl);
      
      // Calculate executive review - using available data
      const executiveReview = calculateExecutiveReview(
        claimAge,
        stage,
        0, // expertSpend - not available in this context
        claim.total_amount || 0, // use total_amount as reactive proxy
        0, // painEscalation
        painLvl,
        claim.severity || ''
      );
      
      return {
        ...claim,
        executiveReview,
        claimAge
      };
    }).sort((a, b) => b.executiveReview.score - a.executiveReview.score);
  }, [claims]);

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  const getAgeBadge = (days: number | null) => {
    if (!days) return <Badge variant="secondary" className="text-xs">Unknown</Badge>;
    if (days >= 365) return <Badge variant="destructive" className="text-xs">{days}d</Badge>;
    if (days >= 181) return <Badge className="bg-warning text-warning-foreground text-xs">{days}d</Badge>;
    return <Badge variant="secondary" className="text-xs">{days}d</Badge>;
  };

  // Stats for the drilldown header
  const stats = {
    aged365Plus: claims.filter(c => (c.days_open || 0) >= 365).length,
    aged181To365: claims.filter(c => (c.days_open || 0) >= 181 && (c.days_open || 0) < 365).length,
    totalExposure: claims.reduce((sum, c) => sum + (c.total_amount || 0), 0),
    criticalCount: claimsWithReview.filter(c => c.executiveReview.level === 'CRITICAL').length,
    requiredCount: claimsWithReview.filter(c => c.executiveReview.level === 'REQUIRED').length,
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="flex items-center gap-3">
            <span className="text-xl font-bold">{coverage} Coverage</span>
            <Badge className="text-sm">{coverageData.cp1Rate}% CP1 Rate</Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {coverageData.yes.toLocaleString()} CP1 claims of {coverageData.total.toLocaleString()} total
          </p>
        </DialogHeader>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-5 gap-3 py-4 border-b">
          <div className="bg-destructive/10 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">🔥 CRITICAL</p>
            <p className="text-xl font-bold text-destructive">{stats.criticalCount}</p>
          </div>
          <div className="bg-amber-500/10 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">⚠️ REQUIRED</p>
            <p className="text-xl font-bold text-amber-600">{stats.requiredCount}</p>
          </div>
          <div className="bg-destructive/10 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">365+ Days</p>
            <p className="text-xl font-bold text-destructive">{stats.aged365Plus}</p>
          </div>
          <div className="bg-warning/10 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">181-365 Days</p>
            <p className="text-xl font-bold text-warning">{stats.aged181To365}</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Exposure</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(stats.totalExposure)}</p>
          </div>
        </div>

        {/* Claims Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading claims...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={fetchClaims}>
                Retry
              </Button>
            </div>
          ) : claims.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-8 w-8 mb-2" />
              <p>No open claims found for {coverage} coverage</p>
              <p className="text-xs mt-1">Claims may be closed or data not yet synced</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="text-xs w-[80px]">Review</TableHead>
                  <TableHead className="text-xs w-[120px]">Matter ID</TableHead>
                  <TableHead className="text-xs">Claimant</TableHead>
                  <TableHead className="text-xs">Lead</TableHead>
                  <TableHead className="text-xs text-right">Age</TableHead>
                  <TableHead className="text-xs text-right">Exposure</TableHead>
                  <TableHead className="text-xs">Reasons</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claimsWithReview.map((claim) => (
                  <TableRow 
                    key={claim.matter_id} 
                    className={`hover:bg-muted/50 cursor-pointer ${
                      claim.executiveReview.level === 'CRITICAL' ? 'bg-destructive/5' : 
                      claim.executiveReview.level === 'REQUIRED' ? 'bg-amber-500/5' : ''
                    }`}
                    onDoubleClick={() => {
                      setSelectedClaimForSMS(claim);
                      setSmsDialogOpen(true);
                    }}
                    title="Double-click to send SMS alert"
                  >
                    <TableCell>
                      {claim.executiveReview.level !== 'NONE' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`flex items-center gap-1.5 cursor-help px-2 py-1 rounded-md ${
                                claim.executiveReview.level === 'CRITICAL' 
                                  ? 'bg-destructive/10 text-destructive' 
                                  : 'bg-amber-500/10 text-amber-600'
                              }`}>
                                <Flame className="h-3 w-3" />
                                <span className="text-xs font-bold">{claim.executiveReview.score}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs p-3 text-xs">
                              <p className="font-bold mb-2 text-foreground">
                                {claim.executiveReview.level} - Score: {claim.executiveReview.score}
                              </p>
                              <div className="space-y-1 text-muted-foreground">
                                {claim.executiveReview.reasons.map((r, i) => (
                                  <p key={i}>• {r}</p>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {(claim.executiveReview.level === 'NONE' || claim.executiveReview.level === 'WATCH') && (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium">
                      {claim.matter_id}
                    </TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate" title={claim.claimant || ''}>
                      {claim.claimant || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {claim.matter_lead || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {getAgeBadge(claim.days_open)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {formatCurrency(claim.total_amount)}
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground max-w-[200px]">
                      {claim.executiveReview.reasons.length > 0 ? (
                        <span className="truncate block" title={claim.executiveReview.reasons.join(' • ')}>
                          {claim.executiveReview.reasons.slice(0, 2).join(' • ')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer */}
        {claims.length > 0 && (
          <div className="pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {claimsWithReview.length} claims • Double-click row to send SMS</span>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setSelectedClaimForSMS(null);
                  setSmsDialogOpen(true);
                }}
                className="gap-1.5"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Send SMS
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const exportData = claimsWithReview.map(c => ({
                    'Matter ID': c.matter_id,
                    'Review Level': c.executiveReview.level,
                    'Score': c.executiveReview.score,
                    'Claimant': c.claimant || '',
                    'Lead': c.matter_lead || '',
                    'Location': c.location || '',
                    'Days Open': c.days_open || 0,
                    'Claim Age (Years)': c.claimAge,
                    'Exposure': c.total_amount || 0,
                    'Severity': c.severity || '',
                    'Filing Date': c.filing_date || '',
                    'Reasons': c.executiveReview.reasons.join(' | '),
                  }));
                  
                  const ws = XLSX.utils.json_to_sheet(exportData);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, `${coverage} Claims`);
                  
                  // Set column widths
                  ws['!cols'] = [
                    { wch: 15 }, { wch: 12 }, { wch: 8 }, { wch: 25 }, 
                    { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 14 },
                    { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 50 }
                  ];
                  
                  XLSX.writeFile(wb, `CP1_${coverage}_Executive_Review_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
                }}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Export Excel
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}

        {/* SMS Dialog */}
        <SMSDialog
          open={smsDialogOpen}
          onClose={() => {
            setSmsDialogOpen(false);
            setSelectedClaimForSMS(null);
          }}
          context={selectedClaimForSMS ? {
            matterId: selectedClaimForSMS.matter_id,
            claimant: selectedClaimForSMS.claimant || undefined,
            exposure: selectedClaimForSMS.total_amount || 0,
            daysOpen: selectedClaimForSMS.days_open || undefined,
            phase: selectedClaimForSMS.type || undefined,
            actionRequired: selectedClaimForSMS.executiveReview.reasons[0] || 'Executive review required',
          } : {
            actionRequired: `${stats.criticalCount} CRITICAL, ${stats.requiredCount} REQUIRED reviews`,
          }}
          onExportExcel={() => {
            const exportData = claimsWithReview.map(c => ({
              'Matter ID': c.matter_id,
              'Review Level': c.executiveReview.level,
              'Score': c.executiveReview.score,
              'Claimant': c.claimant || '',
              'Lead': c.matter_lead || '',
              'Location': c.location || '',
              'Days Open': c.days_open || 0,
              'Exposure': c.total_amount || 0,
              'Reasons': c.executiveReview.reasons.join(' | '),
            }));
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `${coverage} Claims`);
            XLSX.writeFile(wb, `CP1_${coverage}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
