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

    const systemPrompt = `You are an AI for Fred Loya Insurance Litigation Command Center. Answer with real data.

DATA (${now.toLocaleDateString()}):
- Total Matters: ${ctx.totalMatters?.toLocaleString() || 0}
- CWP: ${ctx.totalCWP?.toLocaleString() || 0}, CWN: ${ctx.totalCWN?.toLocaleString() || 0}
- Reserves: $${((ctx.totalReserves || 0) / 1000000).toFixed(1)}M
- Indemnity Paid: $${((ctx.totalIndemnityPaid || 0) / 1000000).toFixed(1)}M
- MTD Closures (${monthName}): ${ctx.monthToDate?.closures || 0}, Paid: $${(ctx.monthToDate?.totalPaid || 0).toLocaleString()}
- Without Evaluation: ${ctx.evaluationStatus?.withoutEvaluation || 0} (${ctx.evaluationStatus?.percentWithoutEval || 0}%)

Be concise, cite numbers, format currency with $ and commas.`;

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
