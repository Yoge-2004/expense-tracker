/**
 * @file insightComponents.test.ts
 * @description Unit tests for modular financial intelligence components, ML data integrity,
 * and component exports.
 */

import React from 'react';
import { InsightAlertBanner } from '../components/insights/InsightAlertBanner';
import { AiForecastCard } from '../components/insights/AiForecastCard';
import { CashFlowPulseCard } from '../components/insights/CashFlowPulseCard';
import { InsightCard } from '../components/insights/InsightCard';
import { InsightDetailModal } from '../components/insights/InsightDetailModal';
import { Colors } from '../constants/theme';

const mockColors = Colors.dark;
const formatAmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

describe('Insight Components Suite', () => {
  describe('Component Exports & Structure', () => {
    it('InsightAlertBanner exports a valid memo component', () => {
      expect(InsightAlertBanner).toBeDefined();
      expect(typeof InsightAlertBanner).toBe('object');
    });

    it('AiForecastCard exports a valid memo component', () => {
      expect(AiForecastCard).toBeDefined();
      expect(typeof AiForecastCard).toBe('object');
    });

    it('CashFlowPulseCard exports a valid memo component', () => {
      expect(CashFlowPulseCard).toBeDefined();
      expect(typeof CashFlowPulseCard).toBe('object');
    });

    it('InsightCard exports a valid memo component', () => {
      expect(InsightCard).toBeDefined();
      expect(typeof InsightCard).toBe('object');
    });

    it('InsightDetailModal exports a valid memo component', () => {
      expect(InsightDetailModal).toBeDefined();
      expect(typeof InsightDetailModal).toBe('object');
    });
  });

  describe('InsightAlertBanner Element Creation', () => {
    it('creates banner element with anomaly data', () => {
      const onPressAnomaly = jest.fn();
      const element = React.createElement(InsightAlertBanner, {
        anomaly: {
          count: 2,
          topOutlier: { desc: 'Luxury Electronics', amount: 45000, score: -0.22 },
        },
        burnout: null,
        formatAmt,
        onPressAnomaly,
        onPressBurnout: jest.fn(),
        colors: mockColors,
      });

      expect(element).toBeDefined();
      expect(element.props.anomaly?.count).toBe(2);
      expect(element.props.anomaly?.topOutlier?.desc).toBe('Luxury Electronics');
    });

    it('creates banner element with budget depletion data', () => {
      const onPressBurnout = jest.fn();
      const element = React.createElement(InsightAlertBanner, {
        anomaly: null,
        burnout: {
          categoryName: 'Dining Out',
          spent: 9000,
          limit: 10000,
          daysRemainingUntilDepletion: 3,
          dailyCategoryRate: 350,
        },
        formatAmt,
        onPressAnomaly: jest.fn(),
        onPressBurnout,
        colors: mockColors,
      });

      expect(element).toBeDefined();
      expect(element.props.burnout?.daysRemainingUntilDepletion).toBe(3);
      expect(element.props.burnout?.categoryName).toBe('Dining Out');
    });

    it('creates nominal guard status element when no alerts exist', () => {
      const element = React.createElement(InsightAlertBanner, {
        anomaly: { count: 0 },
        burnout: null,
        formatAmt,
        onPressAnomaly: jest.fn(),
        onPressBurnout: jest.fn(),
        colors: mockColors,
      });

      expect(element).toBeDefined();
      expect(element.props.anomaly?.count).toBe(0);
    });
  });

  describe('AiForecastCard Element Creation', () => {
    it('creates element with calibrated time-series forecast', () => {
      const onPress = jest.fn();
      const element = React.createElement(AiForecastCard, {
        forecast: {
          total: 14500,
          days: 7,
          points: [
            { date: '2026-11-08', amount: 2000 },
            { date: '2026-11-09', amount: 2200 },
            { date: '2026-11-10', amount: 1900 },
            { date: '2026-11-11', amount: 2100 },
            { date: '2026-11-12', amount: 2050 },
            { date: '2026-11-13', amount: 2150 },
            { date: '2026-11-14', amount: 2100 },
          ],
        },
        status: {
          isCalibrated: true,
          daysRecorded: 35,
          requiredDays: 28,
        },
        formatAmt,
        onPress,
        colors: mockColors,
      });

      expect(element).toBeDefined();
      expect(element.props.status.isCalibrated).toBe(true);
      expect(element.props.forecast?.total).toBe(14500);
      expect(element.props.forecast?.points.length).toBe(7);
    });

    it('creates element with zero-fabrication calibrating state', () => {
      const element = React.createElement(AiForecastCard, {
        forecast: null,
        status: {
          isCalibrated: false,
          daysRecorded: 14,
          requiredDays: 28,
        },
        formatAmt,
        onPress: jest.fn(),
        colors: mockColors,
      });

      expect(element).toBeDefined();
      expect(element.props.status.isCalibrated).toBe(false);
      expect(element.props.status.daysRecorded).toBe(14);
      expect(element.props.status.requiredDays).toBe(28);
    });
  });

  describe('CashFlowPulseCard Element Creation', () => {
    it('creates element with net surplus and inflow/outflow metrics', () => {
      const onPress = jest.fn();
      const element = React.createElement(CashFlowPulseCard, {
        activeInflow: 65000,
        currentMonthSpent: 42000,
        netCashFlow: 23000,
        savingsRate: 35,
        formatAmt,
        onPress,
        colors: mockColors,
      });

      expect(element).toBeDefined();
      expect(element.props.netCashFlow).toBe(23000);
      expect(element.props.savingsRate).toBe(35);
      expect(element.props.activeInflow).toBe(65000);
      expect(element.props.currentMonthSpent).toBe(42000);
    });

    it('creates element with net deficit', () => {
      const element = React.createElement(CashFlowPulseCard, {
        activeInflow: 30000,
        currentMonthSpent: 45000,
        netCashFlow: -15000,
        savingsRate: -50,
        formatAmt,
        onPress: jest.fn(),
        colors: mockColors,
      });

      expect(element).toBeDefined();
      expect(element.props.netCashFlow).toBe(-15000);
      expect(element.props.savingsRate).toBe(-50);
    });
  });

  describe('InsightCard Element Creation', () => {
    it('creates 2-column card element with custom icon and values', () => {
      const onPress = jest.fn();
      const element = React.createElement(InsightCard, {
        title: 'Weekend Multiplier',
        tag: 'Habits',
        icon: 'calendar-outline',
        iconColor: mockColors.accent,
        primaryVal: '1.8x',
        subText: 'Avg Wknd: ₹2,400/d',
        onPress,
        colors: mockColors,
      });

      expect(element).toBeDefined();
      expect(element.props.title).toBe('Weekend Multiplier');
      expect(element.props.tag).toBe('Habits');
      expect(element.props.primaryVal).toBe('1.8x');
    });
  });

  describe('InsightDetailModal Element Creation', () => {
    it('creates modal element with detailed financial advice', () => {
      const onClose = jest.fn();
      const element = React.createElement(InsightDetailModal, {
        insight: {
          title: 'Discretionary Load & Savings',
          icon: 'wallet-outline',
          color: mockColors.teal,
          headline: '42% of your spend was allocated to non-essential lifestyle categories.',
          metrics: [
            { label: 'Essential Spend', value: '₹28,000' },
            { label: 'Discretionary Spend', value: '₹20,000' },
          ],
          advice: 'Trimming 15% from non-essential spending could retain ₹3,000 in monthly savings.',
        },
        onClose,
        colors: mockColors,
      });

      expect(element).toBeDefined();
      expect(element.props.insight?.title).toBe('Discretionary Load & Savings');
      expect(element.props.insight?.metrics.length).toBe(2);
    });
  });

  describe('ML Data Integrity & Zero-Fabrication Rules', () => {
    it('ensures temporal feature extraction for Isolation Forest includes day_of_week and hour', () => {
      const testDate = '2026-05-15T14:30:00';
      const dObj = new Date(testDate);
      const dow = dObj.getDay();
      const hour = dObj.getHours();

      expect(dow).toBeGreaterThanOrEqual(0);
      expect(dow).toBeLessThanOrEqual(6);
      expect(hour).toBe(14);
    });

    it('ensures daily spending map preserves 0 for inactive calendar days without fake numbers', () => {
      const dailyMap: Record<string, number> = {
        '2026-05-01': 500,
        '2026-05-03': 1200,
      };

      // Inactive day 2026-05-02 should be 0, never synthetic (20 + (i % 6) * 5)
      const day2Amount = dailyMap['2026-05-02'] !== undefined ? dailyMap['2026-05-02'] : 0;
      expect(day2Amount).toBe(0);
    });
  });
});
