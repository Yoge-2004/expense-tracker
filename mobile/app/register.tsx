import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const { register, theme } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isLight = theme === 'light';

  const getThemeColors = () => {
    if (theme === 'light') {
      return {
        bg: '#F8FAFC',
        card: '#FFFFFF',
        border: '#E2E8F0',
        text: '#0F172A',
        textMuted: '#64748B',
        inputBg: '#F1F5F9',
        accent: '#6366F1',
      };
    }
    return {
      bg: '#090D16',
      card: 'rgba(17, 24, 39, 0.85)',
      border: 'rgba(255, 255, 255, 0.08)',
      text: '#F8FAFC',
      textMuted: '#94A3B8',
      inputBg: 'rgba(15, 23, 42, 0.6)',
      accent: '#6366F1',
    };
  };

  const c = getThemeColors();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      Alert.alert('Success', 'Account created successfully! Please sign in.', [
        { text: 'OK', onPress: () => router.replace('/login') }
      ]);
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: c.bg }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>Sign up to start tracking expenses</Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: c.textMuted }]}>Full Name</Text>
          <View style={[styles.inputContainer, { backgroundColor: c.inputBg, borderColor: c.border }]}>
            <Ionicons name="person-outline" size={20} color={c.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: c.text }]}
              placeholder="John Doe"
              placeholderTextColor={isLight ? '#9ca3af' : '#4b5563'}
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
            />
          </View>

          <Text style={[styles.label, { color: c.textMuted }]}>Email Address</Text>
          <View style={[styles.inputContainer, { backgroundColor: c.inputBg, borderColor: c.border }]}>
            <Ionicons name="mail-outline" size={20} color={c.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: c.text }]}
              placeholder="name@example.com"
              placeholderTextColor={isLight ? '#9ca3af' : '#4b5563'}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <Text style={[styles.label, { color: c.textMuted }]}>Password (minimum 6 characters)</Text>
          <View style={[styles.inputContainer, { backgroundColor: c.inputBg, borderColor: c.border }]}>
            <Ionicons name="lock-closed-outline" size={20} color={c.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: c.text }]}
              placeholder="••••••••"
              placeholderTextColor={isLight ? '#9ca3af' : '#4b5563'}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.button, { backgroundColor: c.accent }]} onPress={handleRegister} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#05070D" />
            ) : (
              <Text style={styles.buttonText}>Register</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: c.textMuted }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/login')}>
            <Text style={[styles.linkText, { color: c.accent }]}>Sign In</Text>
          </TouchableOpacity>
        </View>
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
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 12,
    height: 52,
    borderWidth: 1,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 4,
  },
  button: {
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#FF9F6E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#05070D',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
  },
  linkText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
