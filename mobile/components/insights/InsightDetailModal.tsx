/**
 * @file InsightDetailModal.tsx
 * @description Bottom-sheet modal presenting deep-dive financial intelligence and recommendations.
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText as Text } from '../ThemedText';
import { ThemeColors } from '../../constants/theme';
import { DetailedInsightModalData } from './types';

interface InsightDetailModalProps {
  insight: DetailedInsightModalData | null;
  onClose: () => void;
  colors: ThemeColors;
}

export const InsightDetailModal: React.FC<InsightDetailModalProps> = React.memo(({
  insight,
  onClose,
  colors: c,
}) => {
  if (!insight) return null;

  return (
    <Modal
      visible={!!insight}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalContent, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleRow}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: insight.color + '20', width: 38, height: 38 },
                ]}
              >
                <Ionicons
                  name={insight.icon}
                  size={20}
                  color={insight.color}
                />
              </View>
              <Text style={[styles.modalTitle, { color: c.text }]}>
                {insight.title}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeModalBtn, { backgroundColor: c.inputBg }]}
              accessibilityLabel="Close insight details"
            >
              <Ionicons name="close" size={18} color={c.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
            <Text style={[styles.modalHeadline, { color: c.text }]}>
              {insight.headline}
            </Text>

            {/* Metrics Breakdown */}
            <View style={[styles.metricsTable, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              {insight.metrics.map((m, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.metricRow,
                    idx !== insight.metrics.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: c.border,
                    },
                  ]}
                >
                  <Text style={[styles.metricLabel, { color: c.textMuted }]}>{m.label}</Text>
                  <Text style={[styles.metricValue, { color: c.text }]}>{m.value}</Text>
                </View>
              ))}
            </View>

            {/* Strategic Financial Recommendation */}
            <View
              style={[
                styles.adviceBox,
                {
                  backgroundColor: insight.color + '15',
                  borderColor: insight.color + '35',
                },
              ]}
            >
              <View style={styles.adviceTitleRow}>
                <Ionicons name="bulb-outline" size={16} color={insight.color} />
                <Text style={[styles.adviceTitle, { color: insight.color }]}>
                  Strategic AI Recommendation
                </Text>
              </View>
              <Text style={[styles.adviceBody, { color: c.text }]}>
                {insight.advice}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

InsightDetailModal.displayName = 'InsightDetailModal';

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 24,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  iconBox: {
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    marginBottom: 10,
  },
  modalHeadline: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 18,
  },
  metricsTable: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 18,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  metricLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  adviceBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  adviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adviceTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adviceBody: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
});
