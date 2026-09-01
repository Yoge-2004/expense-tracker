/**
 * @file login.tsx
 * @description Secure Authentication / Sign-In Screen.
 * Features:
 * - Google Sign-In with official Google OAuth ID token verification.
 * - Ambient aura background and fluid staggered spring animations.
 * - Focused input glow and responsive exception handling.
 * - Full iOS and Android safe area adaptation.
 */

import React, { useState, useRef, useEffect } from 'react';
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
import { ApiError } from '../services/api';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AmbientAura } from '../components/AmbientAura';
import { StaggeredView } from '../components/StaggeredView';
import { performGoogleSignIn } from '../services/googleAuth';

const FEATURES = [
  { icon: 'trending-up', label: 'Real-time Analytics', color: '#C79A3E' },
  { icon: 'shield-checkmark', label: 'Bank-Grade Security', color: '#4C7A78' },
  { icon: 'globe', label: 'Multi-Currency', color: '#5B8C5A' },
  { icon: 'sparkles', label: 'Zero Ads', color: '#A23E32' },
];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginScreen() {
  const { login, loginWithGoogle, theme } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const c = Colors[theme];
  const isLight = theme === 'light';
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const heroSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
      Animated.timing(heroSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      Haptics.selectionAsync().catch(() => {});
      const idToken = await performGoogleSignIn();
      if (idToken) {
        await loginWithGoogle(idToken);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : err.message || 'Google authentication failed.';
      showAlert('Google Sign-In Failed', msg, undefined, 'error');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      showAlert('Missing Email', 'Please enter your registered email address.');
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      showAlert('Invalid Email', 'Please enter a valid email format (e.g. name@domain.com).');
      return;
    }
    if (!password) {
      showAlert('Missing Password', 'Please enter your account password.');
      return;
    }

    setIsLoading(true);
    try {
      await login(cleanEmail, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error: any) {
      const isApiErr = error instanceof ApiError;
      let alertTitle = 'Sign In Failed';
      let alertMsg = error.message || 'Invalid email or password.';

      if (isApiErr) {
        if (error.code === 'NETWORK_OFFLINE') {
          alertTitle = 'Connection Error';
          alertMsg = 'Unable to reach backend server. Please check your internet connection.';
        } else if (error.code === 'TIMEOUT') {
          alertTitle = 'Request Timeout';
          alertMsg = 'Authentication request timed out. Please retry.';
        } else if (error.status === 401) {
          alertTitle = 'Invalid Credentials';
          alertMsg = 'The email or password entered is incorrect.';
        }
      }

      showAlert(alertTitle, alertMsg, undefined, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const inputBorder = (field: string) => (focusedField === field ? c.primary : c.border);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: c.bg }]}
    >
      <AmbientAura />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: Math.max(insets.top + 16, 48),
            paddingBottom: Math.max(insets.bottom + 20, 32),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* HERO BRANDING SECTION */}
        <Animated.View
          style={[styles.heroSection, { opacity: fadeAnim, transform: [{ translateY: heroSlide }] }]}
        >
          <View style={styles.logoRow}>
            <View style={[styles.logoBox, { backgroundColor: c.primary }]}>
              <Ionicons name="wallet" size={28} color="#10120E" />
            </View>
            <View style={styles.logoTextGroup}>
              <Text style={[styles.logoTitle, { color: c.text }]}>ExpenseTracker</Text>
              <View style={[styles.proBadge, { backgroundColor: c.accent }]}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.heroTitle, { color: c.text }]}>
            Master your cashflow with <Text style={{ color: c.primary }}>clarity</Text>
          </Text>

          {/* Feature pills */}
          <View style={styles.featureRow}>
            {FEATURES.map((f, i) => (
              <View
                key={i}
                style={[
                  styles.featurePill,
                  { backgroundColor: `${f.color}14`, borderColor: `${f.color}35` },
                ]}
              >
                <Ionicons name={f.icon as any} size={11} color={f.color} />
                <Text style={[styles.featurePillText, { color: f.color }]}>{f.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* AUTHENTICATION FORM CARD */}
        <Animated.View
          style={[
            styles.formCard,
            {
              backgroundColor: c.card,
              borderColor: c.border,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            },
          ]}
        >
          <StaggeredView delay={100} direction="down">
            <Text style={[styles.formTitle, { color: c.text }]}>Welcome back</Text>
            <Text style={[styles.formSubtitle, { color: c.textMuted }]}>Sign in to your private financial ledger</Text>
          </StaggeredView>

          {/* Google Sign-In One-Tap Button */}
          <StaggeredView delay={130} direction="up">
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={isGoogleLoading}
              onPress={handleGoogleSignIn}
              style={[styles.googleOAuthBtn, { backgroundColor: c.inputBg, borderColor: c.border }]}
            >
              {isGoogleLoading ? (
                <ActivityIndicator color={c.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={19} color="#EA4335" />
                  <Text style={[styles.googleOAuthText, { color: c.text }]}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
              <Text style={[styles.dividerText, { color: c.textMuted }]}>or sign in with email</Text>
              <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
            </View>
          </StaggeredView>

          {/* Form Fields */}
          <StaggeredView delay={160} direction="up">
            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Email Address</Text>
              <View style={[styles.inputWrapper, { backgroundColor: c.inputBg, borderColor: inputBorder('email') }]}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={focusedField === 'email' ? c.primary : c.textMuted}
                  style={styles.inputIcon}
                />
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

            {/* Password */}
            <View style={styles.fieldGroup}>
              <View style={styles.passwordHeader}>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Password</Text>
                <Link href="/forgot-password" asChild>
                  <TouchableOpacity>
                    <Text style={[styles.forgotText, { color: c.primary }]}>Forgot password?</Text>
                  </TouchableOpacity>
                </Link>
              </View>

              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: c.inputBg, borderColor: inputBorder('password') },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={focusedField === 'password' ? c.primary : c.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: c.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={c.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
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

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.signInBtn, { backgroundColor: c.primary, opacity: isLoading ? 0.7 : 1 }]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={isLight ? '#FFF' : '#10120E'} size="small" />
              ) : (
                <View style={styles.signInBtnInner}>
                  <Text style={[styles.signInBtnText, { color: isLight ? '#FFF' : '#10120E' }]}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={18} color={isLight ? '#FFF' : '#10120E'} />
                </View>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
              <Text style={[styles.dividerText, { color: c.textMuted }]}>New to Ledger?</Text>
              <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
            </View>

            <Link href="/register" asChild>
              <TouchableOpacity style={[styles.createAccountBtn, { borderColor: c.border }]}>
                <Text style={[styles.createAccountText, { color: c.primary }]}>Create Free Account</Text>
              </TouchableOpacity>
            </Link>
          </StaggeredView>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  proBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  featurePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  formCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
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
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 6,
  },
  signInBtn: {
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  signInBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signInBtnText: {
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
  createAccountBtn: {
    borderWidth: 1,
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createAccountText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
