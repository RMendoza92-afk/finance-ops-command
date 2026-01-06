import { ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TrendMetric {
  label: string;
  current: number;
  previous: number;
  format?: 'number' | 'currency' | 'percent';
}

interface TrendComparisonCardProps {
  title: string;
  period: string;
  metrics: TrendMetric[];
}

// Mini sparkline component
const Sparkline = ({ trend, positive }: { trend: number; positive: boolean }) => {
  const isUp = trend > 0;
  const isNeutral = trend === 0;
  
  // Generate simple sparkline points
  const points = positive
    ? isUp ? "0,20 10,18 20,15 30,12 40,8 50,5" : "0,5 10,8 20,12 30,15 40,18 50,20"
    : isUp ? "0,5 10,8 20,12 30,15 40,18 50,20" : "0,20 10,18 20,15 30,12 40,8 50,5";
  
  const color = isNeutral 
    ? "hsl(var(--muted-foreground))" 
    : (isUp === positive) 
      ? "hsl(var(--success, 142 76% 36%))" 
      : "hsl(var(--destructive))";

  return (
    <svg width="50" height="24" className="inline-block ml-2">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// Delta indicator component
const DeltaIndicator = ({ 
  current, 
  previous, 
  positiveIsGood = true 
}: { 
  current: number; 
  previous: number; 
  positiveIsGood?: boolean;
}) => {
  if (previous === 0) return <span className="text-muted-foreground text-xs">N/A</span>;
  
  const delta = current - previous;
  const percentChange = ((delta / previous) * 100);
  const isUp = delta > 0;
  const isNeutral = Math.abs(percentChange) < 1;
  const isSignificant = Math.abs(percentChange) >= 10;
  
  const colorClass = isNeutral 
    ? "text-muted-foreground" 
    : (isUp === positiveIsGood) 
      ? "text-emerald-500" 
      : "text-destructive";
  
  const Icon = isNeutral ? Minus : isUp ? ArrowUp : ArrowDown;
  
  return (
    <div className={`flex items-center gap-1 ${colorClass} ${isSignificant ? 'font-bold' : ''}`}>
      <Icon className="h-3 w-3" />
      <span className="text-xs">
        {isUp ? '+' : ''}{percentChange.toFixed(1)}%
      </span>
      {isSignificant && (
        <span className="text-[10px] bg-current/10 px-1 rounded">
          {isUp === positiveIsGood ? '▲' : '▼'}
        </span>
      )}
    </div>
  );
};

const formatValue = (value: number, format: 'number' | 'currency' | 'percent' = 'number'): string => {
  switch (format) {
    case 'currency':
      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
      return `$${value.toLocaleString()}`;
    case 'percent':
      return `${value.toFixed(1)}%`;
    default:
      return value.toLocaleString();
  }
};

export function TrendComparisonCard({ title, period, metrics }: TrendComparisonCardProps) {
  return (
    <Card className="bg-muted/50 border-primary/20 mt-3">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-xs font-medium flex items-center gap-2">
          <TrendingUp className="h-3 w-3 text-primary" />
          {title}
          <span className="text-muted-foreground font-normal">({period})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-3">
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((metric, idx) => {
            const delta = metric.current - metric.previous;
            const percentChange = metric.previous !== 0 
              ? ((delta / metric.previous) * 100) 
              : 0;
            const positiveIsGood = metric.label.toLowerCase().includes('closure') || 
                                   metric.label.toLowerCase().includes('paid');
            
            return (
              <div key={idx} className="bg-background/50 rounded-lg p-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                  {metric.label}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-foreground">
                      {formatValue(metric.current, metric.format)}
                    </span>
                    <Sparkline trend={percentChange} positive={positiveIsGood} />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    vs {formatValue(metric.previous, metric.format)}
                  </span>
                  <DeltaIndicator 
                    current={metric.current} 
                    previous={metric.previous}
                    positiveIsGood={positiveIsGood}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Parse trend data from AI response
export function parseTrendData(content: string): { 
  weekOverWeek?: TrendMetric[]; 
  monthOverMonth?: TrendMetric[];
} | null {
  const result: { weekOverWeek?: TrendMetric[]; monthOverMonth?: TrendMetric[] } = {};
  
  // Look for patterns like "This Week: X vs Last Week: Y" or structured comparison data
  const weekMatch = content.match(/this week[:\s]+(\d+)[^\d]*(?:vs|compared to)[^\d]*last week[:\s]+(\d+)/i);
  const monthMatch = content.match(/this month[:\s]+(\d+)[^\d]*(?:vs|compared to)[^\d]*last month[:\s]+(\d+)/i);
  
  // Also look for closures/paid patterns
  const closuresThisWeek = content.match(/(?:this week|current week)[^:]*closures?[:\s]+(\d+)/i);
  const closuresLastWeek = content.match(/(?:last week|previous week)[^:]*closures?[:\s]+(\d+)/i);
  
  const paidThisWeek = content.match(/(?:this week|current week)[^:]*(?:paid|total)[:\s]+\$?([\d,]+)/i);
  const paidLastWeek = content.match(/(?:last week|previous week)[^:]*(?:paid|total)[:\s]+\$?([\d,]+)/i);
  
  const closuresThisMonth = content.match(/(?:this month|current month|mtd)[^:]*closures?[:\s]+(\d+)/i);
  const closuresLastMonth = content.match(/(?:last month|previous month)[^:]*closures?[:\s]+(\d+)/i);
  
  const paidThisMonth = content.match(/(?:this month|current month|mtd)[^:]*(?:paid|total)[:\s]+\$?([\d,]+)/i);
  const paidLastMonth = content.match(/(?:last month|previous month)[^:]*(?:paid|total)[:\s]+\$?([\d,]+)/i);
  
  if (closuresThisWeek || paidThisWeek) {
    result.weekOverWeek = [];
    if (closuresThisWeek && closuresLastWeek) {
      result.weekOverWeek.push({
        label: 'Closures',
        current: parseInt(closuresThisWeek[1]),
        previous: parseInt(closuresLastWeek[1]),
        format: 'number'
      });
    }
    if (paidThisWeek && paidLastWeek) {
      result.weekOverWeek.push({
        label: 'Total Paid',
        current: parseInt(paidThisWeek[1].replace(/,/g, '')),
        previous: parseInt(paidLastWeek[1].replace(/,/g, '')),
        format: 'currency'
      });
    }
  }
  
  if (closuresThisMonth || paidThisMonth) {
    result.monthOverMonth = [];
    if (closuresThisMonth && closuresLastMonth) {
      result.monthOverMonth.push({
        label: 'Closures',
        current: parseInt(closuresThisMonth[1]),
        previous: parseInt(closuresLastMonth[1]),
        format: 'number'
      });
    }
    if (paidThisMonth && paidLastMonth) {
      result.monthOverMonth.push({
        label: 'Total Paid',
        current: parseInt(paidThisMonth[1].replace(/,/g, '')),
        previous: parseInt(paidLastMonth[1].replace(/,/g, '')),
        format: 'currency'
      });
    }
  }
  
  return (result.weekOverWeek || result.monthOverMonth) ? result : null;
}
