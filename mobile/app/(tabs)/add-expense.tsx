import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Switch, Modal, Animated } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Category {
  id: number;
  name: string;
}

export default function AddExpenseScreen() {
  const { userId, theme } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'expense' | 'budget'>('expense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        tabBg: '#FFFFFF',
        accent: '#6366F1',
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
      tabBg: 'rgba(15, 23, 42, 0.8)',
      accent: '#6366F1',
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
        <ActivityIndicator size="large" color="#FF9F6E" />
      </View>
    );
  }

  return (
    <View style={[styles.screenWrapper, { backgroundColor: c.bg }]}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {/* Switch Form Toggle */}
        <View style={[styles.tabContainer, { backgroundColor: c.tabBg, borderColor: c.border }]}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'expense' && styles.activeTabButton]}
            onPress={() => setActiveTab('expense')}
          >
            <Text style={[styles.tabButtonText, { color: c.textMuted }, activeTab === 'expense' && styles.activeTabButtonText]}>Record Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'budget' && styles.activeTabButton]}
            onPress={() => setActiveTab('budget')}
          >
            <Text style={[styles.tabButtonText, { color: c.textMuted }, activeTab === 'budget' && styles.activeTabButtonText]}>Configure Budget</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'expense' ? (
          /* EXPENSE FORM */
          <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
            <Text style={[styles.label, { color: c.textMuted }]}>Description</Text>
            <View style={[styles.inputContainer, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              <TextInput
                style={[styles.input, { color: c.text }]}
                placeholder="e.g. Netflix Subscription, Grocery shopping"
                placeholderTextColor={isLight ? '#9ca3af' : '#4b5563'}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            <Text style={[styles.label, { color: c.textMuted }]}>Amount (₹)</Text>
            <View style={[styles.inputContainer, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              <TextInput
                style={[styles.input, { color: c.text }]}
                placeholder="0.00"
                placeholderTextColor={isLight ? '#9ca3af' : '#4b5563'}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.label, { color: c.textMuted }]}>Category</Text>
              <TouchableOpacity onPress={() => setShowNewCategoryModal(true)}>
                <Text style={styles.addCategoryLink}>+ Add Custom</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.selectorContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.selectorItem, { backgroundColor: c.inputBg, borderColor: c.border }, categoryId === cat.id && styles.selectorItemActive]}
                  onPress={() => setCategoryId(cat.id)}
                >
                  <Text style={[styles.selectorText, { color: c.textMuted }, categoryId === cat.id && styles.selectorTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Subscription Mode Switch */}
            <View style={[styles.switchRow, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              <View>
                <Text style={[styles.switchTitle, { color: c.text }]}>Repeat this expense repeatedly</Text>
                <Text style={[styles.switchSubtitle, { color: c.textMuted }]}>Creates a recurring subscription</Text>
              </View>
              <Switch
                value={isRecurring}
                onValueChange={setIsRecurring}
                trackColor={{ false: '#2d2d34', true: '#FF9F6E' }}
                thumbColor={isRecurring ? '#FF9F6E' : '#4b5563'}
              />
            </View>

            {/* Slideable Sub Form for Recurring */}
            {isRecurring && (
              <Animated.View style={[
                styles.subForm,
                {
                  opacity: subFormAnim,
                  transform: [{
                    translateY: subFormAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0]
                    })
                  }]
                }
              ]}>
                <Text style={[styles.label, { color: c.textMuted }]}>Billing Frequency</Text>
                <View style={styles.selectorContainer}>
                  {['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'].map((freq) => (
                    <TouchableOpacity
                      key={freq}
                      style={[styles.selectorItem, { backgroundColor: c.inputBg, borderColor: c.border }, frequency === freq && styles.selectorItemActive]}
                      onPress={() => setFrequency(freq)}
                    >
                      <Text style={[styles.selectorText, { color: c.textMuted }, frequency === freq && styles.selectorTextActive]}>
                        {freq === 'CUSTOM' ? 'Custom interval' : freq}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Custom days interval field */}
                {frequency === 'CUSTOM' && (
                  <Animated.View style={{
                    opacity: customIntervalAnim,
                    transform: [{
                      translateY: customIntervalAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-8, 0]
                      })
                    }]
                  }}>
                    <Text style={[styles.label, { color: c.textMuted }]}>Repeat every (days)</Text>
                    <View style={[styles.inputContainer, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                      <TextInput
                        style={[styles.input, { color: c.text }]}
                        placeholder="1"
                        placeholderTextColor={isLight ? '#9ca3af' : '#4b5563'}
                        keyboardType="number-pad"
                        value={intervalDays}
                        onChangeText={setIntervalDays}
                      />
                    </View>
                  </Animated.View>
                )}
              </Animated.View>
            )}

            <TouchableOpacity style={styles.submitButton} onPress={handleAddExpense} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#05070D" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isRecurring ? 'Save Subscription' : 'Record Expense'}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        ) : (
          /* BUDGET FORM */
          <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.label, { color: c.textMuted }]}>Target Category</Text>
              <TouchableOpacity onPress={() => setShowNewCategoryModal(true)}>
                <Text style={styles.addCategoryLink}>+ Add Custom</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.selectorContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.selectorItem, { backgroundColor: c.inputBg, borderColor: c.border }, budgetCategoryId === cat.id && styles.selectorItemActive]}
                  onPress={() => setBudgetCategoryId(cat.id)}
                >
                  <Text style={[styles.selectorText, { color: c.textMuted }, budgetCategoryId === cat.id && styles.selectorTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: c.textMuted }]}>Monthly Limit Amount (₹)</Text>
            <View style={[styles.inputContainer, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              <TextInput
                style={[styles.input, { color: c.text }]}
                placeholder="e.g. 5000"
                placeholderTextColor={isLight ? '#9ca3af' : '#4b5563'}
                keyboardType="decimal-pad"
                value={budgetLimit}
                onChangeText={setBudgetLimit}
              />
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleSetBudget} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#05070D" />
              ) : (
                <Text style={styles.submitButtonText}>Configure Budget</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      {/* Add Custom Category Modal Dialog */}
      <Modal
        visible={showNewCategoryModal}
        transparent={true}
        animationType="fade"
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
            <Text style={[styles.modalTitle, { color: c.text }]}>Add Category</Text>
            
            <Text style={[styles.modalLabel, { color: c.textMuted }]}>Category Name</Text>
            <View style={[styles.modalInputContainer, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              <TextInput
                style={[styles.modalInput, { color: c.text }]}
                placeholder="e.g. Subscriptions, Gifts"
                placeholderTextColor={isLight ? '#9ca3af' : '#4b5563'}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                autoFocus={true}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.cancelBtn, { backgroundColor: c.inputBg, borderColor: c.border }]}
                onPress={() => {
                  setNewCategoryName('');
                  setShowNewCategoryModal(false);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveBtn}
                onPress={handleCreateCategory}
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  tabContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 24,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTabButton: {
    backgroundColor: '#FF9F6E',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabButtonText: {
    color: '#05070D',
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addCategoryLink: {
    color: '#FF9F6E',
    fontSize: 13,
    fontWeight: '600',
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 12,
    height: 52,
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
  },
  selectorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  selectorItem: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  selectorItemActive: {
    backgroundColor: 'rgba(255, 159, 110, 0.1)',
    borderColor: '#FF9F6E',
  },
  selectorText: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectorTextActive: {
    color: '#FF9F6E',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  switchSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  subForm: {
    marginTop: 4,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#FF9F6E',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonText: {
    color: '#05070D',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderWidth: 1,
    borderRadius: 16,
    width: '100%',
    maxWidth: 320,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 13,
    marginBottom: 8,
  },
  modalInputContainer: {
    borderWidth: 1,
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalInput: {
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FF9F6E',
  },
  saveBtnText: {
    color: '#05070D',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
