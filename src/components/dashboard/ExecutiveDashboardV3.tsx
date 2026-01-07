import React from "react";
import { 
  TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle,
  CheckCircle2, Target, BarChart3, PieChart as PieChartIcon,
  ArrowUpRight, ArrowDownRight, Activity, Zap, Shield, Flag
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip
} from "recharts";

interface ExecutiveDashboardV3Props {
  data: {
    totalClaims: number;
    totalReserves: number;
    lowEval: number;
    highEval: number;
    noEvalCount: number;
    noEvalReserves: number;
    aged365Plus: number;
    aged365Reserves: number;
    aged181to365: number;
    aged181Reserves: number;
    aged61to180: number;
    agedUnder60: number;
    cp1Count: number;
    cp1Rate: string;
    decisionsCount: number;
    decisionsExposure: number;
    litCount: number;
    biLitSpend2026: number;
    biLitSpend2025: number;
    dataDate: string;
    delta?: {
      change: number;
      changePercent: number;
      reservesChange: number;
      reservesChangePercent: number;
      previousDate: string;
    };
    trendData?: Array<{ month: string; claims: number; reserves: number }>;
  };
  onOpenChat: () => void;
  onDrilldown: (section: string) => void;
}

export function ExecutiveDashboardV3({ data, onOpenChat, onDrilldown }: ExecutiveDashboardV3Props) {
  const formatM = (val: number) => `$${(val / 1000000).toFixed(1)}M`;
  const formatK = (val: number) => `$${(val / 1000).toFixed(0)}K`;
  const formatPct = (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;

  // Pie chart data for age distribution
  const ageData = [
    { name: '365+', value: data.aged365Plus, color: 'hsl(var(--destructive))' },
    { name: '181-365', value: data.aged181to365, color: 'hsl(var(--warning))' },
    { name: '61-180', value: data.aged61to180, color: 'hsl(var(--accent))' },
    { name: '<60', value: data.agedUnder60, color: 'hsl(var(--success))' },
  ];

  // Mock trend data if not provided
  const trendData = data.trendData || [
    { month: 'Aug', claims: data.totalClaims * 0.98, reserves: data.totalReserves * 0.95 },
    { month: 'Sep', claims: data.totalClaims * 0.99, reserves: data.totalReserves * 0.97 },
    { month: 'Oct', claims: data.totalClaims * 1.01, reserves: data.totalReserves * 0.99 },
    { month: 'Nov', claims: data.totalClaims * 0.99, reserves: data.totalReserves * 1.01 },
    { month: 'Dec', claims: data.totalClaims * 1.02, reserves: data.totalReserves * 1.02 },
    { month: 'Jan', claims: data.totalClaims, reserves: data.totalReserves },
  ];

  return (
    <div className="space-y-4 p-2">
      {/* Executive Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl border border-slate-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Live</span>
          </div>
          <span className="text-sm font-semibold text-white">{data.dataDate}</span>
        </div>
        <div className="flex items-center gap-6">
          {data.delta && (
            <>
              <div className="flex items-center gap-1.5">
                {data.delta.change >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-success" />
                )}
                <span className={`text-xs font-semibold ${data.delta.change >= 0 ? 'text-destructive' : 'text-success'}`}>
                  {formatPct(data.delta.changePercent)} Claims
                </span>
              </div>
              <div className="w-px h-4 bg-slate-700" />
              <div className="flex items-center gap-1.5">
                {data.delta.reservesChangePercent >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-success" />
                )}
                <span className={`text-xs font-semibold ${data.delta.reservesChangePercent >= 0 ? 'text-destructive' : 'text-success'}`}>
                  {formatPct(data.delta.reservesChangePercent)} Reserves
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top Row - 4 Column Power Metrics */}
      <div className="grid grid-cols-4 gap-3">
        {/* Total Claims */}
        <div className="bg-card rounded-xl border p-4 hover:border-primary/50 transition-all cursor-pointer" onClick={() => onDrilldown('claims')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Claims</span>
            <Activity className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">{data.totalClaims.toLocaleString()}</p>
          {data.delta && (
            <p className={`text-xs mt-1 ${data.delta.change >= 0 ? 'text-destructive' : 'text-success'}`}>
              {data.delta.change >= 0 ? '+' : ''}{data.delta.change} MoM
            </p>
          )}
        </div>

        {/* Total Reserves */}
        <div className="bg-gradient-to-br from-primary/10 to-transparent rounded-xl border border-primary/30 p-4 hover:border-primary/50 transition-all cursor-pointer" onClick={() => onDrilldown('reserves')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Reserves</span>
            <DollarSign className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-2xl font-bold text-primary">{formatM(data.totalReserves)}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground">L: {formatM(data.lowEval)}</span>
            <span className="text-[10px] text-muted-foreground">•</span>
            <span className="text-[10px] text-warning">H: {formatM(data.highEval)}</span>
          </div>
        </div>

        {/* CP1 Rate */}
        <div className="bg-gradient-to-br from-success/10 to-transparent rounded-xl border border-success/30 p-4 hover:border-success/50 transition-all cursor-pointer" onClick={() => onDrilldown('cp1')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-success uppercase tracking-wider">CP1 Rate</span>
            <Shield className="h-3.5 w-3.5 text-success" />
          </div>
          <p className="text-2xl font-bold text-success">{data.cp1Rate}%</p>
          <p className="text-[10px] text-muted-foreground mt-1">{data.cp1Count.toLocaleString()} within limits</p>
        </div>

        {/* BI Lit Spend */}
        <div className="bg-card rounded-xl border p-4 hover:border-primary/50 transition-all cursor-pointer" onClick={() => onDrilldown('budget')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">BI Lit Spend</span>
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-foreground">{formatK(data.biLitSpend2026)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            vs {formatK(data.biLitSpend2025)} <span className="text-success">YoY</span>
          </p>
        </div>
      </div>

      {/* Risk Matrix - 2 Column Layout */}
      <div className="grid grid-cols-2 gap-3">
        {/* Left: Risk Indicators */}
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-bold uppercase tracking-wide">Risk Indicators</h3>
          </div>
          
          <div className="space-y-3">
            {/* No Eval Alert */}
            <div 
              className="flex items-center justify-between p-3 bg-warning/10 rounded-lg border border-warning/20 cursor-pointer hover:bg-warning/20 transition-colors"
              onClick={() => onDrilldown('noeval')}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <div>
                  <p className="text-sm font-semibold text-foreground">No Evaluation</p>
                  <p className="text-xs text-muted-foreground">{formatM(data.noEvalReserves)} exposure</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-warning">{data.noEvalCount}</p>
                <p className="text-[10px] text-muted-foreground">
                  {((data.noEvalCount / data.totalClaims) * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Aged 365+ Alert */}
            <div 
              className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg border border-destructive/20 cursor-pointer hover:bg-destructive/20 transition-colors"
              onClick={() => onDrilldown('aged365')}
            >
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-destructive" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Aged 365+</p>
                  <p className="text-xs text-muted-foreground">{formatM(data.aged365Reserves)} exposure</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-destructive">{data.aged365Plus}</p>
                <p className="text-[10px] text-muted-foreground">
                  {((data.aged365Plus / data.totalClaims) * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Pending Decisions */}
            <div 
              className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={() => onDrilldown('decisions')}
            >
              <div className="flex items-center gap-3">
                <Flag className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Decisions Pending</p>
                  <p className="text-xs text-muted-foreground">{formatM(data.decisionsExposure)} exposure</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">{data.decisionsCount}</p>
                <p className="text-[10px] text-muted-foreground">action items</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Age Distribution Pie */}
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-3">
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold uppercase tracking-wide">Age Distribution</h3>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="h-32 w-32 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ageData}
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {ageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {ageData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-muted-foreground">{item.name} days</span>
                  </div>
                  <span className="text-xs font-semibold">{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Trend Chart - Full Width */}
      <div className="bg-card rounded-xl border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold uppercase tracking-wide">6-Month Trend</h3>
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">Claims</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-muted-foreground">Reserves</span>
            </div>
          </div>
        </div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorClaims" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '11px'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="claims" 
                stroke="hsl(var(--primary))" 
                fillOpacity={1} 
                fill="url(#colorClaims)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <button 
          onClick={onOpenChat}
          className="flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/30 hover:to-pink-600/30 rounded-xl border border-purple-500/30 transition-all"
        >
          <Target className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-semibold text-foreground">AI Insights</span>
        </button>
        <button 
          onClick={() => onDrilldown('litigation')}
          className="flex items-center justify-center gap-2 p-3 bg-card hover:bg-muted rounded-xl border transition-all"
        >
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Litigation ({data.litCount})</span>
        </button>
        <button 
          onClick={() => onDrilldown('export')}
          className="flex items-center justify-center gap-2 p-3 bg-card hover:bg-muted rounded-xl border transition-all"
        >
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Export Report</span>
        </button>
      </div>
    </div>
  );
}
