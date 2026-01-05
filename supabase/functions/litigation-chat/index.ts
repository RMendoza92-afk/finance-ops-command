import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedMatter {
  class: string;
  prefix: string;
  claim: string;
  claimant: string;
  coverage: string;
  uniqueRecord: string;
  expCategory: string;
  dept: string;
  team: string;
  adjusterName: string;
  paymentDate: string;
  indemnitiesAmount: number;
  totalAmount: number;
  netAmount: number;
  cwpCwn: string;
  startPainLvl: number;
  endPainLvl: number;
}

function parseNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/,/g, '').replace(/[()]/g, '').replace(/"/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch CSV data directly from the public URL
    console.log("Fetching CSV data...");
    const csvUrl = `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app')}/data/litigation-data.csv`;
    
    // Try multiple possible URLs for the CSV
    let csvText = '';
    const possibleUrls = [
      'https://aqfikrtvlpmoyedrzbzf.lovable.app/data/litigation-data.csv',
    ];
    
    for (const url of possibleUrls) {
      try {
        console.log(`Trying to fetch CSV from: ${url}`);
        const csvResponse = await fetch(url);
        if (csvResponse.ok) {
          csvText = await csvResponse.text();
          console.log(`Successfully fetched CSV, length: ${csvText.length}`);
          break;
        }
      } catch (e) {
        console.log(`Failed to fetch from ${url}:`, e);
      }
    }

    // Parse CSV data
    const lines = csvText.split('\n');
    const headers = lines[0] ? parseCSVLine(lines[0]) : [];
    console.log(`CSV headers found: ${headers.length}`);
    
    const matters: ParsedMatter[] = [];
    for (let i = 1; i < Math.min(lines.length, 5000); i++) { // Limit to 5000 for performance
      if (!lines[i]?.trim()) continue;
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 20) continue;
      
      matters.push({
        class: cols[0] || '',
        prefix: cols[1] || '',
        claim: cols[2] || '',
        claimant: cols[3] || '',
        coverage: cols[4] || '',
        uniqueRecord: cols[5] || '',
        expCategory: cols[6] || '',
        dept: cols[7] || '',
        team: cols[8] || '',
        adjusterName: cols[10] || '',
        paymentDate: cols[20] || '',
        indemnitiesAmount: parseNumber(cols[21]),
        totalAmount: parseNumber(cols[24]),
        netAmount: parseNumber(cols[25]),
        cwpCwn: cols[26] || '',
        startPainLvl: parseNumber(cols[27]),
        endPainLvl: parseNumber(cols[28]),
      });
    }

    console.log(`Parsed ${matters.length} matters from CSV`);

    // Calculate comprehensive statistics
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // MTD Closures (CWP with payment in current month)
    const mtdClosures = matters.filter(m => {
      if (m.cwpCwn !== 'CWP' || !m.paymentDate) return false;
      const payDate = new Date(m.paymentDate);
      return payDate.getMonth() === currentMonth && payDate.getFullYear() === currentYear;
    });
    
    const mtdPaid = mtdClosures.reduce((sum, m) => sum + m.indemnitiesAmount, 0);
    
    // By type/category analysis
    const byExpCategory: Record<string, { count: number; withEval: number; withoutEval: number; totalPaid: number }> = {};
    matters.forEach(m => {
      const cat = m.expCategory || 'Unknown';
      if (!byExpCategory[cat]) {
        byExpCategory[cat] = { count: 0, withEval: 0, withoutEval: 0, totalPaid: 0 };
      }
      byExpCategory[cat].count++;
      if (m.indemnitiesAmount > 0) {
        byExpCategory[cat].withEval++;
        byExpCategory[cat].totalPaid += m.indemnitiesAmount;
      } else {
        byExpCategory[cat].withoutEval++;
      }
    });

    // Coverage type analysis (for rear-end, BI, etc.)
    const byCoverage: Record<string, { count: number; withEval: number; withoutEval: number }> = {};
    matters.forEach(m => {
      const cov = m.coverage || 'Unknown';
      if (!byCoverage[cov]) {
        byCoverage[cov] = { count: 0, withEval: 0, withoutEval: 0 };
      }
      byCoverage[cov].count++;
      if (m.indemnitiesAmount > 0) {
        byCoverage[cov].withEval++;
      } else {
        byCoverage[cov].withoutEval++;
      }
    });

    // Find matters without evaluations
    const withoutEvaluation = matters.filter(m => m.indemnitiesAmount === 0);
    
    // By team analysis
    const byTeam: Record<string, { count: number; closed: number; totalPaid: number }> = {};
    matters.forEach(m => {
      const team = m.team || 'Unknown';
      if (!byTeam[team]) {
        byTeam[team] = { count: 0, closed: 0, totalPaid: 0 };
      }
      byTeam[team].count++;
      if (m.cwpCwn === 'CWP') {
        byTeam[team].closed++;
        byTeam[team].totalPaid += m.indemnitiesAmount;
      }
    });

    // Sample matters for detailed queries
    const sampleMatters = matters.slice(0, 200).map(m => ({
      claim: m.claim,
      claimant: m.claimant,
      expCategory: m.expCategory,
      coverage: m.coverage,
      team: m.team,
      adjuster: m.adjusterName,
      paymentDate: m.paymentDate,
      indemnityPaid: m.indemnitiesAmount,
      totalAmount: m.totalAmount,
      status: m.cwpCwn,
      painLevel: m.endPainLvl,
    }));

    // Build comprehensive data context
    const dataContext = {
      totalMatters: matters.length,
      totalCWP: matters.filter(m => m.cwpCwn === 'CWP').length,
      totalCWN: matters.filter(m => m.cwpCwn === 'CWN').length,
      
      monthToDate: {
        closures: mtdClosures.length,
        totalPaid: mtdPaid,
        avgPayment: mtdClosures.length > 0 ? Math.round(mtdPaid / mtdClosures.length) : 0,
        closedMatters: mtdClosures.slice(0, 50).map(m => ({
          claim: m.claim,
          claimant: m.claimant,
          paymentDate: m.paymentDate,
          amountPaid: m.indemnitiesAmount,
          team: m.team,
        }))
      },
      
      evaluationStatus: {
        withEvaluation: matters.filter(m => m.indemnitiesAmount > 0).length,
        withoutEvaluation: withoutEvaluation.length,
        percentWithoutEval: Math.round((withoutEvaluation.length / matters.length) * 100),
      },
      
      byExpenseCategory: byExpCategory,
      byCoverage: byCoverage,
      byTeam: byTeam,
      
      totalReserves: matters.reduce((sum, m) => sum + m.netAmount, 0),
      totalIndemnityPaid: matters.reduce((sum, m) => sum + m.indemnitiesAmount, 0),
      
      mattersWithoutEvaluation: withoutEvaluation.slice(0, 100).map(m => ({
        claim: m.claim,
        claimant: m.claimant,
        category: m.expCategory,
        coverage: m.coverage,
        team: m.team,
        adjuster: m.adjusterName,
        reserves: m.netAmount,
      })),
      
      sampleMatters: sampleMatters,
    };

    console.log("Data context built:", {
      totalMatters: dataContext.totalMatters,
      mtdClosures: dataContext.monthToDate.closures,
      withoutEval: dataContext.evaluationStatus.withoutEvaluation,
    });

    // System prompt with comprehensive data context
    const systemPrompt = `You are an AI assistant for the Fred Loya Insurance Litigation Command Center. You have access to real litigation portfolio data and can answer questions accurately.

## CURRENT DATA (as of ${new Date().toLocaleDateString()}):

### Portfolio Overview:
- Total Matters: ${dataContext.totalMatters.toLocaleString()}
- CWP (Closed With Payment): ${dataContext.totalCWP.toLocaleString()}
- CWN (Closed Without Payment): ${dataContext.totalCWN.toLocaleString()}
- Total Reserves: $${(dataContext.totalReserves / 1000000).toFixed(1)}M
- Total Indemnity Paid: $${(dataContext.totalIndemnityPaid / 1000000).toFixed(1)}M

### Month-to-Date (MTD) Closures:
- Closures this month: ${dataContext.monthToDate.closures}
- Total Paid MTD: $${dataContext.monthToDate.totalPaid.toLocaleString()}
- Average Payment: $${dataContext.monthToDate.avgPayment.toLocaleString()}

### Evaluation Status:
- Matters WITH evaluation: ${dataContext.evaluationStatus.withEvaluation.toLocaleString()}
- Matters WITHOUT evaluation: ${dataContext.evaluationStatus.withoutEvaluation.toLocaleString()}
- Percent without evaluation: ${dataContext.evaluationStatus.percentWithoutEval}%

### By Expense Category:
${JSON.stringify(dataContext.byExpenseCategory, null, 2)}

### By Coverage Type:
${JSON.stringify(dataContext.byCoverage, null, 2)}

### By Team (top teams):
${JSON.stringify(Object.entries(dataContext.byTeam).sort((a, b) => b[1].count - a[1].count).slice(0, 10), null, 2)}

### MTD Closed Matters (sample):
${JSON.stringify(dataContext.monthToDate.closedMatters.slice(0, 20), null, 2)}

### Matters Without Evaluation (sample):
${JSON.stringify(dataContext.mattersWithoutEvaluation.slice(0, 30), null, 2)}

## HOW TO ANSWER QUESTIONS:

1. **Closures/Paid Questions**: Use the "Month-to-Date" section for MTD data. CWP = closed with payment.

2. **Evaluation Questions**: "Without evaluation" means indemnitiesAmount = 0. Use evaluationStatus section.

3. **Category Questions**: LIT = Litigation, SPD = Special, BI = Bodily Injury, ATR = Auto Third Party, L3L = Level 3, etc.

4. **For rear-end accidents**: Look in the expCategory or coverage fields. Rear-end would typically be coded as specific BI subcategories.

5. **Report Generation**: When asked to generate a report, include REPORT_DATA: followed by JSON with title, summary, and items array.

## RESPONSE GUIDELINES:
- Always cite specific numbers from the data above
- If asked about MTD closures: ${dataContext.monthToDate.closures} closures totaling $${dataContext.monthToDate.totalPaid.toLocaleString()}
- If asked about matters without evaluation: ${dataContext.evaluationStatus.withoutEvaluation.toLocaleString()} matters (${dataContext.evaluationStatus.percentWithoutEval}%)
- Be precise and data-driven
- Format currency with $ and commas

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
