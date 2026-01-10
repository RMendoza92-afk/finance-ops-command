import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, MessageSquare, Mail, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

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
  };
}

const formatCurrency = (amount: number) => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${Math.round(amount / 1000)}K`;
  return `$${amount.toLocaleString()}`;
};

export function AlertSendDialog({ open, onClose, context }: AlertSendDialogProps) {
  const [activeTab, setActiveTab] = useState<"sms" | "email">("sms");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  // Build message from context
  const buildMessage = () => {
    let msg = "⚠️ FLI ALERT\n";
    if (context.matterId) msg += `\n📋 ${context.matterId}`;
    if (context.claimant) msg += `\n👤 ${context.claimant}`;
    
    const metrics = [];
    if (context.exposure) metrics.push(`Exp: ${formatCurrency(context.exposure)}`);
    if (context.reserves) metrics.push(`Rsv: ${formatCurrency(context.reserves)}`);
    if (metrics.length) msg += `\n💰 ${metrics.join(' | ')}`;
    
    const status = [];
    if (context.painLevel) status.push(`P${context.painLevel}`);
    if (context.daysOpen) status.push(`${context.daysOpen}d`);
    if (context.phase) status.push(context.phase);
    if (status.length) msg += `\n📊 ${status.join(' • ')}`;
    
    if (note.trim()) msg += `\n\n📝 ${note.trim()}`;
    msg += "\n\n— FLI Dashboard";
    
    return msg;
  };

  // Format phone as user types
  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) {
      setPhone(digits);
    } else if (digits.length <= 6) {
      setPhone(`(${digits.slice(0, 3)}) ${digits.slice(3)}`);
    } else {
      setPhone(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`);
    }
  };

  const handleSendSMS = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      toast.error("Enter a valid 10-digit phone number");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-review-sms', {
        body: { to: `+1${digits}`, message: buildMessage() }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.details || data.error);

      toast.success("SMS sent!");
      onClose();
    } catch (err: any) {
      console.error('SMS error:', err);
      toast.error("SMS failed", { description: err.message });
    } finally {
      setSending(false);
    }
  };

  const handleSendEmail = async () => {
    if (!email.includes('@')) {
      toast.error("Enter a valid email address");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-alert-email', {
        body: { 
          to: email.trim(),
          subject: context.matterId ? `Alert: ${context.matterId}` : 'FLI Alert',
          body: buildMessage()
        }
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.details || data.error);

      toast.success("Email sent!");
      onClose();
    } catch (err: any) {
      console.error('Email error:', err);
      toast.error("Email failed", { description: err.message });
    } finally {
      setSending(false);
    }
  };

  const message = buildMessage();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Send Alert
          </DialogTitle>
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

          <TabsContent value="sms" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">US numbers only</p>
            </div>
          </TabsContent>

          <TabsContent value="email" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="recipient@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="flex items-start gap-2 p-2 bg-warning/10 rounded text-xs text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Test domain only sends to Resend account owner. Verify a domain for other recipients.</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label>Add Note (optional)</Label>
          <Textarea
            placeholder="Additional details..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground">Preview</Label>
          <div className="p-3 bg-muted/50 rounded border text-xs font-mono whitespace-pre-wrap max-h-32 overflow-auto">
            {message}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button 
            onClick={activeTab === "sms" ? handleSendSMS : handleSendEmail} 
            disabled={sending || (activeTab === "sms" ? !phone : !email)}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : activeTab === "sms" ? (
              <MessageSquare className="h-4 w-4 mr-2" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            {sending ? "Sending..." : `Send ${activeTab.toUpperCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
