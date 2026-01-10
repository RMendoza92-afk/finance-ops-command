import { useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, ArrowRight, ArrowLeft, Scale } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// Sales/Premium data - incoming money
const incomingData = {
  period: "1/1/26 - 1/10/26",
  items: [
    { label: "Gross Written Premium", amount: 16210447, type: "premium" },
    { label: "Net Written Premium", amount: 14852163, type: "premium" },
    { label: "Salvage & Subrogation", amount: 823456, type: "recovery" },
    { label: "Deductible Recovery", amount: 156789, type: "recovery" },
    { label: "Reinsurance Recovery", amount: 445000, type: "recovery" },
  ],
  total: 16277408,
};

// Claims/Payment data - outgoing money
const outgoingData = {
  period: "1/2/26 - 1/9/26",
  items: [
    { label: "BI Indemnity", amount: 5823456, type: "indemnity" },
    { label: "PD Payments", amount: 3245678, type: "indemnity" },
    { label: "COMP Payments", amount: 1456789, type: "indemnity" },
    { label: "Medical Payments", amount: 987654, type: "expense" },
    { label: "Legal/Defense", amount: 678432, type: "expense" },
    { label: "Adjusting Expense", amount: 621025, type: "expense" },
  ],
  total: 12813034,
};

// Calculate net cash flow
const netCashFlow = incomingData.total - outgoingData.total;
const cashFlowRatio = (incomingData.total / outgoingData.total * 100).toFixed(1);

const formatCurrency = (value: number, compact = false) => {
  if (compact) {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

interface OrderBookDrilldownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderBookDrilldown({ open, onOpenChange }: OrderBookDrilldownProps) {
  const maxAmount = Math.max(
    ...incomingData.items.map(i => i.amount),
    ...outgoingData.items.map(i => i.amount)
  );

  const getBarWidth = (amount: number) => {
    return (amount / maxAmount) * 100;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto p-4 sm:p-6">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold">Cash Flow Order Book</SheetTitle>
                <span className="text-sm text-muted-foreground">Premium Income vs Claims Outflow</span>
              </div>
            </div>
            {/* Net Position Badge */}
            <div className={`px-4 py-2 rounded-lg ${netCashFlow >= 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <div className="text-xs text-muted-foreground">Net Position</div>
              <div className={`text-lg font-bold ${netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow)}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Summary Stats Row */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
              <p className="text-xs text-emerald-400 uppercase tracking-wider">Total Incoming</p>
              <p className="text-xl font-bold text-emerald-400 mt-1">{formatCurrency(incomingData.total, true)}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
              <p className="text-xs text-red-400 uppercase tracking-wider">Total Outgoing</p>
              <p className="text-xl font-bold text-red-400 mt-1">{formatCurrency(outgoingData.total, true)}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Coverage Ratio</p>
              <p className={`text-xl font-bold mt-1 ${parseFloat(cashFlowRatio) >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {cashFlowRatio}%
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Net Cash Flow</p>
              <p className={`text-xl font-bold mt-1 ${netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow, true)}
              </p>
            </div>
          </div>

          {/* Order Book Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Bids / Incoming (Left Side - Green) */}
            <div className="bg-card border border-emerald-500/30 rounded-lg overflow-hidden">
              <div className="bg-emerald-500/10 px-4 py-3 border-b border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-emerald-400" />
                    <span className="font-bold text-emerald-400 uppercase tracking-wider text-sm">
                      Incoming (Bids)
                    </span>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">
                    {formatCurrency(incomingData.total)}
                  </span>
                </div>
              </div>
              
              {/* Order Book Levels */}
              <div className="p-2 space-y-1">
                {incomingData.items.map((item, idx) => (
                  <div key={idx} className="relative h-10 flex items-center">
                    {/* Bar (from right to left for bids) */}
                    <div 
                      className="absolute right-0 top-0 bottom-0 bg-emerald-500/20 rounded-l transition-all"
                      style={{ width: `${getBarWidth(item.amount)}%` }}
                    />
                    {/* Content */}
                    <div className="relative z-10 flex items-center justify-between w-full px-3">
                      <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                        {item.label}
                      </span>
                      <span className="text-sm font-bold text-emerald-400">
                        {formatCurrency(item.amount, true)}
                      </span>
                    </div>
                  </div>
                ))}
                
                {/* Total Row */}
                <div className="border-t border-emerald-500/30 mt-2 pt-2">
                  <div className="flex items-center justify-between px-3 py-2 bg-emerald-500/10 rounded">
                    <span className="text-xs font-bold text-emerald-400 uppercase">Total Bids</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {formatCurrency(incomingData.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Asks / Outgoing (Right Side - Red) */}
            <div className="bg-card border border-red-500/30 rounded-lg overflow-hidden">
              <div className="bg-red-500/10 px-4 py-3 border-b border-red-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-red-400">
                    {formatCurrency(outgoingData.total)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-400 uppercase tracking-wider text-sm">
                      Outgoing (Asks)
                    </span>
                    <ArrowLeft className="h-4 w-4 text-red-400" />
                  </div>
                </div>
              </div>
              
              {/* Order Book Levels */}
              <div className="p-2 space-y-1">
                {outgoingData.items.map((item, idx) => (
                  <div key={idx} className="relative h-10 flex items-center">
                    {/* Bar (from left to right for asks) */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-red-500/20 rounded-r transition-all"
                      style={{ width: `${getBarWidth(item.amount)}%` }}
                    />
                    {/* Content */}
                    <div className="relative z-10 flex items-center justify-between w-full px-3">
                      <span className="text-sm font-bold text-red-400">
                        {formatCurrency(item.amount, true)}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-[140px] text-right">
                        {item.label}
                      </span>
                    </div>
                  </div>
                ))}
                
                {/* Total Row */}
                <div className="border-t border-red-500/30 mt-2 pt-2">
                  <div className="flex items-center justify-between px-3 py-2 bg-red-500/10 rounded">
                    <span className="text-sm font-bold text-red-400">
                      {formatCurrency(outgoingData.total)}
                    </span>
                    <span className="text-xs font-bold text-red-400 uppercase">Total Asks</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Depth Visualization */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">
              Market Depth
            </h3>
            
            {/* Combined depth bar */}
            <div className="relative h-12 bg-muted/30 rounded-lg overflow-hidden">
              {/* Incoming side (green) */}
              <div 
                className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-600/40 to-emerald-500/60 flex items-center justify-start pl-4"
                style={{ width: `${(incomingData.total / (incomingData.total + outgoingData.total)) * 100}%` }}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400">
                    {formatCurrency(incomingData.total, true)}
                  </span>
                </div>
              </div>
              
              {/* Outgoing side (red) */}
              <div 
                className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-red-600/40 to-red-500/60 flex items-center justify-end pr-4"
                style={{ width: `${(outgoingData.total / (incomingData.total + outgoingData.total)) * 100}%` }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-red-400">
                    {formatCurrency(outgoingData.total, true)}
                  </span>
                  <TrendingDown className="h-4 w-4 text-red-400" />
                </div>
              </div>
              
              {/* Center divider */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border transform -translate-x-1/2" />
            </div>
            
            {/* Labels */}
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>← Premium Income</span>
              <span className={`font-bold ${netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                Spread: {formatCurrency(Math.abs(netCashFlow), true)}
              </span>
              <span>Claims Outflow →</span>
            </div>
          </div>

          {/* Period Comparison */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                Incoming Breakdown
              </h3>
              <div className="space-y-2">
                {incomingData.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-emerald-400">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 mt-2 flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span className="text-emerald-400">{formatCurrency(incomingData.total)}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-400" />
                Outgoing Breakdown
              </h3>
              <div className="space-y-2">
                {outgoingData.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-red-400">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 mt-2 flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span className="text-red-400">{formatCurrency(outgoingData.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Compact ticker button to trigger the order book
export function OrderBookTrigger({ onClick }: { onClick: () => void }) {
  const inPct = ((incomingData.total / (incomingData.total + outgoingData.total)) * 100).toFixed(0);
  const outPct = ((outgoingData.total / (incomingData.total + outgoingData.total)) * 100).toFixed(0);
  
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2 bg-card/80 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-3 rounded-full bg-emerald-500/30 flex items-center justify-center">
          <ArrowRight className="h-2 w-2 text-emerald-400" />
        </div>
        <span className="text-xs text-emerald-400 font-bold">{formatCurrency(incomingData.total, true)}</span>
      </div>
      
      {/* Mini depth bar */}
      <div className="w-20 h-2 bg-muted/50 rounded-full overflow-hidden flex">
        <div className="bg-emerald-500/60 h-full" style={{ width: `${inPct}%` }} />
        <div className="bg-red-500/60 h-full" style={{ width: `${outPct}%` }} />
      </div>
      
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-red-400 font-bold">{formatCurrency(outgoingData.total, true)}</span>
        <div className="h-3 w-3 rounded-full bg-red-500/30 flex items-center justify-center">
          <ArrowLeft className="h-2 w-2 text-red-400" />
        </div>
      </div>
      
      <div className={`text-xs font-bold ml-1 ${netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow, true)}
      </div>
      
      <Scale className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors ml-1" />
    </button>
  );
}
