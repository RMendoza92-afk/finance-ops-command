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
  // Trigger flags (all from user's list)
  fatality: boolean;
  surgery: boolean;
  medsVsLimits: boolean;
  hospitalization: boolean;
  lossOfConsciousness: boolean;
  lacerations: boolean;
  pedestrianMotorcyclist: boolean;
  duiDwiHitRun: boolean;
  lifeCarePlanner: boolean;
  confirmedFractures: boolean;
  aggFactorsDui: boolean;
  fledScene: boolean;
  priorSurgery: boolean;
  pregnancy: boolean;
  ambulanceUsed: boolean;
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
  lacerationsCount: number;
  pedestrianMotorcyclistCount: number;
  duiDwiHitRunCount: number;
  lifeCarePlannerCount: number;
  confirmedFracturesCount: number;
  aggFactorsDuiCount: number;
  fledSceneCount: number;
  priorSurgeryCount: number;
  pregnancyCount: number;
  ambulanceUsedCount: number;
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

        // Trigger flags: use prefix-match so column-name noise/line-breaks don't break counts
        fatality: yesish(getByPrefix(r, "Injury Incident - Fatality")),
        surgery: yesish(getByPrefix(r, "Injury Incident - Surgery")),
        medsVsLimits: yesish(getByPrefix(r, "Injury Incident - Meds Greater Than Policy Limits")),
        hospitalization: yesish(getByPrefix(r, "Injury Incident - Hospitalization")),
        lossOfConsciousness: yesish(getByPrefix(r, "Injury Incident - Loss of Consciousness")),
        lacerations: yesish(getByPrefix(r, "Injury Incident - Lacerations")),
        pedestrianMotorcyclist: yesish(getByPrefix(r, "Injury Incident - Pedestrian")),
        duiDwiHitRun: yesish(getByPrefix(r, "Injury Incident - DUI")),
        lifeCarePlanner: yesish(getByPrefix(r, "Injury Incident - Life Care Planner")),
        confirmedFractures: yesish(getByPrefix(r, "Injury Incident - Confirmed Fractures")),
        aggFactorsDui: yesish(getByPrefix(r, "Injury Incident - Agg Factors DUI")),
        fledScene: yesish(getByPrefix(r, "Injury Incident - Fled Scene")),
        priorSurgery: yesish(getByPrefix(r, "Injury Incident - Prior Surgery")),
        pregnancy: yesish(getByPrefix(r, "Injury Incident - Pregnancy")),
        ambulanceUsed: yesish(getByPrefix(r, "Injury Incident - Ambulance")),
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
      lacerationsCount: claims.filter((c) => c.lacerations).length,
      pedestrianMotorcyclistCount: claims.filter((c) => c.pedestrianMotorcyclist).length,
      duiDwiHitRunCount: claims.filter((c) => c.duiDwiHitRun).length,
      lifeCarePlannerCount: claims.filter((c) => c.lifeCarePlanner).length,
      confirmedFracturesCount: claims.filter((c) => c.confirmedFractures).length,
      aggFactorsDuiCount: claims.filter((c) => c.aggFactorsDui).length,
      fledSceneCount: claims.filter((c) => c.fledScene).length,
      priorSurgeryCount: claims.filter((c) => c.priorSurgery).length,
      pregnancyCount: claims.filter((c) => c.pregnancy).length,
      ambulanceUsedCount: claims.filter((c) => c.ambulanceUsed).length,
    };

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
    };
  }, [rows]);

  return { data, loading, error };
}
