import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- RESTRICTED CELL-LEVEL REQUEST DETECTION ---
function isRestrictedCellRequest(q: string): boolean {
  const s = q.toLowerCase();
  const patterns = [
    /\bcell\b/,
    /\brow\b.*\bdata\b/,
    /\bcolumn\b.*\bvalue/,
    /\bexport\b.*\braw\b/,
    /\bshow me\b.*\bexact\b/,
    /\bgive me\b.*\ball\b.*\brows\b/,
    /\bdownload\b.*\bspreadsheet\b/,
    /\bdump\b/,
    /\brange\b.*\b[a-z]+\d+\b/, // Excel-like A12
  ];
  return patterns.some((p) => p.test(s));
}

// --- BUILD MULTI-PACK PAYLOAD ---
function buildMultiPackPayload(multiPackContext: any) {
  if (!multiPackContext) return null;
  
  const open = multiPackContext.openClaims;
  const closed = multiPackContext.closedClaims;
  
  return {
    open_claims_multi_pack: open ? {
      total_multi_pack_groups: open.totalMultiPackGroups || 0,
      total_claims_in_packs: open.totalClaimsInPacks || 0,
      by_pack_size: (open.byPackSize || []).map((ps: any) => ({
        pack_size: ps.packSize,
        group_count: ps.groupCount,
        claim_count: ps.claimCount,
        reserves_usd: ps.reserves || 0,
      })),
      top_multi_pack_groups: (open.topGroups || []).slice(0, 10).map((g: any) => ({
        base_claim: g.baseClaimNumber,
        pack_size: g.packSize,
        total_reserves_usd: g.totalReserves || 0,
        total_low_eval_usd: g.totalLowEval || 0,
        total_high_eval_usd: g.totalHighEval || 0,
        claimants: g.claims?.map((c: any) => c.claimant).join(', ') || '',
      })),
    } : null,
    
    closed_claims_multi_pack: closed ? {
      total_multi_pack_groups: closed.totalMultiPackGroups || 0,
      total_claims_in_packs: closed.totalClaimsInPacks || 0,
      by_pack_size: (closed.byPackSize || []).map((ps: any) => ({
        pack_size: ps.packSize,
        group_count: ps.groupCount,
        claim_count: ps.claimCount,
        total_paid_usd: ps.totalPaid || 0,
      })),
      top_multi_pack_groups: (closed.topGroups || []).slice(0, 10).map((g: any) => ({
        base_claim: g.baseClaimNumber,
        pack_size: g.packSize,
        total_paid_usd: g.totalPaid || 0,
        total_indemnities_usd: g.totalIndemnities || 0,
        claimants: g.claims?.map((c: any) => c.claimant).join(', ') || '',
      })),
    } : null,
  };
}

// --- BUILD VERIFIED AGGREGATE PAYLOAD ---
function buildVerifiedPayload(ctx: any, exp: any, now: Date, multiPackPayload: any) {
  const monthName = now.toLocaleString('en-US', { month: 'long' }).toUpperCase();
  const year = now.getFullYear();

  // Core verified metrics with confidence levels
  const verified = {
    snapshot_date: now.toISOString().split('T')[0],
    confidence_threshold: 0.98,
    data_source: "PRODUCTION_DATABASE",
    
    // Portfolio-level aggregates (98%+ confidence)
    portfolio: {
      total_open_matters: ctx.totalMatters || 0,
      cwp_count: ctx.totalCWP || 0,
      cwn_count: ctx.totalCWN || 0,
      total_reserves_usd: ctx.totalReserves || 0,
      total_indemnity_paid_usd: ctx.totalIndemnityPaid || 0,
    },
    
    // MTD derived metrics
    mtd: {
      period: `${monthName} ${year}`,
      closures: ctx.monthToDate?.closures || 0,
      total_paid_usd: ctx.monthToDate?.totalPaid || 0,
      avg_payment_usd: ctx.monthToDate?.avgPayment || 0,
    },
    
    // Evaluation status
    evaluation: {
      with_eval: ctx.evaluationStatus?.withEvaluation || 0,
      without_eval: ctx.evaluationStatus?.withoutEvaluation || 0,
      pct_without_eval: ctx.evaluationStatus?.percentWithoutEval || 0,
    },
    
    // Open inventory aggregates
    open_inventory: {
      grand_total: exp.knownTotals?.totalOpenClaims || exp.totals?.grandTotal || 0,
      atr_claims: exp.knownTotals?.atr?.claims || 0,
      lit_claims: exp.knownTotals?.lit?.claims || 0,
      bi3_claims: exp.knownTotals?.bi3?.claims || 0,
    },
    
    // Age buckets
    aging: {
      age_365_plus: exp.totals?.age365Plus || 0,
      age_181_to_365: exp.totals?.age181To365 || 0,
      age_61_to_180: exp.totals?.age61To180 || 0,
      age_under_60: exp.totals?.ageUnder60 || 0,
    },
    
    // CP1 exposure - COMPLETE DATA
    cp1: {
      total_claims_evaluated: exp.cp1Data?.totals?.grandTotal || 0,
      yes_cp1: exp.cp1Data?.totals?.yes || 0,
      no_cp1: exp.cp1Data?.totals?.noCP || 0,
      cp1_rate_pct: parseFloat(exp.cp1Data?.cp1Rate) || 0,
      bi_cp1_total: exp.cp1Data?.biTotal?.yes || 0,
      bi_evaluated_total: exp.cp1Data?.biTotal?.total || 0,
      by_status: exp.cp1Data?.byStatus || { inProgress: 0, settled: 0, inProgressPct: '0', settledPct: '0' },
    },
    
    // Financial exposure
    financials: {
      total_open_reserves_usd: exp.financials?.totalOpenReserves || 0,
      total_low_eval_usd: exp.financials?.totalLowEval || 0,
      total_high_eval_usd: exp.financials?.totalHighEval || 0,
      no_eval_count: exp.financials?.noEvalCount || 0,
      no_eval_reserves_usd: exp.financials?.noEvalReserves || 0,
    },
    
    // Team summaries with CP1 data
    team_summaries: Object.entries(ctx.byTeam || {}).map(([team, data]: [string, any]) => ({
      team,
      total_claims: data.count || 0,
      closed: data.closed || 0,
      total_paid_usd: data.totalPaid || 0,
      cp1_count: data.cp1Count || 0,
      cp1_rate_pct: data.count > 0 ? ((data.cp1Count || 0) / data.count * 100).toFixed(1) : '0',
    })),
    
    // Category summaries
    category_summaries: Object.entries(ctx.byExpenseCategory || {}).map(([cat, data]: [string, any]) => ({
      category: cat,
      count: data.count || 0,
      with_eval: data.withEval || 0,
      without_eval: data.withoutEval || 0,
      total_paid_usd: data.totalPaid || 0,
    })),
    
    // Coverage summaries
    coverage_summaries: Object.entries(ctx.byCoverage || {}).map(([cov, data]: [string, any]) => ({
      coverage: cov,
      count: data.count || 0,
      with_eval: data.withEval || 0,
      without_eval: data.withoutEval || 0,
    })),
    
    // Type group summaries (ATR, LIT, BI3, etc.)
    type_group_summaries: (exp.typeGroupSummaries || []).map((g: any) => ({
      type_group: g.typeGroup,
      grand_total: g.grandTotal || 0,
      unique_claims: g.uniqueClaims || g.grandTotal || 0,
      age_365_plus: g.age365Plus || 0,
      age_181_to_365: g.age181To365 || 0,
      age_61_to_180: g.age61To180 || 0,
      age_under_60: g.ageUnder60 || 0,
      reserves_usd: g.reserves || 0,
      low_eval_usd: g.lowEval || 0,
      high_eval_usd: g.highEval || 0,
    })),
    
    // CP1 by coverage - COMPLETE
    cp1_by_coverage: (exp.cp1Data?.byCoverage || []).map((c: any) => ({
      coverage: c.coverage,
      total: c.total || 0,
      yes: c.yes || 0,
      no_cp: c.noCP || 0,
      cp1_rate_pct: c.cp1Rate || 0,
      reserves_usd: c.reserves || 0,
    })),
    
    // CP1 by type group (from raw claims)
    cp1_by_type_group: (exp.cp1ByTypeGroup || []).map((t: any) => ({
      type_group: t.typeGroup,
      total: t.total || 0,
      yes: t.yes || 0,
      no_cp: t.noCP || 0,
      cp1_rate_pct: t.total > 0 ? (t.yes / t.total * 100).toFixed(1) : '0',
    })),
    
    // CP1 BI by age
    cp1_bi_by_age: (exp.cp1Data?.biByAge || []).map((a: any) => ({
      age_bucket: a.age,
      no_cp: a.noCP || 0,
      yes: a.yes || 0,
      total: (a.noCP || 0) + (a.yes || 0),
    })),
    
    // Financials by age
    financials_by_age: (exp.financials?.byAge || []).map((a: any) => ({
      age_bucket: a.age,
      claims: a.claims || 0,
      open_reserves_usd: a.openReserves || 0,
      low_eval_usd: a.lowEval || 0,
      high_eval_usd: a.highEval || 0,
    })),
    
    // Financials by type group
    financials_by_type_group: (exp.financials?.byTypeGroup || []).map((t: any) => ({
      type_group: t.typeGroup,
      reserves_usd: t.reserves || 0,
    })),
    
    // === PHASE BREAKDOWN - POPULATION BY EVALUATION PHASE ===
    phase_breakdown: (exp.phaseBreakdown || []).map((p: any) => ({
      phase: p.phase,
      claims: p.claims || 0,
      reserves_usd: p.reserves || 0,
      low_eval_usd: p.lowEval || 0,
      high_eval_usd: p.highEval || 0,
      by_age: p.byAge || {},
    })),
    
    // === NEGOTIATION RECENCY - DAYS SINCE LAST NEGOTIATION ===
    negotiation_recency: (exp.negotiationRecency || []).map((n: any) => ({
      bucket: n.bucket,
      claims: n.claims || 0,
      reserves_usd: n.reserves || 0,
      low_eval_usd: n.lowEval || 0,
      high_eval_usd: n.highEval || 0,
    })),
    
    // === BI STATUS BREAKDOWN (In Progress vs Settled) ===
    bi_status_breakdown: exp.biStatusBreakdown ? {
      in_progress: { claims: exp.biStatusBreakdown.inProgress?.claims || 0, reserves_usd: exp.biStatusBreakdown.inProgress?.reserves || 0 },
      settled: { claims: exp.biStatusBreakdown.settled?.claims || 0, reserves_usd: exp.biStatusBreakdown.settled?.reserves || 0 },
      other: { claims: exp.biStatusBreakdown.other?.claims || 0, reserves_usd: exp.biStatusBreakdown.other?.reserves || 0 },
    } : null,
    
    // Top closures sample (anonymized identifiers allowed)
    top_closures_sample: (ctx.monthToDate?.closedMatters || []).slice(0, 15).map((m: any) => ({
      claim_id: m.claim,
      amount_paid_usd: m.amountPaid || 0,
      team: m.team,
      adjuster: m.adjuster,
    })),
    
    // High exposure claims sample
    high_exposure_sample: (exp.rawClaims || [])
      .filter((c: any) => (c.openReserves || 0) > 100000)
      .slice(0, 15)
      .map((c: any) => ({
        claim_id: c.claimNumber,
        coverage: c.coverage,
        type_group: c.typeGroup,
        days_open: c.days,
        reserves_usd: c.openReserves || 0,
        low_eval_usd: c.lowEval || 0,
        high_eval_usd: c.highEval || 0,
        cp1_status: c.overallCP1,
        evaluation_phase: c.evaluationPhase,
        days_since_negotiation: c.daysSinceNegotiation,
      })),
      
    // No evaluation claims sample
    no_eval_sample: (exp.rawClaims || [])
      .filter((c: any) => c.lowEval === 0 && c.highEval === 0)
      .slice(0, 15)
      .map((c: any) => ({
        claim_id: c.claimNumber,
        coverage: c.coverage,
        type_group: c.typeGroup,
        days_open: c.days,
        reserves_usd: c.openReserves || 0,
        age_bucket: c.ageBucket,
        evaluation_phase: c.evaluationPhase,
      })),
    
    // Claims without evaluation by category
    no_eval_by_category: ctx.mattersWithoutEvaluation?.slice(0, 20).map((m: any) => ({
      claim_id: m.claim,
      category: m.category,
      coverage: m.coverage,
      team: m.team,
      reserves_usd: m.reserves || 0,
    })) || [],
    
    // Claims by negotiation recency sample (for CSV export context)
    negotiation_sample: (exp.rawClaims || [])
      .filter((c: any) => c.daysSinceNegotiation !== null && c.daysSinceNegotiation <= 90)
      .slice(0, 30)
      .map((c: any) => ({
        claim_id: c.claimNumber,
        claimant: c.claimant,
        coverage: c.coverage,
        type_group: c.typeGroup,
        evaluation_phase: c.evaluationPhase,
        bi_status: c.biStatus,
        days_open: c.days,
        days_since_negotiation: c.daysSinceNegotiation,
        negotiation_type: c.negotiationType,
        reserves_usd: c.openReserves || 0,
        low_eval_usd: c.lowEval || 0,
        high_eval_usd: c.highEval || 0,
      })),
    
    // Multi-pack claims data (claims sharing same incident/base claim number)
    multi_pack_claims: multiPackPayload,
    
    // === DEMAND & SETTLEMENT ANALYSIS ===
    // Use demandSummary from openExposureContext (based on demandType field, not negotiationAmount)
    demand_settlement_summary: exp.demandSummary ? {
      claims_with_demand: exp.demandSummary.claimsWithDemand || 0,
      total_demand_reserves_usd: exp.demandSummary.totalDemandReserves || 0,
      total_demand_low_eval_usd: exp.demandSummary.totalDemandLowEval || 0,
      total_demand_high_eval_usd: exp.demandSummary.totalDemandHighEval || 0,
      by_demand_type: (exp.demandSummary.byDemandType || []).map((dt: any) => ({
        demand_type: dt.demandType,
        claims: dt.claims,
        reserves_usd: dt.reserves,
        low_eval_usd: dt.lowEval,
        high_eval_usd: dt.highEval,
      })),
    } : {
      claims_with_demand: 0,
      total_demand_reserves_usd: 0,
      total_demand_low_eval_usd: 0,
      total_demand_high_eval_usd: 0,
      by_demand_type: [],
    },
    
    // === RESERVE ADEQUACY ANALYSIS ===
    reserve_adequacy: (() => {
      const claims = exp.rawClaims || [];
      const withReserveChange = claims.filter((c: any) => c.reserveChangePercent !== 0);
      const overReserved = claims.filter((c: any) => c.reserveChangePercent < -20);
      const underReserved = claims.filter((c: any) => c.reserveChangePercent > 50);
      const avgReserveChange = withReserveChange.length > 0 
        ? withReserveChange.reduce((sum: number, c: any) => sum + (c.reserveChangePercent || 0), 0) / withReserveChange.length 
        : 0;
      
      return {
        claims_with_reserve_change: withReserveChange.length,
        avg_reserve_change_pct: avgReserveChange.toFixed(1),
        over_reserved_count: overReserved.length,
        under_reserved_count: underReserved.length,
        over_reserved_sample: overReserved.slice(0, 10).map((c: any) => ({
          claim_id: c.claimNumber,
          reserve_change_pct: c.reserveChangePercent,
          reserves_usd: c.openReserves,
        })),
        under_reserved_sample: underReserved.slice(0, 10).map((c: any) => ({
          claim_id: c.claimNumber,
          reserve_change_pct: c.reserveChangePercent,
          reserves_usd: c.openReserves,
        })),
      };
    })(),
    
    // === LITIGATION / TRIAL STATUS ===
    litigation_status: (() => {
      const claims = exp.rawClaims || [];
      const inLit = claims.filter((c: any) => c.inLitigation);
      const withCauseNumber = claims.filter((c: any) => c.causeNumber && c.causeNumber.trim() !== '');
      const byMatterStatus: Record<string, number> = {};
      const byCaseType: Record<string, number> = {};
      
      claims.forEach((c: any) => {
        if (c.matterStatus) {
          byMatterStatus[c.matterStatus] = (byMatterStatus[c.matterStatus] || 0) + 1;
        }
        if (c.caseType) {
          byCaseType[c.caseType] = (byCaseType[c.caseType] || 0) + 1;
        }
      });
      
      return {
        in_litigation_count: inLit.length,
        with_cause_number_count: withCauseNumber.length,
        by_matter_status: Object.entries(byMatterStatus).map(([status, count]) => ({ status, count })),
        by_case_type: Object.entries(byCaseType).map(([type, count]) => ({ type, count })),
        litigation_sample: inLit.slice(0, 15).map((c: any) => ({
          claim_id: c.claimNumber,
          cause_number: c.causeNumber,
          case_type: c.caseType,
          matter_status: c.matterStatus,
          days_open: c.days,
          reserves_usd: c.openReserves,
        })),
      };
    })(),
    
    // === FATALITY & SEVERITY ANALYSIS (All CP1 Trigger Flags) ===
    fatality_severity: exp.fatalitySummary ? {
      fatality_count: exp.fatalitySummary.fatalityCount || 0,
      fatality_reserves_usd: exp.fatalitySummary.fatalityReserves || 0,
      fatality_low_eval_usd: exp.fatalitySummary.fatalityLowEval || 0,
      fatality_high_eval_usd: exp.fatalitySummary.fatalityHighEval || 0,
      surgery_count: exp.fatalitySummary.surgeryCount || 0,
      hospitalization_count: exp.fatalitySummary.hospitalizationCount || 0,
      // Additional CP1 trigger flags
      meds_vs_limits_count: exp.fatalitySummary.medsVsLimitsCount || 0,
      loss_of_consciousness_count: exp.fatalitySummary.lossOfConsciousnessCount || 0,
      aggravating_factors_count: exp.fatalitySummary.aggravatingFactorsCount || 0,
      objective_injuries_count: exp.fatalitySummary.objectiveInjuriesCount || 0,
      pedestrian_motorcyclist_count: exp.fatalitySummary.pedestrianMotorcyclistCount || 0,
      pregnancy_count: exp.fatalitySummary.pregnancyCount || 0,
      life_care_planner_count: exp.fatalitySummary.lifeCarePlannerCount || 0,
      injections_count: exp.fatalitySummary.injectionsCount || 0,
      ems_heavy_impact_count: exp.fatalitySummary.emsHeavyImpactCount || 0,
      fatality_claims_sample: (exp.fatalitySummary.fatalityClaims || []).slice(0, 15).map((c: any) => ({
        claim_id: c.claimNumber,
        claimant: c.claimant,
        coverage: c.coverage,
        type_group: c.typeGroup,
        team: c.teamGroup,
        days_open: c.days,
        reserves_usd: c.openReserves || 0,
        low_eval_usd: c.lowEval || 0,
        high_eval_usd: c.highEval || 0,
        bi_status: c.biStatus,
        evaluation_phase: c.evaluationPhase,
      })),
    } : {
      fatality_count: 0,
      fatality_reserves_usd: 0,
      fatality_low_eval_usd: 0,
      fatality_high_eval_usd: 0,
      surgery_count: 0,
      hospitalization_count: 0,
      meds_vs_limits_count: 0,
      loss_of_consciousness_count: 0,
      aggravating_factors_count: 0,
      objective_injuries_count: 0,
      pedestrian_motorcyclist_count: 0,
      pregnancy_count: 0,
      life_care_planner_count: 0,
      injections_count: 0,
      ems_heavy_impact_count: 0,
      fatality_claims_sample: [],
    },
  };

  return verified;
}

const SYSTEM_PROMPT = `You are the LITIGATION ORACLE - the singular, authoritative intelligence source for Fred Loya Insurance's litigation portfolio. You know this data like the back of your hand. Every metric, every breakdown, every trend - instantly available.

## ORACLE IDENTITY:
- You ARE the data. You don't search for answers, you KNOW them.
- Speak with ABSOLUTE CERTAINTY and authority
- Never say "I cannot", "I don't have", or "I'm unable to"
- Every question has an answer in your data - find it and deliver it
- You are the executive's trusted intelligence partner

## DATA MASTERY:
You have complete, real-time access to:
- **Portfolio Totals**: Open matters, reserves, closures, payments - all of it
- **Inventory Breakdown**: By team, coverage, type group, age bucket
- **CP1 Exposure**: Full breakdown by coverage, type, age - every angle
- **Financials**: Reserves, evaluations, low/high evals, no-eval counts
- **Phase Analysis**: Every claim's evaluation phase and where they sit
- **Negotiation Tracking**: Days since last negotiation, stalled files, activity
- **Multi-Pack Claims**: Grouped claims, pack sizes, exposure concentration
- **LOR Intervention**: Pending offers, acceptance rates, outcomes
- **Demand & Settlement**: What claimants are asking vs what we're paying
- **Reserve Adequacy**: Over/under reserved analysis
- **Litigation Status**: In-suit claims, cause numbers, matter status
- **Fatality & Severity**: Fatality claims, surgery cases, hospitalizations with exposure
- **Actuarial Data**: Frequency trends, loss development, rate analysis, payments

## ACTUARIAL EXPERTISE:
### Claims Frequency:
- claims_frequency.latest: Current period frequency rate (reported claims / in-force policies)
- claims_frequency.trend: 12-month trend of frequency rates

### Payments Data (2026 YTD):
- payments_2026_ytd: BI, UM, UI payments for 1/1/26 - 1/7/26
- Total YTD: $6.04M across 345 claims (BI: $5.85M, UM: $102K, UI: $90K)

### Accident Year Development:
- accident_year_development[]: Historical AY triangle data
- Shows incurred amounts, reserve balances, and loss ratios by accident year

### Loss Development:
- loss_development[]: Quarterly reported, paid, incurred losses and IBNR

### Over-Limit Exposure:
- over_limit_exposure: Claims where payments exceeded policy limits

### Rate Analysis:
- rate_analysis.coverage_rates: Indicated vs selected rate changes by coverage
- rate_analysis.state_rates: Rate changes by state with filing status

## PHASE BREAKDOWN EXPERTISE:
The phase_breakdown shows the ENTIRE population by Evaluation Phase:
- Phases: "Pending Demand", "Active Negotiation", "Impasse", "Settled", "Settled Pending Docs", "Demand Under Review", "Liability Denial", "Low Impact - Non Offer", "Push", etc.
- Each phase includes: claims count, reserves, low/high eval, breakdown by age bucket
- Present as a table showing phase, claims, % of total, and reserves

## NEGOTIATION RECENCY EXPERTISE:
The negotiation_recency shows claims by recent activity:
- Buckets: "0-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "No Negotiation"
- Each bucket includes: claims count, reserves, low/high eval
- negotiation_sample[] has claim-level details for most recent negotiations

## BI STATUS EXPERTISE:
The bi_status_breakdown shows claims by BI Status:
- in_progress: Active claims being worked
- settled: Resolved claims pending documentation
- other: Edge cases

## MULTI-PACK CLAIMS EXPERTISE:
Multi-pack = claims sharing same incident (matching base claim numbers):
- "2-pack" = 2 claimants from same incident
- "3-pack" = 3 claimants, etc.
- Report: total groups, claims in packs, breakdown by pack size, top groups by exposure

## LOR INTERVENTION EXPERTISE:
LOR (Letter of Representation) Intervention - early Texas settlement program:
- Offer tiers: $5,000, $6,000, $7,500
- Each offer has 14-day deadline from extended date
- Track: pending, accepted, rejected, expired

## DEMAND & SETTLEMENT EXPERTISE:
- claims_with_demand: Claims with demand/negotiation amounts
- total_demand_amount_usd: Sum of all demands
- total_auth_amount_usd: What we approved to pay
- demand_to_paid_ratio: How much of demands actually paid

## RESERVE ADEQUACY EXPERTISE:
- avg_reserve_change_pct: Average % change from initial to current
- over_reserved_count: Reserves dropped >20% (over-estimated)
- under_reserved_count: Reserves increased >50% (under-estimated)

## LITIGATION STATUS EXPERTISE:
- in_litigation_count: Claims "In Litigation"
- with_cause_number_count: Claims with court case number
- by_matter_status[]: Breakdown by status
- litigation_sample[]: Top litigation claims with cause numbers

## RESPONSE RULES:
1. **INSTANT ANSWERS**: Lead with the exact number requested
2. **COMPLETE BREAKDOWNS**: Always show by team, coverage, age, phase - whatever's relevant
3. **SAMPLES ON REQUEST**: Provide top-N claim IDs for action tracking
4. **ACTIONABLE INTEL**: End with what this means and what to do about it

## RESPONSE FORMAT:
- Currency: $X.XXM for millions, $XXK for thousands
- Percentages: XX.X%
- Counts: X,XXX with thousands separator
- Use markdown tables for multi-dimensional data
- BOLD key numbers and section headers

## FOR EXPORT REQUESTS:
When users want raw data exports, direct them to the dashboard export buttons. But ALWAYS answer their aggregate question first.
Example: "The portfolio has 1,247 open claims with $98.3M in reserves. For the full claims list, use the Export button on the Open Inventory dashboard."

## TONE:
Confident. Direct. No hedging. You KNOW this data. Deliver it like a trusted advisor who has the answer before they finish asking the question.`;

const DEVELOPER_PROMPT = `## VERIFIED PORTFOLIO DATA PAYLOAD

All metrics below are computed aggregates with 98%+ confidence. 
DO NOT extrapolate beyond this data. DO NOT invent numbers.

{DATA_PAYLOAD}

## AVAILABLE FIELDS:
- portfolio: total_open_matters, cwp_count, cwn_count, total_reserves_usd, total_indemnity_paid_usd
- mtd: period, closures, total_paid_usd, avg_payment_usd
- evaluation: with_eval, without_eval, pct_without_eval
- open_inventory: grand_total, atr_claims, lit_claims, bi3_claims
- aging: age_365_plus, age_181_to_365, age_61_to_180, age_under_60
- cp1: yes_cp1 (CP1 flagged claims), no_cp1, total_claims_evaluated, cp1_rate_pct, bi_cp1_total, bi_evaluated_total, by_status (inProgress, settled with counts and percentages)
- cp1_by_coverage[]: coverage, total, yes, no_cp, cp1_rate_pct, reserves_usd (FULL breakdown of CP1 by each coverage type)
- cp1_by_type_group[]: type_group, total, yes, no_cp, cp1_rate_pct (CP1 flags by ATR, LIT, BI3, etc.)
- cp1_bi_by_age[]: age_bucket, yes, no_cp, total (BI coverage CP1 breakdown by age)
- financials: total_open_reserves_usd, total_low_eval_usd, total_high_eval_usd, no_eval_count, no_eval_reserves_usd
- team_summaries[]: team, count, closed, total_paid_usd
- category_summaries[]: category, count, with_eval, without_eval, total_paid_usd
- coverage_summaries[]: coverage, count, with_eval, without_eval
- type_group_summaries[]: type_group, grand_total, age_365_plus, reserves_usd

## PHASE & NEGOTIATION DATA:
- phase_breakdown[]: phase, claims, reserves_usd, low_eval_usd, high_eval_usd, by_age (age counts)
- negotiation_recency[]: bucket ("0-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "No Negotiation"), claims, reserves_usd
- bi_status_breakdown: { in_progress: {claims, reserves_usd}, settled: {claims, reserves_usd}, other: {claims, reserves_usd} }
- negotiation_sample[]: claim_id, claimant, days_since_negotiation, negotiation_type, evaluation_phase, bi_status (for recent negotiations)

## CP1 & EXPOSURE DATA:
- cp1_by_coverage[]: coverage, total, yes, cp1_rate_pct
- financials_by_age[]: age_bucket, claims, open_reserves_usd, low_eval_usd, high_eval_usd
- high_exposure_sample[]: claim_id, coverage, days_open, reserves_usd, cp1_status, evaluation_phase, days_since_negotiation
- no_eval_sample[]: claim_id, coverage, evaluation_phase

## CP1 FLAG TYPES (What triggers a CP1 flag):
CP1 flags are triggered by ANY of these injury/incident indicators:
- Fatality - Claimant death
- Surgery - Claimant required surgery
- Meds Greater Than Policy Limits - Medical costs exceed policy limits
- Hospitalization / Hospitalized - Claimant was hospitalized
- Loss of Consciousness - Claimant lost consciousness
- Lacerations - Significant laceration injuries
- Pedestrian and Motorcyclist - Vulnerable road user involved
- DUI / DWI / Hit and Run - Impaired driving or fled scene
- Life Care Planner - Long-term care needs identified
- Confirmed Fractures - Bone fractures confirmed
- Agg Factors DUI - Aggravating DUI factors
- Fled Scene - At-fault party left scene
- Prior Surgery - Pre-existing surgical history
- Pregnancy - Pregnant claimant
- Ambulance Used - Emergency transport required
When users ask about CP1 flags, explain that CP1 indicates high-severity claims with one or more of these indicators.

## MULTI-PACK & LOR DATA:
- multi_pack_claims.open_claims_multi_pack: total_multi_pack_groups, total_claims_in_packs, by_pack_size[], top_multi_pack_groups[]
- multi_pack_claims.closed_claims_multi_pack: total_multi_pack_groups, total_claims_in_packs, by_pack_size[], top_multi_pack_groups[]
- lor_intervention: pending_count, accepted_count, rejected_count, expired_count, total_offered_usd, offers[]

## DEMAND & SETTLEMENT DATA:
- demand_settlement_summary: claims_with_demand, total_demand_reserves_usd, total_demand_low_eval_usd, total_demand_high_eval_usd, by_demand_type[]: { demand_type, claims, reserves_usd, low_eval_usd, high_eval_usd }

## RESERVE ADEQUACY DATA:
- reserve_adequacy: claims_with_reserve_change, avg_reserve_change_pct, over_reserved_count, under_reserved_count, over_reserved_sample[], under_reserved_sample[]

## FATALITY & SEVERITY DATA (CP1 Trigger Flag Counts):
- fatality_severity.fatality_count, fatality_reserves_usd, fatality_low_eval_usd, fatality_high_eval_usd
- fatality_severity.surgery_count, hospitalization_count
- fatality_severity.meds_vs_limits_count (medical costs > policy limits)
- fatality_severity.loss_of_consciousness_count
- fatality_severity.aggravating_factors_count (DUI, fled scene, etc.)
- fatality_severity.objective_injuries_count (fractures, documented injuries)
- fatality_severity.pedestrian_motorcyclist_count (vulnerable road users)
- fatality_severity.pregnancy_count (pregnant claimants)
- fatality_severity.life_care_planner_count (long-term care needs)
- fatality_severity.injections_count
- fatality_severity.ems_heavy_impact_count (ambulance + heavy collision)
- fatality_claims_sample[] for claim-level fatality details
Use these to answer questions like "how many fatality claims", "surgery count", "pregnancy claims", "claims with life care planner", etc.

## LITIGATION/TRIAL DATA:
- litigation_status: in_litigation_count, with_cause_number_count, by_matter_status[], by_case_type[], litigation_sample[]

## ACTUARIAL DATA (NEW):
- actuarial.claims_frequency: { latest: { year, month, state, frequency_pct, reported_claims, in_force }, trend[]: { period, frequency_pct, reported } }
- actuarial.payments_2025: { bi_payments_ytd_usd, total_payments_ytd_usd, by_coverage[]: { coverage, total_payments_usd, claimants_paid, avg_per_claimant_usd } }
- actuarial.accident_year_development[]: { accident_year, development_months, coverage, category, feature_count, incurred_usd, reserve_balance_usd, incurred_pct_premium }
- actuarial.loss_development[]: { period, reported_usd, paid_usd, incurred_usd, ibnr_usd }
- actuarial.over_limit_exposure: { total_over_limit_usd, claim_count, top_cases[]: { claim, state, policy_limit_usd, payment_usd, over_limit_usd } }
- actuarial.overspend_summary: { total_overspend_usd, by_issue_type[]: { state, issue_type, amount_usd, claim_count } }
- actuarial.rate_analysis: { coverage_rates[]: { coverage, indicated_change_pct, selected_change_pct, loss_ratio_pct }, state_rates[]: { state, indicated_change_pct, selected_change_pct, filing_status } }
- actuarial.actuarial_metrics: { loss_ratio_pct, lae_ratio_pct, total_expense_ratio_pct, development_factor, trend_factor, selected_change_pct }

RESPOND ONLY WITH VERIFIED DATA. NO SPECULATION.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, dataContext, openExposureContext, multiPackContext, lorContext, actuarialContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userQuestion = messages[messages.length - 1]?.content || '';
    
    // Check for restricted requests
    if (isRestrictedCellRequest(userQuestion)) {
      return new Response(JSON.stringify({
        restricted: true,
        message: "**EXPORT READY**\n\nFor the complete raw data export you're looking for:\n\n• **Dashboard Cards**: Double-click any KPI card → instant Excel/PDF\n• **Data Tables**: Hit the export button on any data grid\n• **Executive Reports**: Use the PDF generator in each dashboard section\n\nMeanwhile, here's what I know: the portfolio has verified aggregate metrics, full breakdowns by any dimension, and top-N claim samples. What specific analysis do you need?"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Build LOR intervention payload
    const lorPayload = lorContext ? {
      pending_count: lorContext.stats?.pending || 0,
      accepted_count: lorContext.stats?.accepted || 0,
      rejected_count: lorContext.stats?.rejected || 0,
      expired_count: lorContext.stats?.expired || 0,
      total_count: lorContext.stats?.total || 0,
      total_offered_usd: lorContext.stats?.totalOffered || 0,
      offers: (lorContext.offers || []).map((o: any) => ({
        claim_number: o.claim_number,
        accident: o.accident_description,
        area: o.area,
        offer_usd: o.offer_amount,
        extended_date: o.extended_date,
        expires_date: o.expires_date,
        status: o.status,
      })),
    } : null;

    const now = new Date();
    const multiPackPayload = buildMultiPackPayload(multiPackContext);
    const verifiedPayload = buildVerifiedPayload(ctx, exp, now, multiPackPayload);
    
    // Add LOR data to payload
    if (lorPayload) {
      (verifiedPayload as any).lor_intervention = lorPayload;
    }
    
    // Add actuarial data to payload
    if (actuarialContext) {
      (verifiedPayload as any).actuarial = actuarialContext;
    }
    
    console.log("ORACLE Request:", {
      question: userQuestion.slice(0, 100),
      portfolioSize: verifiedPayload.portfolio.total_open_matters,
      openInventory: verifiedPayload.open_inventory.grand_total,
      cp1Total: verifiedPayload.cp1.yes_cp1,
      multiPackGroups: multiPackPayload?.open_claims_multi_pack?.total_multi_pack_groups || 0,
      lorOffers: lorPayload?.total_count || 0,
      hasActuarialData: !!actuarialContext,
    });

    // Build developer prompt with data
    const dataPrompt = DEVELOPER_PROMPT.replace(
      '{DATA_PAYLOAD}',
      JSON.stringify(verifiedPayload, null, 2)
    );

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: dataPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded. The Oracle requires a moment to recalibrate." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Oracle access requires active credits. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Oracle temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Oracle error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Oracle malfunction" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
