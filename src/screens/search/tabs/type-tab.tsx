import React, { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Ripple } from '@/components/ui/ripple';
import { useTheme } from '@/theme/theme-context';

import { GridChoice } from '../grid-choices';

/**
 * The Genres/Studios pivots — `AnimeTypeSearchFragment` + the static
 * `AnimeSearchTypeItem` cells: a 3-column grid of 70dp rows, each an inner
 * `?BrushAnimeItemInnerBackground` box (10dp margin + 10dp padding) with a
 * centred, 2-line label. No search, no empty state — the choices are the
 * full enums ported in `grid-choices.ts`.
 *
 * Tapping a cell pushes the anime-list screen (`AnimeGenreSearch` /
 * `AnimeStudios` navigation args in the original).
 */

const COLUMNS = 3;

interface TypeTabProps {
  choices: GridChoice[];
  onPick: (choice: GridChoice) => void;
}

export function TypeTab({ choices, onPick }: TypeTabProps) {
  const renderItem = useCallback(
    ({ item }: { item: GridChoice }) => <TypeCell choice={item} onPress={() => onPick(item)} />,
    [onPick]
  );

  return (
    <FlatList
      data={choices}
      keyExtractor={(item) => String(item.id)}
      numColumns={COLUMNS}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.column}
      initialNumToRender={24}
      windowSize={5}
    />
  );
}

/* -------------------------------- cell --------------------------------- */

function TypeCell({ choice, onPress }: { choice: GridChoice; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Ripple onPress={onPress} style={styles.cell}>
      <View
        style={[
          styles.inner,
          { backgroundColor: theme.brush.animeItemInnerBackground },
        ]}>
        <AppText size={theme.fontSize.normal} style={styles.label} numberOfLines={2}>
          {choice.label}
        </AppText>
      </View>
    </Ripple>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 16 },
  column: { alignItems: 'stretch' },
  // FrameLayout 70dp tall, inner box with 10dp margin.
  cell: { flex: 1, height: 70 },
  inner: {
    flex: 1,
    margin: 10,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
});
