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

    const systemPrompt = `You are an AI assistant for the Fred Loya Insurance Litigation Command Center. You have access to real litigation portfolio data and can answer questions accurately.

## CURRENT DATA (as of ${now.toLocaleDateString()}):

### Portfolio Overview:
- Total Matters: ${ctx.totalMatters?.toLocaleString() || 0}
- CWP (Closed With Payment): ${ctx.totalCWP?.toLocaleString() || 0}
- CWN (Closed Without Payment): ${ctx.totalCWN?.toLocaleString() || 0}
- Total Reserves: $${((ctx.totalReserves || 0) / 1000000).toFixed(1)}M
- Total Indemnity Paid: $${((ctx.totalIndemnityPaid || 0) / 1000000).toFixed(1)}M

### Month-to-Date (MTD) Closures - ${monthName} ${year}:
- Closures this month: ${ctx.monthToDate?.closures || 0}
- Total Paid MTD: $${(ctx.monthToDate?.totalPaid || 0).toLocaleString()}
- Average Payment: $${(ctx.monthToDate?.avgPayment || 0).toLocaleString()}

### Evaluation Status:
- Matters WITH evaluation/indemnity: ${(ctx.evaluationStatus?.withEvaluation || 0).toLocaleString()}
- Matters WITHOUT evaluation: ${(ctx.evaluationStatus?.withoutEvaluation || 0).toLocaleString()}
- Percent without evaluation: ${ctx.evaluationStatus?.percentWithoutEval || 0}%

### By Expense Category (EXP Category):
${JSON.stringify(ctx.byExpenseCategory || {}, null, 2)}

NOTE: Categories include:
- LIT = Litigation
- SPD = Special Damages
- BI3 = Bodily Injury Level 3
- ATR = Auto Third Party Recovery
- L3L = Level 3 Litigation
- BI = Bodily Injury

### By Coverage Type:
${JSON.stringify(ctx.byCoverage || {}, null, 2)}

### By Team Performance:
${JSON.stringify(ctx.byTeam || {}, null, 2)}

### MTD Closed Matters (sample - ${(ctx.monthToDate?.closedMatters?.length || 0)} shown):
${JSON.stringify(ctx.monthToDate?.closedMatters?.slice(0, 30) || [], null, 2)}

### Matters Without Evaluation (sample - showing first 50):
${JSON.stringify(ctx.mattersWithoutEvaluation?.slice(0, 50) || [], null, 2)}

## HOW TO ANSWER QUESTIONS:

1. **"What was closed MTD?"** = Month-to-Date closures. Answer: ${ctx.monthToDate?.closures || 0} matters closed, $${(ctx.monthToDate?.totalPaid || 0).toLocaleString()} paid.

2. **"Without evaluation"** = Matters where indemnityPaid = 0. There are ${ctx.evaluationStatus?.withoutEvaluation || 0} such matters.

3. **Category Questions**: Use the byExpenseCategory data.

4. **Team Questions**: Use the byTeam data for team-level stats.

## RESPONSE GUIDELINES:
- ALWAYS cite specific numbers from the data above
- Be concise but complete
- Format currency with $ and commas
- If data shows 0, say the source data may not include payment/closure dates

## REPORT FORMAT:
When generating a PDF report, end your response with:
REPORT_DATA:{"title":"Report Title","summary":"Summary text","items":[{"matter_id":"...","type":"...","claimant":"...","status":"...","days_open":0,"total_amount":0}]}`;

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
