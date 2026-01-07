import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LOROfferDB {
  id: string;
  claim_number: string;
  accident_description: string | null;
  area: string | null;
  offer_amount: number;
  extended_date: string;
  expires_date: string;
  status: string;
  outcome_date: string | null;
  outcome_notes: string | null;
  created_at: string;
  updated_at: string;
  bi_phase: string | null;
  settlement_status: string | null;
  high_eval: number | null;
  low_eval: number | null;
  reserves: number | null;
  days_old: number | null;
}

export interface LOROfferStats {
  pending: number;
  accepted: number;
  rejected: number;
  expired: number;
  total: number;
  totalOffered: number;
  avgDaysToResponse: number | null;
}

export function useLOROffers() {
  const [offers, setOffers] = useState<LOROfferDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<LOROfferStats>({
    pending: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
    total: 0,
    totalOffered: 0,
    avgDaysToResponse: null
  });

  const calculateStats = (data: LOROfferDB[]): LOROfferStats => {
    const today = new Date();
    
    let pending = 0;
    let accepted = 0;
    let rejected = 0;
    let expired = 0;
    let totalOffered = 0;

    data.forEach(offer => {
      totalOffered += offer.offer_amount;
      
      if (offer.status === 'accepted') {
        accepted++;
      } else if (offer.status === 'rejected') {
        rejected++;
      } else if (offer.status === 'expired') {
        expired++;
      } else {
        // Check if pending offer has expired
        const expiresDate = new Date(offer.expires_date);
        if (expiresDate < today) {
          expired++;
        } else {
          pending++;
        }
      }
    });

    return {
      pending,
      accepted,
      rejected,
      expired,
      total: data.length,
      totalOffered,
      avgDaysToResponse: null // Can calculate later if outcome_date is set
    };
  };

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    
    const { data, error: fetchError } = await supabase
      .from('lor_offers')
      .select('*')
      .order('expires_date', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    // Type assertion since we know the shape matches
    const typedData = (data || []) as unknown as LOROfferDB[];
    setOffers(typedData);
    setStats(calculateStats(typedData));
    setLoading(false);
  }, []);

  const updateOfferStatus = async (id: string, status: string, notes?: string) => {
    const updateData: Record<string, unknown> = { status };
    if (status !== 'pending') {
      updateData.outcome_date = new Date().toISOString().split('T')[0];
    }
    if (notes) {
      updateData.outcome_notes = notes;
    }

    const { error: updateError } = await supabase
      .from('lor_offers')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    await fetchOffers();
  };

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  return {
    offers,
    loading,
    error,
    stats,
    refetch: fetchOffers,
    updateOfferStatus
  };
}
