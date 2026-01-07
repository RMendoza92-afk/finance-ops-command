import React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, Sparkles, Calculator } from "lucide-react";

export type DashboardVersion = 'v1' | 'v2' | 'v3' | 'v4';

interface DashboardLayoutToggleProps {
  version: DashboardVersion;
  onVersionChange: (version: DashboardVersion) => void;
}

export function DashboardLayoutToggle({ version, onVersionChange }: DashboardLayoutToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground uppercase tracking-wider hidden sm:inline">Layout:</span>
      <ToggleGroup 
        type="single" 
        value={version} 
        onValueChange={(val) => val && onVersionChange(val as DashboardVersion)}
        className="bg-muted/50 rounded-lg p-0.5"
      >
        <ToggleGroupItem 
          value="v1" 
          aria-label="Standard view" 
          className="text-xs px-3 py-1.5 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md"
        >
          Standard
        </ToggleGroupItem>
        <ToggleGroupItem 
          value="v2" 
          aria-label="Simple view" 
          className="text-xs px-3 py-1.5 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md flex items-center gap-1"
        >
          <LayoutGrid className="h-3 w-3" />
          Simple
        </ToggleGroupItem>
        <ToggleGroupItem 
          value="v3" 
          aria-label="Executive view" 
          className="text-xs px-3 py-1.5 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md flex items-center gap-1"
        >
          <Sparkles className="h-3 w-3" />
          Executive
        </ToggleGroupItem>
        <ToggleGroupItem 
          value="v4" 
          aria-label="Loss Development view" 
          className="text-xs px-3 py-1.5 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md flex items-center gap-1"
        >
          <Calculator className="h-3 w-3" />
          Loss Dev
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
