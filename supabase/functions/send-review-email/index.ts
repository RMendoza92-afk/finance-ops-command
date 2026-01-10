import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  low_eval?: number;
  high_eval?: number;
}

interface EmailRequest {
  to: string;
  reviewerName: string;
  claimType: string;
  claimCount: number;
  region: string;
  lossDescription: string;
  deadline: string;
  claims: ClaimData[];
  excelBase64: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Dynamic import for Deno compatibility
    const { Resend } = await import("https://esm.sh/resend@2.0.0");
    const resend = new Resend(resendApiKey);
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    const {
      to,
      reviewerName,
      claimType,
      claimCount,
      region,
      lossDescription,
      deadline,
      claims,
      excelBase64,
    }: EmailRequest = await req.json();

    console.log(`Sending review email to ${to} for ${claimCount} claims`);

    // Upload Excel to storage and get public URL
    let downloadUrl = '';
    if (excelBase64) {
      try {
        const binaryString = atob(excelBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `review-${reviewerName.replace(/\s+/g, '-')}-${timestamp}.xlsx`;

        const { error: uploadError } = await supabase.storage
          .from('review-exports')
          .upload(filename, bytes, {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            upsert: true
          });

        if (!uploadError) {
          // Use signed URL instead of public URL (expires in 7 days)
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('review-exports')
            .createSignedUrl(filename, 60 * 60 * 24 * 7); // 7 days
          
          if (signedUrlData && !signedUrlError) {
            downloadUrl = signedUrlData.signedUrl;
          }
        }
      } catch (err) {
        console.error('Error uploading Excel:', err);
      }
    }

    // Build claims summary table for email
    const claimsSummary = claims.slice(0, 10).map(c => 
      `<tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${c.claim_id}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${c.area}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">$${c.reserves?.toLocaleString() || 0}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${c.age_bucket}</td>
      </tr>`
    ).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Claims Review Assignment</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: #0c2340; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🚨 Claims Review Assignment</h1>
          </div>
          
          <div style="background-color: white; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; color: #333;">Hello <strong>${reviewerName}</strong>,</p>
            
            <p style="font-size: 14px; color: #666;">You have been assigned claims for review. Please see the details below:</p>
            
            <div style="background-color: #f8f9fa; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; font-size: 14px;">
                <tr>
                  <td style="padding: 4px 0; color: #666;"><strong>Region:</strong></td>
                  <td style="padding: 4px 0; color: #333;">${region}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #666;"><strong>Claim Type:</strong></td>
                  <td style="padding: 4px 0; color: #333;">${claimType}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #666;"><strong>Total Claims:</strong></td>
                  <td style="padding: 4px 0; color: #333; font-weight: bold;">${claimCount}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #666;"><strong>Loss Description:</strong></td>
                  <td style="padding: 4px 0; color: #333;">${lossDescription}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #666;"><strong>Deadline:</strong></td>
                  <td style="padding: 4px 0; color: #b41e1e; font-weight: bold;">${deadline}</td>
                </tr>
              </table>
            </div>
            
            <h3 style="color: #0c2340; margin-top: 24px;">Claims Preview (First 10)</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #0c2340; color: white;">
                  <th style="padding: 10px; text-align: left;">Claim ID</th>
                  <th style="padding: 10px; text-align: left;">Area</th>
                  <th style="padding: 10px; text-align: left;">Reserves</th>
                  <th style="padding: 10px; text-align: left;">Age</th>
                </tr>
              </thead>
              <tbody>
                ${claimsSummary}
                ${claims.length > 10 ? `<tr><td colspan="4" style="padding: 8px; text-align: center; color: #666; font-style: italic;">... and ${claims.length - 10} more claims</td></tr>` : ''}
              </tbody>
            </table>
            
            ${downloadUrl ? `
              <div style="text-align: center; margin: 24px 0;">
                <a href="${downloadUrl}" 
                   style="display: inline-block; background-color: #0c2340; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                  📊 Download Full Claims Spreadsheet
                </a>
              </div>
            ` : ''}
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              This is an automated message from FLI Claims Dashboard.<br>
              Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: "FLI Claims Dashboard <onboarding@resend.dev>",
      to: [to],
      subject: `🚨 Claims Review Assignment: ${claimCount} ${claimType} claims - Due ${deadline}`,
      html: emailHtml,
    });

    if (error) {
      console.error("Resend API error:", error);
      throw new Error(error.message || "Failed to send email");
    }

    console.log("Email sent successfully:", data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: data?.id,
        downloadUrl: downloadUrl || null
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-review-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
