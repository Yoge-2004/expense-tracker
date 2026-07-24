import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl, Alert, Share, Animated } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';

interface Expense {
  id: number;
  description: string;
  amount: number;
  expenseDate: string;
  categoryName: string;
}

interface BudgetStatus {
  categoryName: string;
  limitAmount: number;
  spentAmount: number;
  percentageUsed: number;
  status: string;
}

interface Category {
  id: number;
  name: string;
}

export default function DashboardScreen() {
  const { userId, userName, theme, toggleTheme } = useAuth();
  const router = useRouter();

  const isLight = theme === 'light';

  // Dynamic Theme Colors configuration
  const getThemeColors = () => {
    if (theme === 'light') {
      return {
        bg: '#F8FAFC',
        card: '#FFFFFF',
        border: '#E2E8F0',
        text: '#0F172A',
        textMuted: '#64748B',
        inputBg: '#F1F5F9',
        inputBorder: '#CBD5E1',
        trackBg: '#E2E8F0',
        accent: '#6366F1',
        accentDark: '#4F46E5',
        cardTotalBg: 'rgba(99, 102, 241, 0.08)',
        cardTotalBorder: 'rgba(99, 102, 241, 0.25)',
        cardCountBg: 'rgba(16, 185, 129, 0.08)',
        cardCountBorder: 'rgba(16, 185, 129, 0.25)',
      };
    }
    return {
      bg: '#090D16',
      card: 'rgba(17, 24, 39, 0.85)',
      border: 'rgba(255, 255, 255, 0.08)',
      text: '#F8FAFC',
      textMuted: '#94A3B8',
      inputBg: 'rgba(15, 23, 42, 0.6)',
      inputBorder: 'rgba(255, 255, 255, 0.1)',
      trackBg: '#0F172A',
      accent: '#6366F1',
      accentDark: '#8B5CF6',
      cardTotalBg: 'rgba(99, 102, 241, 0.12)',
      cardTotalBorder: 'rgba(99, 102, 241, 0.3)',
      cardCountBg: 'rgba(16, 185, 129, 0.12)',
      cardCountBorder: 'rgba(16, 185, 129, 0.3)',
    };
  };

  const c = getThemeColors();

  // Data state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters and Actions UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortOption, setSortOption] = useState('date-desc');
  const [showFilters, setShowFilters] = useState(false);

  // Animated values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const filterAnim = useRef(new Animated.Value(0)).current;

  const fetchData = async () => {
    if (!userId) return;
    try {
      const [expensesData, budgetsData, categoriesData] = await Promise.all([
        apiRequest(`/expenses/user/${userId}`),
        apiRequest(`/expenses/budget/status/user/${userId}`),
        apiRequest(`/categories/global`),
      ]);
      setExpenses(expensesData || []);
      setBudgets(budgetsData || []);
      setCategories(categoriesData || []);

      // Trigger animations on data fetch
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: false,
        })
      ]).start();
    } catch (e) {
      console.error('Failed to load metrics', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      progressAnim.setValue(0);
      fetchData();
    }, [userId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    progressAnim.setValue(0);
    fetchData();
  };

  useEffect(() => {
    Animated.timing(filterAnim, {
      toValue: showFilters ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [showFilters]);

  // CSV Export Utility
  const handleExportCSV = async () => {
    if (expenses.length === 0) {
      Alert.alert('No Data', 'There are no expenses to export.');
      return;
    }
    try {
      const csvHeader = 'ID,Description,Amount,Date,Category\n';
      const csvRows = filteredExpenses.map(e => 
        `${e.id},"${e.description.replace(/"/g, '""')}",${e.amount},${e.expenseDate},"${e.categoryName}"`
      ).join('\n');
      const csvContent = csvHeader + csvRows;

      await Share.share({
        title: 'Expense Export',
        message: csvContent,
      });
    } catch (error) {
      Alert.alert('Export Failed', 'Could not share the export content.');
    }
  };

  // Calculations for graphs
  const totalSpent = expenses.reduce((sum, item) => sum + Number(item.amount), 0);

  // Group by category
  const categorySummary = expenses.reduce((acc: { [key: string]: number }, item) => {
    acc[item.categoryName] = (acc[item.categoryName] || 0) + Number(item.amount);
    return acc;
  }, {});

  const categoryList = Object.keys(categorySummary).map(cat => ({
    name: cat,
    amount: categorySummary[cat],
    percentage: totalSpent > 0 ? (categorySummary[cat] / totalSpent) * 100 : 0,
  })).sort((a, b) => b.amount - a.amount);

  const categoryColors: { [key: string]: string } = {
    food: '#ef4444',
    transport: '#3b82f6',
    utilities: '#f59e0b',
    entertainment: '#ec4899',
    health: '#10b981',
  };

  const getCategoryColor = (name: string) => categoryColors[name.toLowerCase()] || '#8b5cf6';

  const getCategoryIconName = (name: string): any => {
    const norm = name.toLowerCase();
    if (norm.includes('food') || norm.includes('dining')) return 'fast-food';
    if (norm.includes('transport') || norm.includes('travel') || norm.includes('fuel')) return 'car';
    if (norm.includes('utilities') || norm.includes('electricity') || norm.includes('water') || norm.includes('bill')) return 'flash';
    if (norm.includes('entertainment') || norm.includes('movie') || norm.includes('game') || norm.includes('fun')) return 'game-controller';
    if (norm.includes('health') || norm.includes('medical') || norm.includes('fitness')) return 'medical';
    return 'wallet';
  };

  // Spending Trend SVG Points calculation (Last 90 days)
  const getTrendSvgData = () => {
    const dailySpends: { [key: string]: number } = {};
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    expenses.forEach(e => {
      const eDate = new Date(e.expenseDate);
      if (eDate >= ninetyDaysAgo) {
        dailySpends[e.expenseDate] = (dailySpends[e.expenseDate] || 0) + Number(e.amount);
      }
    });

    const sortedDates = Object.keys(dailySpends).sort();
    const dataPoints = sortedDates.map(date => dailySpends[date]);

    if (dataPoints.length < 2) return null;

    const maxVal = Math.max(...dataPoints, 100);
    const width = 320;
    const height = 140;
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 25;

    const points = dataPoints.map((val, index) => {
      const x = paddingLeft + (index / (dataPoints.length - 1)) * (width - paddingLeft - paddingRight);
      const y = height - paddingBottom - (val / maxVal) * (height - paddingTop - paddingBottom);
      return { x, y, val, date: sortedDates[index] };
    });

    const pathData = points.reduce((acc, p, i) => 
      i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, ''
    );

    // Compute area background fill coordinate path
    const fillPathData = `${pathData} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

    const minDateStr = new Date(sortedDates[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const maxDateStr = new Date(sortedDates[sortedDates.length - 1]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    return { points, pathData, fillPathData, width, height, maxVal, minDateStr, maxDateStr, paddingLeft, paddingRight, paddingTop, paddingBottom };
  };

  const trendData = getTrendSvgData();

  // Filters logic
  const filteredExpenses = expenses
    .filter(e => {
      const matchSearch = e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.categoryName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = selectedCategory === 'all' || e.categoryName === selectedCategory;
      return matchSearch && matchCategory;
    })
    .sort((a, b) => {
      if (sortOption === 'date-desc') return new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime();
      if (sortOption === 'date-asc') return new Date(a.expenseDate).getTime() - new Date(b.expenseDate).getTime();
      if (sortOption === 'amount-desc') return b.amount - a.amount;
      if (sortOption === 'amount-asc') return a.amount - b.amount;
      return 0;
    });

  if (isLoading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color="#FF9F6E" />
      </View>
    );
  }

  return (
    <View style={[styles.screenWrapper, { backgroundColor: c.bg }]}>
      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF9F6E" />}
      >
        {/* Header Profile Panel */}
        <View style={styles.topBar}>
          <View>
            <Text style={[styles.greeting, { color: c.text }]}>Hello {userName || 'Tracker'},</Text>
            <Text style={[styles.dateLabel, { color: c.textMuted }]}>
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity style={[styles.themeToggleButton, { borderColor: c.border }]} onPress={toggleTheme}>
            <Ionicons name={isLight ? "moon" : "sunny"} size={20} color={c.accent} />
          </TouchableOpacity>
        </View>

        {/* Animated Main Metric Cards */}
        <Animated.View style={[styles.metricsContainer, { opacity: fadeAnim }]}>
          <View style={[styles.card, { backgroundColor: c.cardTotalBg, borderColor: c.cardTotalBorder }]}>
            <Text style={[styles.cardLabel, { color: isLight ? c.accentDark : c.textMuted }]}>Total Spent</Text>
            <Text style={[styles.totalAmount, { color: isLight ? c.accentDark : c.text }]}>₹{totalSpent.toFixed(2)}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: c.cardCountBg, borderColor: c.cardCountBorder }]}>
            <Text style={[styles.cardLabel, { color: isLight ? '#047857' : c.textMuted }]}>Expenses Count</Text>
            <Text style={[styles.totalAmount, { color: isLight ? '#047857' : c.text }]}>{expenses.length}</Text>
          </View>
        </Animated.View>

        {/* Categories Analysis Chart */}
        {categoryList.length > 0 && (
          <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Spend by Category</Text>
            <View style={[styles.sectionCard, { backgroundColor: c.card, borderColor: c.border }]}>
              {categoryList.map((item, index) => (
                <View key={index} style={styles.categoryRow}>
                  <View style={styles.categoryHeader}>
                    <View style={styles.categoryNameCol}>
                      <View style={[styles.dot, { backgroundColor: getCategoryColor(item.name) }]} />
                      <Text style={[styles.categoryName, { color: c.text }]}>{item.name}</Text>
                    </View>
                    <Text style={[styles.categoryAmount, { color: c.textMuted }]}>₹{item.amount.toFixed(2)} ({item.percentage.toFixed(0)}%)</Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: c.trackBg }]}>
                    <Animated.View style={[
                      styles.progressBar, 
                      { 
                        backgroundColor: getCategoryColor(item.name),
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', `${item.percentage}%`]
                        })
                      }
                    ]} />
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Monthly Budgets (Always visible) */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <View style={styles.listHeader}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Monthly Budgets</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/add-expense')} style={styles.inlineAddBtn}>
              <Ionicons name="add-circle" size={20} color="#FF9F6E" />
            </TouchableOpacity>
          </View>
          <View style={[styles.sectionCard, { backgroundColor: c.card, borderColor: c.border }]}>
            {budgets.length === 0 ? (
              <View style={styles.emptyBudgetBox}>
                <Ionicons name="checkbox-outline" size={28} color={c.textMuted} />
                <Text style={[styles.emptyBudgetText, { color: c.textMuted }]}>No budgets configured yet.</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/add-expense')}>
                  <Text style={styles.emptyLink}>Set up a Budget</Text>
                </TouchableOpacity>
              </View>
            ) : (
              budgets.map((item, index) => {
                const isOver = item.spentAmount > item.limitAmount;
                return (
                  <View key={index} style={styles.categoryRow}>
                    <View style={styles.categoryHeader}>
                      <Text style={[styles.categoryName, { color: c.text }]}>{item.categoryName} Budget</Text>
                      <Text style={[styles.categoryAmount, { color: c.textMuted }, isOver && styles.alertText]}>
                        ₹{item.spentAmount.toFixed(0)} / ₹{item.limitAmount.toFixed(0)}
                      </Text>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: c.trackBg }]}>
                      <Animated.View style={[
                        styles.progressBar, 
                        { 
                          backgroundColor: isOver ? '#FF6B50' : '#10b981',
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', `${Math.min(item.percentageUsed, 100)}%`]
                          })
                        }
                      ]} />
                    </View>
                    <Text style={styles.budgetPercentText}>{item.percentageUsed.toFixed(0)}% used</Text>
                  </View>
                );
              })
            )}
          </View>
        </Animated.View>

        {/* Spending Trend (Up to 90 Days - Detailed) */}
        {trendData && (
          <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Spending Trend</Text>
            <View style={[styles.sectionCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.trendLabel, { color: c.textMuted }]}>Up to last 90 days of spending</Text>
              <View style={styles.trendWrapper}>
                <Svg width="100%" height={trendData.height} viewBox={`0 0 ${trendData.width} ${trendData.height}`}>
                  <Defs>
                    <LinearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor="#FF9F6E" stopOpacity={0.35} />
                      <Stop offset="100%" stopColor="#FF9F6E" stopOpacity={0.0} />
                    </LinearGradient>
                  </Defs>
                  
                  {/* Grid Lines */}
                  <Line x1={trendData.paddingLeft} y1={15} x2={trendData.width - trendData.paddingRight} y2={15} stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)"} strokeWidth="1" />
                  <Line x1={trendData.paddingLeft} y1={60} x2={trendData.width - trendData.paddingRight} y2={60} stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)"} strokeWidth="1" />
                  <Line x1={trendData.paddingLeft} y1={115} x2={trendData.width - trendData.paddingRight} y2={115} stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)"} strokeWidth="1" />
                  
                  {/* Area fill */}
                  <Path d={trendData.fillPathData} fill="url(#trendAreaGrad)" />
                  
                  {/* Line path */}
                  <Path d={trendData.pathData} fill="none" stroke="#FF9F6E" strokeWidth="2.5" />
                  
                  {/* Detailed Labels */}
                  <SvgText x={5} y={20} fill={c.textMuted} fontSize={10} fontWeight="bold">₹{trendData.maxVal.toFixed(0)}</SvgText>
                  <SvgText x={5} y={65} fill={c.textMuted} fontSize={10}>₹{(trendData.maxVal / 2).toFixed(0)}</SvgText>
                  <SvgText x={5} y={118} fill={c.textMuted} fontSize={10}>₹0</SvgText>

                  {/* Timeline labels at the bottom */}
                  <SvgText x={trendData.paddingLeft} y={135} fill={c.textMuted} fontSize={10}>{trendData.minDateStr}</SvgText>
                  <SvgText x={trendData.width - trendData.paddingRight - 35} y={135} fill={c.textMuted} fontSize={10} textAnchor="end">{trendData.maxDateStr}</SvgText>
                  
                  {/* Dots (only shown if date points are sparse) */}
                  {trendData.points.length <= 15 && trendData.points.map((p, idx) => (
                    <Circle key={idx} cx={p.x} cy={p.y} r={4} fill="#FF9F6E" />
                  ))}
                </Svg>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Recent Expense Entries */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          <View style={styles.listHeader}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Recent Expenses</Text>
            <View style={styles.listActions}>
              <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={[styles.iconAction, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <Ionicons name="filter" size={18} color={c.accent} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleExportCSV} style={[styles.iconAction, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <Ionicons name="download-outline" size={18} color={c.accent} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search bar */}
          <View style={[styles.searchContainer, { backgroundColor: c.inputBg, borderColor: c.border }]}>
            <Ionicons name="search-outline" size={18} color={c.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: c.text }]}
              placeholder="Search expenses..."
              placeholderTextColor={isLight ? '#9ca3af' : '#64748B'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Expandable filters panel */}
          {showFilters && (
            <Animated.View style={[
              styles.filtersPanel,
              {
                backgroundColor: c.card,
                borderColor: c.border,
                opacity: filterAnim,
                transform: [{
                  translateY: filterAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0]
                  })
                }]
              }
            ]}>
              <Text style={[styles.filterLabel, { color: c.textMuted }]}>Category</Text>
              <View style={styles.filterRow}>
                <TouchableOpacity 
                  style={[styles.filterBtn, { backgroundColor: c.inputBg, borderColor: c.border }, selectedCategory === 'all' && styles.filterBtnActive]}
                  onPress={() => setSelectedCategory('all')}
                >
                  <Text style={[styles.filterBtnText, { color: c.textMuted }, selectedCategory === 'all' && styles.filterBtnTextActive]}>All</Text>
                </TouchableOpacity>
                {categories.map(cItem => (
                  <TouchableOpacity 
                    key={cItem.id}
                    style={[styles.filterBtn, { backgroundColor: c.inputBg, borderColor: c.border }, selectedCategory === cItem.name && styles.filterBtnActive]}
                    onPress={() => setSelectedCategory(cItem.name)}
                  >
                    <Text style={[styles.filterBtnText, { color: c.textMuted }, selectedCategory === cItem.name && styles.filterBtnTextActive]}>{cItem.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.filterLabel, { color: c.textMuted }]}>Sort By</Text>
              <View style={styles.filterRow}>
                <TouchableOpacity 
                  style={[styles.filterBtn, { backgroundColor: c.inputBg, borderColor: c.border }, sortOption === 'date-desc' && styles.filterBtnActive]}
                  onPress={() => setSortOption('date-desc')}
                >
                  <Text style={[styles.filterBtnText, { color: c.textMuted }, sortOption === 'date-desc' && styles.filterBtnTextActive]}>Newest</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.filterBtn, { backgroundColor: c.inputBg, borderColor: c.border }, sortOption === 'date-asc' && styles.filterBtnActive]}
                  onPress={() => setSortOption('date-asc')}
                >
                  <Text style={[styles.filterBtnText, { color: c.textMuted }, sortOption === 'date-asc' && styles.filterBtnTextActive]}>Oldest</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.filterBtn, { backgroundColor: c.inputBg, borderColor: c.border }, sortOption === 'amount-desc' && styles.filterBtnActive]}
                  onPress={() => setSortOption('amount-desc')}
                >
                  <Text style={[styles.filterBtnText, { color: c.textMuted }, sortOption === 'amount-desc' && styles.filterBtnTextActive]}>High to Low</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* Expenses List with category-specific icons */}
          {filteredExpenses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="card-outline" size={48} color={c.textMuted} />
              <Text style={[styles.emptyText, { color: c.textMuted }]}>No matches found</Text>
            </View>
          ) : (
            filteredExpenses.map((item) => (
              <View key={item.id} style={[styles.transactionCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <View style={[styles.txIconCircle, { backgroundColor: getCategoryColor(item.categoryName) + '15' }]}>
                  <Ionicons name={getCategoryIconName(item.categoryName)} size={20} color={getCategoryColor(item.categoryName)} />
                </View>
                <View style={styles.txMain}>
                  <Text style={[styles.txTitle, { color: c.text }]}>{item.description}</Text>
                  <Text style={[styles.txMeta, { color: c.textMuted }]}>{item.categoryName} • {item.expenseDate}</Text>
                </View>
                <Text style={styles.txAmount}>-₹{Number(item.amount).toFixed(2)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  dateLabel: {
    fontSize: 14,
    marginTop: 2,
  },
  themeToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  metricsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 16,
  },
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  categoryRow: {
    marginBottom: 14,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryNameCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoryAmount: {
    fontSize: 13,
    fontWeight: '500',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  budgetPercentText: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'right',
  },
  alertText: {
    color: '#FF6B50',
  },
  emptyBudgetBox: {
    alignItems: 'center',
    paddingVertical: 12,
    justifyContent: 'center',
  },
  emptyBudgetText: {
    fontSize: 13,
    marginTop: 6,
    marginBottom: 6,
  },
  emptyLink: {
    color: '#6366F1',
    fontSize: 13,
    fontWeight: 'bold',
  },
  trendLabel: {
    fontSize: 12,
    marginBottom: 10,
  },
  trendWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inlineAddBtn: {
    padding: 2,
  },
  listActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconAction: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  filtersPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  filterBtn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  filterBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderColor: '#6366F1',
  },
  filterBtnText: {
    fontSize: 11,
  },
  filterBtnTextActive: {
    color: '#6366F1',
    fontWeight: '600',
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  txIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txMain: {
    flex: 1,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  txMeta: {
    fontSize: 12,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B50',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 10,
  },
});
