/**
 * @file CalendarPickerModal.tsx
 * @description In-app interactive monthly calendar modal picker.
 * Allows users to visually browse months and tap any calendar date without manual typing.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

// Dynamic window dimensions calculated inside component

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface CalendarPickerModalProps {
  visible: boolean;
  title?: string;
  initialDate?: string; // YYYY-MM-DD
  onClose: () => void;
  onSelectDate: (date: string) => void;
}

export const CalendarPickerModal: React.FC<CalendarPickerModalProps> = ({
  visible,
  title = 'Select Date',
  initialDate,
  onClose,
  onSelectDate,
}) => {
  const { theme } = useAuth();
  const c = Colors[theme || 'dark'];
  const isLight = theme === 'light';
  const { width } = useWindowDimensions();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDateStr, setSelectedDateStr] = useState(initialDate || '');

  useEffect(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
      const parts = initialDate.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (!isNaN(y) && !isNaN(m)) {
        setViewYear(y);
        setViewMonth(m);
        setSelectedDateStr(initialDate);
      }
    } else {
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
      setSelectedDateStr('');
    }
  }, [initialDate, visible]);

  const handlePrevMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    Haptics.selectionAsync().catch(() => {});
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${viewYear}-${mm}-${dd}`;
    setSelectedDateStr(dateStr);
    onSelectDate(dateStr);
    onClose();
  };

  const handleQuickSelectToday = () => {
    Haptics.selectionAsync().catch(() => {});
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${mm}-${dd}`;
    setSelectedDateStr(dateStr);
    onSelectDate(dateStr);
    onClose();
  };

  // Calendar calculations
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const calendarCells = [];
  // Blank days before month starts
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              {/* Header */}
              <View style={styles.headerRow}>
                <Text style={[styles.title, { color: c.text }]}>{title}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close-circle" size={24} color={c.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Month Navigator */}
              <View style={[styles.monthNav, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrowBtn}>
                  <Ionicons name="chevron-back" size={20} color={c.text} />
                </TouchableOpacity>
                <Text style={[styles.monthYearText, { color: c.text }]}>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </Text>
                <TouchableOpacity onPress={handleNextMonth} style={styles.navArrowBtn}>
                  <Ionicons name="chevron-forward" size={20} color={c.text} />
                </TouchableOpacity>
              </View>

              {/* Day Labels Row */}
              <View style={styles.dayLabelsRow}>
                {DAY_LABELS.map((d, idx) => (
                  <Text key={idx} style={[styles.dayLabel, { color: c.textMuted }]}>
                    {d}
                  </Text>
                ))}
              </View>

              {/* Grid of Days */}
              <View style={styles.grid}>
                {calendarCells.map((day, idx) => {
                  if (day === null) {
                    return <View key={idx} style={styles.dayCell} />;
                  }

                  const cellDateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isSelected = selectedDateStr === cellDateStr;
                  const isToday = todayStr === cellDateStr;

                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.7}
                      onPress={() => handleSelectDay(day)}
                      style={[
                        styles.dayCell,
                        isSelected && { backgroundColor: c.primary },
                        !isSelected && isToday && { borderColor: c.primary, borderWidth: 1.5 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          {
                            color: isSelected
                              ? (isLight ? '#FFFFFF' : '#10120E')
                              : (isToday ? c.primary : c.text),
                            fontWeight: isSelected || isToday ? '800' : '500',
                          },
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Footer Quick Action */}
              <View style={styles.footerRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleQuickSelectToday}
                  style={[styles.todayBtn, { backgroundColor: c.inputBg, borderColor: c.border }]}
                >
                  <Ionicons name="today-outline" size={14} color={c.primary} />
                  <Text style={[styles.todayBtnText, { color: c.primary }]}>Select Today</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    onSelectDate('');
                    onClose();
                  }}
                  style={[styles.clearBtn, { borderColor: c.border }]}
                >
                  <Text style={[styles.clearBtnText, { color: c.textMuted }]}>Clear Filter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    maxWidth: 360,
    width: '92%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 14,
  },
  navArrowBtn: {
    padding: 6,
  },
  monthYearText: {
    fontSize: 15,
    fontWeight: '800',
  },
  dayLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  dayLabel: {
    width: 38,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    rowGap: 6,
  },
  dayCell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 13.5,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
