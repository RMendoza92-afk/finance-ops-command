import { useEffect, useMemo, useState, useCallback } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

// NOTE: This hook is intentionally isolated for the CP1 Analysis "box" only.
// It must not affect any other dashboard logic.

export interface CP1CsvClaim {
  claimNumber: string;
  claimant: string;
  coverage: string;
  days: number;
  ageBucket: string;
  typeGroup: string;
  teamGroup: string;
  adjuster: string;
  impactSeverity: string;
  openReserves: number;
  totalPaid: number;
  cp1Flag: string;
  overallCP1: string;
  biStatus: string;
  evaluationPhase: string;
  claimantAge: number;
  endPainLevel: number | null;
  // 17 trigger flags from CSV (original 11 + 6 new)
  fatality: boolean;
  surgery: boolean;
  medsVsLimits: boolean;
  hospitalization: boolean;
  lossOfConsciousness: boolean;
  aggFactors: boolean;
  objectiveInjuries: boolean;
  pedestrianPregnancy: boolean;
  lifeCarePlanner: boolean;
  injections: boolean;
  emsHeavyImpact: boolean;
  // Additional factors from CP1 methodology
  confirmedFractures: boolean;
  lacerations: boolean;
  priorSurgery: boolean; // Surgical Recommendation (not yet completed)
  pregnancy: boolean;
  painLevel5Plus: boolean;
  eggshell69Plus: boolean;
}

export interface CP1DataShape {
  byCoverage: {
    coverage: string;
    count: number;
    noCP: number;
    yes: number;
    total: number;
    cp1Rate: number;
    reserves: number;
  }[];
  biByAge: { age: string; noCP: number; yes: number; total: number }[];
  biTotal: { noCP: number; yes: number; total: number };
  totals: { noCP: number; yes: number; grandTotal: number };
  cp1Rate: string;
  byStatus: {
    inProgress: number;
    settled: number;
    inProgressPct: string;
    settledPct: string;
  };
}

export interface CP1TriggerSummary {
  fatalityCount: number;
  surgeryCount: number;
  medsVsLimitsCount: number;
  hospitalizationCount: number;
  lossOfConsciousnessCount: number;
  aggFactorsCount: number;
  objectiveInjuriesCount: number;
  pedestrianPregnancyCount: number;
  lifeCarePlannerCount: number;
  injectionsCount: number;
  emsHeavyImpactCount: number;
  // Additional factors
  confirmedFracturesCount: number;
  lacerationsCount: number;
  priorSurgeryCount: number;
  pregnancyCount: number;
  painLevel5PlusCount: number;
  eggshell69PlusCount: number;
}

export interface MultiFlagGroup {
  flagCount: number;
  label: string;
  claimCount: number;
  claims: CP1CsvClaim[];
}

// Week-over-week delta tracking
export interface CP1WeekOverWeekDelta {
  totalClaims: { current: number; prior: number; delta: number; pctChange: number };
  cp1Rate: { current: number; prior: number; delta: number };
  totalReserves: { current: number; prior: number; delta: number; pctChange: number };
  totalFlags: { current: number; prior: number; delta: number; pctChange: number };
  highRiskClaims: { current: number; prior: number; delta: number; pctChange: number };
  age365Plus: { current: number; prior: number; delta: number; pctChange: number };
  age181To365: { current: number; prior: number; delta: number; pctChange: number };
  priorSnapshotDate: string | null;
  hasValidPrior: boolean;
}

export interface CP1CsvAnalysis {
  dataDate: string;
  cp1Data: CP1DataShape;
  rawClaims: CP1CsvClaim[];
  fatalitySummary: CP1TriggerSummary;
  multiFlagGroups: MultiFlagGroup[];
  totalFlagInstances: number;
  weekOverWeek: CP1WeekOverWeekDelta | null;
}

function parseCurrency(val: string): number {
  if (!val) return 0;
  const cleaned = String(val).replace(/[$,\s]/g, "").trim();
  if (!cleaned || cleaned === "(blank)" || cleaned.toLowerCase() === "blank") return 0;
  if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    return -Number(cleaned.slice(1, -1)) || 0;
  }
  return Number(cleaned) || 0;
}

function yesish(val: unknown): boolean {
  const s = String(val ?? "").trim().toLowerCase();
  return s === "yes" || s === "y" || s === "true" || s === "1";
}

function normalize(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}

const NON_WORKABLE_STATUSES = new Set(
  [
    "settled pending docs",
    "conditional",
    "court approval pending",
    "settled pending drafting instructions",
    "pending friendly suits",
    "pending payment",
    "future medical release",
    "past medical release",
    "spd-lit",
    "passed/future medical release",
    "limits tendered cp1", // Exclude Limits Tendered CP1 from workable claims
  ].map((s) => s.toLowerCase())
);

function isNonWorkableRow(row: Record<string, string>): boolean {
  const status = normalize(row["Status"]);
  const biStatus = normalize(row["BI Status"]);
  const evalPhase = normalize(row["Evaluation Phase"]);

  // Exact matches (user-provided list)
  if (NON_WORKABLE_STATUSES.has(status) || NON_WORKABLE_STATUSES.has(biStatus)) return true;
  
  // Exclude Limits Tendered CP1 claims from evaluation phase as well
  if (evalPhase.includes("limits tendered cp1")) return true;

  // Broad guardrails (covers variants like "Settled" / "Settled - ...")
  if (status.includes("settled") || biStatus.includes("settled")) return true;
  if (status.includes("spd") || biStatus.includes("spd")) return true;

  return false;
}

// Helper to calculate percentage change
function pctChange(current: number, prior: number): number {
  if (prior === 0) return current > 0 ? 100 : 0;
  return ((current - prior) / prior) * 100;
}

export function useCP1AnalysisCsv(sourcePath: string = "/data/cp1-analysis.csv") {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOverWeek, setWeekOverWeek] = useState<CP1WeekOverWeekDelta | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${sourcePath}?t=${Date.now()}`);
        if (!res.ok) throw new Error(`Failed to load CP1 CSV (${res.status})`);
        const csvText = await res.text();

        const parsed = Papa.parse<Record<string, string>>(csvText, {
          header: true,
          skipEmptyLines: true,
        });

        const parsedRows = (parsed.data || []).filter(Boolean) as Record<string, string>[];

        if (!cancelled) {
          setRows(parsedRows);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load CP1 analysis CSV");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sourcePath]);

  // Process raw CSV data into structured format
  const processedData = useMemo(() => {
    if (!rows.length) return null;

    // CP1 box must ONLY reflect this CSV.
    const workable = rows.filter((r) => !isNonWorkableRow(r));

    const claims: CP1CsvClaim[] = workable.map((r) => {
      const claimNumber = r["Claim#"] || "";
      const claimant = r["Claimant"] || "";
      const coverage = (r["Coverage"] || "").trim();
      const days = Number(r["Open/Closed Days"] || 0) || 0;
      const ageBucket = (r["Age"] || "").trim();
      const typeGroup = (r["Type Group"] || "").trim();
      const teamGroup = (r["Team Group"] || "").trim();
      const adjuster = (r["Adjuster Assigned"] || "").trim();
      const impactSeverity = (r["Impact Severity"] || "").trim();
      const openReserves = parseCurrency(r["Open Reserves"]);
      const totalPaid = parseCurrency(r["Total Paid"]);

      // CP1 flags
      const cp1Flag = (r["CP1 Claim Flag"] || "").trim();
      const overallCP1 = (r["Overall CP1 Flag"] || "").trim();
      const biStatus = (r["BI Status"] || "").trim();
      const evaluationPhase = (r["Evaluation Phase"] || "").trim();
      
      // Parse claimant age and end pain level for derived factors
      const claimantAge = Number(r["Claimant Age"] || 0) || 0;
      const endPainLevelRaw = (r["End Pain Level"] || "").trim();
      const endPainLevel = endPainLevelRaw && !isNaN(Number(endPainLevelRaw)) ? Number(endPainLevelRaw) : null;
      
      // Additional factors from Injury Incident columns
      const confirmedFractures = yesish(r["Injury Incident - Confirmed Fractures"]);
      const lacerations = yesish(r["Injury Incident - Lacerations"]);
      const priorSurgery = yesish(r["Injury Incident - Prior Surgery"]);
      const pregnancy = yesish(r["Injury Incident - Pregnancy"]);
      
      // Derived flags
      const painLevel5Plus = endPainLevel !== null && endPainLevel >= 5;
      const eggshell69Plus = claimantAge >= 69;

      return {
        claimNumber,
        claimant,
        coverage,
        days,
        ageBucket,
        typeGroup,
        teamGroup,
        adjuster,
        impactSeverity,
        openReserves,
        totalPaid,
        cp1Flag,
        overallCP1,
        biStatus,
        evaluationPhase,
        claimantAge,
        endPainLevel,

        // 11 UPPERCASE trigger flags from CSV
        fatality: yesish(r["FATALITY"]),
        surgery: yesish(r["SURGERY"]),
        medsVsLimits: yesish(r["MEDS VS LIMITS"]),
        hospitalization: yesish(r["HOSPITALIZATION"]),
        lossOfConsciousness: yesish(r["LOSS OF CONSCIOUSNESS"]),
        aggFactors: yesish(r["AGGRAVATING FACTORS"]),
        objectiveInjuries: yesish(r["OBJECTIVE INJURIES"]),
        pedestrianPregnancy: yesish(r["PEDESTRIAN/MOTORCYCLIST/BICYCLIST/PREGNANCY"]),
        lifeCarePlanner: yesish(r["LIFE CARE PLANNER"]),
        injections: yesish(r["INJECTIONS"]),
        emsHeavyImpact: yesish(r["EMS + HEAVY IMPACT"]),
        
        // Additional factors
        confirmedFractures,
        lacerations,
        priorSurgery,
        pregnancy,
        painLevel5Plus,
        eggshell69Plus,
      };
    });

    // All rows are CP1
    const total = claims.length;
    const cp1Yes = total;

    // Coverage breakdown
    const byCoverageMap = new Map<string, { coverage: string; yes: number; noCP: number; total: number; reserves: number }>();
    for (const c of claims) {
      const key = c.coverage || "(blank)";
      if (!byCoverageMap.has(key)) byCoverageMap.set(key, { coverage: key, yes: 0, noCP: 0, total: 0, reserves: 0 });
      const acc = byCoverageMap.get(key)!;
      acc.total += 1;
      acc.reserves += c.openReserves;
      acc.yes += 1;
    }

    const byCoverage = Array.from(byCoverageMap.values())
      .map((r) => ({
        coverage: r.coverage,
        count: r.total,
        noCP: 0,
        yes: r.total,
        total: r.total,
        cp1Rate: r.total > 0 ? 100 : 0,
        reserves: r.reserves,
      }))
      .sort((a, b) => b.total - a.total);

    // BI claims by age
    const biClaims = claims.filter((c) => normalize(c.coverage) === "bi");
    const ageOrder = ["365+ days", "181-365 days", "61-180 days", "under 60 days"];

    const biAgeMap = new Map<string, { noCP: number; yes: number; total: number }>();
    for (const c of biClaims) {
      const ageKey = normalize(c.ageBucket) || "unknown";
      if (!biAgeMap.has(ageKey)) biAgeMap.set(ageKey, { noCP: 0, yes: 0, total: 0 });
      const acc = biAgeMap.get(ageKey)!;
      acc.total += 1;
      acc.yes += 1;
    }

    const biByAge = Array.from(biAgeMap.entries())
      .sort((a, b) => {
        const ai = ageOrder.indexOf(a[0]);
        const bi = ageOrder.indexOf(b[0]);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a[0].localeCompare(b[0]);
      })
      .map(([age, v]) => ({
        age:
          age === "365+ days"
            ? "365+ Days"
            : age === "181-365 days"
              ? "181-365 Days"
              : age === "61-180 days"
                ? "61-180 Days"
                : age === "under 60 days"
                  ? "Under 60 Days"
                  : age,
        ...v,
      }));

    const biTotal = {
      noCP: 0,
      yes: biByAge.reduce((s, r) => s + r.yes, 0),
      total: biByAge.reduce((s, r) => s + r.total, 0),
    };

    const byStatus = (() => {
      const settled = claims.filter((c) => normalize(c.biStatus).includes("settled")).length;
      const inProgress = claims.filter((c) => normalize(c.biStatus) === "in progress").length;
      const denom = claims.length || 1;
      return {
        inProgress,
        settled,
        inProgressPct: ((inProgress / denom) * 100).toFixed(1),
        settledPct: ((settled / denom) * 100).toFixed(1),
      };
    })();

    const fatalitySummary: CP1TriggerSummary = {
      fatalityCount: claims.filter((c) => c.fatality).length,
      surgeryCount: claims.filter((c) => c.surgery).length,
      medsVsLimitsCount: claims.filter((c) => c.medsVsLimits).length,
      hospitalizationCount: claims.filter((c) => c.hospitalization).length,
      lossOfConsciousnessCount: claims.filter((c) => c.lossOfConsciousness).length,
      aggFactorsCount: claims.filter((c) => c.aggFactors).length,
      objectiveInjuriesCount: claims.filter((c) => c.objectiveInjuries).length,
      pedestrianPregnancyCount: claims.filter((c) => c.pedestrianPregnancy).length,
      lifeCarePlannerCount: claims.filter((c) => c.lifeCarePlanner).length,
      injectionsCount: claims.filter((c) => c.injections).length,
      emsHeavyImpactCount: claims.filter((c) => c.emsHeavyImpact).length,
      confirmedFracturesCount: claims.filter((c) => c.confirmedFractures).length,
      lacerationsCount: claims.filter((c) => c.lacerations).length,
      priorSurgeryCount: claims.filter((c) => c.priorSurgery).length,
      pregnancyCount: claims.filter((c) => c.pregnancy).length,
      painLevel5PlusCount: claims.filter((c) => c.painLevel5Plus).length,
      eggshell69PlusCount: claims.filter((c) => c.eggshell69Plus).length,
    };

    // Count flags per claim for multi-flag grouping
    const countFlags = (c: CP1CsvClaim): number => {
      let count = 0;
      if (c.fatality) count++;
      if (c.surgery) count++;
      if (c.medsVsLimits) count++;
      if (c.hospitalization) count++;
      if (c.lossOfConsciousness) count++;
      if (c.aggFactors) count++;
      if (c.objectiveInjuries) count++;
      if (c.pedestrianPregnancy) count++;
      if (c.lifeCarePlanner) count++;
      if (c.injections) count++;
      if (c.emsHeavyImpact) count++;
      if (c.confirmedFractures) count++;
      if (c.lacerations) count++;
      if (c.priorSurgery) count++;
      if (c.pregnancy) count++;
      if (c.painLevel5Plus) count++;
      if (c.eggshell69Plus) count++;
      return count;
    };

    // Group claims by flag count
    const flagCountMap = new Map<number, CP1CsvClaim[]>();
    let totalFlagInstances = 0;
    for (const c of claims) {
      const fc = countFlags(c);
      totalFlagInstances += fc;
      if (!flagCountMap.has(fc)) flagCountMap.set(fc, []);
      flagCountMap.get(fc)!.push(c);
    }

    const multiFlagGroups: MultiFlagGroup[] = Array.from(flagCountMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([flagCount, claimsList]) => ({
        flagCount,
        label: flagCount === 1 ? "1 Flag" : `${flagCount} Flags`,
        claimCount: claimsList.length,
        claims: claimsList,
      }));

    // Calculate age buckets
    const age365Plus = claims.filter(c => normalize(c.ageBucket).includes("365")).length;
    const age181To365 = claims.filter(c => normalize(c.ageBucket).includes("181")).length;
    const age61To180 = claims.filter(c => normalize(c.ageBucket).includes("61-180")).length;
    const ageUnder60 = claims.filter(c => normalize(c.ageBucket).includes("under 60")).length;

    // High risk = 3+ flags
    const highRiskClaims = claims.filter(c => countFlags(c) >= 3).length;

    // Total reserves
    const totalReserves = claims.reduce((sum, c) => sum + c.openReserves, 0);

    const cp1Data: CP1DataShape = {
      byCoverage,
      biByAge,
      biTotal,
      totals: { noCP: 0, yes: cp1Yes, grandTotal: total },
      cp1Rate: total > 0 ? "100.0" : "0.0",
      byStatus,
    };

    return {
      dataDate: new Date().toISOString().slice(0, 10),
      cp1Data,
      rawClaims: claims,
      fatalitySummary,
      multiFlagGroups,
      totalFlagInstances,
      // For snapshot
      snapshotMetrics: {
        totalClaims: total,
        cp1Rate: 100.0, // All claims in this CSV are CP1
        biClaims: biClaims.length,
        biCp1Rate: 100.0,
        totalReserves,
        totalFlags: totalFlagInstances,
        highRiskClaims,
        age365Plus,
        age181To365,
        age61To180,
        ageUnder60,
        flagBreakdown: {
          fatality: fatalitySummary.fatalityCount,
          surgery: fatalitySummary.surgeryCount,
          medsVsLimits: fatalitySummary.medsVsLimitsCount,
          hospitalization: fatalitySummary.hospitalizationCount,
          lossOfConsciousness: fatalitySummary.lossOfConsciousnessCount,
          aggFactors: fatalitySummary.aggFactorsCount,
          objectiveInjuries: fatalitySummary.objectiveInjuriesCount,
          pedestrianPregnancy: fatalitySummary.pedestrianPregnancyCount,
          lifeCarePlanner: fatalitySummary.lifeCarePlannerCount,
          injections: fatalitySummary.injectionsCount,
          emsHeavyImpact: fatalitySummary.emsHeavyImpactCount,
        },
        coverageBreakdown: Object.fromEntries(byCoverage.map(c => [c.coverage, c.count])),
      }
    };
  }, [rows]);

  // Save snapshot and calculate WoW delta
  useEffect(() => {
    if (!processedData) return;

    const today = format(new Date(), "yyyy-MM-dd");
    const priorWeekDate = format(subDays(new Date(), 7), "yyyy-MM-dd");
    const metrics = processedData.snapshotMetrics;

    async function saveAndCompare() {
      try {
        // Upsert today's snapshot
        const { error: upsertError } = await supabase
          .from("cp1_snapshots")
          .upsert({
            snapshot_date: today,
            total_claims: metrics.totalClaims,
            cp1_rate: metrics.cp1Rate,
            bi_claims: metrics.biClaims,
            bi_cp1_rate: metrics.biCp1Rate,
            total_reserves: metrics.totalReserves,
            total_flags: metrics.totalFlags,
            high_risk_claims: metrics.highRiskClaims,
            age_365_plus: metrics.age365Plus,
            age_181_365: metrics.age181To365,
            age_61_180: metrics.age61To180,
            age_under_60: metrics.ageUnder60,
            flag_breakdown: metrics.flagBreakdown,
            coverage_breakdown: metrics.coverageBreakdown,
          }, { onConflict: "snapshot_date" });

        if (upsertError) {
          console.error("Error saving CP1 snapshot:", upsertError);
        }

        // Fetch prior week's snapshot (closest to 7 days ago)
        const { data: priorSnapshots, error: fetchError } = await supabase
          .from("cp1_snapshots")
          .select("*")
          .lte("snapshot_date", priorWeekDate)
          .order("snapshot_date", { ascending: false })
          .limit(1);

        if (fetchError) {
          console.error("Error fetching prior snapshot:", fetchError);
          return;
        }

        const prior = priorSnapshots?.[0];
        
        if (prior) {
          const delta: CP1WeekOverWeekDelta = {
            totalClaims: {
              current: metrics.totalClaims,
              prior: prior.total_claims,
              delta: metrics.totalClaims - prior.total_claims,
              pctChange: pctChange(metrics.totalClaims, prior.total_claims),
            },
            cp1Rate: {
              current: metrics.cp1Rate,
              prior: Number(prior.cp1_rate),
              delta: metrics.cp1Rate - Number(prior.cp1_rate),
            },
            totalReserves: {
              current: metrics.totalReserves,
              prior: Number(prior.total_reserves),
              delta: metrics.totalReserves - Number(prior.total_reserves),
              pctChange: pctChange(metrics.totalReserves, Number(prior.total_reserves)),
            },
            totalFlags: {
              current: metrics.totalFlags,
              prior: prior.total_flags,
              delta: metrics.totalFlags - prior.total_flags,
              pctChange: pctChange(metrics.totalFlags, prior.total_flags),
            },
            highRiskClaims: {
              current: metrics.highRiskClaims,
              prior: prior.high_risk_claims,
              delta: metrics.highRiskClaims - prior.high_risk_claims,
              pctChange: pctChange(metrics.highRiskClaims, prior.high_risk_claims),
            },
            age365Plus: {
              current: metrics.age365Plus,
              prior: prior.age_365_plus,
              delta: metrics.age365Plus - prior.age_365_plus,
              pctChange: pctChange(metrics.age365Plus, prior.age_365_plus),
            },
            age181To365: {
              current: metrics.age181To365,
              prior: prior.age_181_365,
              delta: metrics.age181To365 - prior.age_181_365,
              pctChange: pctChange(metrics.age181To365, prior.age_181_365),
            },
            priorSnapshotDate: prior.snapshot_date,
            hasValidPrior: true,
          };
          setWeekOverWeek(delta);
        } else {
          // No prior data available
          setWeekOverWeek({
            totalClaims: { current: metrics.totalClaims, prior: 0, delta: 0, pctChange: 0 },
            cp1Rate: { current: metrics.cp1Rate, prior: 0, delta: 0 },
            totalReserves: { current: metrics.totalReserves, prior: 0, delta: 0, pctChange: 0 },
            totalFlags: { current: metrics.totalFlags, prior: 0, delta: 0, pctChange: 0 },
            highRiskClaims: { current: metrics.highRiskClaims, prior: 0, delta: 0, pctChange: 0 },
            age365Plus: { current: metrics.age365Plus, prior: 0, delta: 0, pctChange: 0 },
            age181To365: { current: metrics.age181To365, prior: 0, delta: 0, pctChange: 0 },
            priorSnapshotDate: null,
            hasValidPrior: false,
          });
        }
      } catch (err) {
        console.error("Error in CP1 snapshot logic:", err);
      }
    }

    saveAndCompare();
  }, [processedData]);

  // Combine processed data with WoW delta
  const data = useMemo<CP1CsvAnalysis | null>(() => {
    if (!processedData) return null;
    
    return {
      dataDate: processedData.dataDate,
      cp1Data: processedData.cp1Data,
      rawClaims: processedData.rawClaims,
      fatalitySummary: processedData.fatalitySummary,
      multiFlagGroups: processedData.multiFlagGroups,
      totalFlagInstances: processedData.totalFlagInstances,
      weekOverWeek,
    };
  }, [processedData, weekOverWeek]);

  return { data, loading, error };
}
