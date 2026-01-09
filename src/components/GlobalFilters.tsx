export interface PainLevelRow {
  oldStartPain: string;
  oldEndPain: string;
  startPain: string;
  endPain: string;
}

export interface GlobalFilters {
  inventoryStatus: 'eoy' | 'operations' | 'executive' | 'rbc';
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
    <div className="bg-card border border-border rounded-xl p-2 sm:p-4 mb-3 sm:mb-6">
      <div className="flex items-center justify-center">
        {/* View Toggle - Mobile Responsive */}
        <div className="flex flex-wrap justify-center gap-1 sm:gap-0 sm:rounded-lg sm:overflow-hidden sm:border sm:border-border w-full sm:w-auto">
          <button
            onClick={() => onFilterChange('inventoryStatus', 'eoy')}
            className={`flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-base font-medium transition-colors rounded-md sm:rounded-none ${
              filters.inventoryStatus === 'eoy'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            2025 EOY
          </button>
          <button
            onClick={() => onFilterChange('inventoryStatus', 'operations')}
            className={`flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-base font-medium transition-colors rounded-md sm:rounded-none ${
              filters.inventoryStatus === 'operations'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Operations
          </button>
          <button
            onClick={() => onFilterChange('inventoryStatus', 'executive')}
            className={`flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-base font-medium transition-colors rounded-md sm:rounded-none ${
              filters.inventoryStatus === 'executive'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Executive
          </button>
          <button
            onClick={() => onFilterChange('inventoryStatus', 'rbc')}
            className={`flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-base font-medium transition-colors rounded-md sm:rounded-none ${
              filters.inventoryStatus === 'rbc'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            RBC
          </button>
        </div>
      </div>
    </div>
  );
}
