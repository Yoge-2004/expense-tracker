/**
 * @file AiForecastCard.tsx
 * @description Dedicated Forward Spending AI Forecast Card featuring interactive time-series SVG visualization
 * and honest zero-fabrication calibration state.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText as Text } from '../ThemedText';
import { ThemeColors } from '../../constants/theme';
import { MlForecastData, MlForecastStatus } from './types';

interface AiForecastCardProps {
  forecast: MlForecastData | null;
  status: MlForecastStatus;
  formatAmt: (val: number) => string;
  onPress: () => void;
  colors: ThemeColors;
}

export const AiForecastCard: React.FC<AiForecastCardProps> = React.memo(({
  forecast,
  status,
  formatAmt,
  onPress,
  colors: c,
}) => {
  const chart = useMemo(() => {
    if (!forecast?.points?.length) return null;
    const width = 280;
    const height = 64;
    const baseline = 54;
    const amounts = forecast.points.map((p) => p.amount);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const span = max - min || Math.max(max, 1);

    const coords = forecast.points.map((p, idx) => ({
      x: forecast.points.length === 1
        ? width / 2
        : 10 + (idx / (forecast.points.length - 1)) * (width - 20),
      y: baseline - ((p.amount - min) / span) * 38,
    }));

    const line = coords
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${baseline} L ${coords[0].x.toFixed(1)} ${baseline} Z`;

    return { coords, line, area, width, height, baseline };
  }, [forecast]);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.heroCard,
        {
          backgroundColor: c.card,
          borderColor: status.isCalibrated ? c.primary + '35' : c.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="AI Forward Spending Forecast"
    >
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBox, { backgroundColor: c.primary + '18' }]}>
            <Ionicons name="trending-up-outline" size={20} color={c.primary} />
          </View>
          <View>
            <Text style={[styles.cardTag, { color: c.primary }]}>
              {status.isCalibrated ? 'ML Forecast • 7-Day Horizon' : 'AI Model Calibrating'}
            </Text>
            <Text style={[styles.cardTitle, { color: c.text }]}>Forward Spend Projection</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </View>

      {status.isCalibrated && forecast ? (
        <View style={styles.calibratedBody}>
          <View style={styles.kpiRow}>
            <View>
              <Text style={[styles.primaryVal, { color: c.primary }]}>
                {formatAmt(forecast.total)}
              </Text>
              <Text style={[styles.subText, { color: c.textMuted }]}>
                Projected next {forecast.days} days ({formatAmt(forecast.total / forecast.days)}/day)
              </Text>
            </View>
            <View style={[styles.modelBadge, { backgroundColor: c.primary + '15', borderColor: c.primary + '30' }]}>
              <Text style={[styles.modelBadgeText, { color: c.primary }]}>Time-Series</Text>
            </View>
          </View>

          {chart && (
            <View style={styles.chartWrap} accessibilityLabel={`7-day spending forecast trajectory chart`}>
              <Svg width="100%" height={chart.height} viewBox={`0 0 ${chart.width} ${chart.height}`} preserveAspectRatio="none">
                <Line x1={0} y1={chart.baseline} x2={chart.width} y2={chart.baseline} stroke={c.border} strokeWidth={1} />
                <Path d={chart.area} fill={c.primary} fillOpacity={0.12} />
                <Path d={chart.line} fill="none" stroke={c.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                {chart.coords.map((pt, idx) => (
                  <Circle
                    key={`${forecast.points[idx]?.date || idx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={idx === 0 || idx === chart.coords.length - 1 ? 3.5 : 2.5}
                    fill={c.primary}
                  />
                ))}
              </Svg>
              <View style={styles.axisRow}>
                <Text style={[styles.axisText, { color: c.textMuted }]}>
                  {forecast.points[0]?.date?.slice(5) || 'Start'}
                </Text>
                <Text style={[styles.axisText, { color: c.textMuted }]}>
                  {forecast.points[forecast.points.length - 1]?.date?.slice(5) || 'End'}
                </Text>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.calibratingBody}>
          <View style={styles.progressHeader}>
            <Text style={[styles.calibratingVal, { color: c.text }]}>
              {status.daysRecorded} <Text style={{ fontSize: 13, color: c.textMuted }}>/ {status.requiredDays} Days Logged</Text>
            </Text>
            <Text style={[styles.calibratingPct, { color: c.primary }]}>
              {Math.min(100, Math.round((status.daysRecorded / status.requiredDays) * 100))}%
            </Text>
          </View>
          <View style={[styles.progressBarTrack, { backgroundColor: c.border }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: c.primary,
                  width: `${Math.min(100, Math.max(5, (status.daysRecorded / status.requiredDays) * 100))}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.calibratingDesc, { color: c.textMuted }]}>
            HistGradientBoosting time-series model requires 28 days of daily spending to build 7-day and 28-day seasonal lags without fabricated data.
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

AiForecastCard.displayName = 'AiForecastCard';

const styles = StyleSheet.create({
  heroCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTag: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  calibratedBody: {
    gap: 10,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  primaryVal: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  modelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  modelBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chartWrap: {
    width: '100%',
    marginTop: 6,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  axisText: {
    fontSize: 10,
    fontWeight: '600',
  },
  calibratingBody: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  calibratingVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  calibratingPct: {
    fontSize: 13,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  calibratingDesc: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    marginTop: 2,
  },
});
