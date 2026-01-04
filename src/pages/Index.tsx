import { useState, useMemo } from "react";
import { CommandHeader } from "@/components/CommandHeader";
import { FilterPanel } from "@/components/FilterPanel";
import { SummaryCards } from "@/components/SummaryCards";
import { DataTable } from "@/components/DataTable";
import { ExpertMatchingDashboard } from "@/components/ExpertMatchingDashboard";
import { LitigationDisciplineDashboard } from "@/components/LitigationDisciplineDashboard";
import { useLitigationData, getFilterOptions } from "@/hooks/useLitigationData";
import { Loader2 } from "lucide-react";

interface Filters {
  cwpCwn: string;
  class: string;
  dept: string;
  team: string;
  adjuster: string;
  expCategory: string;
  painLevel: string;
}

const defaultFilters: Filters = {
  cwpCwn: 'all',
  class: 'all',
  dept: 'all',
  team: 'all',
  adjuster: 'all',
  expCategory: 'all',
  painLevel: 'all'
};

const Index = () => {
  const [activeView, setActiveView] = useState<'exec' | 'manager' | 'adjuster'>('exec');
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  
  const { data: litigationData, loading, error, stats } = useLitigationData();

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== 'all').length;

  const filterOptions = useMemo(() => getFilterOptions(litigationData), [litigationData]);

  const filteredData = useMemo(() => {
    return litigationData.filter(matter => {
      if (filters.cwpCwn !== 'all' && matter.cwpCwn !== filters.cwpCwn) return false;
      if (filters.class !== 'all' && matter.class !== filters.class) return false;
      if (filters.dept !== 'all' && matter.dept !== filters.dept) return false;
      if (filters.team !== 'all' && matter.team !== filters.team) return false;
      if (filters.adjuster !== 'all' && matter.adjusterName !== filters.adjuster) return false;
      if (filters.expCategory !== 'all' && matter.expCategory !== filters.expCategory) return false;
      
      // Pain level filter
      if (filters.painLevel !== 'all') {
        const pain = matter.endPainLvl;
        switch (filters.painLevel) {
          case 'low': if (pain > 2) return false; break;
          case 'medium': if (pain < 3 || pain > 5) return false; break;
          case 'high': if (pain < 6 || pain > 7) return false; break;
          case 'critical': if (pain < 8) return false; break;
        }
      }
      
      return true;
    });
  }, [filters, litigationData]);

  // Get view-specific title
  const viewTitles = {
    exec: 'Executive Overview',
    manager: 'Case Management',
    adjuster: 'My Assignments'
  };

  const viewDescriptions = {
    exec: 'High-level financial exposure and critical matters requiring executive attention',
    manager: 'Complete matter oversight with team assignments and workflow status',
    adjuster: 'Your assigned cases and pending actions'
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
      <CommandHeader activeView={activeView} onViewChange={setActiveView} />
      
      <main className="px-6 py-6">
        {/* View Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-1">{viewTitles[activeView]}</h2>
          <p className="text-muted-foreground">{viewDescriptions[activeView]}</p>
        </div>

        {/* Summary KPIs */}
        <SummaryCards data={filteredData} view={activeView} stats={stats} />

        {/* Expert Matching Dashboard for Manager View */}
        {activeView === 'manager' && (
          <ExpertMatchingDashboard data={filteredData} />
        )}

        {/* Litigation Discipline Dashboard for Exec View */}
        {activeView === 'exec' && (
          <LitigationDisciplineDashboard data={filteredData} stats={stats} />
        )}

        {/* Filters */}
        <FilterPanel 
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={resetFilters}
          activeFilterCount={activeFilterCount}
          filterOptions={filterOptions}
        />

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filteredData.length.toLocaleString()}</span> of{' '}
            <span className="font-medium text-foreground">{litigationData.length.toLocaleString()}</span> records
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>CWP: {stats.cwpCount.toLocaleString()}</span>
            <span>Last updated: {new Date().toLocaleString()}</span>
          </div>
        </div>

        {/* Data Table */}
        <DataTable data={filteredData} view={activeView} />
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 mt-8">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <p>© 2025 Litigation & Discipline Command Center - RRM Data</p>
          <p>Data as of January 4, 2025</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;