import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RBCUnlockDialog } from '@/components/RBCUnlockDialog';

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

// Check if RBC access is unlocked (via session storage from password gate)
const isRBCUnlocked = () => {
  return sessionStorage.getItem('rbc_exec_access') === 'true';
};

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
  const [showRBCButton, setShowRBCButton] = useState(isRBCUnlocked());
  const [unlockOpen, setUnlockOpen] = useState(false);

  // Secret keyboard shortcut: Ctrl+Shift+R to show RBC tab and navigate to it
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault();
        setShowRBCButton(true);
        onFilterChange('inventoryStatus', 'rbc');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onFilterChange]);

  // Re-check unlock status when component mounts or filters change
  useEffect(() => {
    if (isRBCUnlocked()) {
      setShowRBCButton(true);
    }
  }, [filters.inventoryStatus]);

  return (
    <div className="bg-card border border-border rounded-xl p-2 sm:p-4 mb-3 sm:mb-6">
      <div className="flex items-center justify-center gap-2">
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
          {/* RBC tab only visible if unlocked via password or keyboard shortcut */}
          {showRBCButton && (
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
          )}
        </div>

        {!showRBCButton && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setUnlockOpen(true)}
            aria-label="Unlock RBC tab"
          >
            <Lock className="h-4 w-4" />
          </Button>
        )}

        <RBCUnlockDialog
          open={unlockOpen}
          onOpenChange={setUnlockOpen}
          onUnlocked={() => {
            setShowRBCButton(true);
            onFilterChange('inventoryStatus', 'rbc');
          }}
        />
      </div>
    </div>
  );
}
