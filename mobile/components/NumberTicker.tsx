/**
 * @file NumberTicker.tsx
 * @description Smooth 60fps interpolation component mimicking the web dashboard's
 * `countUp` animation on KPI metric cards.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';

interface NumberTickerProps {
  /** Target numeric value to count towards. */
  value: number;
  /** Optional string prefix (e.g. "₹", "$"). */
  prefix?: string;
  /** Optional string suffix (e.g. "%", " /mo"). */
  suffix?: string;
  /** Transition duration in milliseconds (default: 850ms). */
  duration?: number;
  /** Style for the rendered text container. */
  style?: StyleProp<TextStyle>;
  /** Number of decimal places to format. */
  decimals?: number;
}

/**
 * Animated number ticker with easeOutBack interpolation.
 */
export const NumberTicker: React.FC<NumberTickerProps> = ({
  value,
  prefix = '',
  suffix = '',
  duration = 850,
  style,
  decimals = 0,
}) => {
  const safeTargetVal = isNaN(value) ? 0 : Number(value);
  const [displayVal, setDisplayVal] = useState(safeTargetVal);
  const prevValRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const startVal = prevValRef.current;
    const targetVal = safeTargetVal;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / Math.max(duration, 1), 1);

      // Smooth ease-out curve matching website motion.js: easeOutBack
      const ease = 1 + 2.70158 * Math.pow(progress - 1, 3) + 1.70158 * Math.pow(progress - 1, 2);
      const current = startVal + (targetVal - startVal) * Math.min(Math.max(ease, 0), 1);

      setDisplayVal(isNaN(current) ? 0 : current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayVal(targetVal);
        prevValRef.current = targetVal;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [safeTargetVal, duration]);

  const formattedNumber = (isNaN(displayVal) ? 0 : displayVal).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <Text style={style}>
      {prefix}{formattedNumber}{suffix}
    </Text>
  );
};
