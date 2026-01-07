import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, MessageSquare, Mail, Plus, X, AlertCircle, CheckCircle2, FileText, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AlertSendDialogProps {
  open: boolean;
  onClose: () => void;
  context: {
    matterId?: string;
    claimant?: string;
    exposure?: number;
    reserves?: number;
    painLevel?: number;
    daysOpen?: number;
    phase?: string;
    actionRequired?: string;
  };
  onExportPDF?: () => void;
  onExportExcel?: () => void;
}

// Format phone number as user types (US format)
const formatPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (digits.startsWith('1') && digits.length > 1) {
    const phoneDigits = digits.slice(1);
    if (phoneDigits.length <= 3) return `+1 (${phoneDigits}`;
    if (phoneDigits.length <= 6) return `+1 (${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3)}`;
    return `+1 (${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6, 10)}`;
  }
  
  if (digits.length <= 3) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

// Validate phone number
const validatePhone = (value: string): { isValid: boolean; error?: string; cleanNumber?: string } => {
  const digits = value.replace(/\D/g, '');
  
  if (!digits) return { isValid: false, error: 'Phone number is required' };
  if (digits.length < 10) return { isValid: false, error: `Enter ${10 - digits.length} more digit${digits.length === 9 ? '' : 's'}` };
  
  if (digits.length === 10) {
    if (digits[0] === '0' || digits[0] === '1') return { isValid: false, error: 'Invalid area code' };
    return { isValid: true, cleanNumber: `+1${digits}` };
  }
  
  if (digits.length === 11 && digits[0] === '1') {
    if (digits[1] === '0' || digits[1] === '1') return { isValid: false, error: 'Invalid area code' };
    return { isValid: true, cleanNumber: `+${digits}` };
  }
  
  return { isValid: false, error: 'Invalid phone number format' };
};

// Validate email
const validateEmail = (value: string): { isValid: boolean; error?: string } => {
  if (!value.trim()) return { isValid: false, error: 'Email is required' };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value.trim())) return { isValid: false, error: 'Invalid email format' };
  return { isValid: true };
};

export function AlertSendDialog({ open, onClose, context, onExportPDF, onExportExcel }: AlertSendDialogProps) {
  const [activeTab, setActiveTab] = useState<"sms" | "email">("sms");
  
  // SMS State
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([""]);
  const [phoneTouched, setPhoneTouched] = useState<boolean[]>([false]);
  
  // Email State
  const [toEmail, setToEmail] = useState("");
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [emailTouched, setEmailTouched] = useState(false);
  
  // Shared State
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Phone validations
  const phoneValidations = useMemo(() => 
    phoneNumbers.map(phone => validatePhone(phone)), 
    [phoneNumbers]
  );
  
  const allPhonesValid = phoneValidations.every(v => v.isValid);
  
  // Email validation
  const toEmailValidation = useMemo(() => validateEmail(toEmail), [toEmail]);
  const ccEmailValidations = useMemo(() => 
    ccEmails.map(email => email.trim() ? validateEmail(email) : { isValid: true }), 
    [ccEmails]
  );
  const allEmailsValid = toEmailValidation.isValid && ccEmailValidations.every(v => v.isValid);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${Math.round(amount / 1000)}K`;
    return `$${amount.toLocaleString()}`;
  };

  // Build preview message
  let previewMessage = `⚠️ FLI REVIEW ALERT\n\n`;
  if (context.matterId) previewMessage += `📋 ${context.matterId}\n`;
  if (context.claimant) previewMessage += `👤 ${context.claimant}\n`;
  
  const metrics: string[] = [];
  if (context.exposure) metrics.push(`Exp: ${formatCurrency(context.exposure)}`);
  if (context.reserves) metrics.push(`Rsv: ${formatCurrency(context.reserves)}`);
  if (metrics.length > 0) previewMessage += `💰 ${metrics.join(' | ')}\n`;
  
  const status: string[] = [];
  if (context.painLevel) status.push(`P${context.painLevel}`);
  if (context.daysOpen) status.push(`${context.daysOpen}d open`);
  if (context.phase) status.push(context.phase);
  if (status.length > 0) previewMessage += `📊 ${status.join(' • ')}\n`;
  
  if (context.actionRequired) previewMessage += `\n🎯 ${context.actionRequired}\n`;
  if (customMessage) previewMessage += `\n📝 ${customMessage}\n`;
  previewMessage += `\n— FLI Dashboard`;

  // Phone number handlers
  const handlePhoneChange = (index: number, value: string) => {
    const formatted = formatPhoneNumber(value);
    const newPhones = [...phoneNumbers];
    newPhones[index] = formatted;
    setPhoneNumbers(newPhones);
  };

  const handlePhoneBlur = (index: number) => {
    const newTouched = [...phoneTouched];
    newTouched[index] = true;
    setPhoneTouched(newTouched);
  };

  const addPhoneNumber = () => {
    if (phoneNumbers.length < 5) {
      setPhoneNumbers([...phoneNumbers, ""]);
      setPhoneTouched([...phoneTouched, false]);
    }
  };

  const removePhoneNumber = (index: number) => {
    if (phoneNumbers.length > 1) {
      setPhoneNumbers(phoneNumbers.filter((_, i) => i !== index));
      setPhoneTouched(phoneTouched.filter((_, i) => i !== index));
    }
  };

  // CC handlers
  const addCcEmail = () => {
    if (ccEmails.length < 5) {
      setCcEmails([...ccEmails, ""]);
    }
  };

  const removeCcEmail = (index: number) => {
    setCcEmails(ccEmails.filter((_, i) => i !== index));
  };

  const handleCcChange = (index: number, value: string) => {
    const newCc = [...ccEmails];
    newCc[index] = value;
    setCcEmails(newCc);
  };

  // Send SMS
  const handleSendSMS = async () => {
    setPhoneTouched(phoneNumbers.map(() => true));
    
    if (!allPhonesValid) {
      toast.error("Please fix phone number errors");
      return;
    }

    setSending(true);
    try {
      const validNumbers = phoneValidations
        .filter(v => v.isValid && v.cleanNumber)
        .map(v => v.cleanNumber!);

      // Send to all numbers
      const promises = validNumbers.map(phoneNumber =>
        supabase.functions.invoke('send-review-sms', {
          body: {
            to: phoneNumber,
            matterId: context.matterId,
            claimant: context.claimant,
            exposure: context.exposure,
            reserves: context.reserves,
            painLevel: context.painLevel,
            daysOpen: context.daysOpen,
            phase: context.phase,
            actionRequired: context.actionRequired || 'Review flagged file',
            customNote: customMessage || undefined
          }
        })
      );

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      
      if (errors.length === 0) {
        toast.success(`SMS sent to ${validNumbers.length} recipient${validNumbers.length > 1 ? 's' : ''}!`);
        onClose();
      } else if (errors.length < results.length) {
        toast.warning(`Sent to ${results.length - errors.length} of ${results.length} recipients`);
      } else {
        throw new Error("All messages failed");
      }
    } catch (err: any) {
      console.error('SMS error:', err);
      toast.error("Failed to send SMS", { description: err.message });
    } finally {
      setSending(false);
    }
  };

  // Send Email
  const handleSendEmail = async () => {
    setEmailTouched(true);
    
    if (!allEmailsValid) {
      toast.error("Please fix email errors");
      return;
    }

    setSending(true);
    try {
      const validCcs = ccEmails.filter(e => e.trim() && validateEmail(e).isValid);
      
      const { error } = await supabase.functions.invoke('send-alert-email', {
        body: {
          to: toEmail.trim(),
          cc: validCcs,
          matterId: context.matterId,
          claimant: context.claimant,
          exposure: context.exposure,
          reserves: context.reserves,
          painLevel: context.painLevel,
          daysOpen: context.daysOpen,
          phase: context.phase,
          actionRequired: context.actionRequired || 'Review flagged file',
          customNote: customMessage || undefined
        }
      });

      if (error) throw error;

      const recipientCount = 1 + validCcs.length;
      toast.success(`Email sent to ${recipientCount} recipient${recipientCount > 1 ? 's' : ''}!`);
      onClose();
    } catch (err: any) {
      console.error('Email error:', err);
      toast.error("Failed to send email", { description: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Send className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Send Alert
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Notify team members via SMS or Email
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "sms" | "email")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sms" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              SMS
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sms" className="space-y-4 mt-4">
            {/* Phone Numbers */}
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm">Phone Numbers</Label>
              {phoneNumbers.map((phone, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={phone}
                      onChange={(e) => handlePhoneChange(index, e.target.value)}
                      onBlur={() => handlePhoneBlur(index)}
                      className={cn(
                        "font-mono text-sm h-9 pr-9",
                        phoneTouched[index] && !phoneValidations[index].isValid 
                          ? 'border-destructive' 
                          : phoneValidations[index].isValid 
                          ? 'border-green-500' 
                          : ''
                      )}
                    />
                    {phone && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {phoneValidations[index].isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : phoneTouched[index] ? (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        ) : null}
                      </div>
                    )}
                  </div>
                  {phoneNumbers.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => removePhoneNumber(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {phoneTouched.some((t, i) => t && !phoneValidations[i].isValid) && (
                <p className="text-xs text-destructive">
                  {phoneValidations.find((v, i) => phoneTouched[i] && !v.isValid)?.error}
                </p>
              )}
              {phoneNumbers.length < 5 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addPhoneNumber}
                  className="gap-1 h-8 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Add Number
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="email" className="space-y-4 mt-4">
            {/* To Email */}
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">To</Label>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="recipient@example.com"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  className={cn(
                    "text-sm h-9 pr-9",
                    emailTouched && !toEmailValidation.isValid 
                      ? 'border-destructive' 
                      : toEmailValidation.isValid 
                      ? 'border-green-500' 
                      : ''
                  )}
                />
                {toEmail && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {toEmailValidation.isValid ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : emailTouched ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : null}
                  </div>
                )}
              </div>
              {emailTouched && !toEmailValidation.isValid && (
                <p className="text-xs text-destructive">{toEmailValidation.error}</p>
              )}
            </div>

            {/* CC Emails */}
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm">CC (optional)</Label>
              {ccEmails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="cc@example.com"
                    value={email}
                    onChange={(e) => handleCcChange(index, e.target.value)}
                    className={cn(
                      "text-sm h-9 flex-1",
                      email && !ccEmailValidations[index].isValid ? 'border-destructive' : ''
                    )}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => removeCcEmail(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {ccEmails.length < 5 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addCcEmail}
                  className="gap-1 h-8 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Add CC
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Shared: Export Options */}
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

        {/* Message Preview */}
        <div className="space-y-1.5">
          <Label className="text-xs sm:text-sm">Message Preview</Label>
          <div className="p-2 sm:p-3 bg-muted/50 rounded-lg text-xs sm:text-sm whitespace-pre-wrap max-h-24 overflow-auto border font-mono">
            {previewMessage}
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

        <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={sending} className="w-full sm:w-auto h-9">
            Cancel
          </Button>
          <Button 
            onClick={activeTab === "sms" ? handleSendSMS : handleSendEmail} 
            disabled={sending} 
            className="gap-2 w-full sm:w-auto h-9"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                {activeTab === "sms" ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                Send {activeTab === "sms" ? "SMS" : "Email"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}