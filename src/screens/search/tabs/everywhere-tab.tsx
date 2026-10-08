import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { ProgressRing } from '@/components/ui/overlays';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { useTheme } from '@/theme/theme-context';

import {
  capitalizeCategory,
  EverywhereGroup,
  EverywhereItem,
  sanitizeDate,
  searchEverywhere,
} from '../search-api';
import { FirstSearchState, NoResultsState } from '../states';

/**
 * The "Everywhere" pivot — `SearchEverywherePageFragment` +
 * `SearchEverywhereItem.xml`: one card per MAL category, each headed by a
 * centred underlined category label, rows of 75dp art + title + a light
 * subtitle line, with the `payload.media_type` underlined at the right edge.
 *
 * Data: `EverywhereSearchQuery` → `search/prefix.json?type=all` plus the top 5
 * `type=user` hits (see `searchEverywhere`).
 *
 * The screen owns the 400ms debounce; the original requires 3+ characters
 * here (`> 2`), below which the list is cleared back to "Search away!".
 */

const MIN_QUERY_LENGTH = 3;

/** anime → manga → character → person → user, as bound by the original pager. */
function categoryWeight(type: string): number {
  switch (type) {
    case 'anime':
      return 0;
    case 'manga':
      return 1;
    case 'character':
      return 2;
    case 'person':
      return 3;
    case 'user':
      return 4;
    default:
      return 5;
  }
}

export function EverywhereTab({ query }: { query: string }) {
  const [groups, setGroups] = useState<EverywhereGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const trimmed = query.trim();
  const ready = trimmed.length >= MIN_QUERY_LENGTH;

  // Reset search state when the query changes (adjust state during render).
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setGroups([]);
    setSearched(false);
    setLoading(false);
  }

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await searchEverywhere(trimmed);
        if (cancelled) return;
        setGroups(result);
        setSearched(true);
      } catch {
        if (cancelled) return;
        setGroups([]);
        setSearched(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trimmed, ready]);

  const ordered = useMemo(
    () =>
      [...groups].sort(
        (a, b) => categoryWeight(a.type) - categoryWeight(b.type)
      ),
    [groups]
  );

  if (!ready) return <FirstSearchState />;
  if (loading || !searched) {
    return <ProgressRing style={styles.loading} />;
  }
  if (ordered.length === 0) return <NoResultsState />;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      {ordered.map((group) => (
        <View key={group.type}>
          <CategoryHeader label={capitalizeCategory(group.type)} />
          {group.items.map((item) => (
            <EverywhereRow key={`${group.type}-${item.id}`} item={item} category={group.type} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

/* ------------------------- category header card ------------------------- */

/** Centred, underlined label on `?BrushAnimeItemBackground` (8dp padding). */
function CategoryHeader({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.categoryCard, { backgroundColor: theme.brush.animeItemBackground }]}>
      <AppText size={theme.fontSize.small} style={styles.categoryLabel}>
        {label}
      </AppText>
    </View>
  );
}

/* -------------------------------- row ---------------------------------- */

function EverywhereRow({ item, category }: { item: EverywhereItem; category: string }) {
  const theme = useTheme();
  const payload = item.payload;
  const subtitle = buildSubtitle(category, item);
  const marker = payload?.media_type;

  const open = () => {
    const title = item.name ?? '';
    if (category === 'anime' || category === 'manga') {
      router.push(
        `/details?kind=${category}&id=${item.id}&title=${encodeURIComponent(title)}`
      );
      return;
    }
    if (category === 'character') {
      router.push(`/character-details?id=${item.id}&title=${encodeURIComponent(title)}`);
    } else if (category === 'person') {
      router.push(`/person-details?id=${item.id}&title=${encodeURIComponent(title)}`);
    } else if (category === 'user') {
      router.push(`/profile?username=${encodeURIComponent(title)}`);
    } else {
      router.push(`/profile?username=${encodeURIComponent(title)}`);
    }
  };

  return (
    <Ripple onPress={open} style={styles.row}>
      <RemoteImage
        uri={item.thumbnail_url ?? item.image_url}
        style={[styles.image, { backgroundColor: theme.brush.animeItemInnerBackground }]}
      />
      <View style={styles.rowText}>
        <AppText size={15} numberOfLines={2}>
          {item.name}
        </AppText>
        {subtitle ? (
          <AppText size={theme.fontSize.small} style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {marker ? (
        <View
          style={[
            styles.markerBox,
            { backgroundColor: theme.brush.animeItemInnerBackground },
          ]}>
          <AppText size={theme.fontSize.small} style={styles.marker}>
            {marker}
          </AppText>
        </View>
      ) : null}
    </Ripple>
  );
}

/** Per-category second line, matching `SearchEverywhereViewModel` bindings. */
function buildSubtitle(category: string, item: EverywhereItem): string {
  const payload = item.payload;
  if (!payload) return '';
  const lines: string[] = [];
  switch (category) {
    case 'anime': {
      const aired = sanitizeDate(payload.aired);
      if (aired) lines.push(aired);
      if (payload.score) lines.push(`Score: ${payload.score}`);
      if (payload.status) lines.push(payload.status);
      break;
    }
    case 'manga': {
      const published = sanitizeDate(payload.published);
      if (published) lines.push(published);
      if (payload.score) lines.push(`Score: ${payload.score}`);
      if (payload.status) lines.push(payload.status);
      break;
    }
    case 'character': {
      const works = (payload.related_works ?? []).slice(0, 2).join(', ');
      if (works) lines.push(works);
      if (typeof payload.favorites === 'number') lines.push(`Favs: ${payload.favorites}`);
      break;
    }
    case 'person': {
      if (payload.birthday) lines.push(`Birthday: ${payload.birthday}`);
      if (typeof payload.favorites === 'number') lines.push(`Favs: ${payload.favorites}`);
      break;
    }
    default:
      break;
  }
  return lines.join('\n');
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  content: { paddingBottom: 16 },
  categoryCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 8,
    marginTop: 8,
  },
  categoryLabel: { textDecorationLine: 'underline' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 75,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  image: { width: 75, height: 75, borderRadius: 0 },
  rowText: { flex: 1, paddingHorizontal: 8 },
  subtitle: { opacity: 0.8, marginTop: 2 },
  markerBox: { paddingHorizontal: 8, paddingVertical: 6, marginLeft: 4 },
  marker: { textDecorationLine: 'underline' },
});
