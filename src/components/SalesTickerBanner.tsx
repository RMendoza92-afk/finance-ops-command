import { TrendingUp, TrendingDown, DollarSign, FileText, Users, Percent } from "lucide-react";

const salesData = {
  period: "1/1/26 - 1/6/26",
  capArea: "CAP AREA",
  quotesGiven: 9430,
  policiesSold: 3598,
  otherSold: 0,
  closingPercent: 38.15,
  numberOfZeros: 2055,
  netWrittenPremium: 8420936,
  grossWrittenPremium: 9302163,
  cancellationPremium: -881227,
  cancellationPercent: -9.00,
  renewalPercent6Mo: 88.57,
  policiesRenewedMonthly: 24219,
  policiesExpiredMonthly: 6323,
  renewalPercentMonthly: 79.30,
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
  const tickerItems = [
    { label: "PERIOD", value: salesData.period, icon: null, type: "text" },
    { label: "QUOTES", value: salesData.quotesGiven.toLocaleString(), icon: FileText, type: "neutral" },
    { label: "POLICIES SOLD", value: salesData.policiesSold.toLocaleString(), icon: Users, type: "positive" },
    { label: "CLOSING %", value: `${salesData.closingPercent}%`, icon: Percent, type: "positive" },
    { label: "# ZEROS", value: salesData.numberOfZeros.toLocaleString(), icon: null, type: "warning" },
    { label: "NET WP", value: formatCurrency(salesData.netWrittenPremium), icon: DollarSign, type: "positive" },
    { label: "GROSS WP", value: formatCurrency(salesData.grossWrittenPremium), icon: DollarSign, type: "positive" },
    { label: "CANCEL PREM", value: formatCurrency(salesData.cancellationPremium), icon: TrendingDown, type: "negative" },
    { label: "CANCEL %", value: formatPercent(salesData.cancellationPercent), icon: TrendingDown, type: "negative" },
    { label: "RENEWAL % (6MO)", value: `${salesData.renewalPercent6Mo}%`, icon: TrendingUp, type: "positive" },
    { label: "RENEWED (MO)", value: salesData.policiesRenewedMonthly.toLocaleString(), icon: null, type: "positive" },
    { label: "EXPIRED (MO)", value: salesData.policiesExpiredMonthly.toLocaleString(), icon: null, type: "warning" },
    { label: "RENEWAL % (MO)", value: `${salesData.renewalPercentMonthly}%`, icon: TrendingUp, type: "positive" },
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

  return (
    <div className="w-full bg-card/80 backdrop-blur-sm border-y border-border overflow-hidden relative">
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
      
      {/* Scrolling ticker */}
      <div className="py-2 pl-28 animate-ticker">
        <div className="flex">
          <TickerContent />
          <TickerContent />
          <TickerContent />
        </div>
      </div>
      
      {/* Gradient fade on right */}
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-card/80 to-transparent z-[5]" />
    </div>
  );
}
