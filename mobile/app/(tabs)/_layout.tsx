import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

export default function TabLayout() {
  const { theme } = useAuth();
  
  const isLight = theme === 'light';

  // Dynamic colors based on theme
  const tabActiveColor = '#FF9F6E';
  const tabInactiveColor = isLight ? '#6B7280' : '#9AA0AE';
  const tabBg = isLight ? '#FFFFFF' : '#0E1220';
  const tabBorder = isLight ? '#E5E7EB' : 'rgba(255, 255, 255, 0.08)';
  const headerBg = isLight ? '#F0F2F5' : '#05070D';
  const headerBorder = isLight ? '#E5E7EB' : 'rgba(255, 255, 255, 0.08)';
  const headerTint = isLight ? '#111827' : '#E6E8EC';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tabActiveColor,
        tabBarInactiveTintColor: tabInactiveColor,
        tabBarStyle: {
          backgroundColor: tabBg,
          borderTopColor: tabBorder,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: headerBg,
          shadowColor: 'transparent',
          borderBottomWidth: 1,
          borderBottomColor: headerBorder,
        },
        headerTintColor: headerTint,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add-expense"
        options={{
          title: 'Add New',
          tabBarLabel: 'Add New',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: 'Subscriptions',
          tabBarLabel: 'Subscriptions',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="repeat-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
