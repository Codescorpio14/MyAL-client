import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { AppText } from '@/components/ui/app-text';
import { Ripple } from '@/components/ui/ripple';
import { useTheme } from '@/theme/theme-context';

const SECTIONS = [
  { key: 'general', title: 'General', subtitle: 'Appearance, home page, list behavior, and caching' },
  { key: 'calendar', title: 'Calendar', subtitle: 'Schedule filters and calendar behavior' },
  { key: 'notifications', title: 'Notifications', subtitle: 'Notification settings and preferences' },
  { key: 'friends', title: 'Friends', subtitle: 'Friends and feed preferences' },
  { key: 'account', title: 'Account', subtitle: 'MyAnimeList account and sign-in' },
  { key: 'about', title: 'About', subtitle: 'App information and version' },
] as const;

export function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const openDrawer = useOpenDrawer();

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar title="Settings & more" onMenuPress={openDrawer} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 20 + insets.bottom }]}>
        {SECTIONS.map((section) => (
          <Ripple
            key={section.key}
            accessibilityRole="button"
            onPress={() => router.push(`/settings-section?section=${section.key}`)}
            style={[styles.folder, { backgroundColor: theme.brush.hamburgerInnerBackground }]}>
            <View style={styles.folderCopy}>
              <AppText size={theme.fontSize.medium} weight="medium" color={theme.brush.text}>{section.title}</AppText>
              <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle}>{section.subtitle}</AppText>
            </View>
            <AppText size={theme.fontSize.big} color={theme.accentColor}>›</AppText>
          </Ripple>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  folder: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 4 },
  folderCopy: { flex: 1, gap: 4 },
});
