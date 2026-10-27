import React, { useState, useRef, useEffect, memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedTextInput as TextInput } from '../ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../constants/theme';

export interface SearchFieldProps {
  onSearch: (query: string) => void;
  colors: ThemeColors;
}

export const SearchField = memo(function SearchField({ onSearch, colors }: SearchFieldProps) {
  const [text, setText] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const change = (value: string) => {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(value), 200);
  };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    setText('');
    onSearch('');
  };

  return (
    <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
      <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        placeholder="Search description or category..."
        placeholderTextColor={colors.textMuted}
        value={text}
        onChangeText={change}
        returnKeyType="search"
      />
      {text.length > 0 && (
        <TouchableOpacity
          onPress={clear}
          onPressIn={clear}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    height: '100%',
  },
});
