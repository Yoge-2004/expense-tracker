/**
 * @file register.tsx
 * @description Secure Account Registration screen.
 * Features:
 * - Google Sign-In integration for one-tap account creation.
 * - Username handle & Full Name inputs.
 * - Preferred Currency selector (INR, USD, EUR, GBP, etc.).
 * - Dynamic verification mode detection via `/auth/config`.
 * - 2-step OTP email verification workflow when SMTP is active.
 * - Rich ambient aura background and staggered spring animations.
 * - Full iOS and Android safe area adaptation.
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
  Modal,
  FlatList,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { apiRequest, ApiError } from '../services/api';
import { WORLD_CURRENCIES } from '../services/currency';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { AmbientAura } from '../components/AmbientAura';
import { StaggeredView } from '../components/StaggeredView';
import { GOOGLE_OAUTH_CONFIG } from '../constants/auth';

WebBrowser.maybeCompleteAuthSession();

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9._]{3,30}$/.test(username);
}

export default function RegisterScreen() {
  const { register, loginWithGoogle, theme } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const c = Colors[theme];
  const isLight = theme === 'light';
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  const [isEmailVerificationEnabled, setIsEmailVerificationEnabled] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'expensetracker',
  });

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_OAUTH_CONFIG.webClientId,
    iosClientId: GOOGLE_OAUTH_CONFIG.iosClientId,
    androidClientId: GOOGLE_OAUTH_CONFIG.androidClientId,
    webClientId: GOOGLE_OAUTH_CONFIG.webClientId,
    redirectUri,
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
  }, []);

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
    if (response?.type === 'success') {
      const idToken = response.params?.id_token || (response as any).authentication?.idToken;
      if (idToken) {
        handleGoogleToken(idToken);
      }
    }
  }, [response]);

  const handleGoogleToken = async (idToken: string) => {
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle(idToken);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert('🎉 Welcome!', 'Google Sign-In successful!', undefined, 'success');
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : err.message || 'Google registration failed.';
      showAlert('Google Sign-In Failed', msg, undefined, 'error');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const validateBaseInputs = (): boolean => {
    const cleanName = name.trim();
    if (!cleanName) {
      showAlert('Missing Name', 'Please enter your full display name.');
      return false;
    }
    if (cleanName.length < 2) {
      showAlert('Invalid Name', 'Name must be at least 2 characters.');
      return false;
    }

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      showAlert('Missing Username', 'Please enter a unique username handle.');
      return false;
    }
    if (!isValidUsername(cleanUsername)) {
      showAlert(
        'Invalid Username',
        'Username must be 3-30 characters and contain only letters, numbers, dots, or underscores.'
      );
      return false;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      showAlert('Missing Email', 'Please enter your email address.');
      return false;
    }
    if (!isValidEmail(cleanEmail)) {
      showAlert('Invalid Email', 'Please enter a valid email format (e.g. name@domain.com).');
      return false;
    }

    if (!password || password.length < 6) {
      showAlert('Weak Password', 'Password must be at least 6 characters.');
      return false;
    }

    if (password !== confirmPassword) {
      showAlert('Password Mismatch', 'Password and confirmation password do not match.');
      return false;
    }

    return true;
  };

  const handleSendOtp = async () => {
    if (!validateBaseInputs()) return;

    setIsLoading(true);
    try {
      await apiRequest('/auth/signup/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      setOtpSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert('Code Sent 📩', `A 6-digit verification code was sent to ${email.trim()}.`);
    } catch (error: any) {
      const isApiErr = error instanceof ApiError;
      const msg = isApiErr ? error.message : 'Could not send verification email.';
      showAlert('Failed to Send Code', msg, undefined, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterDirect = async () => {
    if (!validateBaseInputs()) return;

    setIsLoading(true);
    try {
      await register(name.trim(), username.trim(), email.trim(), password, 'BYPASS', currency);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert('🎉 Welcome!', 'Account created successfully! Please sign in with your credentials.', [
        { text: 'Sign In', onPress: () => router.replace('/login') },
      ], 'success');
    } catch (error: any) {
      const isApiErr = error instanceof ApiError;
      const msg = isApiErr ? error.message : 'Something went wrong during registration.';
      showAlert('Registration Failed', msg, undefined, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterWithOtp = async () => {
    if (!otp || otp.trim().length !== 6) {
      showAlert('Invalid Code', 'Please enter the 6-digit code received in your email.');
      return;
    }
    setIsLoading(true);
    try {
      await register(name.trim(), username.trim(), email.trim(), password, otp.trim(), currency);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert('🎉 Welcome!', 'Account created successfully! Please sign in.', [
        { text: 'Sign In', onPress: () => router.replace('/login') },
      ], 'success');
    } catch (error: any) {
      const isApiErr = error instanceof ApiError;
      const msg = isApiErr ? error.message : 'Invalid verification code or registration failed.';
      showAlert('Registration Failed', msg, undefined, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const inputBorder = (field: string) => (focusedField === field ? c.primary : c.border);
  const selectedCurrItem = WORLD_CURRENCIES.find((item) => item.code === currency) || WORLD_CURRENCIES[0];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: c.bg }]}
    >
      <AmbientAura />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 16, 48),
            paddingBottom: Math.max(insets.bottom + 20, 32),
          },
        ]}
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
              <View style={[styles.iconWrap, { backgroundColor: c.primary }]}>
                <Ionicons name="person-add" size={24} color="#10120E" />
              </View>
              <Text style={[styles.title, { color: c.text }]}>Create Account</Text>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                {isEmailVerificationEnabled && otpSent
                  ? 'Enter the 6-digit OTP sent to your email'
                  : 'Join ExpenseTracker PRO and master your finances'}
              </Text>
            </View>
          </StaggeredView>

          {/* Google Sign-Up One-Tap */}
          {(!isEmailVerificationEnabled || !otpSent) && (
            <StaggeredView delay={130} direction="up">
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={isGoogleLoading || !request}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  promptAsync();
                }}
                style={[styles.googleOAuthBtn, { backgroundColor: c.inputBg, borderColor: c.border }]}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator color={c.primary} size="small" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={19} color="#EA4335" />
                    <Text style={[styles.googleOAuthText, { color: c.text }]}>Sign up with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
                <Text style={[styles.dividerText, { color: c.textMuted }]}>or register with email</Text>
                <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
              </View>
            </StaggeredView>
          )}

          {/* STEP 1: Details Entry */}
          {(!isEmailVerificationEnabled || !otpSent) && (
            <StaggeredView delay={160} direction="up">
              {/* Full Name */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: c.textMuted }]}>Full Name</Text>
                <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: inputBorder('name') }]}>
                  <Ionicons name="person-outline" size={18} color={focusedField === 'name' ? c.primary : c.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: c.text }]}
                    placeholder="John Doe"
                    placeholderTextColor={c.textMuted}
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              {/* Username Handle */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: c.textMuted }]}>Username Handle</Text>
                <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: inputBorder('username') }]}>
                  <Ionicons name="at-outline" size={18} color={focusedField === 'username' ? c.primary : c.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: c.text }]}
                    placeholder="johndoe_26"
                    placeholderTextColor={c.textMuted}
                    autoCapitalize="none"
                    value={username}
                    onChangeText={(val) => setUsername(val.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: c.textMuted }]}>Email Address</Text>
                <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: inputBorder('email') }]}>
                  <Ionicons name="mail-outline" size={18} color={focusedField === 'email' ? c.primary : c.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: c.text }]}
                    placeholder="john@example.com"
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

              {/* Preferred Ledger Currency Selector */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: c.textMuted }]}>Preferred Currency</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowCurrencyModal(true)}
                  style={[styles.currencySelectorBox, { backgroundColor: c.inputBg, borderColor: c.border }]}
                >
                  <View style={styles.currencyLeft}>
                    <Text style={styles.currencyFlag}>{selectedCurrItem.flag}</Text>
                    <Text style={[styles.currencyName, { color: c.text }]}>
                      {selectedCurrItem.name} ({selectedCurrItem.code})
                    </Text>
                  </View>
                  <View style={[styles.currencyBadge, { backgroundColor: c.primary + '18' }]}>
                    <Text style={[styles.currencySymbol, { color: c.primary }]}>{selectedCurrItem.symbol}</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Password */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: c.textMuted }]}>Password</Text>
                <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: inputBorder('password') }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={focusedField === 'password' ? c.primary : c.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: c.text }]}
                    placeholder="Min 6 characters"
                    placeholderTextColor={c.textMuted}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={c.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: c.textMuted }]}>Confirm Password</Text>
                <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: inputBorder('confirmPassword') }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={focusedField === 'confirmPassword' ? c.primary : c.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: c.text }]}
                    placeholder="Re-enter password"
                    placeholderTextColor={c.textMuted}
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={() => setFocusedField('confirmPassword')}
                    onBlur={() => setFocusedField(null)}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                    <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} color={c.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit Button */}
              {isEmailVerificationEnabled ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: c.primary, opacity: isLoading ? 0.7 : 1 }]}
                  onPress={handleSendOtp}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color={isLight ? '#FFF' : '#10120E'} size="small" />
                  ) : (
                    <View style={styles.btnInner}>
                      <Text style={[styles.btnText, { color: isLight ? '#FFF' : '#10120E' }]}>
                        Send Verification Code
                      </Text>
                      <Ionicons name="arrow-forward" size={18} color={isLight ? '#FFF' : '#10120E'} />
                    </View>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: c.primary, opacity: isLoading ? 0.7 : 1 }]}
                  onPress={handleRegisterDirect}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color={isLight ? '#FFF' : '#10120E'} size="small" />
                  ) : (
                    <View style={styles.btnInner}>
                      <Text style={[styles.btnText, { color: isLight ? '#FFF' : '#10120E' }]}>Create Account</Text>
                      <Ionicons name="checkmark-circle" size={18} color={isLight ? '#FFF' : '#10120E'} />
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </StaggeredView>
          )}

          {/* STEP 2: Email OTP Verification Entry */}
          {isEmailVerificationEnabled && otpSent && (
            <StaggeredView delay={150} direction="up">
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: c.textMuted }]}>6-Digit Verification Code</Text>
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

              <View style={styles.otpActionsRow}>
                <TouchableOpacity onPress={() => setOtpSent(false)}>
                  <Text style={[styles.otpActionText, { color: c.textMuted }]}>Edit details</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSendOtp} disabled={isLoading}>
                  <Text style={[styles.otpActionText, { color: c.primary }]}>Resend Code</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: c.primary, opacity: isLoading ? 0.7 : 1 }]}
                onPress={handleRegisterWithOtp}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color={isLight ? '#FFF' : '#10120E'} size="small" />
                ) : (
                  <View style={styles.btnInner}>
                    <Text style={[styles.btnText, { color: isLight ? '#FFF' : '#10120E' }]}>Verify & Sign Up</Text>
                    <Ionicons name="checkmark-circle" size={18} color={isLight ? '#FFF' : '#10120E'} />
                  </View>
                )}
              </TouchableOpacity>
            </StaggeredView>
          )}

          {/* Footer Navigation Link */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: c.textMuted }]}>Already have an account? </Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={[styles.footerLink, { color: c.primary }]}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Currency Selection Modal */}
      <Modal
        visible={showCurrencyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: c.text }]}>Select Preferred Currency</Text>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                <Ionicons name="close" size={22} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={WORLD_CURRENCIES}
              keyExtractor={(item) => item.code}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => {
                const isSelected = item.code === currency;
                return (
                  <TouchableOpacity
                    style={[
                      styles.currencyModalItem,
                      {
                        backgroundColor: isSelected ? c.primary + '18' : 'transparent',
                        borderColor: isSelected ? c.primary : c.border,
                      },
                    ]}
                    onPress={() => {
                      setCurrency(item.code);
                      setShowCurrencyModal(false);
                    }}
                  >
                    <View style={styles.modalItemLeft}>
                      <Text style={styles.modalItemFlag}>{item.flag}</Text>
                      <View>
                        <Text style={[styles.modalItemName, { color: c.text }]}>{item.name}</Text>
                        <Text style={[styles.modalItemCode, { color: c.textMuted }]}>{item.code}</Text>
                      </View>
                    </View>
                    <Text style={[styles.modalItemSymbol, { color: isSelected ? c.primary : c.text }]}>
                      {item.symbol}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
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
  googleOAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 4,
  },
  googleOAuthText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  currencySelectorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  currencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyFlag: {
    fontSize: 18,
  },
  currencyName: {
    fontSize: 13,
    fontWeight: '500',
  },
  currencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currencySymbol: {
    fontSize: 13,
    fontWeight: '700',
  },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
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
  otpActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  otpActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  currencyModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  modalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalItemFlag: {
    fontSize: 20,
  },
  modalItemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalItemCode: {
    fontSize: 11,
  },
  modalItemSymbol: {
    fontSize: 16,
    fontWeight: '700',
  },
});
