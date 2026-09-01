/**
 * @file _layout.tsx
 * @description Bottom navigation tab bar layout with safe area handling and centered action button.
 * Uses vertical tab layout to ensure icons and labels are 100% visible on all Android and iOS screens.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/theme';

interface TabIconProps {
  name: string;
  focused: boolean;
  color: string;
  label: string;
  activeColor: string;
}

function TabIcon({ name, focused, color, label, activeColor }: TabIconProps) {
  return (
    <View style={styles.tabItem}>
      <View style={[styles.iconWrap, focused && { backgroundColor: activeColor + '20' }]}>
        <Ionicons
          name={name as any}
          size={22}
          color={focused ? activeColor : color}
        />
      </View>
      <Text
        style={[
          styles.tabLabel,
          {
            color: focused ? activeColor : color,
            fontWeight: focused ? '800' : '600',
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { theme } = useAuth();
  const insets = useSafeAreaInsets();
  const c = Colors[theme];
  const isLight = theme === 'light';

  // Ensure ample bottom space on Android 3-button/gesture bar and iOS Home indicator
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 10);
  const tabHeight = 60 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: isLight ? 'rgba(255,255,255,0.98)' : 'rgba(23,26,20,0.98)',
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
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'grid' : 'grid-outline'}
              focused={focused}
              color={color}
              label="Home"
              activeColor={c.primary}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="add-expense"
        options={{
          title: 'Add Record',
          tabBarIcon: () => (
            <View
              style={[
                styles.fabBtn,
                {
                  backgroundColor: c.primary,
                  shadowColor: c.primary,
                },
              ]}
            >
              <Ionicons name="add" size={26} color={isLight ? '#FFF' : '#10120E'} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="subscriptions"
        options={{
          title: 'Subscriptions',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'repeat' : 'repeat-outline'}
              focused={focused}
              color={color}
              label="Subs"
              activeColor={c.teal}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'person' : 'person-outline'}
              focused={focused}
              color={color}
              label="Profile"
              activeColor={c.primary}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 48,
  },
  iconWrap: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 14,
    marginBottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10.5,
    letterSpacing: -0.2,
  },
  fabBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
});
