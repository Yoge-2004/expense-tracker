/**
 * @file AvatarEditModal.tsx
 * @description Accessible profile avatar customization modal.
 * Supports choosing from local device files / photos, specifying custom image URL,
 * and resetting to the monogram default avatar.
 */

import React, { memo, useState, useEffect } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText as Text, ThemedTextInput as TextInput } from '../ThemedText';
import { ThemeColors } from '../../constants/theme';
import { resolveAvatarUrl } from '../../services/api';

export interface AvatarEditModalProps {
  visible: boolean;
  colors: ThemeColors;
  userName: string | null;
  profilePicture: string | null;
  isSaving: boolean;
  onClose: () => void;
  onPickLocalAvatar: () => Promise<void>;
  onSaveAvatarUrl: (url: string) => Promise<void>;
  onClearAvatar: () => Promise<void>;
}

export const AvatarEditModal = memo(function AvatarEditModal({
  visible,
  colors: c,
  userName,
  profilePicture,
  isSaving,
  onClose,
  onPickLocalAvatar,
  onSaveAvatarUrl,
  onClearAvatar,
}: AvatarEditModalProps) {
  const [avatarUrlInput, setAvatarUrlInput] = useState(profilePicture || '');

  useEffect(() => {
    if (visible) {
      setAvatarUrlInput(profilePicture || '');
    }
  }, [visible, profilePicture]);

  const previewUri = resolveAvatarUrl(avatarUrlInput.trim() || profilePicture);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '100%', maxWidth: 420 }}
        >
          <View style={[styles.avatarModalCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.headerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="image-outline" size={20} color={c.primary} />
                <Text style={[styles.modalTitle, { color: c.text }]}>Profile Picture</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={[styles.closeBtn, { backgroundColor: c.inputBg }]}
                accessibilityLabel="Close profile picture modal"
              >
                <Ionicons name="close" size={18} color={c.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDesc, { color: c.textMuted }]}>
              Update your profile picture by browsing your device files or entering a web image URL.
            </Text>

            {/* Preview */}
            <View style={{ alignItems: 'center', marginVertical: 12 }}>
              <View
                style={[
                  styles.bigAvatar,
                  {
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: c.primary,
                    borderColor: c.primary + '60',
                  },
                ]}
              >
                {previewUri ? (
                  <Image
                    source={{ uri: previewUri }}
                    style={[styles.bigAvatarImg, { borderRadius: 40 }]}
                  />
                ) : (
                  <Text style={[styles.avatarLetter, { fontSize: 32, color: c.onPrimary }]}>
                    {(userName || 'U').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
            </View>

            {/* Local File Browser Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onPickLocalAvatar}
              disabled={isSaving}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: c.primary,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 16,
                  opacity: isSaving ? 0.7 : 1,
                },
              ]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={c.onPrimary} />
              ) : (
                <>
                  <Ionicons name="images-outline" size={18} color={c.onPrimary} />
                  <Text style={[styles.actionBtnText, { color: c.onPrimary }]}>
                    Browse Files & Photos
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: c.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Or paste image URL
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: c.textMuted }]}>IMAGE URL</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: c.inputBg,
                    borderColor: c.border,
                    color: c.text,
                    fontSize: 13,
                  },
                ]}
                placeholder="https://example.com/avatar.jpg"
                placeholderTextColor={c.textMuted}
                value={avatarUrlInput}
                onChangeText={setAvatarUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => onSaveAvatarUrl(avatarUrlInput.trim())}
              disabled={isSaving}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: c.inputBg,
                  borderColor: c.border,
                  borderWidth: 1,
                  opacity: isSaving ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.actionBtnText, { color: c.text }]}>
                Save URL
              </Text>
            </TouchableOpacity>

            {profilePicture ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onClearAvatar}
                disabled={isSaving}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: c.accent,
                    marginTop: 8,
                  },
                ]}
              >
                <Text style={[styles.actionBtnText, { color: c.accent }]}>
                  Remove Current Avatar
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  avatarModalCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  bigAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
  bigAvatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarLetter: {
    fontWeight: '900',
  },
  fieldWrap: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
