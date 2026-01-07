import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ActuarialMetrics {
  periodYear: number;
  periodQuarter: number;
  projectedLoss: number;
  priorYearLoss: number;
  ultimateLoss: number;
  laeAmount: number;
  laeRatio: number;
  developmentFactor: number;
  fixedExpenseRatio: number;
  variableExpenseRatio: number;
  totalExpenseRatio: number;
  targetExpenseRatio: number;
  selectedProfit: number;
  contingencies: number;
  investmentIncome: number;
  indicatedLevelEffect: number;
  selectedChange: number;
  credibility: number;
  trendFactor: number;
  lossRatio: number;
  targetLossRatio: number;
}

export interface CoverageRateChange {
  coverage: string;
  indicatedChange: number;
  selectedChange: number;
  premiumVolume: number;
  lossRatio: number;
  trend: string;
}

export interface StateRateChange {
  state: string;
  indicatedChange: number;
  selectedChange: number;
  policyVolume: number;
  lossRatio: number;
  filingStatus: string;
  effectiveDate: string | null;
}

export interface LossDevelopment {
  periodYear: number;
  periodQuarter: number;
  reportedLosses: number;
  paidLosses: number;
  incurredLosses: number;
  ibnr: number;
}

export interface ClaimsFrequency {
  year: number;
  month: number;
  state: string;
  reportedClaims: number;
  inForce: number;
  frequency: number;
}

export interface ClaimsPayment {
  coverage: string;
  periodYear: number;
  periodMonth: number | null;
  isYtd: boolean;
  totalPayments: number;
  claimantsPaid: number;
  avgPaidPerClaimant: number;
}

export interface OverLimitPayment {
  id: string;
  paymentDate: string;
  claimNumber: string;
  state: string;
  policyLimit: number;
  paymentAmount: number;
  overLimitAmount: number;
  coverage: string;
  issueType?: string;
}

export interface OverspendSummary {
  state: string;
  issueType: string;
  totalAmount: number;
  claimCount: number;
  periodYear: number;
}

export interface AccidentYearDevelopment {
  accidentYear: number;
  developmentMonths: number;
  asOfDate: string | null;
  coverage: string;
  category: string;
  featureCount: number;
  priorReserve: number;
  claimPayment: number;
  salvageSubro: number;
  netClaimPayment: number;
  alaePayment: number;
  reserveBalance: number;
  netChangeReserve: number;
  incurred: number;
  earnedPremium: number;
  incurredPctPremium: number;
}

export interface ActuarialData {
  metrics: ActuarialMetrics | null;
  coverageRates: CoverageRateChange[];
  stateRates: StateRateChange[];
  lossDevelopment: LossDevelopment[];
  claimsFrequency: ClaimsFrequency[];
  claimsPayments: ClaimsPayment[];
  overLimitPayments: OverLimitPayment[];
  overspendSummary: OverspendSummary[];
  accidentYearDev: AccidentYearDevelopment[];
}

export function useActuarialData(periodYear: number = 2026) {
  const [data, setData] = useState<ActuarialData>({
    metrics: null,
    coverageRates: [],
    stateRates: [],
    lossDevelopment: [],
    claimsFrequency: [],
    claimsPayments: [],
    overLimitPayments: [],
    overspendSummary: [],
    accidentYearDev: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActuarialData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch all data in parallel
        const [metricsRes, coverageRes, stateRes, lossDevRes, freqRes, paymentsRes, overLimitRes, overspendRes, ayDevRes] = await Promise.all([
          supabase
            .from("actuarial_metrics")
            .select("*")
            .eq("period_year", periodYear)
            .order("period_quarter", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("coverage_rate_changes")
            .select("*")
            .eq("period_year", periodYear)
            .order("premium_volume", { ascending: false }),
          supabase
            .from("state_rate_changes")
            .select("*")
            .eq("period_year", periodYear)
            .order("policy_volume", { ascending: false }),
          supabase
            .from("loss_development")
            .select("*")
            .order("period_year", { ascending: true })
            .order("period_quarter", { ascending: true }),
          supabase
            .from("claims_frequency")
            .select("*")
            .order("year", { ascending: true })
            .order("month", { ascending: true }),
          supabase
            .from("claims_payments")
            .select("*")
            .order("period_year", { ascending: true })
            .order("period_month", { ascending: true }),
          supabase
            .from("over_limit_payments")
            .select("*")
            .order("over_limit_amount", { ascending: false }),
          supabase
            .from("overspend_summary")
            .select("*")
            .order("total_amount", { ascending: false }),
          supabase
            .from("accident_year_development")
            .select("*")
            .order("accident_year", { ascending: false })
            .order("coverage", { ascending: true }),
        ]);

        if (metricsRes.error) throw new Error(metricsRes.error.message);
        if (coverageRes.error) throw new Error(coverageRes.error.message);
        if (stateRes.error) throw new Error(stateRes.error.message);
        if (lossDevRes.error) throw new Error(lossDevRes.error.message);
        if (freqRes.error) throw new Error(freqRes.error.message);
        if (paymentsRes.error) throw new Error(paymentsRes.error.message);
        if (overLimitRes.error) throw new Error(overLimitRes.error.message);
        if (overspendRes.error) throw new Error(overspendRes.error.message);
        if (ayDevRes.error) throw new Error(ayDevRes.error.message);

        // Transform metrics
        const metrics: ActuarialMetrics | null = metricsRes.data
          ? {
              periodYear: metricsRes.data.period_year,
              periodQuarter: metricsRes.data.period_quarter,
              projectedLoss: Number(metricsRes.data.projected_loss) || 0,
              priorYearLoss: Number(metricsRes.data.prior_year_loss) || 0,
              ultimateLoss: Number(metricsRes.data.ultimate_loss) || 0,
              laeAmount: Number(metricsRes.data.lae_amount) || 0,
              laeRatio: Number(metricsRes.data.lae_ratio) || 0,
              developmentFactor: Number(metricsRes.data.development_factor) || 1,
              fixedExpenseRatio: Number(metricsRes.data.fixed_expense_ratio) || 0,
              variableExpenseRatio: Number(metricsRes.data.variable_expense_ratio) || 0,
              totalExpenseRatio: Number(metricsRes.data.total_expense_ratio) || 0,
              targetExpenseRatio: Number(metricsRes.data.target_expense_ratio) || 0,
              selectedProfit: Number(metricsRes.data.selected_profit) || 0,
              contingencies: Number(metricsRes.data.contingencies) || 0,
              investmentIncome: Number(metricsRes.data.investment_income) || 0,
              indicatedLevelEffect: Number(metricsRes.data.indicated_level_effect) || 0,
              selectedChange: Number(metricsRes.data.selected_change) || 0,
              credibility: Number(metricsRes.data.credibility) || 0,
              trendFactor: Number(metricsRes.data.trend_factor) || 1,
              lossRatio: Number(metricsRes.data.loss_ratio) || 0,
              targetLossRatio: Number(metricsRes.data.target_loss_ratio) || 0,
            }
          : null;

        // Transform coverage rates
        const coverageRates: CoverageRateChange[] = (coverageRes.data || []).map((r) => ({
          coverage: r.coverage,
          indicatedChange: Number(r.indicated_change) || 0,
          selectedChange: Number(r.selected_change) || 0,
          premiumVolume: Number(r.premium_volume) || 0,
          lossRatio: Number(r.loss_ratio) || 0,
          trend: r.trend || "flat",
        }));

        // Transform state rates
        const stateRates: StateRateChange[] = (stateRes.data || []).map((r) => ({
          state: r.state,
          indicatedChange: Number(r.indicated_change) || 0,
          selectedChange: Number(r.selected_change) || 0,
          policyVolume: r.policy_volume || 0,
          lossRatio: Number(r.loss_ratio) || 0,
          filingStatus: r.filing_status || "Draft",
          effectiveDate: r.effective_date,
        }));

        // Transform loss development
        const lossDevelopment: LossDevelopment[] = (lossDevRes.data || []).map((r) => ({
          periodYear: r.period_year,
          periodQuarter: r.period_quarter,
          reportedLosses: Number(r.reported_losses) || 0,
          paidLosses: Number(r.paid_losses) || 0,
          incurredLosses: Number(r.incurred_losses) || 0,
          ibnr: Number(r.ibnr) || 0,
        }));

        // Transform claims frequency
        const claimsFrequency: ClaimsFrequency[] = (freqRes.data || []).map((r) => ({
          year: r.year,
          month: r.month,
          state: r.state,
          reportedClaims: r.reported_claims || 0,
          inForce: r.in_force || 0,
          frequency: Number(r.frequency) || 0,
        }));

        // Transform claims payments
        const claimsPayments: ClaimsPayment[] = (paymentsRes.data || []).map((r) => ({
          coverage: r.coverage,
          periodYear: r.period_year,
          periodMonth: r.period_month,
          isYtd: r.is_ytd,
          totalPayments: Number(r.total_payments) || 0,
          claimantsPaid: r.claimants_paid || 0,
          avgPaidPerClaimant: Number(r.avg_paid_per_claimant) || 0,
        }));

        // Transform over limit payments
        const overLimitPayments: OverLimitPayment[] = (overLimitRes.data || []).map((r) => ({
          id: r.id,
          paymentDate: r.payment_date,
          claimNumber: r.claim_number,
          state: r.state,
          policyLimit: Number(r.policy_limit) || 0,
          paymentAmount: Number(r.payment_amount) || 0,
          overLimitAmount: Number(r.over_limit_amount) || 0,
          coverage: r.coverage || 'BI',
          issueType: r.issue_type,
        }));

        // Transform overspend summary
        const overspendSummary: OverspendSummary[] = (overspendRes.data || []).map((r) => ({
          state: r.state,
          issueType: r.issue_type,
          totalAmount: Number(r.total_amount) || 0,
          claimCount: r.claim_count || 0,
          periodYear: r.period_year,
        }));

        // Transform accident year development
        const accidentYearDev: AccidentYearDevelopment[] = (ayDevRes.data || []).map((r) => ({
          accidentYear: r.accident_year,
          developmentMonths: r.development_months,
          asOfDate: r.as_of_date,
          coverage: r.coverage,
          category: r.category,
          featureCount: r.feature_count || 0,
          priorReserve: Number(r.prior_reserve) || 0,
          claimPayment: Number(r.claim_payment) || 0,
          salvageSubro: Number(r.salvage_subro) || 0,
          netClaimPayment: Number(r.net_claim_payment) || 0,
          alaePayment: Number(r.alae_payment) || 0,
          reserveBalance: Number(r.reserve_balance) || 0,
          netChangeReserve: Number(r.net_change_reserve) || 0,
          incurred: Number(r.incurred) || 0,
          earnedPremium: Number(r.earned_premium) || 0,
          incurredPctPremium: Number(r.incurred_pct_premium) || 0,
        }));

        setData({ metrics, coverageRates, stateRates, lossDevelopment, claimsFrequency, claimsPayments, overLimitPayments, overspendSummary, accidentYearDev });
      } catch (err) {
        console.error("Error fetching actuarial data:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch actuarial data");
      } finally {
        setLoading(false);
      }
    };

    fetchActuarialData();
  }, [periodYear]);

  return { data, loading, error };
}
