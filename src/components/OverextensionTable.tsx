import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { LitigationMatter } from "@/hooks/useLitigationData";
import { cn } from "@/lib/utils";
import { DrilldownModal } from "./DrilldownModal";

interface OverextensionTableProps {
  data: LitigationMatter[];
}

type SortField = 'riskFlag' | 'litigationStage' | 'expertType' | 'expertSpend' | 'reactiveSpend' | 'postureRatio' | 'team' | 'adjuster';
type SortDirection = 'asc' | 'desc';

// Risk flag calculation based on Posture/Expert ratio
type RiskLevel = 'GREEN' | 'ORANGE' | 'RED';

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
  team: string;
  adjuster: string;
  dept: string;
  // For drilldown
  totalPaid: number;
  indemnity: number;
  expense: number;
  painBand: string;
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

export function OverextensionTable({ data }: OverextensionTableProps) {
  const [sortField, setSortField] = useState<SortField>('reactiveSpend');
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
      
      aggregated.push({
        id: key,
        uniqueRecord: first.uniqueRecord,
        claim: first.claim,
        claimant: first.claimant,
        coverage: first.coverage,
        litigationStage: getLitigationStage(maxPain),
        expertType: getExpertType(first.expCategory),
        expertSpend,
        reactiveSpend,
        postureRatio: ratio,
        riskFlag: getRiskFlag(ratio),
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
          aVal = a.reactiveSpend;
          bVal = b.reactiveSpend;
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
    
    return { redCount, orangeCount, greenCount, totalReactive, totalExpert };
  }, [sortedData]);

  return (
    <>
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
          <span className="font-mono">Default: Highest Reactive Spend</span>
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
