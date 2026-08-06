import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

const ACCENT = '#C79A3E';
const ORANGE = '#A23E32';
const BLUE = '#4C7A78';

interface TabIconProps {
  name: string;
  focused: boolean;
  color: string;
  label: string;
  activeColor?: string;
}

function TabIcon({ name, focused, color, label, activeColor = ACCENT }: TabIconProps) {
  return (
    <View style={[styles.tabItem, focused && { ...styles.tabItemActive, backgroundColor: activeColor + '18' }]}>
      <Ionicons
        name={name as any}
        size={focused ? 22 : 20}
        color={focused ? activeColor : color}
      />
      {focused && (
        <Text style={[styles.tabLabel, { color: activeColor }]}>{label}</Text>
      )}
    </View>
  );
}

export default function TabLayout() {
  const { theme } = useAuth();
  const isLight = theme === 'light';

  const tabBg = isLight ? 'rgba(252,251,246,0.96)' : 'rgba(23,26,20,0.96)';
  const tabBorder = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const inactiveColor = isLight ? '#A8A395' : '#6B6558';
  const headerBg = isLight ? '#EDEAE0' : '#10120E';
  const headerTint = isLight ? '#1E1B15' : '#ECE7D8';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: inactiveColor,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: tabBg,
          borderTopColor: tabBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 80 : 68,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          paddingTop: 8,
          paddingHorizontal: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.2,
          shadowRadius: 20,
          elevation: 16,
        },
        headerStyle: {
          backgroundColor: headerBg,
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: headerTint,
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 18,
          letterSpacing: -0.3,
        },
        headerShown: false, // each screen has its own header
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
              activeColor={ACCENT}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="add-expense"
        options={{
          title: 'Add New',
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.fabBtn,
              { backgroundColor: focused ? ACCENT : ORANGE },
            ]}>
              <Ionicons name="add" size={26} color="#10120E" />
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
              activeColor={BLUE}
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
              activeColor={ORANGE}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tabItemActive: {
    paddingHorizontal: 12,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  fabBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
    marginBottom: 8,
  },
});
