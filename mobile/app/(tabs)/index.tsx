import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl, Alert, Share, Animated } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { AnimatedCard } from '../../components/AnimatedCard';
import { AnimatedButton } from '../../components/AnimatedButton';
import { AnimatedProgressBar } from '../../components/AnimatedProgressBar';
import { StaggeredView } from '../../components/StaggeredView';

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
        bg: '#F0F4F8',
        card: '#FFFFFF',
        border: '#D8E2F0',
        text: '#0A1628',
        textMuted: '#5B6880',
        inputBg: '#EAF0F8',
        inputBorder: '#C8D5E8',
        trackBg: '#D8E2F0',
        accent: '#00D4AA',
        accentDark: '#00B8D9',
        accentOrange: '#FF6B35',
        cardTotalBg: 'rgba(0, 212, 170, 0.08)',
        cardTotalBorder: 'rgba(0, 212, 170, 0.25)',
        cardCountBg: 'rgba(255, 107, 53, 0.08)',
        cardCountBorder: 'rgba(255, 107, 53, 0.25)',
      };
    }
    return {
      bg: '#080B12',
      card: 'rgba(13, 18, 30, 0.85)',
      border: 'rgba(255, 255, 255, 0.07)',
      text: '#F0F4FF',
      textMuted: '#8B97B0',
      inputBg: 'rgba(10, 16, 30, 0.7)',
      inputBorder: 'rgba(255, 255, 255, 0.08)',
      trackBg: '#0D1220',
      accent: '#00D4AA',
      accentDark: '#0EA5E9',
      accentOrange: '#FF6B35',
      cardTotalBg: 'rgba(0, 212, 170, 0.12)',
      cardTotalBorder: 'rgba(0, 212, 170, 0.3)',
      cardCountBg: 'rgba(255, 107, 53, 0.12)',
      cardCountBorder: 'rgba(255, 107, 53, 0.3)',
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
        <ActivityIndicator size="large" color={c.accent} />
        <Text style={[styles.loadingText, { color: c.textMuted }]}>Loading your finances...</Text>
      </View>
    );
  }

  const avgDaily = expenses.length > 0 ? totalSpent / 30 : 0;
  const topCategory = categoryList.length > 0 ? categoryList[0] : null;

  return (
    <View style={[styles.screenWrapper, { backgroundColor: c.bg }]}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
      >
        {/* ── TOP BAR ── */}
        <View style={styles.topBar}>
          <View style={styles.greetingGroup}>
            <View style={[styles.avatarBadge, { backgroundColor: c.accent }]}>
              <Text style={styles.avatarText}>{(userName || 'U').charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={[styles.greeting, { color: c.text }]}>Hello, {userName || 'Tracker'} 👋</Text>
              <Text style={[styles.dateLabel, { color: c.textMuted }]}>
                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.themeToggleButton, { borderColor: c.border, backgroundColor: c.inputBg }]} onPress={toggleTheme}>
            <Ionicons name={isLight ? 'moon' : 'sunny'} size={18} color={c.accent} />
          </TouchableOpacity>
        </View>

        {/* ── HERO BALANCE CARD ── */}
        <StaggeredView delay={100} direction="up">
          <View style={[styles.heroCard, { backgroundColor: c.card, borderColor: c.accent + '35' }]}>
            {/* Glow blob */}
            <View style={[styles.heroGlow, { backgroundColor: c.accent + '18' }]} />
            <View style={[styles.heroGlowOrange, { backgroundColor: c.accentOrange + '12' }]} />

            <View style={styles.heroCardTop}>
              <View>
                <Text style={[styles.heroCardLabel, { color: c.textMuted }]}>Total Spent This Month</Text>
                <Text style={[styles.heroCardAmount, { color: c.text }]}>₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </View>
              <View style={[styles.heroBadge, { backgroundColor: c.accent + '20', borderColor: c.accent + '50' }]}>
                <Ionicons name="analytics" size={20} color={c.accent} />
              </View>
            </View>

            {/* Quick stat pills */}
            <View style={styles.heroStats}>
              <View style={[styles.heroStatPill, { backgroundColor: c.accent + '15', borderColor: c.accent + '30' }]}>
                <Ionicons name="receipt-outline" size={13} color={c.accent} />
                <Text style={[styles.heroStatValue, { color: c.accent }]}>{expenses.length} expenses</Text>
              </View>
              <View style={[styles.heroStatPill, { backgroundColor: c.accentOrange + '15', borderColor: c.accentOrange + '30' }]}>
                <Ionicons name="flame-outline" size={13} color={c.accentOrange} />
                <Text style={[styles.heroStatValue, { color: c.accentOrange }]}>₹{avgDaily.toFixed(0)}/day avg</Text>
              </View>
              {topCategory && (
                <View style={[styles.heroStatPill, { backgroundColor: '#3B82F615', borderColor: '#3B82F630' }]}>
                  <Ionicons name="star-outline" size={13} color="#3B82F6" />
                  <Text style={[styles.heroStatValue, { color: '#3B82F6' }]}>{topCategory.name}</Text>
                </View>
              )}
            </View>
          </View>
        </StaggeredView>

        {/* ── SPEND BY CATEGORY ── */}
        {categoryList.length > 0 && (
          <StaggeredView delay={250} direction="up">
            <View style={styles.listHeader}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Spend by Category</Text>
              <View style={[styles.sectionBadge, { backgroundColor: c.accent + '18' }]}>
                <Text style={[styles.sectionBadgeText, { color: c.accent }]}>{categoryList.length} active</Text>
              </View>
            </View>
            <View style={[styles.sectionCard, { backgroundColor: c.card, borderColor: c.border }]}>
              {categoryList.map((item, index) => {
                const col = getCategoryColor(item.name);
                return (
                  <View key={index} style={[styles.categoryRow, index < categoryList.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border + '60' }]}>
                    <View style={styles.categoryHeader}>
                      <View style={styles.categoryNameCol}>
                        <View style={[styles.catIconBox, { backgroundColor: col + '20' }]}>
                          <Ionicons name={getCategoryIconName(item.name)} size={14} color={col} />
                        </View>
                        <Text style={[styles.categoryName, { color: c.text }]}>{item.name}</Text>
                      </View>
                      <View style={styles.categoryRightCol}>
                        <Text style={[styles.categoryAmount, { color: c.text }]}>₹{item.amount.toFixed(0)}</Text>
                        <Text style={[styles.categoryPct, { color: col }]}>{item.percentage.toFixed(0)}%</Text>
                      </View>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: c.trackBg }]}>
                      <Animated.View style={[
                        styles.progressBar,
                        {
                          backgroundColor: col,
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', `${item.percentage}%`]
                          }),
                          shadowColor: col,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.5,
                          shadowRadius: 4,
                          elevation: 3,
                        }
                      ]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </StaggeredView>
        )}

        {/* ── MONTHLY BUDGETS ── */}
        <StaggeredView delay={400} direction="up">
          <View style={styles.listHeader}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Monthly Budgets</Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/add-expense')}
              style={[styles.addBudgetBtn, { backgroundColor: c.accentOrange + '18', borderColor: c.accentOrange + '40' }]}
            >
              <Ionicons name="add" size={14} color={c.accentOrange} />
              <Text style={[styles.addBudgetText, { color: c.accentOrange }]}>Add</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.sectionCard, { backgroundColor: c.card, borderColor: c.border }]}>
            {budgets.length === 0 ? (
              <View style={styles.emptyBudgetBox}>
                <View style={[styles.emptyIconBox, { backgroundColor: c.accent + '15' }]}>
                  <Ionicons name="wallet-outline" size={30} color={c.accent} />
                </View>
                <Text style={[styles.emptyBudgetText, { color: c.textMuted }]}>No budgets configured yet</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/add-expense')} style={[styles.emptyActionBtn, { borderColor: c.accent + '50', backgroundColor: c.accent + '10' }]}>
                  <Text style={[styles.emptyLink, { color: c.accent }]}>+ Set up a Budget</Text>
                </TouchableOpacity>
              </View>
            ) : (
              budgets.map((item, index) => {
                const isOver = item.spentAmount > item.limitAmount;
                const pct = Math.min(item.percentageUsed, 100);
                const barColor = isOver ? '#FF4757' : pct > 80 ? '#FBBF24' : '#10D9A0';
                return (
                  <View key={index} style={[styles.budgetRow, index < budgets.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border + '60' }]}>
                    <View style={styles.categoryHeader}>
                      <View style={styles.categoryNameCol}>
                        <View style={[styles.catIconBox, { backgroundColor: barColor + '20' }]}>
                          <Ionicons name={isOver ? 'warning-outline' : 'checkmark-circle-outline'} size={14} color={barColor} />
                        </View>
                        <Text style={[styles.categoryName, { color: c.text }]}>{item.categoryName}</Text>
                      </View>
                      <View style={styles.categoryRightCol}>
                        <Text style={[styles.categoryAmount, { color: c.text }]}>₹{item.spentAmount.toFixed(0)}</Text>
                        <Text style={[styles.categoryPct, { color: barColor }]}>{pct.toFixed(0)}%</Text>
                      </View>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: c.trackBg }]}>
                      <Animated.View style={[
                        styles.progressBar,
                        {
                          backgroundColor: barColor,
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', `${pct}%`]
                          }),
                          shadowColor: barColor,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.4,
                          shadowRadius: 4,
                          elevation: 3,
                        }
                      ]} />
                    </View>
                    <Text style={[styles.budgetSubline, { color: c.textMuted }]}>₹{item.spentAmount.toFixed(0)} of ₹{item.limitAmount.toFixed(0)} limit</Text>
                  </View>
                );
              })
            )}
          </View>
        </StaggeredView>

        {/* Spending Trend (Up to 90 Days - Detailed) */}
        {trendData && (
          <StaggeredView delay={550} direction="up">
            <Text style={[styles.sectionTitle, { color: c.text }]}>Spending Trend</Text>
            <View style={[styles.sectionCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.trendLabel, { color: c.textMuted }]}>Up to last 90 days of spending</Text>
              <View style={styles.trendWrapper}>
                <Svg width="100%" height={trendData.height} viewBox={`0 0 ${trendData.width} ${trendData.height}`}>
                  <Defs>
                    <LinearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor="#00D4AA" stopOpacity={0.35} />
                      <Stop offset="100%" stopColor="#00D4AA" stopOpacity={0.0} />
                    </LinearGradient>
                  </Defs>
                  
                  {/* Grid Lines */}
                  <Line x1={trendData.paddingLeft} y1={15} x2={trendData.width - trendData.paddingRight} y2={15} stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)"} strokeWidth="1" />
                  <Line x1={trendData.paddingLeft} y1={60} x2={trendData.width - trendData.paddingRight} y2={60} stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)"} strokeWidth="1" />
                  <Line x1={trendData.paddingLeft} y1={115} x2={trendData.width - trendData.paddingRight} y2={115} stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)"} strokeWidth="1" />
                  
                  {/* Area fill */}
                  <Path d={trendData.fillPathData} fill="url(#trendAreaGrad)" />
                  
                  {/* Line path */}
                  <Path d={trendData.pathData} fill="none" stroke="#00D4AA" strokeWidth="2.5" />
                  
                  {/* Detailed Labels */}
                  <SvgText x={5} y={20} fill={c.textMuted} fontSize={10} fontWeight="bold">₹{trendData.maxVal.toFixed(0)}</SvgText>
                  <SvgText x={5} y={65} fill={c.textMuted} fontSize={10}>₹{(trendData.maxVal / 2).toFixed(0)}</SvgText>
                  <SvgText x={5} y={118} fill={c.textMuted} fontSize={10}>₹0</SvgText>

                  {/* Timeline labels at the bottom */}
                  <SvgText x={trendData.paddingLeft} y={135} fill={c.textMuted} fontSize={10}>{trendData.minDateStr}</SvgText>
                  <SvgText x={trendData.width - trendData.paddingRight - 35} y={135} fill={c.textMuted} fontSize={10} textAnchor="end">{trendData.maxDateStr}</SvgText>
                  
                  {/* Dots (only shown if date points are sparse) */}
                  {trendData.points.length <= 15 && trendData.points.map((p, idx) => (
                    <Circle key={idx} cx={p.x} cy={p.y} r={4} fill="#00D4AA" />
                  ))}
                </Svg>
              </View>
            </View>
          </StaggeredView>
        )}

        {/* Recent Expense Entries */}
        <StaggeredView delay={700} direction="up" style={{ marginBottom: 40 }}>
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

          {/* ── EXPENSES LIST ── */}
          {filteredExpenses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconBox, { backgroundColor: c.inputBg }]}>
                <Ionicons name="receipt-outline" size={36} color={c.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: c.text }]}>No expenses found</Text>
              <Text style={[styles.emptyText, { color: c.textMuted }]}>Add your first expense to get started</Text>
            </View>
          ) : (
            filteredExpenses.map((item, index) => {
              const col = getCategoryColor(item.categoryName);
              return (
              <Animated.View
                key={item.id}
                style={[
                  styles.transactionCard,
                  {
                    backgroundColor: c.card,
                    borderColor: c.border,
                    borderLeftColor: col,
                    borderLeftWidth: 3,
                    opacity: fadeAnim,
                    transform: [{
                      translateY: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20 + (index * 6), 0]
                      })
                    }]
                  }
                ]}
              >
                <View style={[styles.txIconCircle, { backgroundColor: col + '22' }]}>
                  <Ionicons name={getCategoryIconName(item.categoryName)} size={20} color={col} />
                </View>
                <View style={styles.txMain}>
                  <Text style={[styles.txTitle, { color: c.text }]}>{item.description}</Text>
                  <Text style={[styles.txMeta, { color: c.textMuted }]}>{item.categoryName} • {item.expenseDate}</Text>
                </View>
                <Text style={[styles.txAmount, { color: '#FF4757' }]}>-₹{Number(item.amount).toFixed(2)}</Text>
              </Animated.View>
              );
            })
          )}
        </StaggeredView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: { flex: 1 },
  container: { flex: 1 },
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  loadingText: {
    fontSize: 14, fontWeight: '500',
  },

  /* TOP BAR */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  greetingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#080B12',
  },
  greeting: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  dateLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  themeToggleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* HERO BALANCE CARD */
  heroCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    overflow: 'hidden',
    position: 'relative',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  heroGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -60,
    right: -40,
  },
  heroGlowOrange: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    bottom: -30,
    right: 60,
  },
  heroCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  heroCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroCardAmount: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  heroBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroStatValue: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* SECTIONS */
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
  },

  /* CATEGORY ROWS */
  categoryRow: {
    paddingVertical: 12,
  },
  budgetRow: {
    paddingVertical: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryNameCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  categoryPct: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  budgetSubline: {
    fontSize: 11,
    marginTop: 5,
  },
  alertText: { color: '#FF4757' },

  /* BUDGET ADD BUTTON */
  addBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  addBudgetText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* EMPTY STATES */
  emptyBudgetBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBudgetText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyActionBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  emptyLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
  },

  /* TREND */
  trendLabel: { fontSize: 12, marginBottom: 10 },
  trendWrapper: { alignItems: 'center', justifyContent: 'center' },

  /* SEARCH / FILTER */
  listActions: { flexDirection: 'row', gap: 12 },
  iconAction: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    height: 46,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  filtersPanel: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  filterBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  filterBtnActive: {
    backgroundColor: 'rgba(0,212,170,0.12)',
    borderColor: '#00D4AA',
  },
  filterBtnText: { fontSize: 12 },
  filterBtnTextActive: { color: '#00D4AA', fontWeight: '700' },

  /* TRANSACTION CARDS */
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  txIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  txMain: { flex: 1 },
  txTitle: { fontSize: 15, fontWeight: '600', marginBottom: 3 },
  txMeta: { fontSize: 12 },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },


});
