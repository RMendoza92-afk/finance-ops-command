import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, Download, MapPin, Calendar } from "lucide-react";
import { OverLimitPaymentDB } from "@/hooks/useOverLimitPaymentsDB";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { format } from "date-fns";

interface OverLimitDrilldownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: string;
  claims: OverLimitPaymentDB[];
  totalOverLimit: number;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function OverLimitDrilldownModal({
  open,
  onOpenChange,
  state,
  claims,
  totalOverLimit,
}: OverLimitDrilldownModalProps) {
  
  const handleExportExcel = () => {
    try {
      const exportData = claims.map(c => ({
        'Claim Number': c.claim_number,
        'State': c.state,
        'Payment Date': c.payment_date,
        'Coverage': c.coverage || 'BI',
        'Policy Limit': c.policy_limit || 0,
        'Payment Amount': c.payment_amount,
        'Over Limit Amount': c.over_limit_amount,
        'Issue Type': c.issue_type || '',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 18 }, // Claim Number
        { wch: 14 }, // State
        { wch: 12 }, // Payment Date
        { wch: 10 }, // Coverage
        { wch: 14 }, // Policy Limit
        { wch: 16 }, // Payment Amount
        { wch: 18 }, // Over Limit Amount
        { wch: 12 }, // Issue Type
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${state} Over-Limit Claims`);
      
      // Add summary sheet
      const summaryData = [
        { Metric: 'State', Value: state },
        { Metric: 'Total Claims', Value: claims.length },
        { Metric: 'Total Over-Limit', Value: totalOverLimit },
        { Metric: 'Average Over-Limit', Value: claims.length > 0 ? totalOverLimit / claims.length : 0 },
        { Metric: 'Export Date', Value: format(new Date(), 'yyyy-MM-dd HH:mm') },
      ];
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

      const filename = `OverLimit_${state.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Exported ${claims.length} claims to ${filename}`);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export Excel file');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-destructive" />
              <DialogTitle className="text-lg">
                {state} Over-Limit Claims
              </DialogTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="text-xs"
            >
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Export XLS
            </Button>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
            <span className="font-medium">{claims.length} claims</span>
            <span className="text-destructive font-semibold">
              {formatCurrency(totalOverLimit)} over-limit
            </span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto mt-4 border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-muted z-10">
              <TableRow>
                <TableHead className="text-xs">Claim #</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Coverage</TableHead>
                <TableHead className="text-xs text-right">Policy Limit</TableHead>
                <TableHead className="text-xs text-right">Payment</TableHead>
                <TableHead className="text-xs text-right text-destructive">Over Limit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.map((claim, idx) => (
                <TableRow key={claim.id || idx} className="text-xs">
                  <TableCell className="font-mono font-medium">
                    {claim.claim_number}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {claim.payment_date}
                    </div>
                  </TableCell>
                  <TableCell>{claim.coverage || 'BI'}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(claim.policy_limit || 0)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(claim.payment_amount)}
                  </TableCell>
                  <TableCell className="text-right text-destructive font-semibold">
                    {formatCurrency(claim.over_limit_amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex-shrink-0 pt-4 border-t flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            Source: over_limit_payments database
          </span>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
