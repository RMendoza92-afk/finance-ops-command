import { Monitor, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

type Theme = 'executive' | 'terminal';

const themes: { id: Theme; label: string; icon: typeof Monitor }[] = [
  { id: 'executive', label: 'Executive', icon: Monitor },
  { id: 'terminal', label: 'AS/400', icon: Terminal },
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
    // Remove terminal theme class
    root.classList.remove('dark');
    
    // Apply the terminal theme class if selected
    if (theme === 'terminal') {
      root.classList.add('dark');
    }
    // 'executive' is the default :root styles (Bloomberg), no class needed
    
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
