import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, MessageSquare, FileSpreadsheet, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
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

// Format phone number as user types (US format)
const formatPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  // Handle country code
  if (digits.startsWith('1') && digits.length > 1) {
    const phoneDigits = digits.slice(1);
    if (phoneDigits.length <= 3) return `+1 (${phoneDigits}`;
    if (phoneDigits.length <= 6) return `+1 (${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3)}`;
    return `+1 (${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6, 10)}`;
  }
  
  // US number without country code
  if (digits.length <= 3) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

// Validate phone number and return status
const validatePhone = (value: string): { isValid: boolean; error?: string; cleanNumber?: string } => {
  const digits = value.replace(/\D/g, '');
  
  if (!digits) {
    return { isValid: false, error: 'Phone number is required' };
  }
  
  // Must be 10 digits (US) or 11 digits starting with 1
  if (digits.length < 10) {
    return { isValid: false, error: `Enter ${10 - digits.length} more digit${digits.length === 9 ? '' : 's'}` };
  }
  
  if (digits.length === 10) {
    // Check for invalid area codes (can't start with 0 or 1)
    if (digits[0] === '0' || digits[0] === '1') {
      return { isValid: false, error: 'Invalid area code' };
    }
    return { isValid: true, cleanNumber: `+1${digits}` };
  }
  
  if (digits.length === 11 && digits[0] === '1') {
    // Check for invalid area codes
    if (digits[1] === '0' || digits[1] === '1') {
      return { isValid: false, error: 'Invalid area code' };
    }
    return { isValid: true, cleanNumber: `+${digits}` };
  }
  
  return { isValid: false, error: 'Invalid phone number format' };
};

export function SMSDialog({ open, onClose, context, onExportPDF, onExportExcel }: SMSDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [touched, setTouched] = useState(false);

  const validation = useMemo(() => validatePhone(phoneNumber), [phoneNumber]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

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
    setTouched(true);
    
    if (!validation.isValid || !validation.cleanNumber) {
      toast.error(validation.error || "Please enter a valid phone number");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-review-sms', {
        body: {
          to: validation.cleanNumber,
          claimType: context.claimType || 'General',
          claimCount: context.claimCount || 1,
          region: context.region || 'N/A',
          lossDescription: customMessage || context.description || 'Review required'
        }
      });

      if (error) throw error;

      toast.success("SMS sent successfully!", {
        description: `Message delivered to ${validation.cleanNumber}`
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
            <div className="relative">
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={phoneNumber}
                onChange={handlePhoneChange}
                onBlur={() => setTouched(true)}
                className={`font-mono text-sm h-9 pr-9 ${
                  touched && !validation.isValid 
                    ? 'border-destructive focus-visible:ring-destructive' 
                    : validation.isValid 
                    ? 'border-green-500 focus-visible:ring-green-500' 
                    : ''
                }`}
              />
              {phoneNumber && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {validation.isValid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : touched ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : null}
                </div>
              )}
            </div>
            {touched && !validation.isValid && validation.error ? (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {validation.error}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">US numbers only (10 digits)</p>
            )}
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
