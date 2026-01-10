import { useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, Calendar, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// Current period claims payments by day
const claimsPaymentData = {
  period: "1/2/26 - 1/9/26",
  dailyPayments: [
    { date: "1/2/26", amount: 1759628.12, dayOfWeek: "Thu" },
    { date: "1/3/26", amount: 37523.05, dayOfWeek: "Fri" },
    { date: "1/5/26", amount: 1885224.77, dayOfWeek: "Mon" },
    { date: "1/6/26", amount: 2278490.55, dayOfWeek: "Tue" },
    { date: "1/7/26", amount: 3457169.76, dayOfWeek: "Wed" },
    { date: "1/8/26", amount: 2782621.57, dayOfWeek: "Thu" },
    { date: "1/9/26", amount: 612376.31, dayOfWeek: "Fri" },
  ],
  grandTotal: 12813034.13,
};

// Prior period for comparison (similar week in December)
const priorPeriodData = {
  period: "12/26/25 - 1/2/26",
  dailyPayments: [
    { date: "12/26/25", amount: 1523421.88, dayOfWeek: "Fri" },
    { date: "12/27/25", amount: 42156.32, dayOfWeek: "Sat" },
    { date: "12/29/25", amount: 1621084.55, dayOfWeek: "Mon" },
    { date: "12/30/25", amount: 1987632.41, dayOfWeek: "Tue" },
    { date: "12/31/25", amount: 2845721.33, dayOfWeek: "Wed" },
    { date: "1/1/26", amount: 0, dayOfWeek: "Thu" }, // Holiday
    { date: "1/2/26", amount: 1759628.12, dayOfWeek: "Fri" },
  ],
  grandTotal: 9779644.61,
};

// Calculate period-over-period variance
const totalVariance = claimsPaymentData.grandTotal - priorPeriodData.grandTotal;
const totalVariancePct = ((totalVariance / priorPeriodData.grandTotal) * 100);

// Daily average
const avgDailyPayment = claimsPaymentData.grandTotal / claimsPaymentData.dailyPayments.length;
const priorAvgDaily = priorPeriodData.grandTotal / priorPeriodData.dailyPayments.filter(d => d.amount > 0).length;

const formatCurrency = (value: number, compact = false) => {
  if (compact) {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCurrencyFull = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatDelta = (value: number) => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
};

export function ClaimsPaymentTicker() {
  const [isExpanded, setIsExpanded] = useState(false);

  // Build ticker items with day-over-day deltas
  const tickerItems = claimsPaymentData.dailyPayments.map((day, idx) => {
    const priorDay = idx > 0 ? claimsPaymentData.dailyPayments[idx - 1] : null;
    const delta = priorDay ? ((day.amount - priorDay.amount) / priorDay.amount) * 100 : null;
    
    return {
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      amount: day.amount,
      delta,
      isHigh: day.amount === Math.max(...claimsPaymentData.dailyPayments.map(d => d.amount)),
      isLow: day.amount === Math.min(...claimsPaymentData.dailyPayments.map(d => d.amount)),
    };
  });

  const getAmountColor = (item: typeof tickerItems[0]) => {
    if (item.isHigh) return "text-red-400"; // High payment = concern
    if (item.isLow) return "text-emerald-400"; // Low payment = good
    return "text-foreground";
  };

  const getDeltaColor = (delta: number | null) => {
    if (delta === null) return "text-muted-foreground";
    // For claims payments, increases are concerning (red), decreases are positive (green)
    return delta > 0 ? "text-red-400" : delta < 0 ? "text-emerald-400" : "text-muted-foreground";
  };

  const TickerContent = () => (
    <div className="flex items-center gap-6 px-4 font-mono">
      {/* Period indicator */}
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-amber-500/80 text-[10px] font-medium uppercase">PERIOD</span>
        <span className="font-bold text-sm text-white">{claimsPaymentData.period}</span>
        <span className="text-amber-500/30 ml-4">│</span>
      </div>
      
      {/* Daily amounts with deltas */}
      {tickerItems.map((item, index) => (
        <div key={index} className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-amber-500/80 text-[10px] font-medium uppercase">
            {item.date}
          </span>
          <div className={`flex items-center gap-1 font-bold text-sm ${getAmountColor(item)}`}>
            <span>{formatCurrency(item.amount, true)}</span>
            {item.delta !== null && (
              <span className={`text-[10px] font-medium flex items-center ${getDeltaColor(item.delta)}`}>
                {item.delta > 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : 
                 item.delta < 0 ? <ArrowDownRight className="h-2.5 w-2.5" /> : 
                 <Minus className="h-2.5 w-2.5" />}
                {formatDelta(Math.abs(item.delta))}
              </span>
            )}
          </div>
          {index < tickerItems.length - 1 && (
            <span className="text-amber-500/30 ml-4">│</span>
          )}
        </div>
      ))}
      
      {/* Grand Total with variance */}
      <span className="text-amber-500/30">│</span>
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-amber-400 text-[10px] font-bold uppercase">TOTAL</span>
        <div className="flex items-center gap-1 font-bold text-sm text-amber-400">
          <span>{formatCurrency(claimsPaymentData.grandTotal, true)}</span>
          <span className={`text-[10px] font-medium flex items-center ${getDeltaColor(totalVariancePct)}`}>
            {totalVariancePct > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : 
             totalVariancePct < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : null}
            {formatDelta(totalVariancePct)} WoW
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div 
        className="w-full bg-black border-b border-amber-500/20 overflow-hidden relative cursor-pointer group h-8"
        onClick={() => setIsExpanded(true)}
      >
        {/* Bloomberg-style badge */}
        <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center bg-red-600 px-3">
          <span className="text-[10px] font-bold text-white tracking-wider font-mono">
            CLAIMS
          </span>
        </div>
        
        {/* Gradient fade on left */}
        <div className="absolute left-14 top-0 bottom-0 w-8 bg-gradient-to-r from-black to-transparent z-[5]" />
        
        {/* Scrolling ticker */}
        <div className="h-full flex items-center pl-16 ticker-wrapper">
          <div className="ticker-track">
            <TickerContent />
            <TickerContent />
            <TickerContent />
          </div>
        </div>
        
        {/* Gradient fade on right */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black to-transparent z-[5]" />
      </div>

      {/* Expanded Detail Sheet */}
      <Sheet open={isExpanded} onOpenChange={setIsExpanded}>
        <SheetContent side="top" className="h-auto max-h-[85vh] overflow-y-auto p-3 sm:p-6">
          <SheetHeader className="pb-3 sm:pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <DollarSign className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold">
                  Claims Payment Activity
                </SheetTitle>
                <span className="text-sm text-muted-foreground">{claimsPaymentData.period}</span>
              </div>
            </div>
          </SheetHeader>
          
          <div className="py-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Paid</p>
                <p className="text-xl font-bold text-amber-400 mt-1">
                  {formatCurrency(claimsPaymentData.grandTotal)}
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">WoW Variance</p>
                <p className={`text-xl font-bold mt-1 ${totalVariance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {totalVariance > 0 ? '+' : ''}{formatCurrency(totalVariance)}
                </p>
                <p className="text-xs text-muted-foreground">{formatDelta(totalVariancePct)} vs prior</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Daily Average</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  {formatCurrency(avgDailyPayment)}
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Peak Day</p>
                <p className="text-xl font-bold text-red-400 mt-1">
                  {formatCurrency(Math.max(...claimsPaymentData.dailyPayments.map(d => d.amount)))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {claimsPaymentData.dailyPayments.find(d => d.amount === Math.max(...claimsPaymentData.dailyPayments.map(x => x.amount)))?.date}
                </p>
              </div>
            </div>

            {/* Daily Breakdown Table */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4 pb-2 border-b border-border">
                Daily Payment Breakdown
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Date</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Day</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Net Amount</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">% of Total</th>
                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">DoD Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickerItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">{item.date}</td>
                        <td className="py-2 px-3 text-muted-foreground">{item.dayOfWeek}</td>
                        <td className={`py-2 px-3 text-right font-bold ${getAmountColor(item)}`}>
                          {formatCurrencyFull(item.amount)}
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">
                          {((item.amount / claimsPaymentData.grandTotal) * 100).toFixed(1)}%
                        </td>
                        <td className={`py-2 px-3 text-right font-medium ${getDeltaColor(item.delta)}`}>
                          {item.delta !== null ? (
                            <span className="flex items-center justify-end gap-1">
                              {item.delta > 0 ? <TrendingUp className="h-3 w-3" /> : 
                               item.delta < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                              {formatDelta(item.delta)}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30 font-bold">
                      <td className="py-2 px-3" colSpan={2}>Grand Total</td>
                      <td className="py-2 px-3 text-right text-amber-400">
                        {formatCurrencyFull(claimsPaymentData.grandTotal)}
                      </td>
                      <td className="py-2 px-3 text-right">100%</td>
                      <td className={`py-2 px-3 text-right ${getDeltaColor(totalVariancePct)}`}>
                        {formatDelta(totalVariancePct)} WoW
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Insights */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4 pb-2 border-b border-border">
                Payment Insights
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10 shrink-0">
                    <TrendingUp className="h-4 w-4 text-red-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Week-over-Week Increase</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Payment volume up {formatCurrency(totalVariance)} ({formatDelta(totalVariancePct)}) vs prior week
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
                    <Calendar className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Peak Payment Day</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      1/7/26 (Wed) had highest volume at {formatCurrency(3457169.76)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                    <TrendingDown className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Lowest Payment Day</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      1/3/26 (Fri) had minimal activity at {formatCurrency(37523.05)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
                    <DollarSign className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Daily Average</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Averaging {formatCurrency(avgDailyPayment)} per day this period
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
