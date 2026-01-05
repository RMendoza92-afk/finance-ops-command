import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DirectiveRequest {
  claimFilter: string;
  claimCount: number;
  region: string;
  lossDescription: string;
  reviewer: string;
  deadline: string;
  totalReserves: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { claimFilter, claimCount, region, lossDescription, reviewer, deadline, totalReserves }: DirectiveRequest = await req.json();

    console.log("Generating directive summary for:", { claimFilter, claimCount, region, reviewer, deadline });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `You are a claims management executive assistant. Generate a concise, authoritative directive summary for a CEO deploying a file review task.

Context:
- Region: ${region}
- Loss Description: ${lossDescription}
- Claim Filter: ${claimFilter}
- Number of Claims: ${claimCount}
- Total Reserves at Risk: $${totalReserves.toLocaleString()}
- Assigned Reviewer: ${reviewer}
- Deadline: ${deadline}

Generate a 2-3 sentence executive summary that:
1. Clearly states what needs to be reviewed and why it's a priority
2. Emphasizes the financial exposure and urgency
3. Sets clear expectations for the deadline

Keep it professional, direct, and action-oriented. No pleasantries.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an executive assistant for insurance claims management. Be concise, direct, and professional." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required for AI features." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate summary");
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "Review directive deployed. Please complete by deadline.";

    console.log("Generated summary:", summary);

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error generating directive summary:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
