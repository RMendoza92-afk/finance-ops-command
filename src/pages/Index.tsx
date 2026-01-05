import { useState, useMemo } from "react";
import { useLitigationData, getFilterOptions, LitigationMatter } from "@/hooks/useLitigationData";
import { OverextensionTable } from "@/components/OverextensionTable";
import { GlobalFilterPanel, GlobalFilters, defaultGlobalFilters } from "@/components/GlobalFilters";
import { Loader2, AlertTriangle, TrendingUp } from "lucide-react";
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

const Index = () => {
  const [filters, setFilters] = useState<GlobalFilters>(defaultGlobalFilters);
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
      <header className="command-header px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={loyaLogo} alt="Fred Loya Insurance" className="h-10 w-auto" />
            <div className="h-8 w-px bg-border" />
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h1 className="text-xl font-bold tracking-tight">Overextension & Reactive Spend</h1>
            </div>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-destructive/20 text-destructive border border-destructive/30">
              DISCIPLINE TOOL
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span>{filteredData.length.toLocaleString()} of {litigationData.length.toLocaleString()} records</span>
            </div>
            <span>CWP: {stats.cwpCount.toLocaleString()} | CWN: {stats.cwnCount.toLocaleString()}</span>
          </div>
        </div>
        <p className="text-muted-foreground text-sm mt-2">
          Identify claims with disproportionate reactive posture spend vs. expert investment. 
          <span className="text-destructive ml-1">RED = ≥3x ratio requires immediate review.</span>
        </p>
      </header>
      
      <main className="px-6 py-6">
        {/* Global Filters */}
        <GlobalFilterPanel 
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={resetFilters}
          activeFilterCount={activeFilterCount}
          filterOptions={filterOptions}
        />

        {/* Main Overextension Table */}
        <OverextensionTable data={filteredData} />
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 mt-8">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <p>© 2025 Litigation & Discipline Command Center - RRM Data</p>
          <p>All calculations dynamically computed • No static values</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
