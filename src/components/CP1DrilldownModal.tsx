import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

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

  const getSeverityBadge = (severity: string | null) => {
    if (!severity) return null;
    const s = severity.toLowerCase();
    if (s === 'critical' || s === 'high') return <Badge variant="destructive" className="text-xs">{severity}</Badge>;
    if (s === 'medium') return <Badge className="bg-warning text-warning-foreground text-xs">{severity}</Badge>;
    return <Badge variant="secondary" className="text-xs">{severity}</Badge>;
  };

  // Stats for the drilldown header
  const stats = {
    aged365Plus: claims.filter(c => (c.days_open || 0) >= 365).length,
    aged181To365: claims.filter(c => (c.days_open || 0) >= 181 && (c.days_open || 0) < 365).length,
    totalExposure: claims.reduce((sum, c) => sum + (c.total_amount || 0), 0),
    criticalCount: claims.filter(c => c.severity?.toLowerCase() === 'critical' || c.severity?.toLowerCase() === 'high').length,
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
        <div className="grid grid-cols-4 gap-3 py-4 border-b">
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
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">High/Critical</p>
            <p className="text-xl font-bold">{stats.criticalCount}</p>
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
                  <TableHead className="text-xs w-[120px]">Matter ID</TableHead>
                  <TableHead className="text-xs">Claimant</TableHead>
                  <TableHead className="text-xs">Lead</TableHead>
                  <TableHead className="text-xs">Location</TableHead>
                  <TableHead className="text-xs text-right">Age</TableHead>
                  <TableHead className="text-xs text-right">Exposure</TableHead>
                  <TableHead className="text-xs text-center">Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.matter_id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs font-medium">
                      {claim.matter_id}
                    </TableCell>
                    <TableCell className="text-sm max-w-[180px] truncate" title={claim.claimant || ''}>
                      {claim.claimant || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {claim.matter_lead || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {claim.location || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {getAgeBadge(claim.days_open)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {formatCurrency(claim.total_amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getSeverityBadge(claim.severity)}
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
            <span>Showing {claims.length} claims (max 100) • Sorted by age descending</span>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
