import React, { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  PanResponder,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemeColors } from '../../constants/theme';
import { ThemedScrollbar } from '../ThemedScrollbar';
import { CategoryPillsBar, DatePresetType } from '../CategoryPillsBar';
import { SearchField } from './SearchField';
import { TransactionRow } from './TransactionRow';
import { UnifiedTxItem } from './dashboardTypes';
import { dashboardStyles as styles } from './dashboardStyles';

export interface DashboardLedgerProps {
  colors: ThemeColors;
  theme: 'light' | 'dark';
  currSymbol: string;
  isStealthMode: boolean;
  categories: { id: number; name: string }[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  datePreset: DatePresetType;
  onSelectDatePreset: (preset: DatePresetType) => void;
  startDate: string;
  onStartDateChange: (d: string) => void;
  endDate: string;
  onEndDateChange: (d: string) => void;
  ledgerTab: 'all' | 'expenses' | 'incomes';
  setLedgerTab: (tab: 'all' | 'expenses' | 'incomes') => void;
  filteredExpensesCount: number;
  filteredIncomesCount: number;
  unifiedTransactions: UnifiedTxItem[];
  onSearch: (q: string) => void;
  searchQuery: string;
  sortOption: 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
  setSortOption: (sort: 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc') => void;
  onRowPress: (tx: UnifiedTxItem) => void;
  onRowEdit: (tx: UnifiedTxItem) => void;
  onRowDelete: (tx: UnifiedTxItem) => void;
}

const LedgerSeparator = () => <View style={styles.ledgerSeparator} />;

export const DashboardLedger = memo(function DashboardLedger({
  colors: c,
  theme,
  currSymbol,
  isStealthMode,
  categories,
  selectedCategory,
  onSelectCategory,
  datePreset,
  onSelectDatePreset,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  ledgerTab,
  setLedgerTab,
  filteredExpensesCount,
  filteredIncomesCount,
  unifiedTransactions,
  onSearch,
  searchQuery,
  sortOption,
  setSortOption,
  onRowPress,
  onRowEdit,
  onRowDelete,
}: DashboardLedgerProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [ledgerDisplayLimit, setLedgerDisplayLimit] = useState(20);
  const ledgerScrollY = useRef(new Animated.Value(0)).current;
  const [ledgerContentHeight, setLedgerContentHeight] = useState(0);
  const [ledgerViewHeight, setLedgerViewHeight] = useState(0);
  const ledgerScrollRef = useRef<any>(null);

  const toggleFilterPanel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setShowFilters((prev) => !prev);
  }, []);

  const streamTabsResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dy) < 10,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < -30) {
            if (ledgerTab === 'all') setLedgerTab('expenses');
            else if (ledgerTab === 'expenses') setLedgerTab('incomes');
          } else if (gestureState.dx > 30) {
            if (ledgerTab === 'incomes') setLedgerTab('expenses');
            else if (ledgerTab === 'expenses') setLedgerTab('all');
          }
        },
      }),
    [ledgerTab, setLedgerTab]
  );

  const displayedTransactions = useMemo(
    () => unifiedTransactions.slice(0, ledgerDisplayLimit),
    [unifiedTransactions, ledgerDisplayLimit]
  );

  const onLedgerContentSize = useCallback((_w: number, h: number) => setLedgerContentHeight(h), []);
  const onLedgerLayout = useCallback((e: LayoutChangeEvent) => setLedgerViewHeight(e.nativeEvent.layout.height), []);
  const onLedgerScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    ledgerScrollY.setValue(e.nativeEvent.contentOffset.y);
  }, [ledgerScrollY]);

  // Changing filters resets the list view to top
  useEffect(() => {
    ledgerScrollRef.current?.scrollTo({ y: 0, animated: false });
    setLedgerDisplayLimit(20);
  }, [searchQuery, selectedCategory, datePreset, startDate, endDate, ledgerTab, sortOption]);

  return (
    <View style={[styles.ledgerContainer, { backgroundColor: c.card, borderColor: c.border }]}>
      {/* Ledger Container Header */}
      <View style={styles.ledgerHeader}>
        <View style={styles.ledgerHeaderLeft}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Recent Transactions</Text>
          <View style={[styles.countBadge, { backgroundColor: c.primary + '18' }]}>
            <Text style={[styles.countBadgeText, { color: c.primary }]}>
              {unifiedTransactions.length}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={toggleFilterPanel}
          style={[
            styles.filterToggleBtn,
            {
              backgroundColor: showFilters ? c.primary + '20' : c.inputBg,
              borderColor: showFilters ? c.primary : c.border,
            },
          ]}
        >
          <Ionicons
            name={showFilters ? 'options' : 'options-outline'}
            size={14}
            color={showFilters ? c.primary : c.textMuted}
          />
          <Text
            style={[
              styles.filterToggleText,
              { color: showFilters ? c.primary : c.textMuted },
            ]}
          >
            Filter
          </Text>
        </TouchableOpacity>
      </View>

      {/* Activity Stream Selector Pills: All | Outflows | Inflows */}
      <View
        style={[styles.streamTabsBar, { backgroundColor: c.inputBg, borderColor: c.border }]}
        {...streamTabsResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setLedgerTab('all');
          }}
          style={[styles.streamTabBtn, ledgerTab === 'all' && { backgroundColor: c.card, borderColor: c.primary, borderWidth: 1 }]}
        >
          <Text style={[styles.streamTabText, { color: ledgerTab === 'all' ? c.primary : c.textMuted, fontWeight: ledgerTab === 'all' ? '800' : '600' }]}>
            All Activity ({filteredExpensesCount + filteredIncomesCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setLedgerTab('expenses');
          }}
          style={[styles.streamTabBtn, ledgerTab === 'expenses' && { backgroundColor: c.card, borderColor: c.primary, borderWidth: 1 }]}
        >
          <Text style={[styles.streamTabText, { color: ledgerTab === 'expenses' ? c.primary : c.textMuted, fontWeight: ledgerTab === 'expenses' ? '800' : '600' }]}>
            Outflows ({filteredExpensesCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setLedgerTab('incomes');
          }}
          style={[styles.streamTabBtn, ledgerTab === 'incomes' && { backgroundColor: c.card, borderColor: '#10B981', borderWidth: 1 }]}
        >
          <Text style={[styles.streamTabText, { color: ledgerTab === 'incomes' ? '#10B981' : c.textMuted, fontWeight: ledgerTab === 'incomes' ? '800' : '600' }]}>
            Inflows ({filteredIncomesCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <SearchField onSearch={onSearch} colors={c} />

      {/* Category Filter Pills & Custom Date Presets */}
      <CategoryPillsBar
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
        datePreset={datePreset}
        onSelectDatePreset={onSelectDatePreset}
        startDate={startDate}
        onStartDateChange={onStartDateChange}
        endDate={endDate}
        onEndDateChange={onEndDateChange}
      />

      {/* Expandable Advanced Sort & Controls */}
      {showFilters && (
        <View style={[styles.advancedPanel, { backgroundColor: c.inputBg, borderColor: c.border }]}>
          <Text style={[styles.advancedLabel, { color: c.textMuted }]}>Sort Order:</Text>
          <View style={styles.sortChipsWrap}>
            {[
              { id: 'date-desc', label: 'Latest First' },
              { id: 'date-asc', label: 'Oldest First' },
              { id: 'amount-desc', label: 'Highest Amount' },
              { id: 'amount-asc', label: 'Lowest Amount' },
            ].map((s) => {
              const isSelected = sortOption === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSortOption(s.id as any)}
                  style={[
                    styles.sortChip,
                    {
                      backgroundColor: isSelected ? c.primary : c.card,
                      borderColor: isSelected ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      {
                        color: isSelected ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted,
                        fontWeight: isSelected ? '800' : '600',
                      },
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Bounded Scrollable Items Box */}
      <View style={[styles.scrollableLedgerBox, { borderColor: c.border }]}>
        {unifiedTransactions.length === 0 ? (
          <View style={styles.emptyLedgerInside}>
            <Ionicons name="receipt-outline" size={38} color={c.textMuted} />
            <Text style={[styles.emptyLedgerTitle, { color: c.text }]}>No activity found</Text>
            <Text style={[styles.emptyLedgerSub, { color: c.textMuted }]}>
              {searchQuery || selectedCategory !== 'all' || datePreset !== 'all'
                ? 'Adjust your search query, dates, or stream tabs.'
                : 'Log transactions to see live inflows and outflows.'}
            </Text>
          </View>
        ) : (
          <>
            <ScrollView
              ref={ledgerScrollRef}
              style={styles.innerListScroll}
              contentContainerStyle={styles.transactionsList}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={onLedgerScroll}
              onContentSizeChange={onLedgerContentSize}
              onLayout={onLedgerLayout}
            >
              {displayedTransactions.map((item, idx) => (
                <React.Fragment key={item.uniqueKey}>
                  {idx > 0 && <LedgerSeparator />}
                  <TransactionRow
                    tx={item}
                    colors={c}
                    currSymbol={currSymbol}
                    isStealth={isStealthMode}
                    onPress={onRowPress}
                    onEdit={onRowEdit}
                    onDelete={onRowDelete}
                  />
                </React.Fragment>
              ))}
              {unifiedTransactions.length > ledgerDisplayLimit && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setLedgerDisplayLimit((prev) => prev + 20)}
                  style={[styles.loadMoreRowBtn, { backgroundColor: c.inputBg, borderColor: c.border }]}
                >
                  <Text style={[styles.loadMoreRowText, { color: c.primary }]}>
                    Load More ({unifiedTransactions.length - ledgerDisplayLimit} remaining)
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={c.primary} />
                </TouchableOpacity>
              )}
            </ScrollView>
            <ThemedScrollbar
              scrollY={ledgerScrollY}
              contentHeight={ledgerContentHeight}
              viewHeight={ledgerViewHeight}
              trackColor={c.scrollTrack}
              thumbColor={c.scrollThumb}
            />
          </>
        )}
      </View>
    </View>
  );
});
