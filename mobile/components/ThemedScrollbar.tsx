/**
 * @file ThemedScrollbar.tsx
 * @description A scrollbar drawn by the app instead of the system.
 *
 * React Native cannot recolour the native scrollbar on Android and offers only black or white on iOS, so
 * lists showed the stock grey indicator in both themes. This draws the website's scrollbar instead: a
 * thin, fully rounded translucent track with a gold thumb. It follows the list through an Animated.Value
 * that the list updates from its onScroll handler, and ignores touches so it never blocks the list.
 */

import React, { useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export interface ScrollbarGeometry {
  /** False when the content fits, so no scrollbar is needed. */
  visible: boolean;
  thumbHeight: number;
  /** How far the thumb can travel inside the track. */
  travel: number;
  /** How far the content can scroll. */
  maxOffset: number;
}

const HIDDEN: ScrollbarGeometry = { visible: false, thumbHeight: 0, travel: 0, maxOffset: 0 };

/**
 * Thumb size is the visible share of the content (never smaller than minThumb so it stays easy to see);
 * its travel is whatever track length the thumb leaves free.
 */
export function computeScrollbarGeometry(
  contentHeight: number,
  viewHeight: number,
  trackHeight: number,
  minThumb = 28,
): ScrollbarGeometry {
  if (![contentHeight, viewHeight, trackHeight].every((n) => Number.isFinite(n) && n > 0)) {
    return HIDDEN;
  }
  if (contentHeight <= viewHeight + 1) {
    return HIDDEN;
  }
  const thumbHeight = Math.min(trackHeight, Math.max(minThumb, (viewHeight / contentHeight) * trackHeight));
  return {
    visible: true,
    thumbHeight,
    travel: Math.max(0, trackHeight - thumbHeight),
    maxOffset: contentHeight - viewHeight,
  };
}

interface ThemedScrollbarProps {
  /** The list's vertical scroll offset, updated from onScroll. */
  scrollY: Animated.Value;
  contentHeight: number;
  viewHeight: number;
  trackColor: string;
  thumbColor: string;
  /** Gap kept above and below the track. */
  inset?: number;
}

const TRACK_WIDTH = 6;
const THUMB_GAP = 1;

export const ThemedScrollbar = React.memo(function ThemedScrollbar({
  scrollY,
  contentHeight,
  viewHeight,
  trackColor,
  thumbColor,
  inset = 8,
}: ThemedScrollbarProps) {
  const trackHeight = viewHeight - inset * 2;
  const geometry = useMemo(
    () => computeScrollbarGeometry(contentHeight, viewHeight, trackHeight),
    [contentHeight, viewHeight, trackHeight],
  );

  const translateY = useMemo(
    () =>
      geometry.visible
        ? scrollY.interpolate({
            inputRange: [0, geometry.maxOffset],
            outputRange: [0, geometry.travel],
            extrapolate: 'clamp',
          })
        : 0,
    [scrollY, geometry],
  );

  if (!geometry.visible) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.track, { top: inset, bottom: inset, backgroundColor: trackColor }]}
    >
      <Animated.View
        style={[
          styles.thumb,
          { height: geometry.thumbHeight, backgroundColor: thumbColor, transform: [{ translateY }] },
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    right: 3,
    width: TRACK_WIDTH,
    borderRadius: 999,
  },
  thumb: {
    marginHorizontal: THUMB_GAP,
    borderRadius: 999,
  },
});
