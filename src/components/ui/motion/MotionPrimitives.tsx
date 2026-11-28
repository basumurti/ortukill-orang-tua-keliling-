import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

type MotionRuntimeType = typeof import('./MotionRuntime');

let cachedMotionRuntime: MotionRuntimeType | null = null;
let motionRuntimePromise: Promise<MotionRuntimeType | null> | null = null;

export function getLoadedMotionRuntime(): MotionRuntimeType | null {
  return cachedMotionRuntime;
}

function loadMotionRuntime(): Promise<MotionRuntimeType | null> {
  if (cachedMotionRuntime) return Promise.resolve(cachedMotionRuntime);
  if (!motionRuntimePromise) {
    motionRuntimePromise = import('./MotionRuntime')
      .then((mod) => {
        cachedMotionRuntime = mod;
        return mod;
      })
      .catch(() => null);
  }
  return motionRuntimePromise;
}

const MotionRuntimeContext = createContext<MotionRuntimeType | null>(null);

export function useMotionRuntime(): MotionRuntimeType | null {
  return useContext(MotionRuntimeContext) ?? cachedMotionRuntime;
}

/**
 * Progressive motion provider:
 * - Zero synchronous motion bundle weight on initial paint (instant render)
 * - Loads MotionRuntime (LazyMotion + domAnimation) on idle unless user prefers reduced motion
 */
export const AppMotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [runtime, setRuntime] = useState<MotionRuntimeType | null>(() => cachedMotionRuntime);

  useEffect(() => {
    if (runtime) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let cancelled = false;
    const schedule = () => {
      void loadMotionRuntime().then((mod) => {
        if (!cancelled && mod) {
          setRuntime(mod);
        }
      });
    };

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === 'function') {
      const idleId = win.requestIdleCallback(schedule, { timeout: 500 });
      return () => {
        cancelled = true;
        win.cancelIdleCallback?.(idleId);
      };
    }

    const timer = window.setTimeout(schedule, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [runtime]);

  if (runtime) {
    const { MotionProviderImpl } = runtime;
    return (
      <MotionRuntimeContext.Provider value={runtime}>
        <MotionProviderImpl>{children}</MotionProviderImpl>
      </MotionRuntimeContext.Provider>
    );
  }

  return <MotionRuntimeContext.Provider value={null}>{children}</MotionRuntimeContext.Provider>;
};

interface AnimatedTabPillProps {
  layoutId: string;
  className?: string;
}

/**
 * Shared layoutId spring indicator for navigation bars and segmented switchers.
 * Renders an immediate CSS pill before the async motion runtime finishes loading.
 */
export const AnimatedTabPill: React.FC<AnimatedTabPillProps> = ({ layoutId, className = '' }) => {
  const runtime = useMotionRuntime();
  if (runtime) {
    const { AnimatedTabPillImpl } = runtime;
    return <AnimatedTabPillImpl layoutId={layoutId} className={className} />;
  }
  return <span aria-hidden="true" className={className} />;
};

interface ViewFadeTransitionProps {
  viewKey: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Non-blocking view transition for tab switches (160ms opacity + 4px settle).
 * Skips entrance animation on initial mount or async motion hydration so there is zero flash.
 */
export const ViewFadeTransition: React.FC<ViewFadeTransitionProps> = ({
  viewKey,
  children,
  className = '',
}) => {
  const runtime = useMotionRuntime();
  const prevKeyRef = useRef<string>(viewKey);
  const shouldAnimateMount = prevKeyRef.current !== viewKey;

  useEffect(() => {
    prevKeyRef.current = viewKey;
  }, [viewKey]);

  if (runtime) {
    const { ViewFadeTransitionImpl } = runtime;
    return (
      <ViewFadeTransitionImpl
        viewKey={viewKey}
        shouldAnimateMount={shouldAnimateMount}
        className={className}
      >
        {children}
      </ViewFadeTransitionImpl>
    );
  }

  return (
    <div key={viewKey} className={className}>
      {children}
    </div>
  );
};

interface AnimatedToastContainerProps {
  toastKey: number | string | null;
  children: React.ReactNode;
  className?: string;
}

/**
 * Smooth entrance and exit choreography for floating status/undo toasts.
 */
export const AnimatedToastContainer: React.FC<AnimatedToastContainerProps> = ({
  toastKey,
  children,
  className = '',
}) => {
  const runtime = useMotionRuntime();
  if (runtime) {
    const { AnimatedToastContainerImpl } = runtime;
    return (
      <AnimatedToastContainerImpl toastKey={toastKey} className={className}>
        {children}
      </AnimatedToastContainerImpl>
    );
  }

  if (toastKey === null) return null;
  return (
    <div key={toastKey} className={className}>
      {children}
    </div>
  );
};
