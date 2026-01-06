import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LitigationMatter } from './useLitigationData';

export interface StateBILimit {
  id: string;
  state: string;
  limit_2022: number;
  limit_2023: number;
  limit_2025: number;
  trigger_80_pct: number;
  notes: string | null;
}

// Prefix-to-state mapping based on FLI policy company codes
const PREFIX_STATE_MAP: Record<string, string> = {
  // Arizona
  '82': 'Arizona', '97': 'Arizona', '57': 'Arizona',
  // California
  '72': 'California', '73': 'California',
  // Colorado
  '67': 'Colorado', '68': 'Colorado', '77': 'Colorado', '60': 'Colorado', '69': 'Colorado',
  // Georgia
  '40': 'Georgia', '83': 'Georgia', '84': 'Georgia',
  // Illinois
  '70': 'Illinois', '71': 'Illinois', '59': 'Illinois', '58': 'Illinois',
  // Indiana
  '61': 'Indiana', '90': 'Indiana', '95': 'Indiana',
  // Nevada
  '80': 'Nevada', '96': 'Nevada', '55': 'Nevada',
  // New Mexico
  '62': 'New Mexico', '64': 'New Mexico',
  // Ohio
  '93': 'Ohio', '94': 'Ohio', '98': 'Ohio',
  // Texas
  '66': 'Texas', '78': 'Texas', '65': 'Texas', '63': 'Texas', '76': 'Texas', 
  '89': 'Texas', '74': 'Texas', '75': 'Texas', '51': 'Texas',
  // Alabama
  '79': 'Alabama', '47': 'Alabama', '81': 'Alabama',
  // Oklahoma
  '39': 'Oklahoma', '50': 'Oklahoma',
  // Tennessee
  '42': 'Tennessee',
};

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

// Helper to get state from prefix or location
function getStateFromMatter(matter: LitigationMatter): string {
  // First try prefix mapping (for CSV data)
  if (matter.prefix && PREFIX_STATE_MAP[matter.prefix]) {
    return PREFIX_STATE_MAP[matter.prefix];
  }

  // Fall back to location parsing (for DB data)
  const location = (matter as any).location;
  if (!location) return '';
  
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

  const fullStates = Object.values(stateAbbrevs);
  if (fullStates.includes(location)) return location;

  const parts = location.split(/[,\s]+/);
  for (const part of parts) {
    const upper = part.toUpperCase();
    if (stateAbbrevs[upper]) {
      return stateAbbrevs[upper];
    }
  }

  return location;
}

export function calculateOverspendMetrics(
  matters: LitigationMatter[],
  limits: StateBILimit[]
): OverspendMetrics {
  // For CSV data: CWP means closed with payment
  // For DB data: status !== 'Open' && indemnities > 0
  const closedMatters = matters.filter(m => 
    (m.cwpCwn === 'CWP' && m.indemnitiesAmount > 0) ||
    ((m as any).status !== 'Open' && (m as any).indemnities_amount > 0)
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
    const state = getStateFromMatter(matter);
    const limit = limitsMap.get(state);
    
    if (!limit || !limit.limit_2025) continue; // Skip if no limit data

    const stateLimit = limit.limit_2025;
    const triggerThreshold = limit.trigger_80_pct;
    const indemnity = matter.indemnitiesAmount || (matter as any).indemnities_amount || 0;

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
