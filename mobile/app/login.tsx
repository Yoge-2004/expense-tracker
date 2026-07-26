import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, TextInput, View, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Animated, Dimensions
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const FEATURES = [
  { icon: 'trending-up', label: 'Track Spending', color: '#00D4AA' },
  { icon: 'pie-chart', label: 'Smart Budget', color: '#FF6B35' },
  { icon: 'repeat', label: 'Subscriptions', color: '#3B82F6' },
];

export default function LoginScreen() {
  const { login, theme } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const isLight = theme === 'light';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const heroSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
      Animated.timing(heroSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const c = {
    bg: isLight ? '#F0F4F8' : '#080B12',
    card: isLight ? '#FFFFFF' : 'rgba(13,18,30,0.9)',
    border: isLight ? '#D8E2F0' : 'rgba(255,255,255,0.08)',
    text: isLight ? '#0A1628' : '#F0F4FF',
    textMuted: isLight ? '#5B6880' : '#8B97B0',
    inputBg: isLight ? '#EAF0F8' : 'rgba(10,16,30,0.8)',
    accent: '#00D4AA',
    orange: '#FF6B35',
    blue: '#3B82F6',
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Info', 'Please enter your email and password.');
      return;
    }
    setIsLoading(true);
    try {
      await login(email.trim(), password);
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputBorder = (field: string) =>
    focusedField === field ? c.accent : c.border;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: c.bg }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* HERO SECTION */}
        <Animated.View
          style={[styles.heroSection, { opacity: fadeAnim, transform: [{ translateY: heroSlide }] }]}
        >
          {/* Decorative circles */}
          <View style={[styles.heroBubble, styles.heroBubble1, { backgroundColor: 'rgba(0,212,170,0.12)' }]} />
          <View style={[styles.heroBubble, styles.heroBubble2, { backgroundColor: 'rgba(255,107,53,0.1)' }]} />
          <View style={[styles.heroBubble, styles.heroBubble3, { backgroundColor: 'rgba(59,130,246,0.1)' }]} />

          <View style={styles.logoRow}>
            <View style={[styles.logoBox, { backgroundColor: c.accent }]}>
              <Ionicons name="wallet" size={28} color="#080B12" />
            </View>
            <View style={styles.logoTextGroup}>
              <Text style={[styles.logoTitle, { color: c.text }]}>ExpenseTracker</Text>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.heroTitle, { color: c.text }]}>
            Take control of{'\n'}your <Text style={{ color: c.accent }}>finances</Text>
          </Text>

          {/* Feature pills */}
          <View style={styles.featureRow}>
            {FEATURES.map((f, i) => (
              <View key={i} style={[styles.featurePill, { backgroundColor: `${f.color}18`, borderColor: `${f.color}40` }]}>
                <Ionicons name={f.icon as any} size={12} color={f.color} />
                <Text style={[styles.featurePillText, { color: f.color }]}>{f.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* FORM CARD */}
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
          <Text style={[styles.formTitle, { color: c.text }]}>Welcome back</Text>
          <Text style={[styles.formSubtitle, { color: c.textMuted }]}>Sign in to your account</Text>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Email</Text>
            <View style={[styles.inputWrapper, { backgroundColor: c.inputBg, borderColor: inputBorder('email') }]}>
              <Ionicons name="mail-outline" size={18} color={focusedField === 'email' ? c.accent : c.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: c.text }]}
                placeholder="name@example.com"
                placeholderTextColor={isLight ? '#9aaabb' : '#3d4d62'}
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
            <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Password</Text>
            <View style={[styles.inputWrapper, { backgroundColor: c.inputBg, borderColor: inputBorder('password') }]}>
              <Ionicons name="lock-closed-outline" size={18} color={focusedField === 'password' ? c.accent : c.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: c.text }]}
                placeholder="••••••••"
                placeholderTextColor={isLight ? '#9aaabb' : '#3d4d62'}
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
            style={[styles.signInBtn, { opacity: isLoading ? 0.7 : 1 }]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#080B12" size="small" />
            ) : (
              <View style={styles.signInBtnInner}>
                <Text style={styles.signInBtnText}>Sign In</Text>
                <Ionicons name="arrow-forward" size={18} color="#080B12" />
              </View>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
            <Text style={[styles.dividerText, { color: c.textMuted }]}>New here?</Text>
            <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
          </View>

          <Link href="/register" asChild>
            <TouchableOpacity style={[styles.createAccountBtn, { borderColor: c.border }]}>
              <Text style={[styles.createAccountText, { color: c.accent }]}>Create an Account</Text>
            </TouchableOpacity>
          </Link>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },

  /* HERO */
  heroSection: {
    marginBottom: 28,
    position: 'relative',
  },
  heroBubble: {
    position: 'absolute',
    borderRadius: 999,
  },
  heroBubble1: { width: 180, height: 180, top: -40, right: -60 },
  heroBubble2: { width: 120, height: 120, top: 20, right: 80 },
  heroBubble3: { width: 80, height: 80, top: 60, right: 10 },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    gap: 12,
  },
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  logoTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  proBadge: {
    backgroundColor: '#FF6B35',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 42,
    letterSpacing: -1,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  featurePillText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* FORM CARD */
  formCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    height: 52,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
  },
  eyeBtn: {
    padding: 4,
  },

  /* BUTTONS */
  signInBtn: {
    marginTop: 8,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#00D4AA',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  signInBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signInBtnText: {
    color: '#080B12',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  createAccountBtn: {
    height: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createAccountText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
