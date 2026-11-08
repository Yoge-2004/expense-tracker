import React, { forwardRef } from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  TextInputProps,
  TextProps,
  TextStyle,
} from 'react-native';
import { useOptionalActiveFonts } from '../context/PreferencesContext';

export function fontForWeight(fonts: ReturnType<typeof useOptionalActiveFonts>, style: TextStyle): string {
  if (typeof style.fontFamily === 'string' && style.fontFamily.length > 0) return style.fontFamily;
  const weight = style.fontWeight === 'bold'
    ? 700
    : typeof style.fontWeight === 'string'
      ? Number.parseInt(style.fontWeight, 10)
      : style.fontWeight;
  if (Number(style.fontSize || 0) >= 22) return fonts.display;
  if (Number(weight) >= 700) return fonts.bodyBold;
  if (Number(weight) >= 600) return fonts.bodySemiBold;
  if (Number(weight) >= 500) return fonts.bodyMedium;
  return fonts.body;
}

/** Applies the active Appearance Studio font while preserving explicit mono/custom styles. */
export const ThemedText = forwardRef<React.ElementRef<typeof NativeText>, TextProps>(
  ({ style, ...props }, ref) => {
    const activeFonts = useOptionalActiveFonts();
    const flattenedStyle = (StyleSheet.flatten(style as StyleProp<TextStyle>) || {}) as TextStyle;
    const fontFamily = fontForWeight(activeFonts, flattenedStyle);
    const isCustomFont = typeof fontFamily === 'string' && fontFamily.startsWith('UserCustom_');

    return (
      <NativeText
        {...props}
        ref={ref}
        style={[
          style,
          { fontFamily },
          isCustomFont && Platform.OS === 'android' ? { fontWeight: undefined } : undefined,
        ]}
      />
    );
  }
);

ThemedText.displayName = 'ThemedText';

export const ThemedTextInput = forwardRef<React.ElementRef<typeof NativeTextInput>, TextInputProps>(
  ({ style, ...props }, ref) => {
    const activeFonts = useOptionalActiveFonts();
    const flattenedStyle = (StyleSheet.flatten(style as StyleProp<TextStyle>) || {}) as TextStyle;
    const fontFamily = fontForWeight(activeFonts, flattenedStyle);
    const isCustomFont = typeof fontFamily === 'string' && fontFamily.startsWith('UserCustom_');

    return (
      <NativeTextInput
        {...props}
        ref={ref}
        style={[
          style,
          { fontFamily },
          isCustomFont && Platform.OS === 'android' ? { fontWeight: undefined } : undefined,
        ]}
      />
    );
  }
);

ThemedTextInput.displayName = 'ThemedTextInput';

export default ThemedText;
