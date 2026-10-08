import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { TabDef, TabStrip } from '@/components/ui/tab-strip';
import { useTheme } from '@/theme/theme-context';

import { GENRE_CHOICES, GridChoice, STUDIO_CHOICES } from './grid-choices';
import { CharactersTab } from './tabs/characters-tab';
import { EverywhereTab } from './tabs/everywhere-tab';
import { MediaTab } from './tabs/media-tab';
import { TypeTab } from './tabs/type-tab';

/**
 * `SearchPage` + `SearchPageViewModel` — the six pivots bound by
 * `SearchPagePagerAdapter.GetCustomTabView`:
 *
 *   Everywhere | Anime | Manga | Characters | Genres | Studios
 *
 * Behaviour ported from the original:
 *  - inline SearchView ("Search in whole database"), live search after a
 *    ~400ms quiet period with 2+ characters (original `Task.Delay(500)`),
 *    submitting immediately on the keyboard action;
 *  - the tab is also addressable via `?tab=` (`SearchPageNavArgs`);
 *  - Genres/Studios are static enum grids that jump to the anime list.
 */

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;

interface TabSpec {
  key: string;
  label: string;
}

const TABS: TabSpec[] = [
  { key: 'everywhere', label: 'Everywhere' },
  { key: 'anime', label: 'Anime' },
  { key: 'manga', label: 'Manga' },
  { key: 'characters', label: 'Characters' },
  { key: 'genres', label: 'Genres' },
  { key: 'studios', label: 'Studios' },
];

const DEFAULT_TAB = 'anime';

/** `?tab=` accepts a key ("anime") or the pager index ("1"). */
function normalizeTab(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return DEFAULT_TAB;
  const byKey = TABS.find((tab) => tab.key === value.toLowerCase());
  if (byKey) return byKey.key;
  const index = Number.parseInt(value, 10);
  if (!Number.isNaN(index) && index >= 0 && index < TABS.length) return TABS[index].key;
  return DEFAULT_TAB;
}

/** `CurrentStatus` on the Genres/Studios pivots. */
function titleForTab(tabKey: string): string {
  switch (tabKey) {
    case 'genres':
      return 'Anime by Genre';
    case 'studios':
      return 'Anime by Studio';
    default:
      return 'Search';
  }
}

export function SearchScreen(): JSX.Element {
  const theme = useTheme();
  const openDrawer = useOpenDrawer();
  const params = useLocalSearchParams<{ tab?: string }>();

  const [activeTab, setActiveTab] = useState(() => normalizeTab(params.tab));
  const [input, setInput] = useState('');
  /** Debounced/committed query actually handed to the pivots. */
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New `?tab=` (deep link) re-selects the pivot — adjust state during render.
  const [prevTab, setPrevTab] = useState(params.tab);
  if (prevTab !== params.tab) {
    setPrevTab(params.tab);
    setActiveTab(normalizeTab(params.tab));
  }

  const clearTimer = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const handleChange = useCallback(
    (text: string) => {
      setInput(text);
      clearTimer();
      const trimmed = text.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        // Below the minimum the original clears the results right away.
        setQuery('');
        return;
      }
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        setQuery(trimmed);
      }, DEBOUNCE_MS);
    },
    [clearTimer]
  );

  const handleSubmit = useCallback(
    (text: string) => {
      clearTimer();
      const trimmed = text.trim();
      setQuery(trimmed.length >= MIN_QUERY_LENGTH ? trimmed : '');
    },
    [clearTimer]
  );

  const handleClose = useCallback(() => {
    clearTimer();
    setInput('');
    setQuery('');
  }, [clearTimer]);

  const tabDefs = useMemo<TabDef[]>(
    () => TABS.map((tab) => ({ key: tab.key, label: tab.label })),
    []
  );

  const pickChoice = useCallback((choice: GridChoice) => {
    const isGenre = GENRE_CHOICES.includes(choice);
    const mode = isGenre ? 'AnimeByGenre' : 'AnimeByStudio';
    const idParam = isGenre ? 'genreId' : 'studioId';
    router.push(
      `/anime-list?mode=${mode}&${idParam}=${choice.id}&label=${encodeURIComponent(choice.label)}`
    );
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case 'everywhere':
        return <EverywhereTab query={query} />;
      case 'manga':
        return <MediaTab kind="manga" query={query} />;
      case 'characters':
        return <CharactersTab query={query} />;
      case 'genres':
        return <TypeTab choices={GENRE_CHOICES} onPick={pickChoice} />;
      case 'studios':
        return <TypeTab choices={STUDIO_CHOICES} onPick={pickChoice} />;
      case 'anime':
      default:
        return <MediaTab kind="anime" query={query} />;
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <AppBar
        title={titleForTab(activeTab)}
        onMenuPress={openDrawer}
        search={{
          hint: 'Search in whole database',
          value: input,
          onChange: handleChange,
          onSubmit: handleSubmit,
          onClose: handleClose,
        }}
      />
      <TabStrip
        tabs={tabDefs}
        activeKey={activeTab}
        onChange={setActiveTab}
        height={theme.dimens.tabStripHeight}
      />
      <View style={styles.body}>{renderTab()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1 },
});
