import { saveFileToDevice } from "../utils/fileDownloader";
/**
 * @file ExportImportModal.tsx
 * @description Modal providing multi-format data export (Excel .xlsx PowerBI dashboard,
 * PDF financial statement, CSV, JSON, Plaintext summary) as real downloadable files
 * via expo-file-system and expo-sharing, along with native file-picker imports (.xlsx, .csv, .json)
 * using expo-document-picker and expo-file-system multipart upload.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { Colors } from '../constants/theme';
import { apiRequest, API_BASE_URL } from '../services/api';
import { getCurrencySymbol } from '../services/currency';
import { Ionicons } from '@expo/vector-icons';

interface ExportImportModalProps {
  /** Controls modal display state. */
  visible: boolean;
  /** Active transaction collection to export. */
  expenses: any[];
  /** Callback fired when user closes the modal. */
  onClose: () => void;
  /** Callback triggered after a successful ingestion to reload dashboard data. */
  onDataImported: () => void;
}

/**
 * Enterprise Data Hub & Portability modal component.
 */
export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  visible,
  expenses,
  onClose,
  onDataImported,
}) => {
  const { userId, token, theme, currency } = useAuth();
  const { showAlert } = useAlert();
  const c = Colors[theme];
  const currSym = getCurrencySymbol(currency);

  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 600;

  const [jsonInput, setJsonInput] = useState('');
  const [showJsonBox, setShowJsonBox] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  /**
   * Helper to ensure a clean local directory path for saving export files.
   */
  const getBaseDir = () => {
    return FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  };

  /**
   * Downloads and shares PowerBI-grade Excel Workbook (.xlsx) file.
   */
  const handleExportExcel = async () => {
    try {
      setActiveAction('export-excel');
      const filename = `financial_statement_dashboard_${Date.now()}.xlsx`;
      const fileUri = `${getBaseDir()}${filename}`;
      const url = `${API_BASE_URL}/reports/user/${userId}/export/excel`;

      const downloadResult = await FileSystem.downloadAsync(url, fileUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (downloadResult.status !== 200) {
        throw new Error(`Server returned HTTP ${downloadResult.status}`);
      }

      await saveFileToDevice(
        downloadResult.uri,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "com.microsoft.excel.xlsx"
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      showAlert('Export Failed', e.message || 'Could not download Excel file.');
    } finally {
      setActiveAction(null);
    }
  };

  /**
   * Downloads and shares PDF Executive Financial Statement.
   */
  const handleExportPDF = async () => {
    try {
      setActiveAction('export-pdf');
      const filename = `financial_statement_${Date.now()}.pdf`;
      const fileUri = `${getBaseDir()}${filename}`;
      const url = `${API_BASE_URL}/reports/user/${userId}/export/pdf`;

      const downloadResult = await FileSystem.downloadAsync(url, fileUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (downloadResult.status !== 200) {
        throw new Error(`Server returned HTTP ${downloadResult.status}`);
      }

      await saveFileToDevice(
        downloadResult.uri,
        filename,
        "application/pdf",
        "com.adobe.pdf"
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      showAlert('Export Failed', e.message || 'Could not download PDF file.');
    } finally {
      setActiveAction(null);
    }
  };

  /**
   * Generates, writes, and shares actual CSV file.
   */
  const handleExportCSV = async () => {
    if (!expenses || expenses.length === 0) {
      showAlert('No Data', 'No transactions found to export.');
      return;
    }
    try {
      setActiveAction('export-csv');
      const csvHeader = 'ID,Description,Amount,Date,Category,Recurring\n';
      const csvRows = expenses
        .map((e) => {
          const desc = (e.description || '').replace(/"/g, '""');
          const isRec = e.isRecurring || e.recurring ? 'Yes' : 'No';
          return `${e.id},"${desc}",${e.amount},${e.expenseDate},"${e.categoryName || 'General'}",${isRec}`;
        })
        .join('\n');

      const filename = `expenses_${Date.now()}.csv`;
      const fileUri = `${getBaseDir()}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, csvHeader + csvRows, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await saveFileToDevice(
        fileUri,
        filename,
        "text/csv",
        "public.comma-separated-values-text"
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      showAlert('Export Failed', e.message || 'Could not export CSV file.');
    } finally {
      setActiveAction(null);
    }
  };

  /**
   * Generates, writes, and shares actual JSON file.
   */
  const handleExportJSON = async () => {
    if (!expenses || expenses.length === 0) {
      showAlert('No Data', 'No transactions found to export.');
      return;
    }
    try {
      setActiveAction('export-json');
      const jsonData = JSON.stringify(expenses, null, 2);
      const filename = `expenses_${Date.now()}.json`;
      const fileUri = `${getBaseDir()}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, jsonData, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await saveFileToDevice(
        fileUri,
        filename,
        "application/json",
        "public.json"
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      showAlert('Export Failed', e.message || 'Could not export JSON file.');
    } finally {
      setActiveAction(null);
    }
  };

  /**
   * Generates human-readable executive summary text file.
   */
  const handleExportSummary = async () => {
    if (!expenses || expenses.length === 0) {
      showAlert('No Data', 'No transactions found to export.');
      return;
    }
    try {
      setActiveAction('export-summary');
      const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
      const summaryText =
        `--- FINANCIAL REPORT SUMMARY ---\n` +
        `Generated: ${new Date().toLocaleString()}\n` +
        `Total Transactions: ${expenses.length}\n` +
        `Total Outflow: ${currSym}${total.toLocaleString('en-IN')}\n\n` +
        `Top Transactions:\n` +
        expenses
          .slice(0, 15)
          .map((e) => `• ${e.expenseDate} | ${e.categoryName}: ${currSym}${e.amount} (${e.description})`)
          .join('\n');

      const filename = `Financial_Summary_${Date.now()}.txt`;
      const fileUri = `${getBaseDir()}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, summaryText, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await saveFileToDevice(
        fileUri,
        filename,
        "text/plain",
        "public.plain-text"
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      showAlert('Export Failed', e.message || 'Could not export summary.');
    } finally {
      setActiveAction(null);
    }
  };

  /**
   * Prompts native document picker to select an Excel, CSV, or JSON file and uploads it.
   */
  const handlePickAndImport = async (fileType: 'excel' | 'csv' | 'json') => {
    try {
      setActiveAction(`import-${fileType}`);
      const mimeTypes =
        fileType === 'excel'
          ? [
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/vnd.ms-excel',
            ]
          : fileType === 'csv'
          ? ['text/csv', 'text/comma-separated-values', 'application/csv']
          : ['application/json'];

      const result = await DocumentPicker.getDocumentAsync({
        type: mimeTypes,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const uploadUrl = `${API_BASE_URL}/expenses/user/${userId}/import/${fileType}`;

      const uploadRes = await FileSystem.uploadAsync(uploadUrl, asset.uri, {
        fieldName: 'file',
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (uploadRes.status < 200 || uploadRes.status >= 300) {
        throw new Error(uploadRes.body || `Server returned HTTP ${uploadRes.status}`);
      }

      let data: any = {};
      try {
        data = JSON.parse(uploadRes.body);
      } catch (_) {}

      const imported = data.imported ?? 0;
      const failed = data.failedRows ?? 0;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert(
        'Import Successful! 📊',
        `Successfully imported ${imported} transaction(s).` +
          (failed > 0 ? ` (${failed} row(s) skipped due to format issues).` : '')
      );
      onDataImported();
      onClose();
    } catch (e: any) {
      showAlert('Import Failed', e.message || `Failed to process ${fileType} import.`);
    } finally {
      setActiveAction(null);
    }
  };

  /**
   * Ingests, parses, and sends pasted bulk JSON expense entries to the backend.
   */
  const handleImportJSONText = async () => {
    if (!jsonInput.trim() || !userId) {
      showAlert('Empty Input', 'Please paste valid JSON expense objects.');
      return;
    }

    try {
      setActiveAction('import-json-text');
      const parsed = JSON.parse(jsonInput);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      let successCount = 0;
      for (const item of items) {
        if (item.amount && item.description) {
          try {
            await apiRequest(`/expenses/user/${userId}`, {
              method: 'POST',
              body: JSON.stringify({
                description: item.description,
                amount: Number(item.amount),
                expenseDate: item.expenseDate || new Date().toISOString().split('T')[0],
                categoryId: item.categoryId || 1,
              }),
            });
            successCount++;
          } catch (e) {
            // Continue batch
          }
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert('Import Complete', `Successfully imported ${successCount} expense(s).`);
      setJsonInput('');
      setShowJsonBox(false);
      onDataImported();
      onClose();
    } catch (e: any) {
      showAlert('Invalid JSON', 'Please verify your JSON syntax and try again.');
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { justifyContent: isLargeScreen ? 'center' : 'flex-end', padding: isLargeScreen ? 24 : 0 }]}>
        <View style={[styles.modalCard, {
          backgroundColor: c.surface,
          borderColor: c.border,
          borderBottomLeftRadius: isLargeScreen ? 28 : 0,
          borderBottomRightRadius: isLargeScreen ? 28 : 0,
          maxWidth: 640,
          width: '100%',
          alignSelf: 'center',
        }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: c.text }]}>Data Hub & Reports</Text>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                Export real files or import transaction records
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: c.inputBg }]}>
              <Ionicons name="close" size={20} color={c.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Section 1: EXPORT REAL FILES */}
            <Text style={[styles.sectionHeader, { color: c.textMuted }]}>
              EXPORT REAL FILES (.xlsx, .pdf, .csv, .json)
            </Text>
            <View style={styles.actionsGrid}>
              {/* Excel PowerBI */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleExportExcel}
                disabled={activeAction !== null}
                style={[styles.actionCard, { backgroundColor: c.inputBg, borderColor: c.border }]}
              >
                <View style={[styles.iconBox, { backgroundColor: '#107C4120' }]}>
                  {activeAction === 'export-excel' ? (
                    <ActivityIndicator size="small" color="#107C41" />
                  ) : (
                    <Ionicons name="bar-chart" size={22} color="#107C41" />
                  )}
                </View>
                <Text style={[styles.actionTitle, { color: c.text }]}>Excel Dashboard</Text>
                <Text style={[styles.actionSub, { color: c.textMuted }]}>.xlsx PowerBI file</Text>
              </TouchableOpacity>

              {/* PDF Financial Statement */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleExportPDF}
                disabled={activeAction !== null}
                style={[styles.actionCard, { backgroundColor: c.inputBg, borderColor: c.border }]}
              >
                <View style={[styles.iconBox, { backgroundColor: '#EF444420' }]}>
                  {activeAction === 'export-pdf' ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Ionicons name="newspaper-outline" size={22} color="#EF4444" />
                  )}
                </View>
                <Text style={[styles.actionTitle, { color: c.text }]}>PDF Statement</Text>
                <Text style={[styles.actionSub, { color: c.textMuted }]}>.pdf executive file</Text>
              </TouchableOpacity>

              {/* CSV */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleExportCSV}
                disabled={activeAction !== null}
                style={[styles.actionCard, { backgroundColor: c.inputBg, borderColor: c.border }]}
              >
                <View style={[styles.iconBox, { backgroundColor: c.primary + '20' }]}>
                  {activeAction === 'export-csv' ? (
                    <ActivityIndicator size="small" color={c.primary} />
                  ) : (
                    <Ionicons name="document-text" size={22} color={c.primary} />
                  )}
                </View>
                <Text style={[styles.actionTitle, { color: c.text }]}>Export CSV</Text>
                <Text style={[styles.actionSub, { color: c.textMuted }]}>.csv spreadsheet</Text>
              </TouchableOpacity>

              {/* JSON */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleExportJSON}
                disabled={activeAction !== null}
                style={[styles.actionCard, { backgroundColor: c.inputBg, borderColor: c.border }]}
              >
                <View style={[styles.iconBox, { backgroundColor: c.teal + '20' }]}>
                  {activeAction === 'export-json' ? (
                    <ActivityIndicator size="small" color={c.teal} />
                  ) : (
                    <Ionicons name="code-slash" size={22} color={c.teal} />
                  )}
                </View>
                <Text style={[styles.actionTitle, { color: c.text }]}>Export JSON</Text>
                <Text style={[styles.actionSub, { color: c.textMuted }]}>.json raw ledger</Text>
              </TouchableOpacity>

              {/* Summary / Report */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleExportSummary}
                disabled={activeAction !== null}
                style={[styles.actionCard, { backgroundColor: c.inputBg, borderColor: c.border }]}
              >
                <View style={[styles.iconBox, { backgroundColor: c.accent + '20' }]}>
                  {activeAction === 'export-summary' ? (
                    <ActivityIndicator size="small" color={c.accent} />
                  ) : (
                    <Ionicons name="reader" size={22} color={c.accent} />
                  )}
                </View>
                <Text style={[styles.actionTitle, { color: c.text }]}>Summary .txt</Text>
                <Text style={[styles.actionSub, { color: c.textMuted }]}>Text breakdown</Text>
              </TouchableOpacity>
            </View>

            {/* Section 2: IMPORT LEDGER FILES */}
            <Text style={[styles.sectionHeader, { color: c.textMuted, marginTop: 22 }]}>
              IMPORT LEDGER FILES & INGESTION
            </Text>
            <View style={styles.actionsGrid}>
              {/* Import Excel */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handlePickAndImport('excel')}
                disabled={activeAction !== null}
                style={[styles.actionCard, { backgroundColor: c.inputBg, borderColor: c.border }]}
              >
                <View style={[styles.iconBox, { backgroundColor: '#107C4120' }]}>
                  {activeAction === 'import-excel' ? (
                    <ActivityIndicator size="small" color="#107C41" />
                  ) : (
                    <Ionicons name="cloud-upload" size={22} color="#107C41" />
                  )}
                </View>
                <Text style={[styles.actionTitle, { color: c.text }]}>Import Excel</Text>
                <Text style={[styles.actionSub, { color: c.textMuted }]}>Pick .xlsx file</Text>
              </TouchableOpacity>

              {/* Import CSV */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handlePickAndImport('csv')}
                disabled={activeAction !== null}
                style={[styles.actionCard, { backgroundColor: c.inputBg, borderColor: c.border }]}
              >
                <View style={[styles.iconBox, { backgroundColor: c.primary + '20' }]}>
                  {activeAction === 'import-csv' ? (
                    <ActivityIndicator size="small" color={c.primary} />
                  ) : (
                    <Ionicons name="cloud-upload-outline" size={22} color={c.primary} />
                  )}
                </View>
                <Text style={[styles.actionTitle, { color: c.text }]}>Import CSV</Text>
                <Text style={[styles.actionSub, { color: c.textMuted }]}>Pick .csv file</Text>
              </TouchableOpacity>

              {/* Import JSON File */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handlePickAndImport('json')}
                disabled={activeAction !== null}
                style={[styles.actionCard, { backgroundColor: c.inputBg, borderColor: c.border }]}
              >
                <View style={[styles.iconBox, { backgroundColor: c.teal + '20' }]}>
                  {activeAction === 'import-json' ? (
                    <ActivityIndicator size="small" color={c.teal} />
                  ) : (
                    <Ionicons name="document-attach-outline" size={22} color={c.teal} />
                  )}
                </View>
                <Text style={[styles.actionTitle, { color: c.text }]}>Import JSON</Text>
                <Text style={[styles.actionSub, { color: c.textMuted }]}>Pick .json file</Text>
              </TouchableOpacity>

              {/* Paste JSON */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowJsonBox(!showJsonBox)}
                disabled={activeAction !== null}
                style={[styles.actionCard, { backgroundColor: c.inputBg, borderColor: c.border }]}
              >
                <View style={[styles.iconBox, { backgroundColor: c.sage + '20' }]}>
                  <Ionicons name="code-working-outline" size={22} color={c.sage} />
                </View>
                <Text style={[styles.actionTitle, { color: c.text }]}>Paste JSON</Text>
                <Text style={[styles.actionSub, { color: c.textMuted }]}>Manual input</Text>
              </TouchableOpacity>
            </View>

            {/* Expandable JSON Text Import Box */}
            {showJsonBox && (
              <View style={[styles.importBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <Text style={[styles.importLabel, { color: c.textMuted }]}>
                  Paste JSON Array of Expenses:
                </Text>
                <TextInput
                  style={[
                    styles.jsonInput,
                    {
                      backgroundColor: c.surface,
                      borderColor: c.border,
                      color: c.text,
                    },
                  ]}
                  multiline
                  numberOfLines={4}
                  value={jsonInput}
                  onChangeText={setJsonInput}
                  placeholder='[{"description": "Grocery", "amount": 450, "categoryId": 1}]'
                  placeholderTextColor={c.textMuted}
                />
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleImportJSONText}
                  disabled={activeAction !== null}
                  style={[styles.ingestBtn, { backgroundColor: c.primary }]}
                >
                  {activeAction === 'import-json-text' ? (
                    <ActivityIndicator size="small" color="#10120E" />
                  ) : (
                    <Text style={styles.ingestBtnText}>Ingest & Save Expenses</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 22,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    width: '48%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionSub: {
    fontSize: 11,
  },
  importBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  importLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  jsonInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  ingestBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingestBtnText: {
    color: '#10120E',
    fontWeight: '700',
    fontSize: 13,
  },
});
