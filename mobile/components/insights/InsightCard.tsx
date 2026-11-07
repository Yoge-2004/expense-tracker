/**
 * @file InsightCard.tsx
 * @description Standard reusable insight card component supporting 2-column grid and full-width layouts
 * with accessible contrast and micro-interactions.
 */

import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText as Text } from '../ThemedText';
import { ThemeColors } from '../../constants/theme';

interface InsightCardProps {
  title: string;
  tag: string;
  icon: any;
  iconColor: string;
  primaryVal: string;
  primaryValColor?: string;
  subText?: string | React.ReactNode;
  onPress: () => void;
  fullWidth?: boolean;
  colors: ThemeColors;
}

export const InsightCard: React.FC<InsightCardProps> = React.memo(({
  title,
  tag,
  icon,
  iconColor,
  primaryVal,
  primaryValColor,
  subText,
  onPress,
  fullWidth = false,
  colors: c,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.card,
        fullWidth ? styles.fullCard : styles.halfCard,
        {
          backgroundColor: c.card,
          borderColor: c.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${primaryVal}`}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: iconColor + '18' }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <Text style={[styles.cardTag, { color: iconColor }]}>
          {tag}
        </Text>
      </View>
      <Text style={[styles.cardTitle, { color: c.text }]}>{title}</Text>
      <Text
        style={[
          styles.cardPrimaryVal,
          { color: primaryValColor || c.text },
        ]}
      >
        {primaryVal}
      </Text>
      {typeof subText === 'string' ? (
        <Text style={[styles.cardSubText, { color: c.textMuted }]} numberOfLines={1}>
          {subText}
        </Text>
      ) : (
        subText
      )}
    </TouchableOpacity>
  );
});

InsightCard.displayName = 'InsightCard';

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  halfCard: {
    width: '48%',
  },
  fullCard: {
    width: '100%',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
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
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardPrimaryVal: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  cardSubText: {
    fontSize: 10.5,
  },
});
