import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, FileText, MapPin, Calendar } from "lucide-react";
import { OverLimitPaymentDB } from "@/hooks/useOverLimitPaymentsDB";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import jsPDF from "jspdf";

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
  
  // Calculate classification breakdown
  const anomalyCount = claims.filter(c => c.classification === 'Anomaly').length;
  const issueCount = claims.filter(c => c.classification === 'Issue').length;
  const anomalyTotal = claims.filter(c => c.classification === 'Anomaly').reduce((sum, c) => sum + c.over_limit_amount, 0);
  const issueTotal = claims.filter(c => c.classification === 'Issue').reduce((sum, c) => sum + c.over_limit_amount, 0);

  const handleExportExcel = () => {
    try {
      const exportData = claims.map(c => ({
        'Claim Number': c.claim_number,
        'State': c.state,
        'Payment Date': c.payment_date,
        'Coverage': c.coverage || 'BI',
        'Classification': c.classification || 'Issue',
        'Root Cause': c.root_cause || '',
        'Policy Limit': c.policy_limit || 0,
        'Payment Amount': c.payment_amount,
        'Over Limit Amount': c.over_limit_amount,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 18 }, // Claim Number
        { wch: 14 }, // State
        { wch: 12 }, // Payment Date
        { wch: 10 }, // Coverage
        { wch: 12 }, // Classification
        { wch: 35 }, // Root Cause
        { wch: 14 }, // Policy Limit
        { wch: 16 }, // Payment Amount
        { wch: 18 }, // Over Limit Amount
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${state} Over-Limit Claims`);

      // Add summary sheet
      const summaryData = [
        { Metric: 'State', Value: state },
        { Metric: 'Total Claims', Value: claims.length },
        { Metric: 'Total Over-Limit', Value: totalOverLimit },
        { Metric: '', Value: '' },
        { Metric: 'CLASSIFICATION BREAKDOWN', Value: '' },
        { Metric: 'Anomaly Claims', Value: anomalyCount },
        { Metric: 'Anomaly Over-Limit', Value: anomalyTotal },
        { Metric: 'Issue Claims', Value: issueCount },
        { Metric: 'Issue Over-Limit', Value: issueTotal },
        { Metric: '', Value: '' },
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

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      let yPos = margin;

      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(`${state} Over-Limit Claims Report`, margin, yPos);
      yPos += 25;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, margin, yPos);
      yPos += 30;

      // Summary Box
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 80, 5, 5, 'F');
      yPos += 20;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary', margin + 15, yPos);
      yPos += 18;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Two-column summary layout
      const col1X = margin + 15;
      const col2X = pageWidth / 2;
      
      doc.text(`Total Claims: ${claims.length}`, col1X, yPos);
      doc.text(`Total Over-Limit: ${formatCurrency(totalOverLimit)}`, col2X, yPos);
      yPos += 15;
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246); // Blue for Anomaly
      doc.text(`Anomaly: ${anomalyCount} claims (${formatCurrency(anomalyTotal)})`, col1X, yPos);
      
      doc.setTextColor(234, 88, 12); // Orange for Issue
      doc.text(`Issue: ${issueCount} claims (${formatCurrency(issueTotal)})`, col2X, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 40;

      // Table Header
      const colWidths = [100, 70, 70, 140, 80, 90, 90];
      const headers = ['Claim #', 'Date', 'Class', 'Root Cause', 'Limit', 'Payment', 'Over Limit'];
      const startX = margin;
      
      doc.setFillColor(51, 51, 51);
      doc.rect(startX, yPos, pageWidth - 2 * margin, 20, 'F');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      
      let xPos = startX + 5;
      headers.forEach((header, i) => {
        doc.text(header, xPos, yPos + 14);
        xPos += colWidths[i];
      });
      
      doc.setTextColor(0, 0, 0);
      yPos += 25;

      // Table Rows
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      
      claims.forEach((claim, index) => {
        // Check if we need a new page
        if (yPos > pageHeight - 50) {
          doc.addPage();
          yPos = margin;
          
          // Repeat header on new page
          doc.setFillColor(51, 51, 51);
          doc.rect(startX, yPos, pageWidth - 2 * margin, 20, 'F');
          
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          
          xPos = startX + 5;
          headers.forEach((header, i) => {
            doc.text(header, xPos, yPos + 14);
            xPos += colWidths[i];
          });
          
          doc.setTextColor(0, 0, 0);
          yPos += 25;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
        }

        // Alternating row colors
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(startX, yPos - 3, pageWidth - 2 * margin, 16, 'F');
        }

        xPos = startX + 5;
        
        // Claim Number
        doc.text(claim.claim_number || '', xPos, yPos + 10);
        xPos += colWidths[0];
        
        // Date
        doc.text(claim.payment_date || '', xPos, yPos + 10);
        xPos += colWidths[1];
        
        // Classification with color
        if (claim.classification === 'Anomaly') {
          doc.setTextColor(59, 130, 246);
        } else {
          doc.setTextColor(234, 88, 12);
        }
        doc.text(claim.classification || 'Issue', xPos, yPos + 10);
        doc.setTextColor(0, 0, 0);
        xPos += colWidths[2];
        
        // Root Cause (truncated)
        const rootCause = claim.root_cause || '-';
        const truncatedCause = rootCause.length > 22 ? rootCause.substring(0, 22) + '...' : rootCause;
        doc.text(truncatedCause, xPos, yPos + 10);
        xPos += colWidths[3];
        
        // Policy Limit
        doc.text(formatCurrency(claim.policy_limit || 0), xPos, yPos + 10);
        xPos += colWidths[4];
        
        // Payment
        doc.text(formatCurrency(claim.payment_amount), xPos, yPos + 10);
        xPos += colWidths[5];
        
        // Over Limit (red)
        doc.setTextColor(220, 38, 38);
        doc.text(formatCurrency(claim.over_limit_amount), xPos, yPos + 10);
        doc.setTextColor(0, 0, 0);
        
        yPos += 16;
      });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Source: over_limit_payments database | ${claims.length} total claims`, margin, pageHeight - 20);

      const filename = `OverLimit_${state.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
      doc.save(filename);
      toast.success(`Exported ${claims.length} claims to ${filename}`);
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('Failed to export PDF file');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-destructive" />
              <DialogTitle className="text-lg">
                {state} Over-Limit Claims
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="text-xs"
              >
                <FileText className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="text-xs"
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
            <span className="font-medium">{claims.length} claims</span>
            <span className="text-destructive font-semibold">
              {formatCurrency(totalOverLimit)} over-limit
            </span>
            <span className="text-blue-600 dark:text-blue-400">
              Anomaly: {anomalyCount} ({formatCurrency(anomalyTotal)})
            </span>
            <span className="text-orange-600 dark:text-orange-400">
              Issue: {issueCount} ({formatCurrency(issueTotal)})
            </span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto mt-4 border rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-muted z-10">
              <TableRow>
                <TableHead className="text-xs">Claim #</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Classification</TableHead>
                <TableHead className="text-xs">Root Cause</TableHead>
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
                  <TableCell>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      claim.classification === 'Anomaly' 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      {claim.classification || 'Issue'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs max-w-[180px] truncate" title={claim.root_cause || ''}>
                    {claim.root_cause || '-'}
                  </TableCell>
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
