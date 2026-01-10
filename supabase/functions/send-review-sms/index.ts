import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMSRequest {
  to: string;
  message: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, message }: SMSRequest = await req.json();
    
    // Validate inputs
    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "Phone number and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    // Check credentials
    if (!accountSid || !authToken || !twilioPhone) {
      console.error("Missing Twilio credentials");
      return new Response(
        JSON.stringify({ 
          error: "SMS not configured", 
          details: "Twilio credentials missing. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to secrets." 
        }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate phone number format (basic check)
    const cleanTo = to.replace(/\D/g, '');
    if (cleanTo.length < 10 || cleanTo.length > 15) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const formattedTo = to.startsWith("+") ? to : `+1${cleanTo}`;
    
    // Validate sender
    const senderRaw = twilioPhone.trim();
    const isMessagingServiceSid = /^MG[a-fA-F0-9]{32}$/.test(senderRaw);
    const formattedFrom = senderRaw.startsWith("+") ? senderRaw : `+1${senderRaw.replace(/\D/g, '')}`;

    console.log(`Sending SMS to ${formattedTo.slice(0, 6)}...`);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const params: Record<string, string> = {
      To: formattedTo,
      Body: message.slice(0, 1600), // Twilio limit
    };

    if (isMessagingServiceSid) {
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
      console.error("Twilio error:", result);
      return new Response(
        JSON.stringify({ 
          error: result.message || "Twilio API error",
          code: result.code
        }),
        { status: response.status, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("SMS sent:", result.sid);

    return new Response(
      JSON.stringify({ success: true, messageSid: result.sid }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("SMS function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send SMS" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
