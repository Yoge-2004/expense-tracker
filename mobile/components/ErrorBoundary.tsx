/**
 * @file ErrorBoundary.tsx
 * @description Top-level and component-level React Error Boundary.
 * Catches unhandled runtime render exceptions across the component hierarchy,
 * preventing white-screen crashes and presenting a recovery interface with
 * restart capabilities and error diagnostic reporting.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface Props {
  /** Component sub-tree to safeguard. */
  children: ReactNode;
  /** Optional custom fallback component. */
  fallback?: (error: Error, resetError: () => void) => ReactNode;
  /** Optional callback fired when an error is trapped. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showDetails: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Uncaught UI Component Exception:', error, errorInfo);

    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (loggingError) {
        console.error('[ErrorBoundary] Failed in onError callback:', loggingError);
      }
    }
  }

  /**
   * Resets error state to attempt re-rendering the component sub-tree.
   */
  public resetError = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  /**
   * Shares error diagnostics via the native OS share sheet.
   */
  public shareDiagnostics = async (): Promise<void> => {
    const { error, errorInfo } = this.state;
    const report =
      `--- EXPENSE TRACKER ERROR REPORT ---\n` +
      `Time: ${new Date().toISOString()}\n` +
      `Message: ${error?.message || 'Unknown Error'}\n` +
      `Stack: ${error?.stack || 'No stack trace'}\n\n` +
      `Component Stack: ${errorInfo?.componentStack || 'No component stack'}\n`;

    try {
      await Share.share({
        title: 'ExpenseTracker_Crash_Report.txt',
        message: report,
      });
    } catch (e: any) {
      Alert.alert('Share Failed', e.message || 'Could not export crash diagnostics.');
    }
  };

  public render(): ReactNode {
    const { hasError, error, errorInfo, showDetails } = this.state;

    if (hasError) {
      if (this.props.fallback && error) {
        return this.props.fallback(error, this.resetError);
      }

      return (
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="light-content" backgroundColor="#0D0F0C" />
          <View style={styles.container}>
            {/* Header Icon */}
            <View style={styles.iconBox}>
              <Ionicons name="warning-outline" size={38} color="#E74C3C" />
            </View>

            <Text style={styles.title}>Application Interrupted</Text>
            <Text style={styles.subtitle}>
              An unexpected render error occurred in this view. Your financial records and local
              session remain safe.
            </Text>

            {/* Error Message Box */}
            <View style={styles.messageBox}>
              <Ionicons name="alert-circle" size={18} color="#E74C3C" />
              <Text style={styles.messageText} numberOfLines={3}>
                {error?.message || 'An unexpected rendering error occurred.'}
              </Text>
            </View>

            {/* Diagnostic Details Toggle */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => this.setState({ showDetails: !showDetails })}
              style={styles.detailsToggle}
            >
              <Text style={styles.detailsToggleText}>
                {showDetails ? 'Hide Diagnostics' : 'View Diagnostic Details'}
              </Text>
              <Ionicons
                name={showDetails ? 'chevron-up' : 'chevron-down'}
                size={14}
                color="#C79A3E"
              />
            </TouchableOpacity>

            {showDetails && (
              <ScrollView style={styles.stackScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.stackText}>
                  {error?.stack || 'No JavaScript stack available.'}
                </Text>
                {errorInfo?.componentStack && (
                  <>
                    <Text style={styles.stackHeader}>Component Trace:</Text>
                    <Text style={styles.stackText}>{errorInfo.componentStack}</Text>
                  </>
                )}
              </ScrollView>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={this.resetError}
                style={styles.primaryBtn}
              >
                <Ionicons name="refresh" size={18} color="#10120E" />
                <Text style={styles.primaryBtnText}>Reload View</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={this.shareDiagnostics}
                style={styles.secondaryBtn}
              >
                <Ionicons name="share-outline" size={18} color="#F5F3EF" />
                <Text style={styles.secondaryBtnText}>Share Diagnostics</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D0F0C',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(231, 76, 60, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F5F3EF',
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#8A8F85',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#171A15',
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
    borderRadius: 14,
    padding: 14,
    width: '100%',
    marginBottom: 14,
  },
  messageText: {
    flex: 1,
    color: '#F5F3EF',
    fontSize: 12.5,
    fontWeight: '600',
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    marginBottom: 12,
  },
  detailsToggleText: {
    color: '#C79A3E',
    fontSize: 12,
    fontWeight: '700',
  },
  stackScroll: {
    maxHeight: 140,
    width: '100%',
    backgroundColor: '#10120E',
    borderWidth: 1,
    borderColor: '#242820',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  stackHeader: {
    color: '#C79A3E',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  stackText: {
    color: '#8A8F85',
    fontSize: 10.5,
    fontFamily: 'monospace',
    lineHeight: 15,
  },
  actionButtons: {
    width: '100%',
    gap: 10,
    marginTop: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#C79A3E',
    height: 50,
    borderRadius: 16,
    shadowColor: '#C79A3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#10120E',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#171A15',
    borderWidth: 1,
    borderColor: '#242820',
    height: 48,
    borderRadius: 16,
  },
  secondaryBtnText: {
    color: '#F5F3EF',
    fontSize: 13,
    fontWeight: '700',
  },
});
