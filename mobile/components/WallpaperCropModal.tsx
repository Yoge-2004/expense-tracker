import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../constants/theme';
import { ThemedText as Text } from './ThemedText';

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WallpaperCropModalProps {
  visible: boolean;
  uri: string | null;
  imageWidth: number;
  imageHeight: number;
  colors: ThemeColors;
  onCancel: () => void;
  onApply: (uri: string) => Promise<void> | void;
}

const MIN_SELECTION = 0.035;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const WallpaperCropModal: React.FC<WallpaperCropModalProps> = ({
  visible,
  uri,
  imageWidth,
  imageHeight,
  colors: c,
  onCancel,
  onApply,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const frameRef = useRef<React.ComponentRef<typeof View>>(null);
  const frameOffset = useRef({ x: 0, y: 0 });
  const frameSize = useRef({ width: 0, height: 0 });
  const selectionRef = useRef<CropRect | null>(null);
  const gestureRef = useRef<{ mode: 'select' | 'move' | 'resize'; start: { x: number; y: number }; original: CropRect | null } | null>(null);
  const [selection, setSelection] = useState<CropRect | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aspect = imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 1;
  const maxFrameWidth = Math.max(180, Math.min(screenWidth - 40, 440));
  const maxFrameHeight = Math.max(180, Math.min(screenHeight - 310, 420));
  const frameWidth = Math.max(1, Math.min(maxFrameWidth, maxFrameHeight * aspect));
  const frameHeight = Math.max(1, frameWidth / aspect);
  frameSize.current = { width: frameWidth, height: frameHeight };

  const updateSelection = (rect: CropRect | null) => {
    selectionRef.current = rect;
    setSelection(rect);
  };
  const updateSelectionRef = useRef(updateSelection);
  updateSelectionRef.current = updateSelection;

  useEffect(() => {
    if (visible) {
      updateSelection(null);
      setError(null);
      setProcessing(false);
      requestAnimationFrame(() => {
        frameRef.current?.measureInWindow((x, y) => {
          frameOffset.current = { x, y };
        });
      });
    }
  }, [visible, uri]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const size = frameSize.current;
        const point = {
          x: clamp((event.nativeEvent.pageX - frameOffset.current.x) / Math.max(1, size.width), 0, 1),
          y: clamp((event.nativeEvent.pageY - frameOffset.current.y) / Math.max(1, size.height), 0, 1),
        };
        const original = selectionRef.current;
        const nearResizeHandle = !!original &&
          Math.abs(point.x - (original.x + original.width)) < 0.09 &&
          Math.abs(point.y - (original.y + original.height)) < 0.12;
        const insideSelection = !!original && point.x >= original.x && point.x <= original.x + original.width && point.y >= original.y && point.y <= original.y + original.height;
        const mode = nearResizeHandle ? 'resize' : insideSelection ? 'move' : 'select';
        gestureRef.current = { mode, start: point, original: original ? { ...original } : null };
        if (mode === 'select') updateSelectionRef.current({ x: point.x, y: point.y, width: 0, height: 0 });
      },
      onPanResponderMove: (_, gesture) => {
        const active = gestureRef.current;
        if (!active) return;
        const size = frameSize.current;
        const point = {
          x: clamp((gesture.moveX - frameOffset.current.x) / Math.max(1, size.width), 0, 1),
          y: clamp((gesture.moveY - frameOffset.current.y) / Math.max(1, size.height), 0, 1),
        };
        const origin = active.original;
        if (active.mode === 'move' && origin) {
          updateSelectionRef.current({
            ...origin,
            x: clamp(origin.x + point.x - active.start.x, 0, 1 - origin.width),
            y: clamp(origin.y + point.y - active.start.y, 0, 1 - origin.height),
          });
          return;
        }
        if (active.mode === 'resize' && origin) {
          updateSelectionRef.current({
            ...origin,
            width: clamp(origin.width + point.x - active.start.x, MIN_SELECTION, 1 - origin.x),
            height: clamp(origin.height + point.y - active.start.y, MIN_SELECTION, 1 - origin.y),
          });
          return;
        }
        const left = Math.min(active.start.x, point.x);
        const top = Math.min(active.start.y, point.y);
        updateSelectionRef.current({
          x: left,
          y: top,
          width: Math.min(1 - left, Math.max(MIN_SELECTION, Math.abs(point.x - active.start.x))),
          height: Math.min(1 - top, Math.max(MIN_SELECTION, Math.abs(point.y - active.start.y))),
        });
      },
      onPanResponderRelease: () => { gestureRef.current = null; },
      onPanResponderTerminate: () => { gestureRef.current = null; },
    }), []
  );

  const applyCrop = async () => {
    if (!uri || !selection || processing) return;
    setProcessing(true);
    setError(null);
    try {
      const crop = {
        originX: Math.max(0, Math.round(selection.x * imageWidth)),
        originY: Math.max(0, Math.round(selection.y * imageHeight)),
        width: Math.max(1, Math.min(imageWidth, Math.round(selection.width * imageWidth))),
        height: Math.max(1, Math.min(imageHeight, Math.round(selection.height * imageHeight))),
      };
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop }],
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
      );
      await onApply(result.uri);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not crop this image. Try another image.');
      setProcessing(false);
    }
  };

  const renderMasks = () => {
    if (!selection) return null;
    const left = selection.x * frameWidth;
    const top = selection.y * frameHeight;
    const selectedWidth = selection.width * frameWidth;
    const selectedHeight = selection.height * frameHeight;
    const right = frameWidth - left - selectedWidth;
    const bottom = frameHeight - top - selectedHeight;
    const maskColor = 'rgba(0, 0, 0, 0.56)';
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={{ position: 'absolute', left: 0, top: 0, right: 0, height: top, backgroundColor: maskColor }} />
        <View style={{ position: 'absolute', left: 0, top: top + selectedHeight, right: 0, height: bottom, backgroundColor: maskColor }} />
        <View style={{ position: 'absolute', left: 0, top, width: left, height: selectedHeight, backgroundColor: maskColor }} />
        <View style={{ position: 'absolute', left: left + selectedWidth, top, width: right, height: selectedHeight, backgroundColor: maskColor }} />
        <View style={{ position: 'absolute', left, top, width: selectedWidth, height: selectedHeight, borderWidth: 2, borderColor: c.primary }} />
        <View style={{ position: 'absolute', left: left + selectedWidth - 11, top: top + selectedHeight - 11, width: 22, height: 22, borderRadius: 11, backgroundColor: c.primary, borderWidth: 2, borderColor: c.onPrimary }} />
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="overFullScreen" onRequestClose={onCancel}>
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <View style={styles.content}>
          <View style={styles.headingRow}>
            <View style={[styles.headingIcon, { backgroundColor: c.primary + '20' }]}>
              <Ionicons name="crop-outline" size={20} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: c.text }]}>Crop wallpaper</Text>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>Drag anywhere to select an area, move inside it, or resize from the corner.</Text>
            </View>
          </View>

          {uri && (
            <View
              ref={frameRef}
              onLayout={() => frameRef.current?.measureInWindow((x, y) => { frameOffset.current = { x, y }; })}
              style={[styles.imageFrame, { width: frameWidth, height: frameHeight, borderColor: c.borderAccent }]}
              {...panResponder.panHandlers}
            >
              <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="stretch" />
              {renderMasks()}
            </View>
          )}

          <View style={styles.instructionRow}>
            <Ionicons name={selection ? 'checkmark-circle-outline' : 'hand-left-outline'} size={15} color={selection ? c.success : c.highlight} />
            <Text style={[styles.instruction, { color: c.textMuted }]}>
              {selection ? `${Math.round(selection.width * 100)}% × ${Math.round(selection.height * 100)}% selected` : 'No crop is selected yet.'}
            </Text>
            {selection && <TouchableOpacity onPress={() => updateSelection(null)} accessibilityRole="button"><Text style={[styles.reset, { color: c.primary }]}>Reset</Text></TouchableOpacity>}
          </View>
          {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}

          <View style={styles.actions}>
            <TouchableOpacity onPress={onCancel} disabled={processing} style={[styles.cancelButton, { backgroundColor: c.inputBg, borderColor: c.border }]} accessibilityRole="button">
              <Text style={[styles.cancelText, { color: c.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void applyCrop()} disabled={!selection || processing} style={[styles.applyButton, { backgroundColor: selection ? c.primary : c.inputBg, opacity: processing ? 0.7 : 1 }]} accessibilityRole="button">
              {processing ? <ActivityIndicator color={c.onPrimary} size="small" /> : <Ionicons name="checkmark" size={17} color={selection ? c.onPrimary : c.textMuted} />}
              <Text style={[styles.applyText, { color: selection ? c.onPrimary : c.textMuted }]}>{processing ? 'Applying…' : 'Apply crop'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  content: { width: '100%', maxWidth: 560, padding: 18, borderRadius: 20, backgroundColor: 'rgba(16, 18, 14, 0.98)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', gap: 14 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  imageFrame: { alignSelf: 'center', overflow: 'hidden', borderWidth: 1, borderRadius: 8, backgroundColor: '#000' },
  instructionRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  instruction: { flex: 1, fontSize: 12 },
  reset: { fontSize: 12, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 4 },
  error: { fontSize: 12, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  cancelButton: { minHeight: 44, flex: 1, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 13, fontWeight: '700' },
  applyButton: { minHeight: 44, flex: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  applyText: { fontSize: 13, fontWeight: '800' },
});
