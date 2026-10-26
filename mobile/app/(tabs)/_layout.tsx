/**
 * @file _layout.tsx
 * @description Bottom navigation tab bar layout with safe area handling and centered action button.
 * Uses native React Navigation tab bar labels and icons to ensure touch feedback and ripples
 * align symmetrically and encompass both icon and text on all screen sizes with WCAG-compliant contrast.
 * Features spring-animated icon pops on tab switches for responsive, tactile feedback.
 */

import React, { useRef, useEffect } from "react";
import { StyleSheet, Platform, Animated } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../constants/theme";

interface AnimatedTabIconProps {
  focused: boolean;
  activeColor: string;
  inactiveColor: string;
  activePillBg: string;
  iconNameFocused: keyof typeof Ionicons.glyphMap;
  iconNameOutline: keyof typeof Ionicons.glyphMap;
  size?: number;
}

function AnimatedTabIcon({
  focused,
  activeColor,
  inactiveColor,
  activePillBg,
  iconNameFocused,
  iconNameOutline,
  size = 21,
}: AnimatedTabIconProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevFocused = useRef(focused);

  useEffect(() => {
    if (focused && !prevFocused.current) {
      scaleAnim.setValue(0.8);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 110,
        useNativeDriver: true,
      }).start();
    }
    prevFocused.current = focused;
  }, [focused, scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.iconWrap,
        focused && { backgroundColor: activePillBg },
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Ionicons
        name={focused ? iconNameFocused : iconNameOutline}
        size={size}
        color={focused ? activeColor : inactiveColor}
      />
    </Animated.View>
  );
}

function AnimatedAddTabIcon({
  focused,
  activeColor,
  isLight,
}: {
  focused: boolean;
  activeColor: string;
  isLight: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevFocused = useRef(focused);

  useEffect(() => {
    if (focused && !prevFocused.current) {
      scaleAnim.setValue(0.85);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }).start();
    }
    prevFocused.current = focused;
  }, [focused, scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.iconWrap,
        {
          backgroundColor: activeColor,
          shadowColor: activeColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35,
          shadowRadius: 5,
          elevation: 5,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Ionicons name="add" size={22} color={isLight ? "#FFFFFF" : "#10120E"} />
    </Animated.View>
  );
}

export default function TabLayout() {
  const { theme } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = Colors[theme];
  const isLight = theme === "light";

  // High-contrast, WCAG AA/AAA-compliant colors for crisp visibility across light and dark themes
  const activeColor = isLight ? "#92400E" : "#F5C842";
  const inactiveColor = isLight ? "#64748B" : "#9CA3AF";
  const activePillBg = isLight ? "rgba(146, 64, 14, 0.12)" : "rgba(245, 200, 66, 0.16)";

  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === "ios" ? 16 : 8);
  const tabHeight = 60 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        sceneStyle: { backgroundColor: c.bg },
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarShowLabel: true,
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: -0.2,
          marginTop: 2,
          marginBottom: 1,
          textAlign: "center",
        },
        tabBarStyle: {
          backgroundColor: isLight ? "#FFFFFF" : "rgba(23, 26, 20, 0.98)",
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: bottomInset,
          paddingTop: 6,
          paddingHorizontal: 4,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 10,
          elevation: 12,
        },
        tabBarItemStyle: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: 2,
        },
        tabBarIconStyle: {
          width: 44,
          height: 28,
          justifyContent: "center",
          alignItems: "center",
        },
        headerShown: false,
        animation: "none",
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarLabel: "Home",
          tabBarAccessibilityLabel: "Dashboard",
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon
              focused={focused}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
              activePillBg={activePillBg}
              iconNameFocused="grid"
              iconNameOutline="grid-outline"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="add-expense"
        listeners={() => ({
          tabPress: (e) => {
            e.preventDefault();
            router.replace({
              pathname: "/(tabs)/add-expense",
              params: {
                editId: "",
                editType: "",
                editDescription: "",
                editAmount: "",
                editCategoryId: "",
                editDate: "",
                editSource: "",
                editIsRecurring: "",
                editFrequency: "",
                editIntervalDays: "",
                editName: "",
                editTargetAmount: "",
                editCurrentAmount: "",
                editTargetDate: "",
                editRecurringAmount: "",
              },
            });
          },
        })}
        options={{
          title: "Add Record",
          tabBarLabel: "Add",
          tabBarAccessibilityLabel: "Add record",
          tabBarIcon: ({ focused }) => (
            <AnimatedAddTabIcon
              focused={focused}
              activeColor={activeColor}
              isLight={isLight}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="subscriptions"
        options={{
          title: "Subscriptions",
          tabBarLabel: "Subscriptions",
          tabBarAccessibilityLabel: "Subscriptions",
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon
              focused={focused}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
              activePillBg={activePillBg}
              iconNameFocused="repeat"
              iconNameOutline="repeat-outline"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarLabel: "Profile",
          tabBarAccessibilityLabel: "Profile and settings",
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon
              focused={focused}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
              activePillBg={activePillBg}
              iconNameFocused="person"
              iconNameOutline="person-outline"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
