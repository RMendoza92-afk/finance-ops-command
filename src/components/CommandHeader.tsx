import { Shield, Bell, User, Settings, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CommandHeaderProps {
  activeView: 'exec' | 'manager' | 'adjuster';
  onViewChange: (view: 'exec' | 'manager' | 'adjuster') => void;
}

export function CommandHeader({ activeView, onViewChange }: CommandHeaderProps) {
  const viewLabels = {
    exec: 'Executive',
    manager: 'Manager',
    adjuster: 'Adjuster'
  };

  return (
    <header className="command-header sticky top-0 z-50 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                Litigation & Discipline
              </h1>
              <p className="text-xs text-muted-foreground tracking-wide uppercase">
                Command Center 2025
              </p>
            </div>
          </div>
        </div>

        {/* Role Navigation */}
        <nav className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border">
          {(['exec', 'manager', 'adjuster'] as const).map((view) => (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                activeView === view
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {viewLabels[view]}
            </button>
          ))}
        </nav>

        {/* Search and Actions */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search matters..."
              className="w-64 pl-9 bg-muted/50 border-border focus:border-primary"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold flex items-center justify-center text-destructive-foreground">
                3
              </span>
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
            <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
