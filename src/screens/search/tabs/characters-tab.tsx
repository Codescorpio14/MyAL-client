import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icons';
import { AppText } from '@/components/ui/app-text';
import { ProgressRing } from '@/components/ui/overlays';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { useTheme } from '@/theme/theme-context';

import { CharacterSearchItem, searchCharacters } from '../search-api';
import { FirstSearchState, NoResultsState } from '../states';

/**
 * The Characters pivot — `CharacterSearchPageFragment` rendering
 * `FavouriteItem` cells in a 3-column portrait grid
 * (`GridViewColumnHelper(list, null, 2, 3)` + `MakeGridItemsSmaller` default
 * true → 146dp art, 45dp lower section, 12sp name/role):
 *
 *   5dp padded card on `?BrushAppBars`, art with a white `icon_help` fallback,
 *   a 1dp `?AccentColour` divider, then name + `<small>` notes.
 *
 * Data: `CharactersSearchQuery` → scrape of `myanimelist.net/character.php`.
 * Needs 3+ characters (`> 2` chars typed) before it fires.
 */

const MIN_QUERY_LENGTH = 3;
const COLUMNS = 3;

export function CharactersTab({ query }: { query: string }) {
  const [items, setItems] = useState<CharacterSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const trimmed = query.trim();
  const ready = trimmed.length >= MIN_QUERY_LENGTH;

  // Reset search state when the query changes (adjust state during render).
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setItems([]);
    setSearched(false);
    setLoading(false);
  }

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await searchCharacters(trimmed);
        if (cancelled) return;
        setItems(result);
        setSearched(true);
      } catch {
        if (cancelled) return;
        setItems([]);
        setSearched(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trimmed, ready]);

  const openDetails = useCallback((item: CharacterSearchItem) => {
    router.push(`/character-details?id=${item.id}&title=${encodeURIComponent(item.name)}`);
  }, []);

  if (!ready) return <FirstSearchState />;
  if (loading || !searched) return <ProgressRing style={styles.loading} />;
  if (items.length === 0) return <NoResultsState />;

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      numColumns={COLUMNS}
      renderItem={({ item }) => <CharacterCell item={item} onPress={() => openDetails(item)} />}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.column}
      windowSize={7}
      initialNumToRender={9}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}

/* -------------------------------- cell --------------------------------- */

function CharacterCell({ item, onPress }: { item: CharacterSearchItem; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Ripple onPress={onPress} style={styles.cell}>
      <View style={[styles.card, { backgroundColor: theme.brush.appBars }]}>
        <View
          style={[
            styles.imageBox,
            { backgroundColor: theme.brush.animeItemInnerBackground },
          ]}>
          {item.imageUrl ? (
            <RemoteImage uri={item.imageUrl} style={styles.image} />
          ) : (
            <View style={styles.noImage}>
              <AppIcon name="help" size={48} color="#fff" />
            </View>
          )}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.accentColor }]} />

        <View
          style={[
            styles.lower,
            { backgroundColor: theme.brush.animeItemBackground },
          ]}>
          <AppText size={12} numberOfLines={1} ellipsizeMode="tail">
            {item.name}
          </AppText>
          {item.notes ? (
            <AppText size={12} numberOfLines={1} ellipsizeMode="tail">
              {item.notes}
            </AppText>
          ) : null}
        </View>
      </View>
    </Ripple>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  list: { padding: 5, paddingBottom: 16 },
  column: { justifyContent: 'flex-start' },
  // FrameLayout root: 5dp padding, clipToPadding=false.
  cell: { flex: 1, padding: 5 },
  card: { elevation: 2, borderRadius: 0, overflow: 'hidden' },
  imageBox: { height: 146, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1 },
  lower: { height: 45, justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 5 },
});
