import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface StateData {
  state: string;
  stateCode: string;
  policies: number;
  policyChange: number;
  claims: number;
  frequency: number;
  overspend: number;
  action: string;
}

interface StatePerformanceMapProps {
  data: StateData[];
  onStateClick?: (state: StateData) => void;
}

// State coordinates for a simplified US map layout (relative positions)
const statePositions: Record<string, { x: number; y: number; label: string }> = {
  // West
  WA: { x: 8, y: 5, label: 'WA' },
  OR: { x: 8, y: 15, label: 'OR' },
  CA: { x: 5, y: 30, label: 'CA' },
  NV: { x: 12, y: 25, label: 'NV' },
  AZ: { x: 15, y: 40, label: 'AZ' },
  UT: { x: 18, y: 22, label: 'UT' },
  ID: { x: 15, y: 12, label: 'ID' },
  MT: { x: 22, y: 5, label: 'MT' },
  WY: { x: 25, y: 15, label: 'WY' },
  CO: { x: 28, y: 28, label: 'CO' },
  NM: { x: 25, y: 42, label: 'NM' },
  // Central
  ND: { x: 38, y: 5, label: 'ND' },
  SD: { x: 38, y: 15, label: 'SD' },
  NE: { x: 38, y: 25, label: 'NE' },
  KS: { x: 40, y: 35, label: 'KS' },
  OK: { x: 40, y: 45, label: 'OK' },
  TX: { x: 38, y: 58, label: 'TX' },
  MN: { x: 48, y: 10, label: 'MN' },
  IA: { x: 48, y: 22, label: 'IA' },
  MO: { x: 50, y: 35, label: 'MO' },
  AR: { x: 50, y: 48, label: 'AR' },
  LA: { x: 52, y: 60, label: 'LA' },
  // Great Lakes
  WI: { x: 55, y: 12, label: 'WI' },
  IL: { x: 58, y: 28, label: 'IL' },
  MI: { x: 65, y: 15, label: 'MI' },
  IN: { x: 65, y: 30, label: 'IN' },
  OH: { x: 72, y: 28, label: 'OH' },
  KY: { x: 68, y: 38, label: 'KY' },
  TN: { x: 65, y: 45, label: 'TN' },
  MS: { x: 58, y: 55, label: 'MS' },
  AL: { x: 65, y: 55, label: 'AL' },
  GA: { x: 72, y: 52, label: 'GA' },
  FL: { x: 78, y: 65, label: 'FL' },
  SC: { x: 78, y: 48, label: 'SC' },
  NC: { x: 82, y: 42, label: 'NC' },
  VA: { x: 82, y: 35, label: 'VA' },
  WV: { x: 78, y: 32, label: 'WV' },
  // Northeast
  PA: { x: 82, y: 25, label: 'PA' },
  NY: { x: 85, y: 18, label: 'NY' },
  VT: { x: 90, y: 8, label: 'VT' },
  NH: { x: 93, y: 10, label: 'NH' },
  ME: { x: 95, y: 5, label: 'ME' },
  MA: { x: 95, y: 18, label: 'MA' },
  RI: { x: 96, y: 22, label: 'RI' },
  CT: { x: 93, y: 24, label: 'CT' },
  NJ: { x: 90, y: 28, label: 'NJ' },
  DE: { x: 90, y: 32, label: 'DE' },
  MD: { x: 87, y: 35, label: 'MD' },
  DC: { x: 85, y: 38, label: 'DC' },
  // Alaska & Hawaii (positioned at bottom)
  AK: { x: 8, y: 70, label: 'AK' },
  HI: { x: 20, y: 72, label: 'HI' },
};

// Map state names to codes
const stateNameToCode: Record<string, string> = {
  'Texas': 'TX',
  'California': 'CA',
  'Colorado': 'CO',
  'New Mexico': 'NM',
  'Arizona': 'AZ',
  'Nevada': 'NV',
  'Illinois': 'IL',
  'Oklahoma': 'OK',
  'Georgia': 'GA',
  'Alabama': 'AL',
  'Indiana': 'IN',
  'Ohio': 'OH',
  'Florida': 'FL',
};

const getPerformanceColor = (data: StateData | undefined): string => {
  if (!data) return 'bg-muted/30 border-muted';
  
  // High overspend = red
  if (data.overspend > 2000000) return 'bg-red-500/80 border-red-600';
  if (data.overspend > 500000) return 'bg-amber-500/80 border-amber-600';
  
  // High frequency = orange
  if (data.frequency >= 25) return 'bg-orange-500/80 border-orange-600';
  
  // Policy decline = purple
  if (data.policyChange < -10) return 'bg-purple-500/80 border-purple-600';
  
  // Growth = blue
  if (data.policyChange > 5) return 'bg-blue-500/80 border-blue-600';
  
  // Stable/profitable = green
  return 'bg-emerald-500/80 border-emerald-600';
};

const getPerformanceLabel = (data: StateData | undefined): string => {
  if (!data) return 'No Data';
  
  if (data.overspend > 2000000) return 'Critical';
  if (data.overspend > 500000) return 'Warning';
  if (data.frequency >= 25) return 'High Freq';
  if (data.policyChange < -10) return 'Declining';
  if (data.policyChange > 5) return 'Growing';
  return 'Stable';
};

export function StatePerformanceMap({ data, onStateClick }: StatePerformanceMapProps) {
  const stateDataMap = useMemo(() => {
    const map: Record<string, StateData> = {};
    data.forEach(d => {
      const code = stateNameToCode[d.state] || d.stateCode;
      if (code) map[code] = d;
    });
    return map;
  }, [data]);

  const activeStates = Object.keys(stateDataMap);

  return (
    <div className="w-full">
      {/* Map Container */}
      <div className="relative w-full h-[320px] bg-muted/20 rounded-xl border border-border/50 overflow-hidden">
        {/* Grid overlay for reference */}
        <div className="absolute inset-0 opacity-5">
          <div className="w-full h-full" style={{ 
            backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }} />
        </div>
        
        {/* State nodes */}
        {Object.entries(statePositions).map(([code, pos]) => {
          const stateData = stateDataMap[code];
          const isActive = activeStates.includes(code);
          const colorClass = isActive ? getPerformanceColor(stateData) : 'bg-muted/20 border-muted/40';
          
          return (
            <div
              key={code}
              className={cn(
                "absolute flex items-center justify-center rounded-lg border-2 cursor-pointer transition-all duration-200",
                colorClass,
                isActive ? "hover:scale-110 hover:z-10 shadow-lg" : "opacity-40",
                isActive && stateData?.overspend > 1000000 && "animate-pulse"
              )}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: isActive ? '42px' : '32px',
                height: isActive ? '28px' : '22px',
                transform: 'translate(-50%, -50%)',
              }}
              onClick={() => stateData && onStateClick?.(stateData)}
              title={stateData ? `${stateData.state}: ${stateData.policies.toLocaleString()} policies, $${(stateData.overspend / 1000000).toFixed(1)}M overspend` : code}
            >
              <span className={cn(
                "font-bold",
                isActive ? "text-white text-xs" : "text-muted-foreground text-[10px]"
              )}>
                {code}
              </span>
            </div>
          );
        })}
        
        {/* Title overlay */}
        <div className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-border/50">
          <span className="text-xs font-semibold text-foreground">Active States</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 justify-center text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-500/80 border-2 border-red-600"></div>
          <span className="text-muted-foreground">Critical (&gt;$2M overspend)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-amber-500/80 border-2 border-amber-600"></div>
          <span className="text-muted-foreground">Warning ($500K-$2M)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-orange-500/80 border-2 border-orange-600"></div>
          <span className="text-muted-foreground">High Frequency (&gt;25)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-purple-500/80 border-2 border-purple-600"></div>
          <span className="text-muted-foreground">Declining (&gt;10% drop)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-emerald-500/80 border-2 border-emerald-600"></div>
          <span className="text-muted-foreground">Stable/Profitable</span>
        </div>
      </div>
    </div>
  );
}

export default StatePerformanceMap;
