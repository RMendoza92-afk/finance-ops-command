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
  onFilterChange
}: GlobalFilterPanelProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
      <div className="flex items-center justify-center">
        {/* Inventory Status Toggle */}
        <div className="flex rounded-lg overflow-hidden border border-border">
          <button
            onClick={() => onFilterChange('inventoryStatus', 'closed')}
            className={`px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base font-medium transition-colors ${
              filters.inventoryStatus === 'closed'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Closed Inventory
          </button>
          <button
            onClick={() => onFilterChange('inventoryStatus', 'open')}
            className={`px-4 sm:px-6 py-2 sm:py-2.5 text-sm sm:text-base font-medium transition-colors ${
              filters.inventoryStatus === 'open'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Open Inventory
          </button>
        </div>
      </div>
    </div>
  );
}
