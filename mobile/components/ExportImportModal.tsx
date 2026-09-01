/**
 * @file ExportImportModal.tsx
 * @description Modal providing multi-format data export (CSV, JSON, Plaintext Executive Summary)
 * via the native OS Share Sheet and bulk transaction import parsing JSON payloads.
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
  Alert,
  Share,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { Colors } from '../constants/theme';
import { apiRequest } from '../services/api';
import { getCurrencySymbol } from '../services/currency';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface ExportImportModalProps {
  /** Controls modal display state. */
  visible: boolean;
  /** Active transaction collection to export. */
  expenses: any[];
  /** Callback fired when user closes the modal. */
  onClose: () => void;
  /** Callback triggered after a successful JSON ingestion to reload dashboard data. */
  onDataImported: () => void;
}

/**
 * Data management and portability modal component.
 */
export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  visible,
  expenses,
  onClose,
  onDataImported,
}) => {
  const { userId, theme, currency } = useAuth();
  const { showAlert } = useAlert();
  const c = Colors[theme];
  const currSym = getCurrencySymbol(currency);

  const [jsonInput, setJsonInput] = useState('');
  const [showImportBox, setShowImportBox] = useState(false);
  const [importing, setImporting] = useState(false);

  /**
   * Generates and triggers native share for a formatted CSV file.
   */
  const handleExportCSV = async () => {
    if (!expenses || expenses.length === 0) {
      showAlert('No Data', 'No transactions found to export.');
      return;
    }
    try {
      const csvHeader = 'ID,Description,Amount,Date,Category,Recurring\n';
      const csvRows = expenses
        .map((e) => {
          const desc = (e.description || '').replace(/"/g, '""');
          const isRec = e.isRecurring || e.recurring ? 'Yes' : 'No';
          return `${e.id},"${desc}",${e.amount},${e.expenseDate},"${e.categoryName || 'General'}",${isRec}`;
        })
        .join('\n');

      await Share.share({
        title: 'Expenses_Export.csv',
        message: csvHeader + csvRows,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      showAlert('Export Failed', e.message || 'Could not export CSV.');
    }
  };

  /**
   * Generates and triggers native share for raw JSON backup.
   */
  const handleExportJSON = async () => {
    if (!expenses || expenses.length === 0) {
      showAlert('No Data', 'No transactions found to export.');
      return;
    }
    try {
      const jsonData = JSON.stringify(expenses, null, 2);
      await Share.share({
        title: 'Expenses_Export.json',
        message: jsonData,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      showAlert('Export Failed', e.message || 'Could not export JSON.');
    }
  };

  /**
   * Generates human-readable executive summary report.
   */
  const handleExportSummary = async () => {
    if (!expenses || expenses.length === 0) {
      showAlert('No Data', 'No transactions found to export.');
      return;
    }
    try {
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

      await Share.share({
        title: 'Financial_Summary_Report.txt',
        message: summaryText,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      showAlert('Export Failed', e.message || 'Could not export summary.');
    }
  };

  /**
   * Ingests, parses, and sends bulk expense entries to the backend.
   */
  const handleImportJSON = async () => {
    if (!jsonInput.trim() || !userId) {
      showAlert('Empty Input', 'Please paste valid JSON expense objects.');
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      setImporting(true);
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
            // Ignore single row fail and continue batch
          }
        }
      }

      setImporting(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert('Import Complete', `Successfully imported ${successCount} expense(s).`);
      setJsonInput('');
      setShowImportBox(false);
      onDataImported();
      onClose();
    } catch (e: any) {
      setImporting(false);
      showAlert('Invalid JSON', 'Please verify your JSON syntax and try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: c.text }]}>Data Hub & Reports</Text>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                Export your ledger or import transactions
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: c.inputBg }]}>
              <Ionicons name="close" size={20} color={c.text} />
            </TouchableOpacity>
          </View>

          {/* Action Cards */}
          <View style={styles.actionsGrid}>
            {/* CSV */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleExportCSV}
              style={[styles.actionCard, { backgroundColor: c.inputBg, borderColor: c.border }]}
            >
              <View style={[styles.iconBox, { backgroundColor: c.primary + '20' }]}>
                <Ionicons name="document-text" size={22} color={c.primary} />
              </View>
              <Text style={[styles.actionTitle, { color: c.text }]}>Export CSV</Text>
              <Text style={[styles.actionSub, { color: c.textMuted }]}>Spreadsheet ready</Text>
            </TouchableOpacity>

            {/* JSON */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleExportJSON}
              style={[styles.actionCard, { backgroundColor: c.inputBg, borderColor: c.border }]}
            >
              <View style={[styles.iconBox, { backgroundColor: c.teal + '20' }]}>
                <Ionicons name="code-slash" size={22} color={c.teal} />
              </View>
              <Text style={[styles.actionTitle, { color: c.text }]}>Export JSON</Text>
              <Text style={[styles.actionSub, { color: c.textMuted }]}>Raw data backup</Text>
            </TouchableOpacity>

            {/* Summary / Report */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleExportSummary}
              style={[styles.actionCard, { backgroundColor: c.inputBg, borderColor: c.border }]}
            >
              <View style={[styles.iconBox, { backgroundColor: c.accent + '20' }]}>
                <Ionicons name="reader" size={22} color={c.accent} />
              </View>
              <Text style={[styles.actionTitle, { color: c.text }]}>Share Summary</Text>
              <Text style={[styles.actionSub, { color: c.textMuted }]}>Executive overview</Text>
            </TouchableOpacity>

            {/* Import */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowImportBox(!showImportBox)}
              style={[styles.actionCard, { backgroundColor: c.inputBg, borderColor: c.border }]}
            >
              <View style={[styles.iconBox, { backgroundColor: c.sage + '20' }]}>
                <Ionicons name="cloud-upload" size={22} color={c.sage} />
              </View>
              <Text style={[styles.actionTitle, { color: c.text }]}>Import JSON</Text>
              <Text style={[styles.actionSub, { color: c.textMuted }]}>Paste & ingest</Text>
            </TouchableOpacity>
          </View>

          {/* Expandable JSON Import box */}
          {showImportBox && (
            <View style={styles.importBox}>
              <Text style={[styles.importLabel, { color: c.textMuted }]}>
                Paste JSON Array of Expenses:
              </Text>
              <TextInput
                style={[
                  styles.jsonInput,
                  {
                    backgroundColor: c.inputBg,
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
                onPress={handleImportJSON}
                disabled={importing}
                style={[styles.ingestBtn, { backgroundColor: c.primary }]}
              >
                {importing ? (
                  <ActivityIndicator size="small" color="#10120E" />
                ) : (
                  <Text style={styles.ingestBtnText}>Ingest & Save Expenses</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
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
    padding: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionSub: {
    fontSize: 11,
  },
  importBox: {
    gap: 8,
    marginTop: 8,
  },
  importLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  jsonInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    height: 90,
    textAlignVertical: 'top',
  },
  ingestBtn: {
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ingestBtnText: {
    color: '#10120E',
    fontWeight: '800',
    fontSize: 14,
  },
});
