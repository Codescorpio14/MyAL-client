import React from 'react';
import { GestureResponderEvent, StyleSheet, View } from 'react-native';

import { statusToShortString, statusToString } from '@/api/status';
import { LibraryItem } from '@/api/types';
import { AppIcon, IconName } from '@/components/ui/app-icons';
import { AppText } from '@/components/ui/app-text';
import { AccentPillButton, IncDecButtons, UnderlineButton } from '@/components/ui/buttons';
import { FlyoutRect } from '@/components/ui/flyout';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { railsBoth, outlineBox } from '@/components/ui/shapes';
import { useSettings } from '@/store/settings';
import { SEMANTIC } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-context';

/** Callbacks every list display mode forwards to the screen. */
export interface ItemActions {
  onOpen: (item: LibraryItem) => void;
  /** Long-press / ⋮ — anchored flyout (copy link/title, priorities…). */
  onMore: (item: LibraryItem, rect: FlyoutRect) => void;
  onAdd: (item: LibraryItem) => void;
  onStatusDialog: (item: LibraryItem) => void;
  onScoreDialog: (item: LibraryItem) => void;
  onWatchedDialog: (item: LibraryItem) => void;
  onInc: (item: LibraryItem) => void;
  onDec: (item: LibraryItem) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dayAbbrev(item: LibraryItem): string | undefined {
  return item.airDay != null && item.airDay >= 0 ? DAYS[item.airDay] : undefined;
}

/** `MyEpisodesBind` — "Watched : 5/23" (anime) / "Read : 5/23" (manga). */
export function progressLabel(item: LibraryItem): string {
  const total = item.kind === 'anime' ? item.episodes : item.chapters;
  const word = item.kind === 'anime' ? 'Watched' : 'Read';
  return `${word} : ${item.myProgress ?? 0}/${total || '?'}`;
}

/** `MyEpisodesBindShort` — "5/23". */
export function progressShort(item: LibraryItem): string {
  const total = item.kind === 'anime' ? item.episodes : item.chapters;
  return `${item.myProgress ?? 0}/${total || '?'}`;
}

/** `ParentAbstraction.Type` display form ("tv" → "Tv"). */
export function displayType(mediaType?: string): string | undefined {
  if (!mediaType) return undefined;
  const map: Record<string, string> = {
    tv: 'Tv',
    ova: 'Ova',
    ona: 'Ona',
    movie: 'Movie',
    special: 'Special',
    music: 'Music',
    manga: 'Manga',
    novel: 'Novel',
    manhua: 'Manhua',
    manhwa: 'Manhwa',
    doujinshi: 'Doujinshi',
    lightnovel: 'Light Novel',
    oneshot: 'One Shot',
  };
  const key = mediaType.toLowerCase();
  if (map[key]) return map[key];
  return mediaType.charAt(0).toUpperCase() + mediaType.slice(1);
}

function longPressRect(event: GestureResponderEvent): FlyoutRect {
  const { pageX, pageY } = event.nativeEvent;
  return { x: pageX, y: pageY };
}

/** `inc_dec_btn_backgroud` — deep fill + 1dp accent outline with a glyph. */
function BoxedIcon({ name, size = 35, glyph = 24 }: { name: IconName; size?: number; glyph?: number }) {
  const theme = useTheme();
  return (
    <View
      style={[
        { width: size, height: size, backgroundColor: theme.brush.deepBackground, borderWidth: 1, borderColor: theme.accentColor },
        styles.center,
      ]}>
      <AppIcon name={name} size={glyph} color={theme.brush.text} />
    </View>
  );
}

function PriorityRibbon({ priority }: { priority?: number }) {
  if (!priority || priority <= 0) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -15,
        top: -15,
        width: 30,
        height: 30,
        backgroundColor: SEMANTIC.onHold,
        transform: [{ rotate: '-45deg' }],
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Detailed list row — AnimeListItem.xml (170dp)                       */
/* ------------------------------------------------------------------ */

export function ListRow({ item, actions }: { item: LibraryItem; actions: ItemActions }) {
  const theme = useTheme();
  const settings = useSettings();
  const day = dayAbbrev(item);
  const statusLabel = item.myStatus ? statusToString(statusIntOf(item), item.kind, item.isRewatching) : '';
  const inList = Boolean(item.inList);

  return (
    <Ripple
      onPress={() => actions.onOpen(item)}
      onLongPress={(e) => actions.onMore(item, longPressRect(e))}
      style={{ height: 170 }}>
      <View
        style={{
          flex: 1,
          marginBottom: 5,
          borderLeftWidth: 4,
          borderLeftColor: theme.accentColor,
          paddingLeft: 1,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
        <View style={[styles.listCard, { backgroundColor: theme.brush.animeItemBackground }]}>
          {/* Image column (116dp) */}
          <View style={styles.listImageCol}>
            <RemoteImage uri={item.imageUrl} style={StyleSheet.absoluteFill} />
            {!inList ? (
              <Ripple onPress={() => actions.onAdd(item)} style={styles.addBtn}>
                <BoxedIcon name="add" size={35} glyph={24} />
              </Ripple>
            ) : null}
            {settings.showPriorities ? <PriorityRibbon priority={item.priority} /> : null}
          </View>

          {/* Right section */}
          <View style={{ flex: 1 }}>
            <AppText
              numberOfLines={3}
              ellipsizeMode="tail"
              size={theme.fontSize.medium}
              style={styles.listTitle}>
              {settings.preferEnglishTitles ? item.altTitle || item.title : item.title}
            </AppText>

            {day ? (
              <View style={styles.chip}>
                <AppText size={theme.fontSize.medium} color="#fff">
                  {day}
                </AppText>
                {item.airTime ? (
                  <AppText size={theme.fontSize.normal} color="#b9b9b9" italic style={{ marginLeft: 5, marginTop: 1 }}>
                    {item.airTime}
                  </AppText>
                ) : null}
              </View>
            ) : null}

            <View style={styles.listBottomRight}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                {displayType(item.mediaType) ? (
                  <AppText
                    size={theme.fontSize.small}
                    italic
                    style={{ marginRight: 5, marginBottom: 1 }}>
                    {displayType(item.mediaType)}
                  </AppText>
                ) : null}
                {inList ? (
                  <UnderlineButton
                    label={progressLabel(item)}
                    height={25}
                    onPress={() => actions.onWatchedDialog(item)}
                  />
                ) : null}
              </View>

              {inList ? (
                <View style={{ flexDirection: 'row', marginTop: 5 }}>
                  <AccentPillButton
                    label={statusLabel}
                    fontSize={theme.fontSize.normal}
                    onPress={() => actions.onStatusDialog(item)}
                  />
                  <AccentPillButton
                    label={`${item.myScore ?? 0}/10`}
                    fontSize={theme.fontSize.normal}
                    style={{ marginLeft: 5 }}
                    onPress={() => actions.onScoreDialog(item)}
                  />
                </View>
              ) : null}
            </View>

            {inList ? (
              <View style={styles.listIncDec}>
                <IncDecButtons onIncrement={() => actions.onInc(item)} onDecrement={() => actions.onDec(item)} />
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Ripple>
  );
}

function statusIntOf(item: LibraryItem): number {
  switch (item.myStatus) {
    case 'watching':
      return 1;
    case 'completed':
      return 2;
    case 'on_hold':
      return 3;
    case 'dropped':
      return 4;
    case 'plan_to_watch':
    case 'plan_to_read':
      return 6;
    default:
      return 7;
  }
}

/* ------------------------------------------------------------------ */
/* Grid cell — AnimeGridItem.xml                                       */
/* ------------------------------------------------------------------ */

export function GridCell({
  item,
  actions,
  width,
  allowAdd = true,
}: {
  item: LibraryItem;
  actions: ItemActions;
  width: number;
  allowAdd?: boolean;
}) {
  const theme = useTheme();
  const settings = useSettings();
  const inList = Boolean(item.inList);

  return (
    <Ripple
      onPress={() => actions.onOpen(item)}
      onLongPress={(e) => actions.onMore(item, longPressRect(e))}
      style={{ width, padding: 2 }}>
      <View style={{ backgroundColor: theme.brush.deepBackground, elevation: 2, width: width - 4 }}>
        {/* Clean poster: keep list metadata outside the image. */}
        <View style={[styles.gridUpper, { backgroundColor: theme.brush.appBars }]}>
          <RemoteImage uri={item.imageUrl} style={StyleSheet.absoluteFill} />

          {inList ? (
            <View style={[styles.gridStatus, { backgroundColor: SEMANTIC.opaqueTextView }]}>
              <AppText size={theme.fontSize.small} weight="medium" color="#fff">
                {statusToShortString(statusIntOf(item), item.kind, item.isRewatching)}
              </AppText>
              <Ripple onPress={() => actions.onWatchedDialog(item)} style={styles.gridProgress}>
                <AppText
                  size={theme.fontSize.small}
                  color="#fff"
                  style={{ borderBottomWidth: 1, borderBottomColor: theme.accentColor }}>
                  {progressShort(item)}
                </AppText>
              </Ripple>
              <AppText size={theme.fontSize.small} italic color="#fff">
                {item.myScore ?? 0}/10
              </AppText>
            </View>
          ) : allowAdd ? (
            <Ripple onPress={() => actions.onAdd(item)} style={styles.gridAddBtn}>
              <BoxedIcon name="add" size={35} glyph={24} />
            </Ripple>
          ) : null}
        </View>

        {/* Accent divider */}
        <View style={{ height: 1, backgroundColor: theme.accentColor }} />

        {/* Lower section — title + more (55dp, 2dp accent rails) */}
        <View style={{ backgroundColor: theme.brush.animeItemBackground }}>
          <View style={[styles.gridLower, railsBoth(theme.accentColor, 2)]}>
            <AppText
              numberOfLines={2}
              size={theme.fontSize.medium}
              style={{ flex: 1, margin: 5 }}>
              {settings.preferEnglishTitles ? item.altTitle || item.title : item.title}
            </AppText>
            <Ripple
              borderless
              onPress={(e) => actions.onMore(item, longPressRect(e))}
              style={{ width: 34, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
              <AppIcon name="more_vertical" size={24} color={theme.brush.text} />
            </Ripple>
          </View>
        </View>
      </View>
    </Ripple>
  );
}

/* ------------------------------------------------------------------ */
/* Compact row — AnimeCompactItem.xml                                  */
/* ------------------------------------------------------------------ */

export function CompactRow({ item, actions }: { item: LibraryItem; actions: ItemActions }) {
  const theme = useTheme();
  const settings = useSettings();
  const day = dayAbbrev(item);
  const inList = Boolean(item.inList);

  return (
    <Ripple
      onPress={() => actions.onOpen(item)}
      onLongPress={(e) => actions.onMore(item, longPressRect(e))}
      style={{ paddingTop: 2, paddingBottom: 2 }}>
      <View
        style={{
          borderLeftWidth: 4,
          borderLeftColor: theme.accentColor,
          paddingLeft: 4,
          paddingTop: 2,
          paddingBottom: 2,
        }}>
        <View style={{ backgroundColor: theme.brush.animeItemBackground, elevation: 2 }}>
          {/* General section — 45dp */}
          <View style={styles.compactSection}>
            <View style={styles.compactMeta}>
              <AppText size={14}>{item.score != null ? item.score.toFixed(2) : ''}</AppText>
              <AppText size={14}>{displayType(item.mediaType) ?? ''}</AppText>
            </View>

            <View style={[styles.verticalDivider, { backgroundColor: theme.brush.appBars, marginHorizontal: 5 }]} />

            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <AppText numberOfLines={2} ellipsizeMode="tail" style={{ flex: 1, marginRight: 5 }}>
                {settings.preferEnglishTitles ? item.altTitle || item.title : item.title}
              </AppText>
              {day ? (
                <AppText size={theme.fontSize.big} style={{ marginRight: 7 }}>
                  {day}
                </AppText>
              ) : null}
            </View>
          </View>

          {/* Edit section — 45dp */}
          {inList ? (
            <View style={[styles.compactSection, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.brush.appBars }]}>
              <View style={{ flex: 1 }} />
              <Ripple
                onPress={() => actions.onScoreDialog(item)}
                style={[styles.compactBox, outlineBox(theme.brush.deepBackground, theme.accentColor), { marginRight: 10 }]}>
                <AppText>{`${item.myScore ?? 0}/10`}</AppText>
              </Ripple>
              <Ripple
                onPress={() => actions.onStatusDialog(item)}
                style={[styles.compactBox, outlineBox(theme.brush.deepBackground, theme.accentColor), { marginRight: 10 }]}>
                <AppText>
                  {item.myStatus ? statusToString(statusIntOf(item), item.kind, item.isRewatching) : ''}
                </AppText>
              </Ripple>
              <View style={{ flex: 1 }} />
              <UnderlineButton
                label={progressLabel(item)}
                minWidth={90}
                height={35}
                style={{ paddingHorizontal: 5 }}
                onPress={() => actions.onWatchedDialog(item)}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Ripple>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },

  listCard: { flex: 1, flexDirection: 'row', elevation: 2 },
  listImageCol: { width: 116, marginLeft: 2, overflow: 'hidden' },
  addBtn: { position: 'absolute', right: 0, bottom: 0, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  listTitle: { position: 'absolute', left: 5, top: 5, right: 40 },
  chip: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SEMANTIC.opaqueTextView,
    paddingLeft: 7,
    paddingRight: 7,
    paddingTop: 3,
    paddingBottom: 3,
  },
  listBottomRight: { position: 'absolute', right: 5, bottom: 6, alignItems: 'flex-end' },
  listIncDec: { position: 'absolute', left: 5, bottom: 6 },

  gridUpper: { height: 174 },
  gridStatus: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 44,
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 4,
    gap: 2,
  },
  gridProgress: { paddingVertical: 1 },
  gridAddBtn: { position: 'absolute', right: 0, bottom: 0, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  gridLower: { height: 55, flexDirection: 'row', alignItems: 'center', paddingRight: 2 },

  compactSection: { height: 45, flexDirection: 'row', alignItems: 'center', padding: 5 },
  compactMeta: { width: 35, alignItems: 'center' },
  verticalDivider: { width: 1, alignSelf: 'stretch' },
  compactBox: { padding: 8, alignItems: 'center', justifyContent: 'center' },
});
