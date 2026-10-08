import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { useAuth } from '@/api/auth';
import { ClubCategory, fetchClubs, MalClub } from '@/api/scrape';
import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { AppText } from '@/components/ui/app-text';
import { EmptyState, LoadingOverlay } from '@/components/ui/overlays';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { TabDef, TabStrip } from '@/components/ui/tab-strip';
import { useTheme } from '@/theme/theme-context';

type ClubMode = 'all' | 'mine';
const CATEGORIES: { key: ClubCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'anime', label: 'Anime' },
  { key: 'manga', label: 'Manga' },
  { key: 'characters', label: 'Characters' },
  { key: 'artists', label: 'Artists' },
  { key: 'games', label: 'Games' },
  { key: 'music', label: 'Music' },
  { key: 'other', label: 'Other' },
];

export function ClubsScreen() {
  const theme = useTheme();
  const auth = useAuth();
  const openDrawer = useOpenDrawer();
  const [mode, setMode] = useState<ClubMode>('all');
  const [category, setCategory] = useState<ClubCategory>('all');
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [clubs, setClubs] = useState<MalClub[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchClubs({
        own: mode === 'mine',
        category,
        query: submittedQuery,
        page: 0,
        force,
      });
      setClubs(rows);
      setPage(0);
      setHasMore(rows.length >= 20 && mode === 'all');
    } catch (cause) {
      setClubs([]);
      setError(cause instanceof Error ? cause.message : 'Unable to load clubs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, mode, submittedQuery]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load(true);
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const rows = await fetchClubs({ category, query: submittedQuery, page: nextPage, force: true });
      setClubs((previous) => {
        const known = new Set(previous.map((club) => club.id));
        return [...previous, ...rows.filter((club) => !known.has(club.id))];
      });
      setPage(nextPage);
      setHasMore(rows.length >= 20);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load more clubs.');
    } finally {
      setLoadingMore(false);
    }
  }, [category, hasMore, loading, loadingMore, page, submittedQuery]);

  const tabs: TabDef[] = [
    { key: 'all', label: 'All clubs' },
    { key: 'mine', label: 'My clubs' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar title="Clubs" onMenuPress={openDrawer} onRefresh={refresh} />
      <TabStrip
        tabs={tabs}
        activeKey={mode}
        onChange={(key) => setMode(key as ClubMode)}
        height={theme.dimens.tabStripHeight}
      />
      <View style={[styles.searchRow, { backgroundColor: theme.brush.animeItemBackground }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => setSubmittedQuery(query.trim())}
          placeholder="Search clubs (2+ characters)"
          placeholderTextColor={theme.brush.settingsSubtitle}
          returnKeyType="search"
          style={[
            styles.input,
            {
              color: theme.brush.text,
              backgroundColor: theme.brush.deepBackground,
              borderColor: theme.brush.settingsSubtitle,
            },
          ]}
        />
        <Ripple onPress={() => setSubmittedQuery(query.trim())} style={styles.searchAction}>
          <AppText color={theme.accentColor}>Search</AppText>
        </Ripple>
      </View>
      {mode === 'all' ? (
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
          renderItem={({ item }) => (
            <Ripple
              onPress={() => setCategory(item.key)}
              style={[
                styles.category,
                {
                  backgroundColor: category === item.key ? theme.accentDark : theme.brush.animeItemBackground,
                  borderColor: category === item.key ? theme.accentColor : theme.brush.settingsSubtitle,
                },
              ]}>
              <AppText color={category === item.key ? '#fff' : theme.brush.text} size={theme.fontSize.small}>
                {item.label}
              </AppText>
            </Ripple>
          )}
        />
      ) : null}
      {error && !loading ? <EmptyState icon="club" title="Could not load clubs" message={error} style={styles.flex} /> : null}
      {!error && !loading && clubs.length === 0 ? (
        <EmptyState
          icon="club"
          title={mode === 'mine' ? 'No clubs found' : 'No matching clubs'}
          message={mode === 'mine' && !auth.authenticated ? 'Sign in to view your clubs.' : undefined}
          style={styles.flex}
        />
      ) : null}
      <FlatList
        data={clubs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={clubs.length ? styles.list : styles.flex}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.accentColor]} tintColor={theme.accentColor} />
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => <ClubCard club={item} />}
        ListFooterComponent={loadingMore ? <AppText style={styles.footer}>Loading more clubs…</AppText> : null}
      />
      <LoadingOverlay visible={loading} />
    </View>
  );
}

function ClubCard({ club }: { club: MalClub }) {
  const theme = useTheme();
  return (
    <Ripple
      onPress={() => router.push({ pathname: '/club-details', params: { id: club.id, name: club.name } })}
      style={[styles.card, { backgroundColor: theme.brush.animeItemBackground }]}>
      <RemoteImage uri={club.imageUrl} style={styles.image} />
      <View style={styles.body}>
        <AppText size={theme.fontSize.medium} weight="medium" numberOfLines={1}>{club.name}</AppText>
        <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle} numberOfLines={3}>
          {club.description}
        </AppText>
        <AppText size={theme.fontSize.small} color={theme.accentDark} numberOfLines={1}>
          {[club.members, club.lastComment, club.joinAction !== 'none' ? ` · ${club.joinAction}` : ''].filter(Boolean).join(' · ')}
        </AppText>
      </View>
    </Ripple>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flexGrow: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, minHeight: 54, gap: 8 },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 5 },
  searchAction: { paddingHorizontal: 10, paddingVertical: 9 },
  categories: { paddingHorizontal: 8, paddingVertical: 7, gap: 7 },
  category: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  list: { padding: 8, paddingBottom: 24 },
  card: { flexDirection: 'row', padding: 10, marginBottom: 8, minHeight: 112 },
  image: { width: 76, height: 76 },
  body: { flex: 1, paddingLeft: 10, justifyContent: 'space-around', gap: 5 },
  footer: { textAlign: 'center', padding: 16 },
});
