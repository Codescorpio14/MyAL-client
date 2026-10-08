import React from 'react';
import { StyleProp, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';

import { AppIcon, IconName } from '@/components/ui/app-icons';
import { AppText } from '@/components/ui/app-text';
import { Ripple } from '@/components/ui/ripple';
import { useTheme } from '@/theme/theme-context';

/* ------------------------------ IconButton ------------------------------ */

interface IconButtonProps {
  icon: IconName;
  size?: number;
  /** glyph size, defaults to 24 */
  glyph?: number;
  color?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  borderless?: boolean;
  disabled?: boolean;
}

/** `ImageButton` with `selectableItemBackgroundBorderless`. */
export function IconButton({
  icon,
  size = 40,
  glyph = 24,
  color,
  onPress,
  style,
  borderless = true,
  disabled,
}: IconButtonProps) {
  const theme = useTheme();
  return (
    <Ripple
      onPress={onPress}
      disabled={disabled || !onPress}
      borderless={borderless}
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 },
        style,
      ]}>
      <AppIcon name={icon} size={glyph} color={color ?? theme.brush.text} />
    </Ripple>
  );
}

/* ----------------------------- AccentButton ----------------------------- */

/** `AccentButtonStyle` — flat accent rectangle, white text, min 30×30. */
export function AccentButton({
  label,
  onPress,
  style,
  disabled,
  textColor = '#fff',
}: {
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle & TextStyle>;
  disabled?: boolean;
  textColor?: string;
}) {
  const theme = useTheme();
  return (
    <Ripple
      onPress={onPress}
      disabled={disabled || !onPress}
      style={[
        styles.accentFlat,
        {
          backgroundColor: disabled ? theme.brush.animeItemBackground : theme.accentColor,
          minWidth: 30,
          minHeight: 30,
        },
        style,
      ]}>
      <AppText color={textColor} size={theme.fontSize.normal}>
        {label}
      </AppText>
    </Ripple>
  );
}

/** `AccentColourButtonStyle` — `AccentColourDark` background, 13sp light text. */
export function AccentPillButton({
  label,
  onPress,
  onLongPress,
  style,
  fontSize,
}: {
  label: string;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  fontSize?: number;
}) {
  const theme = useTheme();
  return (
    <Ripple
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.accentPill, { backgroundColor: theme.accentDark }, style]}>
      <AppText color="#fff" size={fontSize ?? theme.fontSize.small}>
        {label}
      </AppText>
    </Ripple>
  );
}

/* ---------------------------- UnderlineButton --------------------------- */

/** `button_underline_background_style` — text button with a 1dp accent underline. */
export function UnderlineButton({
  label,
  onPress,
  style,
  color,
  height = 25,
  minWidth = 40,
}: {
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  color?: string;
  height?: number;
  minWidth?: number;
}) {
  const theme = useTheme();
  return (
    <Ripple
      onPress={onPress}
      style={[
        {
          height,
          minWidth,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 3,
          borderBottomWidth: 1,
          borderBottomColor: theme.accentColor,
        },
        style,
      ]}>
      <AppText size={theme.fontSize.semiNormal} color={color ?? theme.brush.text}>
        {label}
      </AppText>
    </Ripple>
  );
}

/* ------------------------------- Inc / Dec ------------------------------ */

/** The 32dp +/- pair from `AnimeListItem` (accent-dark squares). */
export function IncDecButtons({
  onIncrement,
  onDecrement,
  disabled,
  style,
}: {
  onIncrement?: () => void;
  onDecrement?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const box: StyleProp<ViewStyle> = [
    styles.incDec,
    { backgroundColor: disabled ? theme.brush.animeItemBackground : theme.accentDark },
    style,
  ];
  return (
    <View>
      <Ripple onPress={onIncrement} disabled={disabled} style={box}>
        <AppIcon name="add" size={20} color="#fff" />
      </Ripple>
      <Ripple onPress={onDecrement} disabled={disabled} style={[box, { marginTop: 10 }]}>
        <AppIcon name="minus" size={20} color="#fff" />
      </Ripple>
    </View>
  );
}

/* --------------------------------- FAB ---------------------------------- */

/** `FloatingActionButton` — 56dp accent circle (bottom-end by default). */
export function Fab({
  icon = 'more',
  onPress,
  color,
  style,
  size = 56,
  glyph = 24,
}: {
  icon?: IconName;
  onPress?: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
  size?: number;
  glyph?: number;
}) {
  const theme = useTheme();
  return (
    <Ripple
      onPress={onPress}
      borderless
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color ?? theme.accentColor,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 6,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        },
        style,
      ]}>
      <AppIcon name={icon} size={glyph} color="#fff" />
    </Ripple>
  );
}

const styles = StyleSheet.create({
  accentFlat: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 7 },
  accentPill: { alignItems: 'center', justifyContent: 'center', padding: 5, minHeight: 20, minWidth: 20 },
  incDec: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
