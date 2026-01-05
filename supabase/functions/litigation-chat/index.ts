import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, generateReport } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client to fetch data
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch litigation matters data for context
    const { data: litigationMatters, error: litError } = await supabase
      .from('litigation_matters')
      .select('*')
      .limit(500);

    if (litError) {
      console.error("Error fetching litigation_matters:", litError);
    }

    // Fetch open exposure data
    const { data: openExposure, error: expError } = await supabase
      .from('open_exposure')
      .select('*')
      .limit(500);

    if (expError) {
      console.error("Error fetching open_exposure:", expError);
    }

    // Build a summary of the data for the AI context
    const litigationSummary = litigationMatters ? {
      totalMatters: litigationMatters.length,
      byType: litigationMatters.reduce((acc: Record<string, number>, m: any) => {
        const t = m.type || 'Unknown';
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {}),
      byStatus: litigationMatters.reduce((acc: Record<string, number>, m: any) => {
        const s = m.status || 'Unknown';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {}),
      byDiscipline: litigationMatters.reduce((acc: Record<string, number>, m: any) => {
        const d = m.discipline || 'Unknown';
        acc[d] = (acc[d] || 0) + 1;
        return acc;
      }, {}),
      bySeverity: litigationMatters.reduce((acc: Record<string, number>, m: any) => {
        const s = m.severity || 'Unknown';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {}),
      withoutEvaluation: litigationMatters.filter((m: any) => 
        !m.indemnities_amount || m.indemnities_amount === 0
      ).length,
      totalReserves: litigationMatters.reduce((sum: number, m: any) => 
        sum + (parseFloat(m.total_amount) || 0), 0
      ),
      avgDaysOpen: Math.round(
        litigationMatters.reduce((sum: number, m: any) => sum + (m.days_open || 0), 0) / 
        (litigationMatters.length || 1)
      ),
      matters: litigationMatters.slice(0, 100) // Include sample for detailed queries
    } : null;

    const exposureSummary = openExposure ? {
      totalRecords: openExposure.length,
      byPhase: openExposure.reduce((acc: Record<string, number>, e: any) => {
        const p = e.phase || 'Unknown';
        acc[p] = (acc[p] || 0) + 1;
        return acc;
      }, {}),
      byTypeGroup: openExposure.reduce((acc: Record<string, number>, e: any) => {
        const t = e.type_group || 'Unknown';
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {}),
      totalNetExposure: openExposure.reduce((sum: number, e: any) => 
        sum + (parseFloat(e.net_exposure) || 0), 0
      ),
      totalReserves: openExposure.reduce((sum: number, e: any) => 
        sum + (parseFloat(e.reserves) || 0), 0
      ),
      records: openExposure.slice(0, 100)
    } : null;

    // System prompt with data context
    const systemPrompt = `You are an AI assistant for the Fred Loya Insurance Litigation Command Center. You help users analyze litigation data and generate reports.

## Available Data:

### Litigation Matters Summary:
${litigationSummary ? JSON.stringify(litigationSummary, null, 2) : 'No data available'}

### Open Exposure Summary:
${exposureSummary ? JSON.stringify(exposureSummary, null, 2) : 'No data available'}

## Your Capabilities:
1. Answer questions about the litigation portfolio (counts, types, status, severity, etc.)
2. Identify matters without evaluations, rear-end accidents, or other specific criteria
3. Provide statistics and summaries
4. Help generate PDF reports by providing structured data

## Response Guidelines:
- Be concise and data-driven
- When asked about specific types of accidents (like "rear end"), look in the 'type' or 'discipline' fields
- Matters without evaluations have indemnities_amount = 0 or null
- Always cite specific numbers from the data
- If asked to generate a report, provide the data in a structured format with a "REPORT_DATA:" prefix followed by JSON

## Report Format:
When the user asks for a PDF report, respond with analysis AND include at the end:
REPORT_DATA:{"title":"Report Title","summary":"Brief summary","items":[{"matter_id":"...","type":"...","claimant":"...","status":"...","days_open":0,"total_amount":0}]}`;

    console.log("Sending request to Lovable AI...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Litigation chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
