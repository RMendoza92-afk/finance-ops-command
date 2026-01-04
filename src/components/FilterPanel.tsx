import { Filter, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { departments, attorneys, adjusters, states } from "@/data/litigationData";

interface Filters {
  status: string;
  severity: string;
  type: string;
  department: string;
  attorney: string;
  adjuster: string;
  state: string;
}

interface FilterPanelProps {
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: string) => void;
  onReset: () => void;
  activeFilterCount: number;
}

export function FilterPanel({ filters, onFilterChange, onReset, activeFilterCount }: FilterPanelProps) {
  return (
    <div className="filter-panel rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Select value={filters.status} onValueChange={(v) => onFilterChange('status', v)}>
          <SelectTrigger className="bg-muted/50 border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="In Trial">In Trial</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.severity} onValueChange={(v) => onFilterChange('severity', v)}>
          <SelectTrigger className="bg-muted/50 border-border">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.type} onValueChange={(v) => onFilterChange('type', v)}>
          <SelectTrigger className="bg-muted/50 border-border">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Litigation">Litigation</SelectItem>
            <SelectItem value="Discipline">Discipline</SelectItem>
            <SelectItem value="Arbitration">Arbitration</SelectItem>
            <SelectItem value="Mediation">Mediation</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.department} onValueChange={(v) => onFilterChange('department', v)}>
          <SelectTrigger className="bg-muted/50 border-border">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(dept => (
              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.attorney} onValueChange={(v) => onFilterChange('attorney', v)}>
          <SelectTrigger className="bg-muted/50 border-border">
            <SelectValue placeholder="Attorney" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Attorneys</SelectItem>
            {attorneys.map(atty => (
              <SelectItem key={atty} value={atty}>{atty}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.adjuster} onValueChange={(v) => onFilterChange('adjuster', v)}>
          <SelectTrigger className="bg-muted/50 border-border">
            <SelectValue placeholder="Adjuster" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Adjusters</SelectItem>
            {adjusters.map(adj => (
              <SelectItem key={adj} value={adj}>{adj}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.state} onValueChange={(v) => onFilterChange('state', v)}>
          <SelectTrigger className="bg-muted/50 border-border">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All States</SelectItem>
            {states.map(st => (
              <SelectItem key={st} value={st}>{st}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
