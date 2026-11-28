import type { Transition, Variants } from 'motion/react';

/**
 * Centralized ORTUKILL POS Motion Presets
 * - Compositor-only animations (transform & opacity)
 * - Fast operational feedback (100ms - 250ms)
 * - Respects OS prefers-reduced-motion via <MotionConfig reducedMotion="user">
 */

export const FAST_SPRING: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 36,
  mass: 0.7,
};

export const TAB_SPRING: Transition = {
  type: 'spring',
  stiffness: 460,
  damping: 34,
  mass: 0.8,
};

export const MODAL_TRANSITION: Transition = {
  duration: 0.2,
  ease: [0.16, 1, 0.3, 1],
};

export const TOAST_TRANSITION: Transition = {
  duration: 0.18,
  ease: [0.16, 1, 0.3, 1],
};

export const VIEW_TRANSITION: Transition = {
  duration: 0.16,
  ease: [0.16, 1, 0.3, 1],
};

export const FADE_UP_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: VIEW_TRANSITION,
  },
};

export const TOAST_VARIANTS: Variants = {
  initial: { opacity: 0, y: -10, scale: 0.96 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: TOAST_TRANSITION,
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.96,
    transition: { duration: 0.14, ease: [0.4, 0, 1, 1] },
  },
};
