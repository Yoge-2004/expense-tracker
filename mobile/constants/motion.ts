/**
 * MOTION SYSTEM (mobile)
 *
 * Counterpart to `frontend/css/motion-system.css`.
 *
 * These are not "similar" springs — they are the SAME springs. The web
 * easings are `linear()` curves sampled from a damped harmonic oscillator at
 * these exact stiffness/damping/mass values, and Reanimated's `withSpring`
 * takes those same physical parameters directly. Feeding both the identical
 * numbers means motion genuinely matches across platforms rather than merely
 * being tuned to look close.
 *
 * If a spring is retuned on one platform, retune it on the other with the
 * same numbers.
 */

import { Easing, ReduceMotion, withSpring, withTiming } from 'react-native-reanimated';
import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

/** zeta = damping / (2 * sqrt(stiffness * mass)) */
export const SPRING = {
  /** zeta 0.997 — settles with no overshoot. For anything where overshoot
   *  would read as a glitch: heights, progress, values that carry meaning. */
  soft: { stiffness: 170, damping: 26, mass: 1 },

  /** zeta 0.690, peaks at 1.050 — the default UI spring. Enough life to feel
   *  physical, not enough to look unstable. */
  default: { stiffness: 210, damping: 20, mass: 1 },

  /** zeta 0.434, peaks at 1.220 — pronounced bounce. Small, playful accents
   *  only; this much overshoot on a large surface reads as a rendering bug. */
  bouncy: { stiffness: 260, damping: 14, mass: 1 },

  /** zeta 0.850, peaks at 1.006 — fast and crisp, for immediate feedback on
   *  direct interaction where latency is worse than flourish. */
  snap: { stiffness: 400, damping: 34, mass: 1 },
} as const satisfies Record<string, WithSpringConfig>;

export const DURATION = {
  fast: 180,
  base: 280,
  slow: 420,
  deliberate: 620,
} as const;

/**
 * Reanimated respects the OS reduce-motion setting natively when a config
 * carries `reduceMotion: ReduceMotion.System`. Setting it here means every
 * call site inherits the behaviour instead of each one remembering to check
 * the `useReducedMotion()` hook.
 */
const withSystemReduceMotion = <T extends object>(config: T): T & { reduceMotion: ReduceMotion } => ({
  ...config,
  reduceMotion: ReduceMotion.System,
});

export type SpringName = keyof typeof SPRING;

/** Spring toward a value using one of the shared presets. */
export function spring(toValue: number, preset: SpringName = 'default') {
  return withSpring(toValue, withSystemReduceMotion(SPRING[preset]));
}

/** Timed transition, for opacity and colour where a spring adds nothing. */
export function timing(toValue: number, duration: number = DURATION.base): ReturnType<typeof withTiming> {
  const config: WithTimingConfig = { duration, easing: Easing.out(Easing.cubic) };
  return withTiming(toValue, withSystemReduceMotion(config));
}

/**
 * Staggered delay for list entrances, capped the same way the web ledger is:
 * past the 10th row the delay stops growing, so a long list never leaves its
 * last row waiting seconds to appear.
 */
export function staggerDelay(index: number, step = 22, cap = 10): number {
  return Math.min(index, cap) * step;
}

/** Press-feedback scale. Matches the web `:active` treatment. */
export const PRESS_SCALE = 0.97;
