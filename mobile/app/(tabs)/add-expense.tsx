import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Switch, Modal, Animated } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { getCurrencySymbol } from '../../services/currency';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AnimatedButton } from '../../components/AnimatedButton';
import { AnimatedCard } from '../../components/AnimatedCard';

interface Category {
  id: number;
  name: string;
}

export default function AddExpenseScreen() {
  const { userId, theme, currency } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    editId?: string;
    editDescription?: string;
    editAmount?: string;
    editCategoryId?: string;
    editDate?: string;
  }>();
  const isEditMode = !!params.editId;
  const currSymbol = getCurrencySymbol(currency);
  const [activeTab, setActiveTab] = useState<'expense' | 'budget'>('expense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLight = theme === 'light';

  // Dynamic Theme Colors configuration
  const getThemeColors = () => {
    if (theme === 'light') {
      return {
        bg: '#EDEAE0',
        card: '#FCFBF6',
        border: '#DAD4C1',
        text: '#1E1B15',
        textMuted: '#6B6558',
        inputBg: '#F5F2E9',
        inputBorder: '#DAD4C1',
        tabBg: '#FCFBF6',
        accent: '#9C7623',
        orange: '#8F3327',
      };
    }
    return {
      bg: '#10120E',
      card: 'rgba(23, 26, 20, 0.9)',
      border: 'rgba(236, 231, 216, 0.08)',
      text: '#ECE7D8',
      textMuted: '#A8A395',
      inputBg: 'rgba(23, 26, 20, 0.7)',
      inputBorder: 'rgba(236, 231, 216, 0.08)',
      tabBg: 'rgba(23, 26, 20, 0.7)',
      accent: '#C79A3E',
      orange: '#A23E32',
    };
  };

  const c = getThemeColors();

  // Custom Category creation state
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Expense form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('MONTHLY');
  const [intervalDays, setIntervalDays] = useState('1');

  // Budget form state
  const [budgetCategoryId, setBudgetCategoryId] = useState<number | null>(null);
  const [budgetLimit, setBudgetLimit] = useState('');

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const subFormAnim = useRef(new Animated.Value(0)).current;
  const customIntervalAnim = useRef(new Animated.Value(0)).current;

  const loadCategories = async () => {
    if (!userId) return;
    try {
      const [globalCats, userCats] = await Promise.all([
        apiRequest('/categories/global'),
        apiRequest(`/categories/user/${userId}`)
      ]);
      const merged = [...(globalCats || []), ...(userCats || [])];
      
      // Deduplicate by name
      const uniqueCats: Category[] = [];
      const seen = new Set();
      merged.forEach(cat => {
        if (!seen.has(cat.name.toLowerCase())) {
          seen.add(cat.name.toLowerCase());
          uniqueCats.push(cat);
        }
      });

      setCategories(uniqueCats);
      if (uniqueCats.length > 0) {
        if (categoryId === null) setCategoryId(uniqueCats[0].id);
        if (budgetCategoryId === null) setBudgetCategoryId(uniqueCats[0].id);
      }

      // Fade in form
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (e) {
      console.error('Failed to load categories', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [userId]);

  // Pre-fill the form when opened in edit mode — runs after categories load
  // so it overrides the default "select first category" behavior above.
  useEffect(() => {
    if (isEditMode && !isLoading) {
      if (params.editDescription) setDescription(params.editDescription);
      if (params.editAmount) setAmount(params.editAmount);
      if (params.editCategoryId) setCategoryId(Number(params.editCategoryId));
      // Recurring options don't apply when editing an existing expense —
      // PUT /expenses/{id} only ever updates the expense itself.
      setIsRecurring(false);
    }
  }, [isEditMode, isLoading]);

  // Animate sub-form display on recurring toggle
  useEffect(() => {
    Animated.timing(subFormAnim, {
      toValue: isRecurring ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [isRecurring]);

  // Animate custom interval field display
  useEffect(() => {
    Animated.timing(customIntervalAnim, {
      toValue: frequency === 'CUSTOM' ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [frequency]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !userId) {
      Alert.alert('Error', 'Please enter a category name.');
      return;
    }
    setIsSubmitting(true);
    try {
      const newCat = await apiRequest(`/categories/user/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      Alert.alert('Success', `Category "${newCategoryName.trim()}" created!`);
      const targetName = newCategoryName.trim().toLowerCase();
      setNewCategoryName('');
      setShowNewCategoryModal(false);
      
      // Refresh list
      const [globalCats, userCats] = await Promise.all([
        apiRequest('/categories/global'),
        apiRequest(`/categories/user/${userId}`)
      ]);
      const merged = [...(globalCats || []), ...(userCats || [])];
      const uniqueCats: Category[] = [];
      const seen = new Set();
      merged.forEach(cat => {
        if (!seen.has(cat.name.toLowerCase())) {
          seen.add(cat.name.toLowerCase());
          uniqueCats.push(cat);
        }
      });
      setCategories(uniqueCats);

      // Auto-select the newly created category
      const found = uniqueCats.find(cat => cat.name.toLowerCase() === targetName);
      if (found) {
        setCategoryId(found.id);
        setBudgetCategoryId(found.id);
      }
    } catch (error: any) {
      Alert.alert('Failed', error.message || 'Could not create custom category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddExpense = async () => {
    if (!description || !amount || !categoryId || !userId) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    setIsSubmitting(true);
    try {
      const todayString = new Date().toISOString().split('T')[0];

      if (isEditMode) {
        // Update an existing expense — preserve its original date rather
        // than silently bumping it to today just because it was edited.
        await apiRequest(`/expenses/${params.editId}/user/${userId}`, {
          method: 'PUT',
          body: JSON.stringify({
            amount: parseFloat(amount),
            description: description.trim(),
            expenseDate: params.editDate || todayString,
            categoryId: categoryId,
          }),
        });
        Alert.alert('Success', 'Expense updated successfully!');
        router.push('/(tabs)');
        return;
      }

      if (isRecurring) {
        // Create a subscription
        const bodyData: any = {
          amount: parseFloat(amount),
          description: description.trim(),
          startDate: todayString,
          frequency: frequency,
          categoryId: categoryId,
        };
        if (frequency === 'CUSTOM') {
          const days = parseInt(intervalDays);
          if (isNaN(days) || days < 1) {
            Alert.alert('Error', 'Custom intervals must be at least one day.');
            setIsSubmitting(false);
            return;
          }
          bodyData.intervalDays = days;
        }

        await apiRequest(`/expenses/recurring/user/${userId}`, {
          method: 'POST',
          body: JSON.stringify(bodyData),
        });
        Alert.alert('Success', 'Recurring subscription configured successfully!');
      } else {
        // Create normal expense
        await apiRequest(`/expenses/user/${userId}`, {
          method: 'POST',
          body: JSON.stringify({
            amount: parseFloat(amount),
            description: description.trim(),
            expenseDate: todayString,
            categoryId: categoryId,
          }),
        });
        Alert.alert('Success', 'Expense recorded successfully!');
      }
      
      // Reset form & redirect
      setDescription('');
      setAmount('');
      setIsRecurring(false);
      setIntervalDays('1');
      router.push('/(tabs)');
    } catch (error: any) {
      Alert.alert('Failed', error.message || 'Could not save the expense entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetBudget = async () => {
    if (!budgetLimit || !budgetCategoryId || !userId) {
      Alert.alert('Error', 'Please enter a budget limit.');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiRequest(`/expenses/budget/user/${userId}`, {
        method: 'POST',
        body: JSON.stringify({
          categoryId: budgetCategoryId,
          limitAmount: parseFloat(budgetLimit),
        }),
      });
      Alert.alert('Success', 'Category budget configured successfully!');
      setBudgetLimit('');
      router.push('/(tabs)');
    } catch (error: any) {
      Alert.alert('Failed', error.message || 'Could not save budget configurations.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
        <Text style={[styles.loadingText, { color: c.textMuted }]}>Setting up form...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screenWrapper, { backgroundColor: c.bg }]}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── PAGE HEADER ── */}
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: c.text }]}>{isEditMode ? 'Edit Expense' : 'Add Record'}</Text>
          <Text style={[styles.pageSub, { color: c.textMuted }]}>
            {isEditMode ? 'Update the details below' : 'Log an expense or set a budget'}
          </Text>
        </View>

        {/* ── TAB SWITCHER (hidden while editing — editing is expense-only) ── */}
        {!isEditMode && (
        <View style={[styles.tabContainer, { backgroundColor: c.inputBg, borderColor: c.border }]}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'expense' && [styles.activeTabExpense]]}
            onPress={() => setActiveTab('expense')}
          >
            <Ionicons name="receipt-outline" size={15} color={activeTab === 'expense' ? '#10120E' : c.textMuted} />
            <Text style={[styles.tabButtonText, { color: activeTab === 'expense' ? '#10120E' : c.textMuted }]}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'budget' && [styles.activeTabBudget]]}
            onPress={() => setActiveTab('budget')}
          >
            <Ionicons name="pie-chart-outline" size={15} color={activeTab === 'budget' ? '#10120E' : c.textMuted} />
            <Text style={[styles.tabButtonText, { color: activeTab === 'budget' ? '#10120E' : c.textMuted }]}>Budget</Text>
          </TouchableOpacity>
        </View>
        )}

        {activeTab === 'expense' ? (
          /* EXPENSE FORM */
          <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>

            {/* Description */}
            <View style={[styles.formSection, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.formSectionHeader}>
                <View style={[styles.formSectionIcon, { backgroundColor: '#C79A3E18' }]}>
                  <Ionicons name="pencil-outline" size={14} color="#C79A3E" />
                </View>
                <Text style={[styles.formSectionLabel, { color: c.textMuted }]}>Description</Text>
              </View>
              <TextInput
                style={[styles.bigInput, { color: c.text, borderBottomColor: c.border }]}
                placeholder="e.g. Netflix, Grocery run, Fuel top-up"
                placeholderTextColor={isLight ? '#A8A395' : '#2A2E22'}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* Amount */}
            <View style={[styles.formSection, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.formSectionHeader}>
                <View style={[styles.formSectionIcon, { backgroundColor: '#A23E3218' }]}>
                  <Ionicons name="cash-outline" size={14} color="#A23E32" />
                </View>
                <Text style={[styles.formSectionLabel, { color: c.textMuted }]}>Amount</Text>
              </View>
              <View style={styles.amountRow}>
                <Text style={[styles.currencySymbol, { color: c.accent }]}>{currSymbol}</Text>
                <TextInput
                  style={[styles.amountInput, { color: c.text }]}
                  placeholder="0.00"
                  placeholderTextColor={isLight ? '#A8A395' : '#2A2E22'}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
            </View>

            {/* Category */}
            <View style={[styles.formSection, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.formSectionHeader}>
                <View style={[styles.formSectionIcon, { backgroundColor: '#4C7A7818' }]}>
                  <Ionicons name="grid-outline" size={14} color="#4C7A78" />
                </View>
                <Text style={[styles.formSectionLabel, { color: c.textMuted }]}>Category</Text>
                <TouchableOpacity
                  onPress={() => setShowNewCategoryModal(true)}
                  style={[styles.addCatBtn, { backgroundColor: c.accent + '18', borderColor: c.accent + '40' }]}
                >
                  <Ionicons name="add" size={12} color={c.accent} />
                  <Text style={[styles.addCatText, { color: c.accent }]}>New</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.categoryChips}>
                {categories.map((cat) => {
                  const isActive = categoryId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        { backgroundColor: isActive ? c.accent : c.inputBg, borderColor: isActive ? c.accent : c.border },
                      ]}
                      onPress={() => setCategoryId(cat.id)}
                    >
                      <Text style={[styles.categoryChipText, { color: isActive ? '#10120E' : c.textMuted }]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Recurring Toggle (hidden while editing an existing expense) */}
            {!isEditMode && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsRecurring(!isRecurring)}
              style={[
                styles.recurringRow,
                { backgroundColor: isRecurring ? c.accent + '18' : c.card, borderColor: isRecurring ? c.accent : c.border }
              ]}
            >
              <View style={[styles.recurringIcon, { backgroundColor: isRecurring ? c.accent : c.accent + '18' }]}>
                <Ionicons name="repeat" size={18} color={isRecurring ? '#10120E' : c.accent} />
              </View>
              <View style={styles.recurringText}>
                <Text style={[styles.recurringTitle, { color: c.text }]}>Make Recurring</Text>
                <Text style={[styles.recurringSub, { color: c.textMuted }]}>
                  {isRecurring ? 'Tracked as subscription' : 'One-time expense record'}
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: isRecurring ? c.accent : c.inputBg, borderColor: isRecurring ? c.accent : c.border }]}>
                <Text style={[styles.statusPillText, { color: isRecurring ? '#10120E' : c.textMuted }]}>
                  {isRecurring ? 'ON' : 'OFF'}
                </Text>
              </View>
            </TouchableOpacity>
            )}

            {/* Frequency selector (if recurring) */}
            {isRecurring && (
              <Animated.View style={[styles.subForm, { opacity: subFormAnim, transform: [{ translateY: subFormAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}>
                <View style={[styles.formSection, { backgroundColor: c.card, borderColor: c.border }]}>
                  <Text style={[styles.formSectionLabel, { color: c.textMuted, marginBottom: 12 }]}>Billing Frequency</Text>
                  <View style={styles.frequencyChips}>
                    {['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'].map((freq) => {
                      const isActive = frequency === freq;
                      const freqColor = { DAILY: '#A23E32', WEEKLY: '#C9932E', MONTHLY: '#C79A3E', YEARLY: '#4C7A78', CUSTOM: '#C79A3E' }[freq] || '#C79A3E';
                      return (
                        <TouchableOpacity
                          key={freq}
                          style={[
                            styles.freqChip,
                            { backgroundColor: isActive ? freqColor + '20' : c.inputBg, borderColor: isActive ? freqColor : c.border },
                          ]}
                          onPress={() => setFrequency(freq)}
                        >
                          <Text style={[styles.freqChipText, { color: isActive ? freqColor : c.textMuted }]}>
                            {freq === 'CUSTOM' ? 'Custom' : freq}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {frequency === 'CUSTOM' && (
                    <Animated.View style={{ opacity: customIntervalAnim }}>
                      <Text style={[styles.formSectionLabel, { color: c.textMuted, marginTop: 12, marginBottom: 8 }]}>Repeat every (days)</Text>
                      <View style={[styles.inputWrapper, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                        <TextInput
                          style={[styles.inputField, { color: c.text }]}
                          placeholder="e.g. 14"
                          placeholderTextColor={isLight ? '#A8A395' : '#2A2E22'}
                          keyboardType="number-pad"
                          value={intervalDays}
                          onChangeText={setIntervalDays}
                        />
                        <Text style={[styles.inputSuffix, { color: c.textMuted }]}>days</Text>
                      </View>
                    </Animated.View>
                  )}
                </View>
              </Animated.View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: c.accent, opacity: isSubmitting ? 0.7 : 1 }]}
              onPress={handleAddExpense}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#10120E" size="small" />
              ) : (
                <View style={styles.submitBtnInner}>
                  <Ionicons name={isEditMode ? 'checkmark-circle' : isRecurring ? 'repeat' : 'add-circle'} size={20} color="#10120E" />
                  <Text style={styles.submitBtnText}>
                    {isEditMode ? 'Update Expense' : isRecurring ? 'Save Subscription' : 'Record Expense'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        ) : (
          /* BUDGET FORM */
          <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
            <View style={[styles.formSection, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.formSectionHeader}>
                <View style={[styles.formSectionIcon, { backgroundColor: '#4C7A7818' }]}>
                  <Ionicons name="grid-outline" size={14} color="#4C7A78" />
                </View>
                <Text style={[styles.formSectionLabel, { color: c.textMuted }]}>Target Category</Text>
                <TouchableOpacity
                  onPress={() => setShowNewCategoryModal(true)}
                  style={[styles.addCatBtn, { backgroundColor: c.accent + '18', borderColor: c.accent + '40' }]}
                >
                  <Ionicons name="add" size={12} color={c.accent} />
                  <Text style={[styles.addCatText, { color: c.accent }]}>New</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.categoryChips}>
                {categories.map((cat) => {
                  const isActive = budgetCategoryId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        { backgroundColor: isActive ? c.orange : c.inputBg, borderColor: isActive ? c.orange : c.border },
                      ]}
                      onPress={() => setBudgetCategoryId(cat.id)}
                    >
                      <Text style={[styles.categoryChipText, { color: isActive ? '#10120E' : c.textMuted }]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.formSection, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.formSectionHeader}>
                <View style={[styles.formSectionIcon, { backgroundColor: '#C9932E18' }]}>
                  <Ionicons name="speedometer-outline" size={14} color="#C9932E" />
                </View>
                <Text style={[styles.formSectionLabel, { color: c.textMuted }]}>Monthly Limit</Text>
              </View>
              <View style={styles.amountRow}>
                <Text style={[styles.currencySymbol, { color: c.orange }]}>{currSymbol}</Text>
                <TextInput
                  style={[styles.amountInput, { color: c.text }]}
                  placeholder="0"
                  placeholderTextColor={isLight ? '#A8A395' : '#2A2E22'}
                  keyboardType="decimal-pad"
                  value={budgetLimit}
                  onChangeText={setBudgetLimit}
                />
                <Text style={[styles.inputSuffix, { color: c.textMuted }]}>/month</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: c.orange, opacity: isSubmitting ? 0.7 : 1 }]}
              onPress={handleSetBudget}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#10120E" size="small" />
              ) : (
                <View style={styles.submitBtnInner}>
                  <Ionicons name="pie-chart" size={20} color="#10120E" />
                  <Text style={styles.submitBtnText}>Set Budget Limit</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      {/* ── NEW CATEGORY MODAL ── */}
      <Modal
        visible={showNewCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNewCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowNewCategoryModal(false)}
        >
          <TouchableOpacity
            style={[styles.modalContent, { backgroundColor: c.card, borderColor: c.border }]}
            activeOpacity={1}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconBox, { backgroundColor: c.accent + '15' }]}>
                <Ionicons name="grid-outline" size={20} color={c.accent} />
              </View>
              <Text style={[styles.modalTitle, { color: c.text }]}>New Category</Text>
            </View>

            <View style={[styles.inputWrapper, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              <Ionicons name="bag-handle-outline" size={16} color={c.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.inputField, { color: c.text, flex: 1 }]}
                placeholder="e.g. Subscriptions, Gifts"
                placeholderTextColor={isLight ? '#A8A395' : '#2A2E22'}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                autoFocus={true}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: c.border, backgroundColor: c.inputBg }]}
                onPress={() => { setNewCategoryName(''); setShowNewCategoryModal(false); }}
              >
                <Text style={[styles.modalCancelText, { color: c.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: c.accent }]}
                onPress={handleCreateCategory}
              >
                <Text style={styles.modalSaveText}>Create</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: { flex: 1 },
  container: { flex: 1 },
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  loadingText: { fontSize: 14, fontWeight: '500' },

  /* PAGE HEADER */
  pageHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  pageSub: {
    fontSize: 13,
    marginTop: 3,
  },

  /* TAB SWITCHER */
  tabContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    gap: 6,
  },
  activeTabExpense: {
    backgroundColor: '#C79A3E',
  },
  activeTabBudget: {
    backgroundColor: '#A23E32',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* FORM CONTAINER */
  formContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },

  /* FORM SECTION CARD */
  formSection: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  formSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  formSectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flex: 1,
  },
  addCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addCatText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* BIG TEXT INPUT */
  bigInput: {
    fontSize: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },

  /* AMOUNT ROW */
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '900',
  },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  inputSuffix: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* CATEGORY CHIPS */
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* RECURRING TOGGLE */
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  recurringIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recurringText: { flex: 1 },
  recurringTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  recurringSub: {
    fontSize: 12,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  /* FREQUENCY */
  subForm: { gap: 0 },
  frequencyChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  freqChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  freqChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
  },

  /* SUBMIT */
  submitBtn: {
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  submitBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10120E',
    letterSpacing: 0.3,
  },

  /* MODAL */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  modalIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#C79A3E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10120E',
  },
});
