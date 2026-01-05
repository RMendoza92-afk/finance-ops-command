import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LitigationMatter {
  id: string;
  matter_id: string;
  class: string;
  claimant: string;
  indemnities_amount: number;
  total_amount: number;
  type: string;
  department: string;
  team: string;
  discipline: string;
  resolution: string;
  status: string;
  location: string;
  matter_lead: string;
  resolution_date: string | null;
  filing_date: string | null;
  days_open: number;
  severity: string;
  // Include pain level if joined
  pain_level?: string;
}

export interface LitigationStats {
  totalMatters: number;
  totalIndemnities: number;
  totalAmount: number;
  openCount: number;
  closedCount: number;
}

export function useLitigationDataDB() {
  const [data, setData] = useState<LitigationMatter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<LitigationStats>({
    totalMatters: 0,
    totalIndemnities: 0,
    totalAmount: 0,
    openCount: 0,
    closedCount: 0,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Fetching litigation data from database...');
      
      // Fetch litigation matters with pain levels joined
      const { data: matters, error: fetchError } = await supabase
        .from('litigation_matters')
        .select(`
          *,
          pain_levels (pain_level)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const transformedData: LitigationMatter[] = (matters || []).map((m: any) => ({
        id: m.id,
        matter_id: m.matter_id,
        class: m.class || '',
        claimant: m.claimant || '',
        indemnities_amount: Number(m.indemnities_amount) || 0,
        total_amount: Number(m.total_amount) || 0,
        type: m.type || '',
        department: m.department || '',
        team: m.team || '',
        discipline: m.discipline || '',
        resolution: m.resolution || '',
        status: m.status || 'Open',
        location: m.location || '',
        matter_lead: m.matter_lead || '',
        resolution_date: m.resolution_date,
        filing_date: m.filing_date,
        days_open: m.days_open || 0,
        severity: m.severity || '',
        pain_level: m.pain_levels?.pain_level || undefined,
      }));

      setData(transformedData);

      // Calculate stats
      const totalIndemnities = transformedData.reduce((sum, d) => sum + d.indemnities_amount, 0);
      const totalAmount = transformedData.reduce((sum, d) => sum + d.total_amount, 0);
      const openCount = transformedData.filter(d => d.status === 'Open').length;
      const closedCount = transformedData.filter(d => d.status !== 'Open').length;

      setStats({
        totalMatters: transformedData.length,
        totalIndemnities,
        totalAmount,
        openCount,
        closedCount,
      });

      console.log('Loaded', transformedData.length, 'matters from database');
      setLoading(false);
    } catch (err) {
      console.error('Error fetching litigation data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, stats, refetch: fetchData };
}

export function getFilterOptionsDB(data: LitigationMatter[]) {
  return {
    classes: [...new Set(data.map(d => d.class))].filter(Boolean).sort(),
    departments: [...new Set(data.map(d => d.department))].filter(Boolean).sort(),
    teams: [...new Set(data.map(d => d.team))].filter(Boolean).sort(),
    types: [...new Set(data.map(d => d.type))].filter(Boolean).sort(),
    statuses: [...new Set(data.map(d => d.status))].filter(Boolean).sort(),
  };
}
