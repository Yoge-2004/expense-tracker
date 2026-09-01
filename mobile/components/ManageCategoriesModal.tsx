/**
 * @file ManageCategoriesModal.tsx
 * @description Bottom-sheet modal for custom category creation and safe deletion.
 * Protects against accidental deletion of categories currently tied to existing
 * transactions or recurring subscriptions.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { Colors, getCategoryEmoji } from '../constants/theme';
import { apiRequest } from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface Category {
  id: number;
  name: string;
  isCustom?: boolean;
}

interface ManageCategoriesModalProps {
  /** Controls modal visibility. */
  visible: boolean;
  /** Invoked when dismissing the modal. */
  onClose: () => void;
  /** Callback fired after adding or deleting a category to refresh parent state. */
  onCategoriesUpdated: () => void;
}

/**
 * Interactive category management modal.
 */
export const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({
  visible,
  onClose,
  onCategoriesUpdated,
}) => {
  const { userId, theme } = useAuth();
  const { showAlert } = useAlert();
  const c = Colors[theme];

  const [categories, setCategories] = useState<Category[]>([]);
  const [usedIds, setUsedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creating, setCreating] = useState(false);

  /**
   * Fetches user custom categories and computes active usage across expenses & recurring items.
   */
  const fetchCategoriesAndUsage = async () => {
    if (!userId || !visible) return;
    setLoading(true);
    try {
      const [allCats, expenses, recurring] = await Promise.all([
        apiRequest(`/categories/user/${userId}`).catch(() => []),
        apiRequest(`/expenses/user/${userId}`).catch(() => []),
        apiRequest(`/expenses/recurring/user/${userId}`).catch(() => []),
      ]);

      setCategories(Array.isArray(allCats) ? allCats : []);

      const used = new Set<number>([
        ...(Array.isArray(expenses) ? expenses : []).map((e: any) => Number(e.categoryId)),
        ...(Array.isArray(recurring) ? recurring : []).map((r: any) => Number(r.categoryId)),
      ]);
      setUsedIds(used);
    } catch (e: any) {
      console.warn('[ManageCategoriesModal] Failed to load categories and usage:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchCategoriesAndUsage();
    }
  }, [visible, userId]);

  /**
   * Creates a new custom category for the user.
   */
  const handleCreateCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) {
      showAlert('Empty Name', 'Please enter a valid category name.');
      return;
    }
    if (trimmed.length > 50) {
      showAlert('Name Too Long', 'Category name must be under 50 characters.');
      return;
    }
    setCreating(true);
    try {
      await apiRequest(`/categories/user/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ name: trimmed }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setNewCatName('');
      await fetchCategoriesAndUsage();
      onCategoriesUpdated();
    } catch (e: any) {
      showAlert('Creation Failed', e.message || 'Could not create category.');
    } finally {
      setCreating(false);
    }
  };

  /**
   * Confirms and deletes an unused category.
   */
  const handleDeleteCategory = async (cat: Category) => {
    if (usedIds.has(cat.id)) {
      showAlert(
        'Category In Use',
        `"${cat.name}" is used by existing transactions or subscriptions and cannot be deleted.`
      );
      return;
    }

    showAlert(
      'Delete Category',
      `Delete "${cat.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/categories/${cat.id}/user/${userId}`, { method: 'DELETE' });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              setCategories((prev) => prev.filter((c) => c.id !== cat.id));
              onCategoriesUpdated();
            } catch (e: any) {
              showAlert('Delete Failed', e.message || 'Could not delete category.');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: c.text }]}>Manage Categories</Text>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                Add custom categories or delete unused ones
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: c.inputBg }]}>
              <Ionicons name="close" size={20} color={c.text} />
            </TouchableOpacity>
          </View>

          {/* Add Category Input */}
          <View style={styles.addInputRow}>
            <TextInput
              style={[
                styles.addInput,
                {
                  backgroundColor: c.inputBg,
                  borderColor: c.border,
                  color: c.text,
                },
              ]}
              placeholder="New category name..."
              placeholderTextColor={c.textMuted}
              value={newCatName}
              onChangeText={setNewCatName}
            />
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleCreateCategory}
              disabled={creating}
              style={[styles.addBtn, { backgroundColor: c.primary }]}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#10120E" />
              ) : (
                <Text style={styles.addBtnText}>+ Add</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Category List */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={c.primary} />
            </View>
          ) : (
            <ScrollView style={styles.listWrap} showsVerticalScrollIndicator={false}>
              {categories.length === 0 ? (
                <Text style={[styles.emptyText, { color: c.textMuted }]}>
                  No custom categories yet. Create one above!
                </Text>
              ) : (
                categories.map((cat) => {
                  const inUse = usedIds.has(cat.id);
                  return (
                    <View
                      key={cat.id}
                      style={[
                        styles.catRow,
                        {
                          backgroundColor: c.inputBg,
                          borderColor: c.border,
                        },
                      ]}
                    >
                      <View style={styles.catInfo}>
                        <Text style={styles.catEmoji}>{getCategoryEmoji(cat.name)}</Text>
                        <Text style={[styles.catName, { color: c.text }]}>{cat.name}</Text>
                        {inUse && (
                          <View style={[styles.inUseBadge, { backgroundColor: c.border }]}>
                            <Text style={[styles.inUseText, { color: c.textMuted }]}>In use</Text>
                          </View>
                        )}
                      </View>

                      <TouchableOpacity
                        onPress={() => handleDeleteCategory(cat)}
                        disabled={inUse}
                        style={[
                          styles.deleteBtn,
                          {
                            opacity: inUse ? 0.3 : 1,
                          },
                        ]}
                      >
                        <Ionicons name="trash-outline" size={18} color={c.accent} />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 24,
    maxHeight: '82%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  addInput: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  addBtn: {
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    color: '#10120E',
    fontWeight: '800',
    fontSize: 14,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
  },
  listWrap: {
    maxHeight: 320,
  },
  emptyText: {
    textAlign: 'center',
    padding: 30,
    fontSize: 13,
  },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  catInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catEmoji: {
    fontSize: 18,
  },
  catName: {
    fontSize: 15,
    fontWeight: '600',
  },
  inUseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inUseText: {
    fontSize: 10,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 6,
  },
});
