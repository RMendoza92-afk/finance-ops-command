import { useState } from "react";
import { ChevronUp, ChevronDown, ExternalLink } from "lucide-react";
import { LitigationMatter } from "@/data/litigationData";
import { StatusBadge, SeverityBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";

interface DataTableProps {
  data: LitigationMatter[];
  view: 'exec' | 'manager' | 'adjuster';
}

type SortField = keyof LitigationMatter;
type SortDirection = 'asc' | 'desc';

export function DataTable({ data, view }: DataTableProps) {
  const [sortField, setSortField] = useState<SortField>('lastActivity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <SortHeader field="id">Matter ID</SortHeader>
              <SortHeader field="claimant">Claimant/Matter</SortHeader>
              <SortHeader field="type">Type</SortHeader>
              <SortHeader field="status">Status</SortHeader>
              <SortHeader field="severity">Severity</SortHeader>
              <SortHeader field="department">Dept</SortHeader>
              {showAssignees && <SortHeader field="attorney">Attorney</SortHeader>}
              {showAssignees && <SortHeader field="adjuster">Adjuster</SortHeader>}
              <SortHeader field="state">State</SortHeader>
              {showFinancials && <SortHeader field="incurredReserve">Reserve</SortHeader>}
              {showFinancials && <SortHeader field="paidToDate">Paid</SortHeader>}
              {showFinancials && <SortHeader field="estimatedExposure">Exposure</SortHeader>}
              <SortHeader field="lastActivity">Last Activity</SortHeader>
              <th className="text-right pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((matter, index) => (
              <tr 
                key={matter.id}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <td className="font-mono text-sm text-primary">{matter.id}</td>
                <td>
                  <div className="max-w-xs">
                    <p className="font-medium truncate">{matter.claimant}</p>
                    <p className="text-xs text-muted-foreground truncate">{matter.claimNumber}</p>
                  </div>
                </td>
                <td>
                  <span className="text-sm px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {matter.type}
                  </span>
                </td>
                <td><StatusBadge status={matter.status} /></td>
                <td><SeverityBadge severity={matter.severity} /></td>
                <td className="text-sm">{matter.department}</td>
                {showAssignees && <td className="text-sm">{matter.attorney}</td>}
                {showAssignees && <td className="text-sm">{matter.adjuster}</td>}
                <td className="font-mono text-sm">{matter.state}</td>
                {showFinancials && (
                  <td className="font-mono text-sm text-right">
                    {formatCurrency(matter.incurredReserve)}
                  </td>
                )}
                {showFinancials && (
                  <td className="font-mono text-sm text-right text-muted-foreground">
                    {formatCurrency(matter.paidToDate)}
                  </td>
                )}
                {showFinancials && (
                  <td className={cn(
                    "font-mono text-sm text-right font-medium",
                    matter.estimatedExposure > 2000000 ? "metric-negative" : "metric-neutral"
                  )}>
                    {formatCurrency(matter.estimatedExposure)}
                  </td>
                )}
                <td className="text-sm text-muted-foreground">{matter.lastActivity}</td>
                <td className="text-right pr-4">
                  <button className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-primary">
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </td>
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
    </div>
  );
}
