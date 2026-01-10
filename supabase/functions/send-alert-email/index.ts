import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  cc?: string[];
  subject: string;
  body: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, cc = [], subject, body }: EmailRequest = await req.json();

    // Validate inputs
    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "To, subject, and body are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY");
      return new Response(
        JSON.stringify({ 
          error: "Email not configured", 
          details: "Add RESEND_API_KEY to secrets. Get one at resend.com" 
        }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { Resend } = await import("https://esm.sh/resend@2.0.0");
    const resend = new Resend(resendApiKey);

    console.log(`Sending email to ${to}${cc.length ? ` (cc: ${cc.length})` : ''}`);

    // Build HTML email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
        </head>
        <body style="font-family: 'JetBrains Mono', Consolas, monospace; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #000;">
          <div style="background-color: #f59e0b; padding: 16px 20px; border-radius: 4px 4px 0 0;">
            <h1 style="color: #000; margin: 0; font-size: 18px; font-weight: bold; text-transform: uppercase;">⚠️ ${subject}</h1>
          </div>
          <div style="background-color: #111; padding: 24px; border: 1px solid #333; border-top: none; border-radius: 0 0 4px 4px;">
            <pre style="color: #e5e5e5; white-space: pre-wrap; word-wrap: break-word; font-size: 14px; line-height: 1.6; margin: 0; font-family: 'JetBrains Mono', Consolas, monospace;">${body}</pre>
          </div>
          <p style="font-size: 11px; color: #666; text-align: center; margin-top: 16px;">
            FLI Claims Dashboard • Automated Alert
          </p>
        </body>
      </html>
    `;

    const emailOptions: any = {
      // Using Resend test domain - only sends to account owner's email
      // To send to others, verify your domain at resend.com/domains
      from: "FLI Dashboard <onboarding@resend.dev>",
      to: [to],
      subject: `⚠️ ${subject}`,
      html: emailHtml,
    };

    if (cc.length > 0) {
      emailOptions.cc = cc.filter(e => e && e.includes('@'));
    }

    const { data, error } = await resend.emails.send(emailOptions);

    if (error) {
      console.error("Resend error:", error);
      
      // Helpful error for domain issues
      if (error.message?.includes('domain') || error.message?.includes('verify')) {
        return new Response(
          JSON.stringify({ 
            error: "Domain not verified",
            details: "With test domain, emails only go to your Resend account email. Verify a domain at resend.com/domains to send to others."
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: error.message || "Failed to send email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent:", data?.id);

    return new Response(
      JSON.stringify({ success: true, emailId: data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Email function error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
