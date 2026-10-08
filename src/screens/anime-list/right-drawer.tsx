import React, { useEffect, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { seasons as fetchSeasons, SeasonEntry } from '@/api/tenrai';
import { AppIcon, IconName } from '@/components/ui/app-icons';
import { AppText } from '@/components/ui/app-text';
import { adaptedLabel, ModeConfig } from '@/screens/anime-list/list-config';
import { Ripple } from '@/components/ui/ripple';
import { useTheme } from '@/theme/theme-context';
import {
  ANIME_STATUS_LIST,
  DisplayMode,
  MANGA_ADAPTED_TYPES,
  MANGA_STATUS_LIST,
  SortOption,
  TOP_ANIME_TYPES,
  TOP_MANGA_TYPES,
} from '@/api/types';

export type DrawerSection = 'filters' | 'sorting' | 'display' | 'top' | 'seasonal';

const SECTION_ICONS: Record<DrawerSection, IconName> = {
  filters: 'filter',
  sorting: 'sort',
  display: 'eye',
  top: 'fav_outline',
  seasonal: 'calendar',
};

const SECTION_TITLES: Record<DrawerSection, string> = {
  filters: 'Filters',
  sorting: 'Sorting',
  display: 'Display Modes',
  top: 'Top Types',
  seasonal: 'Seasonal Selection',
};

/** `SortOptions.GetDescription()` order (minus SortAirDay/SortSeason for manga). */
const SORT_ROWS: { key: SortOption; label: string }[] = [
  { key: 'SortTitle', label: 'Title' },
  { key: 'SortScore', label: 'Score' },
  { key: 'SortWatched', label: '' }, // uses Sort3Label
  { key: 'SortAirDay', label: 'Air day' },
  { key: 'SortLastWatched', label: 'Last updated' },
  { key: 'SortStartDate', label: 'Start date' },
  { key: 'SortEndDate', label: 'End Date' },
  { key: 'SortNothing', label: 'None' },
  { key: 'SortSeason', label: 'Season' },
  { key: 'SortPriority', label: 'Priority' },
];

const DISPLAY_ROWS: { key: DisplayMode; label: string }[] = [
  { key: 'IndefiniteGrid', label: 'Grid' },
  { key: 'IndefiniteList', label: 'Detailed List' },
  { key: 'IndefiniteCompactList', label: 'Compact List' },
];

/** `tenrai.seasons()` returns a flat `{year, season}` list; group it for the drawer. */
interface SeasonGroup {
  year: number;
  seasons: string[];
}

type SeasonGroups = SeasonGroup[];

function groupSeasons(entries: SeasonEntry[]): SeasonGroups {
  const map = new Map<number, string[]>();
  for (const e of entries) {
    const list = map.get(e.year);
    if (list) {
      if (!list.includes(e.season)) list.push(e.season);
    } else {
      map.set(e.year, [e.season]);
    }
  }
  return [...map.entries()]
    .map(([year, seasons]) => ({ year, seasons }))
    .sort((a, b) => b.year - a.year);
}

interface RightDrawerProps {
  section: DrawerSection;
  onClose: () => void;
  config: ModeConfig;
  statusInt: number;
  onStatus: (statusInt: number) => void;
  sortOption: SortOption;
  onSort: (option: SortOption) => void;
  descending: boolean;
  onDescending: (value: boolean) => void;
  hideNotCompleted: boolean;
  onHideNotCompleted: (value: boolean) => void;
  displayMode: DisplayMode;
  onDisplayMode: (mode: DisplayMode) => void;
  topType: string;
  onTopType: (type: string) => void;
  season: { year: number; name: string };
  onSeason: (year: number, name: string) => void;
}

interface RowDef {
  key: string;
  label: string;
  icon?: IconName;
  selected?: boolean;
  onPress?: () => void;
}

function DrawerRow({ row, theme }: { row: RowDef; theme: ReturnType<typeof useTheme> }) {
  const selected = row.selected;
  return (
    <Ripple
      onPress={row.onPress}
      disabled={!row.onPress}
      style={[
        styles.row,
        selected ? { backgroundColor: theme.brush.animeItemBackground } : null,
      ]}>
      {row.icon ? (
        <AppIcon name={row.icon} size={24} color={selected ? theme.accentDark : theme.brush.text} />
      ) : (
        <View style={{ width: 24 }} />
      )}
      <AppText
        size={theme.fontSize.medium}
        color={selected ? theme.accentColor : theme.brush.text}
        style={styles.rowLabel}>
        {row.label}
      </AppText>
    </Ripple>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, styles.switchRow]}>
      <AppText size={theme.fontSize.medium} color={theme.brush.text} style={{ flex: 1 }}>
        {label}
      </AppText>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#757575', true: theme.accentDark }}
        thumbColor={value ? theme.accentColor : '#bdbdbd'}
        style={{ marginVertical: -6 }}
      />
    </View>
  );
}

/** Sticky header — `AnimeListPageDrawerHeader.xml` with `BrushAppBars` bg. */
function DrawerHeader({ section }: { section: DrawerSection }) {
  const theme = useTheme();
  return (
    <View style={[styles.header, { backgroundColor: theme.brush.appBars }]}>
      <AppIcon name={SECTION_ICONS[section]} size={30} color={theme.brush.text} />
      <AppText size={26} color={theme.brush.text} style={{ marginLeft: 5 }}>
        {SECTION_TITLES[section]}
      </AppText>
    </View>
  );
}

/** `SeasonSelectionPopup` — year + season picker with an ACCEPT button. */
function SeasonPickerDialog({
  years,
  current,
  onSelect,
  onCancel,
}: {
  years: SeasonGroups;
  current: { year: number; name: string };
  onSelect: (year: number, name: string) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [year, setYear] = useState(current.year);
  const available = years.find((y) => y.year === year)?.seasons ?? [];
  const [season, setSeason] = useState<string>(
    available.includes(current.name) ? current.name : available[0] ?? 'winter'
  );

  const chip = (active: boolean) => [
    styles.chip,
    {
      backgroundColor: active ? theme.accentColor : theme.brush.animeItemInnerBackground,
    },
  ];

  return (
    <OptionsDialogLike title="Seasonal Selection" onCancel={onCancel} onAccept={() => onSelect(year, season)}>
      <AppText size={theme.fontSize.medium} color={theme.brush.text} style={{ marginBottom: 8 }}>
        Year
      </AppText>
      <View style={styles.chipRow}>
        {years.map((y) => (
          <Ripple key={y.year} onPress={() => setYear(y.year)} style={chip(y.year === year)}>
            <AppText size={theme.fontSize.normal} color={y.year === year ? '#fff' : theme.brush.text}>
              {y.year}
            </AppText>
          </Ripple>
        ))}
      </View>

      <AppText size={theme.fontSize.medium} color={theme.brush.text} style={{ marginTop: 16, marginBottom: 8 }}>
        Season
      </AppText>
      <View style={styles.chipRow}>
        {available.map((s) => (
          <Ripple key={s} onPress={() => setSeason(s)} style={chip(s === season)}>
            <AppText size={theme.fontSize.normal} color={s === season ? '#fff' : theme.brush.text}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </AppText>
          </Ripple>
        ))}
      </View>
    </OptionsDialogLike>
  );
}

/** Tiny dialog shell (title + children + ACCEPT/CANCEL) with 10dp corners. */
function OptionsDialogLike({
  title,
  children,
  onAccept,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  onAccept: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable style={styles.scrim} onPress={onCancel}>
      <View style={[styles.dialog, { backgroundColor: theme.brush.flyoutBackground }]}>
        <AppText size={theme.fontSize.dialogTitle} color={theme.brush.text} style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
          {title}
        </AppText>
        <ScrollView style={{ paddingHorizontal: 20, maxHeight: 420 }}>{children}</ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 8 }}>
          <Ripple onPress={onCancel} style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' }}>
            <AppText size={theme.fontSize.normal} color={theme.accentColor} style={{ letterSpacing: 0.8 }}>
              CANCEL
            </AppText>
          </Ripple>
          <Ripple onPress={onAccept} style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' }}>
            <AppText size={theme.fontSize.normal} color={theme.accentColor} style={{ letterSpacing: 0.8 }}>
              ACCEPT
            </AppText>
          </Ripple>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Port of the right MaterialDrawer opened by `AnimeListPageFragment`
 * (OpenFiltersDrawer / OpenSortingDrawer / OpenDisplayModesDrawer /
 * OpenTopTypesDrawer / InitSeasonalSelectionDrawer).
 */
export function RightDrawer(props: RightDrawerProps) {
  const theme = useTheme();
  const { section, onClose, config } = props;
  const slide = useState(() => new Animated.Value(300))[0];

  const [seasonList, setSeasonList] = useState<SeasonGroups | null>(null);
  const [seasonPick, setSeasonPick] = useState(false);

  useEffect(() => {
    Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: true }).start();
  }, [slide]);

  useEffect(() => {
    if (section !== 'seasonal' || seasonList) return;
    let alive = true;
    fetchSeasons()
      .then((res) => {
        if (alive) setSeasonList(groupSeasons(res.data ?? []));
      })
      .catch(() => {
        if (alive) setSeasonList([]);
      });
    return () => {
      alive = false;
    };
  }, [section, seasonList]);

  const rows: RowDef[] = [];
  let switches: React.ReactNode = null;
  let custom: React.ReactNode = null;

  switch (section) {
    case 'filters': {
      const statuses = config.kind === 'manga' ? MANGA_STATUS_LIST : ANIME_STATUS_LIST;
      const labels = [config.filter1Label, 'Completed', 'On Hold', 'Dropped', config.filter5Label];
      statuses.forEach((_, i) => {
        const statusIds = [1, 2, 3, 4, 6];
        rows.push({
          key: String(statusIds[i]),
          label: labels[i],
          icon: 'list',
          selected: props.statusInt === statusIds[i],
          onPress: () => props.onStatus(statusIds[i]),
        });
      });
      rows.push({
        key: '7',
        label: config.statusAllLabel,
        icon: 'list',
        selected: props.statusInt === 7,
        onPress: () => props.onStatus(7),
      });
      break;
    }

    case 'sorting': {
      for (const row of SORT_ROWS) {
        if (config.kind === 'manga' && (row.key === 'SortAirDay' || row.key === 'SortSeason')) continue;
        rows.push({
          key: row.key,
          label: row.key === 'SortWatched' ? config.sort3Label : row.label,
          icon: 'sort',
          selected: props.sortOption === row.key,
          onPress: () => props.onSort(row.key),
        });
      }
      switches = (
        <View>
          <SwitchRow label="Descending Order" value={props.descending} onChange={props.onDescending} />
          <SwitchRow
            label="Hide Not Completed"
            value={props.hideNotCompleted}
            onChange={props.onHideNotCompleted}
          />
        </View>
      );
      break;
    }

    case 'display': {
      for (const row of DISPLAY_ROWS) {
        rows.push({
          key: row.key,
          label: row.label,
          icon: 'list',
          selected: props.displayMode === row.key,
          onPress: () => props.onDisplayMode(row.key),
        });
      }
      break;
    }

    case 'top': {
      let types: readonly string[];
      if (config.mode === 'TopAnime') types = TOP_ANIME_TYPES;
      else if (config.mode === 'TopManga') types = TOP_MANGA_TYPES;
      else types = MANGA_ADAPTED_TYPES;
      for (const t of types) {
        rows.push({
          key: t,
          label: config.mode === 'MangaAdapted' ? adaptedLabel(t) : t,
          icon: 'fav_outline',
          selected: props.topType === t,
          onPress: () => props.onTopType(t),
        });
      }
      break;
    }

    case 'seasonal': {
      if (seasonList === null) {
        custom = (
          <AppText size={theme.fontSize.normal} color={theme.brush.text} style={{ padding: 16 }}>
            Loading seasons…
          </AppText>
        );
      } else if (seasonList.length === 0) {
        custom = (
          <AppText size={theme.fontSize.normal} color={theme.brush.noSearchResults} style={{ padding: 16 }}>
            We have come up empty...
          </AppText>
        );
      } else {
        for (const group of seasonList) {
          for (const s of group.seasons) {
            const label = `${s.charAt(0).toUpperCase() + s.slice(1)} ${group.year}`;
            rows.push({
              key: `${group.year}-${s}`,
              label,
              icon: 'seasonal',
              selected: props.season.year === group.year && props.season.name === s,
              onPress: () => props.onSeason(group.year, s),
            });
          }
        }
        rows.push({
          key: 'pick',
          label: 'Select season…',
          icon: 'calendar',
          onPress: () => setSeasonPick(true),
        });
      }
      break;
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.scrim} onPress={onClose} />

      <Animated.View
        style={[
          styles.panel,
          { backgroundColor: theme.brush.hamburgerInnerBackground, transform: [{ translateX: slide }] },
        ]}>
        <DrawerHeader section={section} />
        <ScrollView style={{ flex: 1 }}>
          {rows.map((row) => (
            <DrawerRow key={row.key} row={row} theme={theme} />
          ))}
          {switches}
          {custom}
        </ScrollView>
      </Animated.View>

      {seasonPick && seasonList ? (
        <SeasonPickerDialog
          years={seasonList}
          current={props.season}
          onSelect={(year, name) => {
            props.onSeason(year, name);
            setSeasonPick(false);
          }}
          onCancel={() => setSeasonPick(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#00000099',
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 300,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 19,
    paddingBottom: 30,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingLeft: 16,
    paddingRight: 8,
  },
  rowLabel: { marginLeft: 24, flex: 1 },
  switchRow: { paddingRight: 16 },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 10,
    elevation: 8,
    marginBottom: 'auto',
    marginTop: 'auto',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
});
