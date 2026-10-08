import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native';

import { fetchPromotionalVideos, PromotionalVideo } from '@/api/scrape';
import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { AppText } from '@/components/ui/app-text';
import { EmptyState, LoadingOverlay } from '@/components/ui/overlays';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { useTheme } from '@/theme/theme-context';

export function PromotionalVideosScreen() {
  const theme = useTheme();
  const openDrawer = useOpenDrawer();
  const [videos, setVideos] = useState<PromotionalVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    try {
      const rows = await fetchPromotionalVideos(force);
      setVideos(rows);
      setError(null);
    } catch (cause) {
      setVideos([]);
      setError(cause instanceof Error ? cause.message : 'Unable to load promotional videos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const rows = await fetchPromotionalVideos();
      if (!active) return;
      setVideos(rows);
      setError(null);
      setLoading(false);
    })().catch((cause) => {
      if (!active) return;
      setVideos([]);
      setError(cause instanceof Error ? cause.message : 'Unable to load promotional videos.');
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    void load(true);
  }, [load]);

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar title="Promotional Videos" onMenuPress={openDrawer} onRefresh={refresh} />
      {error && !loading && videos.length === 0 ? (
        <EmptyState icon="video" title="Could not load videos" message={error} style={styles.flex} />
      ) : null}
      {!error && !loading && videos.length === 0 ? (
        <EmptyState icon="video" title="No promotional videos found" style={styles.flex} />
      ) : null}
      <FlatList
        data={videos}
        numColumns={2}
        keyExtractor={(video) => `${video.animeId}-${video.videoUrl}`}
        contentContainerStyle={videos.length ? styles.grid : styles.flex}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.accentColor]} tintColor={theme.accentColor} />
        }
        renderItem={({ item }) => (
          <VideoCard
            video={item}
            onOpenVideo={() => void Linking.openURL(item.videoUrl)}
            onOpenAnime={() =>
              router.push(
                `/details?kind=anime&id=${item.animeId}&title=${encodeURIComponent(item.animeTitle)}`
              )
            }
          />
        )}
      />
      <LoadingOverlay visible={loading} />
    </View>
  );
}

function VideoCard({
  video,
  onOpenVideo,
  onOpenAnime,
}: {
  video: PromotionalVideo;
  onOpenVideo: () => void;
  onOpenAnime: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.brush.animeItemBackground }]}>
      <Ripple onPress={onOpenVideo}>
        <RemoteImage uri={video.thumbnailUrl} style={styles.thumbnail} />
      </Ripple>
      <Ripple onPress={onOpenAnime} style={styles.caption}>
        <AppText size={theme.fontSize.medium} weight="medium" numberOfLines={2}>
          {video.name}
        </AppText>
        <AppText size={theme.fontSize.small} color={theme.accentColor} numberOfLines={2}>
          {video.animeTitle}
        </AppText>
      </Ripple>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flexGrow: 1 },
  grid: { padding: 6, paddingBottom: 20 },
  row: { gap: 8 },
  card: { flex: 1, margin: 4, overflow: 'hidden' },
  thumbnail: { width: '100%', aspectRatio: 0.72 },
  caption: { minHeight: 72, padding: 8, justifyContent: 'center', gap: 4 },
});
