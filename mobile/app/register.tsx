import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, TextInput, View, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Animated,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const STEPS = ['Name', 'Email', 'Password'];

const PERKS = [
  { icon: 'shield-checkmark', text: 'Bank-grade security', color: '#C79A3E' },
  { icon: 'analytics', text: 'Smart spending insights', color: '#A23E32' },
  { icon: 'notifications', text: 'Budget alerts', color: '#4C7A78' },
  { icon: 'repeat', text: 'Subscription tracking', color: '#C9932E' },
];

export default function RegisterScreen() {
  const { register, theme } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const isLight = theme === 'light';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.93)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
    ]).start();
  }, []);

  const c = {
    bg: isLight ? '#EDEAE0' : '#10120E',
    card: isLight ? '#FFFFFF' : 'rgba(13,18,30,0.9)',
    border: isLight ? '#DAD4C1' : 'rgba(255,255,255,0.08)',
    text: isLight ? '#171A14' : '#ECE7D8',
    textMuted: isLight ? '#A8A395' : '#A8A395',
    inputBg: isLight ? '#FCFBF6' : 'rgba(10,16,30,0.8)',
    accent: '#C79A3E',
    orange: '#A23E32',
  };

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Missing Info', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    setIsLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      Alert.alert('🎉 Welcome!', 'Account created! Please sign in.', [
        { text: 'Sign In', onPress: () => router.replace('/login') }
      ]);
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputBorder = (field: string) =>
    focusedField === field ? c.accent : c.border;

  const completedCount = [name, email, password].filter(Boolean).length;
  const progressPct = (completedCount / 3) * 100;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: c.bg }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity
            style={[styles.backBtn, { borderColor: c.border, backgroundColor: c.inputBg }]}
            onPress={() => router.replace('/login')}
          >
            <Ionicons name="arrow-back" size={18} color={c.textMuted} />
          </TouchableOpacity>

          <View style={styles.headerTitle}>
            <Text style={[styles.headerLabel, { color: c.textMuted }]}>Step {completedCount + 1 > 3 ? 3 : completedCount + 1} of 3</Text>
            <Text style={[styles.pageTitle, { color: c.text }]}>Create your account</Text>

            {/* Progress bar */}
            <View style={[styles.progressBg, { backgroundColor: c.border }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { backgroundColor: c.accent, width: `${progressPct}%` },
                ]}
              />
            </View>
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
          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <View style={[styles.stepDot, { backgroundColor: name ? c.accent : c.border }]}>
                {name
                  ? <Ionicons name="checkmark" size={10} color="#10120E" />
                  : <Text style={styles.stepDotText}>1</Text>
                }
              </View>
              <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Full Name</Text>
            </View>
            <View style={[styles.inputWrapper, { backgroundColor: c.inputBg, borderColor: inputBorder('name') }]}>
              <Ionicons name="person-outline" size={18} color={focusedField === 'name' ? c.accent : c.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: c.text }]}
                placeholder="John Doe"
                placeholderTextColor={isLight ? '#A8A395' : '#2A2E22'}
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
              />
              {name.length > 0 && (
                <Ionicons name="checkmark-circle" size={18} color={c.accent} />
              )}
            </View>
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <View style={[styles.stepDot, { backgroundColor: email ? c.accent : c.border }]}>
                {email
                  ? <Ionicons name="checkmark" size={10} color="#10120E" />
                  : <Text style={styles.stepDotText}>2</Text>
                }
              </View>
              <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Email Address</Text>
            </View>
            <View style={[styles.inputWrapper, { backgroundColor: c.inputBg, borderColor: inputBorder('email') }]}>
              <Ionicons name="mail-outline" size={18} color={focusedField === 'email' ? c.accent : c.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: c.text }]}
                placeholder="name@example.com"
                placeholderTextColor={isLight ? '#A8A395' : '#2A2E22'}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
              {email.includes('@') && (
                <Ionicons name="checkmark-circle" size={18} color={c.accent} />
              )}
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <View style={[styles.stepDot, { backgroundColor: password.length >= 6 ? c.accent : c.border }]}>
                {password.length >= 6
                  ? <Ionicons name="checkmark" size={10} color="#10120E" />
                  : <Text style={styles.stepDotText}>3</Text>
                }
              </View>
              <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Password <Text style={{ color: c.textMuted, fontWeight: '400' }}>(min. 6 chars)</Text></Text>
            </View>
            <View style={[styles.inputWrapper, { backgroundColor: c.inputBg, borderColor: inputBorder('password') }]}>
              <Ionicons name="lock-closed-outline" size={18} color={focusedField === 'password' ? c.accent : c.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: c.text }]}
                placeholder="••••••••"
                placeholderTextColor={isLight ? '#A8A395' : '#2A2E22'}
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
            {/* Strength indicator */}
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {[1, 2, 3, 4].map(i => (
                  <View
                    key={i}
                    style={[
                      styles.strengthSegment,
                      {
                        backgroundColor:
                          password.length >= i * 3
                            ? i <= 1 ? '#A23E32' : i <= 2 ? '#C9932E' : i <= 3 ? '#A97F2E' : '#C79A3E'
                            : c.border,
                      },
                    ]}
                  />
                ))}
                <Text style={[styles.strengthLabel, { color: c.textMuted }]}>
                  {password.length < 4 ? 'Weak' : password.length < 7 ? 'Fair' : password.length < 10 ? 'Good' : 'Strong'}
                </Text>
              </View>
            )}
          </View>

          {/* SUBMIT */}
          <TouchableOpacity
            style={[styles.submitBtn, { opacity: isLoading ? 0.7 : 1 }]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#10120E" size="small" />
            ) : (
              <View style={styles.submitBtnInner}>
                <Text style={styles.submitBtnText}>Create Account</Text>
                <Ionicons name="rocket" size={18} color="#10120E" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.signInLink} onPress={() => router.replace('/login')}>
            <Text style={[styles.signInLinkText, { color: c.textMuted }]}>
              Already have an account?{' '}
              <Text style={{ color: c.accent, fontWeight: '800' }}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* PERKS SECTION */}
        <Animated.View style={[styles.perksSection, { opacity: fadeAnim }]}>
          <Text style={[styles.perksTitle, { color: c.textMuted }]}>Everything you get for free</Text>
          <View style={styles.perksGrid}>
            {PERKS.map((perk, i) => (
              <View key={i} style={[styles.perkItem, { backgroundColor: perk.color + '12', borderColor: perk.color + '30' }]}>
                <Ionicons name={perk.icon as any} size={16} color={perk.color} />
                <Text style={[styles.perkText, { color: perk.color }]}>{perk.text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },

  /* HEADER */
  header: {
    marginBottom: 24,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {},
  headerLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 16,
  },
  progressBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  /* FORM CARD */
  formCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#A8A395',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  input: { flex: 1, fontSize: 15 },
  eyeBtn: { padding: 4 },

  /* STRENGTH */
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  strengthSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '600',
    width: 42,
    textAlign: 'right',
  },

  /* SUBMIT */
  submitBtn: {
    marginTop: 8,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#C79A3E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#C79A3E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  submitBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#10120E',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  signInLink: {
    marginTop: 18,
    alignItems: 'center',
  },
  signInLinkText: {
    fontSize: 14,
  },

  /* PERKS */
  perksSection: {},
  perksTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 12,
  },
  perksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  perkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  perkText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
