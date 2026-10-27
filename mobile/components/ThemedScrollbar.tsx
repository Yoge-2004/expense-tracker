/**
 * @file ThemedScrollbar.tsx
 * @description A scrollbar drawn by the app instead of the system.
 *
 * React Native cannot recolour the native scrollbar on Android and offers only black or white on iOS, so
 * lists showed the stock grey indicator in both themes. This draws the website's scrollbar instead: a
 * thin, fully rounded translucent track with a gold thumb. It follows the list through an Animated.Value
 * that the list updates from its onScroll handler, and ignores touches so it never blocks the list.
 */

import React, { useMemo, useRef, useState, useCallback } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  ViewStyle,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from 'react-native';
import { Colors, ThemeColors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

function useSafeThemeColors(): ThemeColors {
  try {
    const auth = useAuth();
    const theme = auth?.theme || 'dark';
    return auth?.themeColors || Colors[theme];
  } catch {
    return Colors.dark;
  }
}

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

export interface ThemedScrollbarProps {
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

export interface UseThemedScrollbarOptions {
  trackColor?: string;
  thumbColor?: string;
  inset?: number;
}

/**
 * Reusable hook to effortlessly bind ThemedScrollbar to any ScrollView or FlatList.
 */
export function useThemedScrollbar(options: UseThemedScrollbarOptions = {}) {
  const c = useSafeThemeColors();
  const trackColor = options.trackColor || c.scrollTrack;
  const thumbColor = options.thumbColor || c.scrollThumb;
  const inset = options.inset ?? 8;

  const scrollY = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);
  const [viewHeight, setViewHeight] = useState(0);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.setValue(e.nativeEvent.contentOffset.y);
    },
    [scrollY],
  );

  const onContentSizeChange = useCallback((_w: number, h: number) => {
    setContentHeight(h);
  }, []);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setViewHeight(e.nativeEvent.layout.height);
  }, []);

  const scrollbar = useMemo(
    () => (
      <ThemedScrollbar
        scrollY={scrollY}
        contentHeight={contentHeight}
        viewHeight={viewHeight}
        trackColor={trackColor}
        thumbColor={thumbColor}
        inset={inset}
      />
    ),
    [scrollY, contentHeight, viewHeight, trackColor, thumbColor, inset],
  );

  return {
    scrollY,
    contentHeight,
    viewHeight,
    onScroll,
    onContentSizeChange,
    onLayout,
    scrollbar,
    scrollProps: {
      onScroll,
      scrollEventThrottle: 16,
      onContentSizeChange,
      onLayout,
      showsVerticalScrollIndicator: false,
    },
  };
}

export interface ThemedScrollViewProps extends ScrollViewProps {
  trackColor?: string;
  thumbColor?: string;
  scrollbarInset?: number;
  containerStyle?: StyleProp<ViewStyle>;
  hideScrollbar?: boolean;
}

/**
 * A drop-in replacement for ScrollView that renders the custom website-style gold scrollbar.
 */
export const ThemedScrollView = React.forwardRef<React.ElementRef<typeof ScrollView>, ThemedScrollViewProps>(
  function ThemedScrollView(
    {
      children,
      style,
      containerStyle,
      trackColor,
      thumbColor,
      scrollbarInset = 8,
      hideScrollbar = true,
      onScroll: userOnScroll,
      onContentSizeChange: userOnContentSizeChange,
      onLayout: userOnLayout,
      scrollEventThrottle = 16,
      ...rest
    },
    ref,
  ) {
    const c = useSafeThemeColors();
    const resolvedTrack = trackColor || c.scrollTrack;
    const resolvedThumb = thumbColor || c.scrollThumb;

    const scrollY = useRef(new Animated.Value(0)).current;
    const [contentHeight, setContentHeight] = useState(0);
    const [viewHeight, setViewHeight] = useState(0);

    const handleScroll = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollY.setValue(e.nativeEvent.contentOffset.y);
        userOnScroll?.(e);
      },
      [scrollY, userOnScroll],
    );

    const handleContentSizeChange = useCallback(
      (w: number, h: number) => {
        setContentHeight(h);
        userOnContentSizeChange?.(w, h);
      },
      [userOnContentSizeChange],
    );

    const handleLayout = useCallback(
      (e: LayoutChangeEvent) => {
        setViewHeight(e.nativeEvent.layout.height);
        userOnLayout?.(e);
      },
      [userOnLayout],
    );

    return (
      <View style={[styles.scrollViewContainer, containerStyle]}>
        <ScrollView
          ref={ref as any}
          style={style}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={scrollEventThrottle}
          onScroll={handleScroll}
          onContentSizeChange={handleContentSizeChange}
          onLayout={handleLayout}
          {...rest}
        >
          {children}
        </ScrollView>
        {!hideScrollbar && (
          <ThemedScrollbar
            scrollY={scrollY}
            contentHeight={contentHeight}
            viewHeight={viewHeight}
            trackColor={resolvedTrack}
            thumbColor={resolvedThumb}
            inset={scrollbarInset}
          />
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  scrollViewContainer: {
    flex: 1,
    position: 'relative',
  },
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
