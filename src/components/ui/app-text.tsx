import React from 'react';
import { StyleProp, Text as RNText, TextProps, TextStyle } from 'react-native';

import { useTheme } from '@/theme/theme-context';

type Weight = 'light' | 'regular' | 'medium' | 'condensed' | 'thin' | 'black';

interface AppTextProps extends TextProps {
  size?: number;
  color?: string;
  weight?: Weight;
  italic?: boolean;
  style?: StyleProp<TextStyle>;
}

/**
 * Text with the original app's typography: Roboto **Light** is the default
 * family everywhere (`font_family_light`), sizes come from the sp scale.
 */
export function AppText({ size, color, weight = 'light', italic, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const textStyle: TextStyle = {
    fontFamily: theme.fonts[weight],
    fontSize: size ?? theme.fontSize.normal,
    color: color ?? theme.brush.text,
    fontStyle: italic ? 'italic' : undefined,
  };
  return <RNText {...rest} style={[textStyle, style]} />;
}
