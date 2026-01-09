import { useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, FileText, Users, Percent, ChevronDown, ChevronUp, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const salesData = {
  period: "1/1/26 - 1/8/26",
  capArea: "CAP AREA",
  quotesGiven: 13855,
  policiesSold: 5171,
  otherSold: 0,
  closingPercent: 37.32,
  numberOfZeros: 2738,
  netWrittenPremium: 12637232,
  grossWrittenPremium: 13812032,
  cancellationPremium: -1174800,
  cancellationPercent: -7.97,
  renewalPercent6Mo: 90.03,
  policiesRenewedMonthly: 34785,
  policiesExpiredMonthly: 7840,
  renewalPercentMonthly: 81.61,
};

const formatCurrency = (value: number) => {
  if (value < 0) {
    return `-$${Math.abs(value).toLocaleString()}`;
  }
  return `$${value.toLocaleString()}`;
};

const formatPercent = (value: number) => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
};

export function SalesTickerBanner() {
  const [isExpanded, setIsExpanded] = useState(false);

  const tickerItems = [
    { label: "PERIOD", value: salesData.period, icon: null, type: "text" },
    { label: "QUOTES", value: salesData.quotesGiven.toLocaleString(), icon: FileText, type: "neutral" },
    { label: "POLICIES SOLD", value: salesData.policiesSold.toLocaleString(), icon: Users, type: "positive" },
    { label: "CLOSING %", value: `${salesData.closingPercent}%`, icon: null, type: "positive" },
    { label: "# ZEROS", value: salesData.numberOfZeros.toLocaleString(), icon: null, type: "warning" },
    { label: "NET WP", value: formatCurrency(salesData.netWrittenPremium), icon: null, type: "positive" },
    { label: "GROSS WP", value: formatCurrency(salesData.grossWrittenPremium), icon: null, type: "positive" },
    { label: "CANCEL PREM", value: formatCurrency(salesData.cancellationPremium), icon: null, type: "negative" },
    { label: "CANCEL %", value: formatPercent(salesData.cancellationPercent), icon: null, type: "negative" },
    { label: "RENEWAL % (6MO)", value: `${salesData.renewalPercent6Mo}%`, icon: null, type: "positive" },
    { label: "RENEWED (MO)", value: salesData.policiesRenewedMonthly.toLocaleString(), icon: null, type: "positive" },
    { label: "EXPIRED (MO)", value: salesData.policiesExpiredMonthly.toLocaleString(), icon: null, type: "warning" },
    { label: "RENEWAL % (MO)", value: `${salesData.renewalPercentMonthly}%`, icon: null, type: "positive" },
  ];

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "positive":
        return "text-emerald-400";
      case "negative":
        return "text-red-400";
      case "warning":
        return "text-amber-400";
      default:
        return "text-foreground";
    }
  };

  const TickerContent = () => (
    <div className="flex items-center gap-8 px-4">
      {tickerItems.map((item, index) => (
        <div key={index} className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-muted-foreground text-xs font-medium tracking-wider">
            {item.label}
          </span>
          <div className={`flex items-center gap-1 font-bold ${getTypeStyles(item.type)}`}>
            {item.icon && <item.icon className="h-3.5 w-3.5" />}
            <span>{item.value}</span>
          </div>
          {index < tickerItems.length - 1 && (
            <span className="text-border ml-6">│</span>
          )}
        </div>
      ))}
    </div>
  );

  // Detail sections for expanded view
  const detailSections = [
    {
      title: "Sales Performance",
      items: [
        { label: "Quotes Given", value: salesData.quotesGiven.toLocaleString(), type: "neutral" },
        { label: "Policies Sold", value: salesData.policiesSold.toLocaleString(), type: "positive" },
        { label: "Other Sold", value: salesData.otherSold.toLocaleString(), type: "neutral" },
        { label: "Closing %", value: `${salesData.closingPercent}%`, type: "positive" },
        { label: "Number of Zeros", value: salesData.numberOfZeros.toLocaleString(), type: "warning" },
      ]
    },
    {
      title: "Premium Metrics",
      items: [
        { label: "Net Written Premium", value: formatCurrency(salesData.netWrittenPremium), type: "positive" },
        { label: "Gross Written Premium", value: formatCurrency(salesData.grossWrittenPremium), type: "positive" },
        { label: "Cancellation Premium", value: formatCurrency(salesData.cancellationPremium), type: "negative" },
        { label: "Cancellation %", value: formatPercent(salesData.cancellationPercent), type: "negative" },
      ]
    },
    {
      title: "Renewal Metrics",
      items: [
        { label: "6-Month Renewal %", value: `${salesData.renewalPercent6Mo}%`, type: "positive" },
        { label: "Monthly Policies Renewed", value: salesData.policiesRenewedMonthly.toLocaleString(), type: "positive" },
        { label: "Monthly Policies Expired", value: salesData.policiesExpiredMonthly.toLocaleString(), type: "warning" },
        { label: "Monthly Renewal %", value: `${salesData.renewalPercentMonthly}%`, type: "positive" },
      ]
    }
  ];

  return (
    <>
      <div 
        className="w-full bg-card/80 backdrop-blur-sm border-y border-border overflow-hidden relative cursor-pointer group"
        onClick={() => setIsExpanded(true)}
      >
        {/* NYSE-style header badge */}
        <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center bg-primary px-4 py-1">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-primary-foreground tracking-widest">
              FLI SALES
            </span>
          </div>
        </div>
        
        {/* Gradient fade on left */}
        <div className="absolute left-24 top-0 bottom-0 w-16 bg-gradient-to-r from-card/80 to-transparent z-[5]" />
        
        {/* Scrolling ticker - continuous right to left */}
        <div className="py-2 pl-28 ticker-wrapper">
          <div className="ticker-track">
            <TickerContent />
            <TickerContent />
            <TickerContent />
          </div>
        </div>
        
        {/* Gradient fade on right */}
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-card/80 to-transparent z-[5]" />
        
        {/* Click indicator */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Expanded Detail Sheet */}
      <Sheet open={isExpanded} onOpenChange={setIsExpanded}>
        <SheetContent side="top" className="h-auto max-h-[85vh] overflow-y-auto p-3 sm:p-6">
          <SheetHeader className="pb-3 sm:pb-4 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-emerald-400 animate-pulse" />
                <SheetTitle className="text-base sm:text-xl font-bold">
                  FLI Sales Dashboard
                </SheetTitle>
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {salesData.period}
                </span>
              </div>
            </div>
          </SheetHeader>
          
          <div className="py-4 sm:py-6 space-y-4 sm:space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="bg-card border border-border rounded-lg p-2 sm:p-4">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Net Written Premium</p>
                <p className="text-lg sm:text-2xl font-bold text-emerald-400 mt-0.5 sm:mt-1">
                  {formatCurrency(salesData.netWrittenPremium)}
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-2 sm:p-4">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Policies Sold</p>
                <p className="text-lg sm:text-2xl font-bold text-emerald-400 mt-0.5 sm:mt-1">
                  {salesData.policiesSold.toLocaleString()}
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-2 sm:p-4">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Closing Rate</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground mt-0.5 sm:mt-1">
                  {salesData.closingPercent}%
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-2 sm:p-4">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">6-Mo Renewal Rate</p>
                <p className="text-lg sm:text-2xl font-bold text-emerald-400 mt-0.5 sm:mt-1">
                  {salesData.renewalPercent6Mo}%
                </p>
              </div>
            </div>

            {/* Detail Sections */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {detailSections.map((section, sectionIndex) => (
                <div key={sectionIndex} className="bg-card border border-border rounded-lg p-3 sm:p-4">
                  <h3 className="font-semibold text-xs sm:text-sm uppercase tracking-wider text-muted-foreground mb-3 sm:mb-4 pb-2 border-b border-border">
                    {section.title}
                  </h3>
                  <div className="space-y-2 sm:space-y-3">
                    {section.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex justify-between items-center gap-2">
                        <span className="text-xs sm:text-sm text-muted-foreground">{item.label}</span>
                        <span className={`font-semibold text-sm sm:text-base ${getTypeStyles(item.type)}`}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Trend Indicators */}
            <div className="bg-card border border-border rounded-lg p-3 sm:p-4">
              <h3 className="font-semibold text-xs sm:text-sm uppercase tracking-wider text-muted-foreground mb-3 sm:mb-4 pb-2 border-b border-border">
                Key Insights
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/10 shrink-0">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-xs sm:text-sm">Strong Renewal Performance</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                      6-month renewal rate at {salesData.renewalPercent6Mo}%
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/10 shrink-0">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-xs sm:text-sm">Zero Production Agents</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                      {salesData.numberOfZeros.toLocaleString()} agents with zero sales
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-red-500/10 shrink-0">
                    <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-xs sm:text-sm">Cancellation Impact</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                      {formatPercent(salesData.cancellationPercent)} cancellation rate
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/10 shrink-0">
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-xs sm:text-sm">Premium Growth</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                      {formatCurrency(salesData.grossWrittenPremium)} GWP
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
