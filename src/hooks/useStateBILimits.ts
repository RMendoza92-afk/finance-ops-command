import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LitigationMatter as DBLitigationMatter } from './useLitigationDataDB';

export interface StateBILimit {
  id: string;
  state: string;
  limit_2022: number;
  limit_2023: number;
  limit_2025: number;
  trigger_80_pct: number;
  notes: string | null;
}

export interface OverspendMetrics {
  totalClosures: number;
  netClosures: number;
  overLimitClosures: number;
  triggerAlerts: number;
  overLimitAmount: number;
  byState: {
    state: string;
    closures: number;
    netClosures: number;
    overLimit: number;
    triggerAlerts: number;
    stateLimit: number;
    overLimitAmount: number;
  }[];
}

export function useStateBILimits() {
  const [limits, setLimits] = useState<StateBILimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLimits() {
      try {
        const { data, error: fetchError } = await supabase
          .from('state_bi_limits')
          .select('*')
          .order('state');

        if (fetchError) throw fetchError;

        setLimits((data || []).map((d: any) => ({
          id: d.id,
          state: d.state,
          limit_2022: Number(d.limit_2022) || 0,
          limit_2023: Number(d.limit_2023) || 0,
          limit_2025: Number(d.limit_2025) || 0,
          trigger_80_pct: Number(d.trigger_80_pct) || 0,
          notes: d.notes,
        })));
        setLoading(false);
      } catch (err) {
        console.error('Error fetching state BI limits:', err);
        setError(err instanceof Error ? err.message : 'Failed to load limits');
        setLoading(false);
      }
    }

    fetchLimits();
  }, []);

  return { limits, loading, error };
}

// Helper to normalize state names for matching
function normalizeState(location: string): string {
  if (!location) return '';
  // Extract state from location (e.g., "Dallas, TX" -> "Texas")
  const stateAbbrevs: Record<string, string> = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
    'DC': 'District of Columbia', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii',
    'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine',
    'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota',
    'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska',
    'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico',
    'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island',
    'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas',
    'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington',
    'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  };

  // Check if location is already a full state name
  const fullStates = Object.values(stateAbbrevs);
  if (fullStates.includes(location)) return location;

  // Check for abbreviation at end (e.g., "Dallas, TX")
  const parts = location.split(/[,\s]+/);
  for (const part of parts) {
    const upper = part.toUpperCase();
    if (stateAbbrevs[upper]) {
      return stateAbbrevs[upper];
    }
  }

  // Check if location contains a state name
  for (const state of fullStates) {
    if (location.toLowerCase().includes(state.toLowerCase())) {
      return state;
    }
  }

  return location;
}

export function calculateOverspendMetrics(
  matters: DBLitigationMatter[],
  limits: StateBILimit[]
): OverspendMetrics {
  // Only look at closed matters with indemnity payments
  const closedMatters = matters.filter(m => 
    m.status !== 'Open' && m.indemnities_amount > 0
  );

  const limitsMap = new Map(limits.map(l => [l.state, l]));
  const stateMetrics = new Map<string, {
    closures: number;
    netClosures: number;
    overLimit: number;
    triggerAlerts: number;
    stateLimit: number;
    overLimitAmount: number;
  }>();

  let totalNet = 0;
  let totalOver = 0;
  let totalTrigger = 0;
  let totalOverAmount = 0;

  for (const matter of closedMatters) {
    const state = normalizeState(matter.location);
    const limit = limitsMap.get(state);
    
    if (!limit || !limit.limit_2025) continue; // Skip if no limit data (e.g., Florida)

    const stateLimit = limit.limit_2025;
    const triggerThreshold = limit.trigger_80_pct;
    const indemnity = matter.indemnities_amount;

    if (!stateMetrics.has(state)) {
      stateMetrics.set(state, {
        closures: 0,
        netClosures: 0,
        overLimit: 0,
        triggerAlerts: 0,
        stateLimit,
        overLimitAmount: 0,
      });
    }

    const metrics = stateMetrics.get(state)!;
    metrics.closures++;

    if (indemnity > stateLimit) {
      metrics.overLimit++;
      metrics.overLimitAmount += (indemnity - stateLimit);
      totalOver++;
      totalOverAmount += (indemnity - stateLimit);
    } else {
      metrics.netClosures++;
      totalNet++;
    }

    // Trigger alert: payment at or above 80% threshold but not over limit
    if (indemnity >= triggerThreshold && indemnity <= stateLimit) {
      metrics.triggerAlerts++;
      totalTrigger++;
    }
  }

  return {
    totalClosures: closedMatters.length,
    netClosures: totalNet,
    overLimitClosures: totalOver,
    triggerAlerts: totalTrigger,
    overLimitAmount: totalOverAmount,
    byState: Array.from(stateMetrics.entries())
      .map(([state, metrics]) => ({ state, ...metrics }))
      .sort((a, b) => b.overLimit - a.overLimit),
  };
}
