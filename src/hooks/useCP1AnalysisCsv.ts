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
  // Trigger flags
  fatality: boolean;
  surgery: boolean;
  hospitalization: boolean;
  medsVsLimits: boolean;
  lossOfConsciousness: boolean;
  aggravatingFactors: boolean;
  objectiveInjuries: boolean;
  pedestrianMotorcyclist: boolean;
  pregnancy: boolean;
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
  hospitalizationCount: number;
  medsVsLimitsCount: number;
  lossOfConsciousnessCount: number;
  aggravatingFactorsCount: number;
  objectiveInjuriesCount: number;
  pedestrianMotorcyclistCount: number;
  pregnancyCount: number;
  lifeCarePlannerCount: number;
  injectionsCount: number;
  emsHeavyImpactCount: number;
}

export interface CP1CsvAnalysis {
  dataDate: string;
  cp1Data: CP1DataShape;
  rawClaims: CP1CsvClaim[];
  fatalitySummary: CP1TriggerSummary;
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

    const claims: CP1CsvClaim[] = workable.map((r) => {
      const claimNumber = r["Claim#"] || "";
      const claimant = r["Claimant"] || "";
      const coverage = (r["Coverage"] || "").trim();
      const days = Number(r["Open/Closed Days"] || 0) || 0;
      const ageBucket = (r["Age"] || "").trim();
      const typeGroup = (r["Type Group"] || "").trim();
      const teamGroup = (r["Team Group"] || "").trim();
      const openReserves = parseCurrency(r["Open Reserves"]);
      const cp1Flag = (r["CP1 Claim Flag"] || "").trim();
      const overallCP1 = (r["Overall CP1 Flag"] || "").trim();
      const biStatus = (r["BI Status"] || "").trim();

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
        fatality: yesish(r["Injury Incident - Fatality"]),
        surgery: yesish(r["Injury Incident - Surgery"]),
        medsVsLimits: yesish(r["Injury Incident - Meds Greater Than Policy Limits"]),
        hospitalization: yesish(r["Injury Incident - Hospitalization and Hospitalized"]),
        lossOfConsciousness: yesish(r["Injury Incident - Loss of Consciousness"]),
        aggravatingFactors: yesish(r["Injury Incident - Aggravating Factors"]),
        objectiveInjuries: yesish(r["Injury Incident - Objective Injuries"]),
        pedestrianMotorcyclist: yesish(r["Injury Incident - Pedestrian and Motorcyclist"]),
        pregnancy: yesish(r["Injury Incident - Pregnancy"]),
        lifeCarePlanner: yesish(r["Injury Incident - Life Care Planner"]),
        injections: yesish(r["Injury Incident - Injections"]),
        emsHeavyImpact: yesish(r["Injury Incident - EMS + Heavy Impact"]),
      };
    });

    const total = claims.length;
    const cp1Yes = claims.filter((c) => normalize(c.overallCP1) === "yes").length;
    const cp1No = total - cp1Yes;

    const byCoverageMap = new Map<string, { coverage: string; yes: number; noCP: number; total: number; reserves: number }>();
    for (const c of claims) {
      const key = c.coverage || "(blank)";
      if (!byCoverageMap.has(key)) byCoverageMap.set(key, { coverage: key, yes: 0, noCP: 0, total: 0, reserves: 0 });
      const acc = byCoverageMap.get(key)!;
      acc.total += 1;
      acc.reserves += c.openReserves;
      if (normalize(c.overallCP1) === "yes") acc.yes += 1;
      else acc.noCP += 1;
    }

    const byCoverage = Array.from(byCoverageMap.values())
      .map((r) => ({
        coverage: r.coverage,
        count: r.total,
        noCP: r.noCP,
        yes: r.yes,
        total: r.total,
        cp1Rate: r.total > 0 ? Number(((r.yes / r.total) * 100).toFixed(1)) : 0,
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
      if (normalize(c.overallCP1) === "yes") acc.yes += 1;
      else acc.noCP += 1;
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
      noCP: biByAge.reduce((s, r) => s + r.noCP, 0),
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
      hospitalizationCount: claims.filter((c) => c.hospitalization).length,
      medsVsLimitsCount: claims.filter((c) => c.medsVsLimits).length,
      lossOfConsciousnessCount: claims.filter((c) => c.lossOfConsciousness).length,
      aggravatingFactorsCount: claims.filter((c) => c.aggravatingFactors).length,
      objectiveInjuriesCount: claims.filter((c) => c.objectiveInjuries).length,
      pedestrianMotorcyclistCount: claims.filter((c) => c.pedestrianMotorcyclist).length,
      pregnancyCount: claims.filter((c) => c.pregnancy).length,
      lifeCarePlannerCount: claims.filter((c) => c.lifeCarePlanner).length,
      injectionsCount: claims.filter((c) => c.injections).length,
      emsHeavyImpactCount: claims.filter((c) => c.emsHeavyImpact).length,
    };

    const cp1Data: CP1DataShape = {
      byCoverage,
      biByAge,
      biTotal,
      totals: { noCP: cp1No, yes: cp1Yes, grandTotal: total },
      cp1Rate: total > 0 ? ((cp1Yes / total) * 100).toFixed(1) : "0.0",
      byStatus,
    };

    return {
      dataDate: new Date().toISOString().slice(0, 10),
      cp1Data,
      rawClaims: claims,
      fatalitySummary,
    };
  }, [rows]);

  return { data, loading, error };
}
