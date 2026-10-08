import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ArticleMode, fetchArticles, MalArticle } from '@/api/scrape';
import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { AppText } from '@/components/ui/app-text';
import { EmptyState, LoadingOverlay } from '@/components/ui/overlays';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { TabDef, TabStrip } from '@/components/ui/tab-strip';
import { useTheme } from '@/theme/theme-context';

export function ArticlesScreen() {
  const theme = useTheme();
  const openDrawer = useOpenDrawer();
  const [mode, setMode] = useState<ArticleMode>('articles');
  const [items, setItems] = useState<MalArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchArticles(mode);
        if (active) setItems(rows);
      } catch (cause) {
        if (!active) return;
        setItems([]);
        setError(cause instanceof Error ? cause.message : 'Unable to load MAL articles.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [mode]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await fetchArticles(mode, true);
      setItems(rows);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to refresh MAL articles.');
    } finally {
      setRefreshing(false);
    }
  }, [mode]);

  const tabs: TabDef[] = [
    { key: 'articles', label: 'Articles' },
    { key: 'news', label: 'News' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar title={mode === 'articles' ? 'Articles' : 'News'} onMenuPress={openDrawer}       onRefresh={() => void refresh()} />
      <TabStrip tabs={tabs} activeKey={mode} onChange={(key) => setMode(key as ArticleMode)} height={theme.dimens.tabStripHeight} />
      {error && !loading ? <EmptyState icon="newspaper" title="Could not load content" message={error} style={styles.flex} /> : null}
      {!error && !loading && items.length === 0 ? <EmptyState icon="newspaper" title={`No ${mode} found`} style={styles.flex} /> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.url}
        contentContainerStyle={items.length ? styles.list : styles.flex}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[theme.accentColor]} tintColor={theme.accentColor} />}
        renderItem={({ item }) => <ArticleCard article={item} />}
      />
      <LoadingOverlay visible={loading} />
    </View>
  );
}

function ArticleCard({ article }: { article: MalArticle }) {
  const theme = useTheme();
  return (
    <Ripple
      onPress={() => router.push({
        pathname: '/article',
        params: { url: article.url, title: article.title },
      })}
      style={[styles.card, { backgroundColor: theme.brush.animeItemBackground }]}>
      <RemoteImage uri={article.imageUrl} style={styles.image} />
      <View style={styles.cardBody}>
        <AppText size={theme.fontSize.medium} weight="medium" color={theme.brush.text} numberOfLines={2}>
          {article.title}
        </AppText>
        {article.highlight ? (
          <AppText size={theme.fontSize.small} color={theme.brush.settingsSubtitle} numberOfLines={3}>
            {article.highlight}
          </AppText>
        ) : null}
        <AppText size={theme.fontSize.small} color={theme.accentDark} numberOfLines={1}>
          {[article.author, article.views, article.tags.join(' · ')].filter(Boolean).join(' · ')}
        </AppText>
      </View>
    </Ripple>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flexGrow: 1 },
  list: { padding: 8, paddingBottom: 24 },
  card: { flexDirection: 'row', padding: 8, marginBottom: 8, minHeight: 132 },
  image: { width: 104, height: 116 },
  cardBody: { flex: 1, paddingLeft: 10, justifyContent: 'space-around', gap: 6 },
});
