import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { useAuth } from '@/api/auth';
import { fetchProfileHistory, ProfileHistoryGroup } from '@/api/scrape';
import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { AccentButton } from '@/components/ui/buttons';
import { AppText } from '@/components/ui/app-text';
import { EmptyState, LoadingOverlay } from '@/components/ui/overlays';
import { Ripple } from '@/components/ui/ripple';
import { useTheme } from '@/theme/theme-context';

type HistoryPeriod = 'Today' | 'This week' | 'Last week' | 'Earlier';

function historyPeriod(value: string): HistoryPeriod {
  const text = value.trim().toLowerCase();
  if (/\btoday\b/.test(text)) return 'Today';
  if (/\b(?:8|9|10|11|12|13|14) days? ago\b/.test(text) || /\b(?:1|one) weeks? ago\b/.test(text)) {
    return 'Last week';
  }
  if (/\b(?:2|3|4|5|6|7|two|three|four|five|six|seven) weeks? ago\b/.test(text)) return 'Earlier';
  if (/\byesterday\b|\bthis week\b/.test(text)) return 'This week';
  if (/\blast week\b/.test(text)) return 'Last week';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(value)
      ? 'This week'
      : 'Earlier';
  }
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const lastWeekStart = new Date(startOfWeek);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  if (date >= startOfWeek) return date.toDateString() === now.toDateString() ? 'Today' : 'This week';
  if (date >= lastWeekStart) return 'Last week';
  return 'Earlier';
}

export function HistoryScreen() {
  const theme = useTheme();
  const auth = useAuth();
  const openDrawer = useOpenDrawer();
  const [username, setUsername] = useState(auth.username);
  const [activeUsername, setActiveUsername] = useState(auth.username);
  const [groups, setGroups] = useState<ProfileHistoryGroup[]>([]);
  const [loading, setLoading] = useState(Boolean(auth.username));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (user: string, force = false) => {
    if (!user.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setGroups(await fetchProfileHistory(user, force));
      setActiveUsername(user);
    } catch (cause) {
      setGroups([]);
      setError(cause instanceof Error ? cause.message : 'Unable to load MAL history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (auth.username) {
      void (async () => {
        setUsername(auth.username);
        await load(auth.username);
      })();
    }
  }, [auth.username, load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load(activeUsername, true);
  }, [activeUsername, load]);

  const sections = useMemo(() => {
    const order: HistoryPeriod[] = ['Today', 'This week', 'Last week', 'Earlier'];
    const entries = new Map<HistoryPeriod, ProfileHistoryGroup['entries']>();
    for (const group of groups) {
      const label = historyPeriod(group.date);
      entries.set(label, [...(entries.get(label) ?? []), ...group.entries]);
    }
    return order.flatMap((date) => {
      const rows = entries.get(date);
      return rows?.length ? [{ date, entries: rows }] : [];
    });
  }, [groups]);

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar title={activeUsername ? `${activeUsername}'s History` : 'History'} onMenuPress={openDrawer} onRefresh={activeUsername ? refresh : undefined} />
      <View style={[styles.searchRow, { backgroundColor: theme.brush.animeItemBackground }]}>
        <TextInput
          value={username}
          onChangeText={setUsername}
          onSubmitEditing={() => void load(username)}
          placeholder="MAL username"
          placeholderTextColor={theme.brush.settingsSubtitle}
          autoCapitalize="none"
          returnKeyType="go"
          style={[styles.input, { color: theme.brush.text }]}
        />
        <AccentButton label="Load" disabled={!username.trim()} onPress={() => void load(username)} style={styles.loadButton} />
      </View>
      {error && !loading ? <EmptyState icon="clock" title="Could not load history" message={error} style={styles.flex} /> : null}
      {!error && !loading && groups.length === 0 && activeUsername ? (
        <EmptyState icon="clock" title="No history found" message="This MAL profile has no visible anime or manga history." style={styles.flex} />
      ) : null}
      {!activeUsername && !loading ? (
        <EmptyState icon="clock" title="View MAL history" message="Enter a MAL username above to view its public history." style={styles.flex} />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(group) => group.date}
          contentContainerStyle={sections.length ? styles.list : styles.flex}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.accentColor]} tintColor={theme.accentColor} />
          }
          renderItem={({ item }) => (
            <View>
              <AppText size={theme.fontSize.medium} weight="medium" style={[styles.date, { backgroundColor: theme.brush.animeItemBackground, color: theme.accentColor }]}>
                {item.date}
              </AppText>
              {item.entries.map((entry, index) => (
                <Ripple
                  key={`${entry.kind}-${entry.id}-${index}`}
                  onPress={() => router.push({
                    pathname: '/details',
                    params: { id: String(entry.id), kind: entry.kind },
                  })}
                  style={[styles.entry, { backgroundColor: theme.brush.rowAlternate1, borderLeftColor: theme.accentColor }]}>
                  <View style={styles.entryText}>
                    <AppText size={theme.fontSize.medium} numberOfLines={2}>{entry.title}</AppText>
                    <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle} numberOfLines={1}>
                      {entry.date} · {entry.kind === 'anime' ? 'Anime' : 'Manga'}
                    </AppText>
                  </View>
                  <View style={[styles.progressBox, { borderColor: theme.accentColor }]}>
                    <AppText size={theme.fontSize.small} weight="medium" color={theme.brush.text}>
                      {entry.kind === 'anime' ? `EP ${entry.progress}` : `CH ${entry.progress}`}
                    </AppText>
                  </View>
                </Ripple>
              ))}
            </View>
          )}
        />
      )}
      <LoadingOverlay visible={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flexGrow: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 48 },
  input: { flex: 1, paddingVertical: 8, fontSize: 15 },
  loadButton: { paddingHorizontal: 12 },
  list: { paddingBottom: 24 },
  date: { paddingHorizontal: 14, paddingVertical: 9, marginTop: 8, marginBottom: 5 },
  entry: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 8, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 3, borderRadius: 4, gap: 12 },
  entryText: { flex: 1, gap: 4 },
  progressBox: { minWidth: 54, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderRadius: 3 },
});
