import { router, useLocalSearchParams, usePathname } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Linking,
  RefreshControl,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/api/auth';
import {
  applyListUpdate,
  currentSeason,
  flushPendingUpdates,
  ListQuery,
  loadList,
  loadMore,
  sortItems,
} from '@/api/library';
import { statusFromInt, statusToInt, statusToString } from '@/api/status';
import {
  DisplayMode,
  LibraryItem,
  ListKind,
  MANGA_ADAPTED_TYPES,
  SortOption,
  StatusKey,
  TOP_ANIME_TYPES,
  TOP_MANGA_TYPES,
  WorkMode,
} from '@/api/types';
import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { Flyout, FlyoutRect } from '@/components/ui/flyout';
import { EmptyState, LoadingOverlay } from '@/components/ui/overlays';
import { AppText } from '@/components/ui/app-text';
import { Ripple } from '@/components/ui/ripple';
import { setSetting, useSettings } from '@/store/settings';
import { useTheme } from '@/theme/theme-context';
import { OptionsDialog, ProgressDialog } from '@/screens/anime-list/dialogs';
import { FabAction, FabMenu, FabMenuItem } from '@/screens/anime-list/fab-menu';
import { CompactRow, GridCell, ItemActions, ListRow } from '@/screens/anime-list/items';
import {
  buildTitle,
  defaultStatusInt,
  modeConfig,
  seasonLabel,
  TitleContext,
} from '@/screens/anime-list/list-config';
import { DrawerSection, RightDrawer } from '@/screens/anime-list/right-drawer';

const LOAD_MORE_PAGES = 10;

type ListParams = {
  mode?: string;
  status?: string;
  topType?: string;
  type?: string;
  genreId?: string;
  studioId?: string;
  label?: string;
  listSource?: string;
};

/** `SortOptions.SetSortOrder` auto-direction rules (AutoDescendingSorting). */
function autoDescending(option: SortOption, isOwnList: boolean): boolean {
  switch (option) {
    case 'SortScore':
    case 'SortAirDay':
    case 'SortLastWatched':
      return true;
    case 'SortWatched':
      return isOwnList;
    default:
      return false;
  }
}

/** ints (1,2,3,4,6,7) → StatusKey respecting manga's plan_to_read. */
function statusKeyFor(statusInt: number, kind: ListKind): StatusKey | null {
  if (statusInt === 7 || statusInt === 8) return null;
  const key = statusFromInt(statusInt);
  if (!key || key === 'all') return null;
  return kind === 'manga' && key === 'plan_to_watch' ? 'plan_to_read' : key;
}

const STATUS_INT_OPTIONS = [1, 2, 3, 4, 6, 7];

const SCORE_OPTIONS: { key: string; label: string }[] = [
  { key: '10', label: '10 - Masterpiece' },
  { key: '9', label: '9 - Great' },
  { key: '8', label: '8 - Very Good' },
  { key: '7', label: '7 - Good' },
  { key: '6', label: '6 - Fine' },
  { key: '5', label: '5 - Average' },
  { key: '4', label: '4 - Bad' },
  { key: '3', label: '3 - Very Bad' },
  { key: '2', label: '2 - Horrible' },
  { key: '1', label: '1 - Appaling' },
  { key: '0', label: 'Unranked' },
];

type DialogState = { kind: 'status' | 'score' | 'progress'; item: LibraryItem } | null;

/** Port of `AnimeListPageFragment` + `AnimeListViewModel` (all work modes). */
export function AnimeListScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const openDrawer = useOpenDrawer();
  const auth = useAuth();
  const params = useLocalSearchParams<ListParams>();
  const pathname = usePathname();

  const defaultMode = pathname === '/' && settings.defaultMenuTab === 'manga' ? 'Manga' : 'Anime';
  const mode = (params.mode as WorkMode) || defaultMode;
  const config = useMemo(() => modeConfig(mode), [mode]);
  const kind = config.kind;

  /* ------------------------- list state ------------------------- */
  const statusParam = (params.status as StatusKey | 'all' | undefined) ?? undefined;
  const [statusInt, setStatusInt] = useState(() =>
    statusParam ? statusToInt(statusParam) : defaultStatusInt(config)
  );
  const [sortOption, setSortOption] = useState<SortOption>(config.defaultSort);
  const [descending, setDescending] = useState(() =>
    settings.listSortAscending ? false : autoDescending(config.defaultSort, config.isOwnList)
  );
  const [hideNotCompleted, setHideNotCompleted] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('IndefiniteGrid');
  const [query, setQuery] = useState('');

  const [topType, setTopType] = useState<string>(
    params.topType ?? params.type ?? (config.mode === 'TopAnime' ? 'General' : 'All')
  );
  const [season, setSeason] = useState(() => {
    const { year, name } = currentSeason();
    return { year, name };
  });
  const [listSource, setListSource] = useState(params.listSource ?? (config.isOwnList ? auth.username : undefined));
  const [stateMode, setStateMode] = useState(mode);
  if (stateMode !== mode) {
    setStateMode(mode);
    setStatusInt(statusParam ? statusToInt(statusParam) : defaultStatusInt(config));
    setSortOption(config.defaultSort);
    setDescending(
      settings.listSortAscending ? false : autoDescending(config.defaultSort, config.isOwnList)
    );
  }

  const genreId = params.genreId ? Number(params.genreId) : undefined;
  const studioId = params.studioId ? Number(params.studioId) : undefined;
  const label = (params.label as string | undefined) ?? '';

  /* ------------------------ fetch state ------------------------- */
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [canLoadMore, setCanLoadMore] = useState(
    config.mode === 'TopAnime' ||
      config.mode === 'TopManga' ||
      mode === 'AnimeByGenre' ||
      mode === 'AnimeByStudio'
  );
  const [forceToken, setForceToken] = useState(0);

  /* ------------------------- ui state --------------------------- */
  const [section, setSection] = useState<DrawerSection | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [progressValue, setProgressValue] = useState(0);
  const [progressTotal, setProgressTotal] = useState<number | undefined>(undefined);
  const [titleFlyout, setTitleFlyout] = useState<FlyoutRect | null>(null);
  const [rowMenu, setRowMenu] = useState<{ item: LibraryItem; rect: FlyoutRect } | null>(null);
  const [sourceDialog, setSourceDialog] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  const listQuery = useMemo<ListQuery>(
    () => ({
      workMode: mode,
      kind,
      statusFilter: null,
      topAnimeType: mode === 'TopAnime' ? (topType as never) : undefined,
      topMangaType: mode === 'TopManga' ? (topType as never) : undefined,
      adaptedType: mode === 'MangaAdapted' ? (topType as never) : undefined,
      genreId,
      studioId,
      seasonYear: season.year,
      seasonName: season.name as 'winter' | 'spring' | 'summer' | 'fall',
      force: forceToken > 0,
    }),
    [mode, kind, topType, genreId, studioId, season.year, season.name, forceToken]
  );

  /* --------------------------- load ----------------------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        await flushPendingUpdates();
        const loaded = await loadList(listQuery);
        if (alive) {
          setItems(loaded);
          setPage(1);
        }
      } catch (cause) {
        if (alive) {
          setItems([]);
          setLoadError(cause instanceof Error ? cause.message : 'Unable to load this list.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, topType, genreId, studioId, season.year, season.name, listSource, forceToken]);

  const onRefresh = useCallback(async () => {
    if (!settings.pullToRefreshEnabled) return;
    setRefreshing(true);
    setLoadError(null);
    try {
      await flushPendingUpdates();
      const loaded = await loadList({ ...listQuery, force: true });
      setItems(loaded);
      setPage(1);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to refresh this list.';
      setLoadError(message);
      setNotice(message);
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.pullToRefreshEnabled, mode, topType, genreId, studioId, season.year, season.name, listSource]);

  const onLoadMore = useCallback(async () => {
    if (loadingMore || !canLoadMore || page >= LOAD_MORE_PAGES) return;
    setLoadingMore(true);
    try {
      const more = await loadMore(listQuery, page + 1);
      if (more.length === 0) {
        setCanLoadMore(false);
      } else {
        setItems((prev) => [...prev, ...more]);
        setPage((p) => p + 1);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to load more items.';
      setNotice(message);
    } finally {
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, canLoadMore, page, mode, topType, genreId, studioId]);

  /* ---------------------- derived items ------------------------- */
  const filtered = useMemo(() => {
    let list = items;
    const key = config.isOwnList ? statusKeyFor(statusInt, kind) : null;
    if (key) list = list.filter((i) => i.myStatus === key);
    if (mode === 'SeasonalAnime' && hideNotCompleted) {
      // HideNotAired: keep only entries without a scheduled air day & known episode count
      list = list.filter((i) => i.airDay === undefined && (i.episodes ?? 0) !== 0);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.altTitle ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, statusInt, kind, mode, config.isOwnList, hideNotCompleted, query]);

  const displayItems = useMemo(() => {
    // naturalOrder + SortWatched = keep the API's index order
    if (config.naturalOrder && sortOption === 'SortWatched') return filtered;
    return sortItems(filtered, sortOption, !descending);
  }, [filtered, config.naturalOrder, sortOption, descending]);

  /* ------------------------ item actions ------------------------ */
  const updateItem = useCallback(async (item: LibraryItem, patch: Parameters<typeof applyListUpdate>[2]) => {
    const updated = await applyListUpdate(item.kind, item, patch);
    setItems((prev) => prev.map((i) => (i.id === updated.id && i.kind === updated.kind ? updated : i)));
  }, []);

  const openItem = useCallback((item: LibraryItem) => {
    router.push({
      pathname: '/details',
      params: { kind: item.kind, id: String(item.id), title: item.title },
    });
  }, []);

  const itemActions = useMemo<ItemActions>(
    () => ({
      onOpen: openItem,
      onMore: (item, rect) => setRowMenu({ item, rect }),
      onAdd: (item) =>
        void updateItem(item, { status: item.kind === 'manga' ? 'plan_to_read' : 'plan_to_watch' }),
      onStatusDialog: (item) => setDialog({ kind: 'status', item }),
      onScoreDialog: (item) => setDialog({ kind: 'score', item }),
      onWatchedDialog: (item) => {
        setProgressValue(item.myProgress ?? 0);
        setProgressTotal(item.kind === 'anime' ? item.episodes : item.chapters);
        setDialog({ kind: 'progress', item });
      },
      onInc: (item) => {
        const total = item.kind === 'anime' ? item.episodes : item.chapters;
        setItems((prev) =>
          prev.map((i) => {
            if (i.id !== item.id || i.kind !== item.kind) return i;
            const next = Math.min(total ?? (i.myProgress ?? 0) + 1, (i.myProgress ?? 0) + 1);
            return { ...i, myProgress: next };
          })
        );
        void updateItem(item, { progress: Math.min((item.myProgress ?? 0) + 1, total ?? Number.MAX_SAFE_INTEGER) });
      },
      onDec: (item) => {
        setItems((prev) =>
          prev.map((i) => {
            if (i.id !== item.id || i.kind !== item.kind) return i;
            return { ...i, myProgress: Math.max(0, (i.myProgress ?? 0) - 1) };
          })
        );
        void updateItem(item, { progress: Math.max(0, (item.myProgress ?? 0) - 1) });
      },
    }),
    [openItem, updateItem]
  );

  /* -------------------------- FAB ------------------------------- */
  const onShuffle = useCallback(() => {
    if (!displayItems.length) return;
    const pick = displayItems[Math.floor(Math.random() * displayItems.length)];
    openItem(pick);
  }, [displayItems, openItem]);

  const fabActions = useMemo<FabAction[]>(() => {
    const actions: FabAction[] = [];
    if (config.isOwnList) {
      actions.push({ key: 'filter', icon: 'filter', onPress: () => setSection('filters') });
    } else if (mode === 'SeasonalAnime') {
      actions.push({ key: 'filter', icon: 'filter', onPress: () => setSection('seasonal') });
    } else if (mode === 'TopAnime' || mode === 'TopManga' || mode === 'MangaAdapted') {
      actions.push({ key: 'filter', icon: 'filter', onPress: () => setSection('top') });
    }
    if (config.sortingEnabled) {
      actions.push({ key: 'sort', icon: 'sort', onPress: () => setSection('sorting') });
    }
    actions.push({ key: 'shuffle', icon: 'shuffle', onPress: onShuffle });
    if (mode === 'SeasonalAnime') {
      actions.push({ key: 'calendar', icon: 'calendar', onPress: () => setSection('seasonal') });
    } else if (mode === 'TopAnime') {
      actions.push({ key: 'top', icon: 'fav_outline', onPress: () => setSection('top') });
    }
    return actions;
  }, [config.isOwnList, config.sortingEnabled, mode, onShuffle]);

  const titleFilterItems = useMemo(() => {
    if (config.isOwnList) {
      return STATUS_INT_OPTIONS.map((i) => ({
        key: String(i),
        label:
          i === 1
            ? config.filter1Label
            : i === 6
              ? config.filter5Label
              : statusToString(i, kind),
        selected: statusInt === i,
      }));
    }
    if (mode === 'TopAnime') {
      return TOP_ANIME_TYPES.map((type) => ({ key: type, label: type, selected: topType === type }));
    }
    if (mode === 'TopManga') {
      return TOP_MANGA_TYPES.map((type) => ({ key: type, label: type, selected: topType === type }));
    }
    if (mode === 'MangaAdapted') {
      return MANGA_ADAPTED_TYPES.map((type) => ({
        key: type,
        label: type === 'AiringNow' ? 'Airing Now' : type === 'UpcomingAnime' ? 'Upcoming Anime' : 'All',
        selected: topType === type,
      }));
    }
    if (mode === 'SeasonalAnime') {
      return [
        ...['winter', 'spring', 'summer', 'fall'].map((name) => ({
          key: name,
          label: `${name[0].toUpperCase()}${name.slice(1)} ${season.year}`,
          selected: season.name === name,
        })),
        { key: 'select', label: 'Select year…', selected: false },
      ];
    }
    return [];
  }, [config.isOwnList, config.filter1Label, config.filter5Label, kind, statusInt, mode, topType, season]);

  const fabMenuItems = useMemo<FabMenuItem[]>(() => {
    const itemsList: FabMenuItem[] = [];
    if (config.listSourceEnabled) {
      itemsList.push({ key: 'source', label: 'Set list source', onPress: () => setSourceDialog(true) });
    }
    itemsList.push({
      key: 'loadDetails',
      label: 'Load all details',
      onPress: () => {
        setNotice('Started pulling data in background...');
      },
    });
    itemsList.push({ key: 'display', label: 'Display modes', onPress: () => setSection('display') });
    return itemsList;
  }, [config.listSourceEnabled]);

  /* ------------------------- dialogs ---------------------------- */
  const statusDialogOptions = useMemo(
    () =>
      STATUS_INT_OPTIONS.slice(0, 5).map((i) => ({
        key: String(i),
        label: statusToString(i, kind),
      })),
    [kind]
  );
  const dialogStatusKey = dialog?.kind === 'status' && dialog.item.myStatus
    ? String(statusToInt(dialog.item.myStatus))
    : undefined;

  const rowMenuItems = useMemo(() => {
    const base = [
      { key: 'share', label: 'Share' },
      { key: 'browser', label: 'Open in browser' },
    ];
    if (config.isOwnList && rowMenu?.item.inList) {
      base.push(
        { key: 'priority_high', label: 'Priority high' },
        { key: 'priority_med', label: 'Priority medium' },
        { key: 'priority_low', label: 'Priority low' }
      );
    }
    return base;
  }, [config.isOwnList, rowMenu?.item]);

  const malItemUrl = (item: LibraryItem) =>
    `https://myanimelist.net/${item.kind}/${item.id}`;

  /* -------------------------- render ---------------------------- */
  const widthDp = Dimensions.get('window').width;
  const gridCols = Math.max(3, Math.floor(widthDp / 133));
  const gridCellWidth = Math.min(133 * gridCols, widthDp) / gridCols;

  const showEmpty = !loading && !loadError && displayItems.length === 0;

  const titleCtx: TitleContext = {
    listSource,
    season: seasonLabel(season.name, season.year),
    topType,
    adaptedType: topType,
    genreName: mode === 'AnimeByGenre' ? label : undefined,
    studioName: mode === 'AnimeByStudio' ? label : undefined,
  };
  const { title, subtitle } = buildTitle(config, statusInt, sortOption, titleCtx);

  const renderItem = useCallback(
    ({ item }: { item: LibraryItem }) => {
      if (displayMode === 'IndefiniteGrid') {
        return (
          <GridCell
            item={item}
            actions={itemActions}
            width={Math.floor(gridCellWidth)}
            allowAdd={config.isOwnList || mode === 'SeasonalAnime'}
          />
        );
      }
      if (displayMode === 'IndefiniteCompactList') {
        return <CompactRow item={item} actions={itemActions} />;
      }
      return <ListRow item={item} actions={itemActions} />;
    },
    [config.isOwnList, displayMode, itemActions, gridCellWidth, mode]
  );

  const ListFooter =
    canLoadMore && !showEmpty ? (
      <Ripple
        onPress={onLoadMore}
        style={[styles.loadMore, { backgroundColor: theme.accentDark }]}>
        <AppText size={theme.fontSize.normal} color="#fff">
          {loadingMore ? 'Loading...' : 'Load more'}
        </AppText>
      </Ripple>
    ) : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar
        title={title}
        subtitle={subtitle}
        onMenuPress={openDrawer}
        onTitlePress={
          titleFilterItems.length
            ? () => setTitleFlyout({ x: 8, y: insets.top + 50, width: 210, height: 30 })
            : undefined
        }
        onRefresh={() => void onRefresh()}
        search={{ hint: 'Search in current list', value: query, onChange: setQuery }}
      />

      {displayMode === 'IndefiniteGrid' ? (
        <FlatList
          key={`grid-${gridCols}`}
          data={displayItems}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          numColumns={gridCols}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[styles.listContent, { paddingBottom: 45 + Math.max(insets.bottom, 0) }]}
          refreshControl={
            settings.pullToRefreshEnabled ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.accentColor]}
                tintColor={theme.accentColor}
              />
            ) : undefined
          }
          ListFooterComponent={ListFooter}
        />
      ) : (
        <FlatList
          data={displayItems}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={[styles.listContent, { paddingBottom: 45 + Math.max(insets.bottom, 0) }]}
          refreshControl={
            settings.pullToRefreshEnabled ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.accentColor]}
                tintColor={theme.accentColor}
              />
            ) : undefined
          }
          ListFooterComponent={ListFooter}
        />
      )}

      {showEmpty ? (
        <View pointerEvents="none" style={styles.empty}>
          <AppText size={theme.fontSize.medium} color={theme.accentColor}>
            We have come up empty...
          </AppText>
        </View>
      ) : null}

      <LoadingOverlay visible={loading && !notice} />

      {loadError && !loading && displayItems.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: theme.brush.deepBackground }]}>
          <EmptyState
            title="Could not load this list"
            message={loadError}
          />
        </View>
      ) : null}

      {notice ? (
        <View pointerEvents="none" style={[styles.notice, { backgroundColor: theme.accentDark }]}>
          <AppText size={theme.fontSize.normal} color="#fff">
            {notice}
          </AppText>
        </View>
      ) : null}

      <FabMenu actions={fabActions} menuItems={fabMenuItems} />

      {section ? (
        <RightDrawer
          section={section}
          onClose={() => setSection(null)}
          config={config}
          statusInt={statusInt}
          onStatus={setStatusInt}
          sortOption={sortOption}
          onSort={(option) => {
            setSortOption(option);
            setDescending(autoDescending(option, config.isOwnList));
          }}
          descending={descending}
          onDescending={(value) => {
            setDescending(value);
            setSetting('listSortAscending', !value);
          }}
          hideNotCompleted={hideNotCompleted}
          onHideNotCompleted={setHideNotCompleted}
          displayMode={displayMode}
          onDisplayMode={setDisplayMode}
          topType={topType}
          onTopType={(t) => {
            setTopType(t);
            setSection(null);
          }}
          season={season}
          onSeason={(year, name) => {
            setSeason({ year, name });
            setSection(null);
          }}
        />
      ) : null}

      {/* The title flyout matches each work mode: status, top type, or season. */}
      <Flyout
        visible={titleFlyout !== null}
        anchor={titleFlyout}
        items={titleFilterItems}
        onSelect={(key) => {
          if (config.isOwnList) {
            setStatusInt(Number(key));
          } else if (mode === 'TopAnime' || mode === 'TopManga' || mode === 'MangaAdapted') {
            setTopType(key);
          } else if (mode === 'SeasonalAnime') {
            if (key === 'select') {
              setSection('seasonal');
            } else {
              setSeason((current) => ({ ...current, name: key }));
            }
          }
        }}
        onClose={() => setTitleFlyout(null)}
      />

      {/* Row long-press flyout */}
      <Flyout
        visible={rowMenu !== null}
        anchor={rowMenu?.rect ?? null}
        items={rowMenuItems}
        onSelect={(key) => {
          const item = rowMenu?.item;
          if (!item) return;
          if (key === 'share') {
            void Share.share({ title: item.title, message: `${item.title}\n${malItemUrl(item)}` });
          } else if (key === 'browser') {
            void Linking.openURL(malItemUrl(item));
          } else if (key === 'priority_high') {
            void updateItem(item, { priority: 2 });
          } else if (key === 'priority_med') {
            void updateItem(item, { priority: 1 });
          } else if (key === 'priority_low') {
            void updateItem(item, { priority: 0 });
          }
        }}
        onClose={() => setRowMenu(null)}
        alignEnd
      />

      {/* Status dialog */}
      <OptionsDialog
        visible={dialog?.kind === 'status'}
        title="Status"
        options={statusDialogOptions}
        selectedKey={dialogStatusKey}
        onSelect={(key) => {
          const item = dialog?.item;
          if (!item) return;
          void updateItem(item, { status: statusKeyFor(Number(key), item.kind) ?? undefined });
          setDialog(null);
        }}
        onCancel={() => setDialog(null)}
      />

      {/* Score dialog */}
      <OptionsDialog
        visible={dialog?.kind === 'score'}
        title="Score"
        options={SCORE_OPTIONS}
        selectedKey={dialog?.kind === 'score' ? String(dialog.item.myScore ?? 0) : undefined}
        onSelect={(key) => {
          const item = dialog?.item;
          if (!item) return;
          void updateItem(item, { score: Number(key) });
          setDialog(null);
        }}
        onCancel={() => setDialog(null)}
      />

      {/* Progress dialog */}
      <ProgressDialog
        visible={dialog?.kind === 'progress'}
        title={kind === 'anime' ? 'Watched episodes' : 'Read chapters'}
        value={progressValue}
        total={progressTotal}
        onChange={setProgressValue}
        onConfirm={() => {
          const item = dialog?.item;
          if (!item) return;
          void updateItem(item, { progress: progressValue });
          setDialog(null);
        }}
        onCancel={() => setDialog(null)}
      />

      {/* Set list source dialog (TextInputDialog port) */}
      {sourceDialog ? (
        <View style={styles.sourceScrim}>
          <View style={[styles.sourceCard, { backgroundColor: theme.brush.flyoutBackground }]}>
            <AppText size={theme.fontSize.dialogTitle} color={theme.brush.text}>
              Set list source
            </AppText>
            <AppText size={theme.fontSize.normal} color={theme.brush.settingsSubtitle} style={{ marginTop: 6 }}>
              View someone else{'\u2019'}s list by entering their username.
            </AppText>
            <TextInput
              autoFocus
              value={sourceText}
              onChangeText={setSourceText}
              placeholder={auth.username || 'username'}
              placeholderTextColor={theme.brush.settingsSubtitle}
              selectionColor={theme.accentColor}
              onSubmitEditing={() => {
                if (sourceText.trim().length > 2) {
                  setListSource(sourceText.trim());
                  setForceToken((t) => t + 1);
                }
                setSourceDialog(false);
              }}
              style={[
                styles.sourceInput,
                {
                  backgroundColor: theme.brush.animeItemInnerBackground,
                  color: theme.brush.text,
                  fontSize: theme.fontSize.normal,
                },
              ]}
            />
            <View style={styles.sourceButtons}>
              <Ripple onPress={() => setSourceDialog(false)} style={styles.dialogBtn}>
                <AppText size={theme.fontSize.normal} color={theme.accentColor} style={styles.dialogLabel}>
                  CANCEL
                </AppText>
              </Ripple>
              <Ripple
                onPress={() => {
                  if (sourceText.trim().length > 2) {
                    setListSource(sourceText.trim());
                    setForceToken((t) => t + 1);
                  }
                  setSourceDialog(false);
                }}
                style={styles.dialogBtn}>
                <AppText size={theme.fontSize.normal} color={theme.accentColor} style={styles.dialogLabel}>
                  GO
                </AppText>
              </Ripple>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  listContent: { flexGrow: 1 },
  gridRow: { alignItems: 'flex-start' },
  loadMore: {
    height: 48,
    marginTop: 8,
    marginHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 90,
    paddingVertical: 10,
    alignItems: 'center',
    elevation: 6,
  },
  sourceScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#00000099',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sourceCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 10,
    padding: 20,
    elevation: 8,
  },
  sourceInput: {
    borderRadius: 4,
    marginTop: 12,
    paddingHorizontal: 12,
  },
  sourceButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  dialogBtn: {
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  dialogLabel: { letterSpacing: 0.8 },
});