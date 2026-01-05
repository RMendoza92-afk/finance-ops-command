import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, dataContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Received data context:", {
      totalMatters: dataContext?.totalMatters || 0,
      mtdClosures: dataContext?.monthToDate?.closures || 0,
      withoutEval: dataContext?.evaluationStatus?.withoutEvaluation || 0,
    });

    // Default empty context if not provided
    const ctx = dataContext || {
      totalMatters: 0,
      totalCWP: 0,
      totalCWN: 0,
      totalReserves: 0,
      totalIndemnityPaid: 0,
      monthToDate: { closures: 0, totalPaid: 0, avgPayment: 0, closedMatters: [] },
      evaluationStatus: { withEvaluation: 0, withoutEvaluation: 0, percentWithoutEval: 0 },
      byExpenseCategory: {},
      byCoverage: {},
      byTeam: {},
      mattersWithoutEvaluation: [],
      sampleMatters: [],
    };

    // System prompt with comprehensive data context
    const now = new Date();
    const monthName = now.toLocaleString('en-US', { month: 'long' }).toUpperCase();
    const year = now.getFullYear();

    // Build detailed breakdowns for the AI
    const teamBreakdown = Object.entries(ctx.byTeam || {})
      .map(([team, data]: [string, any]) => `${team}: ${data.count} matters, ${data.closed} closed, $${(data.totalPaid || 0).toLocaleString()} paid`)
      .join('\n');

    const categoryBreakdown = Object.entries(ctx.byExpenseCategory || {})
      .map(([cat, data]: [string, any]) => `${cat}: ${data.count} matters, ${data.withEval} with eval, ${data.withoutEval} without eval, $${(data.totalPaid || 0).toLocaleString()} paid`)
      .join('\n');

    const coverageBreakdown = Object.entries(ctx.byCoverage || {})
      .map(([cov, data]: [string, any]) => `${cov}: ${data.count} matters, ${data.withEval} with eval, ${data.withoutEval} without eval`)
      .join('\n');

    // Sample of recent closed matters
    const recentClosures = (ctx.monthToDate?.closedMatters || []).slice(0, 10)
      .map((m: any) => `Claim ${m.claim}: ${m.claimant}, $${(m.amountPaid || 0).toLocaleString()}, Team: ${m.team}`)
      .join('\n');

    // Matters needing evaluation
    const noEvalSample = (ctx.mattersWithoutEvaluation || []).slice(0, 10)
      .map((m: any) => `Claim ${m.claim}: ${m.claimant}, ${m.category}, ${m.team}, Reserves: $${(m.reserves || 0).toLocaleString()}`)
      .join('\n');

    const systemPrompt = `You are a senior litigation analyst at Fred Loya Insurance. Your role is to provide accurate, data-driven answers about the litigation portfolio. ALWAYS use the exact numbers provided below. Never make up or estimate data.

## CURRENT PORTFOLIO DATA (As of ${now.toLocaleDateString()}):

### Summary Metrics:
- Total Open Matters: ${ctx.totalMatters?.toLocaleString() || 0}
- Closed With Payment (CWP): ${ctx.totalCWP?.toLocaleString() || 0}
- Closed Without Payment (CWN): ${ctx.totalCWN?.toLocaleString() || 0}
- Total Reserves: $${((ctx.totalReserves || 0) / 1000000).toFixed(2)}M
- Total Indemnity Paid: $${((ctx.totalIndemnityPaid || 0) / 1000000).toFixed(2)}M

### Month-to-Date Performance (${monthName} ${year}):
- MTD Closures: ${ctx.monthToDate?.closures || 0}
- MTD Total Paid: $${(ctx.monthToDate?.totalPaid || 0).toLocaleString()}
- MTD Average Payment: $${(ctx.monthToDate?.avgPayment || 0).toLocaleString()}

### Evaluation Status:
- With Evaluation: ${ctx.evaluationStatus?.withEvaluation || 0}
- Without Evaluation: ${ctx.evaluationStatus?.withoutEvaluation || 0} (${ctx.evaluationStatus?.percentWithoutEval || 0}%)

### Team Breakdown:
${teamBreakdown || 'No team data available'}

### Category Breakdown:
${categoryBreakdown || 'No category data available'}

### Coverage Breakdown:
${coverageBreakdown || 'No coverage data available'}

### Recent MTD Closures (Sample):
${recentClosures || 'No recent closures'}

### Matters Without Evaluation (Sample):
${noEvalSample || 'None'}

## INSTRUCTIONS:
1. Answer questions using ONLY the data above - never estimate or fabricate numbers
2. When asked about closures, payments, or MTD data, use the exact figures provided
3. Format currency with $ and commas (e.g., $1,234,567)
4. Format large numbers in millions when appropriate (e.g., $2.5M)
5. Be specific and cite the exact data points when answering
6. If asked about data not provided, say "That specific breakdown is not available in the current dataset"
7. Keep responses concise but complete`;

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
