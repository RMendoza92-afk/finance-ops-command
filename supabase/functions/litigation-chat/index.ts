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
    const { messages, dataContext, openExposureContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Received contexts:", {
      litigationMatters: dataContext?.totalMatters || 0,
      openExposureClaims: openExposureContext?.totals?.grandTotal || 0,
      cp1Total: openExposureContext?.cp1Data?.total || 0,
    });

    // Default empty contexts
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

    const exp = openExposureContext || {
      totals: { grandTotal: 0, age365Plus: 0, age181To365: 0, age61To180: 0, ageUnder60: 0 },
      typeGroupSummaries: [],
      cp1Data: { total: 0, byCoverage: [], biByAge: [], totals: { noCP: 0, yes: 0, grandTotal: 0 } },
      financials: { totalOpenReserves: 0, totalLowEval: 0, totalHighEval: 0, noEvalCount: 0, noEvalReserves: 0, byAge: [], byTypeGroup: [] },
      knownTotals: { totalOpenClaims: 0, atr: { claims: 0 }, lit: { claims: 0 }, bi3: { claims: 0 } },
      rawClaims: [],
    };

    const now = new Date();
    const monthName = now.toLocaleString('en-US', { month: 'long' }).toUpperCase();
    const year = now.getFullYear();

    // Build detailed breakdowns
    const teamBreakdown = Object.entries(ctx.byTeam || {})
      .map(([team, data]: [string, any]) => `${team}: ${data.count} matters, ${data.closed} closed, $${(data.totalPaid || 0).toLocaleString()} paid`)
      .join('\n');

    const categoryBreakdown = Object.entries(ctx.byExpenseCategory || {})
      .map(([cat, data]: [string, any]) => `${cat}: ${data.count} matters, ${data.withEval} with eval, ${data.withoutEval} without eval, $${(data.totalPaid || 0).toLocaleString()} paid`)
      .join('\n');

    const coverageBreakdown = Object.entries(ctx.byCoverage || {})
      .map(([cov, data]: [string, any]) => `${cov}: ${data.count} matters, ${data.withEval} with eval, ${data.withoutEval} without eval`)
      .join('\n');

    // Type group summaries for aged inventory
    const typeGroupSummary = (exp.typeGroupSummaries || [])
      .map((g: any) => `${g.typeGroup}: ${g.grandTotal} total, ${g.age365Plus} aged 365+, Reserves: $${(g.reserves || 0).toLocaleString()}`)
      .join('\n');

    // CP1 by coverage
    const cp1Coverage = (exp.cp1Data?.byCoverage || [])
      .map((c: any) => `${c.coverage}: ${c.total} total, ${c.yes} CP1, Rate: ${c.cp1Rate}%`)
      .join('\n');

    // Financials by age
    const financialsByAge = (exp.financials?.byAge || [])
      .map((a: any) => `${a.age}: ${a.claims} claims, Reserves: $${(a.openReserves || 0).toLocaleString()}, Low: $${(a.lowEval || 0).toLocaleString()}, High: $${(a.highEval || 0).toLocaleString()}`)
      .join('\n');

    // Sample raw claims for context
    const rawClaimsSample = (exp.rawClaims || []).slice(0, 20)
      .map((c: any) => `${c.claimNumber}: ${c.claimant}, ${c.coverage}, ${c.days} days, ${c.typeGroup}, Reserves: $${(c.openReserves || 0).toLocaleString()}, CP1: ${c.overallCP1}`)
      .join('\n');

    // Recent closures sample
    const recentClosures = (ctx.monthToDate?.closedMatters || []).slice(0, 10)
      .map((m: any) => `Claim ${m.claim}: ${m.claimant}, $${(m.amountPaid || 0).toLocaleString()}, Team: ${m.team}`)
      .join('\n');

    // Matters needing evaluation
    const noEvalSample = (ctx.mattersWithoutEvaluation || []).slice(0, 10)
      .map((m: any) => `Claim ${m.claim}: ${m.claimant}, ${m.category}, ${m.team}, Reserves: $${(m.reserves || 0).toLocaleString()}`)
      .join('\n');

    const systemPrompt = `You are the LITIGATION ORACLE at Fred Loya Insurance - the authoritative source for ALL litigation portfolio intelligence. You have COMPLETE access to every data point. When asked for data, you FURNISH IT - with exact numbers, claim lists, or structured tables. Never say data is unavailable if it's in your context.

## YOUR CAPABILITIES:
1. **Data Retrieval**: Provide exact counts, reserves, claim details from any dimension
2. **Claim Lists**: When asked for lists, provide actual claim numbers with details
3. **Analysis**: Calculate ratios, trends, comparisons across any data dimension
4. **Recommendations**: Suggest actions based on portfolio patterns
5. **Export Guidance**: Tell users they can double-click dashboard cards to export raw data

## CURRENT PORTFOLIO DATA (As of ${now.toLocaleDateString()}):

### LITIGATION MATTERS SUMMARY:
- Total Open Matters: ${ctx.totalMatters?.toLocaleString() || 0}
- Closed With Payment (CWP): ${ctx.totalCWP?.toLocaleString() || 0}
- Closed Without Payment (CWN): ${ctx.totalCWN?.toLocaleString() || 0}
- Total Reserves: $${((ctx.totalReserves || 0) / 1000000).toFixed(2)}M
- Total Indemnity Paid: $${((ctx.totalIndemnityPaid || 0) / 1000000).toFixed(2)}M

### MONTH-TO-DATE (${monthName} ${year}):
- MTD Closures: ${ctx.monthToDate?.closures || 0}
- MTD Total Paid: $${(ctx.monthToDate?.totalPaid || 0).toLocaleString()}
- MTD Average Payment: $${(ctx.monthToDate?.avgPayment || 0).toLocaleString()}

### EVALUATION STATUS:
- With Evaluation: ${ctx.evaluationStatus?.withEvaluation || 0}
- Without Evaluation: ${ctx.evaluationStatus?.withoutEvaluation || 0} (${ctx.evaluationStatus?.percentWithoutEval || 0}%)

### OPEN INVENTORY EXPOSURE:
- Total Open Claims: ${exp.knownTotals?.totalOpenClaims?.toLocaleString() || exp.totals?.grandTotal?.toLocaleString() || 0}
- ATR Claims: ${exp.knownTotals?.atr?.claims?.toLocaleString() || 0}
- LIT Claims: ${exp.knownTotals?.lit?.claims?.toLocaleString() || 0}
- BI3 Claims: ${exp.knownTotals?.bi3?.claims?.toLocaleString() || 0}

### AGED INVENTORY:
- 365+ Days: ${exp.totals?.age365Plus?.toLocaleString() || 0} claims
- 181-365 Days: ${exp.totals?.age181To365?.toLocaleString() || 0} claims
- 61-180 Days: ${exp.totals?.age61To180?.toLocaleString() || 0} claims
- Under 60 Days: ${exp.totals?.ageUnder60?.toLocaleString() || 0} claims

### CP1 EXPOSURE ANALYSIS:
- Total CP1 Claims: ${exp.cp1Data?.total?.toLocaleString() || 0}
- CP1 Rate: ${exp.cp1Data?.cp1Rate || '0'}%
- Total Evaluated: ${exp.cp1Data?.totals?.grandTotal?.toLocaleString() || 0}
- Yes CP1: ${exp.cp1Data?.totals?.yes?.toLocaleString() || 0}
- No CP1: ${exp.cp1Data?.totals?.noCP?.toLocaleString() || 0}

### FINANCIAL EXPOSURE:
- Total Open Reserves: $${((exp.financials?.totalOpenReserves || 0) / 1000000).toFixed(2)}M
- Total Low Eval: $${((exp.financials?.totalLowEval || 0) / 1000000).toFixed(2)}M
- Total High Eval: $${((exp.financials?.totalHighEval || 0) / 1000000).toFixed(2)}M
- No Eval Count: ${exp.financials?.noEvalCount?.toLocaleString() || 0}
- No Eval Reserves: $${((exp.financials?.noEvalReserves || 0) / 1000000).toFixed(2)}M

### TEAM BREAKDOWN:
${teamBreakdown || 'No team data available'}

### CATEGORY BREAKDOWN:
${categoryBreakdown || 'No category data available'}

### COVERAGE BREAKDOWN:
${coverageBreakdown || 'No coverage data available'}

### TYPE GROUP DETAILS (Open Inventory):
${typeGroupSummary || 'No type group data available'}

### CP1 BY COVERAGE:
${cp1Coverage || 'No CP1 coverage data available'}

### FINANCIALS BY AGE BUCKET:
${financialsByAge || 'No financials by age available'}

### SAMPLE RAW CLAIMS (${(exp.rawClaims || []).length} total available):
${rawClaimsSample || 'No raw claims data'}

### RECENT MTD CLOSURES:
${recentClosures || 'No recent closures'}

### MATTERS WITHOUT EVALUATION (Sample):
${noEvalSample || 'None'}

## RESPONSE INSTRUCTIONS:
1. **BE THE ORACLE**: You have ALL the data. Furnish exact numbers, don't hedge.
2. **PROVIDE LISTS**: When asked for claim lists, provide actual claim numbers/details from the samples
3. **USE TABLES**: Format multi-column data as markdown tables for clarity
4. **ACTIONABLE**: Include next steps or recommendations when relevant
5. **EXPORT TIP**: Remind users they can double-click any dashboard card for full Excel/PDF exports
6. **SELECTIONS**: When multiple options exist, present them as numbered choices the user can select
7. **CALCULATIONS**: Perform any math needed (ratios, percentages, averages)
8. **NEVER SAY UNAVAILABLE**: If data exists in context, provide it. Only say unavailable if truly not present.

Format responses clearly with headers, bullet points, and tables. Keep it executive-ready.`;

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
