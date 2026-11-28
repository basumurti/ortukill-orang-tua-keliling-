import React, { useEffect, useState, useCallback } from 'react';
import type { LiquidGlassProps } from 'quick-liquid/react';

type LiquidGlassComponent = React.ComponentType<LiquidGlassProps>;

let cachedLiquidGlass: LiquidGlassComponent | null = null;
let liquidGlassPromise: Promise<LiquidGlassComponent | null> | null = null;

function shouldEnhanceWithQuickLiquid(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  // Respect user reduced motion / transparency preferences conservatively
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  if (window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches) return false;

  // Keep mobile / coarse-pointer Android devices on zero-overhead CSS glass
  if (window.matchMedia?.('(pointer: coarse)').matches) return false;
  if (window.innerWidth < 768) return false;

  // Require Chromium-compatible SVG backdrop refraction; Safari/Firefox use CSS glass fallback
  const ua = navigator.userAgent;
  const isChromium =
    /Chrome|Chromium|Edg/i.test(ua) && !/OPR|Opera|Firefox|FxiOS/i.test(ua);
  const supportsBackdrop =
    typeof CSS !== 'undefined' &&
    (CSS.supports('backdrop-filter', 'blur(2px)') ||
      CSS.supports('-webkit-backdrop-filter', 'blur(2px)'));

  return isChromium && supportsBackdrop;
}

function loadLiquidGlass(): Promise<LiquidGlassComponent | null> {
  if (cachedLiquidGlass) return Promise.resolve(cachedLiquidGlass);
  if (!liquidGlassPromise) {
    liquidGlassPromise = import('quick-liquid/react')
      .then((mod) => {
        cachedLiquidGlass = mod.LiquidGlass;
        return cachedLiquidGlass;
      })
      .catch(() => null);
  }
  return liquidGlassPromise;
}

export interface LiquidSurfaceProps {
  children: React.ReactNode;
  className?: string;
  /** Rounded radius in px for QuickLiquid lens geometry */
  borderRadius?: number;
  /** Material preset passed only when QuickLiquid enhancement activates */
  material?: 'clear' | 'thin' | 'regular';
  /** Allow lazy QuickLiquid enhancement on capable desktop Chromium browsers */
  enableRefraction?: boolean;
  /** Role / aria forwarding on outer wrapper */
  role?: string;
  'aria-label'?: string;
}

/**
 * Progressive Liquid Glass surface:
 * 1. Immediately renders lightweight CSS translucent glass fallback on every browser & mobile device.
 * 2. On capable desktop Chromium viewports, asynchronously upgrades small floating chrome
 *    to QuickLiquid SVG refraction at conservative 'low' quality with runtime frame-time fallback.
 */
export const LiquidSurface: React.FC<LiquidSurfaceProps> = ({
  children,
  className = '',
  borderRadius = 16,
  material = 'thin',
  enableRefraction = true,
  role,
  'aria-label': ariaLabel,
}) => {
  const [LiquidComp, setLiquidComp] = useState<LiquidGlassComponent | null>(() => cachedLiquidGlass);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    if (!enableRefraction || degraded || LiquidComp) return;
    if (!shouldEnhanceWithQuickLiquid()) return;

    let cancelled = false;
    const schedule = () => {
      void loadLiquidGlass().then((Comp) => {
        if (!cancelled && Comp) {
          setLiquidComp(() => Comp);
        }
      });
    };

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === 'function') {
      const idleId = win.requestIdleCallback(schedule, { timeout: 600 });
      return () => {
        cancelled = true;
        win.cancelIdleCallback?.(idleId);
      };
    }

    const timer = window.setTimeout(schedule, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enableRefraction, degraded, LiquidComp]);

  const handlePerformanceUpdate = useCallback(
    (metrics: { avgFrameTime: number; mapError: string | null }) => {
      if (metrics.mapError || metrics.avgFrameTime > 26) {
        setDegraded(true);
      }
    },
    []
  );

  if (LiquidComp && enableRefraction && !degraded) {
    return (
      <LiquidComp
        role={role}
        aria-label={ariaLabel}
        className={`liquid-glass-surface ${className}`}
        config={{
          material,
          quality: 'low',
          borderRadius,
          refractionMode: 'auto',
          respectPreferences: true,
          cursorTracking: false,
          hoverLighting: false,
          dynamicLighting: false,
          parallax: false,
          inertia: false,
        }}
        onPerformanceUpdate={handlePerformanceUpdate}
      >
        {children}
      </LiquidComp>
    );
  }

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className={`liquid-glass-surface ${className}`}
    >
      {children}
    </div>
  );
};
