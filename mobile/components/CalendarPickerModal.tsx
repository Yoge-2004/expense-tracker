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
  const [pickerMode, setPickerMode] = useState<'none' | 'month' | 'year'>('none');
  const [decadeBase, setDecadeBase] = useState(Math.floor(today.getFullYear() / 12) * 12);

  useEffect(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
      const parts = initialDate.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (!isNaN(y) && !isNaN(m)) {
        setViewYear(y);
        setViewMonth(m);
        setDecadeBase(Math.floor(y / 12) * 12);
        setSelectedDateStr(initialDate);
      }
    } else {
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
      setDecadeBase(Math.floor(now.getFullYear() / 12) * 12);
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

  const handleSelectYear = (yr: number) => {
    Haptics.selectionAsync().catch(() => {});
    setViewYear(yr);
    setPickerMode('none');
  };

  const handleSelectMonth = (m: number) => {
    Haptics.selectionAsync().catch(() => {});
    setViewMonth(m);
    setPickerMode('none');
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

  const calendarCells: (number | null)[] = [];
  // Blank days before month starts
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }
  // Pad remaining cells of last week to complete the 7 columns
  const remainder = calendarCells.length % 7;
  if (remainder > 0) {
    const padCount = 7 - remainder;
    for (let p = 0; p < padCount; p++) {
      calendarCells.push(null);
    }
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

              {/* Dual Month & Year Navigator Controls */}
              <View style={styles.navControlsRow}>
                {/* Month Group */}
                <View style={[styles.controlPill, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                  <TouchableOpacity
                    onPress={handlePrevMonth}
                    style={styles.navArrowBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="chevron-back" size={16} color={c.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setPickerMode(pickerMode === 'month' ? 'none' : 'month');
                    }}
                    style={styles.pillTouchable}
                  >
                    <Text style={[styles.pillText, { color: c.text }]}>
                      {MONTH_NAMES[viewMonth].slice(0, 3)}
                    </Text>
                    <Ionicons
                      name={pickerMode === 'month' ? 'caret-up' : 'caret-down'}
                      size={11}
                      color={c.primary}
                      style={{ marginLeft: 3 }}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleNextMonth}
                    style={styles.navArrowBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="chevron-forward" size={16} color={c.text} />
                  </TouchableOpacity>
                </View>

                {/* Year Group */}
                <View style={[styles.controlPill, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setViewYear((y) => y - 1);
                    }}
                    style={styles.navArrowBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="chevron-back" size={16} color={c.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setDecadeBase(Math.floor(viewYear / 12) * 12);
                      setPickerMode(pickerMode === 'year' ? 'none' : 'year');
                    }}
                    style={styles.pillTouchable}
                  >
                    <Text style={[styles.pillText, { color: c.text }]}>
                      {viewYear}
                    </Text>
                    <Ionicons
                      name={pickerMode === 'year' ? 'caret-up' : 'caret-down'}
                      size={11}
                      color={c.primary}
                      style={{ marginLeft: 3 }}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setViewYear((y) => y + 1);
                    }}
                    style={styles.navArrowBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="chevron-forward" size={16} color={c.text} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* VIEW 1: Quick Year Picker Grid */}
              {pickerMode === 'year' && (
                <View style={styles.pickerContainer}>
                  <View style={styles.pickerHeaderRow}>
                    <TouchableOpacity
                      onPress={() => setDecadeBase((d) => d - 12)}
                      style={styles.pickerHeaderArrow}
                    >
                      <Ionicons name="chevron-back" size={18} color={c.text} />
                    </TouchableOpacity>
                    <Text style={[styles.pickerHeaderTitle, { color: c.text }]}>
                      Select Year ({decadeBase} – {decadeBase + 11})
                    </Text>
                    <TouchableOpacity
                      onPress={() => setDecadeBase((d) => d + 12)}
                      style={styles.pickerHeaderArrow}
                    >
                      <Ionicons name="chevron-forward" size={18} color={c.text} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.gridSelectorWrap}>
                    {Array.from({ length: 12 }, (_, i) => decadeBase + i).map((yr) => {
                      const isCurrent = yr === viewYear;
                      return (
                        <TouchableOpacity
                          key={yr}
                          activeOpacity={0.7}
                          onPress={() => handleSelectYear(yr)}
                          style={[
                            styles.selectorChip,
                            {
                              backgroundColor: isCurrent ? c.primary : c.inputBg,
                              borderColor: c.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.selectorChipText,
                              {
                                color: isCurrent ? (isLight ? '#FFFFFF' : '#10120E') : c.text,
                                fontWeight: isCurrent ? '800' : '600',
                              },
                            ]}
                          >
                            {yr}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    onPress={() => setPickerMode('none')}
                    style={[styles.backToDaysBtn, { borderColor: c.border }]}
                  >
                    <Ionicons name="arrow-back" size={14} color={c.primary} />
                    <Text style={[styles.backToDaysText, { color: c.primary }]}>Back to Calendar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* VIEW 2: Quick Month Picker Grid */}
              {pickerMode === 'month' && (
                <View style={styles.pickerContainer}>
                  <View style={styles.pickerHeaderRow}>
                    <Text style={[styles.pickerHeaderTitle, { color: c.text }]}>
                      Select Month ({viewYear})
                    </Text>
                  </View>

                  <View style={styles.gridSelectorWrap}>
                    {MONTH_NAMES.map((name, idx) => {
                      const isCurrent = idx === viewMonth;
                      return (
                        <TouchableOpacity
                          key={idx}
                          activeOpacity={0.7}
                          onPress={() => handleSelectMonth(idx)}
                          style={[
                            styles.selectorChip,
                            {
                              backgroundColor: isCurrent ? c.primary : c.inputBg,
                              borderColor: c.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.selectorChipText,
                              {
                                color: isCurrent ? (isLight ? '#FFFFFF' : '#10120E') : c.text,
                                fontWeight: isCurrent ? '800' : '600',
                              },
                            ]}
                          >
                            {name.slice(0, 3)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    onPress={() => setPickerMode('none')}
                    style={[styles.backToDaysBtn, { borderColor: c.border }]}
                  >
                    <Ionicons name="arrow-back" size={14} color={c.primary} />
                    <Text style={[styles.backToDaysText, { color: c.primary }]}>Back to Calendar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* VIEW 3: Standard Day Calendar Grid */}
              {pickerMode === 'none' && (
                <>
                  {/* Day Labels Row: 7 columns, width 14.28% each */}
                  <View style={styles.dayLabelsRow}>
                    {DAY_LABELS.map((d, idx) => (
                      <View key={idx} style={styles.colContainer}>
                        <Text style={[styles.dayLabel, { color: c.textMuted }]}>
                          {d}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Grid of Days: strictly 7 columns per row */}
                  <View style={styles.grid}>
                    {calendarCells.map((day, idx) => {
                      if (day === null) {
                        return <View key={idx} style={styles.colContainer} />;
                      }

                      const cellDateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const isSelected = selectedDateStr === cellDateStr;
                      const isToday = todayStr === cellDateStr;

                      return (
                        <View key={idx} style={styles.colContainer}>
                          <TouchableOpacity
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
                        </View>
                      );
                    })}
                  </View>
                </>
              )}

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
    maxHeight: '94%',
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
  navControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  controlPill: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  navArrowBtn: {
    padding: 6,
  },
  pillTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  pillText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  pickerContainer: {
    paddingVertical: 8,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  pickerHeaderArrow: {
    padding: 4,
  },
  pickerHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  gridSelectorWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  selectorChip: {
    width: '31%',
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  selectorChipText: {
    fontSize: 13,
  },
  backToDaysBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  backToDaysText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dayLabelsRow: {
    flexDirection: 'row',
    marginBottom: 8,
    width: '100%',
  },
  colContainer: {
    width: '14.285%',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  dayLabel: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  dayCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
