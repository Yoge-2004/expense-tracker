/**
 * @file forgot-password.tsx
 * @description Smart Password Recovery screen.
 * Automatically adapts to server SMTP configuration via `GET /api/auth/config`.
 * - If SMTP is active: Provides 2-step verification code dispatch and reset.
 * - If SMTP is unconfigured: Allows direct new password entry with zero-OTP requirement.
 * Includes defensive client-side email format and password strength validation.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { apiRequest, ApiError } from '../services/api';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AmbientAura } from '../components/AmbientAura';
import { StaggeredView } from '../components/StaggeredView';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ForgotPasswordScreen() {
  const { theme } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const c = Colors[theme];
  const isLight = theme === 'light';
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [isEmailVerificationEnabled, setIsEmailVerificationEnabled] = useState(false);
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Query server auth configuration
  useEffect(() => {
    async function checkAuthConfig() {
      try {
        const config = await apiRequest('/auth/config');
        if (config && typeof config.emailVerificationEnabled === 'boolean') {
          setIsEmailVerificationEnabled(config.emailVerificationEnabled);
        }
      } catch {
        setIsEmailVerificationEnabled(false);
      } finally {
        setCheckingConfig(false);
      }
    }
    checkAuthConfig();
  }, []);

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [step, isEmailVerificationEnabled]);

  // Step 1 for SMTP-enabled: Request OTP
  const handleRequestOTP = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showAlert('Missing Email', 'Please enter your registered email address.');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      showAlert('Invalid Email', 'Please enter a valid email format (e.g. name@domain.com).');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: trimmedEmail }),
      });

      if (res && (res.emailVerificationEnabled === false || res.requiresOtp === false || res.bypassCode)) {
        setIsEmailVerificationEnabled(false);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert(
        'Verification Code Dispatched 📩',
        `A 6-digit verification code has been sent to ${trimmedEmail}.`,
        [{ text: 'Enter Code', onPress: () => setStep('verify') }],
        'success'
      );
      setStep('verify');
    } catch (e: any) {
      const isApiErr = e instanceof ApiError;
      const msg = isApiErr ? e.message : 'Could not process password reset.';
      showAlert('Request Failed', msg, undefined, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Direct reset (When SMTP is disabled) OR Step 2 (When SMTP is enabled)
  const handleResetPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showAlert('Missing Email', 'Please enter your account email address.');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      showAlert('Invalid Email', 'Please enter a valid email format.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      showAlert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert('Password Mismatch', 'New password and confirmation password do not match.');
      return;
    }

    let finalOtp = 'BYPASS';
    if (isEmailVerificationEnabled) {
      finalOtp = otp.trim();
      if (!finalOtp || finalOtp.length !== 6) {
        showAlert('Missing Code', 'Please enter the 6-digit code sent to your email.');
        return;
      }
    }

    setIsLoading(true);
    try {
      await apiRequest('/auth/reset-password', {
        method: 'PUT',
        body: JSON.stringify({
          email: trimmedEmail,
          otp: finalOtp,
          newPassword,
        }),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert('🎉 Password Updated', 'Your password has been reset successfully. Please sign in.', [
        { text: 'Sign In', onPress: () => router.replace('/login') },
      ], 'success');
    } catch (e: any) {
      const isApiErr = e instanceof ApiError;
      const msg = isApiErr ? e.message : 'Password update failed. Please check your credentials.';
      showAlert('Reset Failed', msg, undefined, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const inputBorder = (field: string) => (focusedField === field ? c.primary : c.border);

  if (checkingConfig) {
    return (
      <View style={[styles.loadingWrapper, { backgroundColor: c.bg }]}>
        <AmbientAura />
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: c.bg }]}
    >
      <AmbientAura />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top + 16, 48), paddingBottom: Math.max(insets.bottom + 20, 32) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: c.card,
              borderColor: c.border,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <StaggeredView delay={100} direction="down">
            <View style={styles.header}>
              <View style={[styles.iconWrap, { backgroundColor: c.primary + '18' }]}>
                <Ionicons name="key-outline" size={24} color={c.primary} />
              </View>
              <Text style={[styles.title, { color: c.text }]}>Reset Password</Text>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                {isEmailVerificationEnabled
                  ? step === 'request'
                    ? 'Enter your email to receive a secure 6-digit OTP code'
                    : 'Enter the 6-digit verification code and your new password'
                  : 'Directly establish a new password for your account'}
              </Text>
            </View>
          </StaggeredView>

          {/* =========================================
              SCENARIO A: DIRECT RESET (SMTP DISABLED)
             ========================================= */}
          {!isEmailVerificationEnabled && (
            <StaggeredView delay={150} direction="up">
              <View style={styles.formSection}>
                {/* Email */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: c.textMuted }]}>Account Email</Text>
                  <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: inputBorder('email') }]}>
                    <Ionicons name="mail-outline" size={18} color={focusedField === 'email' ? c.primary : c.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: c.text }]}
                      placeholder="name@example.com"
                      placeholderTextColor={c.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                {/* New Password */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: c.textMuted }]}>New Password</Text>
                  <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: inputBorder('newPass') }]}>
                    <Ionicons name="lock-closed-outline" size={18} color={focusedField === 'newPass' ? c.primary : c.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: c.text }]}
                      placeholder="Min 6 characters"
                      placeholderTextColor={c.textMuted}
                      secureTextEntry={!showPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      onFocus={() => setFocusedField('newPass')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                      <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={c.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm New Password */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: c.textMuted }]}>Confirm New Password</Text>
                  <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: inputBorder('confPass') }]}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={focusedField === 'confPass' ? c.primary : c.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: c.text }]}
                      placeholder="Re-enter new password"
                      placeholderTextColor={c.textMuted}
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setFocusedField('confPass')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                      <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} color={c.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: c.primary, opacity: isLoading ? 0.7 : 1 }]}
                  onPress={handleResetPassword}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color={isLight ? '#FFF' : '#10120E'} size="small" />
                  ) : (
                    <View style={styles.btnInner}>
                      <Text style={[styles.btnText, { color: isLight ? '#FFF' : '#10120E' }]}>Set New Password</Text>
                      <Ionicons name="checkmark-circle" size={18} color={isLight ? '#FFF' : '#10120E'} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </StaggeredView>
          )}

          {/* =========================================
              SCENARIO B - STEP 1: REQUEST CODE (SMTP ENABLED)
             ========================================= */}
          {isEmailVerificationEnabled && step === 'request' && (
            <StaggeredView delay={150} direction="up">
              <View style={styles.formSection}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: c.textMuted }]}>Registered Email</Text>
                  <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: inputBorder('email') }]}>
                    <Ionicons name="mail-outline" size={18} color={focusedField === 'email' ? c.primary : c.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: c.text }]}
                      placeholder="name@example.com"
                      placeholderTextColor={c.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: c.primary, opacity: isLoading ? 0.7 : 1 }]}
                  onPress={handleRequestOTP}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color={isLight ? '#FFF' : '#10120E'} size="small" />
                  ) : (
                    <View style={styles.btnInner}>
                      <Text style={[styles.btnText, { color: isLight ? '#FFF' : '#10120E' }]}>Send Recovery OTP</Text>
                      <Ionicons name="arrow-forward" size={18} color={isLight ? '#FFF' : '#10120E'} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </StaggeredView>
          )}

          {/* =========================================
              SCENARIO B - STEP 2: VERIFY CODE & SET NEW PASSWORD
             ========================================= */}
          {isEmailVerificationEnabled && step === 'verify' && (
            <StaggeredView delay={150} direction="up">
              <View style={styles.formSection}>
                {/* 6-Digit OTP code box */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: c.textMuted }]}>6-Digit Recovery OTP</Text>
                  <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: inputBorder('otp') }]}>
                    <Ionicons name="key-outline" size={18} color={focusedField === 'otp' ? c.primary : c.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: c.text, letterSpacing: 4, fontWeight: '700', fontSize: 18 }]}
                      placeholder="123456"
                      placeholderTextColor={c.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={otp}
                      onChangeText={setOtp}
                      onFocus={() => setFocusedField('otp')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                {/* New Password */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: c.textMuted }]}>New Password</Text>
                  <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: inputBorder('newPass') }]}>
                    <Ionicons name="lock-closed-outline" size={18} color={focusedField === 'newPass' ? c.primary : c.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: c.text }]}
                      placeholder="Min 6 characters"
                      placeholderTextColor={c.textMuted}
                      secureTextEntry={!showPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      onFocus={() => setFocusedField('newPass')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                      <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={c.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: c.textMuted }]}>Confirm New Password</Text>
                  <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: inputBorder('confPass') }]}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={focusedField === 'confPass' ? c.primary : c.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: c.text }]}
                      placeholder="Re-enter new password"
                      placeholderTextColor={c.textMuted}
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setFocusedField('confPass')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                      <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} color={c.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.otpActionsRow}>
                  <TouchableOpacity onPress={() => setStep('request')}>
                    <Text style={[styles.otpActionText, { color: c.textMuted }]}>Change Email</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleRequestOTP} disabled={isLoading}>
                    <Text style={[styles.otpActionText, { color: c.primary }]}>Resend Code</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: c.primary, opacity: isLoading ? 0.7 : 1 }]}
                  onPress={handleResetPassword}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color={isLight ? '#FFF' : '#10120E'} size="small" />
                  ) : (
                    <View style={styles.btnInner}>
                      <Text style={[styles.btnText, { color: isLight ? '#FFF' : '#10120E' }]}>Update Password</Text>
                      <Ionicons name="checkmark-circle" size={18} color={isLight ? '#FFF' : '#10120E'} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </StaggeredView>
          )}

          {/* Footer Back to Login Link */}
          <View style={styles.footer}>
            <Link href="/login" asChild>
              <TouchableOpacity style={styles.backBtn}>
                <Ionicons name="arrow-back" size={16} color={c.primary} />
                <Text style={[styles.backText, { color: c.primary }]} numberOfLines={1}>Back to Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingTop: 48,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  formSection: {
    marginBottom: 8,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 6,
  },
  otpActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  otpActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitBtn: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  backText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
