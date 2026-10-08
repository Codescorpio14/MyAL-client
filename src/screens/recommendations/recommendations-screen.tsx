import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import {
  CommunityRecommendation,
  fetchCommunityRecommendations,
} from '@/api/scrape';
import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { AppText } from '@/components/ui/app-text';
import { EmptyState, LoadingOverlay } from '@/components/ui/overlays';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { TabDef, TabStrip } from '@/components/ui/tab-strip';
import { useTheme } from '@/theme/theme-context';

type Kind = 'anime' | 'manga';
interface RecommendationCardData {
  id: number;
  kind: Kind;
  title: string;
  imageUrl?: string;
  sourceTitle: string;
  description: string;
  sourceId?: number;
}

function fromCommunity(rows: CommunityRecommendation[]): RecommendationCardData[] {
  return rows.map((item) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    imageUrl: item.imageUrl,
    sourceTitle: item.sourceTitle,
    description: item.description,
    sourceId: item.sourceId,
  }));
}

export function RecommendationsScreen() {
  const theme = useTheme();
  const openDrawer = useOpenDrawer();
  const [kind, setKind] = useState<Kind>('anime');
  const [items, setItems] = useState<RecommendationCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = fromCommunity(await fetchCommunityRecommendations(kind, force));
      setItems(data);
    } catch (cause) {
      setItems([]);
      setError(cause instanceof Error ? cause.message : 'Unable to load recommendations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [kind]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = fromCommunity(await fetchCommunityRecommendations(kind));
        if (active) setItems(data);
      } catch (cause) {
        if (!active) return;
        setItems([]);
        setError(cause instanceof Error ? cause.message : 'Unable to load recommendations.');
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [kind]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
  }, [load]);

  const kindTabs: TabDef[] = [
    { key: 'anime', label: 'Anime' },
    { key: 'manga', label: 'Manga' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar title="Recommendations" onMenuPress={openDrawer} onRefresh={() => void refresh()} />
      <TabStrip tabs={kindTabs} activeKey={kind} onChange={(key) => setKind(key as Kind)} height={theme.dimens.tabStripHeight} />
      {error && !loading ? (
        <EmptyState icon="recom" title="Could not load recommendations" message={error} style={styles.flex} />
      ) : !loading && items.length === 0 ? (
        <EmptyState icon="recom" title="No recommendations found" style={styles.flex} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, index) => `${item.kind}-${item.id}-${index}`}
          contentContainerStyle={items.length ? styles.list : styles.flex}
          renderItem={({ item, index }) => (
            <Ripple
              onPress={() => router.push(`/details?kind=${item.kind}&id=${item.id}&title=${encodeURIComponent(item.title)}`)}
              style={[styles.card, { backgroundColor: index % 2 === 0 ? theme.brush.rowAlternate1 : theme.brush.rowAlternate2, borderLeftColor: theme.accentColor }]}>
              <RemoteImage uri={item.imageUrl} style={styles.poster} />
              <View style={styles.cardText}>
                <AppText size={theme.fontSize.medium} weight="medium" color={theme.brush.text} numberOfLines={2}>
                  {item.title}
                </AppText>
                <AppText size={theme.fontSize.small} color={theme.accentDark} numberOfLines={1}>
                  If you liked {item.sourceTitle}
                </AppText>
                {item.description ? (
                  <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle} numberOfLines={3}>
                    {item.description}
                  </AppText>
                ) : null}
              </View>
            </Ripple>
          )}
        />
      )}
      <LoadingOverlay visible={loading || refreshing} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flexGrow: 1 },
  list: { padding: 8, paddingBottom: 24 },
  card: { flexDirection: 'row', padding: 10, marginBottom: 8, borderLeftWidth: 3, minHeight: 128, gap: 10 },
  poster: { width: 82, height: 108, backgroundColor: 'rgba(0,0,0,0.12)' },
  cardText: { flex: 1, justifyContent: 'center', gap: 7 },
});
