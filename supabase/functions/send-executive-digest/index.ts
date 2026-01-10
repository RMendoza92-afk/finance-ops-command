import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  id: string;
  email: string;
  name: string | null;
  report_types: string[];
}

interface InventorySnapshot {
  total_claims: number;
  total_reserves: number;
  total_low_eval: number;
  total_high_eval: number;
  cp1_claims: number;
  cp1_rate: number;
  no_eval_count: number;
  no_eval_reserves: number;
  age_365_plus: number;
  age_181_365: number;
  age_61_180: number;
  age_under_60: number;
  snapshot_date: string;
}

interface CP1Snapshot {
  total_claims: number;
  cp1_rate: number;
  bi_cp1_rate: number;
  total_reserves: number;
  total_flags: number;
  high_risk_claims: number;
  age_365_plus: number;
  age_181_365: number;
  age_61_180: number;
  age_under_60: number;
  snapshot_date: string;
  coverage_breakdown?: Record<string, { total: number; yes: number; rate: number }>;
  flag_breakdown?: Record<string, number>;
}

interface LorOffer {
  claim_number: string;
  offer_amount: number;
  status: string;
  expires_date: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting executive daily digest...");

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for manual override in request body
    const body = await req.json().catch(() => ({}));
    const manualEmail = body.email;
    const isTest = body.test === true;

    // Get active recipients from database
    const { data: dbRecipients, error: recipientError } = await supabase
      .from("daily_report_recipients")
      .select("*")
      .eq("is_active", true);

    if (recipientError) {
      console.error("Error fetching recipients:", recipientError);
    }

    // Use manual email override or database recipients
    let recipients: Recipient[] = [];
    if (manualEmail) {
      recipients = [{ id: "manual", email: manualEmail, name: null, report_types: ["inventory", "cp1", "budget"] }];
    } else if (dbRecipients && dbRecipients.length > 0) {
      recipients = dbRecipients as Recipient[];
    } else {
      console.log("No active recipients found");
      return new Response(
        JSON.stringify({ success: true, message: "No active recipients configured", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get latest inventory snapshot
    const { data: inventorySnapshot } = await supabase
      .from("inventory_snapshots")
      .select("*")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get prior week inventory snapshot for comparison
    const { data: allInventory } = await supabase
      .from("inventory_snapshots")
      .select("*")
      .order("snapshot_date", { ascending: false })
      .limit(2);
    
    const priorInventory = allInventory && allInventory.length > 1 ? allInventory[1] : null;

    // Get latest CP1 snapshot
    const { data: cp1Snapshot } = await supabase
      .from("cp1_snapshots")
      .select("*")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get prior CP1 snapshot
    const { data: allCP1 } = await supabase
      .from("cp1_snapshots")
      .select("*")
      .order("snapshot_date", { ascending: false })
      .limit(2);
    
    const priorCP1 = allCP1 && allCP1.length > 1 ? allCP1[1] : null;

    // Get pending decisions (LOR offers)
    const { data: pendingOffers } = await supabase
      .from("lor_offers")
      .select("*")
      .eq("status", "pending")
      .order("offer_amount", { ascending: false })
      .limit(10);

    // Get claims payments for YTD budget
    const { data: claimsPayments } = await supabase
      .from("claims_payments")
      .select("*")
      .eq("period_year", new Date().getFullYear())
      .eq("is_ytd", true);

    // Format helpers
    const fmtNum = (n: number) => n?.toLocaleString() || "0";
    const fmtCurrency = (n: number) => {
      if (!n) return "$0";
      if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
      if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
      return `$${n.toFixed(0)}`;
    };
    const fmtPct = (n: number) => `${n?.toFixed(1) || "0"}%`;
    const fmtDelta = (curr: number, prior: number) => {
      const delta = curr - prior;
      const sign = delta >= 0 ? "+" : "";
      return `${sign}${fmtNum(delta)}`;
    };
    const fmtDeltaPct = (curr: number, prior: number) => {
      if (!prior) return "N/A";
      const pct = ((curr - prior) / prior) * 100;
      const sign = pct >= 0 ? "+" : "";
      return `${sign}${pct.toFixed(1)}%`;
    };

    const today = new Date();
    const reportDate = today.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Calculate totals
    const totalPendingDecisions = pendingOffers?.length || 0;
    const totalDecisionExposure = pendingOffers?.reduce((sum, o) => sum + (o.offer_amount || 0), 0) || 0;
    const ytdBudgetPaid = claimsPayments?.reduce((sum, p) => sum + (p.total_payments || 0), 0) || 0;

    // Build email HTML
    const buildEmailHTML = (recipient: Recipient): string => {
      const inv = inventorySnapshot as InventorySnapshot | null;
      const priorInv = priorInventory as InventorySnapshot | null;
      const cp1 = cp1Snapshot as CP1Snapshot | null;
      const priorCp1 = priorCP1 as CP1Snapshot | null;

      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Executive Daily Digest</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#0a0a0a;color:#ffffff;">
  <div style="max-width:680px;margin:0 auto;background:#111111;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a1a1a 0%,#0d0d0d 100%);padding:32px 24px;border-bottom:3px solid #d4af37;">
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">
        📊 EXECUTIVE DAILY DIGEST
      </h1>
      <p style="margin:8px 0 0;font-size:14px;color:#888888;">
        ${reportDate}
      </p>
      ${recipient.name ? `<p style="margin:4px 0 0;font-size:12px;color:#666666;">Prepared for ${recipient.name}</p>` : ""}
      ${isTest ? `<p style="margin:8px 0 0;padding:4px 8px;background:#7f1d1d;color:#fca5a5;font-size:11px;display:inline-block;border-radius:4px;">TEST MODE</p>` : ""}
    </div>

    <!-- Status Banner -->
    ${inv ? `
    <div style="background:${inv.age_365_plus > 3000 || inv.no_eval_count > 5000 ? "#7f1d1d" : "#14532d"};padding:16px 24px;text-align:center;">
      <span style="font-size:12px;font-weight:600;letter-spacing:1px;color:${inv.age_365_plus > 3000 ? "#fca5a5" : "#86efac"};">
        PORTFOLIO STATUS: ${inv.age_365_plus > 3000 || inv.no_eval_count > 5000 ? "⚠️ ATTENTION REQUIRED" : "✓ STABLE"}
      </span>
    </div>
    ` : ""}

    <!-- Main Content -->
    <div style="padding:24px;">
      
      <!-- Inventory Section -->
      ${recipient.report_types?.includes("inventory") && inv ? `
      <div style="margin-bottom:24px;">
        <h2 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#d4af37;border-bottom:1px solid #333;padding-bottom:8px;">
          📋 OPEN INVENTORY
        </h2>
        
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:12px;background:#1a1a1a;border-radius:8px 0 0 0;">
              <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Total Claims</div>
              <div style="font-size:24px;font-weight:700;color:#ffffff;margin-top:4px;">${fmtNum(inv.total_claims)}</div>
              ${priorInv ? `<div style="font-size:11px;color:${inv.total_claims <= priorInv.total_claims ? "#10b981" : "#ef4444"};margin-top:4px;">${fmtDelta(inv.total_claims, priorInv.total_claims)} WoW</div>` : ""}
            </td>
            <td style="padding:12px;background:#1a1a1a;border-radius:0 8px 0 0;">
              <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Total Reserves</div>
              <div style="font-size:24px;font-weight:700;color:#d4af37;margin-top:4px;">${fmtCurrency(inv.total_reserves)}</div>
              ${priorInv ? `<div style="font-size:11px;color:${inv.total_reserves <= priorInv.total_reserves ? "#10b981" : "#ef4444"};margin-top:4px;">${fmtDeltaPct(inv.total_reserves, priorInv.total_reserves)} WoW</div>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:12px;background:#1f1f1f;">
              <div style="font-size:11px;color:#888;">Aged 365+</div>
              <div style="font-size:18px;font-weight:600;color:${inv.age_365_plus > 3000 ? "#ef4444" : "#ffffff"};margin-top:4px;">${fmtNum(inv.age_365_plus)}</div>
            </td>
            <td style="padding:12px;background:#1f1f1f;">
              <div style="font-size:11px;color:#888;">No Evaluation</div>
              <div style="font-size:18px;font-weight:600;color:${inv.no_eval_count > 5000 ? "#ef4444" : "#ffffff"};margin-top:4px;">${fmtNum(inv.no_eval_count)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px;background:#1a1a1a;border-radius:0 0 0 8px;">
              <div style="font-size:11px;color:#888;">Low Eval</div>
              <div style="font-size:16px;font-weight:600;color:#10b981;margin-top:4px;">${fmtCurrency(inv.total_low_eval)}</div>
            </td>
            <td style="padding:12px;background:#1a1a1a;border-radius:0 0 8px 0;">
              <div style="font-size:11px;color:#888;">High Eval</div>
              <div style="font-size:16px;font-weight:600;color:#ef4444;margin-top:4px;">${fmtCurrency(inv.total_high_eval)}</div>
            </td>
          </tr>
        </table>
      </div>
      ` : ""}

      <!-- CP1 Section -->
      ${recipient.report_types?.includes("cp1") && cp1 ? `
      <div style="margin-bottom:24px;">
        <h2 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#d4af37;border-bottom:1px solid #333;padding-bottom:8px;">
          🎯 CP1 ANALYSIS
        </h2>
        
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:12px;background:#1a1a1a;border-radius:8px 0 0 8px;">
              <div style="font-size:11px;color:#888;text-transform:uppercase;">CP1 Rate</div>
              <div style="font-size:28px;font-weight:700;color:${cp1.cp1_rate >= 30 ? "#10b981" : cp1.cp1_rate >= 25 ? "#f59e0b" : "#ef4444"};margin-top:4px;">
                ${fmtPct(cp1.cp1_rate)}
              </div>
              ${priorCp1 ? `<div style="font-size:11px;color:${cp1.cp1_rate >= priorCp1.cp1_rate ? "#10b981" : "#ef4444"};margin-top:4px;">${cp1.cp1_rate >= priorCp1.cp1_rate ? "↑" : "↓"} ${Math.abs(cp1.cp1_rate - priorCp1.cp1_rate).toFixed(1)}% WoW</div>` : ""}
            </td>
            <td style="padding:12px;background:#1a1a1a;">
              <div style="font-size:11px;color:#888;text-transform:uppercase;">BI CP1 Rate</div>
              <div style="font-size:24px;font-weight:700;color:#60a5fa;margin-top:4px;">
                ${fmtPct(cp1.bi_cp1_rate)}
              </div>
            </td>
            <td style="padding:12px;background:#1a1a1a;border-radius:0 8px 8px 0;">
              <div style="font-size:11px;color:#888;text-transform:uppercase;">High Risk</div>
              <div style="font-size:24px;font-weight:700;color:${cp1.high_risk_claims > 500 ? "#ef4444" : "#ffffff"};margin-top:4px;">
                ${fmtNum(cp1.high_risk_claims)}
              </div>
            </td>
          </tr>
        </table>

        <!-- CP1 Age Distribution -->
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <tr>
            <td style="padding:8px 12px;background:#1f1f1f;border-radius:8px 0 0 8px;font-size:12px;">
              <span style="color:#888;">Total Claims:</span>
              <span style="color:#fff;font-weight:600;margin-left:8px;">${fmtNum(cp1.total_claims)}</span>
            </td>
            <td style="padding:8px 12px;background:#1f1f1f;font-size:12px;">
              <span style="color:#888;">Total Flags:</span>
              <span style="color:#fff;font-weight:600;margin-left:8px;">${fmtNum(cp1.total_flags)}</span>
            </td>
            <td style="padding:8px 12px;background:#1f1f1f;border-radius:0 8px 8px 0;font-size:12px;">
              <span style="color:#888;">Reserves:</span>
              <span style="color:#d4af37;font-weight:600;margin-left:8px;">${fmtCurrency(cp1.total_reserves)}</span>
            </td>
          </tr>
        </table>

        <!-- CP1 Age Breakdown -->
        <div style="margin-top:12px;">
          <div style="font-size:11px;color:#888;text-transform:uppercase;margin-bottom:8px;letter-spacing:0.5px;">Age Distribution</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <tr style="background:#1a1a1a;">
              <td style="padding:8px;color:#10b981;font-weight:600;">
                &lt;60 days: <span style="color:#fff;">${fmtNum(cp1.age_under_60 || 0)}</span>
              </td>
              <td style="padding:8px;color:#60a5fa;font-weight:600;">
                61-180: <span style="color:#fff;">${fmtNum(cp1.age_61_180 || 0)}</span>
              </td>
              <td style="padding:8px;color:#f59e0b;font-weight:600;">
                181-365: <span style="color:#fff;">${fmtNum(cp1.age_181_365 || 0)}</span>
              </td>
              <td style="padding:8px;color:#ef4444;font-weight:600;">
                365+: <span style="color:#fff;">${fmtNum(cp1.age_365_plus)}</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Top Flags (if available) -->
        ${cp1.flag_breakdown ? `
        <div style="margin-top:12px;">
          <div style="font-size:11px;color:#888;text-transform:uppercase;margin-bottom:8px;letter-spacing:0.5px;">Top Risk Flags</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            ${Object.entries(cp1.flag_breakdown as Record<string, number>)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([flag, count], i) => `
              <tr style="background:${i % 2 === 0 ? "#1a1a1a" : "#1f1f1f"};">
                <td style="padding:6px 8px;color:#888;">${flag}</td>
                <td style="padding:6px 8px;color:#ef4444;font-weight:600;text-align:right;">${fmtNum(count)}</td>
              </tr>
            `).join("")}
          </table>
        </div>
        ` : ""}
      </div>
      ` : ""}

      <!-- Budget & Decisions Section -->
      ${recipient.report_types?.includes("budget") ? `
      <div style="margin-bottom:24px;">
        <h2 style="margin:0 0 16px;font-size:16px;font-weight:600;color:#d4af37;border-bottom:1px solid #333;padding-bottom:8px;">
          💰 BUDGET & DECISIONS
        </h2>
        
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:12px;background:#1a1a1a;border-radius:8px 0 0 8px;">
              <div style="font-size:11px;color:#888;text-transform:uppercase;">YTD Paid</div>
              <div style="font-size:24px;font-weight:700;color:#d4af37;margin-top:4px;">${fmtCurrency(ytdBudgetPaid)}</div>
            </td>
            <td style="padding:12px;background:#1a1a1a;">
              <div style="font-size:11px;color:#888;text-transform:uppercase;">Pending Decisions</div>
              <div style="font-size:24px;font-weight:700;color:${totalPendingDecisions > 50 ? "#ef4444" : "#ffffff"};margin-top:4px;">${totalPendingDecisions}</div>
            </td>
            <td style="padding:12px;background:#1a1a1a;border-radius:0 8px 8px 0;">
              <div style="font-size:11px;color:#888;text-transform:uppercase;">Decision Exposure</div>
              <div style="font-size:24px;font-weight:700;color:#ef4444;margin-top:4px;">${fmtCurrency(totalDecisionExposure)}</div>
            </td>
          </tr>
        </table>

        ${pendingOffers && pendingOffers.length > 0 ? `
        <div style="margin-top:16px;">
          <h3 style="margin:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Top Pending Offers</h3>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <tr style="background:#1a1a1a;">
              <td style="padding:8px;color:#888;font-weight:600;">Claim #</td>
              <td style="padding:8px;color:#888;font-weight:600;text-align:right;">Offer</td>
              <td style="padding:8px;color:#888;font-weight:600;text-align:right;">Expires</td>
            </tr>
            ${(pendingOffers as LorOffer[]).slice(0, 5).map((offer, i) => `
            <tr style="background:${i % 2 === 0 ? "#1f1f1f" : "#1a1a1a"};">
              <td style="padding:8px;color:#ffffff;">${offer.claim_number}</td>
              <td style="padding:8px;color:#ef4444;text-align:right;font-weight:600;">${fmtCurrency(offer.offer_amount)}</td>
              <td style="padding:8px;color:#888;text-align:right;">${new Date(offer.expires_date).toLocaleDateString()}</td>
            </tr>
            `).join("")}
          </table>
        </div>
        ` : ""}
      </div>
      ` : ""}

    </div>

    <!-- Footer -->
    <div style="background:#0a0a0a;padding:24px;border-top:1px solid #333;text-align:center;">
      <p style="margin:0;font-size:11px;color:#666;">
        Fred Loya Insurance | Claims Discipline Command Center
      </p>
      <p style="margin:8px 0 0;font-size:10px;color:#444;">
        Sent ${today.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
      </p>
    </div>

  </div>
</body>
</html>`;
    };

    // Send emails to all recipients
    const results: Array<{ email: string; success: boolean; error?: string }> = [];

    for (const recipient of recipients) {
      try {
        const html = buildEmailHTML(recipient);
        
        const emailResult = await resend.emails.send({
          from: "FLI Dashboard <onboarding@resend.dev>",
          to: [recipient.email],
          subject: `📊 Daily Executive Digest - ${reportDate}`,
          html,
        });

        console.log(`Email sent to ${recipient.email}:`, emailResult);
        results.push({ email: recipient.email, success: true });
      } catch (emailError: any) {
        console.error(`Failed to send to ${recipient.email}:`, emailError);
        results.push({ email: recipient.email, success: false, error: emailError.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Daily digest complete: ${successCount}/${recipients.length} emails sent`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: recipients.length,
        results,
        reportDate,
        test: isTest,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-executive-digest:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
