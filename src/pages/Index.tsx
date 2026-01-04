import { useState, useMemo } from "react";
import { CommandHeader } from "@/components/CommandHeader";
import { FilterPanel } from "@/components/FilterPanel";
import { SummaryCards } from "@/components/SummaryCards";
import { DataTable } from "@/components/DataTable";
import { litigationData, LitigationMatter } from "@/data/litigationData";

interface Filters {
  status: string;
  severity: string;
  type: string;
  department: string;
  attorney: string;
  adjuster: string;
  state: string;
}

const defaultFilters: Filters = {
  status: 'all',
  severity: 'all',
  type: 'all',
  department: 'all',
  attorney: 'all',
  adjuster: 'all',
  state: 'all'
};

const Index = () => {
  const [activeView, setActiveView] = useState<'exec' | 'manager' | 'adjuster'>('exec');
  const [filters, setFilters] = useState<Filters>(defaultFilters);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== 'all').length;

  const filteredData = useMemo(() => {
    return litigationData.filter(matter => {
      if (filters.status !== 'all' && matter.status !== filters.status) return false;
      if (filters.severity !== 'all' && matter.severity !== filters.severity) return false;
      if (filters.type !== 'all' && matter.type !== filters.type) return false;
      if (filters.department !== 'all' && matter.department !== filters.department) return false;
      if (filters.attorney !== 'all' && matter.attorney !== filters.attorney) return false;
      if (filters.adjuster !== 'all' && matter.adjuster !== filters.adjuster) return false;
      if (filters.state !== 'all' && matter.state !== filters.state) return false;
      return true;
    });
  }, [filters]);

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
        <SummaryCards data={filteredData} view={activeView} />

        {/* Filters */}
        <FilterPanel 
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={resetFilters}
          activeFilterCount={activeFilterCount}
        />

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filteredData.length}</span> of{' '}
            <span className="font-medium text-foreground">{litigationData.length}</span> matters
          </p>
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date().toLocaleString()}
          </p>
        </div>

        {/* Data Table */}
        <DataTable data={filteredData} view={activeView} />
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 mt-8">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <p>© 2025 Litigation & Discipline Command Center</p>
          <p>Data as of January 4, 2025</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
