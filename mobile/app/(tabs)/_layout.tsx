/**
 * @file _layout.tsx
 * @description Bottom navigation tab bar layout with safe area handling and centered action button.
 * Uses native React Navigation tab bar labels and icons to ensure touch feedback and ripples
 * align symmetrically and encompass both icon and text on all screen sizes with WCAG-compliant contrast.
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/theme';

export default function TabLayout() {
  const { theme } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = Colors[theme];
  const isLight = theme === 'light';

  // High-contrast, WCAG AA/AAA-compliant colors for crisp visibility across light and dark themes
  const activeColor = isLight ? '#92400E' : '#F5C842';
  const inactiveColor = isLight ? '#64748B' : '#9CA3AF';
  const activePillBg = isLight ? 'rgba(146, 64, 14, 0.12)' : 'rgba(245, 200, 66, 0.16)';

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 8);
  const tabHeight = 62 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: {
          fontSize: 9.5,
          fontWeight: '700',
          letterSpacing: -0.2,
          marginTop: -2,
          marginBottom: 3,
        },
        tabBarStyle: {
          backgroundColor: isLight ? '#FFFFFF' : 'rgba(23, 26, 20, 0.98)',
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: bottomInset,
          paddingTop: 6,
          paddingHorizontal: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 10,
          elevation: 12,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 2,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarAccessibilityLabel: 'Dashboard',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconWrap, focused && { backgroundColor: activePillBg }]}>
              <Ionicons
                name={focused ? 'grid' : 'grid-outline'}
                size={24}
                color={focused ? activeColor : inactiveColor}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="add-expense"
        listeners={() => ({
          tabPress: (e) => {
            e.preventDefault();
            router.replace({
              pathname: '/(tabs)/add-expense',
              params: {
                editId: '',
                editType: '',
                editDescription: '',
                editAmount: '',
                editCategoryId: '',
                editDate: '',
                editSource: '',
                editIsRecurring: '',
                editFrequency: '',
                editIntervalDays: '',
                editName: '',
                editTargetAmount: '',
                editCurrentAmount: '',
                editTargetDate: '',
                editRecurringAmount: '',
              },
            });
          },
        })}
        options={{
          title: 'Add Record',
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: 'Add record',
          tabBarIcon: () => (
            <View
              style={[
                styles.fabBtn,
                {
                  backgroundColor: activeColor,
                  shadowColor: activeColor,
                },
              ]}
            >
              <Ionicons name="add" size={28} color={isLight ? '#FFFFFF' : '#10120E'} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="subscriptions"
        options={{
          title: 'Subscriptions',
          tabBarLabel: 'Subscriptions',
          tabBarAccessibilityLabel: 'Subscriptions',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconWrap, focused && { backgroundColor: activePillBg }]}>
              <Ionicons
                name={focused ? 'repeat' : 'repeat-outline'}
                size={24}
                color={focused ? activeColor : inactiveColor}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarAccessibilityLabel: 'Profile and settings',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconWrap, focused && { backgroundColor: activePillBg }]}>
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={24}
                color={focused ? activeColor : inactiveColor}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  fabBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
    marginTop: -2,
  },
});
