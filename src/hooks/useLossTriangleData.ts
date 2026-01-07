import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TriangleDataPoint {
  accidentYear: number;
  developmentMonths: number;
  metricType: string;
  amount: number;
}

export interface LossTriangleSummary {
  accidentYear: number;
  writtenPremium: number;
  earnedPremium: number;
  netPaidLoss: number;
  claimReserves: number;
  bulkIbnr: number;
  lossRatio: number;
  reportedLossRatio: number;
  grossPaid: number;
  paidAlae: number;
  salvageSubro: number;
  dcceReserves: number;
  ultimateIncurred: number;
  developmentAge: number; // Latest development month
}

export interface LossTriangleData {
  rawData: TriangleDataPoint[];
  summaryByAY: LossTriangleSummary[];
  loading: boolean;
  error: string | null;
}

export function useLossTriangleData() {
  const [data, setData] = useState<LossTriangleData>({
    rawData: [],
    summaryByAY: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchTriangleData = async () => {
      try {
        const { data: triangleData, error } = await supabase
          .from("loss_development_triangles")
          .select("*")
          .order("accident_year", { ascending: false })
          .order("development_months", { ascending: true });

        if (error) throw error;

        const rawData: TriangleDataPoint[] = (triangleData || []).map((r) => ({
          accidentYear: r.accident_year,
          developmentMonths: r.development_months,
          metricType: r.metric_type,
          amount: Number(r.amount) || 0,
        }));

        // Build summary by accident year - get latest development point for each metric
        const accidentYears = [...new Set(rawData.map((d) => d.accidentYear))].sort((a, b) => b - a);

        const summaryByAY: LossTriangleSummary[] = accidentYears.map((ay) => {
          const ayData = rawData.filter((d) => d.accidentYear === ay);

          const getLatest = (metricType: string): number => {
            const metric = ayData
              .filter((d) => d.metricType === metricType)
              .sort((a, b) => b.developmentMonths - a.developmentMonths)[0];
            return metric?.amount || 0;
          };

          const getLatestDevMonth = (): number => {
            const months = ayData.map((d) => d.developmentMonths);
            return Math.max(...months, 0);
          };

          const earnedPremium = getLatest("earned_premium");
          const netPaidLoss = getLatest("net_paid_loss");
          const claimReserves = getLatest("claim_reserves");
          const bulkIbnr = getLatest("bulk_ibnr");
          const ultimateIncurred = netPaidLoss + claimReserves + bulkIbnr;

          return {
            accidentYear: ay,
            writtenPremium: getLatest("written_premium"),
            earnedPremium,
            netPaidLoss,
            claimReserves,
            bulkIbnr,
            lossRatio: getLatest("loss_ratio"),
            reportedLossRatio: getLatest("reported_loss_ratio"),
            grossPaid: getLatest("gross_paid"),
            paidAlae: getLatest("paid_alae"),
            salvageSubro: getLatest("salvage_subro"),
            dcceReserves: getLatest("dcce_reserves"),
            ultimateIncurred,
            developmentAge: getLatestDevMonth(),
          };
        });

        setData({ rawData, summaryByAY, loading: false, error: null });
      } catch (err) {
        console.error("Error fetching triangle data:", err);
        setData((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to fetch triangle data",
        }));
      }
    };

    fetchTriangleData();
  }, []);

  return data;
}
