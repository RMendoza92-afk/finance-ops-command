import { Monitor, Terminal, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

type Theme = 'executive' | 'terminal' | 'bloomberg';

const themes: { id: Theme; label: string; icon: typeof Monitor }[] = [
  { id: 'executive', label: 'Executive', icon: Monitor },
  { id: 'terminal', label: 'AS/400', icon: Terminal },
  { id: 'bloomberg', label: 'Bloomberg', icon: TrendingUp },
];

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme') as Theme;
      if (saved && themes.some(t => t.id === saved)) {
        return saved;
      }
    }
    return 'executive';
  });

  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes
    root.classList.remove('dark', 'bloomberg');
    
    // Apply the selected theme class
    if (theme === 'terminal') {
      root.classList.add('dark');
    } else if (theme === 'bloomberg') {
      root.classList.add('bloomberg');
    }
    // 'executive' is the default :root styles, no class needed
    
    localStorage.setItem('theme', theme);
  }, [theme]);

  const cycleTheme = () => {
    const currentIndex = themes.findIndex(t => t.id === theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex].id);
  };

  const currentTheme = themes.find(t => t.id === theme) || themes[0];
  const Icon = currentTheme.icon;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={cycleTheme}
      className="h-8 gap-2 text-xs"
      title={`Current: ${currentTheme.label}. Click to switch themes.`}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{currentTheme.label}</span>
    </Button>
  );
}
