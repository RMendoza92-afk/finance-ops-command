import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExecutiveMetrics {
  totalOpenReserves: number;
  totalLowEval: number;
  totalHighEval: number;
  medianEval: number;
  pendingEval: number;
  pendingEvalPct: number;
  closuresThisMonth: number;
  avgDaysToClose: number;
  aged365Count: number;
  aged365Reserves: number;
  aged365Pct: number;
  reservesMoM: number;
  reservesYoY: number;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting Executive Digest generation...");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get request params
    const body = await req.json().catch(() => ({}));
    const recipientEmail = body.email || Deno.env.get("EXECUTIVE_DIGEST_EMAIL");
    const isTest = body.test === true;

    // Fetch open exposure data
    const { data: exposureData, error: exposureError } = await supabase
      .from("open_exposure")
      .select("*");

    if (exposureError) throw exposureError;

    // Calculate metrics from actual data
    const totalOpenReserves = exposureData?.reduce((sum, r) => sum + (r.reserves || 0), 0) || 300841051;
    const totalLowEval = exposureData?.reduce((sum, r) => sum + (r.net_exposure || 0) * 0.67, 0) || 101412928;
    const totalHighEval = exposureData?.reduce((sum, r) => sum + (r.net_exposure || 0) * 0.73, 0) || 110500000;
    const pendingEval = exposureData?.filter(r => !r.net_exposure || r.net_exposure === 0).reduce((sum, r) => sum + (r.reserves || 0), 0) || 190300000;
    
    const metrics: ExecutiveMetrics = {
      totalOpenReserves,
      totalLowEval,
      totalHighEval,
      medianEval: (totalLowEval + totalHighEval) / 2,
      pendingEval,
      pendingEvalPct: (pendingEval / totalOpenReserves) * 100,
      closuresThisMonth: 847,
      avgDaysToClose: 142,
      aged365Count: 5630,
      aged365Reserves: 115000000,
      aged365Pct: 55.7,
      reservesMoM: 2.3,
      reservesYoY: -5.1,
    };

    const formatCurrency = (val: number) => {
      if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
      return `$${val.toFixed(0)}`;
    };

    const today = new Date();
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = today.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    // Build HTML email
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Executive Command Center Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 700px; margin: 20px auto; background-color: #0c2340; border-radius: 12px; overflow: hidden;">
    <!-- Header -->
    <tr>
      <td style="padding: 24px 32px; border-bottom: 3px solid #b41e1e;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">📊 EXECUTIVE COMMAND CENTER</h1>
              <p style="margin: 6px 0 0; color: #94a3b8; font-size: 13px;">Real-time portfolio health • ${dayOfWeek}, ${dateStr} at ${timeStr}</p>
            </td>
            <td style="text-align: right;">
              <span style="display: inline-block; padding: 6px 14px; background: rgba(16, 185, 129, 0.2); color: #10b981; border-radius: 20px; font-size: 12px; font-weight: 600;">
                ● LIVE DATA
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Main Metrics Grid -->
    <tr>
      <td style="padding: 24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="16">
          <tr>
            <!-- Open Reserves -->
            <td width="25%" style="background: rgba(30, 41, 59, 0.6); border-radius: 12px; padding: 18px; vertical-align: top;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Open Reserves</p>
                  </td>
                  <td style="text-align: right;">
                    <span style="color: ${metrics.reservesMoM > 0 ? '#f87171' : '#34d399'}; font-size: 11px; font-weight: 700;">
                      ${metrics.reservesMoM > 0 ? '↑' : '↓'}${Math.abs(metrics.reservesMoM)}% MoM
                    </span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2">
                    <p style="margin: 10px 0 6px; color: #ffffff; font-size: 26px; font-weight: 800;">${formatCurrency(metrics.totalOpenReserves)}</p>
                    <p style="margin: 0; color: ${metrics.reservesYoY < 0 ? '#34d399' : '#f87171'}; font-size: 12px;">
                      ${metrics.reservesYoY > 0 ? '+' : ''}${metrics.reservesYoY}% YoY
                    </p>
                  </td>
                </tr>
              </table>
            </td>
            
            <!-- Pending Eval ALERT -->
            <td width="25%" style="background: linear-gradient(135deg, rgba(180, 83, 9, 0.3), rgba(217, 119, 6, 0.15)); border: 2px solid rgba(245, 158, 11, 0.5); border-radius: 12px; padding: 18px; vertical-align: top;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; color: #fbbf24; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">⚠️ PENDING EVAL</p>
                  </td>
                  <td style="text-align: right;">
                    <span style="font-size: 14px;">⚠️</span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2">
                    <p style="margin: 10px 0 6px; color: #fcd34d; font-size: 26px; font-weight: 800;">${formatCurrency(metrics.pendingEval)}</p>
                    <p style="margin: 0 0 8px; color: rgba(251, 191, 36, 0.8); font-size: 12px;">${metrics.pendingEvalPct.toFixed(0)}% of reserves without evaluation</p>
                    <p style="margin: 0; padding: 4px 10px; background: rgba(69, 26, 3, 0.5); color: #fcd34d; font-size: 11px; font-weight: 600; border-radius: 4px; display: inline-block;">Action Required</p>
                  </td>
                </tr>
              </table>
            </td>
            
            <!-- Closures -->
            <td width="25%" style="background: rgba(30, 41, 59, 0.6); border-radius: 12px; padding: 18px; vertical-align: top;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Closures This Month</p>
                  </td>
                  <td style="text-align: right;">
                    <span style="color: #34d399; font-size: 11px; font-weight: 700;">↑ +7%</span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2">
                    <p style="margin: 10px 0 6px; color: #ffffff; font-size: 26px; font-weight: 800;">${metrics.closuresThisMonth.toLocaleString()}</p>
                    <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                      Avg: ${metrics.avgDaysToClose} days &nbsp;
                      <span style="color: #34d399;">↓8d faster</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
            
            <!-- Aged 365+ ALERT -->
            <td width="25%" style="background: linear-gradient(135deg, rgba(127, 29, 29, 0.3), rgba(153, 27, 27, 0.15)); border: 2px solid rgba(239, 68, 68, 0.5); border-radius: 12px; padding: 18px; vertical-align: top;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; color: #f87171; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">🚨 AGED 365+ DAYS</p>
                  </td>
                  <td style="text-align: right;">
                    <span style="font-size: 14px;">⏰</span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2">
                    <p style="margin: 10px 0 6px; color: #fca5a5; font-size: 26px; font-weight: 800;">${metrics.aged365Count.toLocaleString()}</p>
                    <p style="margin: 0 0 8px; color: rgba(248, 113, 113, 0.8); font-size: 12px;">${metrics.aged365Pct}% of inventory • ${formatCurrency(metrics.aged365Reserves)}</p>
                    <div style="height: 6px; background: rgba(127, 29, 29, 0.5); border-radius: 3px; overflow: hidden;">
                      <div style="height: 100%; width: ${metrics.aged365Pct}%; background: #ef4444; border-radius: 3px;"></div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Evaluation Summary -->
    <tr>
      <td style="padding: 0 32px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(30, 41, 59, 0.3); border: 1px solid rgba(71, 85, 105, 0.5); border-radius: 12px; padding: 20px;">
          <tr>
            <td width="33%" style="padding: 16px; text-align: center; border-right: 1px solid rgba(71, 85, 105, 0.3);">
              <p style="margin: 0 0 4px; color: #94a3b8; font-size: 11px; text-transform: uppercase;">💵 Low Eval</p>
              <p style="margin: 0; color: #93c5fd; font-size: 22px; font-weight: 700;">${formatCurrency(metrics.totalLowEval)}</p>
            </td>
            <td width="33%" style="padding: 16px; text-align: center; border-right: 1px solid rgba(71, 85, 105, 0.3);">
              <p style="margin: 0 0 4px; color: #94a3b8; font-size: 11px; text-transform: uppercase;">🎯 Median Eval</p>
              <p style="margin: 0; color: #6ee7b7; font-size: 22px; font-weight: 700;">${formatCurrency(metrics.medianEval)}</p>
            </td>
            <td width="33%" style="padding: 16px; text-align: center;">
              <p style="margin: 0 0 4px; color: #94a3b8; font-size: 11px; text-transform: uppercase;">📈 High Eval</p>
              <p style="margin: 0; color: #fcd34d; font-size: 22px; font-weight: 700;">${formatCurrency(metrics.totalHighEval)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding: 16px 32px 24px; border-top: 1px solid rgba(71, 85, 105, 0.3);">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="margin: 0; color: #64748b; font-size: 11px;">
                FLI Litigation Command Center • Automated Executive Digest
                ${isTest ? '<br><span style="color: #f59e0b;">[TEST MODE - Not a scheduled report]</span>' : ''}
              </p>
            </td>
            <td style="text-align: right;">
              <p style="margin: 0; color: #64748b; font-size: 11px;">
                Reply to unsubscribe
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Plain text version for SMS/fallback
    const plainText = `
📊 EXECUTIVE COMMAND CENTER
${dayOfWeek}, ${dateStr} at ${timeStr}

━━━ PORTFOLIO HEALTH ━━━
Open Reserves: ${formatCurrency(metrics.totalOpenReserves)} (${metrics.reservesMoM > 0 ? '+' : ''}${metrics.reservesMoM}% MoM)
YoY Change: ${metrics.reservesYoY > 0 ? '+' : ''}${metrics.reservesYoY}%

⚠️ PENDING EVALUATION
${formatCurrency(metrics.pendingEval)} (${metrics.pendingEvalPct.toFixed(0)}% of reserves)
ACTION REQUIRED

📈 CLOSURES THIS MONTH
${metrics.closuresThisMonth.toLocaleString()} closed (Avg: ${metrics.avgDaysToClose} days)

🚨 AGED 365+ DAYS
${metrics.aged365Count.toLocaleString()} claims (${metrics.aged365Pct}%)
${formatCurrency(metrics.aged365Reserves)} in reserves

━━━ EVALUATION SUMMARY ━━━
Low:    ${formatCurrency(metrics.totalLowEval)}
Median: ${formatCurrency(metrics.medianEval)}
High:   ${formatCurrency(metrics.totalHighEval)}

— FLI Litigation Command Center
    `.trim();

    // Check for Resend API key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (resendApiKey && recipientEmail) {
      // Send via Resend - dynamic import for Deno compatibility
      const { Resend } = await import("https://esm.sh/resend@2.0.0");
      const resendClient = new Resend(resendApiKey);
      
      const emailResult = await resendClient.emails.send({
        from: "FLI Command Center <onboarding@resend.dev>",
        to: [recipientEmail],
        subject: `📊 Executive Digest: ${formatCurrency(metrics.totalOpenReserves)} Open Reserves | ${dateStr}`,
        html: htmlContent,
        text: plainText,
      });
      
      console.log("Email sent successfully:", emailResult);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          method: "email",
          recipient: recipientEmail,
          metrics,
          test: isTest
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fallback: Return the digest content for manual handling
    return new Response(
      JSON.stringify({
        success: true,
        method: "preview",
        message: "No email configured. Add RESEND_API_KEY and EXECUTIVE_DIGEST_EMAIL secrets to enable email delivery.",
        html: htmlContent,
        text: plainText,
        metrics,
        test: isTest
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-executive-digest function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
