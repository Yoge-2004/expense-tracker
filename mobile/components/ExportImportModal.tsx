import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { ThemedTextInput as TextInput } from './ThemedText';
import { ThemedText as Text } from './ThemedText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { saveFileToDevice } from '../utils/fileDownloader';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { Colors } from '../constants/theme';
import { apiRequest, API_BASE_URL, getSession } from '../services/api';
import { applyRestore, computeRestorePlan, exportDeviceCopy, importDeviceCopyFile } from '../services/ledgerVault';
import { planSamples } from '../utils/ledgerReconcile';

interface Props {
  visible: boolean;
  expenses: any[];
  onClose: () => void;
  onDataImported: () => void;
}

interface TransferProgressInfo {
  active: boolean;
  type: 'export' | 'import';
  filename: string;
  stage: string;
  percent: number;
  detail?: string;
  done?: boolean;
  timestamp?: number;
}

type RangeMode = 'month' | 'custom' | 'all';
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const STORAGE_TRANSFER_JOB_KEY = '@expense_tracker_active_transfer_job';

export const ExportImportModal: React.FC<Props> = ({ visible, onClose, onDataImported }) => {
  const {userId, token, theme, currency, themeColors} = useAuth();
  const { showAlert } = useAlert();
  const c = themeColors || Colors[theme];
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<RangeMode>('month');
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [json, setJson] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [transferProgress, setTransferProgress] = useState<TransferProgressInfo | null>(null);

  // Synchronize and persist transfer status so that OS low-power suspension or screen locks never lose transfer state
  const updateProgress = (info: TransferProgressInfo | null) => {
    setTransferProgress(info);
    if (!info) {
      AsyncStorage.removeItem(STORAGE_TRANSFER_JOB_KEY).catch(() => {});
    } else {
      AsyncStorage.setItem(
        STORAGE_TRANSFER_JOB_KEY,
        JSON.stringify({ ...info, timestamp: Date.now() })
      ).catch(() => {});
    }
  };

  useEffect(() => {
    // Restore any active/recent transfer task upon mount
    void AsyncStorage.getItem(STORAGE_TRANSFER_JOB_KEY).then((data) => {
      if (data) {
        try {
          const parsed: TransferProgressInfo = JSON.parse(data);
          // If task completed or updated within 2 hours, restore for visibility
          if (Date.now() - (parsed.timestamp || 0) < 7200000) {
            setTransferProgress(parsed);
          } else {
            AsyncStorage.removeItem(STORAGE_TRANSFER_JOB_KEY).catch(() => {});
          }
        } catch {}
      }
    }).catch(() => {});

    // Listen to device wake/app resume to recover in-flight or background-completed jobs
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        void AsyncStorage.getItem(STORAGE_TRANSFER_JOB_KEY).then((data) => {
          if (data) {
            try {
              const parsed: TransferProgressInfo = JSON.parse(data);
              if (Date.now() - (parsed.timestamp || 0) < 7200000) {
                setTransferProgress(parsed);
              }
            } catch {}
          }
        }).catch(() => {});
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  const range = useMemo(() => {
    if (mode === 'all') return { from: '', to: '', label: 'All time' };
    if (mode === 'custom')
      return { from, to, label: from && to ? `${from} to ${to}` : 'Choose a start and end date' };
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = new Date(year, month + 1, 0);
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    return { from: start, to: end, label: `${MONTHS[month]} ${year}` };
  }, [mode, month, year, from, to]);

  const validateRange = () => {
    if (
      mode === 'custom' &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    ) {
      showAlert('Choose a date range', 'Enter both dates as YYYY-MM-DD before exporting.');
      return false;
    }
    if (range.from && range.to && range.to < range.from) {
      showAlert('Invalid range', 'The end date must be on or after the start date.');
      return false;
    }
    return true;
  };

  const freshExpenses = async () => {
    if (!userId) return [];
    const latest = await apiRequest(`/expenses/user/${userId}`, { skipCache: true });
    return Array.isArray(latest) ? latest : [];
  };

  const save = async (uri: string, filename: string, mime: string, uti: string) => {
    await saveFileToDevice(uri, filename, mime, uti, {
      onComplete: () =>
        showAlert('Download Complete', `${filename} is ready in your selected location.`),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const downloadReport = async (type: 'excel' | 'pdf') => {
    if (!validateRange() || !userId) return;
    const safeLabel = range.label.replace(/[^A-Za-z0-9]+/g, '_');
    const filename =
      type === 'excel' ? `ExpenseTracker_${safeLabel}.xlsx` : `ExpenseTracker_${safeLabel}.pdf`;
    try {
      setBusy(type);
      updateProgress({
        active: true,
        type: 'export',
        filename,
        stage: 'Querying transaction ledger...',
        percent: 15,
        detail: `Aggregating period: ${range.label}`,
      });
      const params = new URLSearchParams();
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      params.set('currency', currency || 'INR');
      const uri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${filename}`;
      const url = `${API_BASE_URL}/reports/user/${userId}/export/range/${type}?${params.toString()}`;

      updateProgress({
        active: true,
        type: 'export',
        filename,
        stage: 'Generating document format...',
        percent: 45,
        detail:
          type === 'excel'
            ? 'Formatting executive workbook cells'
            : 'Rendering PDF vector layouts',
      });

      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        uri,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        (downloadData) => {
          const total = downloadData.totalBytesExpectedToWrite;
          const written = downloadData.totalBytesWritten;
          const pct = total > 0 ? Math.round((written / total) * 100) : 75;
          updateProgress({
            active: true,
            type: 'export',
            filename,
            stage: 'Streaming document payload...',
            percent: Math.min(95, Math.max(50, pct)),
            detail:
              total > 0
                ? `${Math.round(written / 1024)} KB / ${Math.round(total / 1024)} KB (${pct}%)`
                : `${Math.round(written / 1024)} KB received`,
          });
        }
      );
      const result = await downloadResumable.downloadAsync();
      if (!result || result.status !== 200)
        throw new Error(`Server returned HTTP ${result?.status || 500}`);

      updateProgress({
        active: true,
        type: 'export',
        filename,
        stage: 'Saving to device...',
        percent: 98,
        detail: 'Ready to write to local storage',
      });

      await save(
        result.uri,
        filename,
        type === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf',
        type === 'excel' ? 'com.microsoft.excel.xlsx' : 'com.adobe.pdf'
      );
      updateProgress({
        active: true,
        type: 'export',
        filename,
        stage: 'Report generated successfully!',
        percent: 100,
        done: true,
      });
      setTimeout(() => updateProgress(null), 4000);
    } catch (e: any) {
      updateProgress(null);
      showAlert('Export Failed', e.message || 'Could not create the report.');
    } finally {
      setBusy(null);
    }
  };

  const downloadHtmlReport = async () => {
    if (!userId) return;
    try {
      setBusy('html');
      updateProgress({
        active: true,
        type: 'export',
        filename: `Financial_Statement_${range.label}.html`,
        stage: 'Querying monthly ledger...',
        percent: 25,
        detail: `Aggregating period: ${range.label}`,
      });

      const session = await getSession();
      const token = session?.token;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let reqYear = year;
      let reqMonth = month + 1;
      if (mode === 'custom' && from) {
        reqYear = Number.parseInt(from.slice(0, 4), 10) || year;
        reqMonth = Number.parseInt(from.slice(5, 7), 10) || month + 1;
      }

      updateProgress({
        active: true,
        type: 'export',
        filename: `Financial_Statement_${range.label}.html`,
        stage: 'Generating executive HTML statement...',
        percent: 60,
        detail: 'Compiling Obsidian & Gold themes and KPI insights',
      });

      const res = await fetch(
        `${API_BASE_URL}/reports/monthly/user/${userId}/html?year=${reqYear}&month=${reqMonth}`,
        { headers }
      );
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      const htmlText = await res.text();

      const safeLabel = range.label.replace(/[^A-Za-z0-9]+/g, '_');
      const filename = `Financial_Statement_${safeLabel}.html`;
      const base = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      const uri = `${base}${filename}`;

      await FileSystem.writeAsStringAsync(uri, htmlText, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await save(uri, filename, 'text/html', 'public.html');

      updateProgress({
        active: true,
        type: 'export',
        filename,
        stage: 'HTML Statement exported successfully!',
        percent: 100,
        done: true,
      });
      setTimeout(() => updateProgress(null), 4000);
    } catch (e: any) {
      updateProgress(null);
      showAlert('Export Failed', e.message || 'Could not export HTML statement.');
    } finally {
      setBusy(null);
    }
  };

  const exportDataFile = async (type: 'csv' | 'json' | 'summary') => {
    if (!validateRange()) return;
    try {
      setBusy(type);
      updateProgress({
        active: true,
        type: 'export',
        filename: `${type.toUpperCase()} Export`,
        stage: 'Fetching fresh transaction records...',
        percent: 20,
      });
      const latest = await freshExpenses();
      const filtered = latest.filter(
        (e: any) => !range.from || (e.expenseDate >= range.from && e.expenseDate <= range.to)
      );
      if (!filtered.length) {
        updateProgress(null);
        showAlert('No data', 'There are no transactions in the selected period.');
        return;
      }
      const base = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      let filename = '',
        fileData = '',
        mime = 'text/plain',
        uti = 'public.plain-text';
      const safeLabel = range.label.replace(/[^A-Za-z0-9]+/g, '_');

      if (type === 'csv') {
        filename = `Expenses_${safeLabel}.csv`;
        mime = 'text/csv';
        uti = 'public.comma-separated-values-text';

        // 2026 Resilient Practice: Chunked string builder with event-loop yielding
        // Prevents Hermes/V8 heap allocation spikes or OOM crashes on thousands/lakhs of transactions
        const CHUNK_SIZE = 2500;
        const rows: string[] = ['Date,Category,Description,Amount,Recurring'];
        for (let i = 0; i < filtered.length; i += CHUNK_SIZE) {
          const chunk = filtered.slice(i, i + CHUNK_SIZE);
          for (const e of chunk) {
            const row = [
              e.expenseDate,
              e.categoryName || e.category?.name || 'Uncategorized',
              e.description || '',
              e.amount || 0,
              e.isRecurring || e.recurring ? 'Yes' : 'No',
            ]
              .map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`)
              .join(',');
            rows.push(row);
          }
          const pct = Math.round(25 + ((i + chunk.length) / filtered.length) * 50);
          updateProgress({
            active: true,
            type: 'export',
            filename,
            stage: 'Encoding CSV ledger rows...',
            percent: Math.min(75, pct),
            detail: `Processed ${Math.min(i + chunk.length, filtered.length).toLocaleString()} of ${filtered.length.toLocaleString()} rows`,
          });
          // Yield to event loop for low-power device responsiveness
          await new Promise((r) => setTimeout(r, 0));
        }
        fileData = rows.join('\n');
      } else if (type === 'json') {
        filename = `Expenses_${safeLabel}.json`;
        mime = 'application/json';
        uti = 'public.json';
        updateProgress({
          active: true,
          type: 'export',
          filename,
          stage: 'Encoding JSON payload...',
          percent: 60,
          detail: `Serializing ${filtered.length.toLocaleString()} items...`,
        });
        await new Promise((r) => setTimeout(r, 0));
        fileData = JSON.stringify(filtered, null, 2);
      } else {
        filename = `Financial_Summary_${safeLabel}.txt`;
        fileData = buildSummary(filtered);
      }

      updateProgress({
        active: true,
        type: 'export',
        filename,
        stage: 'Writing file to local storage...',
        percent: 85,
        detail: `Encoded ${filtered.length.toLocaleString()} entries into ${type.toUpperCase()}`,
      });
      const uri = `${base}${filename}`;
      await FileSystem.writeAsStringAsync(uri, fileData, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await save(uri, filename, mime, uti);
      updateProgress({
        active: true,
        type: 'export',
        filename,
        stage: 'Export complete!',
        percent: 100,
        done: true,
      });
      setTimeout(() => updateProgress(null), 4000);
    } catch (e: any) {
      updateProgress(null);
      showAlert('Export Failed', e.message || 'Could not export the selected data.');
    } finally {
      setBusy(null);
    }
  };

  const buildSummary = (items: any[]) => {
    const total = items.reduce((s, e) => s + Number(e.amount || 0), 0);
    const byCat: Record<string, number> = {};
    items.forEach((e) => {
      const k = e.categoryName || e.category?.name || 'Uncategorized';
      byCat[k] = (byCat[k] || 0) + Number(e.amount || 0);
    });
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    return [
      `EXPENSETRACKER EXECUTIVE SUMMARY`,
      `Period: ${range.label}`,
      `Transactions: ${items.length.toLocaleString()}`,
      `Total spend: ${currency || 'INR'} ${total.toFixed(2)}`,
      `Largest category: ${top ? `${top[0]} (${top[1].toFixed(2)})` : 'N/A'}`,
      `Average transaction: ${(total / items.length).toFixed(2)}`,
      '',
      'Top categories:',
      ...Object.entries(byCat)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([k, v]) => `${k}: ${v.toFixed(2)}`),
    ].join('\n');
  };

  const importFile = async (kind: 'excel' | 'csv' | 'json') => {
    try {
      setBusy(`import-${kind}`);
      const result = await DocumentPicker.getDocumentAsync({
        type:
          kind === 'excel'
            ? [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel',
              ]
            : kind === 'csv'
            ? ['text/csv', 'text/comma-separated-values', 'application/csv']
            : ['application/json'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) {
        setBusy(null);
        return;
      }
      const asset = result.assets[0];
      updateProgress({
        active: true,
        type: 'import',
        filename: asset.name || `${kind.toUpperCase()} file`,
        stage: 'Connecting to import service...',
        percent: 15,
        detail: 'Preparing multipart payload stream',
      });

      const uploadTask = FileSystem.createUploadTask(
        `${API_BASE_URL}/expenses/user/${userId}/import/${kind}`,
        asset.uri,
        {
          fieldName: 'file',
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
        (uploadData) => {
          const total = uploadData.totalBytesExpectedToSend;
          const sent = uploadData.totalBytesSent;
          const pct = total > 0 ? Math.round((sent / total) * 100) : 50;
          updateProgress({
            active: true,
            type: 'import',
            filename: asset.name || `${kind.toUpperCase()} file`,
            stage:
              pct >= 100
                ? 'Server ledger parsing & schema validation...'
                : 'Streaming multipart payload...',
            percent: Math.min(96, Math.max(15, pct)),
            detail:
              total > 0
                ? `${Math.round(sent / 1024)} KB / ${Math.round(total / 1024)} KB (${pct}%)`
                : `${Math.round(sent / 1024)} KB uploaded`,
          });
        }
      );

      const res = await uploadTask.uploadAsync();
      if (!res || res.status < 200 || res.status >= 300)
        throw new Error(res?.body || `HTTP ${res?.status || 500}`);
      const data = JSON.parse(res.body || '{}');

      updateProgress({
        active: true,
        type: 'import',
        filename: asset.name || `${kind.toUpperCase()} file`,
        stage: 'Import finalized successfully!',
        percent: 100,
        done: true,
        detail: `Committed ${(data.imported ?? 0).toLocaleString()} transaction(s)`,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => {
        showAlert(
          'Import Complete',
          `Imported ${(data.imported ?? 0).toLocaleString()} transaction(s).${
            data.failedRows ? ` ${data.failedRows} row(s) were skipped.` : ''
          }`
        );
        onDataImported();
        onClose();
      }, 1200);
    } catch (e: any) {
      updateProgress(null);
      showAlert('Import Failed', e.message || 'Could not import the file.');
    } finally {
      setBusy(null);
    }
  };

  const describePlan = (p: { categories: unknown[]; expenses: unknown[]; incomes: unknown[]; goals: unknown[]; loans: unknown[]; budgets: unknown[]; subscriptions: unknown[] }) =>
    `${p.expenses.length} expenses, ${p.incomes.length} incomes, ${p.goals.length} goals, ${p.loans.length} loans, ` +
    `${p.budgets.length} budgets, ${p.subscriptions.length} recurring, ${p.categories.length} categories`;

  const conflictNote = (n: number) =>
    n > 0 ? `\n\n${n} more look like records the server already has in an edited form; those are left alone.` : '';

  const runDeviceAction = async (key: 'export' | 'check' | 'restore' | 'import') => {
    if (!userId) return;
    setBusy(`device-${key}`);
    try {
      if (key === 'export') {
        const r = await exportDeviceCopy(userId);
        showAlert(r.ok ? 'Device copy saved' : 'Nothing to export', r.ok ? `${r.records.toLocaleString()} records saved to a file.` : 'This device holds no cached data.');
        return;
      }
      if (key === 'import') {
        const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
        if (picked.canceled || !picked.assets?.[0]) return;
        const r = await importDeviceCopyFile(userId, picked.assets[0].uri);
        const foreign = r.fromUserId && r.fromUserId !== String(userId)
          ? ' The file came from a different account id; records are still matched by content.'
          : '';
        showAlert('Device copy loaded', `${r.records.toLocaleString()} records read, ${r.added.toLocaleString()} new to this phone's safety copy. Nothing has been sent to the server yet; use Compare with server, then Restore to server.${foreign}`);
        return;
      }
      const result = await computeRestorePlan(userId);
      if (!result) {
        showAlert('Nothing on this device', 'No cached data was found for this account on this phone.');
        return;
      }
      if (key === 'check') {
        showAlert(
          result.total === 0 ? 'Server is up to date' : 'Server is missing data',
          result.total === 0
            ? `All ${result.deviceRecords.toLocaleString()} records on this device are already on the server.`
            : `Missing on the server: ${describePlan(result.plan)}.\n\nExamples:\n${planSamples(result.plan).join('\n')}${conflictNote(result.conflicts)}`
        );
        return;
      }
      if (result.total === 0) {
        showAlert('Already in sync', 'The server already has everything this device holds.');
        return;
      }
      const startRestore = (includeConflicts: boolean) => {
        setBusy('device-restore');
        applyRestore(userId, undefined, { includeConflicts })
          .then((r) => {
            onDataImported();
            showAlert(
              r.verified ? 'Restore verified' : 'Restore finished with gaps',
              r.verified
                ? `${r.created.toLocaleString()} records added. A fresh comparison shows the server now has everything on this device.${r.conflicts ? ` ${r.conflicts} look-alike records were left as the server has them.` : ''}`
                : `${r.created.toLocaleString()} of ${r.attempted.toLocaleString()} added. Still missing: ${r.remainingAfterVerify}. Failed: ${r.failures.length}. Run Restore again to retry.`
            );
          })
          .catch((e) => showAlert('Restore stopped', e?.message || 'Could not reach the server. Nothing was lost; try again.'))
          .finally(() => setBusy(null));
      };
      showAlert('Restore to server?', `This adds only what the server is missing: ${describePlan(result.plan)}. Nothing is edited or deleted.\n\nExamples:\n${planSamples(result.plan).join('\n')}${conflictNote(result.conflicts)}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', onPress: () => startRestore(false) },
        ...(result.conflicts > 0 ? [{ text: 'Restore incl. look-alikes', onPress: () => startRestore(true) }] : []),
      ]);
    } catch (e: any) {
      showAlert('Could not complete', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const importJson = async () => {
    try {
      const items = JSON.parse(json);
      if (!Array.isArray(items) || !items.length) {
        throw new Error('Please provide an array with at least one transaction.');
      }
      setBusy('import-json-paste');
      updateProgress({
        active: true,
        type: 'import',
        filename: 'Pasted JSON Records',
        stage: 'Ingesting transactions...',
        percent: 10,
        detail: `Starting batch ingest for ${items.length.toLocaleString()} items`,
      });

      let count = 0;
      // 2026 Batch chunking with event loop yields
      const CHUNK_SIZE = 50;
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async (item: any) => {
            if (item.amount && item.description) {
              await apiRequest(`/expenses/user/${userId}`, {
                method: 'POST',
                body: JSON.stringify({
                  description: item.description,
                  amount: Number(item.amount),
                  expenseDate: item.expenseDate || new Date().toISOString().slice(0, 10),
                  categoryId: item.categoryId || 1,
                }),
              });
              count++;
            }
          })
        );
        const pct = Math.round(10 + ((i + chunk.length) / items.length) * 85);
        updateProgress({
          active: true,
          type: 'import',
          filename: 'Pasted JSON Records',
          stage: 'Batch importing records...',
          percent: Math.min(95, pct),
          detail: `Committed ${count.toLocaleString()} of ${items.length.toLocaleString()} records`,
        });
        await new Promise((r) => setTimeout(r, 0));
      }

      updateProgress({
        active: true,
        type: 'import',
        filename: 'Pasted JSON Records',
        stage: 'Import complete!',
        percent: 100,
        done: true,
        detail: `Successfully imported ${count.toLocaleString()} expense(s)`,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert('Import Complete', `Imported ${count.toLocaleString()} expense(s).`);
      setJson('');
      setShowJson(false);
      onDataImported();
      setTimeout(() => updateProgress(null), 4000);
      onClose();
    } catch (e: any) {
      updateProgress(null);
      showAlert('Invalid JSON', e.message || 'Please paste a valid JSON array of expenses.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              maxHeight: '94%',
              width: width >= 700 ? 680 : '100%',
            },
          ]}
        >
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: c.text }]}>Export Center</Text>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                Live data, precise periods, executive reports
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.close, { backgroundColor: c.inputBg }]}>
              <Ionicons name="close" size={20} color={c.text} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {transferProgress && transferProgress.active && (
              <View
                style={[
                  styles.transferCard,
                  {
                    backgroundColor: c.inputBg,
                    borderColor: transferProgress.done ? '#10B981' : c.primary,
                  },
                ]}
              >
                <View style={styles.transferHeader}>
                  <View style={styles.transferIconCol}>
                    <View
                      style={[
                        styles.transferIconBox,
                        {
                          backgroundColor:
                            (transferProgress.done ? '#10B981' : c.primary) + '25',
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          transferProgress.done
                            ? 'checkmark-circle'
                            : transferProgress.type === 'export'
                            ? 'cloud-download-outline'
                            : 'cloud-upload-outline'
                        }
                        size={22}
                        color={transferProgress.done ? '#10B981' : c.primary}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.transferFilename, { color: c.text }]} numberOfLines={1}>
                        {transferProgress.filename}
                      </Text>
                      <Text
                        style={[
                          styles.transferStage,
                          { color: transferProgress.done ? '#10B981' : c.textMuted },
                        ]}
                        numberOfLines={1}
                      >
                        {transferProgress.stage}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text
                      style={[
                        styles.transferPct,
                        { color: transferProgress.done ? '#10B981' : c.primary },
                      ]}
                    >
                      {Math.round(transferProgress.percent)}%
                    </Text>
                    {transferProgress.done && (
                      <TouchableOpacity
                        onPress={() => updateProgress(null)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={18} color={c.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View style={[styles.transferTrack, { backgroundColor: c.surface }]}>
                  <View
                    style={[
                      styles.transferFill,
                      {
                        width: `${Math.min(100, Math.max(5, transferProgress.percent))}%`,
                        backgroundColor: transferProgress.done ? '#10B981' : c.primary,
                      },
                    ]}
                  />
                </View>
                {transferProgress.detail && (
                  <Text style={[styles.transferDetail, { color: c.textMuted }]}>
                    {transferProgress.detail}
                  </Text>
                )}
              </View>
            )}
            <Text style={[styles.label, { color: c.textMuted }]}>SAFETY COPY ON THIS PHONE</Text>
            <View style={styles.grid}>
              {([
                ['export', 'Export device copy', 'Saves a file; works offline', 'download-outline'],
                ['check', 'Compare with server', 'Shows what is missing', 'git-compare-outline'],
                ['restore', 'Restore to server', 'Uploads only missing records', 'cloud-upload-outline'],
                ['import', 'Import device copy file', 'Load a saved copy file', 'document-attach-outline'],
              ] as const).map(([key, title, sub, icon]) => (
                <TouchableOpacity
                  key={key}
                  disabled={busy !== null}
                  onPress={() => runDeviceAction(key)}
                  style={[styles.action, { backgroundColor: c.inputBg, borderColor: c.border }]}
                >
                  <View style={[styles.icon, { backgroundColor: c.primary + '20' }]}>
                    <Ionicons name={icon} size={20} color={c.primary} />
                  </View>
                  <Text style={[styles.actionTitle, { color: c.text }]}>{title}</Text>
                  <Text style={[styles.actionSub, { color: c.textMuted }]}>{sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: c.textMuted, marginTop: 22 }]}>1. SELECT REPORT PERIOD</Text>
            <View style={styles.tabs}>
              {(['month', 'custom', 'all'] as RangeMode[]).map((x) => (
                <TouchableOpacity
                  key={x}
                  onPress={() => setMode(x)}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: mode === x ? c.primary : c.inputBg,
                      borderColor: c.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: mode === x ? '#111' : c.text,
                      fontWeight: '800',
                      fontSize: 12,
                    }}
                  >
                    {x === 'month' ? 'Month & Year' : x === 'custom' ? 'Custom Range' : 'All Time'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {mode === 'month' && (
              <View style={[styles.periodCard, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <View style={styles.yearRow}>
                  <TouchableOpacity onPress={() => setYear((y) => y - 1)}>
                    <Ionicons name="chevron-back" size={20} color={c.text} />
                  </TouchableOpacity>
                  <Text style={[styles.year, { color: c.text }]}>{year}</Text>
                  <TouchableOpacity onPress={() => setYear((y) => y + 1)}>
                    <Ionicons name="chevron-forward" size={20} color={c.text} />
                  </TouchableOpacity>
                </View>
                <View style={styles.monthGrid}>
                  {MONTHS.map((m, i) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setMonth(i)}
                      style={[
                        styles.month,
                        {
                          backgroundColor: month === i ? c.primary : c.surface,
                          borderColor: c.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: month === i ? '#111' : c.text,
                          fontSize: 12,
                          fontWeight: '700',
                        }}
                      >
                        {m.slice(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            {mode === 'custom' && (
              <View style={[styles.periodCard, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <Text style={[styles.helper, { color: c.textMuted }]}>
                  Enter dates in YYYY-MM-DD format
                </Text>
                <View style={styles.dateRow}>
                  <TextInput
                    value={from}
                    onChangeText={setFrom}
                    placeholder="Start date"
                    placeholderTextColor={c.textMuted}
                    style={[
                      styles.input,
                      { backgroundColor: c.surface, borderColor: c.border, color: c.text },
                    ]}
                  />
                  <Text style={{ color: c.textMuted }}>to</Text>
                  <TextInput
                    value={to}
                    onChangeText={setTo}
                    placeholder="End date"
                    placeholderTextColor={c.textMuted}
                    style={[
                      styles.input,
                      { backgroundColor: c.surface, borderColor: c.border, color: c.text },
                    ]}
                  />
                </View>
              </View>
            )}
            <View style={[styles.selected, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              <Text style={[styles.selectedLabel, { color: c.textMuted }]}>SELECTED PERIOD</Text>
              <Text style={[styles.selectedValue, { color: c.text }]}>{range.label}</Text>
            </View>
            <Text style={[styles.label, { color: c.textMuted }]}>2. EXECUTIVE EXPORTS</Text>
            <View style={styles.grid}>
              {[
                ['excel', 'Excel Dashboard', 'PowerBI-style workbook'],
                ['pdf', 'Executive PDF', 'Insights + KPI report'],
                ['html', 'HTML Statement', 'Obsidian & Gold web report'],
                ['csv', 'CSV Ledger', 'Fresh filtered transactions'],
                ['json', 'JSON Ledger', 'Fresh raw transaction data'],
                ['summary', 'Summary', 'Compact management brief'],
              ].map(([key, title, sub]) => (
                <TouchableOpacity
                  key={key}
                  disabled={busy !== null}
                  onPress={() =>
                    key === 'excel' || key === 'pdf'
                      ? downloadReport(key as any)
                      : key === 'html'
                      ? downloadHtmlReport()
                      : exportDataFile(key as any)
                  }
                  style={[styles.action, { backgroundColor: c.inputBg, borderColor: c.border }]}
                >
                  <View style={[styles.icon, { backgroundColor: c.primary + '20' }]}>
                    {busy === key ? (
                      <ActivityIndicator size="small" color={c.primary} />
                    ) : (
                      <Ionicons
                        name={
                          key === 'excel'
                            ? 'grid-outline'
                            : key === 'pdf'
                            ? 'document-text-outline'
                            : key === 'html'
                            ? 'globe-outline'
                            : key === 'csv'
                            ? 'receipt-outline'
                            : key === 'json'
                            ? 'code-slash-outline'
                            : 'analytics-outline'
                        }
                        size={20}
                        color={c.primary}
                      />
                    )}
                  </View>
                  <Text style={[styles.actionTitle, { color: c.text }]}>{title}</Text>
                  <Text style={[styles.actionSub, { color: c.textMuted }]}>{sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.label, { color: c.textMuted, marginTop: 22 }]}>3. IMPORT</Text>
            <View style={styles.grid}>
              {[
                ['excel', 'Import Excel'],
                ['csv', 'Import CSV'],
                ['json', 'Import JSON'],
              ].map(([key, title]) => (
                <TouchableOpacity
                  key={key}
                  disabled={busy !== null}
                  onPress={() => importFile(key as any)}
                  style={[styles.action, { backgroundColor: c.inputBg, borderColor: c.border }]}
                >
                  <View style={[styles.icon, { backgroundColor: c.primary + '20' }]}>
                    <Ionicons name="cloud-upload-outline" size={20} color={c.primary} />
                  </View>
                  <Text style={[styles.actionTitle, { color: c.text }]}>{title}</Text>
                  <Text style={[styles.actionSub, { color: c.textMuted }]}>
                    Refreshes dashboard after import
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => setShowJson((v) => !v)}
              style={[styles.paste, { borderColor: c.border, backgroundColor: c.inputBg }]}
            >
              <Text style={[styles.actionTitle, { color: c.text }]}>Paste JSON manually</Text>
              <Ionicons name={showJson ? 'chevron-up' : 'chevron-down'} size={18} color={c.text} />
            </TouchableOpacity>
            {showJson && (
              <View style={[styles.jsonBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <TextInput
                  value={json}
                  onChangeText={setJson}
                  multiline
                  numberOfLines={6}
                  placeholder='[{"description":"Groceries","amount":450,"expenseDate":"2026-09-09","categoryId":1}]'
                  placeholderTextColor={c.textMuted}
                  style={[
                    styles.jsonInput,
                    { color: c.text, borderColor: c.border, backgroundColor: c.surface },
                  ]}
                />
                <TouchableOpacity
                  onPress={importJson}
                  style={[styles.ingest, { backgroundColor: c.primary }]}
                >
                  <Text style={{ fontWeight: '800', color: '#111' }}>Ingest & Refresh</Text>
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
    backgroundColor: 'rgba(0,0,0,.68)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  card: {
    borderWidth: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: { fontSize: 21, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 3 },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 11, borderWidth: 1, borderRadius: 12, alignItems: 'center' },
  periodCard: { borderWidth: 1, borderRadius: 16, padding: 12 },
  yearRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  year: { fontSize: 18, fontWeight: '900' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  month: { width: '31.7%', paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  helper: { fontSize: 11, marginBottom: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 12,
  },
  selected: { borderWidth: 1, borderRadius: 14, padding: 13, marginVertical: 14 },
  selectedLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  selectedValue: { fontSize: 14, fontWeight: '800', marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: { width: '48%', borderWidth: 1, borderRadius: 15, padding: 13, minHeight: 112 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },
  actionTitle: { fontSize: 13, fontWeight: '800' },
  actionSub: { fontSize: 10, marginTop: 3 },
  paste: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 13,
    padding: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jsonBox: { marginTop: 8, borderWidth: 1, borderRadius: 14, padding: 12 },
  jsonInput: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 120,
    padding: 10,
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
  },
  ingest: { marginTop: 10, padding: 12, borderRadius: 10, alignItems: 'center' },
  transferCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  transferHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  transferIconCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  transferIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferFilename: {
    fontSize: 13,
    fontWeight: '800',
  },
  transferStage: {
    fontSize: 11,
    marginTop: 2,
  },
  transferPct: {
    fontSize: 14,
    fontWeight: '900',
  },
  transferTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 2,
    marginBottom: 6,
  },
  transferFill: {
    height: '100%',
    borderRadius: 3,
  },
  transferDetail: {
    fontSize: 10,
    fontWeight: '600',
  },
});
