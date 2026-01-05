import { useState, useMemo } from "react";
import { useLitigationData, getFilterOptions } from "@/hooks/useLitigationData";
import { OverextensionTable } from "@/components/OverextensionTable";
import { ExecutiveDashboard } from "@/components/ExecutiveDashboard";
import { GlobalFilterPanel, GlobalFilters, defaultGlobalFilters } from "@/components/GlobalFilters";
import { Loader2, AlertTriangle, TrendingUp, LayoutDashboard, Table2 } from "lucide-react";
import loyaLogo from "@/assets/fli_logo.jpg";

// Determine litigation stage based on pain level
function getLitigationStage(painLvl: number): 'Early' | 'Mid' | 'Late' | 'Very Late' {
  if (painLvl <= 2) return 'Early';
  if (painLvl <= 5) return 'Mid';
  if (painLvl <= 7) return 'Late';
  return 'Very Late';
}

// Determine expert type from expense category
function getExpertType(expCategory: string): string {
  if (!expCategory) return 'Other';
  const cat = expCategory.toUpperCase();
  if (cat.includes('MEDICAL') || cat.includes('MED')) return 'Medical';
  if (cat.includes('LEGAL') || cat.includes('ATTORNEY')) return 'Legal';
  if (cat.includes('EXPERT') || cat.includes('CONSULT')) return 'Consultant';
  if (cat.includes('ENGINEER')) return 'Engineering';
  if (cat.includes('ACCOUNT') || cat.includes('ECON')) return 'Economic';
  return 'Other';
}

type TabType = 'executive' | 'management';

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('executive');
  const [filters, setFilters] = useState<GlobalFilters>(defaultGlobalFilters);
  const [drilldownClaimId, setDrilldownClaimId] = useState<string | null>(null);
  const { data: litigationData, loading, error, stats } = useLitigationData();

  const handleFilterChange = (key: keyof GlobalFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(defaultGlobalFilters);
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

  // Apply global filters
  const filteredData = useMemo(() => {
    return litigationData.filter(matter => {
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
      <header className="command-header px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={loyaLogo} alt="Fred Loya Insurance" className="h-10 w-auto" />
            <div className="h-8 w-px bg-border" />
            <div>
              <h1 className="text-lg font-bold tracking-tight">Litigation Discipline Command Center</h1>
              <p className="text-xs text-muted-foreground">2025 Litigation Portfolio • Decision & Discipline System</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span>{filteredData.length.toLocaleString()} of {litigationData.length.toLocaleString()} records</span>
            </div>
            <span>CWP: {stats.cwpCount.toLocaleString()} | CWN: {stats.cwnCount.toLocaleString()}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-4">
          <button
            onClick={() => setActiveTab('executive')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'executive'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Executive Dashboard
          </button>
          <button
            onClick={() => setActiveTab('management')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'management'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Table2 className="h-4 w-4" />
            Management Data
            <span className="px-1.5 py-0.5 rounded text-xs bg-background/20">{filteredData.length}</span>
          </button>
        </div>
      </header>
      
      <main className="px-6 py-6">
        {/* Global Filters - Shared across tabs */}
        <GlobalFilterPanel 
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={resetFilters}
          activeFilterCount={activeFilterCount}
          filterOptions={filterOptions}
        />

        {/* Tab Content */}
        {activeTab === 'executive' ? (
          <ExecutiveDashboard data={filteredData} onDrilldown={handleDrilldown} />
        ) : (
          <OverextensionTable data={filteredData} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 mt-8">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <p>© 2025 Fred Loya Insurance — Litigation Discipline Command Center</p>
          <p>All calculations dynamically computed • No static values • Signal → Inspection workflow</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
