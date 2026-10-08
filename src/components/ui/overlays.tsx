import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AppIcon, IconName } from '@/components/ui/app-icons';
import { AppText } from '@/components/ui/app-text';
import { useTheme } from '@/theme/theme-context';

/** Accent-tinted indeterminate ring (`?AccentColour` ProgressBar, 50dp). */
export function ProgressRing({ size = 50, color, style }: { size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.centered, style]}>
      <ActivityIndicator size="large" color={color ?? theme.accentColor} />
    </View>
  );
}

/**
 * Full-screen translucent loading state (`?BrushLoading` overlay + ring),
 * matching the overlay used by AnimeListPage / AnimeDetailsPage.
 */
export function LoadingOverlay({ visible, label }: { visible: boolean; label?: string }) {
  const theme = useTheme();
  if (!visible) return null;
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: theme.brush.loading,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
        },
      ]}>
      <ActivityIndicator size="large" color={theme.accentColor} />
      {label ? (
        <AppText size={theme.fontSize.small} color={theme.brush.text} style={{ marginTop: 12 }}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

/** The idiosyncratic empty states ("We have come up empty…", "Search away!"). */
export function EmptyState({
  icon = 'search_away',
  title,
  message,
  style,
}: {
  icon?: IconName;
  title?: string;
  message?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.centered, { padding: 24 }, style]}>
      {icon ? <AppIcon name={icon} size={100} color={theme.brush.noSearchResults} /> : null}
      {title ? (
        <AppText size={theme.fontSize.medium} color={theme.brush.noSearchResults} style={{ marginTop: 16, textAlign: 'center' }}>
          {title}
        </AppText>
      ) : null}
      {message ? (
        <AppText size={theme.fontSize.normal} color={theme.brush.noSearchResults} style={{ marginTop: 6, textAlign: 'center' }}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center' },
});
