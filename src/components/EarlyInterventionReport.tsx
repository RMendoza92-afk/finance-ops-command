import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Target, 
  AlertTriangle, 
  TrendingDown, 
  Users, 
  DollarSign,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  Filter,
  Download,
  Zap
} from 'lucide-react';
import { useEarlyIntervention, InterventionStrategy, EarlyInterventionClaim } from '@/hooks/useEarlyIntervention';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const STRATEGY_CONFIG: Record<InterventionStrategy, { 
  label: string; 
  icon: React.ReactNode; 
  color: string;
  description: string;
}> = {
  'LOR_CANDIDATE': {
    label: 'LOR Candidate',
    icon: <Target className="h-4 w-4" />,
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    description: 'Liability clear, approaching limits - tender early',
  },
  'PROACTIVE_NEGO': {
    label: 'Proactive Negotiation',
    icon: <Users className="h-4 w-4" />,
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    description: 'Serious injury with demand - engage proactively',
  },
  'RESERVE_CORRECTION': {
    label: 'Reserve Correction',
    icon: <TrendingDown className="h-4 w-4" />,
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    description: 'High eval exceeds reserves - adjust before surprise',
  },
  'EXPERT_EARLY': {
    label: 'Expert Early',
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    description: 'Fatality/TBI/Life Care - early expert critical',
  },
};

interface ClaimRowProps {
  claim: EarlyInterventionClaim;
}

function ClaimRow({ claim }: ClaimRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const primaryConfig = STRATEGY_CONFIG[claim.primaryStrategy];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow className="hover:bg-slate-800/50 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <TableCell className="font-mono text-sm">{claim.claimNumber}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              claim.state === 'TEXAS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300'
            }`}>
              {claim.state}
            </span>
            {claim.state === 'TEXAS' && (
              <span className="text-[10px] text-emerald-500 font-medium">PILOT</span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-center">
          <span className={`font-medium ${claim.daysOpen < 60 ? 'text-emerald-400' : claim.daysOpen < 90 ? 'text-amber-400' : 'text-slate-400'}`}>
            {claim.daysOpen}
          </span>
        </TableCell>
        <TableCell className="text-center">
          <span className={`font-bold ${claim.cp1FlagCount >= 5 ? 'text-red-400' : claim.cp1FlagCount >= 3 ? 'text-amber-400' : 'text-slate-400'}`}>
            {claim.cp1FlagCount}
          </span>
        </TableCell>
        <TableCell className="text-right font-mono">{formatCurrency(claim.reserves)}</TableCell>
        <TableCell className="text-center">
          <span className={`font-medium ${claim.reserveToLimitPct >= 80 ? 'text-red-400' : claim.reserveToLimitPct >= 60 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {claim.reserveToLimitPct.toFixed(0)}%
          </span>
        </TableCell>
        <TableCell className="text-right font-mono text-sm text-slate-400">
          {formatCurrency(claim.totalMeds)}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={`${primaryConfig.color} text-xs`}>
            {primaryConfig.icon}
            <span className="ml-1">{primaryConfig.label}</span>
          </Badge>
        </TableCell>
        <TableCell className="text-center">
          <span className={`font-bold ${claim.priorityScore >= 80 ? 'text-red-400' : claim.priorityScore >= 60 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {claim.priorityScore}
          </span>
        </TableCell>
        <TableCell>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </TableCell>
      </TableRow>
      <CollapsibleContent asChild>
        <TableRow className="bg-slate-900/50 border-l-2 border-l-blue-500">
          <TableCell colSpan={10} className="py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Reasoning */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Intervention Reasoning</h4>
                <ul className="space-y-1">
                  {claim.reasoning.map((reason, idx) => (
                    <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                      <Zap className="h-3 w-3 text-amber-400 mt-1 flex-shrink-0" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">Liability:</span>
                  <span className={`ml-2 ${claim.liabilityClear ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {claim.liabilityStatus || (claim.liabilityClear ? 'Clear' : 'Disputed')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Adjuster:</span>
                  <span className="ml-2 text-slate-300">{claim.adjuster || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Team:</span>
                  <span className="ml-2 text-slate-300">{claim.teamGroup || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Phase:</span>
                  <span className="ml-2 text-slate-300">{claim.evaluationPhase || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Low/High Eval:</span>
                  <span className="ml-2 text-slate-300">
                    {formatCurrency(claim.lowEval)} / {formatCurrency(claim.highEval)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">LOR Sent:</span>
                  <span className={`ml-2 ${claim.lorSent ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {claim.lorSent ? `Yes (${claim.lorDate})` : 'No'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* All strategies */}
            {claim.strategies.length > 1 && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <span className="text-xs text-slate-500">All Applicable Strategies: </span>
                <div className="flex gap-2 mt-1">
                  {claim.strategies.map((strategy) => {
                    const config = STRATEGY_CONFIG[strategy];
                    return (
                      <Badge key={strategy} variant="outline" className={`${config.color} text-xs`}>
                        {config.label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function EarlyInterventionReport() {
  const { candidates, summary, loading, error } = useEarlyIntervention();
  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');

  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      if (strategyFilter !== 'all' && !c.strategies.includes(strategyFilter as InterventionStrategy)) return false;
      if (stateFilter !== 'all' && c.state !== stateFilter) return false;
      return true;
    });
  }, [candidates, strategyFilter, stateFilter]);

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-950/20 border-red-500/30">
        <CardContent className="p-6">
          <p className="text-red-400">Error loading intervention data: {String(error)}</p>
        </CardContent>
      </Card>
    );
  }

  const uniqueStates = [...new Set(candidates.map(c => c.state))].sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Target className="h-6 w-6 text-emerald-400" />
            Early Intervention Report
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            3+ CP1 flag claims with actionable intervention strategies • TX Pilot Focus
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Strategy Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(Object.keys(STRATEGY_CONFIG) as InterventionStrategy[]).map((strategy) => {
          const config = STRATEGY_CONFIG[strategy];
          const count = summary.byStrategy[strategy];
          return (
            <Card 
              key={strategy} 
              className={`cursor-pointer transition-all hover:scale-[1.02] ${
                strategyFilter === strategy ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setStrategyFilter(strategyFilter === strategy ? 'all' : strategy)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded ${config.color}`}>
                    {config.icon}
                  </div>
                  <span className="text-xs font-medium text-slate-400">{config.label}</span>
                </div>
                <div className="text-2xl font-bold text-slate-100">{count}</div>
                <p className="text-xs text-slate-500 mt-1">{config.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-emerald-950/50 to-emerald-900/20 border-emerald-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{summary.texasPilotCount}</div>
            <div className="text-xs text-emerald-300/70">TX Pilot Candidates</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-100">{summary.totalCandidates}</div>
            <div className="text-xs text-slate-500">Total Candidates</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-100">{formatCurrency(summary.totalReserves)}</div>
            <div className="text-xs text-slate-500">Total Reserves</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-100">{summary.avgDaysOpen.toFixed(0)}</div>
            <div className="text-xs text-slate-500">Avg Days Open</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-100">{formatCurrency(summary.avgMeds)}</div>
            <div className="text-xs text-slate-500">Avg Meds</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <span className="text-sm text-slate-400">Filters:</span>
        </div>
        <Select value={strategyFilter} onValueChange={setStrategyFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Strategies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Strategies</SelectItem>
            {(Object.keys(STRATEGY_CONFIG) as InterventionStrategy[]).map((strategy) => (
              <SelectItem key={strategy} value={strategy}>
                {STRATEGY_CONFIG[strategy].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            <SelectItem value="TEXAS">🎯 TEXAS (Pilot)</SelectItem>
            {uniqueStates.filter(s => s !== 'TEXAS').map((state) => (
              <SelectItem key={state} value={state}>{state}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(strategyFilter !== 'all' || stateFilter !== 'all') && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => { setStrategyFilter('all'); setStateFilter('all'); }}
          >
            Clear Filters
          </Button>
        )}
        <span className="text-sm text-slate-500 ml-auto">
          Showing {filteredCandidates.length} of {candidates.length} candidates
        </span>
      </div>

      {/* Claims Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-400" />
            Intervention Candidates
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-800/50">
                  <TableHead className="w-32">Claim#</TableHead>
                  <TableHead className="w-24">State</TableHead>
                  <TableHead className="w-20 text-center">Days</TableHead>
                  <TableHead className="w-16 text-center">Flags</TableHead>
                  <TableHead className="w-28 text-right">Reserves</TableHead>
                  <TableHead className="w-20 text-center">% Limit</TableHead>
                  <TableHead className="w-24 text-right">Meds</TableHead>
                  <TableHead className="w-40">Strategy</TableHead>
                  <TableHead className="w-16 text-center">Priority</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.slice(0, 100).map((claim) => (
                  <ClaimRow key={claim.claimNumber} claim={claim} />
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredCandidates.length > 100 && (
            <div className="p-4 text-center text-sm text-slate-500">
              Showing first 100 of {filteredCandidates.length} candidates
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
