import { router, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import React from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { useAuth } from '@/api/auth';
import { AppBar } from '@/components/shell/app-bar';
import { AppText } from '@/components/ui/app-text';
import { Ripple } from '@/components/ui/ripple';
import { setSetting, updateSettings, useSettings } from '@/store/settings';
import { useTheme } from '@/theme/theme-context';
import { ACCENTS } from '@/theme/tokens';

type Section = 'general' | 'calendar' | 'notifications' | 'friends' | 'account' | 'about';
type ToggleSetting =
  | 'hideMangaSection'
  | 'listSortAscending'
  | 'pullToRefreshEnabled'
  | 'preferEnglishTitles'
  | 'showPriorities'
  | 'cacheEnabled'
  | 'calendarIncludeWatching'
  | 'calendarIncludePlanned'
  | 'calendarMondayFirst'
  | 'calendarStartOnToday'
  | 'calendarRemoveEmptyDays';

function ToggleRow({
  title,
  description,
  value,
  onValueChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.toggleRow, { borderBottomColor: theme.brush.detailsGeneralBorder }]}>
      <View style={styles.toggleCopy}>
        <AppText size={theme.fontSize.normal} color={theme.brush.text}>{title}</AppText>
        <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle}>{description}</AppText>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? theme.accentColor : undefined}
        trackColor={{ true: theme.accentLight, false: theme.brush.detailsGeneralBorder }}
      />
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Ripple
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, { backgroundColor: selected ? theme.accentDark : theme.brush.animeItemBackground }]}>
      <AppText size={theme.fontSize.normal} color={selected ? '#fff' : theme.brush.text}>{label}</AppText>
    </Ripple>
  );
}

export function SettingsSectionScreen() {
  const theme = useTheme();
  const auth = useAuth();
  const settings = useSettings();
  const params = useLocalSearchParams<{ section?: string }>();
  const section = (typeof params.section === 'string' ? params.section.toLowerCase() : 'general') as Section;
  const title = {
    general: 'General',
    calendar: 'Calendar',
    notifications: 'Notifications',
    friends: 'Friends',
    account: 'Account',
    about: 'About',
  }[section] ?? 'General';

  const toggle = (key: ToggleSetting, value: boolean) => setSetting(key, value);

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar title={title} onMenuPress={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        {section === 'general' ? (
          <>
            <Group title="Appearance">
              <AppText size={theme.fontSize.normal} color={theme.brush.text} style={styles.groupLabel}>Theme</AppText>
              <View style={styles.choiceRow}>
                <Choice label="Light" selected={settings.themeMode === 'light'} onPress={() => updateSettings({ themeMode: 'light' })} />
                <Choice label="Dark" selected={settings.themeMode === 'dark'} onPress={() => updateSettings({ themeMode: 'dark' })} />
              </View>
              <AppText size={theme.fontSize.normal} color={theme.brush.text} style={styles.groupLabel}>Accent color</AppText>
              <View style={styles.accentRow}>
                {ACCENTS.map((accent) => (
                  <Ripple
                    key={accent.key}
                    accessibilityRole="radio"
                    accessibilityLabel={`${accent.label} accent`}
                    accessibilityState={{ selected: settings.accent === accent.key }}
                    onPress={() => updateSettings({ accent: accent.key })}
                    style={[styles.accentChoice, {
                      backgroundColor: accent.base,
                      borderColor: settings.accent === accent.key ? theme.brush.text : theme.brush.detailsGeneralBorder,
                    }]}
                  />
                ))}
              </View>
            </Group>
            <Group title="Home page">
              <View style={styles.choiceRow}>
                <Choice label="Anime list" selected={settings.defaultMenuTab === 'anime'} onPress={() => updateSettings({ defaultMenuTab: 'anime' })} />
                <Choice label="Manga list" selected={settings.defaultMenuTab === 'manga'} onPress={() => updateSettings({ defaultMenuTab: 'manga' })} />
              </View>
            </Group>
            <Group title="Lists and content">
              <ToggleRow title="Hide manga section" description="Remove manga shortcuts from the navigation drawer." value={settings.hideMangaSection} onValueChange={(v) => toggle('hideMangaSection', v)} />
              <ToggleRow title="Sort lists ascending" description="Use ascending order for the selected list sort." value={settings.listSortAscending} onValueChange={(v) => toggle('listSortAscending', v)} />
              <ToggleRow title="Pull to refresh" description="Allow pulling a list down to reload it." value={settings.pullToRefreshEnabled} onValueChange={(v) => toggle('pullToRefreshEnabled', v)} />
              <ToggleRow title="Prefer English titles" description="Use English alternative titles when available." value={settings.preferEnglishTitles} onValueChange={(v) => toggle('preferEnglishTitles', v)} />
              <ToggleRow title="Show list priorities" description="Display priority markers on list entries." value={settings.showPriorities} onValueChange={(v) => toggle('showPriorities', v)} />
              <ToggleRow title="Cache content" description="Store fetched content for faster loading and offline use." value={settings.cacheEnabled} onValueChange={(v) => toggle('cacheEnabled', v)} />
            </Group>
          </>
        ) : section === 'calendar' ? (
          <Group title="Calendar behavior">
            <ToggleRow title="Include watching anime" description="Show currently watching anime in the schedule." value={settings.calendarIncludeWatching} onValueChange={(v) => toggle('calendarIncludeWatching', v)} />
            <ToggleRow title="Include planned anime" description="Show plan-to-watch anime in the schedule." value={settings.calendarIncludePlanned} onValueChange={(v) => toggle('calendarIncludePlanned', v)} />
            <ToggleRow title="Start week on Monday" description="Order calendar days Monday through Sunday." value={settings.calendarMondayFirst} onValueChange={(v) => toggle('calendarMondayFirst', v)} />
            <ToggleRow title="Open on today's schedule" description="Select today's tab instead of the weekly summary." value={settings.calendarStartOnToday} onValueChange={(v) => toggle('calendarStartOnToday', v)} />
            <ToggleRow title="Hide empty days" description="Only show weekdays that have scheduled anime." value={settings.calendarRemoveEmptyDays} onValueChange={(v) => toggle('calendarRemoveEmptyDays', v)} />
          </Group>
        ) : section === 'account' ? (
          <Group title="MyAnimeList account">
            <AppText size={theme.fontSize.normal} color={theme.brush.text}>
              {auth.authenticated ? `Signed in as ${auth.username}` : 'Not signed in'}
            </AppText>
            <Ripple onPress={() => router.push('/login')} style={[styles.action, { backgroundColor: theme.accentDark }]}>
              <AppText color="#fff">{auth.authenticated ? 'Manage account' : 'Sign in to MAL'}</AppText>
            </Ripple>
          </Group>
        ) : section === 'about' ? (
          <Group title="MALClient">
            <AppText size={theme.fontSize.normal} color={theme.brush.text}>MyAl-Client</AppText>
            <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle}>
              Version {Constants.expoConfig?.version ?? '0.7.0-beta.1'}
            </AppText>
            <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle}>A React Native companion client for MyAnimeList.</AppText>
          </Group>
        ) : (
          <Group title={title}>
            <AppText size={theme.fontSize.normal} color={theme.brush.text}>
              {section === 'notifications'
                ? 'Notification preferences will be available here as native notification features are added.'
                : 'Friends feed preferences will be available here when the friends feed is implemented.'}
            </AppText>
          </Group>
        )}
      </ScrollView>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.group, { backgroundColor: theme.brush.hamburgerInnerBackground }]}>
      <AppText size={theme.fontSize.medium} color={theme.accentColor} style={styles.groupTitle}>{title}</AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 12, gap: 10, paddingBottom: 24 },
  group: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 4 },
  groupTitle: { marginBottom: 10 },
  groupLabel: { marginBottom: 8 },
  choiceRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  choice: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: 4 },
  accentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  accentChoice: { width: 34, height: 34, borderWidth: 3, borderRadius: 17 },
  toggleRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  toggleCopy: { flex: 1, paddingVertical: 10, paddingRight: 12, gap: 3 },
  action: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 12, borderRadius: 4 },
});
