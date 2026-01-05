import { useState, useMemo, useEffect } from "react";
import { useLitigationData, getFilterOptions } from "@/hooks/useLitigationData";
import { OverextensionTable } from "@/components/OverextensionTable";
import { ExecutiveDashboard } from "@/components/ExecutiveDashboard";
import { OpenInventoryDashboard } from "@/components/OpenInventoryDashboard";
import { GlobalFilterPanel, GlobalFilters, defaultGlobalFilters, PainLevelRow } from "@/components/GlobalFilters";
import { LitigationChat } from "@/components/LitigationChat";
import { Loader2, AlertTriangle, TrendingUp, LayoutDashboard, Table2, FileStack } from "lucide-react";
import loyaLogo from "@/assets/fli_logo.jpg";
import { 
  getLitigationStage, 
  getExpertType, 
  estimateClaimAge, 
  calculateExecutiveReview 
} from "@/lib/executiveReview";

type TabType = 'executive' | 'management';

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('executive');
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
  const [drilldownClaimId, setDrilldownClaimId] = useState<string | null>(null);
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

  // Handle drilldown from Executive Dashboard
  const handleDrilldown = (claimId: string) => {
    setDrilldownClaimId(claimId);
    setFilters(prev => ({ ...prev, searchText: claimId }));
    setActiveTab('management');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading litigation data...</p>
        </div>
      </div>
    );
  }

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
      {/* Header */}
      <header className="command-header px-4 sm:px-6 py-4 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <img src={loyaLogo} alt="Fred Loya Insurance" className="h-8 sm:h-10 w-auto" />
            <div className="h-6 sm:h-8 w-px bg-border hidden sm:block" />
            <div>
              <h1 className="text-sm sm:text-lg font-bold tracking-tight">Litigation Command Center</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {filters.inventoryStatus === 'open' ? 'Open Inventory' : '2025 Portfolio'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-1 sm:gap-2">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{filteredData.length.toLocaleString()} of {litigationData.length.toLocaleString()} records</span>
              <span className="sm:hidden">{filteredData.length}</span>
              <span className="text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded bg-muted">
                {dataSource === 'database' ? '📊 DB' : '📄 CSV'}
              </span>
            </div>
            <span className="hidden lg:inline">CWP: {stats.cwpCount.toLocaleString()} | CWN: {stats.cwnCount.toLocaleString()}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-3 sm:mt-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('executive')}
            className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'executive'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <LayoutDashboard className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Executive Dashboard</span>
            <span className="sm:hidden">Executive</span>
          </button>
          <button
            onClick={() => setActiveTab('management')}
            className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'management'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Table2 className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Management Data</span>
            <span className="sm:hidden">Data</span>
            <span className="px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs bg-background/20">{filteredData.length}</span>
          </button>
        </div>
      </header>
      
      <main className="px-4 sm:px-6 py-4 sm:py-6">
        {/* Global Filters - Shared across tabs */}
        <GlobalFilterPanel 
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={resetFilters}
          activeFilterCount={activeFilterCount}
          filterOptions={filterOptions}
        />

        {/* Tab Content */}
        {filters.inventoryStatus === 'open' ? (
          <OpenInventoryDashboard filters={filters} />
        ) : activeTab === 'executive' ? (
          <ExecutiveDashboard 
            data={filteredData} 
            onDrilldown={handleDrilldown} 
            onPainLevelDataApplied={handlePainLevelDataApplied}
            painLevelDataActive={filters.painLevelData.length > 0}
            onDataUploaded={refetch}
          />
        ) : (
          <OverextensionTable data={filteredData} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 sm:px-6 py-3 sm:py-4 mt-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] sm:text-xs text-muted-foreground">
          <p>© 2025 Fred Loya Insurance — Litigation Command Center</p>
          <p className="hidden sm:block">All calculations dynamically computed</p>
        </div>
      </footer>

      {/* AI Chat Assistant */}
      <LitigationChat />
    </div>
  );
};

export default Index;
