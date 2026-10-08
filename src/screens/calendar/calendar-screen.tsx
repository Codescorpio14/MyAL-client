import { router } from 'expo-router';
import type { JSX } from 'react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppBar } from '@/components/shell/app-bar';
import { useOpenDrawer } from '@/components/shell/use-open-drawer';
import { AppText } from '@/components/ui/app-text';
import { EmptyState, LoadingOverlay } from '@/components/ui/overlays';
import { TabDef, TabStrip } from '@/components/ui/tab-strip';
import {
  buildCalendar,
  CalendarEntry,
  CalendarModel,
  todayTabKey,
} from '@/screens/calendar/calendar-data';
import { CalendarGridItem } from '@/screens/calendar/calendar-item';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme/theme-context';

/**
 * Calendar page — port of `CalendarPageFragment` / `CalendarPageViewModel`:
 *
 *  - app bar: status "Calendar", hamburger, refresh (`RefreshButtonVisibility`
 *    is set for `PageIndex.PageCalendar`, refresh → `Init(true)`);
 *  - `PagerSlidingTabStrip` at 55dp (`CalendarPageTabStrip`) with 7 day tabs
 *    ("Sun"…`CalendarPivotPage.Sub` = count or "-") + the "Summary" tab;
 *  - tab content is `CalenarPageTabContent.xml` — a 2/3 column grid of
 *    `AnimeGridItem`s; the summary tab groups the same grid under full day
 *    names with an accent underline (`CalendarPageSummaryTabContent.xml`);
 *  - "Building calendar, please wait..." progress
 *    (`CalendarPageProgressBarGrid` in `CalendarPage.xml`).
 */
export function CalendarScreen(): JSX.Element {
  const theme = useTheme();
  const settings = useSettings();
  const openDrawer = useOpenDrawer();
  const { width } = useWindowDimensions();
  const columns = 3;
  const columnWidth = width / columns;

  const [model, setModel] = useState<CalendarModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  /** `Settings.CalendarStartOnToday` → today's tab. */
  const preferences = useMemo(() => ({
    calendarIncludeWatching: settings.calendarIncludeWatching,
    calendarIncludePlanned: settings.calendarIncludePlanned,
    calendarMondayFirst: settings.calendarMondayFirst,
  }), [
    settings.calendarIncludeWatching,
    settings.calendarIncludePlanned,
    settings.calendarMondayFirst,
  ]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const load = useCallback(async (force: boolean) => {
    setLoading(true);
    try {
      const built = await buildCalendar(force, preferences);
      setModel(built);
      setFailed(false);
    } catch {
      setModel(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [preferences]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const built = await buildCalendar(false, preferences);
        if (cancelled) return;
        setModel(built);
        setFailed(false);
      } catch {
        if (cancelled) return;
        setModel(null);
        setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preferences]);

  const openDetails = useCallback((entry: CalendarEntry) => {
    router.push(
      `/details?kind=anime&id=${entry.id}&title=${encodeURIComponent(entry.title)}`
    );
  }, []);

  function renderGrid(items: CalendarEntry[]): React.ReactNode {
    return (
      <View style={styles.grid}>
        {items.map((entry) => (
          <View key={entry.id} style={[styles.cell, { width: columnWidth }]}>
            <CalendarGridItem entry={entry} onPress={() => openDetails(entry)} />
          </View>
        ))}
      </View>
    );
  }

  const visibleDays = model?.days.filter((day) => !settings.calendarRemoveEmptyDays || day.items.length > 0) ?? [];
  const tabs: TabDef[] = model
    ? [
        ...visibleDays
          .map((day) => ({ key: day.key, label: `${day.short}\n${day.sub}` })),
        { key: 'summary', label: 'Summary' },
      ]
    : [];

  const requestedActiveKey = activeKey ?? (settings.calendarStartOnToday ? todayTabKey() : 'summary');
  const visibleActiveKey =
    requestedActiveKey === 'summary' ||
    visibleDays.some((day) => day.key === requestedActiveKey)
      ? requestedActiveKey
      : visibleDays[0]?.key ?? 'summary';
  const activeDay =
    model && visibleActiveKey !== 'summary'
      ? model.days.find((day) => day.key === visibleActiveKey)
      : undefined;
  const activeSummary = model && visibleActiveKey === 'summary' ? model.summary : undefined;
  const visibleCount = activeSummary ? activeSummary.length : activeDay ? activeDay.items.length : 0;

  return (
    <View style={[styles.root, { backgroundColor: theme.brush.deepBackground }]}>
      <AppBar
        title="Calendar"
        onMenuPress={openDrawer}
        onRefresh={() => void load(true)}
      />

      {model ? (
        <TabStrip
          tabs={tabs}
          activeKey={visibleActiveKey}
          onChange={setActiveKey}
          height={theme.dimens.tabStripHeightTall}
        />
      ) : null}

      <View style={styles.content}>
        {activeSummary && activeSummary.length > 0 ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {activeSummary.map((group) => (
              <View key={group.full}>
                <AppText
                  size={theme.fontSize.big}
                  color={theme.brush.text}
                  style={[styles.summaryHeader, { borderBottomColor: theme.accentColor }]}>
                  {group.full}
                </AppText>
                {renderGrid(group.items)}
              </View>
            ))}
          </ScrollView>
        ) : null}

        {activeDay && activeDay.items.length > 0 ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {renderGrid(activeDay.items)}
          </ScrollView>
        ) : null}

        {/* Empty day/summary tab, or a failed refresh — the original leaves
            these blank; the app's standard empty notice reads better. */}
        {!loading && (failed || (model !== null && visibleCount === 0)) ? (
          <EmptyState icon="list" title="We have come up empty..." style={styles.flex} />
        ) : null}

        {/* `CalendarPageProgressBarGrid` — "Building calendar, please wait..." */}
        <LoadingOverlay visible={loading} label="Building calendar, please wait..." />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { paddingHorizontal: 3, paddingBottom: 5 },
  summaryHeader: {
    marginTop: 5,
    marginBottom: 5,
    marginHorizontal: 25,
    textAlign: 'center',
    borderBottomWidth: 1,
  },
});
