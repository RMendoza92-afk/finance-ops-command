import { useState, useMemo } from "react";
import { useLitigationData, getFilterOptions } from "@/hooks/useLitigationData";
import { ExecutiveDashboard } from "@/components/ExecutiveDashboard";
import { OpenInventoryDashboard } from "@/components/OpenInventoryDashboard";
import { ExecutiveCommandDashboardWrapper } from "@/components/dashboard/ExecutiveCommandDashboardWrapper";
import { OverspendTracker } from "@/components/OverspendTracker";
import { GlobalFilterPanel, GlobalFilters, defaultGlobalFilters, PainLevelRow } from "@/components/GlobalFilters";
import { LitigationChat } from "@/components/LitigationChat";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AlertSendDialog } from "@/components/AlertSendDialog";
import { SalesTickerBanner } from "@/components/SalesTickerBanner";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import loyaLogo from "@/assets/fli_logo.jpg";
import { 
  getLitigationStage, 
  getExpertType, 
  estimateClaimAge, 
  calculateExecutiveReview 
} from "@/lib/executiveReview";

const Index = () => {
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [filters, setFilters] = useState<GlobalFilters>(() => {
    // Load pain level data from localStorage on init
    const savedPainData = localStorage.getItem('painLevelOverrides');
    if (savedPainData) {
      try {
        const painLevelData = JSON.parse(savedPainData) as PainLevelRow[];
        return { ...defaultGlobalFilters, painLevelData };
      } catch { /* ignore parse errors */ }
    }
    return defaultGlobalFilters;
  });
  const { data: litigationData, loading, error, stats, refetch, dataSource } = useLitigationData();

  // Handle pain level data updates from PainLevelUpload
  const handlePainLevelDataApplied = (data: PainLevelRow[]) => {
    setFilters(prev => ({ ...prev, painLevelData: data }));
  };

  const handleFilterChange = (key: keyof GlobalFilters, value: string | PainLevelRow[]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    // Keep pain level data when resetting other filters
    setFilters(prev => ({ ...defaultGlobalFilters, painLevelData: prev.painLevelData }));
  };

  const activeFilterCount = Object.entries(filters).filter(([key, v]) => 
    key !== 'searchText' && v !== 'all'
  ).length;

  const filterOptions = useMemo(() => {
    const opts = getFilterOptions(litigationData);
    return {
      departments: opts.depts,
      teams: opts.teams,
      adjusters: opts.adjusters
    };
  }, [litigationData]);

  // Helper to check if pain value matches a pain level row
  const painValueMatches = (recordPain: number, painRowValue: string): boolean => {
    if (!painRowValue || painRowValue.trim() === '') return false;
    const cleaned = painRowValue.trim();
    
    // Handle band format like "0-3", "4-6", "7-9"
    if (cleaned.includes('-')) {
      const [minStr, maxStr] = cleaned.split('-');
      const min = parseFloat(minStr);
      const max = parseFloat(maxStr);
      if (!isNaN(min) && !isNaN(max)) {
        return recordPain >= min && recordPain <= max;
      }
    }
    
    // Handle numeric value
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      return recordPain === num;
    }
    
    return false;
  };

  // Apply global filters including pain level data
  const filteredData = useMemo(() => {
    return litigationData.filter((matter, index) => {
      // Pain level data filter - match by index position if we have pain data
      if (filters.painLevelData.length > 0) {
        const painRow = filters.painLevelData[index];
        if (painRow) {
          // Check if record's start/end pain matches the expected values
          const startPainVal = painRow.startPain || painRow.oldStartPain;
          const endPainVal = painRow.endPain || painRow.oldEndPain;
          
          // If pain row has values, verify they match (or at least one matches)
          const hasStartPain = startPainVal && startPainVal.trim() !== '';
          const hasEndPain = endPainVal && endPainVal.trim() !== '';
          
          if (hasStartPain || hasEndPain) {
            const startMatches = !hasStartPain || painValueMatches(matter.startPainLvl, startPainVal);
            const endMatches = !hasEndPain || painValueMatches(matter.endPainLvl, endPainVal);
            
            // Include record if it matches the pain level data
            if (!startMatches || !endMatches) {
              return false;
            }
          }
        }
      }

      // Department filter
      if (filters.department !== 'all' && matter.dept !== filters.department) return false;
      
      // Team filter
      if (filters.team !== 'all' && matter.team !== filters.team) return false;
      
      // Adjuster filter
      if (filters.adjuster !== 'all' && matter.adjusterName !== filters.adjuster) return false;
      
      // Litigation stage filter (based on pain level)
      if (filters.litigationStage !== 'all') {
        const stage = getLitigationStage(matter.endPainLvl);
        if (stage !== filters.litigationStage) return false;
      }
      
      // Pain band filter
      if (filters.painBand !== 'all') {
        const pain = matter.endPainLvl;
        switch (filters.painBand) {
          case 'low': if (pain > 2) return false; break;
          case 'medium': if (pain < 3 || pain > 5) return false; break;
          case 'high': if (pain < 6 || pain > 7) return false; break;
          case 'critical': if (pain < 8) return false; break;
        }
      }
      
      // Expert type filter
      if (filters.expertType !== 'all') {
        const expertType = getExpertType(matter.expCategory);
        if (expertType !== filters.expertType) return false;
      }
      
      // Executive Review filter
      if (filters.executiveReview !== 'all') {
        const claimAge = estimateClaimAge(matter.prefix, matter.transferDate);
        const stage = getLitigationStage(matter.endPainLvl);
        const painEscalation = matter.endPainLvl - matter.startPainLvl;
        
        // Use totalAmount as expense proxy, approximate expert vs reactive spend (using the 29.9% ratio)
        const expertSpend = matter.totalAmount * 0.299;
        const reactiveSpend = matter.totalAmount * 0.701;
        
        const review = calculateExecutiveReview(
          claimAge,
          stage,
          expertSpend,
          reactiveSpend,
          painEscalation,
          matter.endPainLvl,
          matter.expCategory
        );
        
        if (filters.executiveReview === 'any') {
          // "any" means any non-NONE review level
          if (review.level === 'NONE') return false;
        } else if (review.level !== filters.executiveReview) {
          return false;
        }
      }
      
      // Free text search
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        const searchableText = [
          matter.claim,
          matter.uniqueRecord,
          matter.claimant,
          matter.adjusterName,
          matter.coverage
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(search)) return false;
      }
      
      return true;
    });
  }, [filters, litigationData]);


  // Don't block the entire app while litigation data loads;
  // only dashboards that rely on it should treat it as optional.
  const showLitigationLoading = loading;

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-medium">Error loading data</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Executive Header - Mobile Optimized */}
      <header className="command-header px-3 sm:px-6 py-3 sm:py-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-5">
            <img src={loyaLogo} alt="Fred Loya Insurance" className="h-8 sm:h-12 w-auto" />
            <div className="hidden sm:block h-10 w-px bg-border" />
            <div>
              <h1 className="text-sm sm:text-xl font-bold tracking-tight text-foreground">Litigation Command</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {filters.inventoryStatus === 'operations' ? 'Open Inventory' : 
                 filters.inventoryStatus === 'executive' ? 'Executive View' : '2025 EOY Portfolio'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAlertDialogOpen(true)}
              className="gap-2 h-8 sm:h-9"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send Alert</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* NYSE-Style Sales Ticker Banner */}
      <SalesTickerBanner />
      
      <main className="px-3 sm:px-6 py-3 sm:py-6">
        {/* Global Filters - Mobile Collapsible */}
        <GlobalFilterPanel 
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={resetFilters}
          activeFilterCount={activeFilterCount}
          filterOptions={filterOptions}
        />

        {showLitigationLoading && filters.inventoryStatus !== 'executive' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading litigation dataset…
          </div>
        )}

        {/* Content */}
        {filters.inventoryStatus === 'operations' ? (
          <OpenInventoryDashboard filters={filters} />
        ) : filters.inventoryStatus === 'executive' ? (
          <ExecutiveCommandDashboardWrapper />
        ) : (
          <div className="space-y-6">
            <ExecutiveDashboard 
              data={filteredData} 
            />
            <OverspendTracker />
          </div>
        )}
      </main>

      {/* Footer - Mobile Optimized */}
      <footer className="border-t border-border px-3 sm:px-6 py-3 sm:py-4 mt-8 sm:mt-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-muted-foreground text-center sm:text-left">
          <p>© 2025 Fred Loya Insurance</p>
          <p className="hidden sm:block">Data as of current session</p>
        </div>
      </footer>

      {/* AI Chat Assistant */}
      <LitigationChat />

      {/* Global Alert Dialog */}
      <AlertSendDialog
        open={alertDialogOpen}
        onClose={() => setAlertDialogOpen(false)}
        context={{
          actionRequired: 'General Dashboard Alert'
        }}
      />
    </div>
  );
};

export default Index;
