import React, { ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResponsiveLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
  detail: ReactNode;
  isDetailOpen: boolean;
  onDetailClose?: () => void;
  className?: string;
}

// Custom hook to detect screen size breakpoints
function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const checkBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setBreakpoint('mobile');
      } else if (width < 1024) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('desktop');
      }
    };

    checkBreakpoint();
    window.addEventListener('resize', checkBreakpoint);
    return () => window.removeEventListener('resize', checkBreakpoint);
  }, []);

  return breakpoint;
}

export function ResponsiveLayout({
  sidebar,
  main,
  detail,
  isDetailOpen,
  onDetailClose,
  className,
}: ResponsiveLayoutProps) {
  const breakpoint = useBreakpoint();

  // Mobile Layout (< 768px)
  if (breakpoint === 'mobile') {
    return (
      <div className={cn("h-screen flex bg-background-page", className)} data-testid="responsive-layout-mobile">
        {!isDetailOpen ? (
          // Show sidebar + main on mobile when detail is closed
          <>
            {sidebar}
            <div className="flex-1 flex flex-col min-w-0 h-full">
              <div className="flex-1 overflow-y-auto">
                {main}
              </div>
            </div>
          </>
        ) : (
          // Show detail pane as full-screen overlay on mobile
          <div className="flex-1 flex flex-col relative h-full">
            <div className="absolute inset-0 bg-surface z-50 flex flex-col">
              {/* Close button for mobile detail view */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold">Task Details</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDetailClose}
                  className="h-8 w-8"
                  data-testid="mobile-detail-close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {detail}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Tablet Layout (768px - 1024px)
  if (breakpoint === 'tablet') {
    return (
      <div className={cn("h-screen flex bg-background-page", className)} data-testid="responsive-layout-tablet">
        {/* Sidebar - Always visible on tablet */}
        {sidebar}
        
        {/* Main Content with independent scroll */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <div className="flex-1 overflow-y-auto">
            {main}
          </div>
        </div>
        
        {/* Detail Pane - Overlay on tablet */}
        {isDetailOpen && (
          <div className="absolute inset-0 bg-black/20 z-40 flex justify-end">
            <div className="w-96 bg-surface border-l border-border shadow-xl h-full flex flex-col">
              {/* Close button for tablet detail view */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold">Task Details</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDetailClose}
                  className="h-8 w-8"
                  data-testid="tablet-detail-close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {detail}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop Layout (>= 1024px) - Three pane system
  return (
    <div className={cn("h-screen flex bg-background-page", className)} data-testid="responsive-layout-desktop">
      {/* Sidebar - Always visible on desktop */}
      {sidebar}
      
      {/* Main Content - Flexible width with independent scroll */}
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300 min-w-0 h-full",
        isDetailOpen ? "mr-0" : "mr-0"
      )}>
        <div className="flex-1 overflow-y-auto">
          {main}
        </div>
      </div>
      
      {/* Detail Pane - Collapsible on desktop with increased width and independent scroll */}
      <div className={cn(
        "transition-all duration-300 ease-in-out border-l border-border bg-surface h-full",
        isDetailOpen 
          ? "w-[480px] opacity-100 translate-x-0" 
          : "w-0 opacity-0 translate-x-full overflow-hidden"
      )}>
        {isDetailOpen && (
          <div className="w-[480px] h-full overflow-y-auto">
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}