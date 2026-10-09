/**
 * ChoiceChips
 *
 * Single-choice selector rendered as a wrapping row of chips. Used for small option sets
 * (income type, which month an income counts toward, which category a refund pays back).
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface ChoiceOption<T extends string | number> {
  value: T;
  label: string;
}

interface ChoiceChipsProps<T extends string | number> {
  options: ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Colour of the selected chip. */
  accent?: string;
  /** Theme colours for unselected chips. */
  colors: { card: string; border: string; textMuted: string };
}

export function ChoiceChips<T extends string | number>({
  options,
  value,
  onChange,
  accent = '#10B981',
  colors,
}: ChoiceChipsProps<T>) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={String(option.value)}
            activeOpacity={0.8}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? accent : colors.card,
                borderColor: selected ? accent : colors.border,
              },
            ]}
          >
            <Text style={[styles.label, { color: selected ? '#FFFFFF' : colors.textMuted }, selected && styles.labelSelected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  labelSelected: {
    fontWeight: '800',
  },
});
