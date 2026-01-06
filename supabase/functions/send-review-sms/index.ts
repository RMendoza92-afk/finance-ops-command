import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClaimData {
  claim_id: string;
  area: string;
  reserves: number;
  age_bucket: string;
  loss_description: string;
}

interface SMSRequest {
  to: string;
  matterId?: string;
  claimant?: string;
  exposure?: number;
  reserves?: number;
  painLevel?: number;
  daysOpen?: number;
  phase?: string;
  actionRequired?: string;
  customNote?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      to, 
      matterId,
      claimant,
      exposure,
      reserves,
      painLevel,
      daysOpen,
      phase,
      actionRequired,
      customNote
    }: SMSRequest = await req.json();
    
    console.log(`Sending SMS to ${to} for matter ${matterId || 'N/A'}`);

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !twilioPhone) {
      console.error("Missing Twilio credentials");
      throw new Error("Twilio credentials not configured");
    }

    // Format currency for SMS
    const formatCurrency = (amt: number): string => {
      if (amt >= 1000000) return `$${(amt / 1000000).toFixed(1)}M`;
      if (amt >= 1000) return `$${Math.round(amt / 1000)}K`;
      return `$${amt.toLocaleString()}`;
    };

    // Build concise, actionable SMS message
    let message = `⚠️ FLI REVIEW ALERT\n\n`;
    
    if (matterId) {
      message += `📋 ${matterId}\n`;
    }
    
    if (claimant) {
      message += `👤 ${claimant}\n`;
    }
    
    // Key metrics on one line
    const metrics: string[] = [];
    if (exposure) metrics.push(`Exp: ${formatCurrency(exposure)}`);
    if (reserves) metrics.push(`Rsv: ${formatCurrency(reserves)}`);
    if (metrics.length > 0) {
      message += `💰 ${metrics.join(' | ')}\n`;
    }
    
    // Status indicators
    const status: string[] = [];
    if (painLevel) status.push(`P${painLevel}`);
    if (daysOpen) status.push(`${daysOpen}d open`);
    if (phase) status.push(phase);
    if (status.length > 0) {
      message += `📊 ${status.join(' • ')}\n`;
    }
    
    // Action required
    if (actionRequired) {
      message += `\n🎯 ${actionRequired}\n`;
    }
    
    // Custom note
    if (customNote) {
      message += `\n📝 ${customNote}\n`;
    }
    
    message += `\n— FLI Dashboard`;

    // Ensure message doesn't exceed SMS limits (will be split automatically by Twilio)
    if (message.length > 1600) {
      message = message.substring(0, 1597) + '...';
    }

    // Format phone numbers (ensure they have country code)
    const formattedTo = to.startsWith("+") ? to : `+1${to}`;

    // Validate configured sender: either an E.164 phone number (+1555...) OR a Twilio Messaging Service SID (MG...)
    const isE164 = (v: string) => /^\+\d{10,15}$/.test(v);
    const isMessagingServiceSid = (v: string) => /^MG[a-fA-F0-9]{32}$/.test(v);

    const senderRaw = (twilioPhone || "").trim();
    const senderLooksLikeSid = senderRaw.startsWith("AC") || senderRaw.startsWith("SK");

    if (!senderRaw) {
      throw new Error("TWILIO_PHONE_NUMBER is missing. Set it to an E.164 phone number like +15551234567 (or a Messaging Service SID starting with MG...).");
    }

    if (senderLooksLikeSid) {
      const masked = `${senderRaw.slice(0, 2)}…${senderRaw.slice(-6)}`;
      throw new Error(
        `TWILIO_PHONE_NUMBER is invalid (looks like an account/API SID: ${masked}). Set it to your Twilio phone number in E.164 format (e.g., +15551234567) or a Messaging Service SID (MG...).`
      );
    }

    const senderIsMessagingService = isMessagingServiceSid(senderRaw);
    const formattedFrom = senderRaw.startsWith("+") ? senderRaw : `+1${senderRaw}`;

    if (!senderIsMessagingService && !isE164(formattedFrom)) {
      const masked = `${senderRaw.slice(0, 3)}…${senderRaw.slice(-2)}`;
      throw new Error(
        `TWILIO_PHONE_NUMBER must be a valid E.164 phone number (+1555...) or Messaging Service SID (MG...). Current: ${masked}`
      );
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const params: Record<string, string> = {
      To: formattedTo,
      Body: message,
    };

    if (senderIsMessagingService) {
      params.MessagingServiceSid = senderRaw;
    } else {
      params.From = formattedFrom;
    }

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error("Twilio API error:", result);
      throw new Error(result.message || "Failed to send SMS");
    }

    console.log("SMS sent successfully:", result.sid);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: result.sid
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-review-sms function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
