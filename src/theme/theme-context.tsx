import React, { createContext, useContext, useMemo } from 'react';

import { useSettings } from '@/store/settings';
import {
  ACCENT_BY_KEY,
  AccentPalette,
  Brushes,
  buildBrushes,
  DIMENS,
  FONT_SIZE,
  FONTS,
  RADII,
  SEMANTIC,
} from '@/theme/tokens';

export interface AppTheme {
  mode: 'light' | 'dark';
  accent: AccentPalette;
  /** The 34 `?Brush*` attributes resolved for the current mode + accent. */
  brush: Brushes;
  /** Convenience shorthands used all over the original layouts. */
  accentColor: string;
  accentDark: string;
  accentLight: string;
  accentOpaque: string;
  text: string;
  background: string;
  fonts: typeof FONTS;
  fontSize: typeof FONT_SIZE;
  dimens: typeof DIMENS;
  radii: typeof RADII;
  semantic: typeof SEMANTIC;
}

const ThemeContext = createContext<AppTheme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { accent: accentKey, themeMode } = useSettings();

  const value = useMemo<AppTheme>(() => {
    const accent = ACCENT_BY_KEY[accentKey];
    const brush = buildBrushes(themeMode, accent);
    return {
      mode: themeMode,
      accent,
      brush,
      accentColor: accent.base,
      accentDark: accent.dark,
      accentLight: accent.light,
      accentOpaque: accent.opaque,
      text: brush.text,
      background: brush.deepBackground,
      fonts: FONTS,
      fontSize: FONT_SIZE,
      dimens: DIMENS,
      radii: RADII,
      semantic: SEMANTIC,
    };
  }, [accentKey, themeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AppTheme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}
