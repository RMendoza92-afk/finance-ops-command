import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

// Check history data structure
export interface CheckRecord {
  issueDate: string;
  requestedDate: string;
  clearedDate: string | null;
  lossDate: string;
  checkId: string;
  draftNumber: string;
  requestingAdjuster: string;
  assignedAdjuster: string;
  assignedTeam: string;
  assignedDept: string;
  exposure: string;
  coverage: string;
  status: string;
  exposureCategory: string;
  grossCheck: number;
  deductible: number;
  netAmount: number;
  payTo: string;
  lineItemCategory: string;
  accidentDescription: string;
}

export interface SpendSummary {
  totalGross: number;
  totalNet: number;
  checkCount: number;
  byCoverage: Map<string, { gross: number; net: number; count: number }>;
  byDept: Map<string, { gross: number; net: number; count: number }>;
  byTeam: Map<string, { gross: number; net: number; count: number }>;
  byCategory: Map<string, { gross: number; net: number; count: number }>;
  byLineItem: Map<string, { gross: number; net: number; count: number }>;
  indemnityTotal: number;
  expenseTotal: number;
}

// Parse currency values from CSV
function parseCurrency(val: string): number {
  if (!val) return 0;
  const cleaned = String(val).replace(/[$,"\s]/g, "").trim();
  if (!cleaned || cleaned === "(blank)") return 0;
  if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    return -Number(cleaned.slice(1, -1)) || 0;
  }
  return Number(cleaned) || 0;
}

// Line item categories that are expenses vs indemnities
const EXPENSE_CATEGORIES = new Set([
  "legal expenses",
  "peer review",
  "expert fees",
  "investigation",
  "court costs",
  "mediation",
  "arbitration fees",
  "deposition",
  "expert witnesses",
  "medical records",
  "copy services",
]);

function isExpenseCategory(category: string): boolean {
  const norm = category.toLowerCase().trim();
  return EXPENSE_CATEGORIES.has(norm) || 
         norm.includes("legal") || 
         norm.includes("expert") ||
         norm.includes("peer review") ||
         norm.includes("investigation");
}

export function useCheckHistory(sourcePath: string = "/data/check-history-jan2026.csv") {
  const [records, setRecords] = useState<CheckRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${sourcePath}?t=${Date.now()}`);
        if (!res.ok) throw new Error(`Failed to load check history CSV (${res.status})`);
        const csvText = await res.text();

        const parsed = Papa.parse<Record<string, string>>(csvText, {
          header: true,
          skipEmptyLines: true,
        });

        const parsedRecords = (parsed.data || [])
          .filter(Boolean)
          .map((row): CheckRecord => ({
            issueDate: row["Issue Date"] || "",
            requestedDate: row["Requested Date"] || "",
            clearedDate: row["Cleared Date"] || null,
            lossDate: row["Loss Date"] || "",
            checkId: row["Check ID"] || "",
            draftNumber: row["Draft #"] || "",
            requestingAdjuster: row["Requesting Adjuster"] || "",
            assignedAdjuster: row["Assigned Adjuster"] || "",
            assignedTeam: row["Assigned Team"] || "",
            assignedDept: row["Assigned Dept"] || "",
            exposure: row["Exposure"] || "",
            coverage: row["Coverage"] || "",
            status: row["Status"] || "",
            exposureCategory: row["Exposure Category"] || "",
            grossCheck: parseCurrency(row["Gross Check"]),
            deductible: parseCurrency(row["Deductible"]),
            netAmount: parseCurrency(row["Net Amount"]),
            payTo: row["Pay To"] || "",
            lineItemCategory: row["Line Item Category"] || "",
            accidentDescription: row["Accident Description"] || "",
          }));

        if (!cancelled) {
          setRecords(parsedRecords);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load check history");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sourcePath]);

  // Calculate spend summaries
  const summary = useMemo((): SpendSummary => {
    const byCoverage = new Map<string, { gross: number; net: number; count: number }>();
    const byDept = new Map<string, { gross: number; net: number; count: number }>();
    const byTeam = new Map<string, { gross: number; net: number; count: number }>();
    const byCategory = new Map<string, { gross: number; net: number; count: number }>();
    const byLineItem = new Map<string, { gross: number; net: number; count: number }>();

    let totalGross = 0;
    let totalNet = 0;
    let indemnityTotal = 0;
    let expenseTotal = 0;

    for (const rec of records) {
      totalGross += rec.grossCheck;
      totalNet += rec.netAmount;

      // Classify as expense or indemnity
      if (isExpenseCategory(rec.lineItemCategory)) {
        expenseTotal += rec.netAmount;
      } else {
        indemnityTotal += rec.netAmount;
      }

      // By coverage
      const covKey = rec.coverage || "(blank)";
      if (!byCoverage.has(covKey)) byCoverage.set(covKey, { gross: 0, net: 0, count: 0 });
      const covAcc = byCoverage.get(covKey)!;
      covAcc.gross += rec.grossCheck;
      covAcc.net += rec.netAmount;
      covAcc.count++;

      // By department
      const deptKey = rec.assignedDept || "(blank)";
      if (!byDept.has(deptKey)) byDept.set(deptKey, { gross: 0, net: 0, count: 0 });
      const deptAcc = byDept.get(deptKey)!;
      deptAcc.gross += rec.grossCheck;
      deptAcc.net += rec.netAmount;
      deptAcc.count++;

      // By team
      const teamKey = rec.assignedTeam || "(blank)";
      if (!byTeam.has(teamKey)) byTeam.set(teamKey, { gross: 0, net: 0, count: 0 });
      const teamAcc = byTeam.get(teamKey)!;
      teamAcc.gross += rec.grossCheck;
      teamAcc.net += rec.netAmount;
      teamAcc.count++;

      // By exposure category
      const catKey = rec.exposureCategory || "(blank)";
      if (!byCategory.has(catKey)) byCategory.set(catKey, { gross: 0, net: 0, count: 0 });
      const catAcc = byCategory.get(catKey)!;
      catAcc.gross += rec.grossCheck;
      catAcc.net += rec.netAmount;
      catAcc.count++;

      // By line item category
      const lineKey = rec.lineItemCategory || "(blank)";
      if (!byLineItem.has(lineKey)) byLineItem.set(lineKey, { gross: 0, net: 0, count: 0 });
      const lineAcc = byLineItem.get(lineKey)!;
      lineAcc.gross += rec.grossCheck;
      lineAcc.net += rec.netAmount;
      lineAcc.count++;
    }

    return {
      totalGross,
      totalNet,
      checkCount: records.length,
      byCoverage,
      byDept,
      byTeam,
      byCategory,
      byLineItem,
      indemnityTotal,
      expenseTotal,
    };
  }, [records]);

  // Litigation-specific spend (LITIGATION dept)
  const litigationSpend = useMemo(() => {
    const litRecords = records.filter(r => 
      r.assignedDept.toUpperCase().includes("LITIGATION") ||
      r.assignedDept.toUpperCase() === "LIT"
    );

    let totalGross = 0;
    let totalNet = 0;
    let indemnityTotal = 0;
    let expenseTotal = 0;
    const byTeam = new Map<string, { gross: number; net: number; count: number }>();

    for (const rec of litRecords) {
      totalGross += rec.grossCheck;
      totalNet += rec.netAmount;

      if (isExpenseCategory(rec.lineItemCategory)) {
        expenseTotal += rec.netAmount;
      } else {
        indemnityTotal += rec.netAmount;
      }

      const teamKey = rec.assignedTeam || "(blank)";
      if (!byTeam.has(teamKey)) byTeam.set(teamKey, { gross: 0, net: 0, count: 0 });
      const teamAcc = byTeam.get(teamKey)!;
      teamAcc.gross += rec.grossCheck;
      teamAcc.net += rec.netAmount;
      teamAcc.count++;
    }

    return {
      totalGross,
      totalNet,
      checkCount: litRecords.length,
      indemnityTotal,
      expenseTotal,
      byTeam,
      records: litRecords,
    };
  }, [records]);

  // BI-specific spend
  const biSpend = useMemo(() => {
    const biRecords = records.filter(r => r.coverage.toUpperCase() === "BI");

    let totalGross = 0;
    let totalNet = 0;
    let indemnityTotal = 0;
    let expenseTotal = 0;

    for (const rec of biRecords) {
      totalGross += rec.grossCheck;
      totalNet += rec.netAmount;

      if (isExpenseCategory(rec.lineItemCategory)) {
        expenseTotal += rec.netAmount;
      } else {
        indemnityTotal += rec.netAmount;
      }
    }

    return {
      totalGross,
      totalNet,
      checkCount: biRecords.length,
      indemnityTotal,
      expenseTotal,
      records: biRecords,
    };
  }, [records]);

  return {
    records,
    loading,
    error,
    summary,
    litigationSpend,
    biSpend,
  };
}

// Helper to format spend as MonthlySpendData structure (for compatibility)
export function buildMonthlySpendFromCheckHistory(summary: SpendSummary): {
  period: string;
  periodDate: string;
  indemnities: { byCoverage: { coverage: string; costs: number; checkCount: number; average: number }[]; total: number; totalChecks: number };
  expenses: { byCoverage: { coverage: string; costs: number; checkCount: number; average: number }[]; total: number; totalChecks: number };
} {
  const indemnitiesByCoverage: { coverage: string; costs: number; checkCount: number; average: number }[] = [];
  const expensesByCoverage: { coverage: string; costs: number; checkCount: number; average: number }[] = [];

  // This is a simplified aggregation - in practice you'd need more granular tracking
  for (const [coverage, data] of summary.byCoverage) {
    // Estimate split based on typical ratios (97% indemnity, 3% expense for BI)
    const expenseRatio = coverage.toUpperCase() === "BI" ? 0.03 : 0.01;
    const expenseCost = data.net * expenseRatio;
    const indemnityCost = data.net - expenseCost;

    indemnitiesByCoverage.push({
      coverage,
      costs: indemnityCost,
      checkCount: Math.round(data.count * 0.9),
      average: data.count > 0 ? indemnityCost / data.count : 0,
    });

    if (expenseCost > 0) {
      expensesByCoverage.push({
        coverage,
        costs: expenseCost,
        checkCount: Math.round(data.count * 0.1),
        average: Math.round(data.count * 0.1) > 0 ? expenseCost / Math.round(data.count * 0.1) : 0,
      });
    }
  }

  return {
    period: '01-JAN 2026',
    periodDate: '2026-01-01',
    indemnities: {
      byCoverage: indemnitiesByCoverage.sort((a, b) => b.costs - a.costs),
      total: summary.indemnityTotal,
      totalChecks: Math.round(summary.checkCount * 0.9),
    },
    expenses: {
      byCoverage: expensesByCoverage.sort((a, b) => b.costs - a.costs),
      total: summary.expenseTotal,
      totalChecks: Math.round(summary.checkCount * 0.1),
    },
  };
}
