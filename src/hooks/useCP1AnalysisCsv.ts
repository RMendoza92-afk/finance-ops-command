import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

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
  openReserves: number;
  cp1Flag: string;
  overallCP1: string;
  biStatus: string;
  evaluationPhase: string;
  // 11 uppercase trigger flags from CSV
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
}

export interface MultiFlagGroup {
  flagCount: number;
  label: string;
  claimCount: number;
  claims: CP1CsvClaim[];
}

export interface CP1CsvAnalysis {
  dataDate: string;
  cp1Data: CP1DataShape;
  rawClaims: CP1CsvClaim[];
  fatalitySummary: CP1TriggerSummary;
  multiFlagGroups: MultiFlagGroup[];
  totalFlagInstances: number;
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
  ].map((s) => s.toLowerCase())
);

function isNonWorkableRow(row: Record<string, string>): boolean {
  const status = normalize(row["Status"]);
  const biStatus = normalize(row["BI Status"]);

  // Exact matches (user-provided list)
  if (NON_WORKABLE_STATUSES.has(status) || NON_WORKABLE_STATUSES.has(biStatus)) return true;

  // Broad guardrails (covers variants like "Settled" / "Settled - ...")
  if (status.includes("settled") || biStatus.includes("settled")) return true;
  if (status.includes("spd") || biStatus.includes("spd")) return true;

  return false;
}

export function useCP1AnalysisCsv(sourcePath: string = "/data/cp1-analysis.csv") {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const data = useMemo<CP1CsvAnalysis | null>(() => {
    if (!rows.length) return null;

    // CP1 box must ONLY reflect this CSV.
    const workable = rows.filter((r) => !isNonWorkableRow(r));

    const getByPrefix = (row: Record<string, string>, prefix: string): string => {
      const p = normalize(prefix);
      const key = Object.keys(row).find((k) => normalize(k).startsWith(p));
      return key ? row[key] : "";
    };

    const claims: CP1CsvClaim[] = workable.map((r) => {
      const claimNumber = r["Claim#"] || "";
      const claimant = r["Claimant"] || "";
      const coverage = (r["Coverage"] || "").trim();
      const days = Number(r["Open/Closed Days"] || 0) || 0;
      const ageBucket = (r["Age"] || "").trim();
      const typeGroup = (r["Type Group"] || "").trim();
      const teamGroup = (r["Team Group"] || "").trim();
      const openReserves = parseCurrency(r["Open Reserves"]);

      // CP1 flags (different exports sometimes vary slightly)
      const cp1Flag = (r["CP1 Claim Flag"] || "").trim();
      const overallCP1 = (r["Overall CP1 Flag"] || "").trim();
      const biStatus = (r["BI Status"] || "").trim();
      const evaluationPhase = (r["Evaluation Phase"] || "").trim();

      return {
        claimNumber,
        claimant,
        coverage,
        days,
        ageBucket,
        typeGroup,
        teamGroup,
        openReserves,
        cp1Flag,
        overallCP1,
        biStatus,
        evaluationPhase,

        // 11 UPPERCASE trigger flags from CSV (exact column names)
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
      };
    });

    // IMPORTANT per your request:
    // This CP1 Analysis view is CP1-only and should not surface "No CP" anywhere.
    // So totals treat ALL rows as CP1.
    const total = claims.length;
    const cp1Yes = total;
    const cp1No = 0;

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
      .sort((a, b) => b[0] - a[0]) // Sort descending by flag count
      .map(([flagCount, claimsList]) => ({
        flagCount,
        label: flagCount === 1 ? "1 Flag" : `${flagCount} Flags`,
        claimCount: claimsList.length,
        claims: claimsList,
      }));

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
    };
  }, [rows]);

  return { data, loading, error };
}
