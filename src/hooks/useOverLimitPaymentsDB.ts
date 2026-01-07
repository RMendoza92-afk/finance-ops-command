import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OverLimitPaymentDB {
  id: string;
  claim_number: string;
  state: string;
  policy_limit: number | null;
  payment_amount: number;
  over_limit_amount: number;
  payment_date: string;
  coverage: string | null;
  issue_type: string | null;
}

export interface StateOverLimitSummary {
  state: string;
  count: number;
  totalPayment: number;
  totalOverLimit: number;
  avgPolicyLimit: number;
}

export function useOverLimitPaymentsDB() {
  const [data, setData] = useState<OverLimitPaymentDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: payments, error: fetchError } = await supabase
          .from('over_limit_payments')
          .select('*')
          .order('payment_date', { ascending: false });

        if (fetchError) throw fetchError;
        setData(payments || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching over-limit payments:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const byState = useMemo((): StateOverLimitSummary[] => {
    const stateMap = new Map<string, { 
      count: number; 
      totalPayment: number; 
      totalOverLimit: number;
      totalLimit: number;
    }>();

    for (const p of data) {
      const existing = stateMap.get(p.state) || { 
        count: 0, 
        totalPayment: 0, 
        totalOverLimit: 0,
        totalLimit: 0 
      };
      existing.count++;
      existing.totalPayment += p.payment_amount;
      existing.totalOverLimit += p.over_limit_amount;
      existing.totalLimit += p.policy_limit || 0;
      stateMap.set(p.state, existing);
    }

    return Array.from(stateMap.entries())
      .map(([state, d]) => ({ 
        state, 
        count: d.count,
        totalPayment: d.totalPayment,
        totalOverLimit: d.totalOverLimit,
        avgPolicyLimit: d.count > 0 ? d.totalLimit / d.count : 0,
      }))
      .sort((a, b) => b.totalOverLimit - a.totalOverLimit);
  }, [data]);

  const totals = useMemo(() => {
    return {
      claimCount: data.length,
      totalPayments: data.reduce((sum, p) => sum + p.payment_amount, 0),
      totalOverLimit: data.reduce((sum, p) => sum + p.over_limit_amount, 0),
    };
  }, [data]);

  const getClaimsByState = (state: string): OverLimitPaymentDB[] => {
    return data.filter(p => p.state === state);
  };

  return { data, byState, totals, loading, error, getClaimsByState };
}
