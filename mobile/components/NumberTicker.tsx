/**
 * @file NumberTicker.tsx
 * @description Smooth numeric interpolation component for KPI metric cards.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface NumberTickerProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  style?: StyleProp<TextStyle>;
  decimals?: number;
}

export const NumberTicker: React.FC<NumberTickerProps> = ({
  value,
  prefix = '',
  suffix = '',
  duration = 850,
  style,
  decimals = 0,
}) => {
  const safeTargetVal = Number.isFinite(Number(value)) ? Number(value) : 0;
  const [displayVal, setDisplayVal] = useState(safeTargetVal);
  const prevValRef = useRef(safeTargetVal);
  const animationFrameRef = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const startVal = prevValRef.current;
    const targetVal = safeTargetVal;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (reducedMotion || startVal === targetVal) {
      setDisplayVal(targetVal);
      prevValRef.current = targetVal;
      return;
    }

    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / Math.max(duration, 1), 1);
      const eased = 1 + 2.70158 * Math.pow(progress - 1, 3) + 1.70158 * Math.pow(progress - 1, 2);
      const current = startVal + (targetVal - startVal) * Math.min(Math.max(eased, 0), 1);

      setDisplayVal(Number.isFinite(current) ? current : targetVal);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
        prevValRef.current = targetVal;
        setDisplayVal(targetVal);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [duration, reducedMotion, safeTargetVal]);

  const formattedNumber = displayVal.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return <Text style={style}>{prefix}{formattedNumber}{suffix}</Text>;
};
