import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Sparkles, LayoutDashboard, Filter, BarChart3, MessageSquare, FileDown, Bell, Eye } from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  highlight?: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Command Center',
    description: 'This interactive guide will walk you through the key features of your claims and portfolio analytics dashboard. Let\'s get started!',
    icon: <Sparkles className="h-8 w-8" />,
    position: 'center'
  },
  {
    id: 'navigation',
    title: 'Dashboard Views',
    description: 'Switch between different views using the Inventory Status filter: Open Inventory for claims management, Executive Command for portfolio analytics, Classic for detailed reports, and Overspend Tracker for limit monitoring.',
    icon: <LayoutDashboard className="h-8 w-8" />,
    position: 'top-left',
    highlight: '[data-tutorial="inventory-status"]'
  },
  {
    id: 'filters',
    title: 'Global Filters',
    description: 'Use the filter panel to narrow down data by Department, Team, Adjuster, Litigation Stage, Pain Band, and more. The active filter count shows how many filters are applied.',
    icon: <Filter className="h-8 w-8" />,
    position: 'top-left',
    highlight: '[data-tutorial="filters"]'
  },
  {
    id: 'metrics',
    title: 'Key Metrics & KPIs',
    description: 'Summary cards display critical metrics like Total Claims, Reserves, CP1 Compliance, and aging breakdowns. Cards with a gold accent indicate variance items requiring attention.',
    icon: <BarChart3 className="h-8 w-8" />,
    position: 'center'
  },
  {
    id: 'drilldowns',
    title: 'Drill-Down Analysis',
    description: 'Click on any metric card to open a detailed drill-down view. You\'ll see underlying claims, trends, and can take action directly from the drawer.',
    icon: <Eye className="h-8 w-8" />,
    position: 'center'
  },
  {
    id: 'exports',
    title: 'Export Reports',
    description: 'Generate PDF and Excel reports from any section. Look for the download icons in card headers and drill-down panels. Reports are formatted for executive presentation.',
    icon: <FileDown className="h-8 w-8" />,
    position: 'top-right'
  },
  {
    id: 'alerts',
    title: 'Send Alerts',
    description: 'Use the "Send Alert" button in the header to email or SMS critical updates to stakeholders. Alerts can include context from specific claims or variances.',
    icon: <Bell className="h-8 w-8" />,
    position: 'top-right',
    highlight: '[data-tutorial="send-alert"]'
  },
  {
    id: 'ai-chat',
    title: 'AI Assistant',
    description: 'Click the chat bubble in the bottom-right corner to ask Oracle—the AI assistant—questions about your data in natural language. Get instant insights and analysis.',
    icon: <MessageSquare className="h-8 w-8" />,
    position: 'bottom-right'
  }
];

interface TutorialOverlayProps {
  onComplete: () => void;
}

export function TutorialOverlay({ onComplete }: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const step = tutorialSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tutorialSteps.length - 1;
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    localStorage.setItem('tutorialCompleted', 'true');
    setTimeout(onComplete, 300);
  };

  const handleSkip = () => {
    handleComplete();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep]);

  const getPositionClasses = (position: TutorialStep['position']) => {
    switch (position) {
      case 'top-left':
        return 'top-24 left-8';
      case 'top-right':
        return 'top-24 right-8';
      case 'bottom-left':
        return 'bottom-24 left-8';
      case 'bottom-right':
        return 'bottom-24 right-8';
      case 'center':
      default:
        return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] animate-fade-in">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/90 backdrop-blur-sm"
        onClick={handleSkip}
      />
      
      {/* Tutorial Card */}
      <div 
        className={`absolute ${getPositionClasses(step.position)} w-full max-w-md p-6 rounded-xl border border-primary/30 bg-card shadow-2xl animate-scale-in`}
        style={{ 
          boxShadow: '0 0 60px -15px hsl(var(--primary) / 0.3), 0 25px 50px -12px hsl(0 0% 0% / 0.5)'
        }}
      >
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Skip tutorial"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl overflow-hidden bg-muted">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-4 pt-2">
          {tutorialSteps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStep 
                  ? 'w-6 bg-primary' 
                  : idx < currentStep 
                    ? 'w-1.5 bg-primary/50' 
                    : 'w-1.5 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="mb-4 p-3 w-fit rounded-xl bg-primary/10 text-primary">
          {step.icon}
        </div>

        {/* Content */}
        <h3 className="text-xl font-bold text-foreground mb-2">
          {step.title}
        </h3>
        <p className="text-muted-foreground leading-relaxed mb-6">
          {step.description}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {currentStep + 1} of {tutorialSteps.length}
          </div>
          
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            
            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1 min-w-[100px]"
            >
              {isLastStep ? (
                'Get Started'
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Skip hint */}
        {!isLastStep && (
          <p className="text-xs text-muted-foreground/60 text-center mt-4">
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Esc</kbd> to skip • Use arrow keys to navigate
          </p>
        )}
      </div>
    </div>
  );
}

// Hook to manage tutorial state
export function useTutorial() {
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem('tutorialCompleted');
    if (!completed) {
      // Slight delay for initial page render
      const timer = setTimeout(() => setShowTutorial(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const startTutorial = () => setShowTutorial(true);
  const completeTutorial = () => setShowTutorial(false);
  const resetTutorial = () => {
    localStorage.removeItem('tutorialCompleted');
    setShowTutorial(true);
  };

  return { showTutorial, startTutorial, completeTutorial, resetTutorial };
}
