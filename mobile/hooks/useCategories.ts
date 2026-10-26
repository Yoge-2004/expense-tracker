import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { apiRequest } from '../services/api';

export interface Category {
  id: number;
  name: string;
}

export function useCategories(userId: string | number | null) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoriesError, setCategoriesError] = useState(false);
  const [categoryRetryTick, setCategoryRetryTick] = useState(0);
  const categoryRetryCount = useRef(0);

  const loadCategories = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    try {
      // Hydrate from cached categories if current state is empty
      if (categories.length === 0) {
        try {
          const cachedRaw = await AsyncStorage.getItem(`expense_cache_v4_${userId}`);
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
              setCategories(parsed.categories);
            }
          }
        } catch (_) {}
      }

      const [globalRes, userRes] = await Promise.allSettled([
        apiRequest('/categories/global'),
        apiRequest(`/categories/user/${userId}`),
      ]);
      const globalCats = globalRes.status === 'fulfilled' ? globalRes.value : null;
      const userCats = userRes.status === 'fulfilled' ? userRes.value : null;
      const loadedAny = Array.isArray(globalCats) || Array.isArray(userCats);
      const merged = [
        ...(Array.isArray(globalCats) ? globalCats : []),
        ...(Array.isArray(userCats) ? userCats : []),
      ];

      const seen = new Set();
      const uniqueCats: Category[] = [];
      merged.forEach((cat) => {
        if (cat && cat.name && !seen.has(cat.name.toLowerCase())) {
          seen.add(cat.name.toLowerCase());
          uniqueCats.push(cat);
        }
      });

      if (uniqueCats.length > 0) {
        setCategories(uniqueCats);
      }
      if (loadedAny) {
        categoryRetryCount.current = 0;
        setCategoriesError(false);
      } else {
        setCategoriesError(true);
        setCategoryRetryTick((n) => n + 1);
      }
    } catch (e: any) {
      console.warn('[useCategories] Error fetching categories:', e);
      setCategoriesError(true);
      setCategoryRetryTick((n) => n + 1);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [userId, categories.length]);

  useFocusEffect(
    useCallback(() => {
      void loadCategories();
    }, [loadCategories])
  );

  // Auto-retry effect when categories fail to load
  useEffect(() => {
    if (!categoriesError || categoryRetryCount.current >= 4) return;
    const delay = 4000 * (categoryRetryCount.current + 1);
    const timer = setTimeout(() => {
      categoryRetryCount.current += 1;
      void loadCategories();
    }, delay);
    return () => clearTimeout(timer);
  }, [categoriesError, categoryRetryTick, loadCategories]);

  return {
    categories,
    isLoading,
    refreshing,
    setRefreshing,
    categoriesError,
    loadCategories,
  };
}
