import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, MessageSquare, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

interface SMSDialogProps {
  open: boolean;
  onClose: () => void;
  context: {
    claimType?: string;
    claimCount?: number;
    region?: string;
    matterId?: string;
    exposure?: number;
    description?: string;
  };
  onExportPDF?: () => void;
  onExportExcel?: () => void;
}

export function SMSDialog({ open, onClose, context, onExportPDF, onExportExcel }: SMSDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  const defaultMessage = `🚨 FILE REVIEW REQUESTED\n\n` +
    (context.region ? `Region: ${context.region}\n` : '') +
    (context.claimType ? `Claim Type: ${context.claimType}\n` : '') +
    (context.matterId ? `Matter ID: ${context.matterId}\n` : '') +
    (context.exposure ? `Exposure: ${formatCurrency(context.exposure)}\n` : '') +
    (context.claimCount ? `Claims: ${context.claimCount}\n` : '') +
    (context.description ? `Notes: ${context.description}\n` : '') +
    `\nAction needed: Review flagged inventory ASAP.\n` +
    `— FLI Claims Dashboard`;

  const handleSendSMS = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    // Basic phone validation
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-review-sms', {
        body: {
          to: cleanPhone,
          claimType: context.claimType || 'General',
          claimCount: context.claimCount || 1,
          region: context.region || 'N/A',
          lossDescription: customMessage || context.description || 'Review required'
        }
      });

      if (error) throw error;

      toast.success("SMS sent successfully!", {
        description: `Message delivered to ${cleanPhone}`
      });
      onClose();
    } catch (err: any) {
      console.error('SMS error:', err);
      toast.error("Failed to send SMS", {
        description: err.message || "Please try again"
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Send SMS Alert
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Send an urgent SMS notification about this report
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
          {/* Quick Export Options */}
          {(onExportPDF || onExportExcel) && (
            <div className="flex flex-wrap items-center gap-2 p-2 sm:p-3 bg-muted/50 rounded-lg">
              <span className="text-xs sm:text-sm text-muted-foreground flex-1">Export first:</span>
              {onExportPDF && (
                <Button variant="outline" size="sm" onClick={onExportPDF} className="gap-1 h-8 text-xs">
                  <FileText className="h-3 w-3" />
                  PDF
                </Button>
              )}
              {onExportExcel && (
                <Button variant="outline" size="sm" onClick={onExportExcel} className="gap-1 h-8 text-xs">
                  <FileSpreadsheet className="h-3 w-3" />
                  Excel
                </Button>
              )}
            </div>
          )}

          {/* Phone Number */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs sm:text-sm">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="font-mono text-sm h-9"
            />
            <p className="text-xs text-muted-foreground">US numbers only</p>
          </div>

          {/* Message Preview */}
          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm">Message Preview</Label>
            <div className="p-2 sm:p-3 bg-muted/50 rounded-lg text-xs sm:text-sm whitespace-pre-wrap max-h-24 sm:max-h-32 overflow-auto border">
              {defaultMessage}
            </div>
          </div>

          {/* Custom Note */}
          <div className="space-y-1.5">
            <Label htmlFor="customMessage" className="text-xs sm:text-sm">Add Note (optional)</Label>
            <Textarea
              id="customMessage"
              placeholder="Additional details..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={sending} className="w-full sm:w-auto h-9">
            Cancel
          </Button>
          <Button onClick={handleSendSMS} disabled={sending} className="gap-2 w-full sm:w-auto h-9">
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send SMS
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
