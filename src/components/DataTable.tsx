import { useState } from "react";
import { ChevronUp, ChevronDown, ExternalLink, MessageSquare } from "lucide-react";
import { LitigationMatter } from "@/hooks/useLitigationData";
import { cn } from "@/lib/utils";
import { SMSDialog } from "./SMSDialog";

interface DataTableProps {
  data: LitigationMatter[];
  view: 'exec' | 'manager' | 'adjuster';
}

type SortField = keyof LitigationMatter;
type SortDirection = 'asc' | 'desc';

// Pain level to severity mapping
const getPainSeverity = (painLvl: number): 'Low' | 'Medium' | 'High' | 'Critical' => {
  if (painLvl <= 2) return 'Low';
  if (painLvl <= 5) return 'Medium';
  if (painLvl <= 7) return 'High';
  return 'Critical';
};

// CWP/CWN Badge
function StatusBadge({ status }: { status: 'CWP' | 'CWN' }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
      status === 'CWP' 
        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
        : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
    )}>
      {status}
    </span>
  );
}

// Pain Level Badge
function PainBadge({ level }: { level: number }) {
  const severity = getPainSeverity(level);
  const colors = {
    Low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    Medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    High: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    Critical: "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
  };
  
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border",
      colors[severity]
    )}>
      {level}
    </span>
  );
}

export function DataTable({ data, view }: DataTableProps) {
  const [sortField, setSortField] = useState<SortField>('paymentDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [selectedMatter, setSelectedMatter] = useState<LitigationMatter | null>(null);
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    const aStr = String(aVal ?? '');
    const bStr = String(bVal ?? '');
    return sortDirection === 'asc' 
      ? aStr.localeCompare(bStr) 
      : bStr.localeCompare(aStr);
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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

  // Different column visibility based on view
  const showFinancials = view === 'exec' || view === 'manager';
  const showAssignees = view === 'manager' || view === 'adjuster';

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      {/* Mobile Card View */}
      <div className="block sm:hidden">
        {sortedData.slice(0, 50).map((matter, index) => (
          <div 
            key={`mobile-${matter.id}-${index}`}
            className="p-3 border-b border-border last:border-b-0"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-mono text-sm text-primary font-medium">{matter.prefix}-{matter.claim}</p>
                <p className="text-xs text-muted-foreground">{matter.uniqueRecord}</p>
              </div>
              <div className="flex items-center gap-1">
                <StatusBadge status={matter.cwpCwn} />
                <PainBadge level={matter.endPainLvl} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div>
                <span className="text-muted-foreground">Team: </span>
                <span>{matter.team}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Dept: </span>
                <span>{matter.dept}</span>
              </div>
              {showAssignees && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Adjuster: </span>
                  <span>{matter.adjusterName}</span>
                </div>
              )}
            </div>
            
            {showFinancials && (
              <div className="flex items-center justify-between text-xs border-t border-border/50 pt-2 mt-2">
                <div>
                  <span className="text-muted-foreground">Net: </span>
                  <span className={matter.netAmount > 100000 ? "text-red-400 font-medium" : ""}>
                    {formatCurrency(matter.netAmount)}
                  </span>
                </div>
                <button 
                  onClick={() => {
                    setSelectedMatter(matter);
                    setSmsDialogOpen(true);
                  }}
                  className="p-2 rounded-lg bg-primary/10 text-primary"
                >
                  <MessageSquare className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}
        
        {sortedData.length === 0 && (
          <div className="py-8 text-center text-muted-foreground text-sm">
            No matters match your filters.
          </div>
        )}
        
        {sortedData.length > 50 && (
          <div className="py-3 text-center text-xs text-muted-foreground border-t border-border">
            Showing 50 of {sortedData.length} records
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <SortHeader field="uniqueRecord">Record ID</SortHeader>
              <SortHeader field="class">Class</SortHeader>
              <SortHeader field="claim">Claim</SortHeader>
              <SortHeader field="cwpCwn">Status</SortHeader>
              <SortHeader field="endPainLvl">Pain</SortHeader>
              <SortHeader field="dept">Dept</SortHeader>
              <SortHeader field="team">Team</SortHeader>
              {showAssignees && <SortHeader field="adjusterName">Adjuster</SortHeader>}
              <SortHeader field="expCategory">Exp Cat</SortHeader>
              {showFinancials && <SortHeader field="indemnitiesAmount">Indemnities</SortHeader>}
              {showFinancials && <SortHeader field="totalAmount">Total Amt</SortHeader>}
              {showFinancials && <SortHeader field="netAmount">Net Amt</SortHeader>}
              <SortHeader field="paymentDate">Payment Date</SortHeader>
              <th className="text-right pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.slice(0, 100).map((matter, index) => (
              <tr 
                key={`${matter.id}-${index}`}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 20}ms` }}
              >
                <td className="font-mono text-sm text-primary">{matter.uniqueRecord}</td>
                <td>
                  <span className="text-sm px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {matter.class}
                  </span>
                </td>
                <td className="font-mono text-sm">{matter.prefix}-{matter.claim}</td>
                <td><StatusBadge status={matter.cwpCwn} /></td>
                <td><PainBadge level={matter.endPainLvl} /></td>
                <td className="text-sm">{matter.dept}</td>
                <td className="text-sm text-muted-foreground">{matter.team}</td>
                {showAssignees && <td className="text-sm">{matter.adjusterName}</td>}
                <td>
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {matter.expCategory}
                  </span>
                </td>
                {showFinancials && (
                  <td className={cn(
                    "font-mono text-sm text-right",
                    matter.indemnitiesAmount > 0 ? "text-emerald-400" : "text-muted-foreground"
                  )}>
                    {formatCurrency(matter.indemnitiesAmount)}
                  </td>
                )}
                {showFinancials && (
                  <td className="font-mono text-sm text-right">
                    {formatCurrency(matter.totalAmount)}
                  </td>
                )}
                {showFinancials && (
                  <td className={cn(
                    "font-mono text-sm text-right font-medium",
                    matter.netAmount > 100000 ? "text-red-400" : 
                    matter.netAmount > 0 ? "text-amber-400" : "text-muted-foreground"
                  )}>
                    {formatCurrency(matter.netAmount)}
                  </td>
                )}
                <td className="text-sm text-muted-foreground">{matter.paymentDate}</td>
                <td className="text-right pr-4">
                  <div className="flex items-center justify-end gap-1">
                    <button 
                      onClick={() => {
                        setSelectedMatter(matter);
                        setSmsDialogOpen(true);
                      }}
                      className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                      title="Send SMS Alert"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-primary">
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {sortedData.length === 0 && (
        <div className="hidden sm:block py-12 text-center text-muted-foreground">
          No matters match your current filters.
        </div>
      )}
      
      {sortedData.length > 100 && (
        <div className="hidden sm:block py-3 text-center text-sm text-muted-foreground border-t border-border">
          Showing first 100 of {sortedData.length} records
        </div>
      )}
      
      {selectedMatter && (
        <SMSDialog
          open={smsDialogOpen}
          onClose={() => {
            setSmsDialogOpen(false);
            setSelectedMatter(null);
          }}
          context={{
            matterId: selectedMatter.uniqueRecord,
            claimType: selectedMatter.class,
            region: selectedMatter.team,
            exposure: selectedMatter.netAmount,
            description: `${selectedMatter.claim} - Pain Level: ${selectedMatter.endPainLvl}`
          }}
        />
      )}
    </div>
  );
}
