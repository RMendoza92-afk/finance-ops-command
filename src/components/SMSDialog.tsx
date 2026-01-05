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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Send SMS Alert
          </DialogTitle>
          <DialogDescription>
            Send an urgent SMS notification about this report or claim
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick Export Options */}
          {(onExportPDF || onExportExcel) && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground flex-1">Export first:</span>
              {onExportPDF && (
                <Button variant="outline" size="sm" onClick={onExportPDF} className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </Button>
              )}
              {onExportExcel && (
                <Button variant="outline" size="sm" onClick={onExportExcel} className="gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Excel
                </Button>
              )}
            </div>
          )}

          {/* Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">US numbers only. Include area code.</p>
          </div>

          {/* Message Preview */}
          <div className="space-y-2">
            <Label>Message Preview</Label>
            <div className="p-3 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap max-h-32 overflow-auto border">
              {defaultMessage}
            </div>
          </div>

          {/* Custom Note */}
          <div className="space-y-2">
            <Label htmlFor="customMessage">Add Custom Note (optional)</Label>
            <Textarea
              id="customMessage"
              placeholder="Additional details to include..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSendSMS} disabled={sending} className="gap-2">
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
