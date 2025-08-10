/**
 * Service for handling Page Visibility API events
 * Manages timer behavior when tab becomes active/inactive
 */

interface VisibilityState {
  isVisible: boolean;
  lastVisibilityChange: Date;
  hiddenDuration: number; // milliseconds
}

interface VisibilityListener {
  id: string;
  callback: (state: VisibilityState) => void;
}

export class PageVisibilityService {
  private listeners: VisibilityListener[] = [];
  private state: VisibilityState = {
    isVisible: !document.hidden,
    lastVisibilityChange: new Date(),
    hiddenDuration: 0,
  };
  private hiddenStartTime: Date | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the service
   */
  private initialize(): void {
    if (this.isInitialized) return;

    // Check if Page Visibility API is supported
    if (typeof document.hidden === 'undefined') {
      console.warn('Page Visibility API not supported');
      return;
    }

    // Set initial state
    this.state.isVisible = !document.hidden;
    this.state.lastVisibilityChange = new Date();

    // Add event listener
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // Handle page unload
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

    // Handle focus/blur as fallback
    window.addEventListener('focus', this.handleFocus.bind(this));
    window.addEventListener('blur', this.handleBlur.bind(this));

    this.isInitialized = true;
  }

  /**
   * Handle visibility change events
   */
  private handleVisibilityChange(): void {
    const now = new Date();
    const wasVisible = this.state.isVisible;
    const isVisible = !document.hidden;

    // Calculate hidden duration if becoming visible
    let hiddenDuration = 0;
    if (!wasVisible && isVisible && this.hiddenStartTime) {
      hiddenDuration = now.getTime() - this.hiddenStartTime.getTime();
      this.hiddenStartTime = null;
    } else if (wasVisible && !isVisible) {
      this.hiddenStartTime = now;
    }

    // Update state
    this.state = {
      isVisible,
      lastVisibilityChange: now,
      hiddenDuration,
    };

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Handle page focus (fallback for older browsers)
   */
  private handleFocus(): void {
    if (!this.state.isVisible) {
      this.handleVisibilityChange();
    }
  }

  /**
   * Handle page blur (fallback for older browsers)
   */
  private handleBlur(): void {
    if (this.state.isVisible) {
      this.handleVisibilityChange();
    }
  }

  /**
   * Handle before page unload
   */
  private handleBeforeUnload(): void {
    // Notify listeners that page is being unloaded
    this.notifyListeners({
      type: 'beforeunload',
      timestamp: new Date(),
    });
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(additionalData?: any): void {
    const eventData = {
      ...this.state,
      ...additionalData,
    };

    this.listeners.forEach(listener => {
      try {
        listener.callback(eventData);
      } catch (error) {
        console.error('Error in visibility listener:', error);
      }
    });
  }

  /**
   * Add a visibility change listener
   */
  addListener(callback: (state: VisibilityState) => void): string {
    const id = `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.listeners.push({
      id,
      callback,
    });

    // Immediately call with current state
    callback(this.state);

    return id;
  }

  /**
   * Remove a visibility change listener
   */
  removeListener(id: string): boolean {
    const index = this.listeners.findIndex(listener => listener.id === id);
    if (index > -1) {
      this.listeners.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get current visibility state
   */
  getState(): VisibilityState {
    return { ...this.state };
  }

  /**
   * Check if page is currently visible
   */
  isVisible(): boolean {
    return this.state.isVisible;
  }

  /**
   * Get time since last visibility change
   */
  getTimeSinceLastChange(): number {
    return Date.now() - this.state.lastVisibilityChange.getTime();
  }

  /**
   * Check if API is supported
   */
  isSupported(): boolean {
    return typeof document.hidden !== 'undefined';
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.isInitialized) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
      window.removeEventListener('focus', this.handleFocus);
      window.removeEventListener('blur', this.handleBlur);
    }

    this.listeners = [];
    this.isInitialized = false;
  }
}

/**
 * Timer-specific visibility handler
 * Manages timer behavior based on page visibility
 */
export class TimerVisibilityHandler {
  private visibilityService: PageVisibilityService;
  private listenerId: string | null = null;
  private onVisibilityChange?: (isVisible: boolean, hiddenDuration: number) => void;
  private onPageUnload?: () => void;

  constructor(
    onVisibilityChange?: (isVisible: boolean, hiddenDuration: number) => void,
    onPageUnload?: () => void
  ) {
    this.visibilityService = new PageVisibilityService();
    this.onVisibilityChange = onVisibilityChange;
    this.onPageUnload = onPageUnload;
    this.initialize();
  }

  /**
   * Initialize the handler
   */
  private initialize(): void {
    this.listenerId = this.visibilityService.addListener((state: any) => {
      if (state.type === 'beforeunload') {
        this.handlePageUnload();
      } else {
        this.handleVisibilityChange(state);
      }
    });
  }

  /**
   * Handle visibility changes
   */
  private handleVisibilityChange(state: VisibilityState): void {
    if (this.onVisibilityChange) {
      this.onVisibilityChange(state.isVisible, state.hiddenDuration);
    }
  }

  /**
   * Handle page unload
   */
  private handlePageUnload(): void {
    if (this.onPageUnload) {
      this.onPageUnload();
    }
  }

  /**
   * Get current visibility state
   */
  isVisible(): boolean {
    return this.visibilityService.isVisible();
  }

  /**
   * Check if visibility API is supported
   */
  isSupported(): boolean {
    return this.visibilityService.isSupported();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.listenerId) {
      this.visibilityService.removeListener(this.listenerId);
      this.listenerId = null;
    }
    this.visibilityService.destroy();
  }
}

// Singleton instance for global use
export const pageVisibilityService = new PageVisibilityService();