export interface PainLevelRow {
  oldStartPain: string;
  oldEndPain: string;
  startPain: string;
  endPain: string;
}

export interface GlobalFilters {
  inventoryStatus: 'eoy' | 'operations' | 'executive';
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
  inventoryStatus: 'operations',
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
  onFilterChange
}: GlobalFilterPanelProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
      <div className="flex items-center justify-center">
        {/* View Toggle */}
        <div className="flex rounded-lg overflow-hidden border border-border">
          <button
            onClick={() => onFilterChange('inventoryStatus', 'eoy')}
            className={`px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base font-medium transition-colors ${
              filters.inventoryStatus === 'eoy'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            2025 EOY
          </button>
          <button
            onClick={() => onFilterChange('inventoryStatus', 'operations')}
            className={`px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base font-medium transition-colors ${
              filters.inventoryStatus === 'operations'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Operations
          </button>
          <button
            onClick={() => onFilterChange('inventoryStatus', 'executive')}
            className={`px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base font-medium transition-colors ${
              filters.inventoryStatus === 'executive'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Executive
          </button>
        </div>
      </div>
    </div>
  );
}
