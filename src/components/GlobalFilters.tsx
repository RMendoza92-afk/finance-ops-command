import { useState } from "react";
import { Search, X, RotateCcw, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface PainLevelRow {
  oldStartPain: string;
  oldEndPain: string;
  startPain: string;
  endPain: string;
}

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
  painLevelData: PainLevelRow[];
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
  searchText: '',
  painLevelData: []
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
  const [isExpanded, setIsExpanded] = useState(false);
  const hasFilters = activeFilterCount > 0 || filters.searchText.length > 0;
  const isOpenInventory = filters.inventoryStatus === 'open';

  return (
    <div className="bg-card border border-border rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
      {/* Header Row - Always Visible */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Inventory Status Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button
              onClick={() => onFilterChange('inventoryStatus', 'closed')}
              className={`px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors ${
                filters.inventoryStatus === 'closed'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Closed
            </button>
            <button
              onClick={() => onFilterChange('inventoryStatus', 'open')}
              className={`px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors ${
                filters.inventoryStatus === 'open'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Open
            </button>
          </div>
          
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
          
          {/* Mobile Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="sm:hidden h-8 px-2"
          >
            <Filter className="h-4 w-4 mr-1" />
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Search - Always Visible */}
      <div className="mt-3 relative">
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

      {/* Expandable Filters - Desktop always visible, Mobile collapsible */}
      <div className={`mt-3 ${isExpanded ? 'block' : 'hidden sm:block'}`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {/* Department */}
          <Select value={filters.department} onValueChange={(v) => onFilterChange('department', v)}>
            <SelectTrigger className="bg-muted border-border text-xs sm:text-sm h-9">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              <SelectItem value="all">All Depts</SelectItem>
              {filterOptions.departments.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Team */}
          <Select value={filters.team} onValueChange={(v) => onFilterChange('team', v)}>
            <SelectTrigger className="bg-muted border-border text-xs sm:text-sm h-9">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              <SelectItem value="all">All Teams</SelectItem>
              {filterOptions.teams.map(team => (
                <SelectItem key={team} value={team}>{team}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Adjuster */}
          <Select value={filters.adjuster} onValueChange={(v) => onFilterChange('adjuster', v)}>
            <SelectTrigger className="bg-muted border-border text-xs sm:text-sm h-9">
              <SelectValue placeholder="Adjuster" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              <SelectItem value="all">All Adjusters</SelectItem>
              {filterOptions.adjusters.map(adj => (
                <SelectItem key={adj} value={adj}>{adj}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Litigation Stage */}
          <Select 
            value={filters.litigationStage} 
            onValueChange={(v) => onFilterChange('litigationStage', v)}
            disabled={isOpenInventory}
          >
            <SelectTrigger className={`bg-muted border-border text-xs sm:text-sm h-9 ${isOpenInventory ? 'opacity-50' : ''}`}>
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="Early">Early</SelectItem>
              <SelectItem value="Mid">Mid</SelectItem>
              <SelectItem value="Late">Late</SelectItem>
              <SelectItem value="Very Late">Very Late</SelectItem>
            </SelectContent>
          </Select>

          {/* Pain Band */}
          <Select 
            value={filters.painBand} 
            onValueChange={(v) => onFilterChange('painBand', v)}
            disabled={isOpenInventory}
          >
            <SelectTrigger className={`bg-muted border-border text-xs sm:text-sm h-9 ${isOpenInventory ? 'opacity-50' : ''}`}>
              <SelectValue placeholder="Pain" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              <SelectItem value="all">All Pain</SelectItem>
              <SelectItem value="low">Low (1-2)</SelectItem>
              <SelectItem value="medium">Med (3-5)</SelectItem>
              <SelectItem value="high">High (6-7)</SelectItem>
              <SelectItem value="critical">Critical (8+)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Expert Type & Executive Review row */}
        <div className="mt-2 sm:mt-3 grid grid-cols-2 gap-2 sm:gap-3">
          <Select 
            value={filters.expertType} 
            onValueChange={(v) => onFilterChange('expertType', v)}
            disabled={isOpenInventory}
          >
            <SelectTrigger className={`bg-muted border-border text-xs sm:text-sm h-9 ${isOpenInventory ? 'opacity-50' : ''}`}>
              <SelectValue placeholder="Expert Type" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              <SelectItem value="all">All Experts</SelectItem>
              <SelectItem value="Medical">Medical</SelectItem>
              <SelectItem value="Legal">Legal</SelectItem>
              <SelectItem value="Consultant">Consultant</SelectItem>
              <SelectItem value="Engineering">Engineering</SelectItem>
              <SelectItem value="Economic">Economic</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={filters.executiveReview} 
            onValueChange={(v) => onFilterChange('executiveReview', v)}
            disabled={isOpenInventory}
          >
            <SelectTrigger className={`bg-muted border-border text-xs sm:text-sm h-9 ${isOpenInventory ? 'opacity-50' : ''}`}>
              <SelectValue placeholder="Review" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              <SelectItem value="all">All Files</SelectItem>
              <SelectItem value="any">⚠️ Any Review</SelectItem>
              <SelectItem value="CRITICAL">🔴 Critical</SelectItem>
              <SelectItem value="REQUIRED">🟠 Required</SelectItem>
              <SelectItem value="WATCH">🟡 Watch</SelectItem>
              <SelectItem value="NONE">✅ Normal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
