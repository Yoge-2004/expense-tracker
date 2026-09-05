import { saveFileToDevice } from "../utils/fileDownloader";
/**
 * @file MonthlyReportModal.tsx
 * @description Monthly Financial Report generation & dispatch modal.
 * Dynamically computes available years & months based on account inception date.
 * Authenticated HTML report generation and system share sheet integration.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Share,
  Dimensions,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { Colors, getCategoryColor } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { apiRequest, ApiError, API_BASE_URL, getSession } from '../services/api';
import { getCurrencySymbol } from '../services/currency';

// Dynamic dimensions calculated inside component

const ALL_MONTHS = [
  { num: 1, name: 'Jan', full: 'January' },
  { num: 2, name: 'Feb', full: 'February' },
  { num: 3, name: 'Mar', full: 'March' },
  { num: 4, name: 'Apr', full: 'April' },
  { num: 5, name: 'May', full: 'May' },
  { num: 6, name: 'Jun', full: 'June' },
  { num: 7, name: 'Jul', full: 'July' },
  { num: 8, name: 'Aug', full: 'August' },
  { num: 9, name: 'Sep', full: 'September' },
  { num: 10, name: 'Oct', full: 'October' },
  { num: 11, name: 'Nov', full: 'November' },
  { num: 12, name: 'Dec', full: 'December' },
];

interface MonthlyReportModalProps {
  visible: boolean;
  onClose: () => void;
}

export const MonthlyReportModal: React.FC<MonthlyReportModalProps> = ({ visible, onClose }) => {
  const { userId, userName, theme, currency } = useAuth();
  const { showAlert } = useAlert();
  const c = Colors[theme || 'dark'];
  const isLight = theme === 'light';
  const currSym = getCurrencySymbol(currency);

  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 600;
  const modalEffectiveWidth = Math.min(width - 40, 560);
  const monthChipWidth = Math.floor((modalEffectiveWidth - 48) / 4);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-indexed

  // Dynamic Inception Bounds
  const [startYear, setStartYear] = useState<number>(currentYear);
  const [startMonth, setStartMonth] = useState<number>(currentMonth);
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);

  // Selection
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [loading, setLoading] = useState(false);

  // Structured Report & HTML Preview state
  const [reportData, setReportData] = useState<any>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  /**
   * Discovers earliest transaction or account start date.
   */
  useEffect(() => {
    async function determineInception() {
      if (!userId || !visible) return;
      try {
        const expenses = await apiRequest(`/expenses/user/${userId}`);
        if (Array.isArray(expenses) && expenses.length > 0) {
          // Find earliest date
          const dates = expenses
            .map((e) => e.expenseDate)
            .filter(Boolean)
            .sort();
          if (dates.length > 0) {
            const earliest = new Date(dates[0]);
            const eYear = earliest.getFullYear();
            const eMonth = earliest.getMonth() + 1;
            if (!isNaN(eYear) && eYear >= 2020 && eYear <= currentYear) {
              setStartYear(eYear);
              setStartMonth(eMonth);

              const yearsList: number[] = [];
              for (let y = eYear; y <= currentYear; y++) {
                yearsList.push(y);
              }
              setAvailableYears(yearsList.reverse()); // Latest first
              setSelectedYear(currentYear);
              setSelectedMonth(currentMonth);
              return;
            }
          }
        }
      } catch (e) {
        console.warn('[MonthlyReportModal] Could not compute inception date:', e);
      }
      // Fallback
      setStartYear(currentYear);
      setStartMonth(1);
      setAvailableYears([currentYear]);
      setSelectedYear(currentYear);
      setSelectedMonth(currentMonth);
    }

    if (visible) {
      determineInception();
    }
  }, [visible, userId]);

  /**
   * Determines if a specific month in the selected year is selectable.
   */
  const isMonthValid = (monthNum: number): boolean => {
    if (selectedYear === currentYear && monthNum > currentMonth) {
      return false; // Future month
    }
    if (selectedYear === startYear && monthNum < startMonth) {
      return false; // Month prior to account start
    }
    return true;
  };

  /**
   * Fetches both the authenticated JSON report and HTML document from backend.
   */
  const handleFetchReport = async () => {
    if (!userId) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const session = await getSession();
      const token = session?.token;

      // 1. Fetch JSON structured report
      const jsonRes = await apiRequest(
        `/reports/monthly/user/${userId}?year=${selectedYear}&month=${selectedMonth}`
      );
      setReportData(jsonRes);

      // 2. Fetch authenticated standalone HTML report
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const htmlRes = await fetch(
        `${API_BASE_URL}/reports/monthly/user/${userId}/html?year=${selectedYear}&month=${selectedMonth}`,
        { headers }
      );

      if (htmlRes.ok) {
        const text = await htmlRes.text();
        setPreviewHtml(text);
      }

      setShowPreviewModal(true);
    } catch (err: any) {
      console.warn('[MonthlyReportModal] Failed to generate monthly report:', err);
      const msg = err instanceof ApiError ? err.message : 'Could not generate report for the selected month.';
      showAlert('Report Unavailable', msg, undefined, 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Dispatches email report with SMTP configuration guard.
   */
  const handleSendEmail = async () => {
    if (!userId) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      // 1. Check if backend SMTP mail service is enabled
      let isEmailConfigured = false;
      try {
        const configRes = await apiRequest('/auth/config');
        if (configRes && typeof configRes.emailVerificationEnabled === 'boolean') {
          isEmailConfigured = configRes.emailVerificationEnabled;
        }
      } catch {
        isEmailConfigured = false;
      }

      if (!isEmailConfigured) {
        showAlert(
          'Email Not Configured',
          'The backend mail server is not configured. Opening your Financial Statement in HTML view directly.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open HTML Statement',
              style: 'default',
              onPress: () => handleFetchReport(),
            },
          ],
          'warning'
        );
        return;
      }

      // 2. Dispatch monthly report email via backend
      await apiRequest(
        `/reports/monthly/user/${userId}/send-email?year=${selectedYear}&month=${selectedMonth}`,
        { method: 'POST' }
      );
      const monthObj = ALL_MONTHS.find((m) => m.num === selectedMonth);
      showAlert(
        'Statement Dispatched',
        `The ${monthObj?.full} ${selectedYear} financial statement was emailed successfully.`,
        undefined,
        'success'
      );
      onClose();
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Could not dispatch monthly report email.';
      showAlert('Dispatch Failed', msg, undefined, 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Generates physical .html file on device storage and dispatches native file share dialog.
   */
  const handleShareHtml = async () => {
    if (!previewHtml) {
      showAlert('Notice', 'HTML report content is still compiling. Please retry in a moment.', undefined, 'info');
      return;
    }
    try {
      Haptics.selectionAsync().catch(() => {});
      const sanitizedName = (userName || 'User').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'User';
      const fileName = `${sanitizedName}_Financial_Statement_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.html`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      // Write standalone HTML document to device cache
      await FileSystem.writeAsStringAsync(fileUri, previewHtml, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Dismiss modals before invoking native system share dialog so Android Dialog window does not block touches
      setShowPreviewModal(false);
      onClose();

      setTimeout(async () => {
        try {
          await saveFileToDevice(
            fileUri,
            fileName,
            "text/html",
            "public.html"
          );
        } catch (shareErr: any) {
          console.warn('[MonthlyReportModal] Delayed share invocation error:', shareErr);
        }
      }, 300);
    } catch (e: any) {
      console.warn('[MonthlyReportModal] File sharing failed:', e);
      showAlert('Export Error', e.message || 'Could not export HTML statement file.', undefined, 'error');
    }
  };

  const selectedMonthObj = ALL_MONTHS.find((m) => m.num === selectedMonth);

  return (
    <>
      {/* Main Period Selection Modal */}
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={[styles.backdrop, { justifyContent: isLargeScreen ? 'center' : 'flex-end', padding: isLargeScreen ? 20 : 0 }]}>
          <View style={[styles.card, {
            backgroundColor: c.card,
            borderColor: c.border,
            borderBottomLeftRadius: isLargeScreen ? 28 : 0,
            borderBottomRightRadius: isLargeScreen ? 28 : 0,
            maxWidth: 580,
            width: '100%',
            alignSelf: 'center',
          }]}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Ionicons name="document-text" size={24} color={c.primary} />
                <Text style={[styles.title, { color: c.text }]}>Financial Summary</Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={24} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              Account inception: <Text style={{ fontWeight: '700', color: c.text }}>{ALL_MONTHS[startMonth - 1]?.full} {startYear}</Text>
            </Text>

            {/* Year Selector */}
            <Text style={[styles.sectionLabel, { color: c.textMuted }]}>ACTIVE YEARS</Text>
            <View style={styles.yearRow}>
              {availableYears.map((y) => {
                const isSelected = selectedYear === y;
                return (
                  <TouchableOpacity
                    key={y}
                    activeOpacity={0.8}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedYear(y);
                      // Adjust selected month if invalid in new year
                      if (y === currentYear && selectedMonth > currentMonth) {
                        setSelectedMonth(currentMonth);
                      } else if (y === startYear && selectedMonth < startMonth) {
                        setSelectedMonth(startMonth);
                      }
                    }}
                    style={[
                      styles.yearChip,
                      {
                        backgroundColor: isSelected ? c.primary : c.inputBg,
                        borderColor: isSelected ? c.primary : c.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.yearChipText,
                        {
                          color: isSelected ? (isLight ? '#FFF' : '#10120E') : c.text,
                          fontWeight: isSelected ? '800' : '600',
                        },
                      ]}
                    >
                      {y}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Month Selector Grid */}
            <Text style={[styles.sectionLabel, { color: c.textMuted }]}>SELECT MONTH</Text>
            <View style={styles.monthsGrid}>
              {ALL_MONTHS.map((m) => {
                const isSelected = selectedMonth === m.num;
                const isValid = isMonthValid(m.num);

                return (
                  <TouchableOpacity
                    key={m.num}
                    activeOpacity={0.8}
                    disabled={!isValid}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedMonth(m.num);
                    }}
                    style={[
                      styles.monthChip,
                      {
                        width: monthChipWidth,
                        backgroundColor: isSelected ? c.primary : (isValid ? c.inputBg : 'transparent'),
                        borderColor: isSelected ? c.primary : (isValid ? c.border : 'rgba(150,150,150,0.15)'),
                        opacity: isValid ? 1 : 0.3,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.monthChipText,
                        {
                          color: isSelected
                            ? (isLight ? '#FFF' : '#10120E')
                            : (isValid ? c.text : c.textMuted),
                          fontWeight: isSelected ? '800' : '600',
                        },
                      ]}
                    >
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selected Period Banner */}
            <View style={[styles.summaryBanner, { backgroundColor: c.primary + '14', borderColor: c.primary + '30' }]}>
              <Ionicons name="calendar" size={16} color={c.primary} />
              <Text style={[styles.summaryBannerText, { color: c.text }]}>
                Report Period: <Text style={{ fontWeight: '800', color: c.primary }}>{selectedMonthObj?.full} {selectedYear}</Text>
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsCol}>
              {/* Option 1: View / Share HTML Statement */}
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={loading}
                onPress={handleFetchReport}
                style={[styles.primaryActionBtn, { backgroundColor: c.primary }]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={isLight ? '#FFF' : '#10120E'} />
                ) : (
                  <>
                    <Ionicons name="document-text-outline" size={18} color={isLight ? '#FFF' : '#10120E'} />
                    <Text style={[styles.primaryActionText, { color: isLight ? '#FFF' : '#10120E' }]}>
                      View Financial Statement
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Option 2: Dispatch Email Report */}
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={loading}
                onPress={handleSendEmail}
                style={[styles.secondaryActionBtn, { backgroundColor: c.inputBg, borderColor: c.border }]}
              >
                <Ionicons name="mail-outline" size={18} color={c.text} />
                <Text style={[styles.secondaryActionText, { color: c.text }]}>
                  Email Statement
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Visual Report & HTML Statement Viewer Modal */}
      <Modal
        visible={showPreviewModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={[styles.previewBackdrop, { justifyContent: isLargeScreen ? 'center' : 'flex-end', padding: isLargeScreen ? 20 : 0 }]}>
          <View style={[styles.previewCard, {
            backgroundColor: c.card,
            borderColor: c.border,
            borderBottomLeftRadius: isLargeScreen ? 28 : 0,
            borderBottomRightRadius: isLargeScreen ? 28 : 0,
            maxWidth: 620,
            width: '100%',
            alignSelf: 'center',
          }]}>
            <View style={styles.previewHeader}>
              <View>
                <Text style={[styles.previewTitle, { color: c.text }]}>
                  {selectedMonthObj?.full} {selectedYear} Statement
                </Text>
                <Text style={[styles.previewSub, { color: c.textMuted }]}>
                  Consolidated Monthly Ledger & Analysis
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowPreviewModal(false)}>
                <Ionicons name="close-circle" size={26} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Report Content */}
            <ScrollView
              style={styles.previewScroll}
              contentContainerStyle={styles.previewScrollContent}
              showsVerticalScrollIndicator={true}
            >
              {reportData && (
                <>
                  {/* Top Matrix Highlights */}
                  <View style={styles.reportHighlightGrid}>
                    <View style={[styles.reportHighlightCard, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                      <Text style={[styles.rhLabel, { color: c.textMuted }]}>TOTAL OUTFLOW</Text>
                      <Text style={[styles.rhVal, { color: c.text }]}>
                        {currSym}{Number(reportData.totalOutflow || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <View style={[styles.reportHighlightCard, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                      <Text style={[styles.rhLabel, { color: c.textMuted }]}>DAILY AVERAGE</Text>
                      <Text style={[styles.rhVal, { color: c.teal }]}>
                        {currSym}{Number(reportData.dailyAverage || 0).toLocaleString('en-IN')}/d
                      </Text>
                    </View>
                  </View>

                  {/* Executive Insights */}
                  {Array.isArray(reportData.insights) && reportData.insights.length > 0 && (
                    <View style={[styles.reportSectionBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                      <Text style={[styles.reportSectionTitle, { color: c.primary }]}>💡 Executive Insights</Text>
                      {reportData.insights.map((ins: string, idx: number) => {
                        const cleanIns = ins.replace(/<[^>]*>?/gm, ''); // strip html tags for clean display
                        return (
                          <Text key={idx} style={[styles.insightItemText, { color: c.text }]}>
                            • {cleanIns}
                          </Text>
                        );
                      })}
                    </View>
                  )}

                  {/* Category Breakdown */}
                  {Array.isArray(reportData.categoryBreakdown) && reportData.categoryBreakdown.length > 0 && (
                    <View style={[styles.reportSectionBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                      <Text style={[styles.reportSectionTitle, { color: c.text }]}>📊 Category Breakdown</Text>
                      {reportData.categoryBreakdown.map((cat: any, idx: number) => (
                        <View key={idx} style={[styles.catRow, { borderBottomColor: c.border }]}>
                          <Text style={[styles.catRowName, { color: c.text }]}>{cat.categoryName}</Text>
                          <View style={styles.catRowRight}>
                            <Text style={[styles.catRowAmt, { color: c.text }]}>
                              {currSym}{Number(cat.totalAmount || 0).toLocaleString('en-IN')}
                            </Text>
                            <Text style={[styles.catRowPct, { color: c.textMuted }]}>
                              ({cat.percentage}%)
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Top Expenses */}
                  {Array.isArray(reportData.topExpenses) && reportData.topExpenses.length > 0 && (
                    <View style={[styles.reportSectionBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                      <Text style={[styles.reportSectionTitle, { color: c.text }]}>🏷️ Peak Outflow Transactions</Text>
                      {reportData.topExpenses.map((exp: any, idx: number) => (
                        <View key={idx} style={[styles.topExpRow, { borderBottomColor: c.border }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.topExpDesc, { color: c.text }]} numberOfLines={1}>
                              {exp.description}
                            </Text>
                            <Text style={[styles.topExpDate, { color: c.textMuted }]}>
                              {exp.expenseDate} · {exp.categoryName || 'General'}
                            </Text>
                          </View>
                          <Text style={[styles.topExpAmt, { color: c.text }]}>
                            -{currSym}{Number(exp.amount || 0).toLocaleString('en-IN')}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {/* Action Bar */}
            <View style={styles.previewActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleShareHtml}
                style={[styles.shareBtn, { backgroundColor: c.primary }]}
              >
                <Ionicons name="share-social" size={18} color={isLight ? '#FFF' : '#10120E'} />
                <Text style={[styles.shareBtnText, { color: isLight ? '#FFF' : '#10120E' }]}>
                  Share / Export HTML Statement
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 20,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12.5,
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  yearRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  yearChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearChipText: {
    fontSize: 13,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  monthChip: {
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthChipText: {
    fontSize: 12.5,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryBannerText: {
    fontSize: 13,
  },
  actionsCol: {
    gap: 10,
    marginBottom: 10,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  previewCard: {
    width: '100%',
    maxHeight: '88%',
    height: '85%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  previewSub: {
    fontSize: 12,
    marginTop: 1,
  },
  previewScroll: {
    flex: 1,
    marginBottom: 14,
  },
  previewScrollContent: {
    gap: 12,
    paddingBottom: 16,
  },
  reportHighlightGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  reportHighlightCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  rhLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  rhVal: {
    fontSize: 16,
    fontWeight: '900',
  },
  reportSectionBox: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  reportSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  insightItemText: {
    fontSize: 12,
    lineHeight: 18,
  },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
  },
  catRowName: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  catRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catRowAmt: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  catRowPct: {
    fontSize: 11,
  },
  topExpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
  },
  topExpDesc: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  topExpDate: {
    fontSize: 11,
    marginTop: 1,
  },
  topExpAmt: {
    fontSize: 13,
    fontWeight: '800',
  },
  previewActions: {
    width: '100%',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
