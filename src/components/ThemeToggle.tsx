import { Monitor, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [isTerminal, setIsTerminal] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'terminal';
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isTerminal) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', isTerminal ? 'terminal' : 'loya');
  }, [isTerminal]);

  const toggleTheme = () => {
    setIsTerminal(prev => !prev);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className="h-8 gap-2 text-xs"
      title={isTerminal ? 'Switch to Loya branding' : 'Switch to AS/400 terminal'}
    >
      {isTerminal ? (
        <>
          <Monitor className="h-4 w-4" />
          <span className="hidden sm:inline">Loya</span>
        </>
      ) : (
        <>
          <Terminal className="h-4 w-4" />
          <span className="hidden sm:inline">AS/400</span>
        </>
      )}
    </Button>
  );
}
