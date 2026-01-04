import { Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Filters {
  cwpCwn: string;
  class: string;
  dept: string;
  team: string;
  adjuster: string;
  expCategory: string;
  painLevel: string;
}

interface FilterOptions {
  classes: string[];
  depts: string[];
  teams: string[];
  adjusters: string[];
  expCategories: string[];
}

interface FilterPanelProps {
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: string) => void;
  onReset: () => void;
  activeFilterCount: number;
  filterOptions: FilterOptions;
}

export function FilterPanel({ filters, onFilterChange, onReset, activeFilterCount, filterOptions }: FilterPanelProps) {
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
        <Select value={filters.cwpCwn} onValueChange={(v) => onFilterChange('cwpCwn', v)}>
          <SelectTrigger className="bg-muted/50 border-border">
            <SelectValue placeholder="CWP/CWN" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="CWP">CWP (Closed)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.class} onValueChange={(v) => onFilterChange('class', v)}>
          <SelectTrigger className="bg-muted/50 border-border">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Classes</SelectItem>
            {filterOptions.classes.map(cls => (
              <SelectItem key={cls} value={cls}>{cls}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.dept} onValueChange={(v) => onFilterChange('dept', v)}>
          <SelectTrigger className="bg-muted/50 border-border">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Departments</SelectItem>
            {filterOptions.depts.map(dept => (
              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.team} onValueChange={(v) => onFilterChange('team', v)}>
          <SelectTrigger className="bg-muted/50 border-border">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border max-h-60">
            <SelectItem value="all">All Teams</SelectItem>
            {filterOptions.teams.map(team => (
              <SelectItem key={team} value={team}>{team}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.adjuster} onValueChange={(v) => onFilterChange('adjuster', v)}>
          <SelectTrigger className="bg-muted/50 border-border">
            <SelectValue placeholder="Adjuster" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border max-h-60">
            <SelectItem value="all">All Adjusters</SelectItem>
            {filterOptions.adjusters.map(adj => (
              <SelectItem key={adj} value={adj}>{adj}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.expCategory} onValueChange={(v) => onFilterChange('expCategory', v)}>
          <SelectTrigger className="bg-muted/50 border-border">
            <SelectValue placeholder="Exp Category" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Categories</SelectItem>
            {filterOptions.expCategories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.painLevel} onValueChange={(v) => onFilterChange('painLevel', v)}>
          <SelectTrigger className="bg-muted/50 border-border">
            <SelectValue placeholder="Pain Level" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Pain Levels</SelectItem>
            <SelectItem value="low">Low (0-2)</SelectItem>
            <SelectItem value="medium">Medium (3-5)</SelectItem>
            <SelectItem value="high">High (6-7)</SelectItem>
            <SelectItem value="critical">Critical (8-10)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}