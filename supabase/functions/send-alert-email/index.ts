import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertEmailRequest {
  to: string;
  cc?: string[];
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

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${Math.round(amount / 1000)}K`;
  return `$${amount.toLocaleString()}`;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const { Resend } = await import("https://esm.sh/resend@2.0.0");
    const resend = new Resend(resendApiKey);

    const {
      to,
      cc = [],
      matterId,
      claimant,
      exposure,
      reserves,
      painLevel,
      daysOpen,
      phase,
      actionRequired,
      customNote,
    }: AlertEmailRequest = await req.json();

    console.log(`Sending alert email to ${to}${cc.length > 0 ? ` with CC: ${cc.join(', ')}` : ''}`);

    // Build metrics section
    const metricsHtml: string[] = [];
    if (exposure) metricsHtml.push(`<strong>Exposure:</strong> ${formatCurrency(exposure)}`);
    if (reserves) metricsHtml.push(`<strong>Reserves:</strong> ${formatCurrency(reserves)}`);
    if (painLevel) metricsHtml.push(`<strong>Pain Level:</strong> P${painLevel}`);
    if (daysOpen) metricsHtml.push(`<strong>Days Open:</strong> ${daysOpen}`);
    if (phase) metricsHtml.push(`<strong>Phase:</strong> ${phase}`);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>FLI Review Alert</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: #dc2626; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ FLI Review Alert</h1>
          </div>
          
          <div style="background-color: white; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; color: #333;">A matter requires your immediate attention.</p>
            
            <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              ${matterId ? `<h2 style="margin: 0 0 8px 0; color: #dc2626; font-size: 18px;">📋 ${matterId}</h2>` : ''}
              ${claimant ? `<p style="margin: 0; color: #666; font-size: 14px;">👤 Claimant: <strong>${claimant}</strong></p>` : ''}
            </div>
            
            ${metricsHtml.length > 0 ? `
              <div style="background-color: #f8f9fa; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin: 0 0 12px 0; color: #333; font-size: 14px; text-transform: uppercase;">Key Metrics</h3>
                <table style="width: 100%; font-size: 14px;">
                  ${metricsHtml.map(metric => `
                    <tr>
                      <td style="padding: 4px 0; color: #333;">${metric}</td>
                    </tr>
                  `).join('')}
                </table>
              </div>
            ` : ''}
            
            ${actionRequired ? `
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>🎯 Action Required:</strong> ${actionRequired}
                </p>
              </div>
            ` : ''}
            
            ${customNote ? `
              <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #0369a1; font-size: 14px;">
                  <strong>📝 Note:</strong> ${customNote}
                </p>
              </div>
            ` : ''}
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              This is an automated alert from FLI Claims Dashboard.<br>
              Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const emailOptions: any = {
      from: "FLI Claims Dashboard <onboarding@resend.dev>",
      to: [to],
      subject: `⚠️ FLI Alert: ${matterId || 'Review Required'}${actionRequired ? ` - ${actionRequired}` : ''}`,
      html: emailHtml,
    };

    // Add CC if provided
    if (cc.length > 0) {
      emailOptions.cc = cc;
    }

    const { data, error } = await resend.emails.send(emailOptions);

    if (error) {
      console.error("Resend API error:", error);
      throw new Error(error.message || "Failed to send email");
    }

    console.log("Email sent successfully:", data);

    return new Response(
      JSON.stringify({ success: true, emailId: data?.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-alert-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});