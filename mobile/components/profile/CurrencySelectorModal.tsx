/**
 * @file CurrencySelectorModal.tsx
 * @description Accessible search and selection modal for 65+ world currencies.
 */

import React, { memo, useState } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedText as Text, ThemedTextInput as TextInput } from '../ThemedText';
import { ThemeColors } from '../../constants/theme';
import { WORLD_CURRENCIES, CurrencyItem } from '../../services/currency';

export interface CurrencySelectorModalProps {
  visible: boolean;
  currency: string;
  colors: ThemeColors;
  onClose: () => void;
  onSelectCurrency: (code: string) => Promise<void>;
}

export const CurrencySelectorModal = memo(function CurrencySelectorModal({
  visible,
  currency,
  colors: c,
  onClose,
  onSelectCurrency,
}: CurrencySelectorModalProps) {
  const [currencySearch, setCurrencySearch] = useState('');

  const filteredCurrencies = WORLD_CURRENCIES.filter(
    (item: CurrencyItem) =>
      item.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
      item.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
      item.symbol.includes(currencySearch)
  );

  const handleSelect = async (code: string) => {
    Haptics.selectionAsync().catch(() => {});
    await onSelectCurrency(code);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.currModalContent, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.currModalHeader}>
            <Text style={[styles.currModalTitle, { color: c.text }]}>
              Select Currency ({WORLD_CURRENCIES.length})
            </Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close currency picker">
              <Ionicons name="close-circle" size={24} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.currSearchBox,
              { backgroundColor: c.inputBg, borderColor: c.border },
            ]}
          >
            <Ionicons name="search" size={16} color={c.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.currSearchInput, { color: c.text }]}
              placeholder="Search by code, symbol, or country..."
              placeholderTextColor={c.textMuted}
              value={currencySearch}
              onChangeText={setCurrencySearch}
            />
            {currencySearch.length > 0 && (
              <TouchableOpacity
                onPress={() => setCurrencySearch('')}
                onPressIn={() => setCurrencySearch('')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Clear search"
                accessibilityRole="button"
              >
                <Ionicons name="close-circle" size={16} color={c.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            keyboardShouldPersistTaps="handled"
            data={filteredCurrencies}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => {
              const isSelected = item.code === currency;
              return (
                <TouchableOpacity
                  style={[
                    styles.currItemRow,
                    { borderBottomColor: c.border },
                    isSelected && { backgroundColor: c.primary + '18' },
                  ]}
                  onPress={() => handleSelect(item.code)}
                >
                  <View style={styles.currItemLeft}>
                    <Text style={styles.currFlag}>{item.flag}</Text>
                    <View>
                      <Text style={[styles.currCodeText, { color: c.text }]}>{item.code}</Text>
                      <Text style={[styles.currNameText, { color: c.textMuted }]}>
                        {item.name}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.currItemRight}>
                    <Text
                      style={[
                        styles.currSymbolText,
                        { color: isSelected ? c.primary : c.textMuted },
                      ]}
                    >
                      {item.symbol}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={c.primary} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  currModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  currModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    paddingBottom: 12,
  },
  currModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  currSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
  },
  currSearchInput: {
    flex: 1,
    fontSize: 14,
  },
  currItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  currItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currFlag: {
    fontSize: 24,
  },
  currCodeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  currNameText: {
    fontSize: 12,
    marginTop: 1,
  },
  currItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currSymbolText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
