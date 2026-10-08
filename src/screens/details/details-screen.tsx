import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { applyListUpdate, removeEntry } from '@/api/library';
import { fetchDetails, ListStatusUpdate, MalDetails } from '@/api/mal';
import { statusToInt, statusToString } from '@/api/status';
import { recommendations, reviews } from '@/api/tenrai';
import {
  ANIME_STATUS_LIST,
  LibraryItem,
  ListKind,
  MANGA_STATUS_LIST,
  STATUS_DESCRIPTORS,
  StatusKey,
} from '@/api/types';
import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { AppIcon } from '@/components/ui/app-icons';
import { AppText } from '@/components/ui/app-text';
import { IconButton, IncDecButtons, UnderlineButton } from '@/components/ui/buttons';
import { Flyout, FlyoutRect, measureAnchor } from '@/components/ui/flyout';
import { EmptyState, LoadingOverlay } from '@/components/ui/overlays';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { TabDef, TabStrip } from '@/components/ui/tab-strip';
import { OptionsDialog, ProgressDialog } from '@/screens/anime-list/dialogs';
import { useTheme } from '@/theme/theme-context';

import {
  CharacterActorPair,
  EpisodeRowData,
  fetchCast,
  fetchEpisodes,
  fetchThemes,
  StaffGroup,
  ThemeList,
} from './details-api';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

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

/** MAL `my_list_status.status` → shared `StatusKey`. */
function myStatusKey(raw: string | undefined, kind: ListKind): StatusKey | undefined {
  switch (raw) {
    case 'watching':
    case 'reading':
      return 'watching';
    case 'completed':
      return 'completed';
    case 'on_hold':
      return 'on_hold';
    case 'dropped':
      return 'dropped';
    case 'plan_to_watch':
      return kind === 'manga' ? 'plan_to_read' : 'plan_to_watch';
    case 'plan_to_read':
      return 'plan_to_read';
    default:
      return undefined;
  }
}

function detailsToItem(kind: ListKind, details: MalDetails): LibraryItem {
  const s = details.my_list_status;
  return {
    id: details.id,
    title: details.title,
    altTitle: details.alternative_titles?.en || details.alternative_titles?.synonyms?.[0],
    imageUrl: details.main_picture?.large || details.main_picture?.medium,
    mediaType: details.media_type,
    entryStatus: details.status,
    kind,
    episodes: details.num_episodes,
    chapters: details.num_chapters,
    volumes: details.num_volumes,
    score: details.mean,
    genres: details.genres?.map((g) => g.name),
    inList: Boolean(s),
    myStatus: myStatusKey(s?.status, kind),
    myScore: s?.score ?? 0,
    myProgress: kind === 'anime' ? s?.num_episodes_watched ?? 0 : s?.num_chapters_read ?? 0,
    myVolumes: kind === 'manga' ? s?.num_volumes_read ?? 0 : undefined,
    isRewatching: s ? (kind === 'anime' ? s.is_rewatching : s.is_rereading) : undefined,
    startDate: s?.start_date,
    finishDate: s?.finish_date,
    tags: s?.tags?.join(', '),
    rewatchCount: kind === 'anime' ? s?.num_times_rewatched : s?.num_times_reread,
  };
}

function prettyDate(raw?: string): string {
  if (!raw) return '—';
  return raw.slice(0, 10);
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

type DialogKind = 'status' | 'score' | 'progress' | 'volumes' | null;

/** `?kind=anime|manga&id=…&title=…` (`AnimeDetailsPageNavigationArgs`). */
export function DetailsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const openDrawer = useOpenDrawer();
  const params = useLocalSearchParams<{ kind?: string; id?: string; title?: string }>();

  const kind: ListKind = params.kind === 'manga' ? 'manga' : 'anime';
  const id = Number(params.id);
  const isAnime = kind === 'anime';

  /* ------------------------- details state ------------------------ */
  const [details, setDetails] = useState<MalDetails | null>(null);
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  /* --------------------------- ui state --------------------------- */
  const [tab, setTab] = useState('general');
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [progressValue, setProgressValue] = useState(0);
  const [volumeValue, setVolumeValue] = useState(0);
  const [favourite, setFavourite] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState<FlyoutRect | null>(null);
  const moreRef = useRef<View | null>(null);

  /* --------------------- lazily loaded sections -------------------- */
  const [cast, setCast] = useState<{ characters: CharacterActorPair[]; staff: StaffGroup } | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeRowData[] | null>(null);
  const [themes, setThemes] = useState<ThemeList | null>(null);
  const [reviewRows, setReviewRows] = useState<Record<string, unknown>[] | null>(null);
  const [recoms, setRecoms] = useState<Record<string, unknown>[] | null>(null);

  const [forceToken, setForceToken] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await fetchDetails(kind, id);
        if (!alive) return;
        setDetails(data);
        setItem(detailsToItem(kind, data));
        setFailed(false);
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [kind, id, forceToken]);

  useEffect(() => {
    if (tab === 'cast' && cast === null) {
      fetchCast(kind, id)
        .then(setCast)
        .catch(() => setCast({ characters: [], staff: { positions: [] } }));
    } else if (tab === 'details' && isAnime) {
      if (episodes === null) fetchEpisodes(id).then(setEpisodes).catch(() => setEpisodes([]));
      if (themes === null) fetchThemes(id).then(setThemes).catch(() => setThemes({ openings: [], endings: [] }));
    } else if (tab === 'reviews' && reviewRows === null) {
      reviews(kind, id, 1)
        .then((r) => setReviewRows(Array.isArray(r) ? r : []))
        .catch(() => setReviewRows([]));
    } else if (tab === 'recoms' && recoms === null) {
      recommendations(kind, id)
        .then((r) => setRecoms(Array.isArray(r) ? r : []))
        .catch(() => setRecoms([]));
    }
  }, [tab, kind, id, isAnime, cast, episodes, themes, reviewRows, recoms]);

  /* --------------------------- mutations -------------------------- */
  const update = useCallback(
    async (patch: ListStatusUpdate) => {
      if (!item) return;
      const updated = await applyListUpdate(kind, item, patch);
      setItem(updated);
    },
    [kind, item]
  );

  const totalProgress = item
    ? kind === 'anime'
      ? item.episodes
      : item.chapters
    : undefined;

  const statusOptions = useMemo(
    () =>
      (isAnime ? ANIME_STATUS_LIST : MANGA_STATUS_LIST).map((key) => {
        const d = STATUS_DESCRIPTORS[key];
        return { key, label: d.label, apiValue: d.apiValue };
      }),
    [isAnime]
  );

  const malUrl = `https://myanimelist.net/${kind}/${id}`;

  const moreItems = useMemo(() => {
    const base = [
      { key: 'share', label: 'Share' },
      { key: 'browser', label: 'Open in browser' },
    ];
    if (item?.inList) base.push({ key: 'remove', label: 'Remove from list' });
    return base;
  }, [item?.inList]);

  const tabDefs = useMemo<TabDef[]>(() => {
    const defs: TabDef[] = [
      { key: 'general', label: 'General' },
      { key: 'details', label: 'Details' },
      { key: 'reviews', label: 'Reviews' },
      { key: 'recoms', label: 'Recoms' },
      { key: 'related', label: 'Related' },
    ];
    if (isAnime) {
      defs.push({ key: 'cast', label: 'Cast' }, { key: 'staff', label: 'Staff' });
    }
    return defs;
  }, [isAnime]);

  /* ----------------------------- render --------------------------- */
  const statusKey = item?.myStatus;
  const statusLabel = statusKey
    ? statusToString(statusToInt(statusKey), kind, item?.isRewatching)
    : isAnime
      ? 'Plan to watch'
      : 'Plan to read';

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar
        title={details?.title ?? params.title ?? 'Details'}
        subtitle={item?.inList && statusKey ? statusLabel : undefined}
        onMenuPress={openDrawer}
        onRefresh={() => setForceToken((t) => t + 1)}
      />

      {details && item ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 45 + insets.bottom }}>
          {/* ---------- upper header (140dp, detailsUpperBackground) ---------- */}
          <View
            style={[
              styles.header,
              { backgroundColor: theme.brush.detailsUpperBackground, elevation: 2 },
            ]}>
            <View style={styles.headerRow}>
              <View>
                <RemoteImage uri={item.imageUrl} style={styles.cover} />
                <View style={[styles.coverUnderline, { backgroundColor: theme.accentColor }]} />
              </View>

              {item.inList ? (
                <View style={styles.updateSection}>
                  <View>
                    {[
                      'Score',
                      'Status',
                      isAnime ? 'Watched episodes' : 'Read chapters',
                      ...(kind === 'manga' ? ['Volumes'] : []),
                    ].map((label) => (
                      <AppText key={label} size={theme.fontSize.normal} color={theme.brush.text} style={styles.rowLabel}>
                        {label}
                      </AppText>
                    ))}
                  </View>

                  <View style={{ marginLeft: 15 }}>
                    <UnderlineButton
                      label={item.myScore ? `${item.myScore}/10` : '—'}
                      onPress={() => setDialog('score')}
                      style={styles.underlineBtn}
                    />
                    <UnderlineButton
                      label={statusLabel}
                      onPress={() => setDialog('status')}
                      style={styles.underlineBtn}
                    />
                    <UnderlineButton
                      label={totalProgress != null ? `${item.myProgress ?? 0}/${totalProgress}` : String(item.myProgress ?? 0)}
                      onPress={() => {
                        setProgressValue(item.myProgress ?? 0);
                        setDialog('progress');
                      }}
                      style={styles.underlineBtn}
                    />
                    {kind === 'manga' ? (
                      <UnderlineButton
                        label={item.volumes != null ? `${item.myVolumes ?? 0}/${item.volumes}` : String(item.myVolumes ?? 0)}
                        onPress={() => {
                          setVolumeValue(item.myVolumes ?? 0);
                          setDialog('volumes');
                        }}
                        style={styles.underlineBtn}
                      />
                    ) : null}
                  </View>

                  <IncDecButtons
                    style={styles.incDec}
                    onIncrement={() =>
                      void update({
                        progress: Math.min(totalProgress ?? (item.myProgress ?? 0) + 1, (item.myProgress ?? 0) + 1),
                      })
                    }
                    onDecrement={() =>
                      void update({ progress: Math.max(0, (item.myProgress ?? 0) - 1) })
                    }
                  />
                </View>
              ) : (
                <View style={styles.addSection}>
                  <AppText size={theme.fontSize.normal} color={theme.accentColor} style={{ textAlign: 'center', marginBottom: 10 }}>
                    This entry is not on your list yet.
                  </AppText>
                  <Ripple
                    onPress={() =>
                      void update({ status: isAnime ? 'plan_to_watch' : 'plan_to_read' })
                    }
                    style={[styles.addButton, { backgroundColor: theme.brush.detailsUpperBackground, borderColor: theme.accentColor }]}>
                    <AppIcon name="add" size={24} color={theme.brush.text} />
                    <AppText size={theme.fontSize.normal} color={theme.brush.text}>
                      Add to my list
                    </AppText>
                  </Ripple>
                </View>
              )}
            </View>

            {/* favourite + more */}
            <View style={styles.favMore}>
              <IconButton
                icon={favourite ? 'favourite' : 'unfavourite'}
                onPress={() => setFavourite((v) => !v)}
              />
              <View ref={moreRef} collapsable={false}>
                <IconButton
                  icon="more_vertical"
                  onPress={() => {
                    void measureAnchor(moreRef).then((rect) => rect && setMoreAnchor(rect));
                  }}
                />
              </View>
            </View>
          </View>

          <TabStrip tabs={tabDefs} activeKey={tab} onChange={setTab} height={25} />

          <View style={{ backgroundColor: theme.brush.detailsBackground }}>
            {tab === 'general' ? <GeneralTab details={details} item={item} kind={kind} /> : null}
            {tab === 'details' ? (
              <DetailsTab details={details} item={item} kind={kind} episodes={episodes} themes={themes} />
            ) : null}
            {tab === 'reviews' ? <ReviewsTab rows={reviewRows} kind={kind} id={id} /> : null}
            {tab === 'recoms' ? <RecomsTab rows={recoms} kind={kind} /> : null}
            {tab === 'related' ? <RelatedTab details={details} kind={kind} /> : null}
            {tab === 'cast' ? <CastTab cast={cast} /> : null}
            {tab === 'staff' ? <StaffTab staff={cast?.staff ?? null} /> : null}
          </View>
        </ScrollView>
      ) : null}

      {failed ? (
        <EmptyState
          icon="eye_cross"
          title="Could not load details"
          message={`${kind} #${id}`}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <LoadingOverlay visible={loading} />

      <Flyout
        visible={moreAnchor !== null}
        anchor={moreAnchor}
        items={moreItems}
        alignEnd
        onSelect={(key) => {
          if (key === 'share') {
            void Share.share({ title: details?.title, message: `${details?.title ?? ''}\n${malUrl}` });
          } else if (key === 'browser') {
            void Linking.openURL(malUrl);
          } else if (key === 'remove' && item) {
            void (async () => {
              const cleared = await removeEntry(kind, item);
              setItem(cleared);
            })();
          }
        }}
        onClose={() => setMoreAnchor(null)}
      />

      <OptionsDialog
        visible={dialog === 'status'}
        title="Status"
        options={statusOptions.map((o) => ({ key: o.key, label: o.label }))}
        selectedKey={statusKey}
        onSelect={(key) => {
          const opt = statusOptions.find((o) => o.key === key);
          setDialog(null);
          if (opt) void update({ status: opt.apiValue });
        }}
        onCancel={() => setDialog(null)}
      />

      <OptionsDialog
        visible={dialog === 'score'}
        title="Score"
        options={SCORE_OPTIONS}
        selectedKey={item ? String(item.myScore ?? 0) : undefined}
        onSelect={(key) => {
          setDialog(null);
          void update({ score: Number(key) });
        }}
        onCancel={() => setDialog(null)}
      />

      <ProgressDialog
        visible={dialog === 'progress'}
        title={isAnime ? 'Watched episodes' : 'Read chapters'}
        value={progressValue}
        total={totalProgress}
        onChange={setProgressValue}
        onConfirm={() => {
          setDialog(null);
          void update({ progress: progressValue });
        }}
        onCancel={() => setDialog(null)}
      />

      <ProgressDialog
        visible={dialog === 'volumes'}
        title="Read volumes"
        value={volumeValue}
        total={item?.volumes}
        onChange={setVolumeValue}
        onConfirm={() => {
          setDialog(null);
          void update({ volumes: volumeValue });
        }}
        onCancel={() => setDialog(null)}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

/** Two-column alternating info rows with accent rail (GeneralTab.xml). */
function InfoGrid({ left, right }: { left: [string, string][]; right: [string, string][] }) {
  const theme = useTheme();
  const row = (label: string, value: string, idx: number, railSide: 'left' | 'right') => (
    <View
      key={label}
      style={[
        styles.infoRow,
        {
          backgroundColor: idx % 2 === 0 ? theme.brush.rowAlternate1 : theme.brush.rowAlternate2,
          borderLeftWidth: railSide === 'left' ? 2 : 0,
          borderRightWidth: railSide === 'right' ? 2 : 0,
          borderColor: theme.accentColor,
        },
      ]}>
      <AppText size={theme.fontSize.normal} color={theme.brush.text}>
        {label}
      </AppText>
      <AppText size={theme.fontSize.normal} color={railSide === 'left' ? theme.brush.text : theme.accentDark} weight="medium">
        {value}
      </AppText>
    </View>
  );
  return (
    <View style={styles.infoColumns}>
      <View style={{ flex: 1 }}>{left.map(([l, v], i) => row(l, v, i, 'left'))}</View>
      <View style={{ width: 2, backgroundColor: theme.brush.detailsGeneralBorder ?? theme.accentDark }} />
      <View style={{ flex: 1 }}>{right.map(([l, v], i) => row(l, v, i, 'right'))}</View>
    </View>
  );
}

function GeneralTab({ details, item, kind }: { details: MalDetails; item: LibraryItem; kind: ListKind }) {
  const theme = useTheme();
  const isAnime = kind === 'anime';
  const left: [string, string][] = [
    [isAnime ? 'Episodes' : 'Chapters', isAnime ? String(details.num_episodes ?? '?') : String(details.num_chapters ?? '?')],
    ['Score', details.mean != null ? String(details.mean) : '—'],
    ['Start', prettyDate(details.start_date)],
    ['My start', prettyDate(item.startDate)],
  ];
  if (!isAnime && details.num_volumes != null) {
    left.push(['Volumes', String(details.num_volumes)]);
  }
  const right: [string, string][] = [
    ['Type', details.media_type ?? '—'],
    ['Status', details.status ?? '—'],
    ['End', prettyDate(details.end_date)],
    ['My end', prettyDate(item.finishDate)],
  ];
  return (
    <View style={{ paddingTop: 5 }}>
      <InfoGrid left={left} right={right} />
      <View style={styles.divider} />
      <AppText size={theme.fontSize.medium} color={theme.brush.text} style={styles.tabHeader}>
        Synopsis
      </AppText>
      <AppText size={theme.fontSize.normal} color={theme.brush.text} style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
        {details.synopsis ?? 'No synopsis available.'}
      </AppText>
    </View>
  );
}

function DetailsTab({
  details,
  item,
  kind,
  episodes,
  themes,
}: {
  details: MalDetails;
  item: LibraryItem;
  kind: ListKind;
  episodes: EpisodeRowData[] | null;
  themes: ThemeList | null;
}) {
  const theme = useTheme();
  const isAnime = kind === 'anime';
  const left: [string, string][] = [
    ['Rank', details.rank != null ? `#${details.rank}` : '—'],
    ['Popularity', details.popularity != null ? `#${details.popularity}` : '—'],
    ['Members', details.num_list_users != null ? String(details.num_list_users) : '—'],
    ...(isAnime ? [['Episodes', String(details.num_episodes ?? '?')] as [string, string]] : []),
  ];
  const right: [string, string][] = [
    ['Source', details.source ?? '—'],
    ['Duration', details.duration ?? '—'],
    ['Rating', details.rating ?? '—'],
    ['Studios', details.studios?.map((s) => s.name).join(', ') || '—'],
  ];
  return (
    <View style={{ paddingTop: 5 }}>
      <InfoGrid left={left} right={right} />

      {details.genres && details.genres.length > 0 ? (
        <View style={styles.genresRow}>
          {details.genres.map((g) => (
            <View key={g.id} style={[styles.genreChip, { backgroundColor: theme.accentDark }]}>
              <AppText size={theme.fontSize.small} color="#fff">
                {g.name}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      {isAnime && themes ? (
        <View>
          <AppText size={theme.fontSize.medium} color={theme.brush.text} style={styles.tabHeader}>
            Openings
          </AppText>
          {themes.openings.length === 0 ? (
            <AppText size={theme.fontSize.normal} color={theme.brush.text} style={styles.rowPad}>
              None
            </AppText>
          ) : (
            themes.openings.map((t, i) => (
              <AppText key={i} size={theme.fontSize.normal} color={theme.brush.text} style={styles.rowPad}>
                {t}
              </AppText>
            ))
          )}
          <AppText size={theme.fontSize.medium} color={theme.brush.text} style={styles.tabHeader}>
            Endings
          </AppText>
          {themes.endings.length === 0 ? (
            <AppText size={theme.fontSize.normal} color={theme.brush.text} style={styles.rowPad}>
              None
            </AppText>
          ) : (
            themes.endings.map((t, i) => (
              <AppText key={i} size={theme.fontSize.normal} color={theme.brush.text} style={styles.rowPad}>
                {t}
              </AppText>
            ))
          )}
        </View>
      ) : null}

      {isAnime && episodes ? (
        <View>
          <AppText size={theme.fontSize.medium} color={theme.brush.text} style={styles.tabHeader}>
            Episodes
          </AppText>
          {episodes.map((ep, idx) => (
            <View
              key={ep.id}
              style={[
                styles.episodeRow,
                {
                  backgroundColor:
                    idx % 2 === 0 ? theme.brush.rowAlternate1 : theme.brush.rowAlternate2,
                  borderLeftWidth: 2,
                  borderLeftColor: theme.accentColor,
                },
              ]}>
              <AppText size={theme.fontSize.normal} color={theme.brush.text} style={{ flex: 1 }} numberOfLines={1}>
                {idx + 1}. {ep.title}
              </AppText>
              {ep.filler ? <AppText size={theme.fontSize.small} color={theme.accentDark}>F</AppText> : null}
              {ep.recap ? <AppText size={theme.fontSize.small} color={theme.accentDark}>R</AppText> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ReviewsTab({
  rows,
  kind,
  id,
}: {
  rows: Record<string, unknown>[] | null;
  kind: ListKind;
  id: number;
}) {
  const theme = useTheme();
  if (rows === null) {
    return (
      <AppText size={theme.fontSize.normal} color={theme.brush.text} style={styles.rowPad}>
        Loading...
      </AppText>
    );
  }
  if (rows.length === 0) {
    return <EmptyState icon="newspaper" title="No reviews" message={`${kind} #${id}`} />;
  }
  return (
    <View>
      {rows.map((row, idx) => {
        const reviewer = row.reviewer as Record<string, unknown> | undefined;
        const author = asString(reviewer?.username) ?? asString(row.user) ?? 'unknown';
        const score = reviewer?.score ?? row.score;
        const content = asString(row.content) ?? asString(row.review) ?? '';
        const date = asString(row.date);
        return (
          <View
            key={idx}
            style={[
              styles.reviewCard,
              {
                backgroundColor: idx % 2 === 0 ? theme.brush.rowAlternate1 : theme.brush.rowAlternate2,
                borderLeftWidth: 2,
                borderLeftColor: theme.accentColor,
              },
            ]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText size={theme.fontSize.normal} color={theme.accentDark} weight="medium">
                {author}
              </AppText>
              <AppText size={theme.fontSize.small} color={theme.brush.text}>
                {score != null ? `Score ${score}` : ''} {date ? `· ${date.slice(0, 10)}` : ''}
              </AppText>
            </View>
            <AppText
              size={theme.fontSize.normal}
              color={theme.brush.text}
              style={{ marginTop: 4 }}
              numberOfLines={6}>
              {content}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

function RecomsTab({ rows, kind }: { rows: Record<string, unknown>[] | null; kind: ListKind }) {
  const theme = useTheme();
  if (rows === null) {
    return (
      <AppText size={theme.fontSize.normal} color={theme.brush.text} style={styles.rowPad}>
        Loading...
      </AppText>
    );
  }
  if (rows.length === 0) {
    return <EmptyState icon="recom" title="No recommendations" />;
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 4 }}>
      {rows.map((row, idx) => {
        const entry = (row.entry ?? row) as Record<string, unknown>;
        const images = entry.images as { jpg?: { image_url?: string } } | undefined;
        const image =
          asString((entry.main_picture as { medium?: string } | undefined)?.medium) ??
          asString(images?.jpg?.image_url);
        const title = asString(entry.title) ?? '—';
        const entryId = typeof entry.mal_id === 'number' ? entry.mal_id : typeof entry.id === 'number' ? entry.id : undefined;
        return (
          <Ripple
            key={idx}
            style={{ width: '33.33%', padding: 4 }}
            onPress={() => {
              if (entryId != null) {
                router.push(`/details?kind=${kind}&id=${entryId}&title=${encodeURIComponent(title)}`);
              }
            }}>
            <RemoteImage uri={image} style={{ height: 120 }} />
            <AppText size={theme.fontSize.small} color={theme.brush.text} numberOfLines={2}>
              {title}
            </AppText>
          </Ripple>
        );
      })}
    </View>
  );
}

function RelatedTab({ details, kind }: { details: MalDetails; kind: ListKind }) {
  const theme = useTheme();
  const entries: { id: number; title: string; type: string; kind: ListKind }[] = [];
  for (const r of details.related_anime ?? []) entries.push({ ...r, kind: 'anime' });
  for (const r of details.related_manga ?? []) entries.push({ ...r, kind: 'manga' });
  if (entries.length === 0) {
    return <EmptyState icon="link_chain" title="No related entries" />;
  }
  return (
    <View>
      {entries.map((entry, idx) => (
        <Ripple
          key={`${entry.kind}-${entry.id}-${idx}`}
          style={[
            styles.relatedRow,
            {
              backgroundColor: idx % 2 === 0 ? theme.brush.rowAlternate1 : theme.brush.rowAlternate2,
              borderLeftWidth: 2,
              borderLeftColor: theme.accentColor,
            },
          ]}
          onPress={() =>
            router.push(`/details?kind=${entry.kind}&id=${entry.id}&title=${encodeURIComponent(entry.title)}`)
          }>
          <AppText size={theme.fontSize.normal} color={theme.brush.text} style={{ flex: 1 }}>
            {entry.title}
          </AppText>
          <AppText size={theme.fontSize.small} color={theme.accentDark}>
            {entry.type}
          </AppText>
        </Ripple>
      ))}
    </View>
  );
}

function CastTab({ cast }: { cast: { characters: CharacterActorPair[] } | null }) {
  const theme = useTheme();
  if (cast === null) {
    return (
      <AppText size={theme.fontSize.normal} color={theme.brush.text} style={styles.rowPad}>
        Loading...
      </AppText>
    );
  }
  if (cast.characters.length === 0) {
    return <EmptyState icon="account" title="No cast info" />;
  }
  return (
    <View>
      {cast.characters.map((c, idx) => (
        <View
          key={idx}
          style={[
            styles.castRow,
            {
              backgroundColor: idx % 2 === 0 ? theme.brush.rowAlternate1 : theme.brush.rowAlternate2,
              borderLeftWidth: 2,
              borderLeftColor: theme.accentColor,
            },
          ]}>
          <Ripple
            disabled={!c.characterId}
            onPress={() => {
              if (c.characterId) router.push(`/character-details?id=${c.characterId}&title=${encodeURIComponent(c.characterName)}`);
            }}
            style={styles.castPerson}>
            <RemoteImage uri={c.characterImage} style={styles.castImage} />
            <View style={{ flex: 1, paddingHorizontal: 8 }}>
              <AppText size={theme.fontSize.normal} color={theme.brush.text}>
                {c.characterName}
              </AppText>
              <AppText size={theme.fontSize.small} color={theme.accentDark} italic>
                {c.characterRole ?? ''}
              </AppText>
            </View>
          </Ripple>
          <Ripple
            disabled={!c.actorId}
            onPress={() => {
              if (c.actorId) router.push(`/person-details?id=${c.actorId}&title=${encodeURIComponent(c.actorName)}`);
            }}
            style={styles.castPerson}>
            <RemoteImage uri={c.actorImage} style={styles.castImage} />
            <View style={{ flex: 1, paddingHorizontal: 8 }}>
              <AppText size={theme.fontSize.normal} color={theme.brush.text}>
                {c.actorName}
              </AppText>
              <AppText size={theme.fontSize.small} color={theme.accentDark} italic>
                {c.actorLanguage ?? ''}
              </AppText>
            </View>
          </Ripple>
        </View>
      ))}
    </View>
  );
}

function StaffTab({ staff }: { staff: StaffGroup | null }) {
  const theme = useTheme();
  if (staff === null) {
    return (
      <AppText size={theme.fontSize.normal} color={theme.brush.text} style={styles.rowPad}>
        Loading...
      </AppText>
    );
  }
  if (staff.positions.length === 0) {
    return <EmptyState icon="account" title="No staff info" />;
  }
  return (
    <View>
      {staff.positions.map((position) => (
        <View key={position.name}>
          <AppText size={theme.fontSize.medium} color={theme.brush.text} style={styles.tabHeader}>
            {position.name}
          </AppText>
          {position.people.map((p) => (
            <Ripple
              key={p.id ?? p.name}
              disabled={!p.id}
              onPress={() => {
                if (p.id) router.push(`/person-details?id=${p.id}&title=${encodeURIComponent(p.name)}`);
              }}
              style={styles.rowPad}>
              <AppText size={theme.fontSize.normal} color={theme.brush.text}>
                {p.name}
              </AppText>
            </Ripple>
          ))}
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingBottom: 8 },
  headerRow: { flexDirection: 'row', minHeight: 140 },
  cover: { width: 100, height: 140 },
  coverUnderline: { height: 1, width: 100 },
  updateSection: { flexDirection: 'row', alignItems: 'center', paddingStart: 10, flexShrink: 1 },
  rowLabel: { height: 25, marginTop: 5, textAlignVertical: 'center' },
  underlineBtn: { marginTop: 3, marginBottom: 2 },
  incDec: { marginLeft: 8 },
  addSection: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  addButton: {
    height: 45,
    borderWidth: 1,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  favMore: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    flexDirection: 'row',
  },
  infoColumns: { flexDirection: 'row' },
  infoRow: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginBottom: 2,
  },
  divider: { height: 1, backgroundColor: '#88888855', marginVertical: 5 },
  tabHeader: { textAlign: 'center', margin: 5 },
  rowPad: { paddingHorizontal: 10, paddingBottom: 6 },
  genresRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 6 },
  genreChip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, margin: 2 },
  episodeRow: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewCard: { padding: 10, marginBottom: 2 },
  relatedRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginBottom: 2 },
  castRow: { flexDirection: 'row', alignItems: 'center', padding: 6, marginBottom: 2 },
  castPerson: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  castImage: { width: 40, height: 56 },
});
