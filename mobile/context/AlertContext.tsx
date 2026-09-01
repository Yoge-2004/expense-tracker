/**
 * @file AlertContext.tsx
 * @description Global custom in-app Alert and Confirmation modal context.
 * Replaces native OS dialogs with a modern, animated theme-aware notification card.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/theme';
import { useAuth } from './AuthContext';

const { width } = Dimensions.get('window');

export type AlertType = 'default' | 'success' | 'error' | 'warning' | 'info' | 'destructive';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AlertConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  type?: AlertType;
}

interface AlertContextType {
  showAlert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    type?: AlertType
  ) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useAuth();
  const c = Colors[theme || 'dark'];

  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig>({ title: '' });
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.92));

  const showAlert = useCallback(
    (
      title: string,
      message?: string,
      buttons?: AlertButton[],
      type: AlertType = 'default'
    ) => {
      // Trigger subtle haptic according to alert type
      if (type === 'error' || type === 'destructive') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } else if (type === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (type === 'warning') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      setConfig({
        title,
        message,
        buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }],
        type,
      });
      setVisible(true);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [fadeAnim, scaleAnim]
  );

  const hideAlert = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.94,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });
  }, [fadeAnim, scaleAnim]);

  const handleButtonPress = (btn: AlertButton) => {
    hideAlert();
    if (btn.onPress) {
      setTimeout(() => {
        btn.onPress?.();
      }, 100);
    }
  };

  const getIconInfo = () => {
    switch (config.type) {
      case 'success':
        return { name: 'checkmark-circle' as const, color: c.teal, bg: c.teal + '20' };
      case 'error':
        return { name: 'close-circle' as const, color: c.accent, bg: c.accent + '20' };
      case 'destructive':
        return { name: 'trash' as const, color: c.accent, bg: c.accent + '20' };
      case 'warning':
        return { name: 'warning' as const, color: c.warning, bg: c.warning + '20' };
      case 'info':
        return { name: 'information-circle' as const, color: c.teal, bg: c.teal + '20' };
      default:
        return { name: 'notifications' as const, color: c.primary, bg: c.primary + '20' };
    }
  };

  const icon = getIconInfo();

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <Modal
        visible={visible}
        transparent={true}
        animationType="none"
        onRequestClose={hideAlert}
      >
        <TouchableWithoutFeedback onPress={hideAlert}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.card,
                  {
                    backgroundColor: c.card,
                    borderColor: c.border,
                    transform: [{ scale: scaleAnim }],
                  },
                ]}
              >
                {/* Icon header */}
                <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
                  <Ionicons name={icon.name} size={28} color={icon.color} />
                </View>

                {/* Title and message */}
                <Text style={[styles.title, { color: c.text }]}>{config.title}</Text>
                {!!config.message && (
                  <Text style={[styles.message, { color: c.textMuted }]}>{config.message}</Text>
                )}

                {/* Buttons row / column */}
                <View
                  style={[
                    styles.buttonContainer,
                    config.buttons && config.buttons.length > 2 && { flexDirection: 'column' },
                  ]}
                >
                  {config.buttons?.map((btn, idx) => {
                    const isCancel = btn.style === 'cancel';
                    const isDestructive = btn.style === 'destructive';
                    let btnBg = c.inputBg;
                    let textColor = c.text;

                    if (isDestructive) {
                      btnBg = c.accent;
                      textColor = '#FFFFFF';
                    } else if (!isCancel) {
                      btnBg = c.primary;
                      textColor = theme === 'light' ? '#FFFFFF' : '#10120E';
                    } else {
                      btnBg = c.inputBg;
                      textColor = c.textMuted;
                    }

                    return (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.8}
                        onPress={() => handleButtonPress(btn)}
                        style={[
                          styles.actionBtn,
                          {
                            backgroundColor: btnBg,
                            borderColor: isCancel ? c.border : 'transparent',
                            borderWidth: isCancel ? 1 : 0,
                            flex: (config.buttons?.length || 1) <= 2 ? 1 : undefined,
                          },
                        ]}
                      >
                        <Text style={[styles.actionBtnText, { color: textColor }]}>
                          {btn.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </AlertContext.Provider>
  );
};

/**
 * Hook to access global in-app alert and confirmation dialog.
 */
export function useAlert(): AlertContextType {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: Math.min(width - 48, 360),
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
