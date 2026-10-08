import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { statusToInt, statusToShortString } from '@/api/status';
import { searchAnime, searchManga } from '@/api/tenrai';
import { LibraryItem, ListKind } from '@/api/types';
import { AppIcon } from '@/components/ui/app-icons';
import { AppText } from '@/components/ui/app-text';
import { AccentButton } from '@/components/ui/buttons';
import { ProgressRing } from '@/components/ui/overlays';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { card, underline } from '@/components/ui/shapes';
import { useTheme } from '@/theme/theme-context';

import { JikanSearchItem } from '../search-api';
import { FirstSearchState, NoResultsState } from '../states';
import { useLibraryEntries } from '../use-library-entries';

/**
 * The Anime/Manga pivots — the original serves both from the single
 * `AnimeSearchPageFragment` + `AnimeSearchItem.xml` row layout:
 *
 *   130dp poster (top-left "W 8/12" badge when the hit is in the user's list),
 *   16sp title, 14sp light synopsis (4 lines), bottom section with the accent
 *   underlined type/episodes chips and the score over a faded star.
 *
 * Data: `AnimeSearchQuery` / `MangaSearchQuery` → Tenrai `/anime` & `/manga`
 * with `q` + `sfw`; "Load more" pages via `pagination.has_next_page`.
 */

const MIN_QUERY_LENGTH = 2;

type SearchStatus = 'idle' | 'loading' | 'done';

interface MediaTabProps {
  kind: ListKind;
  /** Trimmed query from the screen's SearchView. */
  query: string;
}

export function MediaTab({ kind, query }: MediaTabProps) {
  const [items, setItems] = useState<JikanSearchItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [loadingMore, setLoadingMore] = useState(false);
  const requestRef = useRef(0);
  const library = useLibraryEntries(kind);

  // Clear the list the moment a new query is submitted (adjust during render).
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setItems([]);
    setPage(1);
    setHasNext(false);
    setStatus('idle');
  }

  useEffect(() => {
    const request = ++requestRef.current;
    if (query.length < MIN_QUERY_LENGTH) return;
    let cancelled = false;
    (async () => {
      setItems([]);
      setPage(1);
      setHasNext(false);
      setStatus('loading');
      try {
        const res = await (kind === 'anime' ? searchAnime : searchManga)(query, 1);
        if (cancelled || request !== requestRef.current) return;
        setItems((res.data ?? []) as JikanSearchItem[]);
        setPage(res.pagination?.current_page ?? 1);
        setHasNext(Boolean(res.pagination?.has_next_page));
        setStatus('done');
      } catch {
        if (cancelled || request !== requestRef.current) return;
        setItems([]);
        setHasNext(false);
        setStatus('done');
      }
    })();
    return () => {
      cancelled = true;
      const latest = requestRef.current;
      if (latest === request) requestRef.current = request + 1;
    };
  }, [query, kind]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasNext || status !== 'done') return;
    const request = ++requestRef.current;
    const nextPage = page + 1;
    setLoadingMore(true);
    (kind === 'anime' ? searchAnime : searchManga)(query, nextPage)
      .then((res) => {
        if (request !== requestRef.current) return;
        setItems((prev) => [...prev, ...((res.data ?? []) as JikanSearchItem[])]);
        setPage(res.pagination?.current_page ?? nextPage);
        setHasNext(Boolean(res.pagination?.has_next_page));
      })
      .catch(() => {
        // Keep what we already have; the button stays for a retry.
      })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasNext, status, page, kind, query]);

  if (status === 'idle') return <FirstSearchState />;
  if (status === 'loading') return <ProgressRing style={StyleSheet.absoluteFill} />;
  if (items.length === 0) return <NoResultsState />;

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.mal_id)}
      renderItem={({ item }) => (
        <MediaSearchRow item={item} kind={kind} entry={library?.get(item.mal_id)} />
      )}
      contentContainerStyle={styles.list}
      windowSize={7}
      initialNumToRender={6}
      ListFooterComponent={
        hasNext || loadingMore ? (
          <View style={styles.footer}>
            {loadingMore ? (
              <ProgressRing size={30} />
            ) : (
              <AccentButton label="Load more" onPress={loadMore} />
            )}
          </View>
        ) : null
      }
    />
  );
}

/* --------------------------------- row --------------------------------- */

function MediaSearchRow({
  item,
  kind,
  entry,
}: {
  item: JikanSearchItem;
  kind: ListKind;
  entry?: LibraryItem;
}) {
  const theme = useTheme();
  const title = item.title ?? '';
  const total = (kind === 'anime' ? item.episodes : item.chapters) ?? undefined;
  const totalLabel = total ? String(total) : '?';
  const score = item.score ? item.score.toFixed(2) : 'N/A';
  const image = item.images?.jpg?.large_image_url ?? item.images?.jpg?.image_url;

  const openDetails = () =>
    router.push(`/details?kind=${kind}&id=${item.mal_id}&title=${encodeURIComponent(title)}`);

  return (
    <Ripple onPress={openDetails} style={styles.row}>
      <View style={[card(theme.brush.animeItemBackground), styles.card]}>
        <View style={styles.imageBox}>
          <RemoteImage uri={image} style={styles.image} />
          {entry ? (
            <View style={[styles.badge, { backgroundColor: '#00000080' }]}>
              <AppText size={theme.fontSize.medium} weight="medium" color={theme.semantic.white}>
                {statusToShortString(
                  statusToInt(entry.myStatus),
                  kind,
                  entry.isRewatching ?? false
                )}
              </AppText>
              <AppText
                size={theme.fontSize.medium}
                color={theme.semantic.white}
                style={underline(theme.accentColor)}>
                {`${entry.myProgress ?? 0}/${entry.episodes ?? entry.chapters ?? total ?? '?'}`}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.info}>
          <View style={styles.infoTop}>
            <AppText size={theme.fontSize.medium} numberOfLines={2} style={styles.title}>
              {title}
            </AppText>
            {item.synopsis ? (
              <AppText size={theme.fontSize.normal} numberOfLines={4} style={styles.synopsis}>
                {item.synopsis}
              </AppText>
            ) : null}
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.chips}>
              <AppText size={theme.fontSize.normal} style={underline(theme.accentColor)}>
                {item.type ?? ''}
              </AppText>
              <AppText
                size={theme.fontSize.normal}
                style={[underline(theme.accentColor), styles.chipSpacing]}>
                {kind === 'anime' ? `Episodes: ${totalLabel}` : `Chapters: ${totalLabel}`}
              </AppText>
            </View>
            <View style={styles.scoreBox}>
              <AppIcon name="favourite" size={30} color={theme.brush.text} style={styles.scoreStar} />
              <AppText size={theme.fontSize.normal} weight="medium">
                {score}
              </AppText>
            </View>
          </View>
        </View>
      </View>
    </Ripple>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 5, paddingBottom: 16 },
  row: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 3 },
  card: { minHeight: 120, flexDirection: 'row', marginBottom: 5 },
  imageBox: { width: 130, minHeight: 150 },
  image: { width: 130, aspectRatio: 225 / 350 },
  badge: {
    position: 'absolute',
    left: 0,
    top: 0,
    paddingHorizontal: 5,
    paddingVertical: 5,
    alignItems: 'center',
  },
  info: { flex: 1, padding: 4 },
  infoTop: { flex: 1 },
  title: { marginLeft: 5, marginTop: 3 },
  synopsis: { marginLeft: 5, marginTop: 5 },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  chips: { flexDirection: 'row', alignItems: 'center' },
  chipSpacing: { marginLeft: 10 },
  scoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 30,
    minHeight: 30,
  },
  scoreStar: { position: 'absolute' },
  footer: { alignItems: 'center', padding: 12 },
});
