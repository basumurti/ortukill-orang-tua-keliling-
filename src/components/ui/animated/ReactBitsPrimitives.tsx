import React, { useEffect, useRef, useState } from 'react';
import { useMotionRuntime } from '../motion/MotionPrimitives';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  return reduced;
}

interface SmartCountUpProps {
  value: number;
  formatter?: (val: number) => string;
  className?: string;
  /** Disable animation explicitly (e.g. during background sync or high-frequency live checkout totals) */
  disableAnimation?: boolean;
  durationMs?: number;
}

/**
 * React Bits inspired numeric counter tuned for operational POS reliability:
 * - Zero dependency on heavy animation bundles
 * - Never replays on identical re-renders or background synchronization updates
 * - Respects prefers-reduced-motion and off-screen visibility
 * - Preserves tabular-nums alignment with zero layout shift
 */
export const SmartCountUp: React.FC<SmartCountUpProps> = ({
  value,
  formatter = (v) => String(Math.round(v)),
  className = '',
  disableAnimation = false,
  durationMs = 240,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const safeTarget = Number.isFinite(value) ? value : 0;
  const [displayValue, setDisplayValue] = useState<number>(safeTarget);
  const lastCommittedRef = useRef<number>(safeTarget);
  const hasAnimatedInitialRef = useRef<boolean>(false);
  const hostRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (disableAnimation || prefersReducedMotion) {
      lastCommittedRef.current = safeTarget;
      setDisplayValue(safeTarget);
      return;
    }

    const from = lastCommittedRef.current;
    if (from === safeTarget) {
      setDisplayValue(safeTarget);
      return;
    }

    const isVisible =
      typeof document === 'undefined' ||
      (document.visibilityState === 'visible' &&
        (!hostRef.current || hostRef.current.offsetParent !== null));

    if (!isVisible) {
      lastCommittedRef.current = safeTarget;
      setDisplayValue(safeTarget);
      return;
    }

    const startValue = hasAnimatedInitialRef.current ? from : 0;
    hasAnimatedInitialRef.current = true;
    lastCommittedRef.current = safeTarget;

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const nextVal = startValue + (safeTarget - startValue) * eased;
      setDisplayValue(t >= 1 ? safeTarget : nextVal);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [safeTarget, disableAnimation, prefersReducedMotion, durationMs]);

  return (
    <span ref={hostRef} className={`num-tabular ${className}`}>
      {formatter(displayValue)}
    </span>
  );
};

interface FadeContentProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Lightweight React Bits inspired entrance reveal.
 * Uses loaded MotionRuntime when active, or renders crisp static container immediately.
 */
export const FadeContent: React.FC<FadeContentProps> = ({
  children,
  className = '',
  delay = 0,
}) => {
  const runtime = useMotionRuntime();
  if (runtime) {
    const { FadeContentImpl } = runtime;
    return (
      <FadeContentImpl className={className} delay={delay}>
        {children}
      </FadeContentImpl>
    );
  }
  return <div className={className}>{children}</div>;
};
