import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { LitigationMatter } from "@/hooks/useLitigationData";
import { cn } from "@/lib/utils";
import { DrilldownModal } from "./DrilldownModal";

interface OverextensionTableProps {
  data: LitigationMatter[];
}

type SortField = 'riskFlag' | 'litigationStage' | 'expertType' | 'expertSpend' | 'reactiveSpend' | 'postureRatio' | 'team' | 'adjuster' | 'executiveReview';
type SortDirection = 'asc' | 'desc';

// Risk flag calculation based on Posture/Expert ratio
type RiskLevel = 'GREEN' | 'ORANGE' | 'RED';

// Executive Review classification - hybrid of age, stage, duration, and complexity
type ExecutiveReviewLevel = 'NONE' | 'WATCH' | 'REQUIRED' | 'CRITICAL';

interface ExecutiveReviewResult {
  level: ExecutiveReviewLevel;
  reasons: string[];
  score: number;
}

interface AggregatedMatter {
  id: string;
  uniqueRecord: string;
  claim: string;
  claimant: string;
  coverage: string;
  litigationStage: 'Early' | 'Mid' | 'Late' | 'Very Late';
  expertType: string;
  expertSpend: number;
  reactiveSpend: number;
  postureRatio: number;
  riskFlag: RiskLevel;
  executiveReview: ExecutiveReviewResult;
  team: string;
  adjuster: string;
  dept: string;
  // For drilldown
  totalPaid: number;
  indemnity: number;
  expense: number;
  painBand: string;
  claimAge: number; // years
  painEscalation: number; // difference between end and start pain
  transactions: LitigationMatter[];
}

// Determine litigation stage based on pain level
function getLitigationStage(painLvl: number): 'Early' | 'Mid' | 'Late' | 'Very Late' {
  if (painLvl <= 2) return 'Early';
  if (painLvl <= 5) return 'Mid';
  if (painLvl <= 7) return 'Late';
  return 'Very Late';
}

// Determine expert type from expense category
function getExpertType(expCategory: string): string {
  if (!expCategory) return 'Other';
  const cat = expCategory.toUpperCase();
  if (cat.includes('MEDICAL') || cat.includes('MED')) return 'Medical';
  if (cat.includes('LEGAL') || cat.includes('ATTORNEY')) return 'Legal';
  if (cat.includes('EXPERT') || cat.includes('CONSULT')) return 'Consultant';
  if (cat.includes('ENGINEER')) return 'Engineering';
  if (cat.includes('ACCOUNT') || cat.includes('ECON')) return 'Economic';
  return 'Other';
}

// Calculate risk flag based on ratio
function getRiskFlag(ratio: number): RiskLevel {
  if (ratio < 1.5) return 'GREEN';
  if (ratio < 3) return 'ORANGE';
  return 'RED';
}

// Estimate claim age from prefix (lower prefixes = older claims)
// Prefix appears to be 2-digit year codes: 65 = 2016-2017, 78 = 2017-2018, etc.
function estimateClaimAge(prefix: string, claim: string): number {
  const currentYear = 2025;
  
  // Try to extract year from prefix pattern
  const prefixNum = parseInt(prefix);
  if (isNaN(prefixNum)) return 0;
  
  // Common prefix patterns mapping to approximate years
  // This is an approximation - real logic would use actual claim dates
  if (prefixNum <= 39) return currentYear - 2017; // ~8 years
  if (prefixNum <= 55) return currentYear - 2018; // ~7 years  
  if (prefixNum <= 65) return currentYear - 2019; // ~6 years
  if (prefixNum <= 70) return currentYear - 2020; // ~5 years
  if (prefixNum <= 72) return currentYear - 2021; // ~4 years
  if (prefixNum <= 78) return currentYear - 2022; // ~3 years
  if (prefixNum <= 89) return currentYear - 2023; // ~2 years
  return currentYear - 2024; // ~1 year
}

// HYBRID EXECUTIVE REVIEW CLASSIFICATION
// Combines: 1) Age, 2) Stage mismatch, 3) Duration drift, 4) Complexity markers
function calculateExecutiveReview(
  claimAge: number,
  litigationStage: 'Early' | 'Mid' | 'Late' | 'Very Late',
  expertSpend: number,
  reactiveSpend: number,
  painEscalation: number,
  maxPain: number,
  expCategory: string
): ExecutiveReviewResult {
  let score = 0;
  const reasons: string[] = [];
  
  // 1. AGE-BASED FLAGS (claims >3 years = concern, >5 years = serious)
  if (claimAge >= 7) {
    score += 40;
    reasons.push(`${claimAge}yr old claim - requires closure strategy`);
  } else if (claimAge >= 5) {
    score += 25;
    reasons.push(`${claimAge}yr in litigation - duration drift`);
  } else if (claimAge >= 3) {
    score += 10;
    reasons.push(`${claimAge}yr claim - monitor timeline`);
  }
  
  // 2. STAGE MISMATCH (late stage + zero expert spend = discipline failure)
  if ((litigationStage === 'Late' || litigationStage === 'Very Late') && expertSpend === 0) {
    score += 35;
    reasons.push(`${litigationStage} stage with no expert engagement`);
  } else if (litigationStage === 'Very Late' && expertSpend < 1000) {
    score += 20;
    reasons.push(`Very Late stage, minimal expert ($${expertSpend.toLocaleString()})`);
  }
  
  // 3. SPEND DRIFT (reactive spend accumulating without strategic action)
  if (reactiveSpend > 0 && expertSpend === 0) {
    score += 15;
    reasons.push(`$${reactiveSpend.toLocaleString()} reactive, no expert posture`);
  }
  
  // 4. COMPLEXITY MARKERS (pain escalation, trustee patterns, high severity)
  if (painEscalation >= 5) {
    score += 20;
    reasons.push(`Pain escalated ${painEscalation} levels - case complexity grew`);
  } else if (painEscalation >= 3) {
    score += 10;
    reasons.push(`Pain escalated ${painEscalation} levels`);
  }
  
  // Trustee / complex litigation markers (L3L, LIM categories often indicate complex matters)
  const cat = expCategory.toUpperCase();
  if (cat.includes('L3L') || cat.includes('LIM')) {
    score += 15;
    reasons.push(`Complex litigation category (${expCategory})`);
  }
  
  // Very high pain at current state
  if (maxPain >= 9 && claimAge >= 3) {
    score += 15;
    reasons.push(`Critical pain (${maxPain}/10) on aged claim`);
  }
  
  // Determine level based on score
  let level: ExecutiveReviewLevel;
  if (score >= 50) {
    level = 'CRITICAL';
  } else if (score >= 30) {
    level = 'REQUIRED';
  } else if (score >= 15) {
    level = 'WATCH';
  } else {
    level = 'NONE';
  }
  
  return { level, reasons, score };
}

// Get pain band label
function getPainBand(painLvl: number): string {
  if (painLvl <= 2) return 'Low (1-2)';
  if (painLvl <= 5) return 'Medium (3-5)';
  if (painLvl <= 7) return 'High (6-7)';
  return 'Critical (8-10)';
}

// Risk flag badge component
function RiskBadge({ level }: { level: RiskLevel }) {
  const colors = {
    GREEN: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    ORANGE: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    RED: "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
  };
  
  return (
    <span className={cn(
      "inline-flex items-center justify-center w-20 px-2 py-1 rounded text-xs font-bold border",
      colors[level]
    )}>
      {level}
    </span>
  );
}

// Stage badge component
function StageBadge({ stage }: { stage: string }) {
  const colors = {
    'Early': "bg-emerald-500/10 text-emerald-400",
    'Mid': "bg-amber-500/10 text-amber-400",
    'Late': "bg-orange-500/10 text-orange-400",
    'Very Late': "bg-red-500/10 text-red-400"
  };
  
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
      colors[stage as keyof typeof colors] || "bg-muted text-muted-foreground"
    )}>
      {stage}
    </span>
  );
}

// Executive Review badge component
function ExecutiveReviewBadge({ review }: { review: ExecutiveReviewResult }) {
  const colors = {
    NONE: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    WATCH: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    REQUIRED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    CRITICAL: "bg-red-600/25 text-red-300 border-red-500/40 animate-pulse"
  };
  
  const labels = {
    NONE: "—",
    WATCH: "WATCH",
    REQUIRED: "EXEC",
    CRITICAL: "CRITICAL"
  };
  
  if (review.level === 'NONE') {
    return <span className="text-zinc-500 text-xs">—</span>;
  }
  
  return (
    <span 
      className={cn(
        "inline-flex items-center justify-center w-16 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-help",
        colors[review.level]
      )}
      title={review.reasons.join('\n')}
    >
      {labels[review.level]}
    </span>
  );
}

export function OverextensionTable({ data }: OverextensionTableProps) {
  const [sortField, setSortField] = useState<SortField>('executiveReview');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedMatter, setSelectedMatter] = useState<AggregatedMatter | null>(null);

  // Aggregate data by unique record
  const aggregatedData = useMemo(() => {
    const groupedMap = new Map<string, LitigationMatter[]>();
    
    data.forEach(matter => {
      const key = matter.uniqueRecord || matter.id;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, []);
      }
      groupedMap.get(key)!.push(matter);
    });

    const aggregated: AggregatedMatter[] = [];
    
    groupedMap.forEach((transactions, key) => {
      const first = transactions[0];
      const totalExpense = transactions.reduce((sum, t) => sum + (t.totalAmount - t.indemnitiesAmount), 0);
      const totalIndemnity = transactions.reduce((sum, t) => sum + t.indemnitiesAmount, 0);
      const totalPaid = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
      
      // Expert spend = expense categories related to experts
      const expertSpend = transactions
        .filter(t => ['Medical', 'Legal', 'Consultant', 'Engineering', 'Economic'].includes(getExpertType(t.expCategory)))
        .reduce((sum, t) => sum + (t.totalAmount - t.indemnitiesAmount), 0);
      
      // Reactive posture spend = late stage high-pain transactions
      const reactiveSpend = transactions
        .filter(t => t.endPainLvl >= 6)
        .reduce((sum, t) => sum + t.totalAmount, 0);
      
      const ratio = expertSpend > 0 ? reactiveSpend / expertSpend : (reactiveSpend > 0 ? 10 : 0);
      const maxPain = Math.max(...transactions.map(t => t.endPainLvl));
      const minPain = Math.min(...transactions.map(t => t.startPainLvl));
      const painEscalation = maxPain - minPain;
      const litigationStage = getLitigationStage(maxPain);
      const claimAge = estimateClaimAge(first.prefix, first.claim);
      
      // Calculate executive review using hybrid criteria
      const executiveReview = calculateExecutiveReview(
        claimAge,
        litigationStage,
        expertSpend,
        reactiveSpend,
        painEscalation,
        maxPain,
        first.expCategory
      );
      
      aggregated.push({
        id: key,
        uniqueRecord: first.uniqueRecord,
        claim: first.claim,
        claimant: first.claimant,
        coverage: first.coverage,
        litigationStage,
        expertType: getExpertType(first.expCategory),
        expertSpend,
        reactiveSpend,
        postureRatio: ratio,
        riskFlag: getRiskFlag(ratio),
        executiveReview,
        claimAge,
        painEscalation,
        team: first.team,
        adjuster: first.adjusterName,
        dept: first.dept,
        totalPaid,
        indemnity: totalIndemnity,
        expense: totalExpense,
        painBand: getPainBand(maxPain),
        transactions: transactions.sort((a, b) => 
          new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
        )
      });
    });

    return aggregated;
  }, [data]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = useMemo(() => {
    return [...aggregatedData].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      
      switch (sortField) {
        case 'riskFlag':
          const riskOrder = { RED: 3, ORANGE: 2, GREEN: 1 };
          aVal = riskOrder[a.riskFlag];
          bVal = riskOrder[b.riskFlag];
          break;
        case 'executiveReview':
          aVal = a.executiveReview.score;
          bVal = b.executiveReview.score;
          break;
        case 'litigationStage':
          const stageOrder = { 'Very Late': 4, 'Late': 3, 'Mid': 2, 'Early': 1 };
          aVal = stageOrder[a.litigationStage];
          bVal = stageOrder[b.litigationStage];
          break;
        case 'expertType':
          aVal = a.expertType;
          bVal = b.expertType;
          break;
        case 'expertSpend':
          aVal = a.expertSpend;
          bVal = b.expertSpend;
          break;
        case 'reactiveSpend':
          aVal = a.reactiveSpend;
          bVal = b.reactiveSpend;
          break;
        case 'postureRatio':
          aVal = a.postureRatio;
          bVal = b.postureRatio;
          break;
        case 'team':
          aVal = a.team;
          bVal = b.team;
          break;
        case 'adjuster':
          aVal = a.adjuster;
          bVal = b.adjuster;
          break;
        default:
          aVal = a.executiveReview.score;
          bVal = b.executiveReview.score;
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      return sortDirection === 'asc' 
        ? String(aVal).localeCompare(String(bVal)) 
        : String(bVal).localeCompare(String(aVal));
    });
  }, [aggregatedData, sortField, sortDirection]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatRatio = (ratio: number) => {
    if (ratio === 0) return '—';
    return `${ratio.toFixed(1)}x`;
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th 
      onClick={() => handleSort(field)}
      className="cursor-pointer hover:text-foreground transition-colors group"
    >
      <div className="flex items-center gap-1">
        {children}
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
          {sortField === field ? (
            sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          )}
        </span>
      </div>
    </th>
  );

  // Summary stats
  const stats = useMemo(() => {
    const redCount = sortedData.filter(d => d.riskFlag === 'RED').length;
    const orangeCount = sortedData.filter(d => d.riskFlag === 'ORANGE').length;
    const greenCount = sortedData.filter(d => d.riskFlag === 'GREEN').length;
    const totalReactive = sortedData.reduce((sum, d) => sum + d.reactiveSpend, 0);
    const totalExpert = sortedData.reduce((sum, d) => sum + d.expertSpend, 0);
    
    // Executive review counts
    const execCritical = sortedData.filter(d => d.executiveReview.level === 'CRITICAL').length;
    const execRequired = sortedData.filter(d => d.executiveReview.level === 'REQUIRED').length;
    const execWatch = sortedData.filter(d => d.executiveReview.level === 'WATCH').length;
    
    return { redCount, orangeCount, greenCount, totalReactive, totalExpert, execCritical, execRequired, execWatch };
  }, [sortedData]);

  return (
    <>
      {/* Executive Review Summary - Priority Row */}
      <div className="mb-4 p-4 rounded-xl border-2 border-purple-500/30 bg-purple-500/5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-purple-400 font-bold text-sm uppercase tracking-wide">Executive Review Required</span>
          <span className="text-muted-foreground text-xs">(Hybrid: Age + Stage Mismatch + Spend Drift + Complexity)</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-600/15 border border-red-500/30 rounded-lg p-3 text-center">
            <div className="text-red-300 text-3xl font-bold font-mono">{stats.execCritical}</div>
            <div className="text-red-400/80 text-xs uppercase tracking-wide">CRITICAL</div>
            <div className="text-red-400/60 text-[10px] mt-0.5">Exec Closure Needed</div>
          </div>
          <div className="bg-purple-500/15 border border-purple-500/30 rounded-lg p-3 text-center">
            <div className="text-purple-300 text-3xl font-bold font-mono">{stats.execRequired}</div>
            <div className="text-purple-400/80 text-xs uppercase tracking-wide">REQUIRED</div>
            <div className="text-purple-400/60 text-[10px] mt-0.5">Needs Exec Decision</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
            <div className="text-amber-300 text-3xl font-bold font-mono">{stats.execWatch}</div>
            <div className="text-amber-400/80 text-xs uppercase tracking-wide">WATCH</div>
            <div className="text-amber-400/60 text-[10px] mt-0.5">Monitor Closely</div>
          </div>
        </div>
      </div>

      {/* Risk Summary Bar */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="text-red-400 text-2xl font-bold font-mono">{stats.redCount}</div>
          <div className="text-red-400/70 text-xs uppercase tracking-wide">Critical (≥3x)</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="text-orange-400 text-2xl font-bold font-mono">{stats.orangeCount}</div>
          <div className="text-orange-400/70 text-xs uppercase tracking-wide">Warning (1.5-3x)</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
          <div className="text-emerald-400 text-2xl font-bold font-mono">{stats.greenCount}</div>
          <div className="text-emerald-400/70 text-xs uppercase tracking-wide">Normal (&lt;1.5x)</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-foreground text-2xl font-bold font-mono">{formatCurrency(stats.totalReactive)}</div>
          <div className="text-muted-foreground text-xs uppercase tracking-wide">Total Reactive</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-foreground text-2xl font-bold font-mono">{formatCurrency(stats.totalExpert)}</div>
          <div className="text-muted-foreground text-xs uppercase tracking-wide">Total Expert</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto max-h-[calc(100vh-400px)]">
          <table className="data-table">
            <thead>
              <tr>
                <SortHeader field="executiveReview">Exec Review</SortHeader>
                <SortHeader field="riskFlag">Risk</SortHeader>
                <SortHeader field="litigationStage">Stage</SortHeader>
                <SortHeader field="expertType">Expert Type</SortHeader>
                <SortHeader field="expertSpend">Expert Spend</SortHeader>
                <SortHeader field="reactiveSpend">Reactive Spend</SortHeader>
                <SortHeader field="postureRatio">Ratio</SortHeader>
                <SortHeader field="team">Team</SortHeader>
                <SortHeader field="adjuster">Adjuster</SortHeader>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((matter, index) => (
                <tr 
                  key={matter.id}
                  onClick={() => setSelectedMatter(matter)}
                  className="cursor-pointer animate-fade-in hover:bg-muted/50"
                  style={{ animationDelay: `${Math.min(index * 10, 500)}ms` }}
                >
                  <td><ExecutiveReviewBadge review={matter.executiveReview} /></td>
                  <td><RiskBadge level={matter.riskFlag} /></td>
                  <td><StageBadge stage={matter.litigationStage} /></td>
                  <td>
                    <span className="text-sm px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {matter.expertType}
                    </span>
                  </td>
                  <td className="font-mono text-sm text-right">
                    {formatCurrency(matter.expertSpend)}
                  </td>
                  <td className={cn(
                    "font-mono text-sm text-right font-medium",
                    matter.reactiveSpend > 100000 ? "text-red-400" : 
                    matter.reactiveSpend > 50000 ? "text-orange-400" : "text-foreground"
                  )}>
                    {formatCurrency(matter.reactiveSpend)}
                  </td>
                  <td className={cn(
                    "font-mono text-sm text-center font-bold",
                    matter.riskFlag === 'RED' ? "text-red-400" : 
                    matter.riskFlag === 'ORANGE' ? "text-orange-400" : "text-emerald-400"
                  )}>
                    {formatRatio(matter.postureRatio)}
                  </td>
                  <td className="text-sm">{matter.team}</td>
                  <td className="text-sm text-muted-foreground">{matter.adjuster}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {sortedData.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            No matters match your current filters.
          </div>
        )}
        
        <div className="py-3 px-4 text-sm text-muted-foreground border-t border-border flex justify-between">
          <span>Showing {sortedData.length.toLocaleString()} unique matters</span>
          <span className="font-mono">Default: Executive Review Priority</span>
        </div>
      </div>

      {/* Drilldown Modal */}
      <DrilldownModal 
        matter={selectedMatter} 
        onClose={() => setSelectedMatter(null)} 
      />
    </>
  );
}
