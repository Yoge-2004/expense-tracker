/**
 * @file forgot-password.tsx
 * @description Secure Password Recovery screen.
 * Adapts dynamically to account security settings:
 * - If user has a 6-digit Security PIN: Authenticates via PIN for zero-email instant recovery.
 * - If email verification is enabled: Dispatches 6-digit OTP to account email.
 * Includes defensive client-side validation and lockout handling.
 */

import React, { useState, useEffect, useRef } from "react";
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
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import { apiRequest, ApiError } from "../services/api";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { AmbientAura } from "../components/AmbientAura";
import { StaggeredView } from "../components/StaggeredView";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ForgotPasswordScreen() {
  const { theme } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const c = Colors[theme];
  const isLight = theme === "light";
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSecurityPin, setHasSecurityPin] = useState(false);
  const [isEmailVerificationEnabled, setIsEmailVerificationEnabled] = useState(false);
  const [step, setStep] = useState<"request" | "verify">("request");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [step]);

  // Step 1: Initiate Password Recovery
  const handleInitiateRecovery = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showAlert("Missing Email", "Please enter your registered email address.");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      showAlert("Invalid Email", "Please enter a valid email format (e.g. name@domain.com).");
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiRequest("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const pinConfigured = !!res?.hasSecurityPin;
      const emailEnabled = !!res?.emailVerificationEnabled;

      setHasSecurityPin(pinConfigured);
      setIsEmailVerificationEnabled(emailEnabled);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (pinConfigured) {
        showAlert(
          "Security PIN Verification 🔒",
          "Account verified. Please enter your 6-digit Security PIN to proceed.",
          [{ text: "Continue", onPress: () => setStep("verify") }],
          "info"
        );
      } else if (emailEnabled) {
        showAlert(
          "Verification Code Dispatched 📩",
          `A 6-digit verification code has been sent to ${trimmedEmail}.`,
          [{ text: "Enter Code", onPress: () => setStep("verify") }],
          "success"
        );
      } else {
        showAlert(
          "Security PIN Required",
          "No 6-digit Security PIN was found for this account and email service is not active. Please contact administrator.",
          undefined,
          "error"
        );
        return;
      }

      setStep("verify");
    } catch (e: any) {
      const isApiErr = e instanceof ApiError;
      const msg = isApiErr ? e.message : "Could not process password recovery.";
      showAlert("Request Failed", msg, undefined, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify PIN/OTP & Set New Password
  const handleResetPassword = async () => {
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();

    if (!trimmedEmail) {
      showAlert("Missing Email", "Please enter your account email address.");
      return;
    }

    if (!trimmedCode || !/^[0-9]{6}$/.test(trimmedCode)) {
      showAlert(
        "Invalid Code / PIN",
        hasSecurityPin
          ? "Please enter your 6-digit Security PIN."
          : "Please enter the 6-digit verification code."
      );
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      showAlert("Weak Password", "Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert("Password Mismatch", "New password and confirmation password do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest("/auth/reset-password", {
        method: "PUT",
        body: JSON.stringify({
          email: trimmedEmail,
          securityPin: trimmedCode,
          otp: trimmedCode,
          newPassword,
        }),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert("🎉 Password Updated", "Your password has been reset successfully. Please sign in.", [
        { text: "Sign In", onPress: () => router.replace("/login") },
      ], "success");
    } catch (e: any) {
      const isApiErr = e instanceof ApiError;
      const msg = isApiErr ? e.message : "Password update failed. Please check your credentials.";
      showAlert("Reset Failed", msg, undefined, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const inputBorder = (field: string) => (focusedField === field ? c.primary : c.border);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
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
              <View style={[styles.iconWrap, { backgroundColor: c.primary + "18" }]}>
                <Ionicons name={step === "verify" ? "shield-checkmark-outline" : "key-outline"} size={24} color={c.primary} />
              </View>
              <Text style={[styles.title, { color: c.text }]}>
                {step === "request" ? "Reset Password" : "Set New Password"}
              </Text>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                {step === "request"
                  ? "Enter your account email to proceed with secure verification"
                  : hasSecurityPin
                  ? "Enter your 6-digit Security PIN and choose a new password"
                  : "Enter the 6-digit verification code and choose a new password"}
              </Text>
            </View>
          </StaggeredView>

          {/* STEP 1: REQUEST */}
          {step === "request" && (
            <StaggeredView delay={150} direction="up">
              <View style={styles.formSection}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: c.textMuted }]}>Registered Email</Text>
                  <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: inputBorder("email") }]}>
                    <Ionicons name="mail-outline" size={18} color={focusedField === "email" ? c.primary : c.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: c.text }]}
                      placeholder="name@example.com"
                      placeholderTextColor={c.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: c.primary, opacity: isLoading ? 0.7 : 1 }]}
                  onPress={handleInitiateRecovery}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color={isLight ? "#FFF" : "#10120E"} size="small" />
                  ) : (
                    <View style={styles.btnInner}>
                      <Text style={[styles.btnText, { color: isLight ? "#FFF" : "#10120E" }]}>Continue</Text>
                      <Ionicons name="arrow-forward" size={18} color={isLight ? "#FFF" : "#10120E"} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </StaggeredView>
          )}

          {/* STEP 2: VERIFY & RESET */}
          {step === "verify" && (
            <StaggeredView delay={150} direction="up">
              <View style={styles.formSection}>
                {/* 6-Digit PIN/OTP code box */}
                <View style={styles.fieldGroup}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: c.textMuted }]}>
                      {hasSecurityPin ? "6-Digit Security PIN" : "6-Digit Verification Code"}
                    </Text>
                    <Text style={[styles.helperBadge, { color: c.primary }]}>
                      {hasSecurityPin ? "🔒 Zero-Email" : "📩 Code Sent"}
                    </Text>
                  </View>
                  <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: inputBorder("code") }]}>
                    <Ionicons name={hasSecurityPin ? "lock-closed-outline" : "key-outline"} size={18} color={focusedField === "code" ? c.primary : c.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: c.text, letterSpacing: 4, fontWeight: "700", fontSize: 18 }]}
                      placeholder="123456"
                      placeholderTextColor={c.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={code}
                      onChangeText={setCode}
                      secureTextEntry={hasSecurityPin}
                      onFocus={() => setFocusedField("code")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                {/* New Password */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: c.textMuted }]}>New Password</Text>
                  <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: inputBorder("newPass") }]}>
                    <Ionicons name="lock-closed-outline" size={18} color={focusedField === "newPass" ? c.primary : c.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: c.text }]}
                      placeholder="Min 6 characters"
                      placeholderTextColor={c.textMuted}
                      secureTextEntry={!showPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      onFocus={() => setFocusedField("newPass")}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                      <Ionicons name={showPassword ? "eye-off" : "eye"} size={18} color={c.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: c.textMuted }]}>Confirm New Password</Text>
                  <View style={[styles.inputBox, { backgroundColor: c.inputBg, borderColor: inputBorder("confPass") }]}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={focusedField === "confPass" ? c.primary : c.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: c.text }]}
                      placeholder="Re-enter new password"
                      placeholderTextColor={c.textMuted}
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setFocusedField("confPass")}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                      <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={18} color={c.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.otpActionsRow}>
                  <TouchableOpacity onPress={() => setStep("request")}>
                    <Text style={[styles.otpActionText, { color: c.textMuted }]}>Change Email</Text>
                  </TouchableOpacity>
                  {isEmailVerificationEnabled && !hasSecurityPin && (
                    <TouchableOpacity onPress={handleInitiateRecovery} disabled={isLoading}>
                      <Text style={[styles.otpActionText, { color: c.primary }]}>Resend Code</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: c.primary, opacity: isLoading ? 0.7 : 1 }]}
                  onPress={handleResetPassword}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color={isLight ? "#FFF" : "#10120E"} size="small" />
                  ) : (
                    <View style={styles.btnInner}>
                      <Text style={[styles.btnText, { color: isLight ? "#FFF" : "#10120E" }]}>Update Password</Text>
                      <Ionicons name="checkmark-circle" size={18} color={isLight ? "#FFF" : "#10120E"} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </StaggeredView>
          )}

          {/* Footer Back to Login Link */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => router.replace("/login")}
              style={StyleSheet.flatten([styles.backBtn])}
            >
              <Ionicons name="arrow-back" size={16} color={c.primary} />
              <Text style={[styles.backText, { color: c.primary }]} numberOfLines={1}>Back to Sign In</Text>
            </TouchableOpacity>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    paddingTop: 48,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  formSection: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  helperBadge: {
    fontSize: 12,
    fontWeight: "600",
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  eyeBtn: {
    padding: 6,
  },
  otpActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
    marginTop: -4,
  },
  otpActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  submitBtn: {
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    marginTop: 24,
    alignItems: "center",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
