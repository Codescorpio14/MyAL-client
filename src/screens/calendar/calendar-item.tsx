import React from 'react';
import { StyleSheet, View } from 'react-native';

import { statusToInt, statusToShortString } from '@/api/status';
import { AppIcon } from '@/components/ui/app-icons';
import { AppText } from '@/components/ui/app-text';
import { RemoteImage } from '@/components/ui/remote-image';
import { Ripple } from '@/components/ui/ripple';
import { railsBoth } from '@/components/ui/shapes';
import { CalendarEntry } from '@/screens/calendar/calendar-data';
import { useTheme } from '@/theme/theme-context';

/**
 * Port of `AnimeGridItem` (Resources/layout/AnimeGridItem.xml + .cs) as it is
 * rendered inside the calendar (`InjectAnimeListAdapter(..., displayGridTimeTillAir: true)`):
 * no swipe-to-inc/dec, but the extra "time till air" chip below the type chip.
 * Metrics follow `Settings.MakeGridItemsSmaller` (defaults to true): 174dp
 * artwork, 44dp title bar, 13/11sp captions.
 */

/** `AnimeGridItem.cs` — `new Color(110, 110, 110)` for a not-yet-airing day. */
const GRAY = '#6E6E6E';

/** `AnimeType.ToString()` — the bottom-left type chip. */
const TYPE_LABELS: Record<string, string> = {
  tv: 'TV',
  tv_short: 'TV Short',
  ova: 'OVA',
  movie: 'Movie',
  special: 'Special',
  ona: 'ONA',
  music: 'Music',
};

function typeLabel(mediaType?: string): string {
  if (!mediaType) return '';
  return TYPE_LABELS[mediaType] ?? mediaType;
}

/** `GlobalScoreBind` / `MyScoreBindShort` — "8.40", "9/10" or "N/A". */
function scoreText(entry: CalendarEntry): string {
  if (entry.myScore && entry.myScore > 0) return `${entry.myScore}/10`;
  if (entry.score) return entry.score.toFixed(2);
  return 'N/A';
}

interface CalendarGridItemProps {
  entry: CalendarEntry;
  onPress: () => void;
}

export function CalendarGridItem({ entry, onPress }: CalendarGridItemProps) {
  const theme = useTheme();

  const chipBackground = theme.semantic.opaqueTextView;
  const white = theme.semantic.white;
  const inList = Boolean(entry.inList);

  // `BindModelBasic`: the status/progress block only exists for list entries,
  // otherwise the score alone is shown (and only when there is one).
  const status = inList
    ? statusToShortString(statusToInt(entry.myStatus), 'anime', entry.isRewatching ?? false)
    : '';
  const episodes = inList ? `${entry.myProgress ?? 0}/${entry.episodes ?? '?'}` : '';
  const showScore = inList || Boolean(entry.score);
  const type = typeLabel(entry.mediaType);

  return (
    <Ripple onPress={onPress} style={styles.root}>
      <View style={[styles.card, { backgroundColor: theme.brush.deepBackground }]}>
        {/* Upper section — artwork with the info overlays (174dp). */}
        <View style={[styles.upper, { backgroundColor: theme.brush.appBars }]}>
          <RemoteImage uri={entry.imageUrl} style={StyleSheet.absoluteFill} />

          {/* Top left: broadcast day + time till next air (`AirDayTillBind`). */}
          {entry.dayShort ? (
            <View style={[styles.tlChip, { backgroundColor: chipBackground }]}>
              <AppText size={theme.fontSize.semiNormal} color={entry.dayGray ? GRAY : white}>
                {entry.dayShort}
              </AppText>
              {entry.airDayTill ? (
                <AppText
                  size={theme.fontSize.tiny}
                  italic
                  color={theme.brush.noSearchResults}
                  style={styles.tlSub}>
                  {entry.airDayTill}
                </AppText>
              ) : null}
            </View>
          ) : null}

          {/* Top right: status letter, watched/total episodes, score. */}
          {status || episodes || showScore ? (
            <View style={[styles.trColumn, { backgroundColor: chipBackground }]}>
              {status ? (
                <AppText size={theme.fontSize.semiNormal} weight="medium" color={white}>
                  {status}
                </AppText>
              ) : null}
              {episodes ? (
                <AppText
                  size={theme.fontSize.semiNormal}
                  color={white}
                  style={[styles.underline, { borderBottomColor: theme.accentColor }]}>
                  {episodes}
                </AppText>
              ) : null}
              {showScore ? (
                <AppText size={theme.fontSize.semiNormal} italic color={white} style={styles.score}>
                  {scoreText(entry)}
                </AppText>
              ) : null}
            </View>
          ) : null}

          {/* Bottom left: type chip + exact time till air (calendar only). */}
          <View style={styles.blColumn}>
            {type ? (
              <View style={[styles.blChip, { backgroundColor: chipBackground }]}>
                <AppText size={theme.fontSize.tiny} italic color={white}>
                  {type}
                </AppText>
              </View>
            ) : null}
            {entry.timeTillAir ? (
              <View style={[styles.blChip, { backgroundColor: chipBackground }]}>
                <AppText size={theme.fontSize.normal} italic color={white}>
                  {entry.timeTillAir}
                </AppText>
              </View>
            ) : null}
          </View>

          {/* Bottom right: tags button (`AnimeGridItemTagsButton`). */}
          {entry.tags ? (
            <View style={[styles.tagButton, { backgroundColor: chipBackground }]}>
              <AppIcon name="tag" size={24} color={white} />
            </View>
          ) : null}
        </View>

        {/* 1dp accent divider (`<View android:background="?AccentColour" />`). */}
        <View style={[styles.divider, { backgroundColor: theme.accentColor }]} />

        {/* Lower section: 44dp title bar with accent side rails. */}
        <View style={{ backgroundColor: theme.brush.animeItemBackground }}>
          <View style={[styles.lower, railsBoth(theme.accentColor)]}>
            <AppText
              size={theme.fontSize.small}
              color={theme.brush.text}
              numberOfLines={2}
              ellipsizeMode="tail"
              style={styles.title}>
              {entry.title}
            </AppText>
            <AppIcon name="more_vertical" size={24} color={theme.brush.text} />
          </View>
        </View>
      </View>
    </Ripple>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch' },
  card: { padding: 2, elevation: 2, borderRadius: 0 },
  upper: { height: 174, overflow: 'hidden' },
  tlChip: {
    position: 'absolute',
    left: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tlSub: { marginLeft: 5 },
  trColumn: {
    position: 'absolute',
    right: 0,
    top: 0,
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  underline: { borderBottomWidth: 1 },
  score: { marginTop: 5 },
  blColumn: { position: 'absolute', left: 0, bottom: 0, alignItems: 'flex-start' },
  blChip: { paddingHorizontal: 5, paddingVertical: 2 },
  tagButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1 },
  lower: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  title: { flex: 1, margin: 5 },
});
