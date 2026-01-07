import React from "react";
import { 
  FileStack, Clock, AlertTriangle, DollarSign, TrendingUp, 
  TrendingDown, CheckCircle2, ArrowUpRight, ArrowDownRight, 
  MessageCircle, Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SimpleDashboardV2Props {
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
    cp1Count: number;
    cp1Rate: string;
    decisionsCount: number;
    dataDate: string;
    delta?: {
      change: number;
      changePercent: number;
      previousDate: string;
    };
  };
  onOpenChat: () => void;
}

export function SimpleDashboardV2({ data, onOpenChat }: SimpleDashboardV2Props) {
  const formatM = (val: number) => `$${(val / 1000000).toFixed(1)}M`;
  const formatK = (val: number) => val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val.toString();
  
  // Health score calculation (simple 0-100)
  const healthScore = Math.max(0, Math.min(100, 
    100 - 
    (data.aged365Plus / data.totalClaims * 30) - // Penalty for aged claims
    (data.noEvalCount / data.totalClaims * 20) - // Penalty for no eval
    (data.decisionsCount > 50 ? 10 : 0) // Penalty for pending decisions
  )).toFixed(0);

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return 'Healthy';
    if (score >= 60) return 'Needs Attention';
    return 'Critical';
  };

  return (
    <div className="space-y-6 p-2">
      {/* Header - Big friendly number */}
      <div className="text-center py-8 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl border border-primary/20">
        <p className="text-sm text-muted-foreground uppercase tracking-widest mb-2">Your Open Claims</p>
        <p className="text-6xl font-bold text-foreground">{data.totalClaims.toLocaleString()}</p>
        {data.delta && (
          <div className={`inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full text-sm font-medium ${data.delta.change >= 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
            {data.delta.change >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {Math.abs(data.delta.change)} since {data.delta.previousDate}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">As of {data.dataDate}</p>
      </div>

      {/* Health Score - Single Big Indicator */}
      <div className="bg-card rounded-2xl border p-6 text-center">
        <div className={`text-7xl font-bold ${getHealthColor(parseInt(healthScore))}`}>
          {healthScore}
        </div>
        <p className="text-lg font-medium text-muted-foreground mt-2">Portfolio Health Score</p>
        <Badge variant="outline" className={`mt-3 ${getHealthColor(parseInt(healthScore))}`}>
          {getHealthLabel(parseInt(healthScore))}
        </Badge>
      </div>

      {/* 3 Big Cards - Money Story */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-6 border border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wide">Total Reserves</p>
              <p className="text-4xl font-bold text-primary mt-1">{formatM(data.totalReserves)}</p>
              <p className="text-sm text-muted-foreground mt-2">Money set aside for claims</p>
            </div>
            <div className="p-4 bg-primary/20 rounded-2xl">
              <DollarSign className="h-10 w-10 text-primary" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card rounded-2xl p-5 border">
            <p className="text-xs text-muted-foreground uppercase">Expected Low</p>
            <p className="text-2xl font-bold text-foreground mt-1">{formatM(data.lowEval)}</p>
            <p className="text-xs text-success mt-2 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Best case
            </p>
          </div>
          <div className="bg-card rounded-2xl p-5 border">
            <p className="text-xs text-muted-foreground uppercase">Expected High</p>
            <p className="text-2xl font-bold text-warning mt-1">{formatM(data.highEval)}</p>
            <p className="text-xs text-warning mt-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Worst case
            </p>
          </div>
        </div>
      </div>

      {/* Action Items - Simple List */}
      <div className="bg-card rounded-2xl border p-5">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Needs Your Attention
        </h3>
        <div className="space-y-3">
          {data.noEvalCount > 0 && (
            <div className="flex items-center justify-between p-3 bg-warning/10 rounded-xl border border-warning/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-warning/20 rounded-full flex items-center justify-center">
                  <span className="text-lg">📋</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Claims Need Evaluation</p>
                  <p className="text-sm text-muted-foreground">{formatM(data.noEvalReserves)} at risk</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-warning">{data.noEvalCount}</span>
            </div>
          )}
          
          {data.aged365Plus > 0 && (
            <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-xl border border-destructive/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-destructive/20 rounded-full flex items-center justify-center">
                  <span className="text-lg">⏰</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Old Claims (1+ Year)</p>
                  <p className="text-sm text-muted-foreground">{formatM(data.aged365Reserves)} exposure</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-destructive">{data.aged365Plus}</span>
            </div>
          )}

          {data.decisionsCount > 0 && (
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl border border-primary/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                  <span className="text-lg">✋</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Decisions Needed</p>
                  <p className="text-sm text-muted-foreground">High priority claims</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-primary">{data.decisionsCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Good News Section */}
      <div className="bg-gradient-to-r from-success/10 to-success/5 rounded-2xl border border-success/20 p-5">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-success">
          <CheckCircle2 className="h-5 w-5" />
          Good News
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-success">{data.cp1Count.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Claims within policy limits</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-success">{data.cp1Rate}%</p>
            <p className="text-sm text-muted-foreground">of total claims</p>
          </div>
        </div>
      </div>

      {/* Simple Age Breakdown */}
      <div className="bg-card rounded-2xl border p-5">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          How Old Are Your Claims?
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Under 6 months</span>
            <span className="font-bold text-success">Good</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">6 months - 1 year</span>
            <span className="font-bold text-warning">{data.aged181to365} claims</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Over 1 year</span>
            <span className="font-bold text-destructive">{data.aged365Plus} claims</span>
          </div>
        </div>
      </div>

      {/* AI Assistant Prompt */}
      <button 
        onClick={onOpenChat}
        className="w-full bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 hover:from-purple-500/30 hover:via-pink-500/30 hover:to-purple-500/30 rounded-2xl border border-purple-500/30 p-5 text-left transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/20 rounded-xl group-hover:scale-110 transition-transform">
            <Sparkles className="h-6 w-6 text-purple-500" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Have a Question?</p>
            <p className="text-sm text-muted-foreground">Ask the AI assistant for deeper insights</p>
          </div>
          <MessageCircle className="h-5 w-5 text-purple-500 ml-auto" />
        </div>
      </button>
    </div>
  );
}
