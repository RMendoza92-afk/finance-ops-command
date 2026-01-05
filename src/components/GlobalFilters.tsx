import { Search, X, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface GlobalFilters {
  inventoryStatus: 'closed' | 'open';
  department: string;
  team: string;
  adjuster: string;
  litigationStage: string;
  painBand: string;
  expertType: string;
  executiveReview: string;
  searchText: string;
}

export const defaultGlobalFilters: GlobalFilters = {
  inventoryStatus: 'closed',
  department: 'all',
  team: 'all',
  adjuster: 'all',
  litigationStage: 'all',
  painBand: 'all',
  expertType: 'all',
  executiveReview: 'all',
  searchText: ''
};

interface FilterOptions {
  departments: string[];
  teams: string[];
  adjusters: string[];
}

interface GlobalFilterPanelProps {
  filters: GlobalFilters;
  onFilterChange: (key: keyof GlobalFilters, value: string) => void;
  onReset: () => void;
  activeFilterCount: number;
  filterOptions: FilterOptions;
}

export function GlobalFilterPanel({ 
  filters, 
  onFilterChange, 
  onReset, 
  activeFilterCount,
  filterOptions 
}: GlobalFilterPanelProps) {
  const hasFilters = activeFilterCount > 0 || filters.searchText.length > 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Inventory Status Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button
              onClick={() => onFilterChange('inventoryStatus', 'closed')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                filters.inventoryStatus === 'closed'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Closed Inventory
            </button>
            <button
              onClick={() => onFilterChange('inventoryStatus', 'open')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                filters.inventoryStatus === 'open'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Open Inventory
            </button>
          </div>
          
          <div className="h-6 w-px bg-border" />
          
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
              {activeFilterCount} active
            </span>
          )}
        </div>
        {hasFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
          >
            <RotateCcw className="h-3 w-3" />
            Reset All
          </button>
        )}
      </div>

      <div className="grid grid-cols-7 gap-3">
        {/* Search */}
        <div className="col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search claim, exposure, adjuster..."
            value={filters.searchText}
            onChange={(e) => onFilterChange('searchText', e.target.value)}
            className="pl-9 bg-muted border-border text-sm"
          />
          {filters.searchText && (
            <button
              onClick={() => onFilterChange('searchText', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Department */}
        <Select value={filters.department} onValueChange={(v) => onFilterChange('department', v)}>
          <SelectTrigger className="bg-muted border-border text-sm">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {filterOptions.departments.map(dept => (
              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Team */}
        <Select value={filters.team} onValueChange={(v) => onFilterChange('team', v)}>
          <SelectTrigger className="bg-muted border-border text-sm">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {filterOptions.teams.map(team => (
              <SelectItem key={team} value={team}>{team}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Adjuster */}
        <Select value={filters.adjuster} onValueChange={(v) => onFilterChange('adjuster', v)}>
          <SelectTrigger className="bg-muted border-border text-sm">
            <SelectValue placeholder="Adjuster" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Adjusters</SelectItem>
            {filterOptions.adjusters.map(adj => (
              <SelectItem key={adj} value={adj}>{adj}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Litigation Stage */}
        <Select value={filters.litigationStage} onValueChange={(v) => onFilterChange('litigationStage', v)}>
          <SelectTrigger className="bg-muted border-border text-sm">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="Early">Early</SelectItem>
            <SelectItem value="Mid">Mid</SelectItem>
            <SelectItem value="Late">Late</SelectItem>
            <SelectItem value="Very Late">Very Late</SelectItem>
          </SelectContent>
        </Select>

        {/* Pain Band */}
        <Select value={filters.painBand} onValueChange={(v) => onFilterChange('painBand', v)}>
          <SelectTrigger className="bg-muted border-border text-sm">
            <SelectValue placeholder="Pain Band" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pain Bands</SelectItem>
            <SelectItem value="low">Low (1-2)</SelectItem>
            <SelectItem value="medium">Medium (3-5)</SelectItem>
            <SelectItem value="high">High (6-7)</SelectItem>
            <SelectItem value="critical">Critical (8-10)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Expert Type & Executive Review row */}
      <div className="mt-3 flex gap-3">
        <Select value={filters.expertType} onValueChange={(v) => onFilterChange('expertType', v)}>
          <SelectTrigger className="w-48 bg-muted border-border text-sm">
            <SelectValue placeholder="Expert Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Expert Types</SelectItem>
            <SelectItem value="Medical">Medical</SelectItem>
            <SelectItem value="Legal">Legal</SelectItem>
            <SelectItem value="Consultant">Consultant</SelectItem>
            <SelectItem value="Engineering">Engineering</SelectItem>
            <SelectItem value="Economic">Economic</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.executiveReview} onValueChange={(v) => onFilterChange('executiveReview', v)}>
          <SelectTrigger className="w-56 bg-muted border-border text-sm">
            <SelectValue placeholder="Executive Review" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Files</SelectItem>
            <SelectItem value="any">⚠️ Any Review Required</SelectItem>
            <SelectItem value="CRITICAL">🔴 Critical</SelectItem>
            <SelectItem value="REQUIRED">🟠 Required</SelectItem>
            <SelectItem value="WATCH">🟡 Watch</SelectItem>
            <SelectItem value="NONE">✅ Normal</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
