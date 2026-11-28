import React from 'react';
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  domAnimation,
  m,
} from 'motion/react';
import {
  FADE_UP_VARIANTS,
  TAB_SPRING,
  TOAST_VARIANTS,
  VIEW_TRANSITION,
} from '../../../lib/motion';

export const MotionProviderImpl: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LazyMotion features={domAnimation}>
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
  </LazyMotion>
);

export const AnimatedTabPillImpl: React.FC<{ layoutId: string; className?: string }> = ({
  layoutId,
  className = '',
}) => (
  <m.span
    layoutId={layoutId}
    initial={false}
    transition={TAB_SPRING}
    aria-hidden="true"
    className={className}
  />
);

export const ViewFadeTransitionImpl: React.FC<{
  viewKey: string;
  shouldAnimateMount: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ viewKey, shouldAnimateMount, children, className = '' }) => (
  <m.div
    key={viewKey}
    initial={shouldAnimateMount ? { opacity: 0, y: 4 } : false}
    animate={{ opacity: 1, y: 0 }}
    transition={VIEW_TRANSITION}
    className={className}
  >
    {children}
  </m.div>
);

export const AnimatedToastContainerImpl: React.FC<{
  toastKey: number | string | null;
  children: React.ReactNode;
  className?: string;
}> = ({ toastKey, children, className = '' }) => (
  <AnimatePresence mode="wait">
    {toastKey !== null && (
      <m.div
        key={toastKey}
        variants={TOAST_VARIANTS}
        initial="initial"
        animate="animate"
        exit="exit"
        className={className}
      >
        {children}
      </m.div>
    )}
  </AnimatePresence>
);

export const FadeContentImpl: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
}> = ({ children, className = '', delay = 0 }) => (
  <m.div
    variants={FADE_UP_VARIANTS}
    initial="hidden"
    animate="visible"
    transition={delay > 0 ? { delay, duration: 0.18, ease: [0.16, 1, 0.3, 1] } : undefined}
    className={className}
  >
    {children}
  </m.div>
);
