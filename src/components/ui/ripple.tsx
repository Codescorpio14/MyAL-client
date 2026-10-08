import React from 'react';
import { Platform, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-context';

interface RippleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Defaults to `?OpaqueAccentColour` (colorControlHighlight equivalent). */
  rippleColor?: string;
  borderless?: boolean;
  pressedOpacity?: number;
}

/** `?android:selectableItemBackground` equivalent — accent-tinted ripple. */
export function Ripple({ style, rippleColor, borderless, children, pressedOpacity = 0.5, ...rest }: RippleProps) {
  const theme = useTheme();
  const color = rippleColor ?? theme.accentOpaque;

  return (
    <Pressable
      {...rest}
      android_ripple={
        Platform.OS === 'android'
          ? { color, borderless: borderless ?? false, foreground: true }
          : undefined
      }
      style={({ pressed }) => [style, pressed && Platform.OS !== 'android' ? { opacity: pressedOpacity } : null]}
    >
      {children as React.ReactNode}
    </Pressable>
  );
}

/** Pressable without a ripple — used where the original sets no background. */
export function Tap({
  style,
  children,
  pressedOpacity = 0.6,
  ...rest
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; pressedOpacity?: number }) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, pressed ? { opacity: pressedOpacity } : null]}
    >
      {children as React.ReactNode}
    </Pressable>
  );
}
