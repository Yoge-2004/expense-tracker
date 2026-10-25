/**
 * @file FloatingCalculator.tsx
 * @description Draggable & dockable floating quick calculator for mobile app.
 * Features safe arithmetic, bill splitting, currency converter, haptics, and 1-tap "Insert into Expense".
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  PanResponder,
  useWindowDimensions,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';
import { getCurrencySymbol, getExchangeRate } from '../services/currency';

const MAJOR_CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'JPY', 'SGD', 'SAR', 'CHF', 'CNY'] as const;
const STORAGE_CALC_POS = '@expense_tracker_calc_pos';
const BUTTON_SIZE = 54;

function safeMath(a: string, b: string, op: string): string {
  const numA = parseFloat(a);
  const numB = parseFloat(b);
  if (isNaN(numA) || isNaN(numB)) return String(numA || 0);

  let result = 0;
  switch (op) {
    case '+':
      result = numA + numB;
      break;
    case '−':
    case '-':
      result = numA - numB;
      break;
    case '×':
    case '*':
      result = numA * numB;
      break;
    case '÷':
    case '/':
      if (numB === 0) return 'Error';
      result = numA / numB;
      break;
    default:
      return String(numB);
  }

  // Prevent IEEE-754 precision issues (e.g. 0.1 + 0.2 = 0.3)
  return String(Math.round((result + Number.EPSILON) * 100000000) / 100000000);
}

export const FloatingCalculator: React.FC = () => {
  const { theme, token, currency } = useAuth();
  const c = Colors[theme || 'dark'];
  const isLight = theme === 'light';
  const currSymbol = getCurrencySymbol(currency);
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Calculator State
  const [isOpen, setIsOpen] = useState(false);
  const [currentVal, setCurrentVal] = useState('0');
  const [prevVal, setPrevVal] = useState<string | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [exprStr, setExprStr] = useState('0');
  const [isNewNum, setIsNewNum] = useState(true);
  const [splitCount, setSplitCount] = useState(1);
  const [isConverting, setIsConverting] = useState(false);
  const [fxFrom, setFxFrom] = useState<string>('USD');
  const [fxTo, setFxTo] = useState<string>(currency || 'INR');

  // Dragging State
  const defaultRight = 20;
  const defaultBottom = insets.bottom + 84; // Above tab bar
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const currentPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  // Restore position from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_CALC_POS)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
              // Clamp to current screen
              const maxX = 0;
              const minX = -(windowWidth - BUTTON_SIZE - 24);
              const maxY = 0;
              const minY = -(windowHeight - BUTTON_SIZE - insets.top - 60);

              const clampedX = Math.max(minX, Math.min(maxX, parsed.x));
              const clampedY = Math.max(minY, Math.min(maxY, parsed.y));

              currentPos.current = { x: clampedX, y: clampedY };
              pan.setValue({ x: clampedX, y: clampedY });
            }
          } catch (_) {}
        }
      })
      .catch(() => {});
  }, [windowWidth, windowHeight, insets.top]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5;
      },
      onPanResponderGrant: () => {
        isDragging.current = true;
        pan.setOffset({
          x: currentPos.current.x,
          y: currentPos.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gesture) => {
        pan.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        pan.flattenOffset();
        isDragging.current = false;

        // Calculate clamped position
        const maxX = 0;
        const minX = -(windowWidth - BUTTON_SIZE - 24);
        const maxY = 0;
        const minY = -(windowHeight - BUTTON_SIZE - insets.top - 70);

        let finalX = currentPos.current.x + gesture.dx;
        let finalY = currentPos.current.y + gesture.dy;

        finalX = Math.max(minX, Math.min(maxX, finalX));
        finalY = Math.max(minY, Math.min(maxY, finalY));

        currentPos.current = { x: finalX, y: finalY };

        Animated.spring(pan, {
          toValue: { x: finalX, y: finalY },
          useNativeDriver: false,
          bounciness: 4,
          speed: 16,
        }).start();

        AsyncStorage.setItem(STORAGE_CALC_POS, JSON.stringify({ x: finalX, y: finalY })).catch(() => {});
      },
    })
  ).current;

  // Key Handlers
  const handleDigit = useCallback(
    (d: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (splitCount > 1) {
        setSplitCount(1);
      }
      if (isNewNum || currentVal === '0' || currentVal === 'Error') {
        setCurrentVal(d);
        setIsNewNum(false);
      } else {
        if (currentVal.length < 13) {
          setCurrentVal((prev) => prev + d);
        }
      }
    },
    [currentVal, isNewNum, splitCount]
  );

  const handleDecimal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (splitCount > 1) {
      setSplitCount(1);
    }
    if (isNewNum || currentVal === 'Error') {
      setCurrentVal('0.');
      setIsNewNum(false);
    } else if (!currentVal.includes('.')) {
      setCurrentVal((prev) => prev + '.');
    }
  }, [currentVal, isNewNum, splitCount]);

  const handleOperator = useCallback(
    (op: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      if (splitCount > 1) {
        setSplitCount(1);
      }
      if (operator && !isNewNum) {
        const res = safeMath(prevVal || '0', currentVal, operator);
        setCurrentVal(res);
        setPrevVal(res);
        setExprStr(`${res} ${op}`);
      } else {
        setPrevVal(currentVal);
        setExprStr(`${currentVal} ${op}`);
      }
      setOperator(op);
      setIsNewNum(true);
    },
    [currentVal, prevVal, operator, isNewNum, splitCount]
  );

  const handleEquals = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    if (splitCount > 1) return;
    if (operator && prevVal !== null) {
      const res = safeMath(prevVal, currentVal, operator);
      setExprStr(`${prevVal} ${operator} ${currentVal} =`);
      setCurrentVal(res);
      setPrevVal(null);
      setOperator(null);
      setIsNewNum(true);
    }
  }, [operator, prevVal, currentVal, splitCount]);

  const handleClear = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCurrentVal('0');
    setPrevVal(null);
    setOperator(null);
    setExprStr('0');
    setIsNewNum(true);
    setSplitCount(1);
  }, []);

  const handleBackspace = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (splitCount > 1) {
      setSplitCount(1);
      return;
    }
    if (isNewNum || currentVal === 'Error') {
      setCurrentVal('0');
      return;
    }
    if (currentVal.length > 1) {
      setCurrentVal((prev) => prev.slice(0, -1));
    } else {
      setCurrentVal('0');
    }
  }, [currentVal, isNewNum, splitCount]);

  const handleNegate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (currentVal !== '0' && currentVal !== 'Error') {
      setCurrentVal((prev) => (prev.startsWith('-') ? prev.slice(1) : '-' + prev));
    }
  }, [currentVal]);

  const handlePercent = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const num = parseFloat(currentVal);
    if (!isNaN(num)) {
      setCurrentVal(String(num / 100));
      setIsNewNum(true);
    }
  }, [currentVal]);

  const handleSplit = useCallback(
    (count: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSplitCount(count);
    },
    []
  );

  const handleConvertCurrency = useCallback(
    async (fromCode: string, toCode?: string) => {
      const num = parseFloat(currentVal);
      if (isNaN(num) || num === 0) return;

      const targetCurr = toCode || fxTo || currency || 'INR';
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setIsConverting(true);
      try {
        const rate = await getExchangeRate(fromCode, targetCurr);
        const converted = Math.round((num * rate + Number.EPSILON) * 100) / 100;
        const targetSymbol = getCurrencySymbol(targetCurr);
        const rateStr = rate < 0.01 ? rate.toFixed(4) : (rate < 1 ? rate.toFixed(3) : rate.toFixed(2));
        setExprStr(`${num} ${fromCode} @ ${targetSymbol}${rateStr} ${targetCurr}`);
        setCurrentVal(String(converted));
        setIsNewNum(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (e) {
        console.warn('Currency conversion failed:', e);
      } finally {
        setIsConverting(false);
      }
    },
    [currentVal, fxTo, currency]
  );

  const handleSwapFx = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFxFrom((prev) => {
      const nextFrom = fxTo;
      setFxTo(prev);
      return nextFrom;
    });
  }, [fxTo]);

  const handleCycleFrom = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFxFrom((prev) => {
      const idx = MAJOR_CURRENCIES.indexOf(prev as any);
      return MAJOR_CURRENCIES[(idx + 1) % MAJOR_CURRENCIES.length];
    });
  }, []);

  const handleCycleTo = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFxTo((prev) => {
      const idx = MAJOR_CURRENCIES.indexOf(prev as any);
      return MAJOR_CURRENCIES[(idx + 1) % MAJOR_CURRENCIES.length];
    });
  }, []);

  // Insert Amount into Add Expense
  const handleInsertAmount = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    let finalAmount = currentVal;
    if (splitCount > 1 && !isNaN(parseFloat(currentVal))) {
      finalAmount = String(
        Math.round(((parseFloat(currentVal) / splitCount) + Number.EPSILON) * 100) / 100
      );
    }

    setIsOpen(false);
    // Navigate to Add Expense screen with the calculated amount
    router.push({
      pathname: '/(tabs)/add-expense',
      params: { amount: finalAmount },
    });
  }, [currentVal, splitCount, router]);

  // Display computation
  const displayVal =
    splitCount > 1 && !isNaN(parseFloat(currentVal))
      ? String(Math.round(((parseFloat(currentVal) / splitCount) + Number.EPSILON) * 100) / 100)
      : currentVal;

  const displayExpr =
    splitCount > 1
      ? `${currentVal} ÷ ${splitCount} people`
      : operator && prevVal !== null
      ? `${prevVal} ${operator} ${isNewNum ? '' : currentVal}`
      : exprStr;

  // Don't render on public auth screens
  const isAuthScreen = ['login', 'register', 'forgot-password'].includes(segments[0] as string);
  if (!token || isAuthScreen) {
    return null;
  }

  return (
    <>
      {/* Draggable Minimized Trigger Bubble */}
      <Animated.View
        style={[
          styles.triggerContainer,
          {
            right: defaultRight,
            bottom: defaultBottom,
            transform: pan.getTranslateTransform(),
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => {
            if (!isDragging.current) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setIsOpen(true);
            }
          }}
          style={[
            styles.triggerBtn,
            {
              backgroundColor: c.card,
              borderColor: c.borderAccent,
              shadowColor: c.primary,
            },
          ]}
          accessibilityLabel="Open Quick Calculator"
          accessibilityRole="button"
        >
          <Ionicons name="calculator-outline" size={24} color={c.primary} />
          <View style={[styles.triggerBadge, { backgroundColor: c.primary }]} />
        </TouchableOpacity>
      </Animated.View>

      {/* Expanded Calculator Modal Sheet */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          />

          <View
            style={[
              styles.calcCard,
              {
                backgroundColor: c.card,
                borderColor: c.borderAccent,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            {/* Header */}
            <View style={[styles.calcHeader, { borderBottomColor: c.border }]}>
              <View style={styles.titleRow}>
                <Ionicons name="calculator" size={17} color={c.primary} />
                <Text style={[styles.calcTitle, { color: c.primary }]}>Quick Calculator</Text>
              </View>

              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[
                  styles.closeBtn,
                  {
                    backgroundColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.06)',
                    borderColor: c.border,
                  },
                ]}
                accessibilityLabel="Close Calculator"
              >
                <Ionicons name="close" size={18} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Display Screen */}
            <View style={[styles.calcScreen, { backgroundColor: isLight ? '#F1F5F9' : 'rgba(0,0,0,0.38)', borderColor: c.border }]}>
              <Text style={[styles.exprText, { color: c.textMuted }]} numberOfLines={1}>
                {displayExpr}
              </Text>
              <Text style={[styles.valText, { color: c.text }]} numberOfLines={1}>
                {displayVal}
              </Text>
            </View>

            {/* Split Bill Bar & Use Amount Action */}
            <View style={styles.toolsRow}>
              <View style={styles.splitChips}>
                <Text style={[styles.splitLabel, { color: c.textMuted }]}>Split:</Text>
                {[1, 2, 3, 4, 5].map((num) => {
                  const active = splitCount === num;
                  return (
                    <TouchableOpacity
                      key={num}
                      onPress={() => handleSplit(num)}
                      style={[
                        styles.splitChip,
                        {
                          backgroundColor: active ? c.primary : isLight ? '#F8FAFC' : 'rgba(255,255,255,0.05)',
                          borderColor: active ? c.primary : c.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.splitChipText,
                          { color: active ? '#10120E' : c.textMuted, fontWeight: active ? '700' : '600' },
                        ]}
                      >
                        {num === 1 ? '1x' : `÷${num}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                onPress={handleInsertAmount}
                style={[styles.insertBtn, { backgroundColor: c.primary }]}
                activeOpacity={0.8}
              >
                <Text style={styles.insertBtnText}>Insert Amount</Text>
                <Ionicons name="arrow-forward" size={13} color="#10120E" />
              </TouchableOpacity>
            </View>

            {/* Comprehensive Bidirectional Currency Conversion Bar */}
            <View style={styles.fxContainer}>
              <View style={styles.fxControlsRow}>
                <Text style={[styles.fxLabel, { color: c.textMuted }]}>Fx:</Text>
                <TouchableOpacity
                  onPress={handleCycleFrom}
                  style={[styles.fxSelectBtn, { backgroundColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.06)', borderColor: c.border }]}
                  accessibilityLabel="Change source currency"
                >
                  <Text style={[styles.fxSelectBtnText, { color: c.text }]}>{fxFrom} ▾</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSwapFx}
                  style={[styles.fxSwapBtn, { borderColor: c.border, backgroundColor: isLight ? '#F8F9FA' : 'rgba(255,255,255,0.08)' }]}
                  accessibilityLabel="Swap currencies"
                >
                  <Ionicons name="swap-horizontal" size={13} color={c.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleCycleTo}
                  style={[styles.fxSelectBtn, { backgroundColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.06)', borderColor: c.border }]}
                  accessibilityLabel="Change target currency"
                >
                  <Text style={[styles.fxSelectBtnText, { color: c.text }]}>{fxTo} ▾</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={isConverting}
                  onPress={() => handleConvertCurrency(fxFrom, fxTo)}
                  style={[styles.fxConvertBtn, { backgroundColor: c.primary, opacity: isConverting ? 0.6 : 1 }]}
                  accessibilityLabel="Convert current value"
                >
                  <Text style={styles.fxConvertBtnText}>Convert</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fxQuickScroll}>
                {[
                  { from: 'USD', to: currency || 'INR', label: `USD➔${currSymbol}` },
                  { from: 'EUR', to: currency || 'INR', label: `EUR➔${currSymbol}` },
                  { from: 'GBP', to: currency || 'INR', label: `GBP➔${currSymbol}` },
                  { from: 'AED', to: currency || 'INR', label: `AED➔${currSymbol}` },
                  { from: currency || 'INR', to: 'USD', label: `${currSymbol}➔USD` },
                  { from: 'CAD', to: currency || 'INR', label: `CAD➔${currSymbol}` },
                  { from: 'AUD', to: currency || 'INR', label: `AUD➔${currSymbol}` },
                  { from: 'JPY', to: currency || 'INR', label: `JPY➔${currSymbol}` },
                ].map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    disabled={isConverting}
                    onPress={() => {
                      setFxFrom(item.from);
                      setFxTo(item.to);
                      void handleConvertCurrency(item.from, item.to);
                    }}
                    style={[
                      styles.fxChip,
                      {
                        backgroundColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.05)',
                        borderColor: c.border,
                        opacity: isConverting ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.fxChipText, { color: c.primary }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Keypad Grid */}
            <View style={styles.keypadGrid}>
              {/* Row 1 */}
              <TouchableOpacity onPress={handleClear} style={[styles.key, styles.funcKey, { backgroundColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)', borderColor: c.border }]}>
                <Text style={[styles.keyText, { color: isLight ? '#0F172A' : '#ECE7D8' }]}>AC</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleNegate} style={[styles.key, styles.funcKey, { backgroundColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)', borderColor: c.border }]}>
                <Text style={[styles.keyText, { color: isLight ? '#0F172A' : '#ECE7D8' }]}>±</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePercent} style={[styles.key, styles.funcKey, { backgroundColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)', borderColor: c.border }]}>
                <Text style={[styles.keyText, { color: isLight ? '#0F172A' : '#ECE7D8' }]}>%</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleOperator('÷')} style={[styles.key, styles.opKey, { backgroundColor: 'rgba(199, 154, 62, 0.16)', borderColor: 'rgba(199, 154, 62, 0.32)' }]}>
                <Text style={[styles.opKeyText, { color: c.primary }]}>÷</Text>
              </TouchableOpacity>

              {/* Row 2 */}
              <TouchableOpacity onPress={() => handleDigit('7')} style={[styles.key, { backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.04)', borderColor: c.border }]}>
                <Text style={[styles.keyText, { color: c.text }]}>7</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDigit('8')} style={[styles.key, { backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.04)', borderColor: c.border }]}>
                <Text style={[styles.keyText, { color: c.text }]}>8</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDigit('9')} style={[styles.key, { backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.04)', borderColor: c.border }]}>
                <Text style={[styles.keyText, { color: c.text }]}>9</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleOperator('×')} style={[styles.key, styles.opKey, { backgroundColor: 'rgba(199, 154, 62, 0.16)', borderColor: 'rgba(199, 154, 62, 0.32)' }]}>
                <Text style={[styles.opKeyText, { color: c.primary }]}>×</Text>
              </TouchableOpacity>

              {/* Row 3 */}
              <TouchableOpacity onPress={() => handleDigit('4')} style={[styles.key, { backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.04)', borderColor: c.border }]}>
                <Text style={[styles.keyText, { color: c.text }]}>4</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDigit('5')} style={[styles.key, { backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.04)', borderColor: c.border }]}>
                <Text style={[styles.keyText, { color: c.text }]}>5</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDigit('6')} style={[styles.key, { backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.04)', borderColor: c.border }]}>
                <Text style={[styles.keyText, { color: c.text }]}>6</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleOperator('−')} style={[styles.key, styles.opKey, { backgroundColor: 'rgba(199, 154, 62, 0.16)', borderColor: 'rgba(199, 154, 62, 0.32)' }]}>
                <Text style={[styles.opKeyText, { color: c.primary }]}>−</Text>
              </TouchableOpacity>

              {/* Row 4 */}
              <TouchableOpacity onPress={() => handleDigit('1')} style={[styles.key, { backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.04)', borderColor: c.border }]}>
                <Text style={[styles.keyText, { color: c.text }]}>1</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDigit('2')} style={[styles.key, { backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.04)', borderColor: c.border }]}>
                <Text style={[styles.keyText, { color: c.text }]}>2</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDigit('3')} style={[styles.key, { backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.04)', borderColor: c.border }]}>
                <Text style={[styles.keyText, { color: c.text }]}>3</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleOperator('+')} style={[styles.key, styles.opKey, { backgroundColor: 'rgba(199, 154, 62, 0.16)', borderColor: 'rgba(199, 154, 62, 0.32)' }]}>
                <Text style={[styles.opKeyText, { color: c.primary }]}>+</Text>
              </TouchableOpacity>

              {/* Row 5 */}
              <TouchableOpacity onPress={() => handleDigit('0')} style={[styles.key, { backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.04)', borderColor: c.border }]}>
                <Text style={[styles.keyText, { color: c.text }]}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDecimal} style={[styles.key, { backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.04)', borderColor: c.border }]}>
                <Text style={[styles.keyText, { color: c.text }]}>.</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleBackspace} style={[styles.key, styles.funcKey, { backgroundColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.08)', borderColor: c.border }]}>
                <Ionicons name="backspace-outline" size={18} color={c.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleEquals} style={[styles.key, { backgroundColor: c.primary, borderColor: c.primary }]}>
                <Text style={[styles.opKeyText, { color: '#10120E', fontWeight: '800' }]}>=</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  triggerContainer: {
    position: 'absolute',
    zIndex: 999,
  },
  triggerBtn: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    position: 'relative',
  },
  triggerBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  calcCard: {
    width: '100%',
    maxWidth: 420,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  calcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  calcTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calcScreen: {
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 64,
  },
  exprText: {
    fontFamily: 'IBMPlexMono_500Medium',
    fontSize: 11.5,
    marginBottom: 2,
  },
  valText: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 26,
    letterSpacing: -0.5,
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  splitChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  splitLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    marginRight: 2,
  },
  splitChip: {
    paddingHorizontal: 6,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  splitChipText: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 10,
  },
  insertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  insertBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10120E',
  },
  fxContainer: {
    marginBottom: 10,
    gap: 6,
  },
  fxControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  fxLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    marginRight: 2,
  },
  fxSelectBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fxSelectBtnText: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 10.5,
    fontWeight: '700',
  },
  fxSwapBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fxConvertBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fxConvertBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#10120E',
  },
  fxQuickScroll: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  fxChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  fxChipText: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 9.5,
    fontWeight: '700',
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
  },
  key: {
    width: '23.4%',
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  funcKey: {},
  opKey: {},
  keyText: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 16,
  },
  opKeyText: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 18,
    fontWeight: '700',
  },
});
