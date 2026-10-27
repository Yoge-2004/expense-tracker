/**
 * @file SampleReceiptsPicker.tsx
 * @description Memoized quick selector for testing receipt OCR with pre-configured sample receipts.
 */

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { ThemedText as Text } from './ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { SAMPLE_RECEIPTS } from '../services/receiptOcr';

interface SampleReceiptsPickerProps {
  visible: boolean;
  onSelect: (index: number) => void;
  colors: {
    border: string;
    textMuted: string;
    inputBg: string;
    primary: string;
    text: string;
  };
}

export const SampleReceiptsPicker: React.FC<SampleReceiptsPickerProps> = React.memo(
  ({ visible, onSelect, colors }) => {
    if (!visible) return null;

    return (
      <View
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          gap: 6,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>
          SELECT SAMPLE RECEIPT TO TEST OCR:
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {SAMPLE_RECEIPTS.map((s, idx) => (
            <TouchableOpacity
              key={s.name}
              activeOpacity={0.75}
              onPress={() => onSelect(idx)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
                borderWidth: 1,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <Ionicons name={s.icon as any} size={13} color={colors.primary} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }
);
